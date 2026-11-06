export type GraphActivity = {
  status: 'pass' | 'below_indexed_scope_threshold' | 'unknown';
  candidateId: string;
  evaluatedAt: string;
  windowStart: string;
  windowEnd: string;
  observedHours: number;
  volumeUsd: string | null;
  volumeInr: string | null;
  reason: string;
  fx: {
    provider: string;
    rate: string;
    date: string;
    capturedAt: string;
    evidenceId: string;
  } | null;
  source: {
    fetchedAt: string;
    block: number;
    blockTimestamp: number;
    responseHash: string;
    deployment: string;
  } | null;
  limitations: string[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const iso = (v: unknown): v is string =>
  typeof v === 'string' && /(?:Z|\+00:00)$/.test(v) && Number.isFinite(Date.parse(v));
const decimal = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 100 &&
  /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
/** Validate an exact candidate-bound capture. It is historical until a trusted server supplies a current freshness decision. */
export function parseGraphActivity(value: unknown, candidate: string): GraphActivity | null {
  if (
    !record(value) ||
    value.profile !== 'scooby.graph-activity-30d/1-proposal' ||
    value.decision_scope !== 'ethereum_uniswap_v3_token' ||
    value.network !== 'ethereum' ||
    value.candidate_id !== candidate.toLowerCase() ||
    !/^1:0x[a-f0-9]{40}$/.test(candidate.toLowerCase()) ||
    value.subgraph_id !== '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV' ||
    !['pass', 'below_indexed_scope_threshold', 'unknown'].includes(value.status as string) ||
    !iso(value.evaluated_at_utc) ||
    !iso(value.window_start_utc) ||
    !iso(value.window_end_utc) ||
    Date.parse(value.window_end_utc) - Date.parse(value.window_start_utc) !== 30 * 86400000 ||
    Date.parse(value.window_end_utc) > Date.parse(value.evaluated_at_utc) ||
    value.threshold_inr !== '10000000' ||
    typeof value.reason !== 'string' ||
    !record(value.coverage) ||
    value.coverage.expected_hours !== 720 ||
    !Number.isInteger(value.coverage.observed_hours) ||
    (value.coverage.observed_hours as number) < 0 ||
    (value.coverage.observed_hours as number) > 720 ||
    !Array.isArray(value.limitations) ||
    !value.limitations.every((x) => typeof x === 'string')
  )
    return null;
  const status = value.status as GraphActivity['status'];
  if (status === 'unknown' && (value.volume_usd !== null || value.volume_inr !== null)) return null;
  if (
    status !== 'unknown' &&
    (!decimal(value.volume_usd) ||
      !decimal(value.volume_inr) ||
      value.coverage.observed_hours !== 720)
  )
    return null;
  let fx: GraphActivity['fx'] = null;
  if (
    record(value.fx) &&
    value.fx.provider === 'ECB via Frankfurter' &&
    decimal(value.fx.inr_per_usd) &&
    typeof value.fx.rate_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.fx.rate_date) &&
    iso(value.fx.captured_at_utc) &&
    sha(value.fx.evidence_id) &&
    value.fx.method === 'single_reference_rate_for_full_window'
  )
    fx = {
      provider: value.fx.provider,
      rate: value.fx.inr_per_usd,
      date: value.fx.rate_date,
      capturedAt: value.fx.captured_at_utc,
      evidenceId: value.fx.evidence_id,
    };
  let source: GraphActivity['source'] = null;
  if (
    record(value.source) &&
    iso(value.source.fetched_at_utc) &&
    Number.isSafeInteger(value.source.indexed_block_number) &&
    (value.source.indexed_block_number as number) > 0 &&
    Number.isSafeInteger(value.source.indexed_block_timestamp) &&
    (value.source.indexed_block_timestamp as number) > 0 &&
    (value.source.indexed_block_timestamp as number) <= 8640000000000 &&
    sha(value.source.response_sha256) &&
    typeof value.source.deployment === 'string' &&
    value.source.deployment.length > 0 &&
    value.source.subgraph_id === value.subgraph_id
  )
    source = {
      fetchedAt: value.source.fetched_at_utc,
      block: value.source.indexed_block_number as number,
      blockTimestamp: value.source.indexed_block_timestamp as number,
      responseHash: value.source.response_sha256,
      deployment: value.source.deployment,
    };
  if (status !== 'unknown' && (!fx || !source)) return null;
  return {
    status,
    candidateId: candidate,
    evaluatedAt: value.evaluated_at_utc,
    windowStart: value.window_start_utc,
    windowEnd: value.window_end_utc,
    observedHours: value.coverage.observed_hours as number,
    volumeUsd: value.volume_usd as string | null,
    volumeInr: value.volume_inr as string | null,
    reason: value.reason,
    fx,
    source,
    limitations: value.limitations as string[],
  };
}
