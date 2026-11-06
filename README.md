# scoobydao-web — Unmasked

## ACTIVE STATE — merged Reports checkpoint

`/reports` presents a native five-pillar card reader, empty unless a trusted research API origin is explicitly configured. RAY is a pending, not gate-qualified local reference. The research API and legacy approval API use different contracts and configuration; neither a health response nor a local review assertion proves authenticated sign-off. Reports PRs #1 and #2 are merged and CI passed. See [LIVE-STATE.md](LIVE-STATE.md) for current scope, deployment variables, backend asset transfer and remaining work, and [reports handoff](HANDOFF-REPORTS.md) for component ownership. No actual deployment or authenticated approval is claimed; World ID is deferred for this checkpoint.

Frontend for **Unmasked** (ETHGlobal Mumbai 2026): AI agents and an original detective-hound mascot, Sniff, investigate suspicious tokens; a verified human signs off on each claim; people stake For/Against with sealed bets; a Uniswap v4 hook freezes trading the moment a claim triggers.

Sibling repos: `ScoobyDAO-contracts` (ABIs + addresses), `ScoobyDAO-backend` (API, World Agent Pass gate). Shared types and routes live in [`INTERFACES.md`](INTERFACES.md). Open questions and deviations are tracked in [`NOTES.md`](NOTES.md).

## Run it

