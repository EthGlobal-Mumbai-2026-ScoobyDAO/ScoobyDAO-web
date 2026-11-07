import { describe, expect, it } from 'vitest';
import type { MarketView, Phase } from '@/protocol';
import { PHASE_LINE, primaryAction } from './primaryAction';

const m = (phase: Phase, o: Partial<MarketView> = {}) => ({ phase, maturity: 3000, series: true, ...o }) as MarketView;

describe('primaryAction: one CTA by phase', () => {
  it('Stake → Trade YT → View result → Claim', () => {
    expect(primaryAction(m('open'), 0)?.tab).toBe('stake');
    expect(primaryAction(m('open_local_only'), 0)?.tab).toBe('stake');
    expect(primaryAction(m('locked'), 2500)).toEqual({ tab: 'market', label: 'Trade YT' });
    expect(primaryAction(m('locked'), 3000)?.label).toBe('View result');
    expect(primaryAction(m('matured'), 3100)?.label).toBe('View result');
    expect(primaryAction(m('proposed'), 3100)?.tab).toBe('result');
    for (const p of ['final_yes', 'final_no', 'void'] as const) expect(primaryAction(m(p), 9e9)).toEqual({ tab: 'result', label: 'Claim' });
  });
  it('offers nothing without a deployed market', () => {
    expect(primaryAction(m('open', { series: false }), 0)).toBeNull();
  });
  it('keeps "Unmasked!" out of the phase lines', () => {
    expect(Object.values(PHASE_LINE).join(' ')).not.toMatch(/unmasked/i);
  });
});
