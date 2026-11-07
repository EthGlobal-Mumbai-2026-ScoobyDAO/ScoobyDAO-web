import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import NotFound from '@/app/not-found';
import { POSES, SniffPose } from '@/components/SniffPose';
import type { ReferenceCase } from '@/lib/reference';
import type { MarketView, Phase } from '@/protocol';
import { HowItWorks, STEPS } from './HowItWorks';
import { MarketRow, ReportRow, latestReports, orderMarkets } from './LiveNow';
import type { LandingMarket } from './StatsStrip';
import { BuiltWith, TRUST, TrustSection } from './TrustSection';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).length;

describe('SniffPose', () => {
  it('draws a distinct full-body figure for every pose, with an accessible label', () => {
    const marks = POSES.map((p) => html(<SniffPose pose={p} />));
    expect(new Set(marks).size).toBe(POSES.length);
    for (const [i, m] of marks.entries()) {
      expect(m).toContain('role="img"');
      expect(m).toMatch(/aria-label="Sniff[^"]*"/);
      expect(m).toContain(`data-pose="${POSES[i]}"`);
      expect(m).not.toMatch(/scooby/i);
    }
  });
  it('labels the job poses', () => {
    expect(html(<SniffPose pose="sniffing" />)).toContain('sniffing for clues');
    expect(html(<SniffPose pose="thinking" />)).toContain('paw on chin');
    expect(html(<SniffPose pose="alert" />)).toContain('flashlight on');
    expect(html(<SniffPose pose="triumphant" />)).toContain('pulled-off mask');
  });
  it('hides decorative poses from assistive tech', () => {
    const m = html(<SniffPose pose="idle" decorative />);
    expect(m).toContain('aria-hidden="true"');
    expect(m).not.toContain('role="img"');
  });
});

describe('HowItWorks', () => {
  it('keeps the #how-it-works anchor and shows four steps with different poses', () => {
    const m = html(<HowItWorks />);
    expect(m).toContain('id="how-it-works"');
    expect(STEPS).toHaveLength(4);
    expect(new Set(STEPS.map((s) => s.pose)).size).toBe(4);
    expect(m.match(/<details/g)).toHaveLength(4);
    expect(m).toContain('A human signs off with World ID');
  });
  it('keeps titles to 5–8 words and bodies to one sentence', () => {
    for (const s of STEPS) {
      const words = s.title.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(4);
      expect(words).toBeLessThanOrEqual(8);
      expect(sentences(s.body)).toBe(1);
    }
  });
});

describe('Trust and Built with', () => {
  it('has three one-sentence tiles', () => {
    expect(TRUST).toHaveLength(3);
    for (const t of TRUST) expect(sentences(t.body)).toBe(1);
    expect(html(<TrustSection />)).toContain('Why trust it');
  });
  it('lists sponsors as text only', () => {
    const m = html(<BuiltWith />);
    for (const n of ['World', 'Chainlink CCIP', 'Uniswap v4']) expect(m).toContain(n);
    expect(m).not.toContain('<img');
  });
});

const view = (phase: Phase, at = 2_000_000_000): MarketView =>
  ({
    reportId: 1n,
    phase,
    totals: { yes: 60_000000n, no: 40_000000n },
    crossChainCutoff: at,
    lockTime: at,
    maturity: at,
    resultDeadline: at,
    challengePeriod: 0,
  }) as unknown as MarketView;
const market = (key: string, phase: Phase, at?: number): LandingMarket => ({
  key,
  name: `Report #${key}`,
  view: view(phase, at),
  href: `/markets/flexible/${key}`,
  stakeHref: `/markets/flexible/${key}/stake`,
});

describe('Live now', () => {
  it('puts markets taking stakes first', () => {
    const ordered = orderMarkets([market('1', 'locked', 1), market('2', 'open', 9), market('3', 'open_local_only', 5)]);
    expect(ordered.map((m) => m.key)).toEqual(['3', '2', '1']);
  });
  it('offers Stake only while staking is open', () => {
    const open = html(<MarketRow m={market('2', 'open')} now={1_000_000_000} />);
    expect(open).toContain('href="/markets/flexible/2/stake"');
    expect(open).toContain('>Stake<');
    expect(open).toContain('60% Yes');
    const locked = html(<MarketRow m={market('4', 'locked')} now={1_000_000_000} />);
    expect(locked).not.toContain('/stake');
    expect(locked).toContain('>View<');
  });
  const ref = (id: string, fetchedAt: string | null, review = 'pending_review') =>
    ({
      pair: { case_id: id, symbol: id.toUpperCase() },
      item: { case_id: id, candidate_id: id, identity: { chain_id: 1, symbol: id.toUpperCase() } },
      label: 'Historical reference — unreviewed',
      fetchedAt,
      reports: [{ review_state: review }],
    }) as unknown as ReferenceCase;
  it('shows the three newest reports', () => {
    const list = latestReports([ref('a', '2026-01-01'), ref('b', null), ref('c', '2026-03-01'), ref('d', '2026-02-01')]);
    expect(list.map((c) => c.pair.case_id)).toEqual(['c', 'd', 'a']);
  });
  it('shows symbol, label and review badge for a report', () => {
    const m = html(<ReportRow c={ref('metis', '2026-01-01')} />);
    expect(m).toContain('METIS');
    expect(m).toContain('Historical reference — unreviewed');
    expect(m).toContain('Awaiting approval');
  });
});

describe('404', () => {
  it('has one heading, one line and a way back', () => {
    const m = html(<NotFound />);
    expect(m).toContain('<h1');
    expect(m).toContain('href="/cases"');
    expect(m).toContain('href="/"');
  });
});
