import type { ClaimStatus, Report, ReportStatus } from './types';

/** One status per case: report lifecycle until published, then the onchain claim status. */
export type CaseStatus = Exclude<ReportStatus, 'published'> | ClaimStatus;

export function caseStatusOf(report: Pick<Report, 'status'>, claimStatus?: ClaimStatus): CaseStatus {
  if (report.status === 'published') return claimStatus ?? 'Open';
  return report.status;
}

export const CASE_STATUSES: CaseStatus[] = [
  'draft',
  'awaiting_approval',
  'denied',
  'expired',
  'Open',
  'Frozen',
  'ResolvedPass',
  'ResolvedFail',
  'Refunded',
];
