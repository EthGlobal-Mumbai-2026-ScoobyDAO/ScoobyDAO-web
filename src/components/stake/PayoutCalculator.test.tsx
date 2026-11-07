import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatUsdc } from '@/lib/format';
import { previewStake } from '@/lib/payout';
import { PayoutCalculator } from './PayoutCalculator';
import { SidePicker, sideShare } from './SidePicker';
import { TotalsCard } from './TotalsCard';
import type { MarketView } from '@/protocol';

const totals = { yes: 80_000_000n, no: 20_000_000n };

describe('PayoutCalculator', () => {
  it('shows payout if Yes wins and if No wins with the contract math', () => {
    const html = renderToStaticMarkup(<PayoutCalculator totals={totals} />);
    const p = previewStake(totals, 'yes', 10_000_000n);
    expect(html).toContain('If Yes wins');
    expect(html).toContain('If No wins');
    expect(html).toContain(formatUsdc(p.ifYes, { exact: true }));
    expect(html).toContain('0.000000');
    expect(html).toContain('80% of the losing pool');
  });
  it('flags a simulated loss when principal is short', () => {
    expect(renderToStaticMarkup(<PayoutCalculator totals={totals} projectedPrincipal={50_000_000n} />)).toContain('simulated loss');
  });
});

describe('SidePicker', () => {
  it('shows the live share of stakes per side (not a probability)', () => {
    expect(sideShare(totals, 'yes')).toBe(80);
    expect(sideShare(totals, 'no')).toBe(20);
    expect(sideShare({ yes: 0n, no: 0n }, 'yes')).toBeUndefined();
    const html = renderToStaticMarkup(<SidePicker value="yes" onChange={() => {}} totals={totals} />);
    expect(html).toContain('80%');
    expect(html).toContain('of stakes');
    expect(html).not.toMatch(/probab/i);
  });
});

describe('TotalsCard', () => {
  it('replaces the payout paragraph with three short rules', () => {
    const html = renderToStaticMarkup(<TotalsCard market={{ totals } as MarketView} />);
    expect(html).toContain('id="how-payouts-work"');
    expect(html).toContain('stake back + 80% of the losing pool');
    expect(html).toContain('stakes back, no fee');
  });
});
