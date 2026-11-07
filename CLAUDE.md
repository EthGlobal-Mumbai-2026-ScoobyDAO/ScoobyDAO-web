# ScoobyDAO web app (repo `ScoobyDAO-web`) — Claude Code spec

> Frontend for ETHGlobal Mumbai 2026. Read this file, `INTERFACES.md` (v3, Nov 2026) and `NOTES.md` ("V2 live integration (Nov 2026)", then "Revamp (Nov 2026)") before writing code. The web consumes the backend `/web/v1` API and the deployed **RiskFi V2** contracts. It owns no secrets.

**Source of truth for contracts:** the V2 handoff bundle (`../v2`: `addresses.json`, `abis/*.json`, `abi-manifest.json`, `FRONTEND_INTEGRATION_PLAN.md`), copied into `src/contracts/v2/` by `npm run sync:v2`. If the bundle and `../SmartContracts/src/v2/*.sol` disagree, the bundle wins; record the difference in NOTES.md. Never guess a function, event, argument order or address.

**Sibling repos:** `../v2` (V2 handoff bundle) · `../SmartContracts` (sources; V1 ABIs via Foundry `out/` and `deployments/testnets.json`) · `../ScoobyDAO-backend` (reports, World approval gate, `/web/v1`).

## 0. Hard rules

1. **Git is read-only for agents.** Never run `git add`, `commit`, `push`, `branch`, `checkout`, `switch`, `stash`, `reset`, `rebase`, `merge`, `tag`, `filter-repo` or any `gh` write command. Leave changes in the working tree; the human commits. No co-author or "generated with" lines anywhere. `git status`, `git diff`, `git log` are fine.
2. **No secrets.** Only `NEXT_PUBLIC_*` values. Never call World's token endpoint, hold private keys or sign approvals.
3. **No client state is authorization.** The UI shows what the backend and the chain say; it never decides a report is approved.
4. **No transactions to real networks from scripts or tests.** Tests use fixtures or mocked transports. The UI sends transactions only when a human clicks.
5. **Brand:** "ScoobyDAO" and the original mascot "Sniff", a basset-hound detective. No studio cartoon characters, Great Danes, mystery vans, catchphrases or likenesses anywhere user-facing or in assets, and never "Scooby" inside an illustration; "ScoobyDAO" appears only as text. "Unmasked!" is only the Final · Yes verdict moment. Pages use the `src/components/ui/` kit and the layout rules in THEME.md §8.
6. **Don't guess interfaces.** V2 calls come from the bundle ABIs (`src/contracts/v2`, declared in `src/protocol/v2contracts.ts` `V2_USAGE`); V1 from generated ABIs; backend shapes from `../ScoobyDAO-backend`. Key addresses by (chainId, name), never by address alone. Record every gap in `NOTES.md`.
7. **Honesty labels** (components in `src/components/HonestyLabels.tsx`): "dUSD — test token, not USDC", "Simulated yield", "Demo clock", "Stakes are public onchain", "The YT price is not a prediction of the verdict", "A CCIP transfer is not a vote until it is credited", "Demo identity: World Agent Pass"; V2 adds "Curve output — not a Yes/No probability or verdict oracle", "Demo report #N (onchain) — not linked to a backend research report", "Estimate — final amount comes from the claim receipt" and "Simulated yield — demo only".
8. Pages and components import contracts only through `src/protocol`, never raw ABIs.
9. Keep `npm run typecheck && npm run lint && npm test && npm run build` green.
10. **Never fake chain activity in live mode.** Fixtures are opt-in only (`NEXT_PUBLIC_CHAIN_MODE=fixture`, `NEXT_PUBLIC_USE_FIXTURES=true`) and show a banner; a failing backend never switches the chain protocol. Writes simulate, estimate gas + 20%, require `receipt.status === 'success'`, approve exact amounts by default, and wait for the deployment check. Use `bigint` and `parseUnits/formatUnits(…, 6)` for amounts and selectors.
11. Report #1 is "Demo report #1 (onchain) — not linked to a backend research report". Never map a backend report to it; link a backend report onchain only after its claim hash matches the registry.

## 1. Stack

Next.js 16 (App Router) + TypeScript, wagmi 2 + viem, RainbowKit, TanStack Query, Tailwind 4, React Three Fiber (landing hero and mask-pop only). Chains: Ethereum Sepolia (11155111, CCIP selector 16015286601757825753) and Arbitrum Sepolia (421614, selector 3478487238524512106).

## 2. Layout

```
scripts/  sync-v2.sh · gen-v2-abis.mjs · gen-abis.mjs (V1) · gen-report-types.mjs · gen-fixtures.mjs · sync-contracts.sh (V1) · contrast.mjs
src/contracts/v2/  addresses.json · abi-manifest.json · abis/*.json (bundle copies) · abis.ts (generated) · index.ts (typed, by chainId + name)
src/contracts/  generated.ts · testnets.json · addresses.ts (V1 only, kept, not selected)
src/protocol/   types · phase (gates) · market · ccip · ccipApi · approvals · deployment · v2contracts · v2 · v1 · fixture · effects · hooks · index
src/test/       mockRpc.ts (mocked viem transport) · v2world.ts · recorded/ (CCIP example API + receipts, live wiring, hash vector)
src/lib/        api · guards · hash · payout · runPlan · tx · types · report.generated · env · explorer · format
src/fixtures/   historicalReport.ts (exact bundle bytes) · index.ts (claim manifest port, demo cases)
src/app/
  /                         landing
  /cases, /cases/[id]       case board (+ "Live onchain market"), case file (report v0.2 + hashes + verified onchain link)
  /approve/[id]             reviewer screen (World Agent Pass)
  /onchain/[reportId]       V2 report dashboard (+ /stake, /market, /result); /case/[id]/* redirects here in live V2
  /case/[id]/stake|market|result   V1 and fixture-chain screens (same components)
  /operator                 role-gated demo actions (NEXT_PUBLIC_OPERATOR_VIEW=true only)
  /me                       positions across reports
  /tx/ccip/[messageId]      CCIP tracker
  /styleguide               chips, labels, surfaces
```

Old routes `/reports/*`, `/claim/*`, `/market/*`, `/case/[id]` redirect to the new ones.

## 3. Terms

Use: Yes / No positions, dUSD (test), yield token (YT), REP receipt (V2: 1:1 receipt for deposited, unstaked dUSD), reputation badge (V1 World ID only), lock, maturity, challenge, Void, share of stakes.
Don't use: For/Against shares, trap sprung, frozen, sealed stake, commit/reveal, excluded wallet, probability (for stake splits).

## 4. Modes

- **Live mode (default):** `NEXT_PUBLIC_CHAIN_MODE=live` + `NEXT_PUBLIC_PROTOCOL=v2` → the deployed V2 contracts from the bundle. `v1` selects the kept V1 adapter. Backend at `NEXT_PUBLIC_API_URL` for case files and approvals only.
- **Fixture mode (opt-in only):** `NEXT_PUBLIC_CHAIN_MODE=fixture` (in-memory chain, demo clock, V1 lifecycle) and/or `NEXT_PUBLIC_USE_FIXTURES=true` (demo backend data). A banner shows; state resets on full page reload. A down backend never enables fixtures.

## 5. Build order (revamp; V2 live integration in docs/v2-integration-plan.md)

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
