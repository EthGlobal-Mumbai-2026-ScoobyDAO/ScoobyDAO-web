import { concatHex, encodeAbiParameters, numberToHex, type Address, type Hex } from 'viem';
import type { CcipStake, CcipStatus } from './types';

// Cross-chain stake helpers. Shapes come from the contracts, not memory:
//   src/ccip/StakeIntent.sol   (V1): (uint256 protocolVersion, uint256 reportId, bool yes,
//                                     address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)
//   src/v2/StakeIntentV2.sol   (V2): (uint8 protocolVersion, uint256 reportId, bool yes, address sourceAccount,
//                                     address recipient, uint256 nonce, uint64 deadline, uint256 minAmount)
// extraArgs: script/PreflightSource.s.sol uses ExtraArgsCodec._getBasicEncodedExtraArgsV3(500_000, bytes4(0)),
// which is abi.encodePacked(GENERIC_EXTRA_ARGS_V3_TAG = 0xa69dd4aa, uint32 gasLimit, bytes4 finality, bytes7(0)).
// The Foundry tests pass "" (mock router); the live lane fee quote was taken with the V3 args.

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

export const GENERIC_EXTRA_ARGS_V3_TAG: Hex = '0xa69dd4aa';
export const CCIP_GAS_LIMIT = 500_000;

export function basicExtraArgsV3(gasLimit = CCIP_GAS_LIMIT, finality: Hex = '0x00000000'): Hex {
  return concatHex([
    GENERIC_EXTRA_ARGS_V3_TAG,
    numberToHex(gasLimit, { size: 4 }),
    finality,
    '0x00000000000000',
  ]);
}

/** Random 128-bit nonce; usedNonce[msg.sender][nonce] only has to be unused for this sender. */
export function randomNonce(): bigint {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return BigInt(`0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`);
}

/**
 * The receiver credits only if delivery happens at or before `deadline` and before lockTime,
 * so the deadline is the last second a credit can still count.
 */
export function intentDeadline(lockTime: number): bigint {
  return BigInt(lockTime - 1);
}

export function buildIntentV1(p: {
  reportId: bigint;
  yes: boolean;
  recipient: Address;
  amount: bigint;
  lockTime: number;
  nonce?: bigint;
}): StakeIntentV1 {
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

export function buildIntentV2(p: {
  reportId: bigint;
  yes: boolean;
  account: Address;
  amount: bigint;
  lockTime: number;
  nonce?: bigint;
}): StakeIntentV2 {
  return {
    protocolVersion: 2,
    reportId: p.reportId,
    yes: p.yes,
    sourceAccount: p.account,
    recipient: p.account,
    nonce: p.nonce ?? randomNonce(),
    deadline: intentDeadline(p.lockTime),
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

// ---------------------------------------------------------------- tracker state

export interface CcipLogs {
  sent?: { tx: Hex; at?: number };
  credited?: { tx: Hex };
  held?: { tx: Hex };
  recovered?: { tx: Hex };
}

/** Minutes after which an undelivered message is flagged as slow (testnet lanes are often 20+ min). */
export const CCIP_SLOW_MINUTES = 30;

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

export const ccipPending = (s: CcipStake | undefined) => !s || s.status === 'sent' || s.status === 'in_transit';

// ------------------------------------------------------ local tracking (UX only)

const KEY = 'unmasked:ccip';
export interface TrackedCcip {
  messageId: Hex;
  reportId: string;
  side: 'yes' | 'no';
  amount: string;
  sourceTx?: Hex;
  savedAt: number;
}

/** Event logs are the source of truth; this list only remembers which messages to look up. */
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
}
