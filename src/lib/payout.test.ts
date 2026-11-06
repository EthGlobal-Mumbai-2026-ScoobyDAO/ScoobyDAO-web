import { describe, expect, it } from 'vitest';
import { refundPayout, winningPayout } from './payout';

const U = 1_000_000n;

describe('winningPayout', () => {
  it('matches the 60/40 example from the contracts spec (≈1.6467 per share)', () => {
    expect(winningPayout(1n * U, 60n * U, 40n * U, 300n)).toBe(1_646_666n);
  });

  it('pays everything except the fee back across winners (no overpay)', () => {
    let seed = 7n;
    const rnd = (max: bigint) => (seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 63n) % max;
    for (let i = 0; i < 200; i++) {
      const stakes = Array.from({ length: Number(rnd(5n)) + 1 }, () => rnd(1_000_000n * U) + 1n);
      const W = stakes.reduce((a, b) => a + b, 0n);
      const L = rnd(1_000_000n * U) + 1n;
      const f = rnd(1001n);
      const paid = stakes.reduce((a, s) => a + winningPayout(s, W, L, f), 0n);
      const fee = (L * f) / 10_000n;
      expect(paid + fee <= W + L).toBe(true);
      expect(W + L - paid - fee).toBeLessThanOrEqual(BigInt(stakes.length) + 1n);
    }
  });

  it('falls back to a fee-only refund when one side is empty', () => {
    expect(winningPayout(10n * U, 10n * U, 0n, 300n)).toBe(9_700_000n);
    expect(refundPayout(10n * U, 300n)).toBe(9_700_000n);
  });
});
