// SYNTHETIC fixtures shaped like a six-reference bundle (report v0.2 + sidecars). No bytes, values or text come from
// the private seed. Identifiers reuse the public contract table (SPX row) so the pinned-binding checks pass.
import { REFERENCE_PAIRS } from '@/lib/reference';
import type { ReferenceMetadata } from '@/lib/referenceApi';

export const PAIR = REFERENCE_PAIRS.find((p) => p.symbol === 'SPX')!;
export const TOKEN = PAIR.candidate_id.split(':')[1];
const DAY = 86_400;
const START = 1_767_225_600; // 2026-01-01T00:00:00Z

export const prices = ['0.5', '0.52', '0.0000125', '1234.5'] as const;
/** Four daily rows with a missing date between rows 2 and 3 (2026-01-03 absent). */
export const dailyRows = [0, 1, 3, 4].map((d, i) => ({
  date: START + d * DAY,
  token: { id: TOKEN, symbol: 'SYN' },
  priceUSD: prices[i],
  close: prices[i],
}));
export const tokenDailyText = JSON.stringify(dailyRows);

export const graphManifest = {
  source: 'Synthetic tokenDayDatas',
  chain: 'ethereum',
  subgraph_id: 'SyntheticSubgraphId',
  token_address: TOKEN,
  start_inclusive_utc: '2026-01-01',
  end_exclusive_utc: '2026-01-06',
  fetched_at_utc: '2026-01-06T12:00:00+00:00',
  row_count: 4,
  missing_utc_dates: ['2026-01-03'],
  price_field: 'priceUSD',
  price_units: 'USD per token',
  notes: ['Synthetic note.'],
  raw_sha256: '' as string, // filled by buildBundle
};

