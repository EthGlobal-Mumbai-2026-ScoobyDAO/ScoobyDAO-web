# Unmasked (web)

**Live V2 app:** [scoobydao-web.vercel.app](https://scoobydao-web.vercel.app) · [Vercel project](https://vercel.com/dwaipayan25s-projects/scoobydao-web)

Pushes to `main` deploy to Vercel production; pull requests receive preview deployments and GitHub commit status checks.

Frontend for **Unmasked** (ETHGlobal Mumbai 2026). AI agents and an original detective-hound mascot, Sniff, research suspicious tokens and write a five-pillar report. A reviewed report is published to a `ReportRegistry`, and anyone stakes **dUSD** on **Yes** or **No**, directly on Ethereum Sepolia or from Arbitrum Sepolia over Chainlink CCIP. Each stake records a non-transferable Yes/No position and mints the same amount of a transferable **yield token (YT)**, which trades on a Uniswap v4 hook market until maturity. After maturity a proposed result can be challenged before anyone finalizes it.

The live default is **RiskFi V2**. `/markets` discovers both registries and offers the same Overview, Stake, Trade YT, Result, and Chains views for each report. `/reports` reads the separate research API through a same-origin proxy when `NEXT_PUBLIC_REPORT_API_URL` is configured (see [LIVE-STATE.md](LIVE-STATE.md) and [HANDOFF-REPORTS.md](HANDOFF-REPORTS.md)).

Interfaces: [`INTERFACES.md`](INTERFACES.md) (v3). Decisions, gaps and requests to the other repos: [`NOTES.md`](NOTES.md) → "V2 live integration (Nov 2026)". Plan: [`docs/v2-integration-plan.md`](docs/v2-integration-plan.md).

The scouting and historical diagnostic queue is documented in [HANDOFF-SCOUTING.md](HANDOFF-SCOUTING.md). Configure `NEXT_PUBLIC_SCOUTING_API_URL` and `NEXT_PUBLIC_REPORT_API_URL` at build time to trusted HTTPS backend root origins for production, with matching backend CORS and release/access policy. Blank values leave scouting unavailable and the report library empty. Use loopback HTTP only for local testing; never deploy a localhost origin to remote users. Administrator checkpoint controls default off: set `NEXT_PUBLIC_ADMIN_CHECKPOINTS_ENABLED=true` only after verifying that the deployed backend enforces private draft access, the public gate, exact-origin CORS, scoped sessions and same-session World confirmation. This browser setting is not an authorization boundary; the backend must enforce these protections independently. Report review and publication remain separate actions.

For a local pitch rehearsal, `NEXT_PUBLIC_LOCAL_PITCH_EXAMPLES=true` enables historical diagnostic cards only on localhost or 127.0.0.1, using reports the configured service already permits. The flag does not grant access to drafts; use an appropriately isolated local service and configure its CORS for the preview origin. The cards do not evaluate the proposed trailing-30-day activity threshold.

## Run it

```bash
npm install
cp .env.example .env.local      # defaults: NEXT_PUBLIC_CHAIN_MODE=live, NEXT_PUBLIC_PROTOCOL=v2
npm run dev                     # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js 16 (Turbopack) |
| `npm run typecheck` · `lint` · `test` | tsc, ESLint, vitest (bundle hashes, ABI coverage, deployment check, phase gates, payout math, CCIP encoding and tracker, market and LP math, plans, hashes, guards, fixture chain) |
| `npm run sync:v2` | copies the V2 handoff bundle (`${CONTRACTS_V2_HANDOFF:-../v2}`) into `src/contracts/v2/`, checks every ABI against `abi-manifest.json` (SHA-256 + entries) and regenerates `src/contracts/v2/abis.ts` |
| `npm run sync:contracts` | V1 only: regenerates `src/contracts/generated.ts` from `../SmartContracts/out` and copies `deployments/testnets.json` |
| `node scripts/gen-report-types.mjs` · `gen-fixtures.mjs` · `contrast.mjs` | report types, fixture bundle bytes, WCAG contrast |

## Live V2 demo

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CHAIN_MODE` | `live` (default) or `fixture` |
| `NEXT_PUBLIC_PROTOCOL` | `v2` (default, the deployed demo) or `v1` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` · `NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL` | **Use dedicated read-only RPCs.** Public RPCs cap `eth_getLogs` (viem's default Sepolia RPC allows 1,000 blocks per request; some prune old logs). The app keeps every log read in bounded 1,000-block chunks, but rate limits still bite during a demo. These URLs ship to the browser: restrict the keys. |
| `NEXT_PUBLIC_CCIP_API` | Chainlink CCIP message API (default `https://api.ccip.chain.link`) |
| `NEXT_PUBLIC_BACKEND_API_URL` | deployed backend `/web/v1` upstream used by the Next.js proxy |
| `NEXT_PUBLIC_API_URL` | same-origin `/api/backend` path for case files and approvals |
| `NEXT_PUBLIC_REPORT_API_URL` | research API origin; Next.js proxies `/reports`, `/status`, artifacts, and packages at `/api/research` |
| `NEXT_PUBLIC_USE_FIXTURES` | `true` = demo backend data (opt-in; never automatic) |
| `NEXT_PUBLIC_FAUCET_URL` | optional operator-run dUSD faucet |
| `NEXT_PUBLIC_OPERATOR_VIEW` | `true` enables `/operator` (role-gated demo actions) |
| `NEXT_PUBLIC_LP_ENABLED` | LP panel (default on for V2) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | enables WalletConnect |

- **Chains:** Ethereum Sepolia (report, vault, market, CCIP receiver) and Arbitrum Sepolia (CCIP sender). The app asks your wallet to switch before each write.
- **Getting dUSD:** dUSD is a test token (not USDC) and its mint is role-gated, so there is no public mint. Ask the team: an operator funds wallets with dUSD on both chains (plus a little Sepolia and Arbitrum Sepolia ETH for gas and the CCIP fee). The stake page shows the token address and "Add dUSD" buttons for both chains.
- **Before any write**, the app checks once per session that the code and wiring onchain match the bundle (45 checks). A mismatch shows a red "Deployment mismatch" banner and disables writes. The check is listed on the report dashboard.
- **Timing (report #1):** cross-chain sends close **Nov 8 2026 07:44 UTC**, local stakes lock **Nov 9 07:44 UTC**, YT trades until maturity **Dec 9 07:44 UTC**, the result deadline is **Dec 13 07:44 UTC**. Settlement and principal claims cannot happen before Dec 9. The app reads all of these from chain.

## Judge demo script

Use a funded wallet that isn't the deployer. Do the CCIP step before Nov 8 07:44 UTC.

1. **Open the live market:** Cases → "Live onchain market" (or "Live market" in the nav) → `/onchain/1`. Countdowns come from the latest block; roles show "Demo roles: all held by the deployer wallet."; the labels say "Demo report #1 (onchain) — not linked to a backend research report"; the deployment check is green.
2. **Stake 5 dUSD Yes** on Ethereum Sepolia: Approve 5 dUSD (exact) → Stake. The position and YT go up ("You got 5 YT … transferable; your Yes position is not"). Send some YT with "Send YT to another wallet" to show YT moves while the position stays.
3. **REP:** REP receipts → Deposit 2 dUSD → REP 2 → Withdraw 1.
4. **Stake and sell 3 dUSD No:** "Sell my YT now" → the position stays, you receive dUSD (`StakedAndSold.usdcReceived`).
5. **Market:** buy YT with dUSD, then sell some back. The banner compares the quote with the amount received. The price and implied APR say "Curve output — not a Yes/No probability or verdict oracle". The pool holds only ~110 YT today, so a 1 dUSD buy needs the extra YT from step 4 (or more liquidity); smaller buys always work.
6. **CCIP:** Stake from "Arbitrum Sepolia (via Chainlink CCIP)" → switch to Arbitrum Sepolia → approve dUSD to the sender → requote → send 2 dUSD Yes → the tracker opens: Sent → in transit → Credited → "Voted" once the position is re-read on Sepolia. "See a delivered example" opens the bundle's message `0xaed8…456d`.
7. **Positions** (`/me`) shows positions, YT and claimable yield, REP, LP shares and the CCIP messages. **Result** shows maturity, the challenge window and claim dates, all disabled until the contracts allow them.
8. *(Optional, `NEXT_PUBLIC_OPERATOR_VIEW=true`)* `/operator` → inject simulated yield → the YT claimable amount rises → claim YT yield.

## Honesty labels

"dUSD — test token, not USDC" · "Simulated yield" · "Demo clock" · "Stakes are public onchain" · "The YT price is not a prediction of the verdict" · "Curve output — not a Yes/No probability or verdict oracle" · "A CCIP transfer is not a vote until it is credited" · "Demo report #1 (onchain) — not linked to a backend research report" · "Estimate — final amount comes from the claim receipt" · "Simulated yield — demo only" · "Demo identity: World Agent Pass". All in `src/components/HonestyLabels.tsx`.

## Fixture mode

Opt-in only: `NEXT_PUBLIC_CHAIN_MODE=fixture` (in-memory chain with a demo clock) and/or `NEXT_PUBLIC_USE_FIXTURES=true` (demo backend data). A banner shows on every page. An unreachable backend never turns fixtures on; it shows "Research API unavailable" on backend pages and leaves staking, trading, CCIP and claims alone. The fixture chain models the V1 lifecycle (five scenarios, late CCIP → Held) and resets on a full page reload; V2-only panels (REP, LP writes, operator) are hidden there.

## Known limits

- **Per-report setup.** Newly published reports appear in the dropdown immediately. The publisher must prepare a fresh vault and YT, deploy the v4 hook, activate the market, then seed dUSD/YT liquidity. CCIP requires a new Arbitrum sender and receiver configuration before the remote cutoff.
- **Settlement after Dec 9.** Maturity is 30 days after the lock; nothing in the app bypasses it.
- **Demo roles.** Reviewer, resolver, adjudicator, publisher and treasury are all the deployer wallet. Yield is simulated (`injectYield`), not lending income.
- **Thin YT inventory** (~110 YT in the hook): buys above ~0.9 dUSD revert `YT_RESERVE` until more YT is sold into the pool or liquidity is added.
- **CCIP history** uses the CCIP API and bounded log windows; on a restrictive RPC without the API, an old message may show "delivered" without its outcome event.
- The V1 World ID reputation badge is V1 only and hidden in V2.

## Accessibility and performance

- Status is always icon + text + colour; every chip ink passes 4.5:1 in both themes.
- `prefers-reduced-motion`: no parallax, fixed flashlight, no 3D, static mask.
- axe and Lighthouse results from the revamp are in NOTES.md; the V2 pages reuse the same components and tokens but have not been re-audited in a browser.

## Asset credits

- **Mascot, hero scene, mask icon, identicons:** original placeholder art drawn in code (SVG + three.js primitives). No third-party characters, models or illustrations.
- **Fonts:** Bungee, Inter, JetBrains Mono via Google Fonts (`next/font`), SIL Open Font License 1.1.
- **Icons:** Lucide (ISC licence).
- **Libraries:** Next.js, React, wagmi, viem, RainbowKit, TanStack Query, React Three Fiber, drei, three.js, qrcode.react, json-schema-to-typescript (dev); see `package.json`.

## Dynamic V2 reports and publication

`/markets` reads `reportCount`, `getReport`, and `maturity` from both the original and flexible Sepolia registries on each request. It joins each report to `V2PoolCatalog.getMarket`, and the client builds a V2 adapter from that market's actual addresses. The selector at the top switches reports without changing the Overview, Stake, Trade YT, Result, or Chains layout. The original and accelerated report #1 deployments remain available.

`/markets/publish` lets the connected registry publisher and reviewer sign and submit report hashes, roles, and clocks. A backend case from `/web/v1/reports` supplies both hashes when available; a research API report supplies its SHA-256 only and still needs a manually verified claim hash. On success the new report appears in the market dropdown. The report page guides the publisher through `V2SeriesFactory.prepare`, `YieldCurveFactoryV2.deployAndInitialize`, `V2PoolCatalog.activate`, `V2CCIPSenderFactory.deploy` on Arbitrum Sepolia, and `CCIPStakeReceiverV2.configureSourceSender` on Ethereum Sepolia. Staking needs the first three steps; trading also needs YT/dUSD liquidity. CCIP needs the last two steps and a future remote cutoff.

Infrastructure addresses and ABIs are in `src/contracts/market-infrastructure/`. The report discovery, bundle creation, publication signature, and setup calls are in `src/protocol/reportDiscovery.ts`, `dynamicMarket.ts`, `publish.ts`, and `marketSetup.ts`. Report publication and per-report setup require the publisher wallet; visitors cannot execute those writes. The research API is separate from `/web/v1`; its current live `/reports` and `/web/v1/reports` endpoints return empty arrays, so no backend report is available to select yet.
