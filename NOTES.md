# NOTES — conflicts, gaps and decisions

Running log for `scoobydao-web`. Precedence when docs disagree: INTERFACES.md (data shapes) > CLAUDE.md (rules, scope) > THEME.md (look, copy, page features).

## Conflicts between docs

1. **Studio characters.** THEME.md §0.1 and the build prompt say "You _can_ use Scooby-Doo or any other studio character…", but THEME.md §1.3 (mascot must be original), §1.4 ("No catchphrases borrowed from existing cartoons"), §7 prompts ("ORIGINAL — no existing cartoon characters") and the §9 checklist ("No studio character, name or catchphrase anywhere") all say the opposite. Treated as a typo for "can't". The app uses only the original brand **Unmasked** and mascot **Sniff**; no studio characters, names, catchphrases or likenesses anywhere user-facing. The repo/package name `scoobydao-web` is internal only.
2. **Routes.** CLAUDE.md §2–3 uses `/`, `/reports/[id]`, `/claim/[claimId]`, `/market/[claimId]`; THEME.md §5 and the build prompt use `/` (landing), `/cases`, `/cases/[id]`, `/case/[claimId]/stake`, `/case/[claimId]/market`. These are page routes (not API routes), so THEME.md wins on page features. The THEME.md routes are the canonical ones; the CLAUDE.md paths redirect to them.
3. **Banner copy.** CLAUDE.md §3.3 says "Denied — draft only, no market opened"; THEME.md §5.4 says "Denied — no case opened". THEME.md wins on copy, but the build prompt asks for "the exact banner copy" from CLAUDE.md. Resolution: THEME.md wording as the headline, CLAUDE.md wording as the detail line under it, so both exact strings are on screen. Same for expired / not-a-reviewer / approved.
4. **Frozen copy.** CLAUDE.md §3.4 says "Claim triggered — staking and trading halted at block N."; THEME.md §5.6 says "🪤 Trap sprung — trading halted at block N". Same approach: THEME.md wording as the headline, CLAUDE.md wording as the detail line.

## Renames (riskfi → scoobydao)

Per the team: frontend-owned names use `scoobydao`.

- Package name `scoobydao-web`; CLAUDE.md and `scripts/sync-contracts.sh` now point at `ScoobyDAO-contracts` / `ScoobyDAO-backend`.
- `.env.example`: `CONTRACTS_REPO_PATH=../ScoobyDAO-contracts` (CLAUDE.md §6 updated to match).
- localStorage key for sealed stakes: **`scoobydao:<chainId>:<claimId>:<account>`** (was `riskfi:` in CLAUDE.md §3.4).
- **Not renamed** (owned by the contracts repo; the UI must match the chain): revert string `RiskFi: claim frozen`, share token symbols `RF-<id>-FOR` / `RF-<id>-AGAINST`. INTERFACES.md is unchanged, since it is shared across all three repos and changes go through its change protocol.

## Missing pieces / placeholders

- No `riskfi-ui` project skill exists on this machine; only `frontend-design` was loaded.
- **Contract artifacts not published yet.** `ScoobyDAO-contracts` has no `abi/` or `deployments/sepolia.json`. Placeholders: `src/contracts/abi/*.json` generated from the typed ABIs (`scripts/gen-placeholder-abis.mjs`), and `src/contracts/sepolia.json` with zero addresses (`contractsDeployed === false` → UI shows "contracts not deployed" instead of sending txs). `npm run sync:contracts` overwrites both; `src/contracts/contracts.test.ts` then fails if a synced ABI is missing a signature the UI calls.
- **Typed ABIs live in `src/contracts/abis.ts`** (human-readable `parseAbi`, from INTERFACES.md §2 + contracts CLAUDE.md §3), because ABI JSON imports lose the literal types wagmi needs.
- **Backend not running.** `src/lib/api.ts` uses fixtures when `NEXT_PUBLIC_USE_FIXTURES=true` or `GET /health` fails. Fixture approvals `apr-live` / `apr-req-*` flip pending → approved after ~12s of polling; `apr-live-deny` flips to denied. Fixture `/demo/scan` adds a draft report.

