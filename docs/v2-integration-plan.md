# V2 live integration plan (Nov 2026)

Make the deployed RiskFi V2 contracts (Ethereum Sepolia + Arbitrum Sepolia) the live default, driven only by the handoff bundle (`../v2`: `addresses.json`, `abis/*.json`, `abi-manifest.json`, `FRONTEND_INTEGRATION_PLAN.md`). V1 code stays in place but is not selected. Nothing is committed.

## Phases and files

| # | Phase | Main files |
|---|---|---|
| 1 | Contracts module, mode switch, deployment check | `src/contracts/v2/{addresses.json,abi-manifest.json,abis/*.json,abis.ts,index.ts}`, `scripts/{gen-v2-abis.mjs,sync-v2.sh}`, `package.json` (`sync:v2`), `src/contracts/{addresses.ts,generated.ts}` (V2 entries and stale V2 ABIs removed), `scripts/gen-abis.mjs`, `src/protocol/{index,hooks,deployment,effects,v2}.ts`, `src/lib/{env,api}.ts`, `src/components/{FixtureModeBanner,DeploymentCheck,NetworkBadge}.tsx`, `.env.example` |
| 2 | Onchain report + dashboard (§A) | `src/app/onchain/[reportId]/**`, `src/components/onchain/*`, `src/components/cases/{CasesBoard,useCaseRows}.ts*`, `src/app/case/[id]/*/page.tsx` (redirect in V2), `HonestyLabels.tsx` |
| 3 | Stake, REP receipts, stake-and-sell (§B, §C) | `src/protocol/{v2,approvals,phase}.ts`, `src/lib/{runPlan,tx,errors,payout}.ts*`, `src/components/stake/*` |
| 4 | YT market and LP (§D) | `src/protocol/market.ts`, `src/components/market/*` |
| 5 | Cross-chain stake (§E) | `src/protocol/{ccip,ccipApi}.ts`, `src/components/ccip/*`, `src/app/tx/ccip/[messageId]` |
| 6 | Settlement, claims, operator view (§F) | `src/components/result/*` (RepCard → ReputationBadgeCard, V1 only), `src/components/me/*`, `src/app/operator/*`, `src/components/operator/*` |
| 7 | Backend-linked reports | `src/lib/{hash,guards,types}.ts`, `src/components/cases/{CaseFile,HashCheck}.tsx` |
| — | Docs | `NOTES.md` (new top section), `INTERFACES.md`, `README.md`, `LIVE-STATE.md`, `CLAUDE.md`, `AGENTS.md` |

Each phase ends with `npm run typecheck && npm run lint && npm test && npm run build` green. Tests use mocked viem transports and recorded fixtures (the bundle's `exampleCCIP` API response and receipts); no test or script sends a transaction.

## Key decisions

- Chain mode comes only from `NEXT_PUBLIC_CHAIN_MODE` (default `live`) and `NEXT_PUBLIC_PROTOCOL` (default `v2`). The backend fixture API is opt-in (`NEXT_PUBLIC_USE_FIXTURES=true`); a failing `/health` never selects fixtures.
- Addresses are keyed by `(chainId, contract name)`: `0xfb2c…88e5` is the V1 registry on Sepolia and the V2 CCIP sender on Arbitrum Sepolia.
- Every V2 write: simulate with the account, estimate gas + 20%, require `receipt.status === 'success'`, decode custom errors and revert strings, chain-aware explorer links. Exact-amount approvals by default, unlimited only by toggle. Quotes and CCIP fees are re-read right before sending.
- Writes stay disabled until a once-per-session deployment check (code + wiring multicall on both chains) passes.
- Separate phase gates: remote send < `reportCutoff`/`crossChainCutoff`; local stake < `lockTime`; swaps and add-liquidity < `maturity`; LP removal and yield claims always; `claimPrincipal` from finalization until `finalizedAt + 90 days`.

## Risks

- **Public RPC limits:** viem's default Sepolia RPC caps `eth_getLogs` at 1,000 blocks and publicnode prunes older logs. Log reads are chunked (≤1,000 blocks) and bounded; the CCIP tracker prefers the CCIP API's destination tx hash and contract views over log scans. Dedicated RPC URLs are recommended.
- **Thin YT inventory:** the hook holds ~110 YT at ~0.009 dUSD/YT, so `quoteBuy(1 dUSD)` currently reverts `YT_RESERVE` (0.9 dUSD works). The UI shows the inventory and a friendly error; the operator should add liquidity before the judge demo.
- **Time:** CCIP sends close Nov 8 07:44 UTC and local stakes Nov 9 07:44 UTC; settlement opens only after Dec 9. Nothing in the UI bypasses those gates.
- **Report #1 uses demo hashes** and no backend report links to it; new backend publications on the V2 registry have no vault or market until a per-report deployment exists.
- Browser wallet flows can't be exercised here (no wallet); they are verified in tests and by live read-only RPC calls only.
