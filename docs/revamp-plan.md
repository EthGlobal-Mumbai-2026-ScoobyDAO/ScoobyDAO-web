# Revamp plan (Nov 2026)

Rebuild the data layer and product flows around the real contracts (`../SmartContracts`, V1 deployed, V2 local only) and the real backend (`../ScoobyDAO-backend`, `/web/v1`). Keep the visual identity (Unmasked, Sniff, tokens, 3D landing). Nothing is committed; see the suggested commit list in the final summary.

## Phases and file-level changes

| # | Phase | Files |
|---|---|---|
| 1 | ABIs, addresses, chains, protocol adapter, fixture protocol | `scripts/gen-abis.mjs`, `scripts/sync-contracts.sh`, `src/contracts/{generated.ts,testnets.json,addresses.ts,index.ts}`, `src/lib/wagmi.ts`, `src/lib/useEnsureChain.ts`, `src/protocol/{types,phase,v1,v2,fixture,ccip,market,index}.ts` + tests. Delete `src/contracts/{abis.ts,abi/*,sepolia.json,v4.ts}`, `scripts/gen-placeholder-abis.mjs`, `src/lib/{fixtureChain,chain,account}.ts*` |
| 2 | Report v0.2, hashes, case file, approve screen, cases board | `scripts/gen-report-types.mjs` → `src/lib/report.generated.ts`, `src/lib/{types,api,guards,hash}.ts`, `src/fixtures/*`, `src/components/report/*`, `src/components/cases/*`, `src/app/approve/[id]/ApproveScreen.tsx`. Delete `lib/canonical.ts`, `lib/claimText.ts`, `ManifestViewer` |
| 3 | Local stake + payout preview + test funds | `src/lib/payout.ts`, `src/components/stake/*`, `src/components/TxPlanStepper.tsx`, `src/lib/tx.tsx`. Delete `CommitForm`, `SealedPanel`, `BackupControls`, `lib/commitment.ts` |
| 4 | Result, claims, positions | `src/app/case/[id]/result`, `src/components/result/*`, `src/app/me` |
| 5 | YT market (v4 hook) | `src/app/case/[id]/market`, `src/components/market/*` (FreezeHook code removed) |
| 6 | CCIP stake + tracker | `src/protocol/ccip.ts`, `src/components/ccip/*`, `src/app/tx/ccip/[messageId]` |
| 7 | REP (flagged, fixture + proposed endpoint) | `src/components/result/RepCard.tsx`, `src/lib/api.ts` (`authorizeRep`) |
| 8 | Landing copy, chips, docs, a11y | `src/components/landing/*`, `StatusChip`, `/styleguide`, `THEME.md`, `INTERFACES.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `NOTES.md` |

## Key design choices

- **ABIs are compiler output.** `../SmartContracts/out` doesn't exist and forge isn't installed, so this run compiled the real sources with solc-js 0.8.26 using foundry.toml's remappings (deps from npm) into a scratch `out/`. `gen-abis.mjs` reads any Foundry `out/` dir (`CONTRACTS_OUT`). Re-run `npm run sync:contracts` after `forge build`.
- **Phase comes from chain time** (`getBlock('latest').timestamp`), never `Date.now()`. One pure `derivePhase()` is shared by V1, V2 and fixtures.
- **TxPlan**: ordered steps `{label, chainId, request}`; one runner handles wrong-chain switch, simulate, send, receipt, revert replay and toasts.
- **Fixture protocol** implements the same interface with its own clock ("Demo clock"), used when `NEXT_PUBLIC_USE_FIXTURES=true` or addresses are missing.

## Risks

- Backend `/web/v1` still returns the old `Report` shape (`manifest`, `manifestHash`, `token`). The client normalises it into `WebReport` and fetches the v0.2 report from `/raw`; recorded in NOTES.md.
- Claim manifest has no measurement method / Void rule fields; shown as "not stated".
- No YT/hook/router deployed for V1 and nothing deployed for V2 → market and V2 flows show "Not deployed yet" live; fixtures cover them.
- CCIP npm library (`@chainlink/contracts-ccip@2.0.0`) may differ from the contracts' pinned lib; only the inherited receiver ABI and ExtraArgsV3 encoding depend on it.
- REP needs a backend-signed IDKit `rp_context` and a REP authorization endpoint that don't exist; behind `NEXT_PUBLIC_REP_ENABLED`.
