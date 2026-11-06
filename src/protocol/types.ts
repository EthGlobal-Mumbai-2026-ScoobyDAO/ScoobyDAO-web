import type { Abi, Address, Hex, Log } from 'viem';

// One interface for the V1 contracts, the V2 contracts and the fixture chain.
// Pages and components import from src/protocol only, never raw ABIs.

export type Phase =
  | 'open'
  | 'open_local_only'
  | 'locked'
  | 'matured'
  | 'proposed'
  | 'challenged'
  | 'final_yes'
  | 'final_no'
  | 'void';

export type Outcome = 'yes' | 'no' | 'void';

export interface Decision {
  /** Proposed outcome (Settlement.Decision.proposed / vault.proposed()); undefined before a proposal. */
  proposed?: Outcome;
  /** Final outcome; undefined until finalized. */
  outcome?: Outcome;
  evidenceHash: Hex;
  proposedAt: number;
  challenged: boolean;
  finalizedAt?: number;
}

export interface MarketView {
  reportId: bigint;
  reportHash: Hex;
  claimHash: Hex;
  reviewer: Address;
  resolver: Address;
  adjudicator: Address;
  lockTime: number;
  crossChainCutoff: number;
  resultDeadline: number;
  challengePeriod: number;
  maturity: number;
  totals: { yes: bigint; no: bigint };
  /** V1: VoteMarket.locked(id). V2 has no lock() call: true once now >= lockTime. */
  locked: boolean;
  phase: Phase;
  /** Chain time the view was computed at (latest block timestamp). */
  chainTime: number;
  blockNumber: bigint;
  decision?: Decision;
  yt?: { address: Address; totalSupply?: bigint };
  market?: MarketPool;
  /** CCIP sender's configured cutoff for this report (0/undefined = remote stakes not configured). */
  remoteCutoff?: number;
  /** Fixture or accelerated demo times: show the "Demo clock" label. */
  demoClock?: boolean;
  /**
   * V2: the deployed vault serves this report (vault.reportId() == id). False means the report is
   * published in the registry but no market (vault, YT, hook, sender) exists for it. V1/fixture: true.
   */
  series?: boolean;
  /** V2 StakeReceiptREP address (vault.rep()). */
  rep?: Address;
  /** V2: vault.principalAvailable(), set at finalization (0 before). */
  principalAvailable?: bigint;
  /** V2: principal a finalization now would see: min(vault dUSD − REP supply, totalYes + totalNo). */
  projectedPrincipal?: bigint;
  /** V2: vault.feeClaimed(). */
  feeClaimed?: boolean;
  /** V2: vault.treasury() (receives claimFee). */
  treasury?: Address;
  /** V2: CCIPStakeReceiverV2.recoveryOperator(). */
  recoveryOperator?: Address;
  /** V2 report #1 carries demo reportHash/claimHash that no backend research report links to. */
  demoReport?: boolean;
  /** Latest Arbitrum Sepolia block time: the clock CCIPStakeSenderV2 checks the cutoff against. */
  remoteChainTime?: number;
  /** Why the Arbitrum Sepolia reads failed, if they did (Sepolia data is still shown). */
  remoteError?: string;
}

