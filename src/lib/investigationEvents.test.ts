import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchInvestigationEvents, parseInvestigationEvents } from './investigationEvents';
const event = {
  seq: 4,
  run_id: 'run1',
  kind: 'report_generated',
  detail: 'Draft pending review',
  created: 1793967663,
};
afterEach(() => vi.unstubAllGlobals());
describe('investigation events', () => {
  it('accepts ordered events bound to the requested run', () => {
    expect(
      parseInvestigationEvents([event, { ...event, seq: 5, kind: 'rendered' }], 'run1'),
    ).toHaveLength(2);
    expect(() => parseInvestigationEvents([{ ...event, run_id: 'other' }], 'run1')).toThrow();
    expect(() => parseInvestigationEvents([event, event], 'run1')).toThrow();
    expect(() => parseInvestigationEvents([{ ...event, created: NaN }], 'run1')).toThrow();
  });
  it('reads only the configured origin and propagates failure', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify([event])));
    vi.stubGlobal('fetch', mock);
    expect(await fetchInvestigationEvents('http://127.0.0.1:8000', 'run1')).toEqual([event]);
    expect(mock.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      credentials: 'omit',
    });
    await expect(
      fetchInvestigationEvents('https://user:pass@example.com', 'run1'),
    ).rejects.toThrow();
    await expect(fetchInvestigationEvents('http://127.0.0.1:8000', '../escape')).rejects.toThrow();
  });
});
