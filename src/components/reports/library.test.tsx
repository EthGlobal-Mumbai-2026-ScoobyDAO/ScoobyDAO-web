import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REFERENCE_PAIRS, reviewWorkspaceHref, toReferenceCase, type PublicCaseItem } from '@/lib/reference';
import type { ReportEntry } from '@/lib/reports';
import { caseItemFor } from '@/test/referenceFixtures';
import { ReviewersOnly } from './PublicReport';
import { LibraryCard, fromBackend, fromReference } from './Reports';

const pair = REFERENCE_PAIRS[2];

describe('reports library', () => {
  it('lists a pinned reference with its public reader link and a Historical reference chip', () => {
    const c = toReferenceCase(caseItemFor(pair) as PublicCaseItem)!;
    const [item] = fromReference(c);
    expect(item.href).toBe(`/reports/${pair.report_id}/${pair.report_version}`);
    expect(item.review).toBe('pending');
    const html = renderToStaticMarkup(<LibraryCard item={item} />);
    expect(html).toContain('Historical reference');
    expect(html).toContain('Pending review');
    expect(html).not.toContain(pair.report_sha256);
  });

  it('never lists a reference whose report link does not match the pinned table', () => {
    const raw = caseItemFor(pair);
    raw.reference.reports[0].report_sha256 = '0'.repeat(64);
    expect(fromReference(toReferenceCase(raw as PublicCaseItem)!)).toEqual([]);
  });

  it('maps a backend entry without inventing approval', () => {
    const e = {
      id: 'r~v',
      apiOrigin: '/api/research',
      title: 'ABC research report',
      reportId: 'r',
      version: 'v',
      candidateId: '1:0xabc',
      digest: 'a'.repeat(64),
      context: 'Research draft · qualification unverified',
      observed: '',
      review: 'Review: pending',
      html: null,
      markdown: null,
      pdf: null,
    } satisfies ReportEntry;
    const item = fromBackend(e);
    expect(item.symbol).toBe('ABC');
    expect(item.review).toBe('pending');
    expect(item.chainId).toBe(1);
    expect(fromBackend({ ...e, reviewStatus: 'approved' }).review).toBe('approved');
  });

  it('sends readers without a session to the review desk instead of fetching the report', () => {
    const html = renderToStaticMarkup(
      <ReviewersOnly id={pair.report_id} version={pair.report_version} symbol={pair.symbol} />,
    );
    expect(html).toContain('Available to reviewers only');
    expect(html).toContain(`href="${reviewWorkspaceHref(pair)}"`);
  });
});
