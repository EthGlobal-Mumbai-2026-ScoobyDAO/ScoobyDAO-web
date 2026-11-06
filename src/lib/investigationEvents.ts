import { scoutingApiOrigin } from './scouting';

export type InvestigationEvent = {
  seq: number;
  run_id: string;
  kind: string;
  detail: string;
  created: number;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const safeId = /^[a-zA-Z0-9_-]{1,128}$/;

/** An event belongs to exactly one run; never splice another run's output into this view. */
export function parseInvestigationEvents(value: unknown, runId: string): InvestigationEvent[] {
  if (!safeId.test(runId) || !Array.isArray(value) || value.length > 1000)
    throw new Error('Invalid investigation events');
  let last = 0;
  return value.map((event) => {
    if (
      !record(event) ||
      !Number.isSafeInteger(event.seq) ||
      (event.seq as number) <= last ||
      event.run_id !== runId ||
      typeof event.kind !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(event.kind) ||
      typeof event.detail !== 'string' ||
      event.detail.length > 10000 ||
      typeof event.created !== 'number' ||
      !Number.isFinite(event.created) ||
      event.created < 0 ||
      event.created > 8_640_000_000
    )
      throw new Error('Invalid investigation event');
    last = event.seq as number;
    return event as InvestigationEvent;
  });
}
export async function fetchInvestigationEvents(
  origin: string,
  runId: string,
): Promise<InvestigationEvent[]> {
  if (scoutingApiOrigin(origin) !== origin || !safeId.test(runId))
    throw new Error('Invalid investigation endpoint');
  const response = await fetch(`${origin}/investigations/${encodeURIComponent(runId)}/events`, {
    cache: 'no-store',
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Investigation events unavailable');
  return parseInvestigationEvents(await response.json(), runId);
}
/** Format only the backend's allowlisted structured model-stage fields. */
export function eventDescription(event: InvestigationEvent): string {
  if (!event.kind.startsWith('model_stage_') && !event.kind.startsWith('research_stage_'))
    return event.detail;
  try {
    const value: unknown = JSON.parse(event.detail);
    if (!record(value)) throw new Error('Invalid model stage');
    const parts: string[] = [];
    if (
      typeof value.stage === 'string' &&
      ['reasoning', 'pillar', 'conclusion', 'sources', 'source', 'report'].includes(value.stage)
    )
      parts.push(
        value.stage === 'conclusion'
          ? 'final synthesis'
          : value.stage === 'reasoning'
            ? 'shared five-pillar synthesis'
            : 'pillar',
      );
    if (
      typeof value.pillar === 'string' &&
      [
        'microstructure',
        'onchain',
        'fundamentals',
        'statistical_risk',
        'technical_health',
      ].includes(value.pillar)
    )
      parts.push(value.pillar.replaceAll('_', ' '));
    if (
      typeof value.state === 'string' &&
      [
        'started',
        'completed',
        'failed',
        'cancelled',
        'unavailable',
        'resumed',
        'analyzed',
        'validated_shared_output',
        'captured_replay',
        'captured',
        'skipped_budget',
        'blocked',
        'validated',
        'proposed',
      ].includes(value.state)
    )
      parts.push(
        value.shared_request === true && value.state === 'started'
          ? 'included in one shared model request'
          : value.state === 'validated_shared_output'
            ? 'shared output validated'
            : value.state,
      );
    if (
      typeof value.source === 'string' &&
      ['market', 'security', 'source', 'pools', 'daily'].includes(value.source)
    )
      parts.push(value.source);
    if (value.mode === 'captured_replay') parts.push('captured evidence replay');
    if (value.mode === 'bounded_fetch') parts.push('bounded source collection');
    if (value.stage === 'reasoning')
      parts.push('one model invocation for all pillars and final synthesis');
    if (value.model === 'gpt-6.1-terra') parts.push('model: gpt-6.1-terra');
    for (const [key, label] of [
      ['attempts', 'source attempts'],
      ['captured', 'captured sources'],
      ['budget_calls', 'model call budget'],
      ['attempts_used', 'attempts used'],
      ['max_output_tokens', 'maximum output tokens'],
      ['max_context_chars', 'maximum context characters'],
    ] as const) {
      const n = value[key];
      if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000)
        parts.push(`${label}: ${n}`);
    }
    if (record(value.usage))
      for (const [key, label] of [
        ['prompt_tokens', 'input tokens'],
        ['completion_tokens', 'output tokens'],
        ['total_tokens', 'total tokens'],
      ] as const) {
        const n = value.usage[key];
        if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000)
          parts.push(`${label}: ${n}`);
      }
    const reasons: Record<string, string> = {
      context_or_evidence_invalid: 'Evidence or context invalid',
      missing_openai_key: 'Model credentials unavailable',
      model_budget_zero: 'Model calls are disabled for this run',
      provider_or_validation_failure: 'Model request or validation failed',
      client_retries_not_disabled: 'Model client retry policy is not configured safely',
      refused: 'Model refused the request',
      truncated: 'Model response was truncated',
      incomplete_output: 'Model response was incomplete or truncated',
      invalid_or_unlinked_output: 'Model output failed evidence validation',
      provider_failure: 'Model provider request failed',
      model_identifier_mismatch: 'The provider returned a different model identity',
      no_identity_bound_source_evidence: 'No identity-bound source evidence available',
      sources_contain_no_usable_pillar_observation: 'Sources contain no usable pillar observations',
      provider_error: 'Model provider request failed',
      validation_failed: 'Model output failed validation',
      cancelled: 'Cancelled',
    };
    if (typeof value.reason === 'string' && reasons[value.reason])
      parts.push(reasons[value.reason]);
    return parts.length ? parts.join(' · ') : 'Stage details unavailable.';
  } catch {
    return 'Stage details unavailable.';
  }
}
