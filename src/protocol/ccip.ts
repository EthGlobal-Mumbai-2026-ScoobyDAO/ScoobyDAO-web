import { concatHex, encodeAbiParameters, isAddressEqual, numberToHex, parseEventLogs, zeroAddress, type Address, type Hex, type Log } from 'viem';
import { ccipStakeReceiverV2Abi, ccipStakeSenderV2Abi } from '@/contracts/v2';
import type { CcipStake, CcipStatus, RemoteAttempt } from './types';

// Cross-chain stake helpers. Shapes come from the contracts and the V2 handoff bundle, not memory:
//   src/ccip/StakeIntent.sol   (V1): (uint256 protocolVersion, uint256 reportId, bool yes,
//                                     address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)
//   src/v2/StakeIntentV2.sol   (V2): (uint8 protocolVersion, uint256 reportId, bool yes, address sourceAccount,
//                                     address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)
// extraArgs: ExtraArgsCodec._getBasicEncodedExtraArgsV3(gasLimit, bytes4(0)), the packed
// GENERIC_EXTRA_ARGS_V3_TAG (0xa69dd4aa) ‖ uint32 gasLimit ‖ bytes4 finality ‖ bytes7(0). The bundle's
// FRONTEND_INTEGRATION_PLAN.md gives the same byte layout. Not abi.encode.

export interface StakeIntentV1 {
  protocolVersion: bigint;
  reportId: bigint;
  yes: boolean;
  recipient: Address;
  nonce: bigint;
  deadline: bigint;
  minAmount: bigint;
}
export interface StakeIntentV2 {
  protocolVersion: number;
  reportId: bigint;
  yes: boolean;
  sourceAccount: Address;
  recipient: Address;
  nonce: bigint;
  deadline: bigint;
  minAmount: bigint;
}

/** StakeIntentV2 tuple order in CCIPStakeSenderV2.json (stakeRemote/quoteFee input 0). */
export const STAKE_INTENT_V2_FIELDS = ['protocolVersion', 'reportId', 'yes', 'sourceAccount', 'recipient', 'nonce', 'deadline', 'minAmount'] as const;

export const GENERIC_EXTRA_ARGS_V3_TAG: Hex = '0xa69dd4aa';
/**
 * Receiver callback gas. The live demo's first delivery failed with an empty ReceiverError at the
 * old 500,000 limit and needed a manual 1,500,000 retry; the bundle's post-test default is 1,500,000.
 */
export const CCIP_GAS_LIMIT = 1_500_000;

export function basicExtraArgsV3(gasLimit = CCIP_GAS_LIMIT, finality: Hex = '0x00000000'): Hex {
  return concatHex([GENERIC_EXTRA_ARGS_V3_TAG, numberToHex(gasLimit, { size: 4 }), finality, '0x00000000000000']);
}

/** Random 128-bit nonce; usedNonce[sourceAccount][nonce] only has to be unused for this payer. */
export function randomNonce(): bigint {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return BigInt(`0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`);
}

/**
 * Returns `first` if it's unused, else fresh random nonces until one is unused
 * (sender.usedNonce(account, nonce) on Arbitrum Sepolia). Throws after `maxTries`.
 */
export async function unusedNonce(
  isUsed: (nonce: bigint) => Promise<boolean>,
  first?: bigint,
  gen: () => bigint = randomNonce,
  maxTries = 5,
): Promise<bigint> {
  let nonce = first ?? gen();
  for (let i = 0; i < maxTries; i++) {
    if (!(await isUsed(nonce))) return nonce;
    nonce = gen();
  }
  throw new Error('Could not find an unused CCIP nonce; try again.');
}

/**
 * The receiver credits only if delivery happens at or before `deadline` and before lockTime,
 * so the deadline is the last second a credit can still count.
 */
export function intentDeadline(lockTime: number): bigint {
  return BigInt(lockTime - 1);
}

/** One send attempt: a fresh nonce and the deadline, kept identical from the quote to the send. */
export function newRemoteAttempt(p: { lockTime: number; recipient: Address; nonce?: bigint }): RemoteAttempt {
  return { nonce: p.nonce ?? randomNonce(), deadline: intentDeadline(p.lockTime), recipient: p.recipient };
}

