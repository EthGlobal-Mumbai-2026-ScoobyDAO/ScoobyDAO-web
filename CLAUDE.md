# Unmasked web app (repo `ScoobyDAO-web`) — Claude Code spec

> Frontend for ETHGlobal Mumbai 2026. Read this file, `INTERFACES.md` (v2, Nov 2026) and `NOTES.md` ("Revamp (Nov 2026)") before writing code. The web consumes the backend `/web/v1` API and the contracts in `../SmartContracts`. It owns no secrets.

**Sibling repos:** `../SmartContracts` (ABIs via Foundry `out/`, `deployments/testnets.json`) · `../ScoobyDAO-backend` (reports, World approval gate, `/web/v1`).

## 0. Hard rules

1. **Git is read-only for agents.** Never run `git add`, `commit`, `push`, `branch`, `checkout`, `switch`, `stash`, `reset`, `rebase`, `merge`, `tag`, `filter-repo` or any `gh` write command. Leave changes in the working tree; the human commits. No co-author or "generated with" lines anywhere. `git status`, `git diff`, `git log` are fine.
2. **No secrets.** Only `NEXT_PUBLIC_*` values. Never call World's token endpoint, hold private keys or sign approvals.
3. **No client state is authorization.** The UI shows what the backend and the chain say; it never decides a report is approved.
4. **No transactions to real networks from scripts or tests.** Tests use fixtures or mocked transports. The UI sends transactions only when a human clicks.
5. **Brand:** "Unmasked" and the original mascot "Sniff". No studio cartoon characters, names, catchphrases or likenesses anywhere user-facing or in assets. `ScoobyDAO` stays internal.
6. **Don't guess interfaces.** Contract calls come from `../SmartContracts/src/**` / generated ABIs; backend shapes from `../ScoobyDAO-backend`. Record every gap in `NOTES.md`.
7. **Honesty labels** (components in `src/components/HonestyLabels.tsx`): "dUSD — test token, not USDC", "Simulated yield", "Demo clock", "Stakes are public onchain", "The YT price is not a prediction of the verdict", "A CCIP transfer is not a vote until it is credited", "Demo identity: World Agent Pass".
8. Pages and components import contracts only through `src/protocol`, never raw ABIs.
9. Keep `npm run typecheck && npm run lint && npm test && npm run build` green.

## 1. Stack

Next.js 16 (App Router) + TypeScript, wagmi 2 + viem, RainbowKit, TanStack Query, Tailwind 4, React Three Fiber (landing hero and mask-pop only). Chains: Ethereum Sepolia (11155111) and Arbitrum Sepolia (421614).

## 2. Layout

```
scripts/  gen-abis.mjs · gen-report-types.mjs · gen-fixtures.mjs · sync-contracts.sh · contrast.mjs
src/contracts/  generated.ts (ABIs) · testnets.json · addresses.ts
src/protocol/   types · phase · market · ccip · v1 · v2 · fixture · effects · hooks · index
src/lib/        api · guards · hash · payout · runPlan · tx · types · report.generated · env · explorer · format
src/fixtures/   historicalReport.ts (exact bundle bytes) · index.ts (claim manifest port, demo cases)
src/app/
  /                         landing
  /cases, /cases/[id]       case board, case file (report v0.2 + hashes + approval request)
  /approve/[id]             reviewer screen (World Agent Pass)
  /case/[id]/stake          Yes/No stake, direct or via CCIP
  /case/[id]/market         YT market (Uniswap v4 hook)
  /case/[id]/result         settlement timeline, challenge, finalize, claims
  /me                       positions across reports
  /tx/ccip/[messageId]      CCIP tracker
  /styleguide               chips, labels, surfaces
```

Old routes `/reports/*`, `/claim/*`, `/market/*`, `/case/[id]` redirect to the new ones.

## 3. Terms

Use: Yes / No positions, dUSD (test), yield token (YT), lock, maturity, challenge, Void, REP badge, share of stakes.
Don't use: For/Against shares, trap sprung, frozen, sealed stake, commit/reveal, excluded wallet, probability (for stake splits).

## 4. Modes

- **Fixture mode** (`NEXT_PUBLIC_USE_FIXTURES=true`, backend `/health` down, or contract addresses missing): fixture backend (real v0.2 bundle bytes) + in-memory fixture chain with a demo clock. State resets on full page reload.
- **Live mode:** backend at `NEXT_PUBLIC_API_URL`, V1 contracts from `testnets.json` (`NEXT_PUBLIC_PROTOCOL=v1`, default) or V2 (`v2`, not deployed yet).

## 5. Build order (revamp)

1. Protocol adapter, generated ABIs, addresses, chains, fixture chain.
2. Report v0.2 types, `/web/v1` client + guards, SHA-256 hash checks, case file, approve screen, cases board.
3. Local staking + payout preview + test-funds panel.
4. Result page, claims, `/me`.
5. YT market.
6. CCIP stake + tracker.
7. REP (flagged; needs backend endpoint).
8. Landing copy, chips, a11y, docs.

## 6. Environment

See `.env.example`. `CONTRACTS_REPO_PATH` and `BACKEND_REPO_PATH` are used only by the generation scripts.