export function reconstructionsCsv(rows = 3, cols = 50): string {
  const header = [
    'datetime',
    ...Array.from({ length: cols }, (_, i) => `TOKEN_recreation_${i + 1}`),
  ].join(',');
  const lines = Array.from({ length: rows }, (_, r) => {
    const date = new Date((START + r * DAY) * 1000).toISOString().slice(0, 10);
    return [
      date,
      ...Array.from({ length: cols }, (_, c) => ((c - 25) / 1000 + r / 100).toString()),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

const varBlock = {
  ticker: 'TOKEN',
  var_metrics: {
    var_90: 1.1,
    var_95: 1.5,
    var_99: 2.25,
    var_custom: 1.5,
    confidence_level: 0.95,
    time_horizon_days: 4,
  },
  additional_risk_metrics: { max_drawdown: -9.9, expected_shortfall_95: -3.3 },
  risk_assessment: {
    risk_score: 15,
    risk_level: 'Low',
    interpretation: '1.50% maximum loss expected with 95.0% confidence over 4 day(s)',
  },
  vae_specific_metrics: { number_of_recreations: 50, data_points: 3 },
};
export const legacyMetricsText = JSON.stringify({
  identity: PAIR.candidate_id,
  risk_assessment: varBlock,
});
export const riskMetricsText = JSON.stringify(varBlock);
export const runManifestText = JSON.stringify({
  candidate_id: PAIR.candidate_id,
  source: 'Synthetic source',
  returns: 3,
  reconstructions: 50,
  confidence: 0.95,
  days: 4,
  randomness: 'legacy unseeded training',
  reconstructions_sha256: null,
});

const pillar = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  summary: `Synthetic ${status} summary.`,
  evidence_ids: ['synthetic_source'],
  measurements: [],
  series: [],
  claims: [
    {
      id: 'legacy-risk_assessment-interpretation',
      statement:
        'Legacy output risk_assessment.interpretation: 1.50% maximum loss expected with 95.0% confidence over 4 day(s)',
      kind: 'observation',
      supporting_evidence_ids: [],
      counterevidence_ids: [],
      uncertainties: [],
    },
  ],
  quality_issues: [],
  ...extra,
});

export const reportJson = {
  schema_version: '0.2',
  report_id: PAIR.report_id,
  report_version: PAIR.report_version,
  candidate_id: PAIR.candidate_id,
  mode: 'historical_replay',
  identity: { chain_id: 1, address: TOKEN, symbol: 'SPX' },
  assessment: {
    status: 'proposed',
    label: 'Synthetic label',
    summary: 'Synthetic summary.',
    unknowns: ['Synthetic unknown.'],
  },
  pillars: {
    microstructure: pillar('partial'),
    onchain: pillar('partial'),
    fundamentals: pillar('unavailable', { quality_issues: ['Synthetic fundamentals gap.'] }),
    statistical_risk: pillar('partial'),
    technical_health: pillar('partial'),
  },
  evidence: [
    {
      id: 'synthetic_source',
      path: 'evidence/source.json',
      sha256: 'e'.repeat(64),
      kind: 'historical_observation',
      observed_at: null,
      fetched_at: '2026-01-06T12:00:00+00:00',
      coverage: 'Synthetic coverage.',
      limitations: ['Synthetic limitation.'],
    },
  ],
  artifacts: [
    {
      kind: 'pillar_tldr',
      availability: 'available',
      path: 'pillar-tldr.json',
      sha256: 'f'.repeat(64),
    },
    { kind: 'pdf', availability: 'unavailable', path: null, sha256: null },
  ],
  limitations: ['Synthetic report limitation.'],
};

export const tldrJson = {
  profile: 'scooby.pillar-tldr/1',
  report_id: PAIR.report_id,
  report_version: PAIR.report_version,
  pillars: {
    microstructure: [
      {
        role: 'finding',
        text: 'Synthetic microstructure finding.',
        claim_ids: [],
        evidence_ids: ['synthetic_source'],
      },
    ],
    onchain: [
      {
        role: 'interpretation',
        text: 'Synthetic onchain interpretation.',
        claim_ids: [],
        evidence_ids: [],
      },
    ],
    fundamentals: [
      { role: 'caveat', text: 'Synthetic fundamentals caveat.', claim_ids: [], evidence_ids: [] },
    ],
    statistical_risk: [
      { role: 'finding', text: 'Synthetic risk finding.', claim_ids: [], evidence_ids: [] },
    ],
    technical_health: [
      { role: 'finding', text: 'Synthetic technical finding.', claim_ids: [], evidence_ids: [] },
    ],
  },
};
export const ircJson = {
  profile: 'scooby.pillar-irc/1',
  report_id: PAIR.report_id,
  report_version: PAIR.report_version,
  candidate_id: PAIR.candidate_id,
  pillars: {
    onchain: {
      insight: { text: 'Synthetic insight.' },
      reasoning: { text: 'Synthetic reasoning.' },
      citations: { evidence_ids: ['synthetic_source'] },
      limitations: ['Synthetic IRC limitation.'],
      questions: ['Synthetic question?'],
    },
  },
};
export const ledgerJson = {
  candidate_id: PAIR.candidate_id,
  sources: [
    {
      id: 'synthetic_source',
      url: 'https://example.invalid/synthetic',
      fetched_at: '2026-01-06T12:00:00+00:00',
      sha256: 'e'.repeat(64),
      transport_mode: 'captured_snapshot',
    },
  ],
  attempts: [],
  limits: [],
};

export function metadataFor(files: Record<string, string>): ReferenceMetadata {
  return {
    schema: 'scooby.reference-display/1',
    report_id: PAIR.report_id,
    report_version: PAIR.report_version,
    report_sha256: PAIR.report_sha256,
    case_id: PAIR.case_id,
    candidate_id: PAIR.candidate_id,
    symbol: 'SPX',
    identity: { chain_id: 1, address: TOKEN, symbol: 'SPX' },
    mode: 'historical_replay',
    review_state: 'pending_review',
    world_verified: false,
    gate_effect: 'none',
    association: 'historical_reference',
    labels: [
      'historical',
      'unreviewed',
      'synthetic_lineage',
      'uncalibrated_var',
      'snapshot_expired',
    ],
    description: 'Synthetic description.',
    pillars: {
      fundamentals: { status: 'unavailable', quality_issues: ['Synthetic metadata gap.'] },
    },
    files: { 'report.json': PAIR.report_sha256, ...files },
    file_base: `/web/v1/admin/reference-reports/${PAIR.report_id}/${PAIR.report_version}/files/`,
  };
}

/** Public case item for a pinned pair, as `GET /scouting/cases` sends it for a reference case. */
export function caseItemFor(
  p: (typeof REFERENCE_PAIRS)[number],
  over: Record<string, unknown> = {},
) {
  return {
    case_id: p.case_id,
    candidate_id: p.candidate_id,
    identity: { chain_id: 1, address: p.candidate_id.split(':')[1], symbol: p.symbol },
    mode: 'historical_replay',
    lane: 'unavailable',
    summary: `Synthetic summary for ${p.symbol}.`,
    routing_rationale: 'Synthetic routing text.',
    uncertainties: ['Synthetic uncertainty.'],
    expires_at: '2026-01-01T00:00:00+00:00',
    continuation: { availability: 'unavailable', action_url: null, reason: 'n/a' },
    research: null,
    reference: {
      kind: 'historical_reference',
      label: 'Historical reference — unreviewed',
      reports: [
        {
          report_id: p.report_id,
          report_version: p.report_version,
          report_sha256: p.report_sha256,
          association: 'historical_reference',
          review_state: 'pending_review',
          world_verified: false,
          gate_effect: 'none',
        },
      ],
    },
    ...over,
  };
}
