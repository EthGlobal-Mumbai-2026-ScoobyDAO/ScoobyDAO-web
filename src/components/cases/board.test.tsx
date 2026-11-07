import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PillarDots } from '@/components/report/PillarDots';
import { ReviewBadge, reviewKindOf } from '@/components/report/ReviewBadge';
import { CASE_STATUSES } from '@/lib/status';
import { CASE_GROUPS, GROUP_OF, inGroup } from './filters';

describe('case board groups', () => {
  it('maps every exact phase to exactly one of the four groups', () => {
    for (const s of CASE_STATUSES) expect(['review', 'open', 'settling', 'closed']).toContain(GROUP_OF[s]);
    expect(CASE_GROUPS.map((g) => g.label)).toEqual(['All', 'Under review', 'Open', 'Settling', 'Closed']);
  });
  it('groups phases as documented', () => {
    expect(inGroup('awaiting_approval', 'review')).toBe(true);
    expect(inGroup('draft', 'review')).toBe(true);
    expect(inGroup('open_local_only', 'open')).toBe(true);
    expect(inGroup('challenged', 'settling')).toBe(true);
    expect(inGroup('denied', 'closed')).toBe(true);
    expect(inGroup('final_yes', 'open')).toBe(false);
    expect(inGroup('void', 'all')).toBe(true);
  });
});

describe('review badge', () => {
  it('only reads an explicit approval as approved', () => {
    expect(reviewKindOf('approved')).toBe('approved');
    expect(reviewKindOf('pending_review')).toBe('pending');
    expect(reviewKindOf(undefined)).toBe('pending');
    expect(reviewKindOf('rejected')).toBe('rejected');
  });
  it('shows icon and words', () => {
    const html = renderToStaticMarkup(<ReviewBadge kind="approved" long />);
    expect(html).toContain('Approved by a verified human with World ID');
    expect(html).toContain('<svg');
    expect(renderToStaticMarkup(<ReviewBadge kind="pending" />)).toContain('Pending review');
  });
});

describe('pillar dots', () => {
  it('renders nothing without data and a text label with it', () => {
    expect(renderToStaticMarkup(<PillarDots statuses={{}} />)).toBe('');
    const html = renderToStaticMarkup(
      <PillarDots statuses={{ microstructure: 'complete', onchain: 'partial', fundamentals: 'unavailable' }} />,
    );
    expect(html).toContain('Market microstructure: complete');
    expect(html).toContain('Fundamentals &amp; sentiment: unavailable');
    expect(html).toContain('1/5 pillars complete');
  });
});
