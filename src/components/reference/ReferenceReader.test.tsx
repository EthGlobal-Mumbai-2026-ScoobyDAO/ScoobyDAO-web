import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntegrityError } from '@/lib/referenceApi';
import { ApiError } from '@/lib/api';
import {
  parseGraphManifest,
  parseIrc,
  parseLedger,
  parseReconstructions,
  parseReport,
  parseRunManifest,
  parseTldr,
  parseTokenDaily,
  parseVarMetrics,
} from '@/lib/referenceData';
import {
  PAIR,
  graphManifest,
  ircJson,
  ledgerJson,
  legacyMetricsText,
  metadataFor,
  reconstructionsCsv,
  reportJson,
  runManifestText,
  tldrJson,
  tokenDailyText,
} from '@/test/referenceFixtures';
import { ErrorState } from './ReaderStates';
import { GatedReferenceReader, ReaderView } from './ReferenceReader';
import { PriceView, VaeView, type Loaded } from './sections';

const ok = <T,>(data: T): Loaded<T> => ({ state: 'ok', data });
const ident = { id: PAIR.report_id, version: PAIR.report_version };
const meta = metadataFor({});
const report = ok(
  parseReport(JSON.stringify(reportJson), { ...ident, candidate: PAIR.candidate_id }),
);
const tldr = ok(parseTldr(JSON.stringify(tldrJson), ident));
const irc = ok(parseIrc(JSON.stringify(ircJson), ident));
const ledger = ok(parseLedger(JSON.stringify(ledgerJson)));
const m = parseGraphManifest(JSON.stringify(graphManifest));
const price = <PriceView manifest={m} points={parseTokenDaily(tokenDailyText, m)} />;
const vae = (
  <VaeView
    metrics={ok(parseVarMetrics(legacyMetricsText))}
    agree
    run={ok(parseRunManifest(runManifestText))}
    recon={ok(parseReconstructions(reconstructionsCsv()))}
    reconstructionsSha={null}
  />
);
const page = (over: Partial<Parameters<typeof ReaderView>[0]> = {}) =>
  renderToStaticMarkup(
    <ReaderView
      meta={meta}
      report={report}
      tldr={tldr}
      irc={irc}
      ledger={ledger}
      price={price}
      vae={vae}
      {...over}
    />,
  );
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ');

describe('reference reader', () => {
  it('shows the historical/unreviewed banner, labels and all five pillars with status text', () => {
    const t = text(page());
    for (const s of [
      'Historical reference — unreviewed',
      'synthetic lineage',
      'Unreviewed (pending review)',
      'No World ID approval.',
      'No case-gate approval or qualification.',
      'Reading this report does not review, approve or publish it.',
      'Market microstructure',
      'On-chain mechanics',
      'Fundamentals & sentiment',
      'Statistical risk',
      'Technical health',
      'Data gap: this pillar is unavailable in this report.',
      'Synthetic metadata gap.',
      'Synthetic fundamentals gap.',
      'Synthetic fundamentals caveat.',
      'Synthetic insight.',
      'pdf : unavailable',
      'Synthetic report limitation.',
      'Fetched 2026-01-06 12:00 UTC',
    ])
      expect(t).toContain(s);
    expect(t.match(/Partial/g)?.length).toBeGreaterThanOrEqual(4);
    expect(t).toContain('Unavailable');
  });

  it('labels the VAE output and never states a legacy label, maximum loss or misconduct as a claim', () => {
    const html = page();
    const t = text(html);
    for (const l of [
      'Historical',
      'In-sample',
      'Unseeded',
      'Uncalibrated',
      'Not backtested',
      'Not a maximum loss',
      'Four-day horizon',
    ])
      expect(t).toContain(l);
    expect(t).toContain('VaR 95%, four-day horizon');
    expect(t).toContain('1.5%');
    expect(t).toContain('Five of 50 reconstructed daily-return series');
    expect(t).not.toMatch(/maximum loss expected/i);
    expect(t).not.toMatch(/risk level\s*(is|:|=)|\bLow\b|risk score\s*(is|:|=|of|\d)/i);
    expect(t).not.toMatch(/scam|pump|rug|fraud|incident|supplement|exploit/i);
    expect(t).not.toMatch(/\bapproved\b|world verified|verified by world/i);
    // Raw legacy claims are not rendered.
    expect(t).not.toContain('Legacy output risk_assessment.interpretation');
  });

  it('shows the Graph source, subgraph, window and missing dates next to the USD chart', () => {
    const t = text(page());
    expect(t).toContain('Daily price (USD per token), historical');
    expect(t).toContain('SyntheticSubgraphId');
    expect(t).toContain('2026-01-01 (inclusive) to 2026-01-06 (exclusive)');
    expect(t).toContain('1 missing UTC dates reported: 2026-01-03');
    expect(t).toContain('(UTC)');
  });

  it('shows "integrity unavailable" and no report content when report.json fails its hash', () => {
    const t = text(
      page({
        report: {
          state: 'error',
          error: new IntegrityError('report.json does not match its SHA-256'),
        },
      }),
    );
    expect(t).toContain('report.json: integrity unavailable');
    expect(t).not.toContain('Synthetic microstructure finding.');
    expect(t).not.toContain('Five of 50');
  });

  it('marks a missing TL;DR or IRC file as a data gap and a bad TL;DR as integrity unavailable', () => {
    expect(text(page({ tldr: { state: 'missing' }, irc: { state: 'missing' } }))).toContain(
      'Data gap: this report has no TL;DR file.',
    );
    const t = text(page({ tldr: { state: 'error', error: new IntegrityError('x') } }));
    expect(t).toContain('TL;DR: integrity unavailable');
    expect(t).not.toContain('Synthetic microstructure finding.');
  });

  it('hides VaR when the two metric files disagree', () => {
    const t = text(
      renderToStaticMarkup(
        <VaeView
          metrics={ok(parseVarMetrics(legacyMetricsText))}
          agree={false}
          run={{ state: 'missing' }}
          recon={{ state: 'missing' }}
          reconstructionsSha={null}
        />,
      ),
    );
    expect(t).toContain('VAE metrics: integrity unavailable');
    expect(t).not.toContain('1.5%');
  });

  it('describes a non-pending review state as it is, not as unreviewed', () => {
    const t = text(page({ meta: { ...meta, review_state: 'approved' } }));
    expect(t).not.toContain('Historical reference — unreviewed');
    expect(t).toContain('Approved by a reviewer');
  });

  it.each([
    [new ApiError(401, 'x'), 'Session ended'],
    [new ApiError(403, 'x'), 'Not permitted'],
    [new ApiError(404, 'x'), 'Not a linked reference report'],
    [new ApiError(409, 'x'), 'Integrity unavailable'],
    [new IntegrityError('x'), 'Integrity unavailable'],
    [new ApiError(0, 'x'), 'Backend unreachable'],
  ])('error %# renders an explicit state', (err, title) => {
    expect(text(renderToStaticMarkup(<ErrorState error={err} />))).toContain(title);
  });

  it('does not open the reader for a report outside the six', () => {
    const t = text(renderToStaticMarkup(<GatedReferenceReader id="other" version="v1" />));
    expect(t).toContain('Not one of the six reference reports');
    expect(t).not.toContain('Read with World ID');
  });

  it('contains no form or sign-off control: reading is read-only', () => {
    const html = page();
    expect(html).not.toMatch(/<form|<button[^>]*type="submit"/);
    expect(text(html)).not.toMatch(/\bApprove\b|\bReject\b|Request revision|Publish\b/);
  });
});
