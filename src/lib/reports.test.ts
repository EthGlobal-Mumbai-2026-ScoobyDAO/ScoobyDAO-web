import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendReportAdapter, reportApiBase, verifyAsset } from './reports';

afterEach(() => vi.unstubAllGlobals());
describe('configured report API', () => {
  it('accepts HTTPS origins and loopback HTTP only', () => {
    expect(reportApiBase('http://127.0.0.1:50653')).toBe('http://127.0.0.1:50653');
    expect(reportApiBase('https://research.example')).toBe('https://research.example');
    expect(reportApiBase('http://research.example')).toBeNull();
    expect(reportApiBase('https://user:pass@research.example')).toBeNull();
    expect(reportApiBase('https://research.example/?x=1')).toBeNull();
    expect(reportApiBase('http://localhost.evil.test')).toBeNull();
    expect(reportApiBase('http://localhost:8000/path')).toBeNull();
    expect(reportApiBase(undefined)).toBeNull();
  });
  it('uses an explicitly configured HTTPS API origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(backendReportAdapter('https://research.example').list()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://research.example/reports');
  });
  it('rejects a manifest from another report digest', async () => {
    const item = {
      report_id: 'r',
      report_version: 'v',
      candidate_id: '1:abc',
      report_sha256: 'a'.repeat(64),
      identity: { symbol: 'X' },
      observation_times: [],
      selection: { kind: 'unknown', admission_qualified: null },
      review: { status: 'pending' },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([item])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...item, report_sha256: 'b'.repeat(64), artifacts: {} })),
        ),
    );
    const rows = await backendReportAdapter('http://localhost:8000').list();
    expect(rows[0].listUnavailable).toBe(true);
  });
  it('rejects artifacts pointing outside the declared package', async () => {
    const item = {
      report_id: 'r',
      report_version: 'v',
      candidate_id: '1:abc',
      report_sha256: 'a'.repeat(64),
      identity: { symbol: 'X' },
      observation_times: [],
      selection: { kind: 'unknown', admission_qualified: null },
      review: { status: 'pending' },
    };
    const html = {
      availability: 'available',
      sha256: 'b'.repeat(64),
      report_sha256: item.report_sha256,
      url: '//evil.test/index.html',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([item])))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ...item, artifacts: { html } }))),
    );
    const rows = await backendReportAdapter('http://localhost:8000').list();
    expect(rows[0].listUnavailable).toBe(true);
  });
  it('keeps five distinct reports accessible when one of six details fails, without downloading report bytes', async () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      report_id: `report-${i}`,
      report_version: `v${i}`,
      candidate_id: `1:0x${String(i).repeat(40)}`,
      report_sha256: 'a'.repeat(64),
      identity: { symbol: 'SAME' },
      observation_times: ['2026-11-06T10:00:00Z'],
      selection: { kind: 'unknown', admission_qualified: null },
      review: { status: 'pending' },
    }));
    const mock = vi.fn(async (url: string) => {
      if (url.endsWith('/reports')) return new Response(JSON.stringify(items));
      const found = items.find((x) =>
        url.endsWith(`/reports/${x.report_id}/${x.report_version}/artifacts`),
      );
      if (!found) throw new Error('Unexpected full artifact download');
      if (found.report_id === 'report-2') return new Response('unavailable', { status: 503 });
      return new Response(JSON.stringify({ ...found, artifacts: {} }));
    });
    vi.stubGlobal('fetch', mock);
    const rows = await backendReportAdapter('http://localhost:8000').list();
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.candidateId)).size).toBe(6);
    expect(rows.filter((r) => r.listUnavailable).map((r) => r.reportId)).toEqual(['report-2']);
    expect(mock).toHaveBeenCalledTimes(7);
    expect((await backendReportAdapter('http://localhost:8000').get('report-5~v5'))?.reportId).toBe(
      'report-5',
    );
    await expect(backendReportAdapter('http://localhost:8000').get('report-2~v2')).rejects.toThrow(
      'Reports API unavailable',
    );
  });
  it('rejects a mismatched report when that report is opened', async () => {
    const item = {
      report_id: 'r',
      report_version: 'v',
      candidate_id: '1:abc',
      report_sha256: 'a'.repeat(64),
      identity: { symbol: 'X' },
      observation_times: [],
      selection: { kind: 'unknown', admission_qualified: null },
      review: { status: 'pending' },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([item])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...item, report_sha256: 'b'.repeat(64), artifacts: {} })),
        ),
    );
    await expect(backendReportAdapter('http://localhost:8000').get('r~v')).rejects.toThrow(
      'identity mismatch',
    );
  });
  it('fails closed when artifact bytes do not match the manifest hash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('tampered')));
    await expect(
      verifyAsset({ url: 'http://localhost:8000/artifacts/job/report.md', sha256: 'a'.repeat(64) }),
    ).rejects.toThrow('digest mismatch');
  });
});
