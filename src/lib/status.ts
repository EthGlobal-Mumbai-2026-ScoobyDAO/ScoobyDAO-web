import type { Phase } from '@/protocol/types';
import type { ReportStatus } from './types';

/** One status per case: the backend report lifecycle until published, then the onchain phase. */
export type CaseStatus = Exclude<ReportStatus, 'published'> | Phase;

export function caseStatusOf(report: { status: ReportStatus } | undefined, phase?: Phase): CaseStatus {
  if (!report || report.status === 'published') return phase ?? 'open';
  return report.status;
}

export const CASE_STATUSES: CaseStatus[] = [
  'draft',
  'awaiting_approval',
  'denied',
  'expired',
  'open',
  'open_local_only',
  'locked',
  'matured',
  'proposed',
  'challenged',
  'final_yes',
  'final_no',
  'void',
];