export function buildIntentV1(p: { reportId: bigint; yes: boolean; recipient: Address; amount: bigint; lockTime: number; nonce?: bigint }): StakeIntentV1 {
  return {
    protocolVersion: 1n,
    reportId: p.reportId,
    yes: p.yes,
    recipient: p.recipient,
    nonce: p.nonce ?? randomNonce(),
    deadline: intentDeadline(p.lockTime),
    // BurnMint pools move the exact amount, so the minimum delivered equals the amount sent.
    minAmount: p.amount,
  };
}

/**
 * StakeIntentV2 in tuple order. sourceAccount must be the sending wallet (stakeRemote checks
 * intent.sourceAccount == msg.sender); recipient is the Ethereum Sepolia wallet that gets the
 * position and YT. minAmount = amount: the BurnMint pools move exact amounts.
 */
export function buildIntentV2(p: {
  reportId: bigint;
  yes: boolean;
  sourceAccount: Address;
  recipient: Address;
  nonce: bigint;
  deadline: bigint;
  amount: bigint;
}): StakeIntentV2 {
  return {
    protocolVersion: 2,
    reportId: p.reportId,
    yes: p.yes,
    sourceAccount: p.sourceAccount,
    recipient: p.recipient,
    nonce: p.nonce,
    deadline: p.deadline,
    minAmount: p.amount,
  };
}

/** abi.encode(intent), what the receiver decodes (useful for tests and debugging). */
export const encodeIntentV1 = (i: StakeIntentV1) =>
  encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'protocolVersion', type: 'uint256' },
          { name: 'reportId', type: 'uint256' },
          { name: 'yes', type: 'bool' },
          { name: 'recipient', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'minAmount', type: 'uint256' },
        ],
      },
    ],
    [i],
  );

/** Fee buffer: stakeRemote refunds msg.value - fee, so over-paying is safe. */
export const withFeeBuffer = (fee: bigint) => fee + fee / 10n;

// ------------------------------------------------------------------ V2 event decoding

export interface SentEvent {
  messageId: Hex;
  sourceAccount: Address;
  reportId: bigint;
  recipient: Address;
  yes: boolean;
  amount: bigint;
  tx?: Hex;
}

/** CCIPStakeSenderV2.Sent from a source receipt (wallet writes don't return values). */
export function decodeSent(logs: Log[], sender: Address, messageId?: Hex): SentEvent | undefined {
  const parsed = parseEventLogs({ abi: ccipStakeSenderV2Abi, eventName: 'Sent', logs, strict: true }).filter(
    (l) => isAddressEqual(l.address, sender) && (!messageId || l.args.messageId.toLowerCase() === messageId.toLowerCase()),
  );
  const e = parsed.at(-1);
  return e ? { ...e.args, tx: e.transactionHash ?? undefined } : undefined;
}

export type ReceiverOutcome =
  | { kind: 'credited'; reportId: bigint; recipient: Address; amount: bigint; tx?: Hex }
  | { kind: 'deferred'; sourceAccount: Address; amount: bigint; tx?: Hex }
  | { kind: 'held'; sourceAccount: Address; amount: bigint; tx?: Hex };

/** Credited / DeferredAsREP / Held (+ Recovered) for one message, from destination logs. */
export function decodeReceiverOutcome(
  logs: Log[],
  receiver: Address,
  messageId: Hex,
): { outcome?: ReceiverOutcome; recovered?: { to: Address; amount: bigint; tx?: Hex } } {
  const mine = parseEventLogs({ abi: ccipStakeReceiverV2Abi, logs, strict: true }).filter(
    (l) => isAddressEqual(l.address, receiver) && 'messageId' in l.args && (l.args.messageId as Hex).toLowerCase() === messageId.toLowerCase(),
  );
  let outcome: ReceiverOutcome | undefined;
  let recovered: { to: Address; amount: bigint; tx?: Hex } | undefined;
  for (const l of mine) {
    const tx = l.transactionHash ?? undefined;
    if (l.eventName === 'Credited') outcome = { kind: 'credited', reportId: l.args.reportId, recipient: l.args.recipient, amount: l.args.amount, tx };
    if (l.eventName === 'DeferredAsREP') outcome = { kind: 'deferred', sourceAccount: l.args.sourceAccount, amount: l.args.amount, tx };
    if (l.eventName === 'Held') outcome = { kind: 'held', sourceAccount: l.args.sourceAccount, amount: l.args.amount, tx };
    if (l.eventName === 'Recovered') recovered = { to: l.args.to, amount: l.args.amount, tx };
  }
  return { outcome, recovered };
}

