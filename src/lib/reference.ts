// Six historical reference cases (display contract `scooby.reference-display/1`, backend
// docs/reference-display-contract.md). Display only: these cases never start scouting, an investigation, a model run,
// a World attempt or anything onchain, and reading one never signs anything off.
//
// The six pairs are pinned here exactly as in the contract table. A case item or reader response whose binding
// differs from this table is shown as a binding mismatch, never rendered as one of the six.

import type { CaseStatus } from './status';

export interface ReferencePair {
  symbol: string;
  candidate_id: string;
  case_id: string;
  report_id: string;
  report_version: string;
  report_sha256: string;
}

export const REFERENCE_PAIRS: readonly ReferencePair[] = [
  {
    symbol: 'SHIB',
    candidate_id: '1:0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    case_id: 'ac40e79f2e6e1cc2d011d487d8a9d259700591f0f1f85f46bfa22fcd171b25ea',
    report_id: 'case-shib_reference_research',
    report_version: 'run-shib_reference_replay_20261107',
    report_sha256: '13cfdb303407895cb1c9cf1913a138ac0191c694517606e3f2a3fa5c00bbea99',
  },
  {
    symbol: 'FET',
    candidate_id: '1:0xaea46a60368a7bd060eec7df8cba43b7ef41ad85',
    case_id: '7b460f8e9e93aa02d7c6425b1450ec6e30c97c0beab9539a94261c4ce4daa0b8',
    report_id: 'case-reference_fet',
    report_version: 'run-reference_fet_20261107',
    report_sha256: 'a697d2932eb2b9628229cc4283f1c1d28058953fcfdc20b37f6481ca2d0d923e',
  },
  {
    symbol: 'SPX',
    candidate_id: '1:0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c',
    case_id: 'bbe3daeeccbe5273e4a1f742a6a872dea08e7d8313e99de4ac3ccb6203d04800',
    report_id: 'case-reference_spx',
    report_version: 'run-reference_spx_20261107',
    report_sha256: '3f6bea48fd347c4ed8477b12ca10f53d8e06e2714ac4600f96808f78acabc854',
  },
  {
    symbol: 'YFI',
    candidate_id: '1:0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    case_id: 'a7b75ac2adac7deb04fb9b11dacd165eb32a03f49c192b76ae654f6a8ee49e92',
    report_id: 'case-reference_yfi',
    report_version: 'run-reference_yfi_20261107',
    report_sha256: '27e70de305585ebac702bcd3c041fe8d952455bbc3d3555de2bad33473d32ef9',
  },
  {
    symbol: 'GRT',
    candidate_id: '1:0xc944e90c64b2c07662a292be6244bdf05cda44a7',
    case_id: '2f156e0056d0629c85967e90b8023ba8f7cbc827462f93a00fb021125ce16b89',
    report_id: 'case-reference_grt',
    report_version: 'run-reference_grt_20261107',
    report_sha256: '70de2083725d70dae6874e803667527bf84d4ac303ffb97110ab5530aada7a01',
  },
  {
    symbol: 'METIS',
    candidate_id: '1:0x9e32b13ce7f2e80a01932b42553652e053d6ed8e',
    case_id: '72557d92517b2a7e6ac0cea716bc3ca5006c78c8bfc27e3b8eb89fa5ff82b5ab',
    report_id: 'case-reference_metis',
    report_version: 'run-reference_metis_20261107',
    report_sha256: '8bdbe633a92fdaebb57b7bd68af0dbb9f4f048b844a91f05f28f7fbd1f8541bd',
  },
];

export const REFERENCE_LABEL = 'Historical reference — unreviewed';

export const pairForCase = (caseId: string) => REFERENCE_PAIRS.find((p) => p.case_id === caseId);
export const pairForReport = (reportId: string, version: string) =>
  REFERENCE_PAIRS.find((p) => p.report_id === reportId && p.report_version === version);

// ---------------------------------------------------------------- public case list (GET /scouting/cases)

export interface ReferenceReportLink {
  report_id: string;
  report_version: string;
  report_sha256: string;
  association: string;
  review_state: string;
  world_verified: boolean;
  gate_effect: string;
}

/** The fields of a `scouting-case-list/2` item this board reads. Everything else is ignored. */
export interface PublicCaseItem {
  case_id: string;
  candidate_id: string;
  identity?: { chain_id?: number; address?: string; symbol?: string } | null;
  mode?: string;
  lane?: string;
  summary?: string | null;
  routing_rationale?: string | null;
  uncertainties?: unknown;
  expires_at?: string | null;
  observed_at?: string | null;
  fetched_at?: string | null;
  continuation?: { availability?: string; action_url?: string | null; reason?: string } | null;
  research?: unknown;
  reference?: {
    kind?: string;
    label?: string;
    reports?: ReferenceReportLink[];
  } | null;
}

export interface ReferenceCase {
  pair: ReferencePair;
  item: PublicCaseItem;
  label: string;
  summary: string | null;
  routing: string | null;
  uncertainties: string[];
  expiresAt: string | null;
  fetchedAt: string | null;
  /** Links exactly as the backend listed them that also match the pinned pair; mismatches are listed separately. */
  reports: ReferenceReportLink[];
  mismatched: ReferenceReportLink[];
}

const hex64 = /^[a-f0-9]{64}$/;

