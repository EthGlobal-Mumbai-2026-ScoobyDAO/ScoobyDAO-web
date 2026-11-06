import { afterEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ apiUrl: 'http://localhost:8080', forceFixtures: false }));
vi.mock('./env', () => ({ env: config }));
import { api, usingFixtures } from './api';
afterEach(() => {
  config.forceFixtures = false;
  vi.unstubAllGlobals();
});
describe('approval fixture boundary', () => {
  it('does not simulate approval when the API is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    await expect(usingFixtures()).resolves.toBe(false);
    await expect(api.getApproval('apr-pending')).rejects.toThrow('network down');
  });
  it('rejects an incompatible response instead of falling back after an incompatible health API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.getApproval('apr-pending')).rejects.toThrow('Incompatible sign-off response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/approvals/apr-pending');
  });
  it('uses sample approvals only with explicit fixture opt-in', async () => {
    config.forceFixtures = true;
    vi.stubGlobal('fetch', vi.fn());
    await expect(usingFixtures()).resolves.toBe(true);
    const approval = await api.getApproval('apr-pending');
    expect(approval.id).toBe('apr-pending');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects research report metadata as an incompatible legacy case list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([{ report_id: 'r', report_version: 'v' }]))),
    );
    await expect(api.getReports()).rejects.toThrow('Incompatible case response');
  });
});
