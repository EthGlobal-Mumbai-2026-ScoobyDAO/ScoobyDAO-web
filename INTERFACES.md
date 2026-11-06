# Web ⇄ backend ⇄ contracts (v2, Nov 2026)

> **Supersedes** the previous "RiskFi — Cross-Repo Interfaces" (ClaimRegistry / VerdictMarket / ShareToken / FreezeHook, sealed commit/reveal, `SELL_REVERTS` claims, 3% fee). None of that exists; the old text is in git history only. The same file should be copied to `../ScoobyDAO-backend` and `../SmartContracts`.
>
> Sources of truth: `../SmartContracts/src/**` (V1 deployed, `src/v2/**` local only), `../SmartContracts/deployments/testnets.json`, `../ScoobyDAO-backend/schemas/report.schema.json` (v0.2, frozen), `../ScoobyDAO-backend/publication/web_adapter.py`.

## 1. Chains and artifacts

| Chain | Id | Role |
|---|---|---|
| Ethereum Sepolia | 11155111 | ReportRegistry, VoteMarket, VotingPositionToken, Settlement, Reputation, Treasury, YieldSplitter, YieldVaultAdapter, YieldHookFactory, CCIPStakeReceiver, DemoUSD |
| Arbitrum Sepolia | 421614 | CCIPStakeSender, DemoUSD (CCIP source only) |

- Collateral: **DemoUSD (`dUSD`)**, 6 decimals, Chainlink `BurnMintERC20`, role-gated mint. Not USDC.
- Web reads `deployments/testnets.json` (`ethereumSepolia.contracts.<Name>.address`, `arbitrumSepolia.contracts.<Name>.address`). Missing keys mean "Not deployed yet".
- Keys the web will pick up when they exist: `YieldMarketHook`, `YieldSwapRouter` (V1 market), `RiskFiStakeVaultV2`, `YieldCurveHookV2`, `StakeAndSellRouterV2`, `YieldSwapRouterV2`, `CCIPStakeReceiverV2` (Sepolia) and `CCIPStakeSenderV2` (Arbitrum Sepolia).
- ABIs: generated from Foundry `out/<File>.sol/<Contract>.json` by `ScoobyDAO-web/scripts/gen-abis.mjs` (`npm run sync:contracts`).

## 2. Contract calls the web makes (V1)

Reads (multicall at the latest block; phase is derived from `block.timestamp`, never the local clock):

