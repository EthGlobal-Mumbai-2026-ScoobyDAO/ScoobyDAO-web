/**
 * Payout math from the contracts spec (ScoobyDAO-contracts CLAUDE.md §3.2), in 6-decimal base units.
 *   payout(s) = s + s * L * (10000 - f) / (10000 * W)
 *   one-sided (W == 0 || L == 0): refund(s) = s * (10000 - f) / 10000
 * Integer division matches Solidity's rounding down.
 */
export const BPS = 10_000n;

export function winningPayout(s: bigint, W: bigint, L: bigint, feeBps: bigint): bigint {
  if (s === 0n) return 0n;
  if (W === 0n || L === 0n) return refundPayout(s, feeBps);
  return s + (s * L * (BPS - feeBps)) / (BPS * W);
}

export function refundPayout(s: bigint, feeBps: bigint): bigint {
  return (s * (BPS - feeBps)) / BPS;
}

export type Outcome = 'For' | 'Against';

/** Pass ⇒ the claim held (For wins); Fail ⇒ cleared (Against wins). */
export function winnerOf(status: string): Outcome | null {
  if (status === 'ResolvedPass') return 'For';
  if (status === 'ResolvedFail') return 'Against';
  return null;
}