export interface MarketPool {
  hook: Address;
  router?: Address;
  poolKey?: PoolKey;
  /** dUSD per YT, 1e18-scaled. */
  spotPriceWad?: bigint;
  /** V2 curve only. */
  impliedRateWad?: bigint;
  timeRemainingWad?: bigint;
  reserves?: { usdc: bigint; yt: bigint };
  feePips?: number;
  maturity: number;
  configured: boolean;
  /** V2: RF-YLP share token and supply, LP yield index. */
  shares?: Address;
  sharesSupply?: bigint;
  lpYieldPerShare?: bigint;
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/**
 * sent: source tx confirmed, CCIP hasn't reported progress · in_transit: CCIP is verifying/executing ·
 * failed: CCIP reports a failed execution (an operator can retry manually) · delivered: the receiver
 * marked it delivered but the outcome event isn't confirmed yet (not a vote by itself) ·
 * credited: counted as a vote · deferred_as_rep: arrived too late, became REP for the source payer ·
 * held: not counted, funds recoverable · recovered: held funds returned.
 */
export type CcipStatus = 'sent' | 'in_transit' | 'failed' | 'delivered' | 'credited' | 'deferred_as_rep' | 'held' | 'recovered';

export interface CcipStake {
  messageId: Hex;
  reportId: bigint;
  yes: boolean;
  amount: bigint;
  recipient: Address;
  /** V2: the Arbitrum payer (owns nonces, receives REP on late delivery, recovers held funds). */
  sourceAccount?: Address;
  sourceTx?: Hex;
  sentAt?: number;
  status: CcipStatus;
  destTx?: Hex;
  /** Held only: who may call recover (zero address = operator only). */
  recoveryRecipient?: Address;
  recoverable?: bigint;
  /** V2: CCIPStakeReceiverV2.recoveryOperator(). */
  recoveryOperator?: Address;
  /** Raw CCIP API status (SENT, VERIFYING, SUCCESS, FAILED, …) when the API answered. */
  ccipApiStatus?: string;
  /** The CCIP API couldn't be reached (CORS, network): only the explorer link is offered. */
  ccipApiUnavailable?: boolean;
  readyForManualExecution?: boolean;
  /** CCIPStakeReceiverV2.delivered(messageId). Delivery alone is not a vote. */
  delivered?: boolean;
  /** Credited: fresh vault.positionOf(recipient, yes) and YT balance; "Voted" shows only with these. */
  refreshed?: { position: bigint; yt: bigint; blockNumber: bigint };
  /** DeferredAsREP: the source payer's REP balance on Ethereum Sepolia. */
  repBalance?: bigint;
  /** Delivered, but no outcome event was found in the bounded log window. */
  outcomeUnknown?: boolean;
}

export interface PositionView {
  yes: bigint;
  no: bigint;
  yt: bigint;
  ytClaimable: bigint;
  lpShares: bigint;
  lpClaimable: bigint;
  pendingCcip: CcipStake[];
  /** Expected payout for all positions if final (scaled by available principal where known). */
  redeemable?: bigint;
  /** V1 only: World ID reputation badge (Reputation.hasBadge). Unrelated to the V2 REP receipt. */
  reputationBadge: boolean;
  /** V2 REP: StakeReceiptREP balance, a 1:1 receipt for dUSD deposited but not yet staked. */
  repReceipt: bigint;
  dusdBalance: bigint;
  /** dUSD allowance to the vault (V2) / VoteMarket (V1). */
  allowance: bigint;
  /** Arbitrum Sepolia balances for the CCIP sender (when configured). */
  remote?: { dusdBalance: bigint; allowance: bigint; ethBalance: bigint };
  /** V1 ERC-1155 positions are transferable; V2 positions are not (YT is). */
  transferable: boolean;
  /** V2: RF-YLP supply, for the LP share of reserves. */
  lpSupply?: bigint;
}

export interface ContractCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export interface TxStep {
  label: string;
  chainId: number;
  /** Real transaction (undefined for fixture steps). */
  request?: ContractCall;
  /**
   * Rebuilds the request right before the wallet prompt, after earlier steps confirmed: fresh quote,
   * fee or nonce. Throw ProtocolRevert to stop the plan without sending.
   */
  prepare?: () => Promise<ContractCall>;
  /** Step-specific effects decoded from the receipt logs (merged with the generic decoder). */
  decode?: (logs: Log[]) => TxEffect;
  /** Fixture-mode effect; throw ProtocolRevert to simulate a revert. Returns event data. */
  fixture?: () => TxEffect | void;
}
export type TxPlan = TxStep[];

/** Data the UI shows after a plan runs (decoded from logs, or returned by the fixture). */
export interface TxEffect {
  messageId?: Hex;
  /** CCIPStakeSenderV2.Sent, decoded from the source receipt. */
  sent?: { messageId: Hex; sourceAccount: Address; reportId: bigint; recipient: Address; yes: boolean; amount: bigint };
  /** Swapped.amountOut, or StakedAndSold.usdcReceived. */
  amountOut?: bigint;
  /** PrincipalClaimed.paid, or dUSD received from a yield claim. */
  paid?: bigint;
  /** RiskFiStakeVaultV2.Staked (the YT minted equals the amount). */
  staked?: { owner: Address; yes: boolean; amount: bigint; ytReceiver: Address };
  /** YieldCurveHookV2.LiquidityAdded shares. */
  lpMinted?: bigint;
  /** YieldCurveHookV2.LiquidityRemoved. */
  lpRemoved?: { usdc: bigint; yt: bigint };
}

export class ProtocolRevert extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'ProtocolRevert';
  }
}

export interface QuoteYT {
  out: bigint;
  /** dUSD per YT, 1e18-scaled (spot before the trade). */
  price?: bigint;
}

/** One CCIP send attempt: the nonce and deadline stay the same from quote to send. */
export interface RemoteAttempt {
  nonce: bigint;
  /** uint64 unix seconds; the receiver credits only while now <= deadline (and before lock). */
  deadline: bigint;
  /** Ethereum Sepolia wallet that receives the position and YT. */
  recipient: Address;
}

