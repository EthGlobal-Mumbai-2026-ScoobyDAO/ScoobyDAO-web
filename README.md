# Unmasked (web)

## ACTIVE STATE — scouting cases

`/cases` separates backend-prioritized scouting candidates from existing case files and demo markets. The scouting adapter matches the backend local prototype and defaults to unavailable unless its service is configured; it does not substitute fixtures. Human continuation remains disabled pending an authenticated backend verifier. See [scouting handoff](HANDOFF-SCOUTING.md). Native `/reports` is unchanged.

Frontend for **Unmasked** (ETHGlobal Mumbai 2026). AI agents and an original detective-hound mascot, Sniff, research suspicious tokens and write a five-pillar report (unknowns and counterevidence included). An enrolled human approves the exact report with World Agent Pass, the backend publishes it to `ReportRegistry`, and anyone stakes **dUSD** on **Yes** or **No**, directly on Ethereum Sepolia or from Arbitrum Sepolia over Chainlink CCIP. Stakes lock, earn simulated yield whose **yield token (YT)** trades on a Uniswap v4 hook market, and after maturity a proposed result can be challenged before anyone finalizes it.

`/reports` is a separate read-only research library (five-pillar reader + worker-status widget), empty unless `NEXT_PUBLIC_REPORT_API_URL` points at a trusted research API. See [LIVE-STATE.md](LIVE-STATE.md) and [HANDOFF-REPORTS.md](HANDOFF-REPORTS.md).

Interfaces: [`INTERFACES.md`](INTERFACES.md) (v2, Nov 2026). Decisions, gaps and requests to the other repos: [`NOTES.md`](NOTES.md) → "Revamp (Nov 2026)". Plan: [`docs/revamp-plan.md`](docs/revamp-plan.md).

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js 16 (Turbopack) |
| `npm run typecheck` · `lint` · `test` | tsc, ESLint, vitest (phase boundaries, payout math, hashes, guards, fixture chain, CCIP, market, TxPlan runner, ABI contract test, approve states) |
| `npm run sync:contracts` | regenerates `src/contracts/generated.ts` from `../SmartContracts/out` and copies `deployments/testnets.json` (run `forge build` there first) |
| `node scripts/gen-report-types.mjs` | regenerates `ReportV02` types from the backend schema |
| `node scripts/gen-fixtures.mjs` | re-copies the historical bundle's `report.json` bytes into `src/fixtures/historicalReport.ts` |
| `node scripts/contrast.mjs` | WCAG AA contrast for every token pair and status chip |

### Fixture mode

Backend fixtures and simulated approvals require explicit `NEXT_PUBLIC_USE_FIXTURES=true`. An unavailable or incompatible backend returns an error; it never silently switches to simulated approval. The protocol can separately use its labeled fixture chain when contract addresses are missing. A banner identifies the active modes.

- Backend fixtures serve the real v0.2 historical bundle (`ScoobyDAO-backend/tests/historical-bundle/report.json`, bytes unchanged; the hash check is ✓).
- The fixture chain enforces the contract rules (stakes before lock, CCIP before the cutoff, late CCIP → Held, payout math, challenge window, Void) on a **demo clock**. Without a wallet you act as a demo account.
- Scenarios: case #1 open (with one held CCIP stake), #2 locked with a YT market, #3 proposed inside a 3-minute challenge window, #4 final Yes 80/20, #5 Void. `/approve/demo-<status>` shows any approval state.
- State lives in memory: a **full page reload resets it**. Navigate with in-app links during a demo.

### Live mode

Set `NEXT_PUBLIC_API_URL` to a running backend (`…/web/v1`) and leave `NEXT_PUBLIC_USE_FIXTURES=false`. Reads go to the V1 contracts in `src/contracts/testnets.json` (`NEXT_PUBLIC_PROTOCOL=v1`). Writes go through your wallet; the app prompts a switch between Ethereum Sepolia and Arbitrum Sepolia.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | legacy backend `/web/v1` base (default `http://127.0.0.1:8000/web/v1`) |
| `NEXT_PUBLIC_SCOUTING_API_URL` | proposed scouting API origin; blank means unavailable, not fixtures |
| `NEXT_PUBLIC_USE_FIXTURES` | `true` forces fixture mode |
| `NEXT_PUBLIC_PROTOCOL` | `v1` (deployed) or `v2` (local only; shows "Not deployed yet" until addresses exist) |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` · `NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL` | optional RPCs |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | enables WalletConnect |
| `NEXT_PUBLIC_FAUCET_URL` | team-run dUSD faucet link (no public faucet exists) |
| `NEXT_PUBLIC_REP_ENABLED` · `NEXT_PUBLIC_LP_ENABLED` | REP badge card, LP panel |

## Demo script

1. **Cases** → expand **Existing case files and demonstration markets** and open the draft SHIB report. Both hashes verify ✓ (report SHA-256 of the raw bytes, claim hash of the canonical manifest).
2. **Request human approval** → the approve screen shows the code. First request: denied → red banner "Denied — no case opened."
3. Back to the case file (link on the page) → request again → "Approved — publishing…" → "Published onchain" with the tx → **Go to case** → phase Open.
4. **Stake** 10 dUSD Yes directly. Switch the source to Arbitrum Sepolia, stake via CCIP → **Track message**: Sent → In transit → Credited. Case #1 also shows a Held stake → Recover.
5. **Market** (case #2, locked): buy YT; price and implied APR are labelled "Simulated yield"; the received amount comes from the `Swapped` event.
6. **Result** (case #3, proposed): the challenge window counts down → **Finalize** → "Unmasked!" → redeem pays 1.20 per winning unit → claim yield.
7. **Void** (case #5): refund pro rata, no fee.

## Honesty labels

"dUSD — test token, not USDC" · "Simulated yield" · "Demo clock" · "Stakes are public onchain" · "The YT price is not a prediction of the verdict" · "A CCIP transfer is not a vote until it is credited" · "Demo identity: World Agent Pass". All in `src/components/HonestyLabels.tsx`.

## Known limits

- Live V1: no report is published yet, no YT series, hook or `YieldSwapRouter` exists, so market pages show "Market not deployed yet". V2 isn't deployed at all.
- The 30-day maturity is real on Sepolia; only fixtures show settlement live.
- dUSD minting is role-gated; there's no public faucet.
- REP badges need a backend IDKit verification endpoint that doesn't exist (fixture flow only).
- The backend's claim manifest doesn't state a measurement method, observation window or Void rule; the UI says "not stated" (Void rule falls back to what the contract enforces).
- CCIP status for V1 comes from receiver/market state plus a bounded log window; very old messages may show no source link.

## Accessibility and performance

- Status is always icon + text + colour; every chip ink passes 4.5:1 in both themes.
- `prefers-reduced-motion`: no parallax, fixed flashlight, no 3D, static mask.
- axe (WCAG 2 A/AA + best practice) on every page: 0 violations after the revamp fixes.
- Lighthouse on `/` (production, fixtures): mobile 97 / desktop 100 performance, accessibility 100, best practices 96 (only the refused `/health` request when no backend runs).

## Asset credits

- **Mascot, hero scene, mask icon, identicons:** original placeholder art drawn in code (SVG + three.js primitives). No third-party characters, models or illustrations.
- **Fonts:** Bungee, Inter, JetBrains Mono via Google Fonts (`next/font`), SIL Open Font License 1.1.
- **Icons:** Lucide (ISC licence).
- **Libraries:** Next.js, React, wagmi, viem, RainbowKit, TanStack Query, React Three Fiber, drei, three.js, qrcode.react, json-schema-to-typescript (dev); see `package.json`.
