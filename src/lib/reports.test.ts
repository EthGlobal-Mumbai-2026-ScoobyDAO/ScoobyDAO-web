import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendReportAdapter, reportApiBase, verifyAsset } from './reports';

afterEach(() => vi.unstubAllGlobals());
describe('local report API', () => {
  it('accepts only explicit loopback HTTP origins', () => {
    expect(reportApiBase('http://127.0.0.1:50653')).toBe('http://127.0.0.1:50653');
    expect(reportApiBase('https://evil.test')).toBeNull();
    expect(reportApiBase('http://localhost.evil.test')).toBeNull();
    expect(reportApiBase('http://localhost:8000/path')).toBeNull();
    expect(reportApiBase(undefined)).toBeNull();
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
    await expect(backendReportAdapter('http://localhost:8000').list()).rejects.toThrow(
      'identity mismatch',
    );
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
    await expect(backendReportAdapter('http://localhost:8000').list()).rejects.toThrow(
      'artifact binding',
    );
  });
  it('fails closed when artifact bytes do not match the manifest hash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('tampered')));
    await expect(
      verifyAsset({ url: 'http://localhost:8000/artifacts/job/report.md', sha256: 'a'.repeat(64) }),
    ).rejects.toThrow('digest mismatch');
  });
});