export interface RemoteStakeQuote {
  fee: bigint;
  deadline: number;
  /** min(sender.reportCutoff, registry crossChainCutoff); sends must happen strictly before it. */
  cutoff: number;
  /** V2: the exact intent quoted (same nonce and deadline as the send). */
  intent?: unknown;
  /** V2: sender.usedNonce(account, nonce) at quote time. */
  nonceUsed?: boolean;
  /** V2: Arbitrum Sepolia block time at quote time. */
  remoteChainTime?: number;
}

export interface ReputationBadgeAuthorization {
  reportId: string;
  recipient: Address;
  scopedNullifier: Hex;
  nonce: string;
  expiry: number;
  signature: Hex;
}

export interface ApproveOpts {
  /** Approve maxUint256 instead of the exact amount (off by default). */
  unlimited?: boolean;
}

export interface Trade {
  usdcIn: boolean;
  amountIn: bigint;
  amountOut: bigint;
  rateWad?: bigint;
  blockNumber: bigint;
  timestamp?: number;
  tx: Hex;
}

export interface Protocol {
  kind: 'v1' | 'v2' | 'fixture';
  /** Addresses the UI may show (token address for "Add to wallet", etc.). */
  dusd?: Address;
  listPublished(): Promise<bigint[]>;
  getMarket(id: bigint): Promise<MarketView>;
  getPosition(id: bigint, account: Address): Promise<PositionView>;
  stakeLocal(id: bigint, yes: boolean, amount: bigint, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  quoteRemote?(id: bigint, yes: boolean, amount: bigint, account: Address, attempt?: RemoteAttempt): Promise<RemoteStakeQuote>;
  stakeRemote?(id: bigint, yes: boolean, amount: bigint, account: Address, attempt?: RemoteAttempt, opts?: ApproveOpts): Promise<TxPlan>;
  quoteYT(id: bigint, dir: 'buy' | 'sell', amount: bigint): Promise<QuoteYT>;
  swapYT(id: bigint, dir: 'buy' | 'sell', amount: bigint, minOut: bigint, deadline: number, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  stakeAndSell?(id: bigint, yes: boolean, amount: bigint, minUsdcOut: bigint, deadline: number, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  quoteStakeAndSell?(amount: bigint): Promise<bigint>;
  challenge(id: bigint, evidenceHash: Hex): Promise<TxPlan>;
  finalize(id: bigint): Promise<TxPlan>;
  /** V1 Settlement.redeemVPT / V2 vault.claimPrincipal. */
  redeem(id: bigint, yes: boolean, amount: bigint): Promise<TxPlan>;
  claimYield(id: bigint, account: Address): Promise<TxPlan>;
  claimLPYield?(id: bigint, account?: Address): Promise<TxPlan>;
  /** V1 only: World ID reputation badge. */
  claimReputationBadge?(auth: ReputationBadgeAuthorization): Promise<TxPlan>;
  recoverCcip?(messageId: Hex, to: Address): Promise<TxPlan>;
  trackCcip(messageId: Hex): Promise<CcipStake | undefined>;
  /** Total YT bought + sold (from Swapped events); undefined when no market exists. */
  ytVolume?(): Promise<bigint | undefined>;
  /** Latest chain timestamp, used for countdowns that must not use the local clock. */
  chainTime(): Promise<number>;

  // V2 only ------------------------------------------------------------------------------------
  /** vault.deposit(amount, account): dUSD in, REP out 1:1. */
  depositRep?(amount: bigint, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  /** vault.stakeFromREP: burns the caller's REP, opens the position and mints YT. No REP approval. */
  stakeFromRep?(id: bigint, yes: boolean, amount: bigint, account: Address): Promise<TxPlan>;
  /** vault.withdraw(amount): burns REP, returns dUSD. Any time. */
  withdrawRep?(amount: bigint, account: Address): Promise<TxPlan>;
  transferRep?(to: Address, amount: bigint, account: Address): Promise<TxPlan>;
  transferYt?(to: Address, amount: bigint, account: Address): Promise<TxPlan>;
  addLiquidity?(usdcAmount: bigint, ytAmount: bigint, minShares: bigint, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  removeLiquidity?(shares: bigint, minUsdc: bigint, minYt: bigint, account: Address): Promise<TxPlan>;
  propose?(id: bigint, outcome: Outcome, evidenceHash: Hex): Promise<TxPlan>;
  adjudicate?(id: bigint, outcome: Outcome, evidenceHash: Hex): Promise<TxPlan>;
  injectYield?(id: bigint, amount: bigint, account: Address, opts?: ApproveOpts): Promise<TxPlan>;
  claimFee?(id: bigint): Promise<TxPlan>;
  recentTrades?(): Promise<Trade[]>;
}