## Gaps in INTERFACES.md (not patched, flagged for the owning repo)

- `POST /demo/scan` has no documented response type; typed as `unknown`.
- `Approval` has no `claimId`. After approval, the approve page links to the claim via `GET /reports/:reportId` → `claimId` (shows "publishing…" until it's set). Backend: consider adding `claimId` to `Approval`.
- `ClaimView` has `frozenAt` (timestamp) but no block number. "Halted at block N" is read from the `triggerTxHash` receipt's `blockNumber` via viem; fixtures use `frozenBlocks`. Backend: consider adding `frozenBlock`.
- No view for a staker's own commit/reveal state in `VerdictMarket` (INTERFACES.md §2). The stake page infers it from the locally saved stake + share token balances + `Committed`/`Revealed` events. Contracts: consider `commitments(claimId, staker) view returns (bytes32, uint256, bool revealed)`.
- `ClaimRegistry.commitsOpen` and `revealPeriod` are in contracts CLAUDE.md §3.1 but not INTERFACES.md §2; used read-only by the stake page.
- Manifest field types aren't specified (INTERFACES.md §3 is an example). `params` is typed `Record<string, number | string | boolean>`.
- **Canonical JSON must match byte-for-byte across backend and web.** Web uses JS `JSON.stringify` escaping with keys sorted by UTF-16 code unit. If the backend is Python, `json.dumps(..., sort_keys=True, separators=(',',':'), ensure_ascii=False)` matches for ASCII keys and integer numbers; floats and non-ASCII may differ. Recommend RFC 8785 (JCS) on both sides, or integers only.

## Dependency decisions

- **wagmi pinned to 2.x** (2.19.x): RainbowKit 2.2.11 peer-depends on `wagmi ^2.9.0`; wagmi 3.x is not supported yet.
- **`@coinbase/cdp-sdk` aliased to a stub** (`src/stubs/cdp-sdk.ts`, via `turbopack.resolveAlias` in `next.config.ts`). The RainbowKit barrel imports wagmi's `baseAccount` connector → `@base-org/account` → `@coinbase/cdp-sdk`, which imports optional `@x402/*` packages that aren't installed, so `next build` failed. `@base-org/account` only uses `CdpClient` for Base subscription payments, which we never use. Remove the alias if a future RainbowKit/wagmi release fixes this.
- Wallet list is explicit (MetaMask, Rabby, WalletConnect, injected) via `connectorsForWallets`.
- Next 16 removed `next lint`; `npm run lint` runs the ESLint CLI with `eslint-config-next` flat config.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is empty in dev, so `src/lib/env.ts` falls back to a dummy id; WalletConnect's config/pulse endpoints then 403/400 in the console. Injected wallets (MetaMask, Rabby) still work. Set a real project id before the demo.

## Design decisions

- Text-safe "ink" variants of each accent (`--beam-ink`, `--clue-ink`, `--mask-ink`, `--ghost-ink`) so status text passes 4.5:1 on every surface; the THEME.md accent hexes are kept for fills, bars and borders. `node scripts/contrast.mjs` checks every pair.
- Light theme: `[data-theme="light"]` on `<html>`, toggled from the navbar, saved under `scoobydao:theme`. Paper "case file" surfaces stay paper in both themes.
- `/styleguide` (noindex) renders every status chip and surface for visual checks.

## Phase 3 decisions

- **Fixture chain + demo wallets.** With no deployed contracts (or in fixtures mode) all reads/writes go to an in-memory chain (`src/lib/fixtureChain.ts`) that enforces the same rules the UI depends on (exclusion, commits only while Open, one commit, reveal must match). A "Fixture mode" bar lets you act as an honest or a deployer-linked wallet. It never appears once the API is live and contracts are synced, and a real connected wallet is used whenever no demo wallet is picked.
- **Salt saved before the first tx**, cleared again if the approve/commit tx fails or is rejected. If localStorage is unavailable the backup file downloads automatically before the commit.
- Approve page shows THEME.md headline + CLAUDE.md exact line for every final state; approval polling stops on a final status; after approval it polls the report every 3s until `claimId` appears.
- Reverted (mined) txs: the runner replays the call at the receipt's block to recover the revert string for the toast.

## Phase 5: market (Uniswap v4)

Checked against current Uniswap docs (developers.uniswap.org, v4-periphery) on 2026-11-06:
- Swaps go through the **Universal Router**: command `V4_SWAP` (0x10) with actions `SWAP_EXACT_IN_SINGLE` (0x06) → `SETTLE_ALL` (0x0c) → `TAKE_ALL` (0x0f), `execute(commands, inputs, deadline)`. Encoded with viem in `src/contracts/v4.ts` (unit-tested), no ethers SDK.
- ERC20 → Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) → router allowances are checked and requested before each swap.
- Quotes: `V4Quoter.quoteExactInputSingle` via `eth_call` simulation.

