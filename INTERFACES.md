# Web ⇄ backend ⇄ contracts (v3, Nov 2026)

> **Supersedes** v2 (Nov 2026), which described V1 as live and V2 as local only. The deployed **RiskFi V2** contracts are now the live default. The same file should be copied to `../ScoobyDAO-backend` and `../SmartContracts`.
>
> Sources of truth: the contracts **handoff bundle** (`../v2`: `addresses.json`, `abis/*.json`, `abi-manifest.json`, `FRONTEND_INTEGRATION_PLAN.md`), copied into `ScoobyDAO-web/src/contracts/v2/` by `npm run sync:v2` (every ABI's SHA-256 is checked against the manifest); `../ScoobyDAO-backend/schemas/report.schema.json` (v0.2, frozen); `../ScoobyDAO-backend/publication/web_adapter.py`. If the bundle and `../SmartContracts/src/v2/*.sol` disagree, the bundle wins (it matches what is deployed).

## 1. Chains and contracts (V2)

| Chain | Id | CCIP selector (bigint) | Role |
|---|---|---|---|
| Ethereum Sepolia | 11155111 | `16015286601757825753` | report, vault, REP, YT, v4 market, CCIP receiver |
| Arbitrum Sepolia | 421614 | `3478487238524512106` | CCIP sender (source of cross-chain stakes) |

Addresses are keyed by **(chainId, contract name)**, never by address alone: `0xfb2c…88e5` is the V1 `ReportRegistry` on Sepolia and the V2 `CCIPStakeSenderV2` on Arbitrum Sepolia.

| Contract | Chain | Web use |
|---|---|---|
| `DemoUSD` (dUSD, 6 dp, role-gated mint, not USDC) | both, same address | balances, allowances, `approve` |
| `ReportRegistry` (V2) | Sepolia | `getReport(id)`, `maturity(id)` |
| `RiskFiStakeVaultV2` | Sepolia | stake, REP, positions, settlement |
| `StakeReceiptREP` (REP) | Sepolia | `balanceOf`, `transfer` |
| `StakerYieldToken` (YT) | Sepolia | balance, yield index, `claimYield`, `transfer` |
| `YieldCurveHookV2` | Sepolia | quotes, reserves, curve, LP add/remove/claim |
| `YieldLPShare` (RF-YLP) | Sepolia | LP balance, supply |
| `YieldSwapRouter` | Sepolia | `swapExactInput` |
| `StakeAndSellRouterV2` | Sepolia | `quoteSell`, `stakeAndSellYield` |
| `CCIPStakeReceiverV2` | Sepolia | delivery state, outcome events, `recover` |
| `CCIPStakeSenderV2` | Arbitrum Sepolia | `reportCutoff`, `usedNonce`, `quoteFee`, `stakeRemote` |
| `PoolManager`, CCIP routers, `YieldCurveFactoryV2`, `BurnMintTokenPool` | — | deployment check only; never called directly |

**Pool key:** `{ currency0: dUSD, currency1: YT, fee: 0, tickSpacing: 1, hooks: YieldCurveHookV2 }`, sorted by address, `poolKeyHash = 0x5b8b1e5d…85c6`. Hook-owned inventory: liquidity goes through the hook, swaps through `YieldSwapRouter`; never Universal Router, Permit2, V4Quoter or PoolManager liquidity methods. `zeroForOne` is derived from the sorted key (dUSD is `currency0`, so buying YT is `zeroForOne = true`). The hook's own `feePips` (3000 = 0.30%) is a contract parameter, not the pool fee.

**One vault serves one report** (`vault.reportId()`, report #1). A report published in the registry without its own vault, YT, hook and sender has no market.

**Deployment check (once per session, before any write):** code at every bundle address on its chain; `vault.reportId/yt/rep/registry/usdc`; `hook.poolKeyHash/shares/yt/usdc/manager`; `YieldSwapRouter.manager`; `stakeAndSell.vault/hook/swapRouter/yt/usdc/ytIsCurrency0`; `receiver.vault/sourceSender/sourceSelector/usdc`; on Arbitrum `sender.destinationReceiver/destinationSelector/sourceUSD`; and the pool key hashing to `poolKeyHash`. Any mismatch disables writes.

## 2. Contract calls the web makes (V2)

Reads are Multicall3 batches at the latest block; phases use `block.timestamp`, never the local clock.

| View | Calls |
|---|---|
| Report | `ReportRegistry.getReport(id) → (reportHash, claimHash, reviewer, resolver, adjudicator, lockTime, crossChainCutoff, resultDeadline, challengePeriod)`, `maturity(id)` |
| Vault | `reportId, yt, rep, totalYes, totalNo, proposed, proposedAt, challenged, finalOutcome, finalizedAt, evidenceHash, principalAvailable, maturity, feeClaimed, treasury`; `DemoUSD.balanceOf(vault)` and `REP.totalSupply()` for the projected principal before finalization |
| Pool | `hook.poolKeyHash, shares, usdcReserve, ytReserve, spotPriceWad, impliedRateWad, timeRemainingWad, feePips, maturity, lpYieldPerShare`; `RF-YLP.totalSupply` |
| Wallet | `vault.positionOf(a, true/false)`, `REP.balanceOf(a)`, `YT.balanceOf/paidIndex/unclaimedUSDC(a)`, `YT.globalIndex`, `RF-YLP.balanceOf(a)`, `hook.paidLPIndex/unclaimedLPYield(a)`, the hook's own YT balance/index (LP estimate), `DemoUSD.balanceOf/allowance` on both chains, Arbitrum ETH balance |
| CCIP | `sender.reportCutoff(id)`, `sender.usedNonce(a, nonce)`, `sender.quoteFee(intent, amount, extraArgs)`; `receiver.delivered/recoverable/recoverySourceAccount(messageId)`, `receiver.recoveryOperator()` |
| History | `hook` `Swapped` + `RateObserved` over the last 5,000 blocks in ≤ 1,000-block `eth_getLogs` requests |

Writes. Every write simulates with the account, sends `gas = estimate + 20%`, requires `receipt.status === 'success'` and decodes revert strings and custom errors (`TokenCallFailed()`, `InvalidRouter(address)`, …). Approvals are for the exact amount unless the user picks "unlimited", and only when the allowance is short. Quotes, fees and nonces are re-read right before the wallet prompt.

| Flow | Steps |
|---|---|
| Stake | `DemoUSD.approve(vault, amount)` → `vault.stake(reportId, yes, amount, me, me)`: position (not transferable) + the same amount of YT (transferable) |
| REP receipts | `approve(vault)` → `vault.deposit(amount, me)` mints REP 1:1 · `vault.stakeFromREP(reportId, yes, amount, me, me)` burns REP, no REP approval · `vault.withdraw(amount)` burns REP for dUSD, any time · `REP.transfer(to, amount)` |
| Stake and sell | `approve(StakeAndSellRouterV2)` → `stakeAndSellYield(yes, amount, minUsdcOut, deadline)`; `minUsdcOut = quoteSell(amount) × (10000 − slippageBps) / 10000`, `deadline = latest block + 600`; a failed slippage check reverts the whole action |
| Buy / sell YT | `hook.quoteBuy(dUsdIn)` / `quoteSell(ytIn)` → `approve(YieldSwapRouter)` for the input token → `swapExactInput(poolKey, zeroForOne, amountIn, minOut, deadline)` |
| LP | `approve` dUSD and YT to the hook → `hook.addLiquidity(usdc, yt, minShares)` (after the first LP, `usdc·supply/usdcReserve == yt·supply/ytReserve` exactly) · `hook.removeLiquidity(shares, minUsdc, minYt)` (no approval) · `hook.claimLPYield()` |
| YT yield | `yt.claimYield()`; pending = `unclaimedUSDC + balance × (globalIndex − paidIndex) / 1e18`; `yt.transfer(to, amount)` |
| Cross-chain stake | on Arbitrum Sepolia: `DemoUSD.approve(sender)` → `stakeRemote(intent, amount, extraArgs)` with `value = quoteFee + 10%` (excess refunded); `messageId` from the `Sent` event in the receipt |
| Settlement | `vault.challenge(evidenceHash)` (anyone, nonzero, inside the window) · `vault.finalize()` (anyone) · `vault.claimPrincipal(yes, amount)` per held side |
| Operator (`/operator`) | `vault.propose(outcome, evidence)` (resolver) · `vault.adjudicate(outcome, evidence)` (adjudicator) · `approve(vault)` → `vault.injectYield(amount)` (simulated yield) · `vault.claimFee()` (pays the treasury) |
| Held CCIP funds | `receiver.recover(messageId, to)`: the source payer to itself, or the recovery operator for undecodable messages |

**CCIP encoding.** `StakeIntentV2 = (uint8 protocolVersion = 2, uint256 reportId, bool yes, address sourceAccount = sender, address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)` with `amount ≥ minAmount` (the web sets `minAmount = amount`, `deadline = lockTime − 1`, one random 128-bit nonce per attempt, checked with `usedNonce`). `extraArgs = 0xa69dd4aa ‖ uint32(1_500_000) ‖ bytes4(0) ‖ bytes7(0)` = `0xa69dd4aa0016e3600000000000000000000000`, packed, the same for quote and send. `Sent(bytes32 indexed messageId, address indexed sourceAccount, uint256 indexed reportId, address recipient, bool yes, uint256 amount)`. Destination outcomes, each indexed by `messageId`: `Credited` (a vote), `DeferredAsREP` (late or expired: REP for the source payer), `Held` (recoverable), `Recovered`. `delivered = true` alone is not a vote; the web shows "Voted" only after `Credited` plus a fresh `positionOf(recipient, yes)` and YT balance. Status also comes from `GET https://api.ccip.chain.link/v2/messages/{messageId}`.

**Gates** (each separate, mirroring the contracts):

| Action | Open while |
|---|---|
| Cross-chain send | `now < min(sender.reportCutoff(id), crossChainCutoff)` (Arbitrum block time) |
| Local stake, `stakeFromREP` | `id == vault.reportId() && now < lockTime` |
| Swaps, add liquidity | `now < maturity` (= lockTime + 30 days); not closed at lock |
| Remove liquidity, claim LP yield, claim YT yield, REP withdraw | always |
| Propose | resolver, `maturity ≤ now ≤ resultDeadline`, once |
| Challenge | `proposedAt ≠ 0 && !challenged && now < proposedAt + challengePeriod` |
| Adjudicate | adjudicator, challenged, not final, `now ≤ resultDeadline` |
| Finalize | `now ≥ proposedAt + challengePeriod` (unchallenged), or `now > resultDeadline` → Void |
| Claim principal, claim fee | final (fee: Yes/No only, once) and `now ≤ finalizedAt + 90 days` |
| Inject yield | something staked, `now < maturity` |

**Payout** (`claimPrincipal`): Void → `amount`; winner → `amount + amount·(L − ⌊L/5⌋)/W`; loser → 0; one-sided → Void. Fee = `⌊L/5⌋` of the losing pool. The paid amount is scaled by `principalAvailable / (totalYes + totalNo)` (simulated loss).

### 2.1 V1 (kept, not selected)

`NEXT_PUBLIC_PROTOCOL=v1` still selects the V1 adapter over `src/contracts/testnets.json` and `generated.ts` (`npm run sync:contracts`): `VoteMarket.stakeLocal`, `Settlement.challenge/finalize/redeemVPT`, `YieldSplitter`/`YieldToken`, `YieldMarketHook` via `YieldHookFactory.HookDeployed`, `CCIPStakeSender.stakeRemote(StakeIntent, …)` with `StakeIntent = (uint256 protocolVersion = 1, reportId, yes, recipient, nonce, deadline, minAmount)`, `Reputation.claimWinnerREP` (the V1 World ID badge). It shares the 1,500,000-gas `extraArgs`.

## 3. Report v0.2 and the claim manifest

- `report.json`: `schemas/report.schema.json` v0.2 (frozen). Web types are generated (`src/lib/report.generated.ts`).
- `reportHash` onchain = `0x` + SHA-256 of the exact `report.json` bytes.
- Claim manifest `scooby.claim-manifest/1` (`publication/canonical.py`). `claimHash` = **keccak256** (backend default since `bd6f82a`) or SHA-256 (`SCOOBY_CLAIM_HASH_ALG`) of `json.dumps(m, sort_keys=True, separators=(',',':'), ensure_ascii=False)` UTF-8, integers only. The web uses the DTO's `claimHashAlg`; without it, it tries keccak256 then SHA-256 and shows which matched.
- **Requested:** `measurementMethod`, `observationWindow`, `voidRule` in the manifest (the web shows "not stated" until then).

## 4. HTTP: `/web/v1` (backend `publication/web_adapter.py`)

Base: `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000/web/v1`). Responses never contain device codes, tokens or keys; the web rejects any such field. Backend availability affects only backend-sourced pages ("Research API unavailable"); it never selects fixtures or touches staking, trading, CCIP or claims. Fixtures are opt-in (`NEXT_PUBLIC_USE_FIXTURES=true`).

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ ok: true }` (not used to pick a mode) |
| GET | `/reports` | `Report[]` |
| GET | `/reports/{report_id@version}` | `Report` |
| GET | `/reports/{id}/raw` | exact `report.json` bytes, header `X-Content-SHA256` |
| POST | `/reports/{id}/approve` | `Approval` (starts or reuses a World device grant) |
| GET | `/approvals/{id}` | `Approval` (poll every 2 s until final) |
| POST | `/reputation-badge/authorize` | **proposed, V1 only**, see §5 |

`Report` as sent today: `{ id, token, chainId, status: 'draft'|'awaiting_approval'|'denied'|'expired'|'published', manifest, manifestHash, createdAt, reportSha256, targetDigest, publicationState, revoked, approvalId?, txHash?, claimId?, onchainReportId? }`. The web maps it to `WebReport` and also accepts `claimManifest`, `claimHash`, `claimHashAlg`, `publishTxHash`, `reportId`, `version`.

**Onchain link rule (V2).** The web shows "Published onchain as report #N" only when the DTO has `onchainReportId` and a publish tx (`publishTxHash` or `txHash`) **and** `ReportRegistry.getReport(N).claimHash` equals the claim hash recomputed in the browser. If `N == vault.reportId()` it also links the live market; otherwise "no market deployed for this report yet". Publishing to the V2 registry does not deploy a vault or market.

**Requested:** `claimHashAlg` on reports and approvals; `onchainReportId` + `publishTxHash` on reports; `claimManifest`, `claimHash`, `reportId`, `version` under those names; `status: 'error'` on approvals instead of mapping to `expired`; `verificationUriComplete`, `reportSha256` and `demoIdentity` on approvals.

`Approval` as sent today: `{ id, reportId, manifestHash, status: 'pending'|'approved'|'denied'|'expired'|'rejected_not_reviewer'|'spent', expiresAt, userCode?, verificationUri?, publishTxHash?, onchainReportId?, detail? }`. The web also accepts `claimHash`, `claimHashAlg`, `reportSha256`, `verificationUriComplete`, `demoIdentity`, and status `error`.

## 5. Proposed (V1 only): `POST /web/v1/reputation-badge/authorize`

For the V1 World ID reputation badge (`Reputation.claimWinnerREP`), unrelated to the V2 REP receipt and hidden in V2. Request `{ reportId: string, recipient: address, proof: IDKitResult }`. The backend verifies the proof with World (`POST https://developer.world.org/api/v4/verify/{rp_id}`), derives a report-scoped nullifier, checks `Settlement.eligibleWinner(reportId, recipient)` and signs `Reputation.authorizationDigest(reportId, recipient, scopedNullifier, nonce, expiry)` with the `identitySigner` key. Response `200 { reportId, recipient, scopedNullifier: bytes32, nonce: string, expiry: number, signature: bytes }`; `409` "This human already claimed a badge for this report"; `400` cancelled/invalid proof; `403` ineligible. IDKit 4.x also needs a backend-signed `rp_context` (proposed `GET /web/v1/reputation-badge/context?reportId=`).
