import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAgentActivity, parseAgentActivity } from './agentActivity';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('worker activity status', () => {
  it('reads only the worker heartbeat and generic job counts', () => {
    expect(
      parseAgentActivity({
        queue: { done: 3, queued: 2 },
        worker: { seen: 1234 },
        worker_fresh: true,
      }),
    ).toEqual({ workerFresh: true, lastHeartbeat: 1234, runningJobs: 0, queuedJobs: 2 });
  });
  it('represents an absent worker without inventing activity', () => {
    expect(parseAgentActivity({ queue: {}, worker: null, worker_fresh: false })).toEqual({
      workerFresh: false,
      lastHeartbeat: null,
      runningJobs: 0,
      queuedJobs: 0,
    });
  });
  it('rejects malformed or inconsistent status data', () => {
    for (const value of [
      { queue: {}, worker: null, worker_fresh: true },
      { queue: { running: -1 }, worker: null, worker_fresh: false },
      { queue: {}, worker: { seen: Infinity }, worker_fresh: true },
      { queue: {}, worker_fresh: false },
    ])
      expect(() => parseAgentActivity(value)).toThrow();
  });
  it('accepts configured HTTPS or loopback HTTP and rejects redirects and credentials', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ queue: {}, worker: null, worker_fresh: false })),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(fetchAgentActivity('http://127.0.0.1:50653')).resolves.toMatchObject({
      lastHeartbeat: null,
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:50653/status',
      expect.objectContaining({ redirect: 'error', credentials: 'omit' }),
    );
    await expect(fetchAgentActivity('https://research.example')).resolves.toMatchObject({
      lastHeartbeat: null,
    });
    await expect(fetchAgentActivity('http://research.example')).rejects.toThrow(
      'Invalid API origin',
    );
    await expect(fetchAgentActivity('https://user:password@research.example')).rejects.toThrow(
      'Invalid API origin',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not silently replace unavailable backend data with a fixture', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchAgentActivity('http://127.0.0.1:50653')).rejects.toThrow('unavailable');
  });
  it('does not present stale or future heartbeats as active', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    for (const seen of [849, 1001]) {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ queue: {}, worker: { seen }, worker_fresh: true })),
          ),
      );
      await expect(fetchAgentActivity('http://127.0.0.1:50653')).resolves.toMatchObject({
        workerFresh: false,
      });
    }
  });
});
