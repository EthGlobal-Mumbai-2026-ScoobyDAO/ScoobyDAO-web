import { describe, expect, it } from 'vitest';
import { parseGraphActivity } from './graphActivity';
const token = '1:0x' + 'a'.repeat(40);
const hash = 'b'.repeat(64);
const activity = {
  profile: 'scooby.graph-activity-30d/1-proposal',
  status: 'pass',
  decision_scope: 'ethereum_uniswap_v3_token',
  network: 'ethereum',
  candidate_id: token,
  subgraph_id: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  reason: 'threshold_met_in_indexed_scope',
  evaluated_at_utc: '2026-11-06T19:30:00Z',
  window_start_utc: '2026-10-07T19:00:00Z',
  window_end_utc: '2026-11-06T19:00:00Z',
  threshold_inr: '10000000',
  volume_usd: '123456.123456789',
  volume_inr: '12345678.123456789',
  coverage: { expected_hours: 720, observed_hours: 720 },
  limitations: ['one protocol only'],
  fx: {
    provider: 'ECB via Frankfurter',
    inr_per_usd: '94.48',
    rate_date: '2026-11-05',
    captured_at_utc: '2026-11-06T19:25:00Z',
    evidence_id: hash,
    method: 'single_reference_rate_for_full_window',
  },
  source: {
    fetched_at_utc: '2026-11-06T19:26:00Z',
    subgraph_id: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    deployment: 'QmExample',
    indexed_block_number: 26357882,
    indexed_block_timestamp: 1793993063,
    response_sha256: hash,
  },
};
describe('historical Graph capture boundary', () => {
  it('preserves exact decimals and source scope without asserting current freshness', () => {
    const out = parseGraphActivity(activity, token);
    expect(out?.volumeInr).toBe('12345678.123456789');
    expect(out?.source?.block).toBe(26357882);
  });
  it('rejects candidate or scope mismatches, incomplete pass, and missing provenance', () => {
    expect(parseGraphActivity(activity, '1:0x' + 'c'.repeat(40))).toBeNull();
    expect(
      parseGraphActivity({ ...activity, decision_scope: 'selected_pool_only' }, token),
    ).toBeNull();
    expect(
      parseGraphActivity(
        { ...activity, coverage: { expected_hours: 720, observed_hours: 704 } },
        token,
      ),
    ).toBeNull();
    expect(parseGraphActivity({ ...activity, fx: null }, token)).toBeNull();
  });
  it('keeps missing activity unknown rather than treating it as zero', () => {
    const v = {
      ...activity,
      status: 'unknown',
      volume_usd: null,
      volume_inr: null,
      fx: null,
      source: null,
      coverage: { expected_hours: 720, observed_hours: 0 },
    };
    expect(parseGraphActivity(v, token)?.status).toBe('unknown');
    expect(parseGraphActivity({ ...v, volume_inr: '0' }, token)).toBeNull();
  });
});
