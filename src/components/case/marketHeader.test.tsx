import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MarketView } from '@/protocol';
import type { WebReport } from '@/lib/types';
import { keyDates, nowPosition, KeyDates } from './KeyDates';
import { marketName, marketTitle, shortClaim } from './marketName';
import { linkCandidate } from './useLinkedReport';

const H = '0x' + 'ab'.repeat(32);
const m = (o: Partial<MarketView> = {}) =>
  ({
    reportId: 3n,
    crossChainCutoff: 1000,
    lockTime: 2000,
    maturity: 3000,
    resultDeadline: 4000,
    challengePeriod: 300,
    chainTime: 0,
    totals: { yes: 0n, no: 0n },
    phase: 'open',
    ...o,
  }) as MarketView;

describe('market names', () => {
  it('uses "Demo market #N", never the registry name', () => {
    expect(marketName({ id: 3n, deployment: 'flexible' })).toBe('Demo market #3');
    expect(marketName({ id: '1', deployment: 'original' })).toBe('Original demo #1');
    expect(marketName({ id: 3n })).not.toMatch(/registry/i);
  });
  it('shows "SYMBOL — short claim" for a linked report', () => {
    const linked = { claimManifest: { symbol: 'SHIB', claimText: 'SHIB falls more than eighty percent within thirty days of the report being published onchain' } } as WebReport;
    const name = marketName({ id: 3n, deployment: 'flexible', linked });
    expect(name.startsWith('SHIB — SHIB falls')).toBe(true);
    expect(name.endsWith('…')).toBe(true);
    expect(marketTitle({ id: 3n, linked })).toBe('SHIB');
    expect(shortClaim('  a   b ')).toBe('a b');
  });
});

describe('linkCandidate (backend report ↔ onchain market)', () => {
  const r = { id: 'r@1', onchainReportId: '3', claimHash: H, claimManifest: {} } as unknown as WebReport;
  it('needs the onchain id and the registry claim hash to match', () => {
    expect(linkCandidate([r], { key: 'k', id: '3', claimHash: H, linkable: true })).toBe(r);
    expect(linkCandidate([r], { key: 'k', id: '3', claimHash: '0x' + 'cd'.repeat(32), linkable: true })).toBeUndefined();
    expect(linkCandidate([r], { key: 'k', id: '4', claimHash: H, linkable: true })).toBeUndefined();
  });
  it('never links a pre-catalog demo report', () => {
    expect(linkCandidate([r], { key: 'k', id: '3', claimHash: H, linkable: false })).toBeUndefined();
  });
});

describe('KeyDates', () => {
  it('marks passed dates and the next one from chain time', () => {
    expect(keyDates(m(), 1500).map((d) => d.state)).toEqual(['passed', 'next', 'upcoming', 'upcoming']);
    expect(keyDates(m(), 5000).every((d) => d.state === 'passed')).toBe(true);
  });
  it('shows "Claims close" instead of "Result due" once final', () => {
    const final = m({ decision: { outcome: 'yes', finalizedAt: 3500, proposedAt: 3100, challenged: false, evidenceHash: '0x' } });
    expect(keyDates(final, 3600).at(-1)).toMatchObject({ key: 'claims', at: 3500 + 90 * 86400 });
  });
  it('places "now" between the last passed and the next date', () => {
    const d = keyDates(m(), 2500);
    expect(nowPosition(d, 2500)).toBeCloseTo(50, 5);
    expect(nowPosition(keyDates(m(), 0), 0)).toBeLessThan(12.5);
    expect(nowPosition(keyDates(m(), 9999), 9999)).toBeGreaterThan(87.5);
  });
  it('renders labels and a countdown for the next date', () => {
    const html = renderToStaticMarkup(<KeyDates market={m()} now={1500} />);
    expect(html).toContain('Stakes lock');
    expect(html).toContain('Trading ends');
    expect(html).toContain('(next)');
    expect(html).toContain('8m 20s');
  });
});
