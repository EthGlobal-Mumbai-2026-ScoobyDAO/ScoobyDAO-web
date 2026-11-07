import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionBar } from './AdminGate';
import { approvalPhase, attemptPhase, filterQueue, reportLabel, sessionPhase, tabCounts } from './reviewMeta';
import { QueueView } from './ReviewQueue';
import type { PublicQueueItem } from '@/lib/adminApi';

const SHIB = {
  report_id: 'case-shib_reference_research',
  report_version: 'run-shib_reference_replay_20261107',
  report_sha256: '13cfdb303407895cb1c9cf1913a138ac0191c694517606e3f2a3fa5c00bbea99',
};
const items: PublicQueueItem[] = [
  { ...SHIB, created: 100, state: 'pending_review' },
  { report_id: 'case-diagnostic_ray', report_version: 'v2', report_sha256: 'cc'.repeat(32), created: 300, state: 'pending_review' },
  { report_id: 'case-x', report_version: 'v1', report_sha256: 'dd'.repeat(32), created: 200, state: 'approved' },
  { report_id: 'case-y', report_version: 'v1', report_sha256: 'ee'.repeat(32), created: 50, state: 'revision_requested' },
];

describe('session bar', () => {
  it('names the reviewer and says the session covers this report only, with a Close button', () => {
    const h = renderToStaticMarkup(<SessionBar session={{ label: 'reviewer-1', expires_at: 1_900_000_000 }} onClose={() => {}} />);
    expect(h).toContain('Opened with World ID');
    expect(h).toContain('reviewer-1');
    expect(h).toContain('this report only');
    expect(h).toContain('closes in');
    expect(h).toContain('Close');
  });
  it('omits the label when the backend sends none', () => {
    const h = renderToStaticMarkup(<SessionBar session={{ label: null }} onClose={() => {}} />);
    expect(h).not.toContain(' as ');
  });
});

describe('state mapping (exact backend names)', () => {
  it('session', () => {
    expect(sessionPhase(undefined)).toBe('start');
    expect(sessionPhase('pending')).toBe('waiting');
    expect(sessionPhase('not_permitted')).toBe('not_permitted');
    expect(sessionPhase('revoked')).toBe('revoked');
  });
  it('attempt', () => {
    expect(attemptPhase('pending')).toBe('waiting');
    expect(attemptPhase('superseded')).toBe('superseded');
    expect(attemptPhase('confirmed')).toBe('confirmed');
  });
  it('publication approval', () => {
    expect(approvalPhase('pending')).toBe('waiting');
    expect(approvalPhase('approved')).toBe('confirmed');
    expect(approvalPhase('spent')).toBe('confirmed');
    expect(approvalPhase('rejected_not_reviewer')).toBe('not_permitted');
    expect(approvalPhase('error')).toBe('error');
  });
});

describe('review queue', () => {
  it('labels the six reference reports by symbol only when the hash matches the pinned table', () => {
    expect(reportLabel(SHIB.report_id, SHIB.report_version, SHIB.report_sha256)).toMatchObject({ name: 'SHIB', source: 'reference' });
    expect(reportLabel(SHIB.report_id, SHIB.report_version, 'ff'.repeat(32)).source).toBe('generated');
    expect(reportLabel('case-diagnostic_ray', 'v2').name).toBe('Diagnostic ray');
  });
  it('counts per tab, filters, searches and sorts newest first', () => {
    expect(tabCounts(items)).toMatchObject({ waiting: 2, approved: 1, rejected: 0, revision: 1 });
    expect(filterQueue(items, 'waiting', '').map((i) => i.created)).toEqual([300, 100]);
    expect(filterQueue(items, 'waiting', 'shib').map((i) => i.report_id)).toEqual([SHIB.report_id]);
  });
  it('renders tabs with counts, rows with source badge and Review, ids only in the info popover', () => {
    const h = renderToStaticMarkup(<QueueView items={items} />);
    expect(h).toContain('role="tablist"');
    expect(h).toContain('Waiting');
    expect(h).toContain('Revision requested');
    expect(h).toContain('Reference');
    expect(h).toContain('Generated');
    expect(h).toContain('href="/admin/reviews/case-shib_reference_research/run-shib_reference_replay_20261107"');
    expect(h).toContain('>Review');
    expect(h).not.toContain(SHIB.report_sha256.slice(0, 12)); // hash prefix not on the row
  });
  it('empty tab shows Sniff thinking', () => {
    const h = renderToStaticMarkup(<QueueView items={items} initialTab="rejected" />);
    expect(h).toContain('Sniff thinking');
  });
});