Gaps / assumptions (contracts repo please confirm):
- **`SwapRouter` in sepolia.json must be a Universal Router** (or anything exposing `execute(bytes,bytes[],uint256)` with v4 actions). If it's a custom/test router, `swapCall()` in `src/components/market/useSwap.ts` needs to change.
- **`ExactInputSingleParams` layout.** Current v4-periphery `main` adds `uint256 minHopPriceX36`; Uniswap's swap guides (released routers) use the 5-field struct. `ROUTER_HAS_MIN_HOP_PRICE = false` in `src/contracts/v4.ts`; flip it if the deployed router is newer. A wrong layout reverts.
- **V4Quoter address is not in sepolia.json.** Using `0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244` from Uniswap's Sepolia table. Suggest adding `"V4Quoter"` to `deployments/sepolia.json` (INTERFACES.md change).
- **Pool fee / tick spacing are not published** (needed to build the PoolKey). Using fee 3000, tickSpacing 60, hooks = FreezeHook. The UI recomputes the pool id and compares with `ClaimView.pools`; on mismatch live swaps are disabled with a visible message. Suggest publishing the full PoolKey per claim.
- Frozen state: inputs disabled; "Send it anyway" forces a 1 USDC swap without simulation (gas 500k) so the hook's `RiskFi: claim frozen` revert shows inline and in the toast.

## Phase 6: landing

- **No stats route.** The landing "Cases open / USDC staked / Unmasked / Cleared" strip is computed client-side from `GET /reports` + `GET /claims/:id` (`src/lib/useCaseRows.ts`). Fine for a demo; a `GET /stats` would save N requests.
- **Repo URLs unknown** (no git remotes yet). `src/lib/site.ts` lists the three repos without links; add URLs there.
- Hero art is five original placeholder SVG layers (`HeroParallaxFallback`) until generated art exists. Flashlight = CSS mask driven by `--fx/--fy` on pointermove (rAF-throttled, no React state); reduced motion keeps the beam fixed and parallax off.

## Phase 7: 3D

- `HeroSceneGate` always paints the 2D parallax scene first, then (after first paint + idle) dynamically imports `HeroScene3D` (`ssr: false`) only when WebGL is available, `hardwareConcurrency >= 4` and reduced motion is off.
- `frameloop="demand"`; a driver calls `invalidate()` at ~30fps only while the hero intersects the viewport and the tab is visible (verified: 0 draw calls while scrolled away).
- **No mascot model yet.** `public/models/manifest.json` (`"sniff": false`) tells the gate whether `/models/sniff.glb` exists, which avoids a 404 probe. Until then a stylised low-poly placeholder hound renders. With a model it plays the `idle` clip via `useGLTF` + `useAnimations`.
- `MaskPop` on Resolved Pass: 3D coin mask + confetti (renders ~2s then `frameloop="never"`), CSS pop fallback, static mask with reduced motion; plays once per case per session. Cleared shows a 2D Sniff shrug.
- No canvas is ever mounted on `/approve` (verified).