| Contract | Call |
|---|---|
| ReportRegistry | `reportCount()`, `getReport(id) → (reportHash, claimHash, reviewer, resolver, adjudicator, lockTime, crossChainCutoff, resultDeadline, challengePeriod)` |
| VoteMarket | `total(id, yes)`, `locked(id)`, `creditedMessage(messageId)` |
| Settlement | `decisions(id) → (proposed, finalOutcome, evidenceHash, proposedAt, finalizedAt, challenged)`; Outcome enum `None=0, Yes=1, No=2, Void=3` |
| VotingPositionToken | `tokenId(reportId, yes)` (= `reportId*2 + yes`), `balanceOf(account, tokenId)` |
| YieldSplitter | `yieldToken(id)`, `prepared(id)` |
| YieldVaultAdapter | `positiveYield()` |
| YieldToken | `balanceOf`, `globalIndex`, `paidIndex(a)`, `unclaimedUSDC(a)` → claimable = unclaimed + bal·(globalIndex − paidIndex)/1e18 |
| YieldHookFactory | event `HookDeployed(hook, yt, salt)` (to find the hook when `YieldMarketHook` isn't in testnets.json) |
| YieldMarketHook | `usdcReserve`, `ytReserve`, `feePips`, `maturity`, `poolKeyHash`, `shares`, `lpYieldPerShare`, `paidLPIndex(a)`, `unclaimedLPYield(a)`; event `Swapped(usdcIn, amountIn, amountOut)` |
| Reputation | `hasBadge(reportId, account)` |
| CCIPStakeSender (Arb) | `reportCutoff(id)`, `quoteFee(intent, amount, extraArgs)`; event `Sent(messageId, sender, reportId, recipient, yes, amount)` |
| CCIPStakeReceiver | `delivered(messageId)`, `recoverable(messageId)`, `recoveryRecipient(messageId)`; events `Credited`, `Held`, `Recovered` |

Writes (each is a TxPlan: dUSD/YT `approve(spender, max)` first when the allowance is short):

| Action | Call |
|---|---|
| Stake on Sepolia | `VoteMarket.stakeLocal(id, yes, amount, recipient=msg.sender)` (requires `now < lockTime`) |
| Stake from Arbitrum | `CCIPStakeSender.stakeRemote(StakeIntent, amount, extraArgs)` with `msg.value = fee + 10%` (excess refunded); requires `now < reportCutoff(id)` |
| Buy / sell YT | `YieldSwapRouter.swapExactInput(PoolKey, zeroForOne, amountIn, minOut, deadline)`; PoolKey = sorted (dUSD, YT), fee 0, tickSpacing 1, hooks = hook |
| Challenge | `Settlement.challenge(id, evidenceHash)` (anyone, `now < proposedAt + challengePeriod`, no bond) |
| Finalize | `Settlement.finalize(id)` (anyone; after the window, or after `resultDeadline` → Void) |
| Redeem | `Settlement.redeemVPT(id, yes, amount)` |
| Claim yield | optional `YieldSplitter.checkpointYield(id)`, then `YieldToken.claimYield()` |
| Claim LP yield | `YieldMarketHook.claimLPYield()` |
| Recover held CCIP | `CCIPStakeReceiver.recover(messageId, to)`: recipient only, `to == recipient`; operator only when the recipient is zero |
| REP badge | `Reputation.claimWinnerREP(reportId, recipient, scopedNullifier, nonce, expiry, signature)` |

`StakeIntent` (src/ccip/StakeIntent.sol): `(uint256 protocolVersion=1, uint256 reportId, bool yes, address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)`. The web sets `deadline = lockTime − 1`, `minAmount = amount`, a random 128-bit nonce.
`extraArgs`: `0xa69dd4aa ‖ uint32(500000) ‖ bytes4(0) ‖ bytes7(0)` (ExtraArgsCodec basic V3, as in `script/PreflightSource.s.sol`).

Payout (Settlement.redeemVPT): Void → `amount`; winner → `amount + amount·(L − L/5)/W`; loser → 0. Fee = `L/5`. Released amounts scale by `principalAvailable / totalPrincipal`.

### 2.1 V2 (local only, behind `NEXT_PUBLIC_PROTOCOL=v2`)

`RiskFiStakeVaultV2`: `reportId`, `maturity`, `yt`, `totalYes/totalNo`, `positionOf(a, yes)`, `proposed/finalOutcome/evidenceHash/proposedAt/finalizedAt/challenged`, `stake(id, yes, amount, owner, ytReceiver)`, `challenge(evidence)`, `finalize()`, `claimPrincipal(yes, amount)`. `StakeAndSellRouterV2.quoteSell(amount)` / `stakeAndSellYield(yes, amount, minUsdcOut, deadline)`. `YieldCurveHookV2.quoteBuy/quoteSell/spotPriceWad/impliedRateWad/timeRemainingWad`. `CCIPStakeSenderV2.stakeRemote(StakeIntentV2, …)` with `StakeIntentV2 = (uint8 protocolVersion=2, reportId, yes, sourceAccount, recipient, nonce, deadline, minAmount)`.

## 3. Report v0.2 and the claim manifest

- `report.json`: `schemas/report.schema.json` v0.2 (frozen). Web types are generated (`src/lib/report.generated.ts`).
- `reportHash` onchain = `0x` + SHA-256 of the exact `report.json` bytes (no re-serialisation).
- Claim manifest `scooby.claim-manifest/1` (publication/canonical.py): `{schema, version, title, chainId, token, symbol, claimText, assessmentStatus, claims[], evidence[], summary, excludedWallets[], windowSeconds, createdAt, reportId, reportVersion, reportSha256}`. `claimHash` = `0x` + SHA-256 of `json.dumps(m, sort_keys=True, separators=(',',':'), ensure_ascii=False)` UTF-8, integers only.
- **Requested:** `measurementMethod`, `observationWindow`, `voidRule` in the manifest (the web shows "not stated" until then).

## 4. HTTP: `/web/v1` (backend `publication/web_adapter.py`)

Base: `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000/web/v1`). Responses never contain device codes, tokens or keys; the web rejects any such field.

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/reports` | `Report[]` |
| GET | `/reports/{report_id@version}` | `Report` |
| GET | `/reports/{id}/raw` | exact `report.json` bytes, header `X-Content-SHA256` |
| POST | `/reports/{id}/approve` | `Approval` (starts or reuses a World device grant) |
| GET | `/approvals/{id}` | `Approval` (poll every 2 s until final) |
| POST | `/rep/authorize` | **proposed**, see §5 |

`Report` as sent today: `{ id, token, chainId, status: 'draft'|'awaiting_approval'|'denied'|'expired'|'published', manifest, manifestHash, createdAt, reportSha256, targetDigest, publicationState, revoked, approvalId?, txHash?, claimId?, onchainReportId? }`. The web maps it to `WebReport { id, reportId, version, status, claimManifest (= manifest), claimHash (= manifestHash), reportSha256, targetDigest?, onchainReportId?, txHash?, createdAt }` and fetches `report` from `/raw`.
**Requested:** emit `claimManifest`, `claimHash`, `reportId`, `version` under those names.

`Approval` as sent today: `{ id, reportId, manifestHash, status: 'pending'|'approved'|'denied'|'expired'|'rejected_not_reviewer'|'spent', expiresAt, userCode?, verificationUri?, publishTxHash?, onchainReportId?, detail? }`. The web also accepts `claimHash`, `reportSha256`, `verificationUriComplete`, `demoIdentity`, and status `error`.
**Requested:** send `status: 'error'` (instead of mapping it to `expired`), `verificationUriComplete` separately, `reportSha256`, and `demoIdentity: true` when World proofs are mocked.

## 5. Proposed: `POST /web/v1/rep/authorize`

Request `{ reportId: string, recipient: address, proof: IDKitResult }` (the IDKit 4.x result forwarded as-is). The backend verifies the proof with World (`POST https://developer.world.org/api/v4/verify/{rp_id}`), derives a report-scoped nullifier, checks `Settlement.eligibleWinner(reportId, recipient)`, and signs `Reputation.authorizationDigest(reportId, recipient, scopedNullifier, nonce, expiry)` with the `identitySigner` key.
Response `200 { reportId, recipient, scopedNullifier: bytes32, nonce: string, expiry: number, signature: bytes }`; `409` "This human already claimed a badge for this report"; `400` cancelled/invalid proof; `403` ineligible.
IDKit 4.x also needs a backend-signed `rp_context` (`rp_id, nonce, created_at, expires_at, signature`); propose `GET /web/v1/rep/context?reportId=` for it.
