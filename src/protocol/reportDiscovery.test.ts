import { afterEach, describe, expect, it, vi } from 'vitest';

// The registry reads fail here (no network), so each deployment falls back to its bundled report; what matters is
// how often the RPC is asked.
const readContract = vi.fn(async () => {
  throw new Error('offline');
});
vi.mock('./clients', () => ({
  sepoliaClient: () => ({ readContract }),
  arbClient: () => ({ readContract }),
}));

const { listReportChoices, resetReportChoicesCache } = await import('./reportDiscovery');

describe('listReportChoices cache', () => {
  afterEach(() => {
    resetReportChoicesCache();
    readContract.mockClear();
    vi.useRealTimers();
  });

  it('reuses the list instead of reading both registries on every request', async () => {
    const first = await listReportChoices();
    const calls = readContract.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const second = await listReportChoices();
    expect(second).toBe(first);
    expect(readContract.mock.calls.length).toBe(calls);
  });

  it('shares one read between concurrent requests', async () => {
    const [a, b] = await Promise.all([listReportChoices(), listReportChoices()]);
    expect(a).toBe(b);
  });

  it('serves the stale list immediately and refreshes it in the background after 30 s', async () => {
    vi.useFakeTimers();
    const first = await listReportChoices();
    const calls = readContract.mock.calls.length;
    vi.setSystemTime(Date.now() + 31_000);
    expect(await listReportChoices()).toBe(first);
    await vi.waitFor(() => expect(readContract.mock.calls.length).toBeGreaterThan(calls));
  });
});
