import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  eventDescription,
  fetchInvestigationEvents,
  parseInvestigationEvents,
} from './investigationEvents';
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
  it('presents only safe structured model-stage fields and reported usage', () => {
    const stage = {
      ...event,
      kind: 'model_stage_completed',
      detail: JSON.stringify({
        stage: 'reasoning',
        state: 'completed',
        model: 'gpt-6.1-terra',
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        private_content: 'do not show',
      }),
    };
    expect(eventDescription(stage)).toContain('input tokens: 100');
    expect(eventDescription(stage)).not.toContain('do not show');
    expect(
      eventDescription({
        ...stage,
        kind: 'model_stage_started',
        detail: JSON.stringify({
          stage: 'pillar',
          pillar: 'onchain',
          state: 'started',
          shared_request: true,
        }),
      }),
    ).toContain('included in one shared model request');
    expect(eventDescription(stage)).toContain(
      'one model invocation for all pillars and final synthesis',
    );
    expect(eventDescription({ ...stage, detail: 'not json' })).toBe('Stage details unavailable.');
    expect(
      eventDescription({
        ...stage,
        kind: 'model_stage_failed',
        detail: JSON.stringify({ stage: 'reasoning', state: 'failed', reason: 'truncated' }),
      }),
    ).toContain('Model response was truncated');
    expect(
      eventDescription({
        ...stage,
        kind: 'model_stage_validated_shared_output',
        detail: JSON.stringify({
          stage: 'pillar',
          pillar: 'onchain',
          state: 'validated_shared_output',
          shared_request: true,
        }),
      }),
    ).toContain('shared output validated');
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
