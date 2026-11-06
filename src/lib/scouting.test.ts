import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createScoutingAdapter,
  freshness,
  parseScoutingSnapshot,
  scoutingApiOrigin,
  sortScoutingCases,
  sourceAge,
  type ScoutingCase,
} from './scouting';

const makeCase = (hex: string, priority: number): ScoutingCase => ({
  case_id: hex.repeat(64),
  snapshot_digest: 'a'.repeat(64),
  policy_digest: 'b'.repeat(64),
  expires_at: '2026-11-07T10:00:00Z',
  candidate_id: `1:0x${hex.repeat(40)}`,
  identity: { chain_id: 1, address: `0x${hex.repeat(40)}`, symbol: `TEST-${hex}` },
  mode: 'live',
  reference: null,
  lane: 'human_review_required',
  human_action_required: true,
  priority_order: priority,
  verified_triggered_count: 1,
  status_label: 'Awaiting review',
  summary: 'Synthetic test only',
  uncertainties: ['Not validated'],
  observed_at: '2026-11-06T10:00:00Z',
  fetched_at: '2026-11-06T10:01:00Z',
  reasons: [
    {
      group_id: 'test',
      description: 'Test evidence',
      verification_status: 'triggered',
      evidence_ids: ['test-1'],
      observed_at: '2026-11-06T10:00:00Z',
    },
  ],
  continuation: {
    availability: 'unavailable',
    reason: 'Verifier not available',
    action_url: null,
    expected_revision: 'a'.repeat(64),
  },
  research: null,
});
const snapshot = (cases = [makeCase('1', 2)]) => ({
  schema_version: 'scouting-case-list/1',
  generated_at: '2026-11-06T10:01:00Z',
  stale_after_seconds: 300,
  truncated: false,
  authentication: 'none; test only',
  cases,
});
afterEach(() => vi.unstubAllGlobals());
describe('scouting adapter', () => {
  it('accepts a configured HTTPS origin or loopback HTTP, not unsafe origins', () => {
    expect(scoutingApiOrigin('https://api.example')).toBe('https://api.example');
    expect(scoutingApiOrigin('http://localhost:8000')).toBe('http://localhost:8000');
    for (const value of [
      'http://api.example',
      'https://u:p@api.example',
      'https://api.example/path',
      'https://api.example/?q=1',
      'javascript:alert(1)',
    ])
      expect(scoutingApiOrigin(value)).toBeNull();
  });
  it('accepts an explicit empty snapshot but never substitutes fixture data for failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot([]))))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createScoutingAdapter('https://api.example');
    expect((await adapter.list()).cases).toEqual([]);
    await expect(adapter.list()).rejects.toThrow('offline');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('rejects identity mismatch, duplicate identities, and unlabelled historical examples', () => {
    const a = makeCase('1', 1);
    expect(() =>
      parseScoutingSnapshot(snapshot([{ ...a, candidate_id: `8453:${a.identity.address}` }])),
    ).toThrow('identity mismatch');
    expect(() =>
      parseScoutingSnapshot(
        snapshot([a, { ...a, candidate_id: a.candidate_id.toUpperCase().replace('0X', '0x') }]),
      ),
    ).toThrow('identity');
    expect(() =>
      parseScoutingSnapshot({ ...snapshot(), cases: [{ ...a, mode: 'historical_replay' }] }),
    ).toThrow('live scouting context');
  });
  it('rejects inconsistent action lanes and unknown response versions', () => {
    const a = makeCase('1', 1);
    expect(() => parseScoutingSnapshot(snapshot([{ ...a, lane: 'monitoring' }]))).toThrow(
      'scouting state',
    );
    expect(() => parseScoutingSnapshot({ ...snapshot(), schema_version: 'other' })).toThrow(
      'Unsupported',
    );
  });
  it('accepts source-backed optional context while rejecting malformed clues', () => {
    const a = makeCase('1', 1);
    a.scouting_clues = [
      {
        kind: 'provider_claim',
        description: 'Unverified test claim',
        evidence_id: 'source',
        observed_at: null,
        fetched_at: null,
        verification: 'unverified_provider_claim',
      },
    ];
    a.routing_rationale = 'More evidence needed';
    a.evidence_freshness = 'unknown';
    a.reasons[0].measurements = [{ label: 'Test', value: '5', unit: '%' }];
    expect(parseScoutingSnapshot(snapshot([a])).cases[0].scouting_clues?.[0].description).toBe(
      'Unverified test claim',
    );
    expect(() =>
      parseScoutingSnapshot(
        snapshot([
          {
            ...a,
            scouting_clues: [{ ...a.scouting_clues![0], verification: 'verified' }],
          } as unknown as ScoutingCase,
        ]),
      ),
    ).toThrow('Invalid scouting context');
    expect(() =>
      parseScoutingSnapshot(
        snapshot([{ ...a, evidence_freshness: 'current' } as unknown as ScoutingCase]),
      ),
    ).toThrow('Invalid scouting context');
  });
  it('accepts complete v2 research states and requires v2 explanation fields', () => {
    const a = makeCase('1', 1);
    a.lane = 'research_partial';
    a.human_action_required = false;
    a.scouting_clues = [];
    a.routing_rationale = 'Research partially complete.';
    a.evidence_freshness = 'unknown';
    a.reasons[0].name = 'Test';
    a.reasons[0].measurements = [];
    a.research = {
      run_id: 'run1',
      status: 'partial',
      report_id: 'report',
      report_version: 'v1',
      budget: { max_source_requests: 0, max_model_calls: 0 },
      authorization: 'world_id_human',
      pillars: [],
      reason: null,
    };
    const v2 = { ...snapshot([a]), schema_version: 'scouting-case-list/2' };
    expect(parseScoutingSnapshot(v2).cases[0].research?.report_id).toBe('report');
    expect(() =>
      parseScoutingSnapshot({ ...v2, cases: [{ ...a, scouting_clues: undefined }] }),
    ).toThrow('Missing v2');
    expect(() =>
      parseScoutingSnapshot({
        ...v2,
        cases: [{ ...a, research: { ...a.research, budget: null } }],
      }),
    ).toThrow('research');
  });
  it('uses backend priority with deterministic ties, without mutating the response', () => {
    const input = [makeCase('2', 1), makeCase('1', 1), makeCase('3', 0)];
    expect(sortScoutingCases(input).map((x) => x.identity.symbol)).toEqual([
      'TEST-3',
      'TEST-1',
      'TEST-2',
    ]);
    expect(input[0].identity.symbol).toBe('TEST-2');
  });
  it('distinguishes fresh, stale and unknown observation times', () => {
    const now = Date.parse('2026-11-06T10:05:00Z');
    expect(freshness('2026-11-06T10:04:00Z', 300, now)).toBe('fresh');
    expect(freshness('2026-11-06T09:00:00Z', 300, now)).toBe('stale');
    expect(freshness(null, 300, now)).toBe('unknown');
    expect(freshness('2026-11-06T11:00:00Z', 300, now)).toBe('unknown');
  });
  it('preserves backend screening states and truncation without inventing verification', () => {
    const a = makeCase('1', 1);
    a.reasons = ['triggered', 'not_triggered', 'unknown', 'held'].map((state) => ({
      group_id: state,
      description: 'Test only',
      verification_status: state as (typeof a.reasons)[number]['verification_status'],
      evidence_ids: [],
      observed_at: null,
    }));
    const parsed = parseScoutingSnapshot({ ...snapshot([a]), truncated: true });
    expect(parsed.truncated).toBe(true);
    expect(parsed.cases[0].reasons.map((r) => r.verification_status)).toEqual([
      'triggered',
      'not_triggered',
      'unknown',
      'held',
    ]);
  });
  it('rejects a continuation revision that does not match the snapshot', () => {
    const a = makeCase('1', 1);
    a.continuation.expected_revision = 'c'.repeat(64);
    expect(() => parseScoutingSnapshot(snapshot([a]))).toThrow('continuation state');
  });
  it('preserves an unknown symbol and incomplete research states', () => {
    const a = makeCase('1', 1);
    a.identity.symbol = null;
    a.lane = 'unavailable';
    a.human_action_required = false;
    a.research = {
      run_id: 'run-test',
      status: 'incomplete',
      report_id: null,
      report_version: null,
      budget: { max_source_requests: 0, max_model_calls: 0 },
      pillars: [{ pillar: 'onchain', status: 'unavailable', detail: 'Test only' }],
      reason: 'No report generated.',
    };
    const result = parseScoutingSnapshot(snapshot([a]));
    expect(result.cases[0].identity.symbol).toBeNull();
    expect(result.cases[0].research?.status).toBe('incomplete');
    expect(result.cases[0].research?.pillars[0].status).toBe('unavailable');
  });
  it('shows historical source age without treating the snapshot TTL as a source rule', () => {
    const now = Date.parse('2026-11-06T10:00:00Z');
    expect(sourceAge('2025-11-06T10:00:00Z', now)).toBe('365 days old');
    expect(sourceAge('2026-11-06T09:00:00Z', now)).toBe('1 hour old');
    expect(sourceAge(null, now)).toBe('age unknown');
    expect(sourceAge('2026-11-06T11:00:00Z', now)).toBe('age unknown');
  });
});