```bash
npm ci
cp .env.example .env.local      # then fill in the values below
npm run dev                     # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js 16 (Turbopack) |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest: commitment hash + storage, canonical manifest hash, payout math, v4 encoding, ABI drift |
| `npm run sync:contracts` | copies `abi/*.json` + `deployments/sepolia.json` from the contracts repo |
| `node scripts/contrast.mjs` | checks every text/background token pair against WCAG AA |

## Environment

Only `NEXT_PUBLIC_*` values; they are public by definition. No secrets live in this repo, and the browser never calls World's token endpoint.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | backend base URL (default `http://localhost:8080`) |
| `NEXT_PUBLIC_REPORT_API_URL` | optional trusted HTTPS research API origin (or loopback HTTP for local development) |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` (Sepolia only) |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | optional RPC; falls back to the public default |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | needed for WalletConnect; without it injected wallets still work but the console shows 403s |
| `NEXT_PUBLIC_DEMO_MODE` | `true` shows "Send Sniff to scan" (`POST /demo/scan`) |
| `NEXT_PUBLIC_USE_FIXTURES` | `true` explicitly enables sample data and simulated sign-off for demo/test only |
| `CONTRACTS_REPO_PATH` | used only by `scripts/sync-contracts.sh` |

The Reports page also has a read-only worker-status widget using `NEXT_PUBLIC_REPORT_API_URL`. It shows generic worker heartbeat and job counts; token-by-token discovery activity is not yet connected. See [the Reports handoff](HANDOFF-REPORTS.md) for scope and integration dependencies.

## Fixtures mode

The app uses `src/fixtures/` only when `NEXT_PUBLIC_USE_FIXTURES=true` is explicitly set for a demo or test. API failures and incompatible approval responses surface as errors; they do not enable fixtures. Fixtures cover every status: draft, awaiting approval, denied, expired, Open, Frozen, Resolved Pass (Unmasked), Resolved Fail (Cleared), Refunded.

While fixtures are on, or until real contract addresses are synced, reads and writes go to an in-memory chain (`src/lib/fixtureChain.ts`) and a dashed **Fixture mode** bar lets you act as an honest or a deployer-linked wallet. Transactions show the full toast flow but are marked "fixture, no real tx".

Handy fixture ids: approvals `apr-pending`, `apr-approved`, `apr-denied`, `apr-expired`, `apr-not-reviewer`, and `apr-live` (flips pending → approved after ~12s of polling); cases `/case/1` (open) … `/case/5` (refunded).

## Contracts

```bash
CONTRACTS_REPO_PATH=../ScoobyDAO-contracts npm run sync:contracts
npm test   # contracts.test.ts fails if a synced ABI drops a function the UI calls
```

Until then `src/contracts/sepolia.json` holds zero addresses and `src/contracts/abi/*.json` are generated placeholders. Typed ABIs used by wagmi live in `src/contracts/abis.ts`; Uniswap v4 encoding (Universal Router `V4_SWAP`, Permit2, V4Quoter) is in `src/contracts/v4.ts`. See NOTES.md for the router/pool assumptions the contracts team should confirm.

## Pages

| Route | What |
|---|---|
| `/` | Landing: flashlight hero (2D parallax, 3D on capable desktops), live stats, how it works, what we can't do |
| `/cases` | Corkboard of case files: filters, address search, demo scan |
| `/cases/[id]` | Case file: claims, stamped evidence, Sniff's notes (AI-written; not the verdict), barred wallets, manifest + Recompute hash, request sign-off |
| `/approve/[id]` | Projector screen for the World Agent Pass sign-off; polls every 2s; no 3D |
| `/case/[claimId]/stake` | Sealed commit → reveal → redeem with payout preview; barred and frozen banners |
| `/case/[claimId]/market` | For/Against shares ↔ USDC on Uniswap v4; halted when frozen |

Legacy paths `/claim/:id` and `/market/:id` redirect; `/reports` contains the research library.

## Demo walkthrough

1. **Cases** (`/cases`): show the board; filter to *Awaiting a human*; optionally *Send Sniff to scan*.
2. **Case file** (`/cases/rpt-honeypot`): read the claim cards and stamped evidence; press **Recompute hash** (✓); point out *Sniff's notes* are AI-written and not the verdict, and the barred deployer/funder wallets.
3. **Approve: deny first.** From a draft (`/cases/rpt-lantern`) press **Request a human sign-off**. On the projector screen read out the claim and hash, then deny in World App → "Denied — no case opened / Denied — draft only, no market opened". Then request again and approve → "Case opened" with the publish tx and a link to the case.
4. **Stake** (`/case/1/stake`): act as the deployer-linked wallet → barred banner, form disabled. Switch to the honest wallet → pick For, enter an amount, **Approve USDC, then commit** → sealed card + **Download backup** → **Reveal stake**.
5. **Market** (`/case/1/market`): buy For shares with USDC.
6. **Trigger**: the resolver triggers the claim. On `/case/2/market` (frozen fixture) the page shows "🪤 Trap sprung — trading halted at block N"; press **Send it anyway** → the swap reverts with `RiskFi: claim frozen`.
7. **Redeem** (`/case/3/stake`): the mask pops off; the payout preview shows the exact formula; **Redeem**.

## Accessibility and performance

- Status is always icon + text + colour (`StatusChip`, banners); every accent has a text-safe "ink" variant (`node scripts/contrast.mjs`).
- `prefers-reduced-motion`: no parallax, fixed flashlight, no 3D, static mask; grain and skeleton sweeps stop.
- axe (WCAG 2 A/AA + best practice): 0 violations on every page in dark and light themes.
- Lighthouse on `/` (production build, fixtures): mobile 100, desktop 96 (performance); accessibility and best practices 100. three.js loads right after hydration only on fine-pointer devices with WebGL and ≥4 cores; the 3D Sniff is visible ~0.4–0.5 s after navigation and the glTF loader is fetched only when `sniff.glb` exists.

## Asset credits

- **Mascot, hero scene, icons for mask/trap, identicons:** original placeholder art drawn in code for this project (SVG + three.js primitives). No third-party characters, models or illustrations. Drop a generated `public/models/sniff.glb` in and set `"sniff": true` in `public/models/manifest.json` to replace the placeholder hound; check the generator's licence first and credit it here.
- **Fonts:** Bungee, Inter, JetBrains Mono via Google Fonts (`next/font`), SIL Open Font License 1.1.
- **Icons:** Lucide (ISC licence).
- **Libraries:** Next.js, React, wagmi, viem, RainbowKit, TanStack Query, React Three Fiber, drei, three.js, qrcode.react; see `package.json` for licences.
