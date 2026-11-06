# scoobydao-web — Next.js app (Claude Code spec)

> Frontend for ScoobyDAO at ETHGlobal Mumbai 2026. Read this file and `INTERFACES.md` fully before writing code. This repo consumes the backend API (`INTERFACES.md` §4) and the contract ABIs/addresses (`INTERFACES.md` §1–2). It owns no secrets.

**Sibling repos:** `ScoobyDAO-contracts` (ABIs + addresses) · `ScoobyDAO-backend` (API, World gate).

## 0. Hard rules

1. **From scratch** unless on the Continuity Track. Don't copy 2025 UI or assets.
2. **No secrets.** Only `NEXT_PUBLIC_*` values. Never call World's token endpoint from the browser; the reviewer page only displays what the backend returns.
3. **Never treat a client-side state as authorization.** The UI shows status from the backend and chain; it never decides that something is approved.
4. Call them **"For/Against shares"**, not PT/YT.
5. Commit steadily.

## 1. Stack

Next.js (App Router) + TypeScript, wagmi + viem, RainbowKit or ConnectKit, TanStack Query, Tailwind. Optional: `qrcode.react` for the World verification link.

## 2. Layout

```
scoobydao-web/
├─ CLAUDE.md · INTERFACES.md · README.md · .env.example
├─ scripts/sync-contracts.sh     ← copies abi/ + sepolia.json from ScoobyDAO-contracts
├─ src/contracts/ (abi/*.json, sepolia.json, index.ts typed exports)
├─ src/lib/ (api.ts typed client, commitment.ts, format.ts, explorer.ts)
├─ src/app/
│  ├─ page.tsx                   ← reports list
│  ├─ reports/[id]/page.tsx      ← report detail (manifest, evidence, hash)
│  ├─ approve/[id]/page.tsx      ← reviewer screen (World Agent Pass)
│  ├─ claim/[claimId]/page.tsx   ← stake: commit / reveal / redeem
│  └─ market/[claimId]/page.tsx  ← trade For/Against shares on v4
└─ src/components/ (StatusChip, ClaimCard, OddsBar, TxLink, Countdown, Banner)
```

## 3. Pages

### 3.1 `/` — Reports

List from `GET /reports`. Columns: token, claim types, status chip (Draft · Awaiting approval · Denied · Expired · Published/Open · Frozen · Resolved), created time. Demo button "Scan now" → `POST /demo/scan` (shown only if `NEXT_PUBLIC_DEMO_MODE=true`).

### 3.2 `/reports/[id]`

Shows the full manifest JSON, evidence, `manifestHash` and a "Recompute hash" button that hashes the canonical JSON in the browser and shows ✓ if it matches. Button "Request human approval" → `POST /reports/:id/approve` → redirect to `/approve/[approvalId]`.

### 3.3 `/approve/[id]` — the reviewer screen (World prize demo)

Must display, large and clear, **before** the reviewer opens World App:

- token chain + address (explorer link)
- exact claim text (rendered from manifest claim types + params)
- `manifestHash`
- `userCode` and `verificationUri` (button + QR)
- countdown to `expiresAt`
  Poll `GET /approvals/:id` every 2s. Result states:
- `approved`/`spent` → "Approved — claim published", tx link, link to `/claim/[claimId]`
- `denied` → red banner **"Denied — draft only, no market opened"**
- `expired` → amber banner **"Expired — draft only, no market opened"**
- `rejected_not_reviewer` → "This World ID isn't a registered reviewer — nothing published"
  Copy note under the code: "World App shows only the requester and this code. Check the claim above before approving."

### 3.4 `/claim/[claimId]` — Stake

Data from `GET /claims/:claimId` + direct viem reads.

- Header: token, status, window countdown, evidence hash, trigger tx (if frozen).
- **Excluded-wallet notice:** if `isExcluded(claimId, address)` → disable staking and show "Wallets linked to the token deployer can't stake on this claim."
- **Commit form:** side (For/Against), amount (USDC, 6 decimals). On submit: generate 32-byte random `salt`, compute `commitment = keccak256(encodeAbiParameters([uint256,address,uint8,uint256,bytes32], [claimId, account, side, amount, salt]))`, save `{claimId, side, amount, salt}` to `localStorage` keyed by `scoobydao:<chainId>:<claimId>:<account>` (wrap in try/catch) **and** offer a "Download backup" JSON. Then USDC `approve` → `commit`.
- **Reveal** button: reads saved salt (or lets the user upload the backup) → `reveal`.
- **Redeem** button after resolve → `redeem`; show payout preview with the formula from `INTERFACES.md` / contracts spec.
- Totals: committed, revealed For, revealed Against; `OddsBar` from `impliedForProbability`.
- Frozen state banner: "Claim triggered — staking and trading halted at block N."

### 3.5 `/market/[claimId]` — Trade shares

Swap For↔USDC and Against↔USDC through the v4 router address in `sepolia.json`. Use the Uniswap docs for the current router/quoter interface (don't guess). When frozen, disable inputs and show "Trading halted — claim triggered"; if a user forces a tx anyway, show the revert reason `RiskFi: claim frozen` (this is a demo moment).

## 4. Components and helpers

- `StatusChip`, `Countdown`, `TxLink` (Sepolia Etherscan), `OddsBar`, `Banner`.
- `lib/api.ts`: typed fetch client for every route in `INTERFACES.md` §4, using the TS types there.
- `lib/commitment.ts`: commitment hashing, salt generation, storage, backup download.
- `lib/format.ts`: 6-decimal formatting.

## 5. Demo polish (matters for judging)

- One clean path: Reports → Report → Approve (deny first, then approve) → Claim (excluded wallet rejected, honest wallet commits) → Market (swap) → trigger → Market shows halted + reverted swap → Claim redeem.
- Large readable fonts for the reviewer screen; it will be on the projector.
- Every onchain action shows a tx link.
- Load the `frontend-design` guidance if available; avoid default-template look.

## 6. `.env.example`

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_DEMO_MODE=true
CONTRACTS_REPO_PATH=../ScoobyDAO-contracts   # used only by scripts/sync-contracts.sh
```

## 7. Build order (frontend owner)

| When          | Do                                                                             |
| ------------- | ------------------------------------------------------------------------------ |
| Fri evening   | Next.js scaffold, wallet connect, Tailwind, typed API client against mock JSON |
| Fri night     | Reports list + report detail + approve page against backend fixtures           |
| Sat morning   | Claim page: commit/reveal/redeem against local anvil deploy                    |
| Sat afternoon | Sync Sepolia artifacts; market page swaps; frozen states                       |
| Sat evening   | Polish, error states, tx links, record backup video                            |

## 8. Notes for Claude Code

- Until the backend is live, build against fixtures in `src/fixtures/` that match `INTERFACES.md` types exactly.
- If the API or ABIs differ from `INTERFACES.md`, don't patch around it silently; write it in `NOTES.md` and tell the owning repo.
