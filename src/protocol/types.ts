import type { Abi, Address, Hex } from 'viem';

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
  /** Proposed outcome (Settlement.Decision.proposed); undefined before a proposal. */
  proposed?: Outcome;
  /** Settlement.Decision.finalOutcome; undefined until finalized. */
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
  /** VoteMarket.locked(id): lock() has moved the stakes into the yield splitter. */
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
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export type CcipStatus = 'sent' | 'in_transit' | 'credited' | 'held' | 'recovered';

export interface CcipStake {
  messageId: Hex;
  reportId: bigint;
  yes: boolean;
  amount: bigint;
  recipient: Address;
  sourceTx?: Hex;
  sentAt?: number;
  status: CcipStatus;
  destTx?: Hex;
  /** Held only: who may call recover (zero address = operator only). */
  recoveryRecipient?: Address;
  recoverable?: bigint;
}

export interface PositionView {
  yes: bigint;
  no: bigint;
  yt: bigint;
  ytClaimable: bigint;
  lpShares: bigint;
  lpClaimable: bigint;
  pendingCcip: CcipStake[];
  /** Expected payout for all positions if final (nominal, before pro-rata principal scaling). */
  redeemable?: bigint;
  repBadge: boolean;
  dusdBalance: bigint;
  allowance: bigint;
  /** Allowance of dUSD on Arbitrum Sepolia for the CCIP sender (when configured). */
  remote?: { dusdBalance: bigint; allowance: bigint; ethBalance: bigint };
  /** V2 positions are non-transferable. */
  transferable: boolean;
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
  /** Fixture-mode effect; throw ProtocolRevert to simulate a revert. Returns event data. */
  fixture?: () => TxEffect | void;
}
export type TxPlan = TxStep[];

/** Data the UI shows after a plan runs (decoded from logs, or returned by the fixture). */
export interface TxEffect {
  messageId?: Hex;
  amountOut?: bigint;
  paid?: bigint;
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

export interface RemoteStakeQuote {
  fee: bigint;
  deadline: number;
  cutoff: number;
}

export interface RepAuthorization {
  reportId: string;
  recipient: Address;
  scopedNullifier: Hex;
  nonce: string;
  expiry: number;
  signature: Hex;
}

export interface Protocol {
  kind: 'v1' | 'v2' | 'fixture';
  /** Addresses the UI may show (token address for "Add to wallet", etc.). */
  dusd?: Address;
  listPublished(): Promise<bigint[]>;
  getMarket(id: bigint): Promise<MarketView>;
  getPosition(id: bigint, account: Address): Promise<PositionView>;
  stakeLocal(id: bigint, yes: boolean, amount: bigint, account: Address): Promise<TxPlan>;
  quoteRemote?(id: bigint, yes: boolean, amount: bigint, account: Address): Promise<RemoteStakeQuote>;
  stakeRemote?(id: bigint, yes: boolean, amount: bigint, account: Address): Promise<TxPlan>;
  quoteYT(id: bigint, dir: 'buy' | 'sell', amount: bigint): Promise<QuoteYT>;
  swapYT(id: bigint, dir: 'buy' | 'sell', amount: bigint, minOut: bigint, deadline: number, account: Address): Promise<TxPlan>;
  stakeAndSell?(id: bigint, yes: boolean, amount: bigint, minUsdcOut: bigint, deadline: number, account: Address): Promise<TxPlan>;
  quoteStakeAndSell?(amount: bigint): Promise<bigint>;
  challenge(id: bigint, evidenceHash: Hex): Promise<TxPlan>;
  finalize(id: bigint): Promise<TxPlan>;
  redeem(id: bigint, yes: boolean, amount: bigint): Promise<TxPlan>;
  claimYield(id: bigint, account: Address): Promise<TxPlan>;
  claimLPYield?(id: bigint): Promise<TxPlan>;
  claimRep?(auth: RepAuthorization): Promise<TxPlan>;
  recoverCcip?(messageId: Hex, to: Address): Promise<TxPlan>;
  trackCcip(messageId: Hex): Promise<CcipStake | undefined>;
  /** Total YT bought + sold (from Swapped events); undefined when no market exists. */
  ytVolume?(): Promise<bigint | undefined>;
  /** Latest chain timestamp, used for countdowns that must not use the local clock. */
  chainTime(): Promise<number>;
}
