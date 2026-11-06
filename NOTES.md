# NOTES — conflicts, gaps and decisions

> Everything below "Revamp (Nov 2026)" predates the revamp and describes the retired RiskFi spec (sealed stakes, For/Against shares, FreezeHook). It is kept as history only.

Running log for `scoobydao-web`. Precedence when docs disagree: INTERFACES.md (data shapes) > CLAUDE.md (rules, scope) > THEME.md (look, copy, page features).

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