/** True for any case item the backend marks as a historical reference, pinned or not. */
export function isReferenceItem(item: PublicCaseItem): boolean {
  return item.reference != null;
}

function validLink(r: unknown): r is ReferenceReportLink {
  const x = r as ReferenceReportLink;
  return (
    !!x &&
    typeof x.report_id === 'string' &&
    typeof x.report_version === 'string' &&
    typeof x.report_sha256 === 'string' &&
    hex64.test(x.report_sha256) &&
    typeof x.review_state === 'string' &&
    typeof x.world_verified === 'boolean' &&
    typeof x.gate_effect === 'string'
  );
}

/**
 * A public case item as one of the six pinned references, or null when it is not a reference or its case/candidate
 * binding differs from the contract table. Report links are kept only when report id, version and hash all match
 * the pinned pair; the reader link is never guessed from the case.
 */
export function toReferenceCase(item: PublicCaseItem): ReferenceCase | null {
  if (!item?.reference || item.reference.kind !== 'historical_reference') return null;
  const pair = pairForCase(item.case_id);
  if (!pair || pair.candidate_id !== item.candidate_id) return null;
  const listed = Array.isArray(item.reference.reports)
    ? item.reference.reports.filter(validLink)
    : [];
  const matches = (r: ReferenceReportLink) =>
    r.report_id === pair.report_id &&
    r.report_version === pair.report_version &&
    r.report_sha256 === pair.report_sha256;
  return {
    pair,
    item,
    label: item.reference.label || REFERENCE_LABEL,
    summary: typeof item.summary === 'string' ? item.summary : null,
    routing: typeof item.routing_rationale === 'string' ? item.routing_rationale : null,
    uncertainties: Array.isArray(item.uncertainties)
      ? item.uncertainties.filter((u): u is string => typeof u === 'string')
      : [],
    expiresAt: typeof item.expires_at === 'string' ? item.expires_at : null,
    fetchedAt: typeof item.fetched_at === 'string' ? item.fetched_at : null,
    reports: listed.filter(matches),
    mismatched: listed.filter((r) => !matches(r)),
  };
}

export function snapshotExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return true; // no expiry supplied: treat as expired, never as fresh
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t <= now;
}

/** Reader route under the review desk; the per-report World ID session gates it. */
export function referenceReaderHref(r: Pick<ReferenceReportLink, 'report_id' | 'report_version'>) {
  return `/admin/reviews/${encodeURIComponent(r.report_id)}/${encodeURIComponent(r.report_version)}/reference`;
}

export type CaseAction =
  'challenge' | 'continue' | 'world_attempt' | 'investigate' | 'refresh' | 'scan' | 'onchain';

/**
 * Agent, investigation, World-attempt and onchain actions a case card may offer. Reference cases get none, whatever
 * the item says (even if a backend bug sent an action URL). This milestone also offers none for other cases: the web
 * has no agent-action flags and keeps them off.
 */
export function allowedCaseActions(item: PublicCaseItem): CaseAction[] {
  if (isReferenceItem(item)) return [];
  return [];
}

// ---------------------------------------------------------------- docket card context

// Contract traits the scout's summary names. Every trait comes from the summary text; nothing is added.
const FLAGGED: [RegExp, string][] = [
  [/hidden owner/i, 'Hidden owner'],
  [/owner balance control/i, 'Owner balance control'],
  [/\bmint/i, 'Minting'],
  [/\bpause/i, 'Pause'],
  [/blacklist/i, 'Blacklist'],
];
const CLEAR: [RegExp, string][] = [
  [/\bno honeypot/i, 'No honeypot'],
  [/zero owner/i, 'Zero owner'],
  [/\bno [^.;]*sell-all restriction/i, 'No sell-all restriction'],
];

/** What the scout flagged and what it found clear, read from the case summary. */
export function scoutFindings(summary: string | null): { flagged: string[]; clear: string[] } {
  const s = summary ?? '';
  return {
    flagged: FLAGGED.filter(([re]) => re.test(s)).map(([, t]) => t),
    clear: CLEAR.filter(([re]) => re.test(s)).map(([, t]) => t),
  };
}

/** Board phase for a reference case, from its report's review state only. */
export function referenceStatus(c: Pick<ReferenceCase, 'reports'>): CaseStatus {
  const state = c.reports[0]?.review_state;
  if (state === 'pending_review' || state === 'awaiting_confirmation') return 'awaiting_approval';
  if (state === 'rejected') return 'denied';
  return 'draft';
}

/** Open questions for the card: the backend's uncertainties without the reference-table prefix. */
export const openQuestions = (c: Pick<ReferenceCase, 'uncertainties'>) =>
  c.uncertainties
    .map((u) => u.replace(/^historical reference;\s*/i, ''))
    .map((u) => u.charAt(0).toUpperCase() + u.slice(1));

// ---------------------------------------------------------------- review state wording

const REVIEW_WORDS: Record<string, string> = {
  pending_review: 'Unreviewed (pending review)',
  awaiting_confirmation: 'Review decision waiting for World App',
  approved: 'Approved by a reviewer',
  rejected: 'Rejected by a reviewer',
  revision_requested: 'Revision requested by a reviewer',
  unavailable: 'Review state unavailable',
};
export const reviewStateText = (s: string) => REVIEW_WORDS[s] ?? `Review state: ${s}`;
