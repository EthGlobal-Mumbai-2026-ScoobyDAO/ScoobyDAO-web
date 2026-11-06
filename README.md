# Unmasked (web)

**Live V2 app:** [scoobydao-web.vercel.app](https://scoobydao-web.vercel.app) · [Vercel project](https://vercel.com/dwaipayan25s-projects/scoobydao-web)

Pushes to `main` deploy to Vercel production; pull requests receive preview deployments and GitHub commit status checks.

Frontend for **Unmasked** (ETHGlobal Mumbai 2026). AI agents and an original detective-hound mascot, Sniff, research suspicious tokens and write a five-pillar report. A reviewed report is published to a `ReportRegistry`, and anyone stakes **dUSD** on **Yes** or **No**, directly on Ethereum Sepolia or from Arbitrum Sepolia over Chainlink CCIP. Each stake records a non-transferable Yes/No position and mints the same amount of a transferable **yield token (YT)**, which trades on a Uniswap v4 hook market until maturity. After maturity a proposed result can be challenged before anyone finalizes it.

The live default is the deployed **RiskFi V2** demo (report #1 on Ethereum Sepolia, CCIP sender on Arbitrum Sepolia), driven only by the contracts handoff bundle in `../v2`. `/reports` is a separate read-only research library, empty unless `NEXT_PUBLIC_REPORT_API_URL` points at a trusted research API (see [LIVE-STATE.md](LIVE-STATE.md) and [HANDOFF-REPORTS.md](HANDOFF-REPORTS.md)).

Interfaces: [`INTERFACES.md`](INTERFACES.md) (v3). Decisions, gaps and requests to the other repos: [`NOTES.md`](NOTES.md) → "V2 live integration (Nov 2026)". Plan: [`docs/v2-integration-plan.md`](docs/v2-integration-plan.md).

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

- **One series.** One V2 vault serves report #1. A report the backend publishes to the V2 registry has no vault, YT, pool or sender until a per-report deployment exists; the app shows "Published onchain — no market deployed for this report yet" and refuses stakes for it.
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