export interface V2CcipSignals {
  /** The source receipt confirmed (or Sent was decoded). */
  sourceConfirmed: boolean;
  /** CCIP API status string; 'unavailable' when the API couldn't be reached; undefined when not indexed yet. */
  api?: string | 'unavailable';
  /** CCIPStakeReceiverV2.delivered(messageId). */
  delivered: boolean;
  outcome?: ReceiverOutcome['kind'];
  recoverable?: bigint;
  recoverySourceAccount?: Address;
}

/**
 * Lifecycle for V2. Delivery alone is never a vote: only a Credited event is. Held funds count as
 * recovered once recoverable(messageId) is back to 0 (only recover() clears it).
 */
export function deriveV2CcipStatus(s: V2CcipSignals): CcipStatus {
  const recoverable = s.recoverable ?? 0n;
  const wasHeld = s.outcome === 'held' || (s.delivered && !s.outcome && !!s.recoverySourceAccount && s.recoverySourceAccount !== zeroAddress);
  if (s.delivered && recoverable > 0n) return 'held';
  if (wasHeld) return 'recovered';
  if (s.outcome === 'deferred') return 'deferred_as_rep';
  if (s.outcome === 'credited') return 'credited';
  if (s.delivered) return 'delivered';
  const api = typeof s.api === 'string' && s.api !== 'unavailable' ? s.api.toUpperCase() : undefined;
  if (api === 'FAILED') return 'failed';
  if (api && api !== 'SENT') return 'in_transit';
  return 'sent';
}

// ---------------------------------------------------------------- tracker state (V1)

export interface CcipLogs {
  sent?: { tx: Hex; at?: number };
  credited?: { tx: Hex };
  held?: { tx: Hex };
  recovered?: { tx: Hex };
}

/** Minutes after which an undelivered message is flagged as slow (testnet lanes are often 20+ min). */
export const CCIP_SLOW_MINUTES = 30;

/** V1 and fixture lifecycle from logs (V1 has no deferred-as-REP path). */
export function ccipStatus(logs: CcipLogs): CcipStatus {
  if (logs.recovered) return 'recovered';
  if (logs.held) return 'held';
  if (logs.credited) return 'credited';
  if (logs.sent) return 'in_transit';
  return 'sent';
}

export function isSlow(logs: CcipLogs, now: number): boolean {
  return ccipStatus(logs) === 'in_transit' && !!logs.sent?.at && now - logs.sent.at > CCIP_SLOW_MINUTES * 60;
}

/** Still moving toward a final state; the tracker keeps polling. */
export const ccipPending = (s: CcipStake | undefined) =>
  !s || s.status === 'sent' || s.status === 'in_transit' || s.status === 'delivered' || s.status === 'failed';

/** Sent or in transit for longer than CCIP_SLOW_MINUTES. */
export const isSlowStake = (s: Pick<CcipStake, 'status' | 'sentAt'>, now: number) =>
  (s.status === 'sent' || s.status === 'in_transit') && !!s.sentAt && now - s.sentAt > CCIP_SLOW_MINUTES * 60;

// ------------------------------------------------------ local tracking (UX only)

const KEY = 'unmasked:ccip';
export interface TrackedCcip {
  messageId: Hex;
  reportId: string;
  side: 'yes' | 'no';
  amount: string;
  sourceTx?: Hex;
  recipient?: Address;
  sourceAccount?: Address;
  savedAt: number;
}

/** Chain state and the CCIP API are the source of truth; this list only remembers which messages to look up. */
export function loadTracked(): TrackedCcip[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as TrackedCcip[]) : [];
  } catch {
    return [];
  }
}

export function saveTracked(t: TrackedCcip): void {
  try {
    const all = loadTracked().filter((x) => x.messageId !== t.messageId);
    window.localStorage.setItem(KEY, JSON.stringify([t, ...all].slice(0, 50)));
  } catch {
    /* storage unavailable: the tracker link still works */
  }
  trackedListeners.forEach((l) => l());
}

// Same-tab subscribers (the 'storage' event only fires in other tabs).
const trackedListeners = new Set<() => void>();
export function subscribeTracked(cb: () => void): () => void {
  trackedListeners.add(cb);
  if (typeof window !== 'undefined') window.addEventListener('storage', cb);
  return () => {
    trackedListeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb);
  };
}
/** Raw stored list, for useSyncExternalStore (stable string snapshot). */
export function trackedSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}
