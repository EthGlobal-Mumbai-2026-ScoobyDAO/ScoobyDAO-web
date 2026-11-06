export type ScoutLane =
  'human_review_required' | 'research_running' | 'auto_qualified' | 'monitoring' | 'unavailable';
export type EvidenceReason = {
  group_id: string;
  description: string;
  verification_status: 'triggered' | 'not_triggered' | 'unknown' | 'held';
  evidence_ids: string[];
  observed_at: string | null;
};
export type ScoutingCase = {
  case_id: string;
  candidate_id: string;
  snapshot_digest: string;
  policy_digest: string;
  expires_at: string;
  identity: { chain_id: number; address: string; symbol: string | null };
  mode: 'live';
  reference: null;
  lane: ScoutLane;
  human_action_required: boolean;
  priority_order: number;
  verified_triggered_count: number;
  status_label: string;
  summary: string;
  uncertainties: string[];
  observed_at: string | null;
  fetched_at: string | null;
  reasons: EvidenceReason[];
  continuation: {
    availability: 'available' | 'unavailable';
    reason: string | null;
    action_url: string | null;
    expected_revision: string | null;
  };
  research: {
    run_id: string | null;
    status: string;
    report_id: string | null;
    report_version: string | null;
    budget: { max_source_requests: number; max_model_calls: number };
    pillars: { pillar: string; status: string; detail: string }[];
    reason: string | null;
  } | null;
};
export type ScoutingSnapshot = {
  schema_version: 'scouting-case-list/1';
  generated_at: string;
  stale_after_seconds: number;
  truncated: boolean;
  authentication: string;
  cases: ScoutingCase[];
};
export interface ScoutingAdapter {
  list(): Promise<ScoutingSnapshot>;
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const timestamp = (v: unknown): v is string =>
  typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const maybeTime = (v: unknown): v is string | null => v === null || timestamp(v);
const maybeText = (v: unknown): v is string | null => v === null || text(v);

export function scoutingApiOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (
      !(
        u.protocol === 'https:' ||
        (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
      ) ||
      u.username ||
      u.password ||
      u.pathname !== '/' ||
      u.search ||
      u.hash
    )
      return null;
    return u.origin;
  } catch {
    return null;
  }
}
export function parseScoutingSnapshot(data: unknown): ScoutingSnapshot {
  if (
    !record(data) ||
    data.schema_version !== 'scouting-case-list/1' ||
    !timestamp(data.generated_at) ||
    !Number.isSafeInteger(data.stale_after_seconds) ||
    (data.stale_after_seconds as number) < 0 ||
    typeof data.truncated !== 'boolean' ||
    !text(data.authentication) ||
    !Array.isArray(data.cases) ||
    data.cases.length > 100 ||
    (data.truncated === true && data.cases.length === 0)
  )
    throw new Error('Unsupported scouting response');
  const ids = new Set<string>();
  const caseIds = new Set<string>();
  for (const item of data.cases) {
    if (
      !record(item) ||
      !text(item.case_id) ||
      !/^[a-f0-9]{64}$/.test(item.case_id) ||
      caseIds.has(item.case_id) ||
      !text(item.snapshot_digest) ||
      !/^[a-f0-9]{64}$/.test(item.snapshot_digest) ||
      !text(item.policy_digest) ||
      !/^[a-f0-9]{64}$/.test(item.policy_digest) ||
      !timestamp(item.expires_at) ||
      !text(item.candidate_id) ||
      ids.has(item.candidate_id.toLowerCase()) ||
      !record(item.identity) ||
      !Number.isSafeInteger(item.identity.chain_id) ||
      (item.identity.chain_id as number) <= 0 ||
      !text(item.identity.address) ||
      !/^0x[0-9a-fA-F]{40}$/.test(item.identity.address) ||
      !(item.identity.symbol === null || typeof item.identity.symbol === 'string')
    )
      throw new Error('Invalid candidate identity');
    if (
      item.candidate_id.toLowerCase() !==
      `${item.identity.chain_id}:${item.identity.address}`.toLowerCase()
    )
      throw new Error('Candidate identity mismatch');
    ids.add(item.candidate_id.toLowerCase());
    caseIds.add(item.case_id);
    if (item.mode === 'live' && ![1, 8453].includes(item.identity.chain_id as number))
      throw new Error('Unsupported live chain');
    if (item.mode !== 'live' || item.reference !== null)
      throw new Error('Invalid live scouting context');
    if (
      ![
        'human_review_required',
        'research_running',
        'auto_qualified',
        'monitoring',
        'unavailable',
      ].includes(item.lane as string) ||
      typeof item.human_action_required !== 'boolean' ||
      item.human_action_required !== (item.lane === 'human_review_required') ||
      !Number.isSafeInteger(item.priority_order) ||
      (item.priority_order as number) < 0 ||
      !Number.isSafeInteger(item.verified_triggered_count) ||
      (item.verified_triggered_count as number) < 0 ||
      (item.verified_triggered_count as number) > 12 ||
      !text(item.status_label) ||
      !text(item.summary) ||
      !strings(item.uncertainties) ||
      !maybeTime(item.observed_at) ||
      !maybeTime(item.fetched_at) ||
      !Array.isArray(item.reasons)
    )
      throw new Error('Invalid scouting state');
    for (const e of item.reasons)
      if (
        !record(e) ||
        !text(e.group_id) ||
        !text(e.description) ||
        !['triggered', 'not_triggered', 'unknown', 'held'].includes(
          e.verification_status as string,
        ) ||
        !strings(e.evidence_ids) ||
        !maybeTime(e.observed_at)
      )
        throw new Error('Invalid evidence reason');
    if (
      !record(item.continuation) ||
      !['available', 'unavailable'].includes(item.continuation.availability as string) ||
      !maybeText(item.continuation.reason) ||
      !maybeText(item.continuation.action_url) ||
      !maybeText(item.continuation.expected_revision) ||
      item.continuation.expected_revision !== item.snapshot_digest
    )
      throw new Error('Invalid continuation state');
    if (
      item.research !== null &&
      (!record(item.research) ||
        !text(item.research.status) ||
        !maybeText(item.research.run_id) ||
        !maybeText(item.research.report_id) ||
        !maybeText(item.research.report_version) ||
        !record(item.research.budget) ||
        item.research.budget.max_source_requests !== 0 ||
        item.research.budget.max_model_calls !== 0 ||
        !Array.isArray(item.research.pillars) ||
        item.research.pillars.some(
          (pillar) =>
            !record(pillar) ||
            !text(pillar.pillar) ||
            !text(pillar.status) ||
            typeof pillar.detail !== 'string',
        ) ||
        !maybeText(item.research.reason))
    )
      throw new Error('Invalid research state');
  }
  return data as unknown as ScoutingSnapshot;
}
export function createScoutingAdapter(origin: string): ScoutingAdapter {
  if (scoutingApiOrigin(origin) !== origin) throw new Error('Invalid scouting API origin');
  return {
    async list() {
      const response = await fetch(`${origin}/scouting/cases`, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Scouting service unavailable');
      return parseScoutingSnapshot(await response.json());
    },
  };
}
export function sortScoutingCases(cases: ScoutingCase[]): ScoutingCase[] {
  return [...cases].sort(
    (a, b) =>
      a.priority_order - b.priority_order ||
      (a.candidate_id < b.candidate_id ? -1 : a.candidate_id > b.candidate_id ? 1 : 0),
  );
}
export function freshness(
  value: string | null,
  staleAfter: number,
  now = Date.now(),
): 'unknown' | 'stale' | 'fresh' {
  if (!value || !timestamp(value) || Date.parse(value) > now + 60_000) return 'unknown';
  return now - Date.parse(value) > staleAfter * 1000 ? 'stale' : 'fresh';
}
/** Show source age without applying the snapshot TTL as a source-validity rule. */
export function sourceAge(value: string | null, now = Date.now()): string {
  if (!value || !timestamp(value) || now <= 0 || Date.parse(value) > now) return 'age unknown';
  const seconds = Math.floor((now - Date.parse(value)) / 1000);
  if (seconds < 60) return 'less than a minute old';
  const units: [number, string][] = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  const [size, name] = units.find(([size]) => seconds >= size)!;
  const n = Math.floor(seconds / size);
  return `${n} ${name}${n === 1 ? '' : 's'} old`;
}
export const scoutingApiConfig = process.env.NEXT_PUBLIC_SCOUTING_API_URL || '';
export const scoutingOrigin = scoutingApiOrigin(scoutingApiConfig);
