import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { loadNativeReport, safePackagePath, PILLARS } from './report-widget';
import type { ReportEntry } from './reports';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
afterEach(() => vi.unstubAllGlobals());
function fixture(badReference = false, tamper = false) {
  const rationale = {
    text: 'A scoped rationale',
    evidence_ids: [badReference ? 'missing' : 'e1'],
    input_ids: ['c1'],
  };
  const reasoning = JSON.stringify({
    profile: 'scooby.reasoning/2',
    report_id: 'r',
    report_version: 'v',
    candidate_id: '1:abc',
    reasoning: {
      pillars: [],
      conclusion: {
        recommendation: {
          action: 'Defer',
          rationale,
          counterevidence: [],
          reversal_conditions: ['Obtain evidence'],
        },
      },
    },
  });
  const pillars = Object.fromEntries(
    PILLARS.map(([key], i) => [
      key,
      {
        status: 'partial',
        summary: 'summary',
        evidence_ids: ['e1'],
        measurements: [],
        series: [],
        claims: i
          ? []
          : [
              {
                id: 'c1',
                statement: 'claim',
                kind: 'observation',
                supporting_evidence_ids: ['e1'],
                counterevidence_ids: [],
                uncertainties: [],
              },
            ],
        quality_issues: [],
      },
    ]),
  );
  const report = JSON.stringify({
    schema_version: '0.2',
    report_id: 'r',
    report_version: 'v',
    candidate_id: '1:abc',
    assessment: { label: 'draft', summary: 'summary', unknowns: [] },
    pillars,
    evidence: [{ id: 'e1', path: 'evidence/e.json', sha256: 'a'.repeat(64) }],
    artifacts: [
      {
        kind: 'reasoning',
        availability: 'available',
        path: 'reasoning.json',
        sha256: hash(reasoning),
        report_id: 'r',
        report_version: 'v',
      },
    ],
  });
  const entry: ReportEntry = {
    id: 'r~v',
    apiOrigin: 'http://localhost:8000',
    title: 'test',
    reportId: 'r',
    version: 'v',
    candidateId: '1:abc',
    digest: hash(report),
    context: 'draft',
    observed: 'unknown',
    review: 'pending',
    html: { url: 'http://localhost:8000/artifacts/job/index.html', sha256: 'b'.repeat(64) },
    markdown: null,
    pdf: null,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(url.endsWith('/report.json') ? report : tamper ? reasoning + ' ' : reasoning),
    ),
  );
  return entry;
}
describe('native report package', () => {
  it('rejects unsafe paths', () => {
    for (const path of ['../secret', 'a/%2e%2e/b', 'https://evil/x', 'a//b', 'a?x'])
      expect(safePackagePath(path)).toBe(false);
    expect(safePackagePath('evidence/source.json')).toBe(true);
  });
  it('accepts a hash-bound v2 recommendation with traceable references', async () => {
    const result = await loadNativeReport(fixture());
    expect(result.reasoning?.reasoning.conclusion?.recommendation?.action).toBe('Defer');
  });
  it('rejects a recommendation with unresolved evidence', async () => {
    await expect(loadNativeReport(fixture(true))).rejects.toThrow('Unresolved reference');
  });
  it('rejects altered sidecar bytes', async () => {
    await expect(loadNativeReport(fixture(false, true))).rejects.toThrow('digest mismatch');
  });
  it('verifies the immutable package manifest before consuming report and sidecars', async () => {
    const entry = fixture();
    const priorFetch = globalThis.fetch;
    const manifest = JSON.stringify({
      report_id: 'r',
      report_version: 'v',
      report_sha256: entry.digest,
    });
    const packageId = hash(manifest);
    entry.packageUrl = `http://localhost:8000/packages/${packageId}`;
    const descriptor = {
      package_sha256: packageId,
      report_id: 'r',
      report_version: 'v',
      candidate_id: '1:abc',
      report_sha256: entry.digest,
      manifest: { sha256: packageId, url: `/packages/${packageId}/manifest.json` },
      report: {
        availability: 'available',
        sha256: entry.digest,
        url: `/packages/${packageId}/report.json`,
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === entry.packageUrl) return new Response(JSON.stringify(descriptor));
        if (url.endsWith('/manifest.json')) return new Response(manifest);
        return priorFetch(url);
      }),
    );
    expect((await loadNativeReport(entry)).report.report_id).toBe('r');
  });
  it('does not fall back when the backend explicitly marks a package unavailable', async () => {
    const entry = fixture();
    entry.packageUnavailable = true;
    await expect(loadNativeReport(entry)).rejects.toThrow('Report package unavailable');
  });
  it('rejects a package on a different origin from its configured adapter', async () => {
    const entry = fixture();
    entry.apiOrigin = 'https://research.example';
    entry.packageUrl = `https://foreign.example/packages/${'a'.repeat(64)}`;
    await expect(loadNativeReport(entry)).rejects.toThrow('Unsafe package URL');
  });
  it('rejects a legacy artifact on a foreign origin', async () => {
    const entry = fixture();
    entry.apiOrigin = 'https://research.example';
    await expect(loadNativeReport(entry)).rejects.toThrow('Immutable report package required');
  });
});
