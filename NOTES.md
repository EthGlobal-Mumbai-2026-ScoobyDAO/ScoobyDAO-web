# NOTES — conflicts, gaps and decisions

> Everything below "Revamp (Nov 2026)" predates the revamp and describes the retired RiskFi spec (sealed stakes, For/Against shares, FreezeHook). It is kept as history only.

Running log for `scoobydao-web`. Precedence when docs disagree: INTERFACES.md (data shapes) > CLAUDE.md (rules, scope) > THEME.md (look, copy, page features). Where "V2 live integration" and "Revamp" disagree, the V2 section is current.

## Rebrand + UI revamp (Nov 2026)

Current section; it supersedes older UI notes where they disagree. Protocol logic, request/response contracts, transaction plans, World ID state machines, hash checks, phase gates and payout math are unchanged.

### Brand
- The product is **ScoobyDAO**, mascot **Sniff** (original basset-hound detective). Changed: `<title>` template (`%s · ScoobyDAO`), Logo text and aria-label, Footer, RainbowKit `appName`, README/THEME/CLAUDE/AGENTS. "Unmasked!" remains only as the Final · Yes verdict moment (ResultScreen, StatusChip hint, CaseFile verdict word).
- THEME.md §0 rule 1 (which said studio characters *could* be used) is replaced by the original-mascot rule. New THEME.md §8 documents the component kit and layout rules.
- Metadata: description = the one-line pitch, Open Graph + Twitter `summary_large_image`, `metadataBase` from `NEXT_PUBLIC_SITE_URL` (default https://scoobydao-web.vercel.app). `src/app/opengraph-image.tsx` renders the 1200×630 card (wordmark, tagline, pitch, SniffHead on navy). It fetches Inter/Bungee from Google Fonts with a 4 s timeout and falls back to the default font offline.
- Storage keys migrated by `src/lib/storageKeys.ts` (read old once → write new unless it exists → delete old, all in try/catch): `unmasked:ccip` → `scoobydao:ccip` (localStorage, saved CCIP tracking), `unmasked:v2-deployment` → `scoobydao:v2-deployment`, `unmasked.review-sessions` → `scoobydao.review-sessions`, `unmasked.publication-attempts` → `scoobydao.publication-attempts`, `unmasked:maskpop:<id>` → `scoobydao:maskpop:<id>` (sessionStorage).

### Shell and kit
- `src/components/ui/`: Page, PageHeader, Section, Card (default · paper · highlight), StatTile, KeyValue, Tabs (+ `tabPanelProps(id, key)`), SegmentedControl, Disclosure, TechnicalDetails, InfoTip, HonestyChips, EmptyState/ErrorState, LoadState, Stepper, MobileNav, WorldConfirm. Tests in `ui.test.tsx`.
- `LoadState`: skeleton → "Still loading from {source}…" after 8 s → ErrorState with the source name and Retry after 20 s or on error. Late data still renders.
- `HonestyChips`: one chip per fact, each opening an InfoTip with the exact label from `HonestyLabels.tsx`. New fact "World proofs at the event use test identities" (`testIdentities`).
- Nav: consumer links only (Cases · Markets · Reports · How it works) + a "My positions" button, network badge, theme toggle, a "More" menu (Review desk; Operator only when `NEXT_PUBLIC_OPERATOR_VIEW=true`) and the wallet button (label "Connect" so it never wraps). Under 900 px: logo, wallet, hamburger → full-height sheet (focus trap, Esc closes, closes on navigation).
- Footer is now global (layout.tsx): wordmark + tagline, Product, For reviewers ("Reviewer" → /admin), contracts inside TechnicalDetails, "Built with World · Chainlink CCIP · Uniswap v4" as text. Its honesty row carries only "Test World IDs": pages that involve money show test dUSD, public stakes and simulated yield themselves, so the footer would otherwise repeat them on the same screen.
- Fixture banner is one line; full detail in its `title`.
- Fixed: fixture mode crashed in `deploymentQueryFor` because the fixture protocol has no `deploymentBundle`. `deploymentQueryFor(undefined)` now returns the default (disabled) query; test in `deployment.test.ts`.

### Case board card action (user decision, 7 Nov)
- The six scouted cases' primary action is **"Review report"**, linking to the review workspace `/admin/reviews/<id>/<version>` (`reviewWorkspaceHref`), not to a public reader. This overrides the spec line that said case cards link to the public reader.

### Case board and reports
- Filter groups (`src/components/cases/filters.ts`): **Under review** = draft, awaiting_approval · **Open** = open, open_local_only, published (publication reported, waiting for the case file's onchain check) · **Settling** = locked, matured, proposed, challenged · **Closed** = final_yes, final_no, void, denied, expired. "More filters" holds the exact phase and chain selects.
- Scouted cases are ordered by how many flags the scout summary names, then the pinned order ("ranked by how suspicious they look"). Their "Historical reference" chip opens the routing/snapshot caveats in a native `<details>`; the card still has exactly one link and no buttons.
- Review badges only repeat the backend: a backend row reads "Approved by a verified human" only when its status is `published`. Pillar dots appear only where `report.pillars` exists (backend case cards); the public case list has no pillar data.
- `/reports` merges public backend reports with the six references; filters All / Approved / Reference / Pending (Pending only when this tab holds a review session). Scout activity is a header pill with an InfoTip, replacing the "Discovery monitor" card. Both disclaimer blocks are gone.
- Public reader route `/reports/[id]/[version]`: a non-reference id falls through to the backend detail page; a reference report renders the gated reader when this tab has a session for it, otherwise "Available to reviewers only" with "Open in review desk". Reader layout: header card, sticky contents, summary first (assessment, key findings, open questions, caveats), one card per pillar, evidence table, limitations, TechnicalDetails (report SHA + recompute, per-file integrity, manifest digests). A failed `report.json` hash still blocks all content.

### World ID and reviewer area
- One `WorldConfirm` panel (src/components/ui/WorldConfirm.tsx) for Read, each decision and publication sign-off: stepper, "What you're confirming" card with consequence line, large code + copy, QR, countdown ring, live status (static under reduced motion), full-width Cancel, the phishing warning, and full-panel results. The two-step model is explained once in an InfoTip.
- State mapping (exact names). Read session: none → start; `pending` → waiting; `active` → report + slim session bar; `denied`/`expired`/`cancelled`/`not_permitted`/`failed`/`revoked` → results. Decision: `pending` → waiting; `confirmed`/`denied`/`expired`/`cancelled`/`not_permitted`/`failed`/`superseded` → results. Publication: `pending` → waiting; `approved` → "Approved — publishing…"; `spent` → "Published onchain"; `rejected_not_reviewer`/`denied`/`expired`/`error` → results.
- Reviewer layout (src/app/admin/layout.tsx, src/app/approve/layout.tsx): "Review desk" header and Queue · Decided · Publish sub-nav. Queue has tabs with counts, search, newest first, source badge (Reference / Generated); raw ids and SHA moved into a popover. Workspace: reader left, sticky decision panel right (three radio cards with consequences, reason with counter — same rule: required after trim, ≤ 1000 chars — review-target digest, Confirm with World ID), decision timeline, small "Withdraw decision" danger zone. Integrity failure still disables the panel. The six reference reports embed the existing ReferenceReader and never offer "Publish onchain".
- `/approve/demo-<state>` previews run only in fixture mode; in live mode the page says so instead of showing an endless skeleton. No production UI links to them.

### Markets, stake, positions
- Market names: "Demo market #N", "Original demo #1" for the pre-catalog report on the original deployment (so the two #1s stay distinct), or "SHIB — {short claim}" when a backend report is verified (matching `onchainReportId`, backend `claimHash` = registry, and `matchClaimHash` recomputed in the browser; catalog markets only). The landing page uses the same names. "Flexible registry" no longer appears.
- Market header: name, "Demo claim — no linked report" (InfoTip), phase chip, chain badge, "Contracts verified ✓", one honesty row chosen per tab, and a key-dates timeline with "Now". Overview leads with the pool summary and one call to action by phase; the payout calculator uses `previewStake`; hashes, roles, vault/hook internals, curve input, liquidity-share supply and the deployment check sit in one TechnicalDetails drawer.
- Stake: big Yes/No cards with live share; keep/sell YT, slippage, CCIP recipient/nonce and the approval toggle under "Advanced". Closed state: one-line banner + "What you can do now". Write gating, exact-approval default, receipt checks and the deployment-check gate are unchanged.
- Renamed: "Swap" → "Trade yield tokens", "Settlement" → "How this gets settled", "Claims" → "Your claims", "Claim principal" → "Claim your stake", "RF-YLP" → "liquidity shares". `ReportDropdown.tsx` was replaced by the card-list `MarketPicker`.
- `/me`: disconnected → Sniff alert + Connect + Browse markets; connected → four tiles then one card per market. `/markets/publish` and the unused `AcceleratedMarket.tsx` were not restyled.

### Landing and Sniff
- Sniff poses (SniffPose.tsx) are full-body on a 120×120 viewBox with distinct jobs: sniffing (loading), thinking (empty), alert (action), triumphant (success, holding the pulled-off mask), sad (denied/expired), shrug (unavailable); idle, asleep and confused still render. No gradients or SVG ids, so many can share a page. The 3D placeholder Sniff is now a belted trench coat with collar, lapels, sleeves and a magnifier instead of a cone.
- Landing: one-line pitch, "Browse cases" / "See live markets"; "Live now" (markets with Stake only while staking is open, plus the 3 latest scouted reports, each in LoadState) absorbs the old stats band; How it works is 4 steps with one pose each and "Details" disclosures holding the old long copy; Why trust it is one sentence per tile. "Built with" now appears only in the footer.
- 404 ("This case went cold.", shrug), error (alert pose + Retry) and loading (sniffing) use the kit. /operator uses PageHeader/Card with roles in TechnicalDetails; every action is unchanged.

### Requests for other repos (backend)
1. **Public read access** for reference report metadata/files and for approved report versions. Today `/web/v1/admin/reference-reports/...` returns 401 without a reviewer session and the reference-display contract only allows public reads of identifiers and labels, so `/reports/[id]/[version]` shows "Available to reviewers only".
2. `GET /web/v1/reports` returns 404 on the deployed backend (the case board shows a one-line partial-load note).
3. `/review-queue` items lack symbol, chain, title/claim and `decided_at`; generated reports show a name derived from the id.
4. No endpoint lists open publication sign-offs (Publish tab lists approved queue items and sends the reviewer to the case file) and there is no cancel endpoint for a publication sign-off (the screen says the code expires on its own).
5. The review API can't say whether a market/vault exists for a report; the next-step card points to the case file.
6. No token name or claim text per market onchain; markets without a verified backend report show "Demo market #N".
7. No "Start investigation" World flow exists (`allowedCaseActions` returns `[]`); WorldConfirm supports the action for when it does.

### QA tooling
- `scripts/shot.mjs <path> <out.png> [w] [h] [dark|light] [--full]`: Playwright screenshot helper (uses Playwright from `../deck/build`). Revamp screenshots are in `screenshots/revamp/` (per-area work shots) and `screenshots/revamp/final/` (every route at 1440×900, 768×1024 and 375×812, dark and light).
- `scripts/axe.mjs [paths…]`: axe-core via Playwright in both themes; exits 1 on serious/critical violations. (The spec said an axe script existed; it didn't, so this was added.)

## Six historical references, display only (Nov 2026)

Contract `scooby.reference-display/1` (backend `docs/reference-display-contract.md`, backend PR #29). Reusable reader pieces ported from web PR #9 (reconstruction CSV parser, chart and VAE wording); its loopback preview service, `/reference-preview` and branch-specific `vercel.json` were not brought over.

- **Case board** (`/cases`): "Historical reference cases" section from the public `GET /scouting/cases` (through `/api/research/scouting/cases`). A card appears only when `reference.kind = historical_reference` and case id and candidate match the pinned six-pair table (`src/lib/reference.ts`). Its single action is "Read report", linked from `reference.reports` exactly; it is shown only when report id, version and hash all match the pinned row. No challenge, continue, World-attempt, investigation, refresh, scan or onchain action is rendered, even if an item carried an action URL (`allowedCaseActions` returns none). The web has no agent-action flags; none were added.
- **Reader** (`/admin/reviews/[id]/[version]/reference`): behind the existing per-report `ReadGate` (World ID session for that report version only; no other sign-in path). Reads `GET /web/v1/admin/reference-reports/:id/:version` and listed files with `Authorization: Bearer`. Every file is re-hashed with WebCrypto against `files`, and also against `X-File-SHA256`/`X-Report-SHA256` when present. On a mismatch or a 409, that section shows "integrity unavailable" and no data. 401/403/404/network are explicit states. Reading issues GETs only; sign-off stays on the review page.
- **Charts** are hand-drawn SVG (no chart library in this repo) from parsed values only: no smoothing, and missing days are not bridged. Graph price uses the manifest's `price_field` (USD), with UTC dates, source, subgraph and window, plus a row-count, token and window check. The token_daily hash must equal the manifest `raw_sha256`. The VAE chart shows five fixed reconstructions (1, 13, 25, 37, 50) as fraction × 100. VaR 90/95/99 comes from `legacy_metrics.json` and is shown only if `graph_model/risk-metrics.json` agrees. The legacy risk score, risk label, "interpretation" sentence, expected shortfall and "max drawdown" are never read or shown, and raw report claims are not rendered. TL;DR/IRC text is shown verbatim, with a statistical-risk caveat that any quoted legacy label or VaR is uncalibrated and not a maximum loss.
- **Env** (unchanged names): `NEXT_PUBLIC_BACKEND_API_URL` (upstream `…/web/v1` for the `/api/backend` proxy), `NEXT_PUBLIC_API_URL=/api/backend`, `NEXT_PUBLIC_REPORT_API_URL` (https backend origin for `/api/research`, which carries the public case list). These are build-time values.
- **Release steps**: (1) backend PR #29 deployed with the reference seed (`/health` → `reference_seed.status` ok, 6 pairs, `display_only: true`); (2) backend `SCOOBY_WEB_ORIGIN` = this site's exact origin; (3) build the web with the env above and smoke-test `/cases` (six cards, no actions) and one reader after Read with a real reviewer World ID; (4) a new report version needs a new row in `REFERENCE_PAIRS` (pinned on purpose).
- Local checks: `REFERENCE_BUNDLES_DIR=<extracted bundles>` and `REFERENCE_CONTRACT_SAMPLES=<backend samples dir>` enable two env-gated conformance suites. They are skipped otherwise and never copy data into the repo.

## Review desk (Nov 2026)

- `/admin` and `/admin/reviews/[id]/[version]` consume the backend review desk (`/web/v1/admin`, contract `schemas/runtime/admin-checkpoints-v1.schema.json` in ScoobyDAO-backend). Client: `src/lib/adminApi.ts`; session token in `sessionStorage` only (`src/lib/adminToken.ts`), sent as `Authorization: Bearer`.
- Per-report Read (backend PR #26): `/admin` lists `GET /web/v1/review-queue` anonymously (id, version, hash, state) with a Read button per report. Read starts a World login limited to that report version (`POST /admin/session` with `{report_id, version}`); its token is stored per report (`<report_id>@<version>` in `sessionStorage`) and opens nothing else. Backend `SCOOBY_REVIEW_PER_REPORT=true` makes this mandatory. Publication sign-off uses the session of the same report; `GET /approvals/:id` looks up which report an attempt belongs to.
- Review file URLs (`/web/v1/admin/…`) are resolved through `NEXT_PUBLIC_API_URL`, so they work with the `/api/backend` proxy as well as an absolute base.
- Sign-in is a World device login; the backend decides who may review. With backend `SCOOBY_OPEN_REVIEW=true` any World ID that passes login validation (Orb by default) gets `report_review` and `publication`; otherwise only enrolled reviewers. The UI never decides access or approval.
- Every approve / reject / revise is a separate World App confirmation by the same World ID that signed in; the backend binds it to the review target digest the reviewer saw (`expected_target_digest`).
- Full report files need the bearer header, so they are fetched and shown from a blob URL in a sandboxed iframe (`sandbox="allow-scripts"`, opaque origin).
- Publication sign-off (`POST /reports/:id/approve`, `GET /approvals/:id`) now requires a review desk session with the `publication` scope (backend change). `api.ts` sends the session header; the case file and `/approve/[id]` point a signed-out user to `/admin`.
- Deployment: backend `SCOOBY_WEB_ORIGIN` must equal this site's exact origin (CORS for `Authorization`), and `SCOOBY_REPORT_RELEASE=approved` limits the public report library to approved versions.

## V2 live integration (Nov 2026)

V2 (Ethereum Sepolia + Arbitrum Sepolia) is the live default, driven only by the contracts handoff bundle `../v2` (`riskfi-v2-demo-1`). Plan: [`docs/v2-integration-plan.md`](docs/v2-integration-plan.md). Nothing was committed. All 13 bundle ABIs matched `abi-manifest.json` (SHA-256 and entry count) when copied; `src/contracts/v2/bundle.test.ts` keeps checking.

### Contracts, modes and the deployment check

1. **Module.** `src/contracts/v2/` holds the bundle copies plus a generated `abis.ts` (`as const`) and a typed `index.ts` keyed by **(chainId, name)**: `0xfb2c…88e5` is both the V1 `ReportRegistry` (Sepolia) and the V2 `CCIPStakeSenderV2` (Arbitrum Sepolia). `npm run sync:v2` (`scripts/sync-v2.sh` → `scripts/gen-v2-abis.mjs`) copies from `${CONTRACTS_V2_HANDOFF:-../v2}` (then `../SmartContracts/handoff/v2`) only after every hash and entry count matches; a tampered bundle is refused and the working copy is left alone.
2. **V1 kept, not selected.** `src/contracts/addresses.ts` lost its V2 keys and the `YieldSwapRouterV2 → YieldSwapRouter` fallback. The stale solc-js V2 ABIs were removed from `generated.ts` (the remaining 16 V1 ABIs are byte-identical) and from `scripts/gen-abis.mjs`. Two shared helpers changed for V1 too: `CCIP_GAS_LIMIT` is now 1,500,000 (`v1.ts` calls `basicExtraArgsV3()`), and the REP badge identifiers were renamed (item 30). No V1 logic changed.
3. **Mode switch.** The chain protocol comes only from `NEXT_PUBLIC_CHAIN_MODE` (`live` | `fixture`, default `live`) and `NEXT_PUBLIC_PROTOCOL` (`v2` | `v1`, default `v2`). The browser `/health` auto-fallback is gone: it used to flip both the backend and the chain to fixtures whenever `/health` failed. The fixture backend is opt-in (`NEXT_PUBLIC_USE_FIXTURES=true`); a failing backend now shows "Research API unavailable" on backend pages only. With a fixture backend on a live chain, backend onchain ids are not linked (they name fixture-chain reports).
4. `/web/v1/health` does return `{ ok: true }` (`publication/web_adapter.py`); the integration plan's `{status:'ok'}` is the backend's root `/health`. Neither is used to choose a mode now.
5. **Deployment check** (`src/protocol/deployment.ts`): code at all 18 bundle addresses on their chains; the 24 wiring reads the brief lists plus `hook.yt/usdc/manager`, `YieldSwapRouter.manager`, `stakeAndSell.usdc/ytIsCurrency0`, `receiver.sourceSelector/usdc`, `sender.sourceUSD`; and bundle consistency (pool key hashes to `poolKeyHash`, sorted, fee 0/tick 1; sender destination selector = Sepolia selector). 45 checks; **45/45 green against the live chains on 6 Nov 2026** (read-only run, item 38). One multicall per chain, once per browser session (a passing report is cached in `sessionStorage` per bundle version). Until it passes, V2 writes are refused by the plan runner and buttons are disabled; a mismatch shows the red "Deployment mismatch" banner listing each failed check.
6. The fixture chain still models the V1 lifecycle (late CCIP → Held; no REP receipts, LP writes or operator actions). V2-only panels are hidden in fixture mode.

### Writes

7. Every write: simulate with the account → `estimateContractGas` + 20% (`withGasMargin`, no fixed override; no `gas:` literal remains in `src`) → send → receipt must be `status === 'success'`, else replay at the receipt block for the reason. The receipt is read on the **step's** chain (it used to be the wallet's current chain).
8. All custom errors from the V1 and V2 ABIs (`TokenCallFailed()`, `InvalidRouter(address)`, `InvalidRecipient(address)`, `MaxSupplyExceeded(uint256)`, …) are added to each call's ABI for simulation and replay, so errors bubbling out of nested calls decode. Revert strings map to plain reasons with the code kept, e.g. "Not enough YT in the pool for this buy; try a smaller amount (YT_RESERVE)" (`src/lib/errors.ts`).
9. **Requote before sending.** `TxStep.prepare` re-reads the quote / CCIP fee / nonce right before the wallet prompt. Swaps and stake-and-sell keep the minimum the user accepted and stop without sending if the fresh quote is below it; their deadline becomes latest block + 10 minutes at that moment. LP adds re-check the exact ratio against fresh reserves.
10. **Approvals** approve exactly the amount by default; `maxUint256` only with the "Unlimited approval" toggle (`src/protocol/approvals.ts`; `v2.ts` contains no `maxUint256`, `500_000` or `fixture`).
11. A deployment-check failure or RPC error blocks writes; the user can re-run the check from the banner.

### Reads and RPC limits

12. Measured 6 Nov: viem's default Sepolia RPC (thirdweb) caps `eth_getLogs` at **1,000 blocks**; publicnode prunes logs older than ~5–20k blocks; `sepolia.drpc.org` refuses free-plan calls. All log reads are ≤ 1,000-block chunks inside bounded windows (recent trades: last 5,000 blocks; CCIP outcome fallback: ≤ 8 chunks from the estimated send block). The tracker prefers the CCIP API's destination tx and contract views over log scans. Dedicated read-only RPC URLs are recommended (README).
13. `getMarket(id)` for a registry id the vault doesn't serve returns `series: false` (no totals, pool or YT); `getPosition` returns zero positions for it. An id never published is an error.
14. Before finalization `principalAvailable` is 0 onchain, so previews use **projected principal** = min(dUSD held by the vault − REP supply, totalYes + totalNo), exactly what `_finalize` will store; after it, `principalAvailable`.
15. Payout previews and claims use `estimatePaid` = the existing contract-matching `payoutFor` (fee ⌊L/5⌋ of the losing pool) scaled by principal/total with Solidity flooring, labelled "Estimate — final amount comes from the claim receipt".
16. The LP claimable figure adds the hook's own YT yield not yet checkpointed (what `claimLPYield`'s `_checkpointGlobal` would pull) to `unclaimedLPYield + shares × Δindex`; still labelled "estimate until checkpoint". Direct YT yield uses `unclaimedUSDC + balance × (globalIndex − paidIndex) / 1e18`.

### CCIP

17. `CCIP_GAS_LIMIT = 1_500_000`; `extraArgs` is the packed V3 encoding, byte-identical to the bundle snippet (`0xa69dd4aa0016e3600000000000000000000000`, test), used for both `quoteFee` and `stakeRemote`. The CCIP API confirms the example's original send used `gasLimit 500000`, the failure the bundle describes.
18. **Intent** in tuple order: `(2, reportId, yes, sourceAccount = connected wallet, recipient = editable Sepolia wallet (default the same), nonce, deadline, minAmount = amount)`. Deadline = `lockTime − 1`, the last second a credit can count (the contracts' `SendV2CCIP.s.sol` used now + 1 day; either way a later arrival becomes REP). One random 128-bit nonce per attempt, the same nonce and deadline for the quote and the send; `prepare` re-checks `usedNonce` and replaces a used nonce (then requotes). A new nonce is drawn after each successful send.
19. Remote sends close at min(`sender.reportCutoff`, registry `crossChainCutoff`) (equal for report #1). The page gates on Sepolia block time; `prepare` re-checks against Arbitrum Sepolia block time. Value sent = fee + 10% (the sender refunds the excess); `prepare` checks the ETH balance first.
20. **Tracker** (`/tx/ccip/[messageId]`): the CCIP API `GET {NEXT_PUBLIC_CCIP_API}/v2/messages/{id}` (CORS checked 6 Nov: it echoes the caller's origin, so browsers can call it; if it's blocked, the page says so and relies on the explorer link and chain state), the source receipt (`Sent` decoded), `receiver.delivered/recoverable/recoverySourceAccount/recoveryOperator`, and the outcome event from the API's destination receipt or a bounded log scan. States: sent, in transit, failed ("Delivery failed — an operator can manually retry it in the CCIP explorer."), delivered (not a vote by itself), credited, deferred as REP, held, recovered. **"Voted" appears only after Credited plus a fresh `positionOf(recipient, yes)` and YT balance.** Recovered is inferred when `recoverable` returns to 0 after a hold (no log scan). Polls every 15 s while not final, including failed.
21. Sent stakes are remembered in `localStorage` (`unmasked:ccip`, try/catch) as `{messageId, sourceTx, reportId, side, amount, recipient, sourceAccount, savedAt}`; chain state stays the source of truth. After a send the app opens the tracker.

### Hashes and backend links

22. **Claim hash algorithm.** Backend `bd6f82a` made `keccak256` the default. The web computes both; it uses the DTO's `claimHashAlg` when present, else tries keccak256 then SHA-256 and says which matched (case file, approve page). Cross-language vector computed with the backend's own `claim_hash()` (offline, its venv): `src/test/recorded/claim-hash-vector.json`. `reportSha256` stays SHA-256 of the raw bytes.
23. **Publication ≠ market.** A backend report links onchain only when its DTO has `onchainReportId` and a publish tx (`publishTxHash`, or today's `txHash`) and `ReportRegistry.getReport(id).claimHash` equals the recomputed claim hash. Then "Published onchain as report #N", plus the live market when N = `vault.reportId()`, else "no market deployed for this report yet". In every other case no onchain link (the rail says why).
24. The backend publisher now targets the V2 registry `0x805d…7ebd`, but **publishing does not create a vault, YT, hook/LP share, stake-and-sell router or CCIP sender/receiver**. A new report needs a per-report deployment (integration plan, "Demo timing"); until then it shows "Published onchain — no market deployed for this report yet", and stakes are refused (`assertSeries`).
25. The approve page keeps its states. In live V2 its "Published onchain" button opens the case file (which verifies) instead of `/case/<onchainReportId>`.
26. **Report #1** carries demo `reportHash`/`claimHash`: everywhere it is "Demo report #1 (onchain) — not linked to a backend research report", never mapped to a backend report and never described as approved through World ID. In live V2, `/case/<n>/*` redirects to `/onchain/<n>/*`.

### UI decisions

27. Routes: `/onchain/[reportId]` (dashboard) with `/stake`, `/market`, `/result`; `/operator` (only with `NEXT_PUBLIC_OPERATOR_VIEW=true`, `noindex`; the flag is build-time, so the route builds as a 404 when off); "Live market" in the nav (V2).
28. `NetworkBadge` now also takes `chainId` to tag the chain each card's data came from.
29. The hook's own `feePips = 3000` (0.30%) is a contract parameter read from chain, not a v4 pool fee tier; the pool key stays fee 0 / tick spacing 1 from the bundle. No Universal Router, Permit2, V4Quoter or two-pool code was left to delete.
30. **REP naming (§3.8).** The V1 World ID badge is now "Reputation badge (World ID) — V1 only" and hidden in V2: `repBadge` → `reputationBadge`, `claimRep` → `claimReputationBadge`, `RepCard` → `ReputationBadgeCard`, `NEXT_PUBLIC_REP_ENABLED` → `NEXT_PUBLIC_REPUTATION_BADGE_ENABLED` (old name still read), and our never-implemented proposed route `/rep/authorize` → `/reputation-badge/authorize`. V2 REP is `PositionView.repReceipt`.
31. **Thin YT inventory.** The hook holds ~110 YT at ~0.009 dUSD/YT, so `quoteBuy(1 dUSD)` reverts `YT_RESERVE` today (0.9 dUSD → 99.4 YT). The judge step "buy YT with 1 dUSD" works only after more YT enters the pool (the stake-and-sell step adds ~3 YT, just enough). The market shows the inventory, an approximate maximum and the friendly error.
32. Recent trades are a small table (the chart was optional). The landing stat reads "YT traded (recent blocks)" in V2 because history is bounded.
33. "Get demo dUSD" has no mint button; "Add dUSD" switches the wallet to each chain before `wallet_watchAsset`, which adds tokens on the current network only.
34. The operator view offers only propose, adjudicate, inject simulated yield ("Simulated yield — demo only") and claimFee (paid to the treasury), each enabled by the role read from chain and the contract's time gate. No `simulateLoss`, `sweepDust` or admin setup.
35. Countdowns use the latest block time interpolated locally, as before; nothing enables a button on the local clock.

### Verification and open items

36. Green: `npm run typecheck`, `lint`, `test` (403 tests: manifest hashes, ABI coverage, deployment check pass/mismatch, gates at every boundary, plans, CCIP encoding/nonce/Sent/tracker with the recorded example, market/LP math, payout scaling, live-mode selection), `build`.
37. Tests use a mocked viem transport (`src/test/mockRpc.ts`, real ABI encoding, Multicall3 `aggregate3`) and recorded data (`src/test/recorded/`: the example's CCIP API response and raw receipts, the live wiring reads, the claim-hash vector). No test touches the network or sends a transaction.
38. Live, read-only, from Node (not in the repo): the real adapter against both chains on 6 Nov with viem's default RPCs: deployment check 45/45; report #1 open, demo hashes recognised, 100/15 dUSD; quotes (0.5 dUSD → 55.37 YT; 3 YT → 0.026886 dUSD); CCIP fee for 2 dUSD ≈ 0.000674 ETH; the example tracked to Credited with the refreshed position (15 dUSD No, 5.000232 YT); recent trades via 1,000-block chunks; a stake plan built (never sent).
39. **Not verified here:** browser rendering and any wallet transaction (no browser or wallet in this run; the Playwright MCP server failed to connect). The judge demo needs a pass in a real browser with a funded non-deployer wallet.
40. **Requests — contracts team:** (a) an operator-run dUSD faucet or a minter-role faucet contract (`NEXT_PUBLIC_FAUCET_URL`); (b) a per-report deployment (vault, YT, hook + LP share, stake-and-sell router, CCIP receiver + sender) and a refreshed bundle for any new publication; (c) more YT liquidity before the judge demo (≥ ~250 YT), or demo buys of ≤ 0.9 dUSD; (d) optionally list the role holders (deployer) in `addresses.json`. The CCIP API's CORS works today; no request.
41. **Requests — backend team:** (a) send `claimHashAlg` on report and approval DTOs; (b) send `onchainReportId` with `publishTxHash` on report DTOs (today `txHash` + `claimId`/`onchainReportId` once confirmed, which the web accepts); (c) the Revamp-section requests (item 19 etc.) still stand.

## Revamp (Nov 2026)

Rebuilt against `../SmartContracts` (V1 deployed, V2 local) and `../ScoobyDAO-backend` (`/web/v1`). Where `FRONTEND_REVAMP.md` and the revamp prompt differ, the prompt won. Nothing was committed.

### Contracts and ABIs

1. **No Foundry output to read.** `../SmartContracts/out` doesn't exist, forge isn't installed and `lib/` (git-ignored) is empty. To avoid hand-writing ABIs, this run compiled `src/**` with **solc-js 0.8.26** using foundry.toml's remappings, with dependencies fetched from npm into a scratch dir: OZ 4.9.6 (also used for Chainlink's `@openzeppelin/contracts@4.8.3` imports), OZ 5.3.0 (for `@5.3.0` and unversioned imports), `@chainlink/contracts` 1.5.0, `@chainlink/contracts-ccip` 2.0.0, `@uniswap/v4-core` 1.0.2. These may not be the exact commits in the contracts' `lib/`; only inherited ABI parts (CCIPReceiver `ccipReceive`/`getRouter`/`supportsInterface`, ERC1155, ERC20) depend on them. **Re-run `npm run sync:contracts` after `forge build`** to regenerate from the real `out/`. `scripts/gen-abis.mjs` reads any Foundry `out/` (`CONTRACTS_OUT`).
2. **Payout formula.** The prompt says `s + floor(s·L·0.8/W)`. The contracts compute `s + floor(s·(L − floor(L/5))/W)` (Settlement.redeemVPT, RiskFiStakeVaultV2.claimPrincipal). These differ when `L` isn't a multiple of 5 (e.g. L=9: 8 vs 7). `src/lib/payout.ts` follows the contract; tests cover Voting.t.sol (80/20 → 96, fee 4, 1.20/unit; one-sided → Void; 2+1 vs 1 dust) and EightVoterWorkflowV2.t.sol (145/75: fee 15; winners 113.103448 / 42.413793 / 28.275862 / 14.137931 / 7.068965; dust ≤ 5).
3. **Void refunds are pro rata.** `VoteMarket.release` scales by `principalAvailable / totalPrincipal` once the splitter is set; the UI says "refund pro rata, no fee".
4. **One series only (V1).** `DeploySepolia.s.sol` calls `configureSplitter`, so `VoteMarket._credit` enforces `ONE_SERIES_ONLY`: after the first report takes a stake, stakes on any other report revert. The UI shows the revert reason. Contracts: confirm this is intended for the demo, or deploy a fresh market per report.
5. **listPublished** uses `ReportRegistry.reportCount()` (ids 1..n) instead of scanning `Published` logs, because public RPCs reject unbounded `eth_getLogs`. Other history uses bounded windows (`src/protocol/clients.ts`).
6. **No YT market addresses.** testnets.json has `YieldHookFactory` but no `YieldMarketHook` or `YieldSwapRouter` (no report has locked yet). The hook is discovered via `YieldHookFactory.HookDeployed(hook, yt)` in a bounded window; the router can only come from testnets.json. **Request:** add `YieldMarketHook` and `YieldSwapRouter` to `deployments/testnets.json` after `DeployYieldHook.s.sol`. Until then live market pages say "Market not deployed yet".
7. **PoolKey** is built as YieldHookFactory and the tests do: sorted (dUSD, YT), fee 0, tickSpacing 1, hooks = hook. Swaps use `YieldSwapRouter.swapExactInput` (standard v4 routers can't use this hook).
8. **V1 implied APR** isn't a contract value: the UI derives it from price ÷ years to maturity and labels it "Implied APR (from price)" + "Simulated yield". V2 uses `impliedRateWad`.
9. **V1 YT goes to the Treasury at lock**, so users only get YT by buying it. Claimable yield is computed from `globalIndex/paidIndex/unclaimedUSDC`; vault yield reaches YT only after `YieldSplitter.checkpointYield(id)` (public), which the Claim-yield plan adds when `positiveYield() > 0`.
10. **V2** (`NEXT_PUBLIC_PROTOCOL=v2`) expects testnets.json keys `RiskFiStakeVaultV2`, `YieldCurveHookV2`, `StakeAndSellRouterV2`, `YieldSwapRouterV2` (falls back to `YieldSwapRouter`), `CCIPStakeReceiverV2`, `CCIPStakeSenderV2`. Not deployed, so V2 always shows "Not deployed yet" live. V2 has no `lock()`; the adapter treats `now >= lockTime` as locked. `Reputation` is bound to V1 Settlement, so V2 shows no REP.

### CCIP

11. **StakeIntent** exactly as `src/ccip/StakeIntent.sol` / `src/v2/StakeIntentV2.sol`. Choices: `deadline = lockTime − 1` (the receiver credits only while `now <= deadline` and `now < lockTime`), `minAmount = amount` (burn/mint pool moves exact amounts), random 128-bit nonce.
12. **extraArgs** = ExtraArgsCodec basic V3 with gas 500,000 (`0xa69dd4aa ‖ uint32 ‖ bytes4(0) ‖ bytes7(0)`), as in `script/PreflightSource.s.sol` (which got a live fee quote). The Foundry tests pass `""` against a mock router. Encoding copied from `@chainlink/contracts-ccip` 2.0.0; confirm against the pinned lib.
13. **Fee:** `CCIPStakeSender.quoteFee(intent, amount, extraArgs)`; the web sends `fee + 10%`, and `stakeRemote` refunds any excess.
14. **Cutoff:** remote stakes need `CCIPStakeSender.reportCutoff(id)` (set by the sender owner with `configureReportCutoff`), separate from the registry's `crossChainCutoff`. If it's 0 the UI says "Not configured for this report yet". **Request:** configure it right after each publish.
15. **Tracking (V1)** uses state, not only logs: `VoteMarket.creditedMessage`, `CCIPStakeReceiver.delivered/recoverable/recoveryRecipient`, plus bounded `Sent`/`Credited`/`Held` log lookups for tx links. V2 has no credited view, so it relies on logs. Destination polling every 15 s while pending; "slow" after 30 min.
16. **Recover access:** `recover(messageId, to)` is callable by the recorded recipient only, with `to == recipient`; if the recipient is zero (undecodable message) only the recovery operator can. V2: the source account. The UI shows the button only to the recipient and explains the operator case.
17. **CCIP Explorer link:** `https://ccip.chain.link/#/side-drawer/msg/<messageId>`, taken from sample output in the Chainlink CCIP tutorials (programmable token transfers / send arbitrary data, updated 2026-05-01). The dedicated explorer docs page returned 404.
18. localStorage key `unmasked:ccip` remembers which message ids to track (try/catch); logs and receiver state are the source of truth.

### Backend `/web/v1`

19. **Shape mismatch.** `publication/web_adapter.py` still returns the old `Report` (`token, chainId, manifest, manifestHash, claimId`) and `Approval` (`manifestHash`, no `reportSha256`, no `verificationUriComplete`, `verificationUri = complete || uri`). `src/lib/guards.ts` maps them to `WebReport`/`Approval` and whitelists fields, rejecting anything secret-looking (`device_code`, `*_token`, `tokens`, `secret`, …). **Request (backend):** emit `claimManifest`, `claimHash`, `reportId`, `version`; on approvals add `reportSha256`, `verificationUriComplete`, `demoIdentity`, and return `status: 'error'` instead of mapping errors to `expired`.
20. The full v0.2 report is fetched from `/reports/:id/raw` (exact bytes, also used for the SHA-256 check). The board uses only the manifest (symbol, chain, claim text) to avoid N raw downloads.
21. **Claim manifest gaps.** `scooby.claim-manifest/1` has no measurement method, observation window or Void rule; ClaimCard says "not stated in the claim manifest" and shows the window from chain times and the Void rule the contract enforces, labelled as such. **Request:** add `measurementMethod`, `observationWindow`, `voidRule`. The manifest still carries `excludedWallets` (old product); it is hashed so it stays in the type, but the UI never shows it.
22. `claimHashAlg` is configurable in the backend (`sha256` | `keccak256`). The web recomputes SHA-256 only; with keccak256 the check would show ✗.
23. **Canonical JSON** in `src/lib/hash.ts` mirrors `json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=False)`: keys sorted by code point, integers only (floats rejected, as the backend does). Lone surrogates would still differ (JSON.stringify escapes them, Python writes them raw); floats would format differently.
24. **Brand conflict in data.** The historical bundle's own text says "No new Scooby DAO assessment has been made." It's frozen report content, rendered as-is. **Request (backend):** use "Unmasked" in generated report text.
25. Evidence records have no source/method/units fields; method and units are shown per measurement inside each pillar.
26. **Artifacts:** no public route serves bundle files or the rendered reader/PDF, so Artifacts lists kind/availability/path/sha256 without links (no iframe). **Request:** a `readerUrl`/`pdfUrl` on the report.
27. `demoIdentity` isn't sent by the backend; fixture approvals set it. **Request:** send it when World proofs are mocked at the event.
28. `/demo/scan` isn't part of `/web/v1`; the "Send Sniff to scan" button and `NEXT_PUBLIC_DEMO_MODE` were removed.

### Faucet and REP

29. **dUSD faucet:** DemoUSD is a Chainlink `BurnMintERC20` with role-gated mint, so there's no public faucet. `GetTestFunds` links `NEXT_PUBLIC_FAUCET_URL` if set, else "Ask the team for test dUSD" + token address + Add-to-wallet (`wallet_watchAsset`). **Request:** a minter-role faucet contract or a backend drip.
30. **REP (flagged, partial).** Current World docs (docs.world.org/world-id/reference/idkit, read Nov 2026): IDKit **4.x**, `@worldcoin/idkit`, component `IDKitRequestWidget` with `app_id`, `action`, `rp_context`, `preset={orbLegacy({ signal })}`, `handleVerify`, `onSuccess`; `rp_context` must be signed by the backend. Neither that nor a REP authorization exists, and the deployed `identitySigner` is the deployer key (mock). So the widget is **not installed**; `RepCard` implements success / "This human already claimed a badge for this report" / cancelled-ineligible with a fixture proof only. Proposed endpoints for the backend owner (also in INTERFACES.md §5):
    - `GET /web/v1/rep/context?reportId=` → `{ rp_id, nonce, created_at, expires_at, signature }`
    - `POST /web/v1/rep/authorize` `{ reportId, recipient, proof: IDKitResult }` → `200 { reportId, recipient, scopedNullifier, nonce, expiry, signature }` for `Reputation.claimWinnerREP`; `409` already claimed; `400` cancelled/invalid; `403` ineligible (`Settlement.eligibleWinner` false). Verify via `POST https://developer.world.org/api/v4/verify/{rp_id}`; nullifier unique per (nullifier, action).

### Web decisions

31. **Protocol interface deviations** from the prompt's sketch: write builders are `async` (they read allowances); `stakeLocal/stakeRemote/swapYT/stakeAndSell/claimYield` take the account; `quoteYT/swapYT/claimYield` take the report id; extra methods `quoteRemote`, `quoteStakeAndSell`, `claimLPYield`, `claimRep`, `trackCcip`, `chainTime`, `ytVolume`. `Decision` also carries the proposed outcome.
32. **Fixture selection:** the fixture chain is used when `NEXT_PUBLIC_USE_FIXTURES=true`, when the protocol's addresses are missing, **or when the backend is in fixture mode** (so fixture reports never point at real report ids). Fixture state is in memory and resets on full reload; the demo clock is wall time plus an offset.
33. **Chain time:** phases use `getBlock('latest').timestamp`; countdowns interpolate locally between 12 s refreshes (one shared 1 Hz clock). Backend times (approval expiry) use the local clock.
34. Every write runs through one plan runner (`src/lib/runPlan.ts`): wrong-chain switch, simulate, send, receipt, revert replay at the receipt block, toast with Etherscan/Arbiscan link. Fixture tx hashes are shown as "fixture tx", never linked.
35. Terminology: For/Against, frozen, trap, sealed, commit/reveal and excluded-wallet copy are gone; THEME.md §2.3, §5–§7 and the checklist were updated. Status chips: Draft, Awaiting approval, Denied, Expired, Open, Cross-chain closed, Locked, Matured, Proposed, Challenged, Final · Yes, Final · No, Void; all inks pass 4.5:1 (`node scripts/contrast.mjs`).
36. Footer no longer lists repo names (they're derived from a studio character name; the brand rule keeps them internal). Internal storage keys like `scoobydao:theme` were left.
37. LP: `NEXT_PUBLIC_LP_ENABLED` shows LP shares and Claim LP yield; add/remove liquidity are not wired.
38. Screenshots: `screenshots/p3-approve-apr-*` (desktop + mobile) were overwritten with the new states, plus a new `-error` pair. Older screenshots of retired pages were left in place, not deleted.
39. Checks run: axe-core WCAG 2 A/AA + best practice on 12 pages, 0 violations (after fixing one `<dl>` structure on the market page); Lighthouse `/` mobile 97 / desktop 100 performance, a11y 100, best practices 96 (the refused `/health` request without a backend).
40. A `next dev -p 3100` server from an earlier session was running during this work; it was left alone. Verification used a production build on port 3217.

---

# Pre-revamp notes (historical)

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

## Mismatch with the deployed V2 contracts (flagged for SmartContracts)

The contracts repo (`EthGlobal-Mumbai-2026-ScoobyDAO/SmartContracts`) deployed a different design from INTERFACES.md §1–2. Not patched around here; it needs a team decision.

- **Contracts:** deployed are `ReportRegistry`, `RiskFiStakeVaultV2`, `StakeReceiptREP`, `StakerYieldToken`, `YieldCurveHookV2`, `YieldSwapRouter`, `StakeAndSellRouterV2`, CCIP sender/receiver. The web ABIs are `ClaimRegistry`, `VerdictMarket`, `FreezeHook`, `Treasury`, and `src/contracts/sepolia.json` is all zero addresses. V2 has no freeze, no commit/reveal and no `isExcluded`, so the "trigger → halted market → `RiskFi: claim frozen`" demo step cannot run against it.
- **Approval binding:** `ReportRegistry.publish` takes a reviewer ECDSA signature over the report struct; it has no `approvalId` or `manifestHash`, so the reviewed manifest hash isn't recorded onchain the way INTERFACES.md §1 expects.
- **Payout formula:** `src/lib/payout.ts` implements the VerdictMarket spec (`s + s·L·(10000−f)/(10000·W)`, fee taken from one-sided refunds). V2 `claimPrincipal` pays `amount + amount·(L − L/5)/W`, refunds Void and one-sided reports **in full**, then scales every payout by `principalAvailable / totalPrincipal`. Rewrite `payout.ts` if the UI moves to V2.
- **Swaps:** the V2 hook takes the input during `beforeSwap`, so swaps must go through the deployed `YieldSwapRouter`, not the v4 periphery router CLAUDE.md §3.5 assumes.

## Dependency decisions

- **wagmi pinned to 2.x** (2.19.x): RainbowKit 2.2.11 peer-depends on `wagmi ^2.9.0`; wagmi 3.x is not supported yet.
- **`@coinbase/cdp-sdk` aliased to a stub** (`src/stubs/cdp-sdk.ts`, via `turbopack.resolveAlias` in `next.config.ts`). The RainbowKit barrel imports wagmi's `baseAccount` connector → `@base-org/account` → `@coinbase/cdp-sdk`, which imports optional `@x402/*` packages that aren't installed, so `next build` failed. `@base-org/account` only uses `CdpClient` for Base subscription payments, which we never use. Remove the alias if a future RainbowKit/wagmi release fixes this.
- Wallet list is explicit (MetaMask, Rabby, WalletConnect, injected) via `connectorsForWallets`.
- Next 16 removed `next lint`; `npm run lint` runs the ESLint CLI with `eslint-config-next` flat config.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: when empty, WalletConnect is left out of the wallet list entirely (only browser-extension wallets via `injectedWallet`), so there are no 403/400 or Lit dev-mode console messages. Set a real project id before the demo to offer MetaMask/Rabby/WalletConnect explicitly.

## Design decisions

- Text-safe "ink" variants of each accent (`--beam-ink`, `--clue-ink`, `--mask-ink`, `--ghost-ink`) so status text passes 4.5:1 on every surface; the THEME.md accent hexes are kept for fills, bars and borders. `node scripts/contrast.mjs` checks every pair.
- Light theme: `[data-theme="light"]` on `<html>`, toggled from the navbar, saved under `scoobydao:theme`. Paper "case file" surfaces stay paper in both themes.
- `/styleguide` (noindex) renders every status chip and surface for visual checks.

## Phase 3 decisions

- **Fixture chain + demo wallets.** With no deployed contracts (or in fixtures mode) all reads/writes go to an in-memory chain (`src/lib/fixtureChain.ts`) that enforces the same rules the UI depends on (exclusion, commits only while Open, one commit, reveal must match). A "Fixture mode" bar lets you act as an honest or a deployer-linked wallet. It never appears once the API is live and contracts are synced, and a real connected wallet is used whenever no demo wallet is picked.
- **Salt saved before the first tx**, cleared again only if the approve/commit definitely did not happen: rejected in the wallet, failed simulation, or a mined-but-reverted receipt. If the commit was **broadcast but its receipt couldn't be read** (RPC error, timeout), the runner calls `onOutcomeUnknown` and the salt is kept and the sealed panel shown, because the tx may still be mined and the salt is the only way to reveal it. If localStorage is unavailable the backup file downloads automatically before the commit. Follow-up: if such a commit was actually dropped, the sealed panel has no "discard" action; add one that checks the chain has no commitment first.
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

## Phase 8: polish and checks

- Global `not-found` ("This case went cold."), `error` and `loading` states; empty states use Sniff poses (asleep / confused / sad).
- axe-core (WCAG 2 A/AA + best practice) on every page and key state, dark + light: **0 violations** after fixing heading order on `/cases`, h1 on 404s, and the light-theme Frozen chip contrast (`--mask-ink` → `#9c2d0f`).
- Keyboard: every focusable on the stake page shows a visible focus ring.
- **Lighthouse on `/`** (prod build, fixtures): mobile perf 98 (TBT 150 ms, LCP 0.9 s), desktop 100; a11y 100 desktop; best-practices 96 only because of WalletConnect 403/400 with the dummy project id. First run was 67 on mobile because three.js loaded during the audit; 3D now loads only after a pointer move over the hero on fine-pointer devices.

## THEME.md §9 pre-demo checklist

| Item | Status |
|---|---|
| No studio character, name or catchphrase anywhere (assets, copy, metadata, favicon) | **Partial.** Copy, art, metadata and favicon are original (Unmasked / Sniff). But the footer lists the repo names `ScoobyDAO-web/-backend/-contracts`, which are user-visible and derived from a studio character's name; internal ids (`scoobydao:` storage keys, package name) aren't visible. Decide whether to rename the public repos or drop names from the footer (`src/lib/site.ts`). |
| Generated assets' licences allow public use; credits in README | Pass for what exists: no generated assets yet, all art is original code-drawn placeholders; fonts/icons credited. Re-check when `sniff.glb` / parallax art land. |
| 3D fallback tested with WebGL disabled and with reduced motion on | Pass (Playwright: WebGL `getContext` stubbed → 2D layers, no canvas; reduced motion → no canvas, fixed beam). |
| `/approve` loads instantly, readable from the back of the room | Pass: no 3D/canvas (verified 0 canvases), 5xl–6xl code, 2xl claim text, hash in 4-char groups. |
| Every tx shows pending → confirmed → explorer link | Pass for live txs (toast links to Sepolia Etherscan); in fixture mode the hash is shown without a link since it isn't real. Failed txs show the decoded revert. |
| Frozen state visible on stake and market pages | Pass (banner with block number on both; market inputs disabled + forced-swap revert). |
| Lighthouse performance ≥ 80 on landing; .glb < 3 MB | Pass: 98 mobile / 100 desktop; no .glb shipped yet (manifest gate ready). |

## Fixes after review (2026-11-06)

- **Deployed backend connection.** `https://scoobydao-backend.onrender.com/web/v1` answers `/health` and `/reports`, but sends no browser CORS header and returns 405 to preflight. The browser now calls the same-origin `/api/backend` path, which Next.js rewrites to the configured upstream. At integration time `/reports` returned `[]`; no live approval could be exercised. The supplied `auth.world.org/authorize?transaction_id=...` URL is one World authorization request, not the backend API base or an `/approvals/{id}` ID (the latter returned 404). The approval UI continues to use the per-request verification URL returned by the backend.

- **Hero background no longer swaps out.** 3D used to replace the whole 2D scene (new moon/mansion, CSS flashlight hidden) and Sniff popped in on top. Now the 2D night scene, parallax and CSS flashlight are always the background; Sniff has one slot in the yard: a 2D figure from first paint, and on capable desktops a *transparent* R3F canvas rendering only Sniff in the same box, crossfading in. He sits under the darkness layer, so the flashlight reveals him.
- **"How it works" repeat clicks.** Next only scrolls on a hash *change*, so clicks after the first did nothing. `SectionLink` scrolls every time on `/` (instant under reduced motion), updates the hash and focuses the section; from other pages it navigates to `/#how-it-works`.
- **Console noise.** WalletConnect only initialises with a real project id; the backend `/health` probe result is cached for 60s in sessionStorage (one `ERR_CONNECTION_REFUSED` per minute while the backend is down, instead of one per page load; set `NEXT_PUBLIC_USE_FIXTURES=true` in `.env.local` to skip it entirely); three.js pinned to 0.182 because r183 deprecated `THREE.Clock`, which React Three Fiber 9.8 still constructs.

## Hero load latency (2026-11-06)

Problem: on reload the 2D placeholder Sniff showed first and the 3D one swapped in only after the pointer moved (~1.15 s later, 700 ms of it crossfade).
- Devices that will get 3D never show the 2D figure (CSS hides it from first paint; coarse pointer / reduced motion show it via a media query before JS; JS reveals it if WebGL or cores rule 3D out).
- 3D code + model manifest load in parallel right after hydration (no pointer intent); fade 300 ms; dpr capped at 1.5.
- glTF loader (drei `useGLTF`/`useAnimations`) split into `SniffModel.tsx`, fetched only when `manifest.json` says `sniff: true`.
- Measured on the prod build at 1440×900: 3D Sniff visible 370–530 ms after navigation; 2D figure opacity stayed 0 in every sampled frame; flashlight sweep 8.3 ms p50 / 9.0 ms p95 frames; Lighthouse mobile 100 / desktop 96 (TBT 30 / 170 ms).
- The dev server (`npm run dev`) compiles chunks on first request, so the first 3D load there is much slower than production.

## Dynamic V2 markets and research API (2026-11-06)

The user's requested per-report flow extends the original one-series V2 handoff. `src/contracts/v2/index.ts` now accepts a validated runtime bundle built from the deployed `V2PoolCatalog`; the original handoff addresses and ABIs remain the reference for report #1. New infrastructure ABIs and deployment addresses are stored under `src/contracts/market-infrastructure`. A published report is listed from its registry immediately; its vault, v4 hook, liquidity, and CCIP sender need separate publisher wallet transactions before those functions are available. The frontend does not infer backend approval from research metadata. The research API and `/web/v1` currently return empty report lists. Browser CORS was absent for the research API, so Next.js proxies it through `/api/research`.

## One case docket (2026-11-07)

The separate "Historical reference cases" section is gone. The six pinned cases from `GET /scouting/cases` now sit in the main case board docket, next to backend reports, and share its search, chain and phase filters.

- **Card context** comes only from the public case item: the scout's summary is split into "Sniff flagged" traits (hidden owner, owner balance control, minting, pause, blacklist) and "Checked clear" traits (no honeypot, zero owner, no sell-all restriction). Matching uses the summary text alone (`scoutFindings` in `src/lib/reference.ts`); a card with no traits says the scout raised no contract flags. Cards show "From token-security provider data" and the scouting time (`fetched_at`).
- **Phase** comes from the report's review state (`referenceStatus`): `pending_review` and `awaiting_confirmation` count as Awaiting approval, `rejected` as Denied, anything else as Draft.
- Uncertainties are shown as "Open questions", minus the reference-table prefix. The routing text, "Historical reference — unreviewed" label and snapshot-expiry line are no longer shown on the board.
- Unchanged: pinned case/report binding, link withholding on mismatch, no agent, World-attempt or onchain actions on these cards, and the World ID-gated reader. Report #1 keeps its required "Demo report #1 (onchain)" label (CLAUDE.md rule 11).
