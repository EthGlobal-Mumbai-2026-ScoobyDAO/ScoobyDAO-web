import { describe, expect, it } from 'vitest';
import type { MarketView, PositionView } from '@/protocol';
import { summarize } from './summarize';

const pos = (o: Partial<PositionView>) => ({ yes: 0n, no: 0n, yt: 0n, ytClaimable: 0n, lpShares: 0n, lpClaimable: 0n, repReceipt: 0n, ...o }) as PositionView;

describe('positions summary tiles', () => {
  it('adds stakes, YT and REP across markets; claimable only where claims are open', () => {
    const open = { chainTime: 100, totals: { yes: 80_000_000n, no: 20_000_000n }, decision: { outcome: 'yes', finalizedAt: 50, proposedAt: 1, challenged: false, evidenceHash: '0x' } } as unknown as MarketView;
    const pending = { chainTime: 100, totals: { yes: 1n, no: 1n } } as MarketView;
    const t = summarize([
      { market: open, pos: pos({ yes: 10_000_000n, yt: 10_000_000n, ytClaimable: 5n }) },
      { market: pending, pos: pos({ no: 3_000_000n, repReceipt: 2_000_000n, lpClaimable: 1n }) },
    ]);
    expect(t.staked).toBe(13_000_000n);
    expect(t.yt).toBe(10_000_000n);
    expect(t.rep).toBe(2_000_000n);
    // 10 Yes → 10 + 10 × 16/80 = 12 dUSD, plus 5 + 1 units of yield.
    expect(t.claimable).toBe(12_000_000n + 6n);
  });
});
