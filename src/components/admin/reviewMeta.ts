// Pure helpers for the review desk: report labels from the public queue, queue tabs, and the mapping from the
// backend's exact state names (src/lib/adminApi.ts, src/lib/types.ts) to WorldConfirm phases. Display only.
import type { WorldPhase } from '@/components/ui/WorldConfirm';
import type { AttemptStatus, PublicQueueItem, ReviewState, SessionState } from '@/lib/adminApi';
import { chainName } from '@/lib/explorer';
import { pairForReport } from '@/lib/reference';
import type { Approval } from '@/lib/types';

export const reviewQueueKey = ['review-queue'] as const;

export function reviewHref(item: Pick<PublicQueueItem, 'report_id' | 'report_version'>) {
  return `/admin/reviews/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}`;
}

/** Case file for a review-desk report (web report id `<report_id>@<version>`), where publication is requested. */
export function caseFileHref(reportId: string, version: string) {
  return `/cases/${encodeURIComponent(`${reportId}@${version}`)}`;
}

export type ReportSource = 'reference' | 'generated';

export interface ReportLabel {
  /** Token symbol when known (the six reference reports), else a readable name from the report id. */
  name: string;
  symbol: string | null;
  chain: string | null;
  source: ReportSource;
}

/** "case-diagnostic_ray" → "Diagnostic ray". The public queue sends no symbol or title for generated reports. */
export function readableId(reportId: string) {
  const s = reportId.replace(/^case-/, '').replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : reportId;
}

export function reportLabel(reportId: string, version: string, sha?: string): ReportLabel {
  const pair = pairForReport(reportId, version);
  // A pair counts only when the report hash matches the pinned table too (when we know the hash).
  if (pair && (!sha || pair.report_sha256 === sha)) {
    const chainId = Number(pair.candidate_id.split(':')[0]);
    return {
      name: pair.symbol,
      symbol: pair.symbol,
      chain: Number.isFinite(chainId) ? chainName(chainId) : null,
      source: 'reference',
    };
  }
  return { name: readableId(reportId), symbol: null, chain: null, source: 'generated' };
}

// ---------------------------------------------------------------- queue tabs

export type QueueTab = 'waiting' | 'approved' | 'rejected' | 'revision' | 'unavailable';

export const QUEUE_TAB_STATES: Record<QueueTab, ReviewState[]> = {
  waiting: ['pending_review', 'awaiting_confirmation'],
  approved: ['approved'],
  rejected: ['rejected'],
  revision: ['revision_requested'],
  unavailable: ['unavailable'],
};

export const QUEUE_TAB_LABEL: Record<QueueTab, string> = {
  waiting: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  revision: 'Revision requested',
  unavailable: 'Integrity failed',
};

export function tabOf(state: ReviewState): QueueTab {
  return (Object.keys(QUEUE_TAB_STATES) as QueueTab[]).find((t) => QUEUE_TAB_STATES[t].includes(state)) ?? 'waiting';
}

/** Filter by tab and search text (symbol, readable name, id, version), newest first. */
export function filterQueue<T extends PublicQueueItem>(items: T[], tab: QueueTab, search: string): T[] {
  const q = search.trim().toLowerCase();
  return items
    .filter((i) => QUEUE_TAB_STATES[tab].includes(i.state))
    .filter((i) => {
      if (!q) return true;
      const l = reportLabel(i.report_id, i.report_version, i.report_sha256);
      return [l.name, i.report_id, i.report_version, i.report_sha256].some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => b.created - a.created);
}

export function tabCounts(items: PublicQueueItem[]): Record<QueueTab, number> {
  const c: Record<QueueTab, number> = { waiting: 0, approved: 0, rejected: 0, revision: 0, unavailable: 0 };
  for (const i of items) c[tabOf(i.state)] += 1;
  return c;
}

// ---------------------------------------------------------------- World phases

/** Admin session (Read) → phase. `active` is not a panel state: the report opens instead. */
export function sessionPhase(state: SessionState | undefined): WorldPhase {
  switch (state) {
    case undefined:
    case 'active':
      return 'start';
    case 'pending':
      return 'waiting';
    default:
      return state; // denied · expired · cancelled · not_permitted · failed · revoked
  }
}

/** Review decision attempt → phase (same names). */
export function attemptPhase(status: AttemptStatus): WorldPhase {
  return status === 'pending' ? 'waiting' : status;
}

/** Publication sign-off (GET /approvals/:id) → phase. `approved` and `spent` are both a World confirmation. */
export function approvalPhase(status: Approval['status']): WorldPhase {
  switch (status) {
    case 'pending':
      return 'waiting';
    case 'approved':
    case 'spent':
      return 'confirmed';
    case 'rejected_not_reviewer':
      return 'not_permitted';
    default:
      return status; // denied · expired · error
  }
}

/** Reason validation, as the decision panel always enforced it: required after trimming, at most 1000 characters. */
export const REASON_MAX = 1000;
export const reasonOk = (reason: string) => reason.trim().length > 0 && reason.length <= REASON_MAX;
