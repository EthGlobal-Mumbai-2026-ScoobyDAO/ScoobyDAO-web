import type { Phase } from '@/protocol/types';
import type { ReportStatus } from './types';

/**
 * One status per case: the backend report lifecycle until published, then the onchain phase.
 * 'published' = the backend reports a publication but no onchain market phase is attached (V2:
 * the link is only shown after the case file verifies the claim hash onchain).
 */
export type CaseStatus = ReportStatus | Phase;

export function caseStatusOf(report: { status: ReportStatus } | undefined, phase?: Phase): CaseStatus {
  if (!report) return phase ?? 'open';
  if (report.status === 'published') return phase ?? 'published';
  return report.status;
}

export const CASE_STATUSES: CaseStatus[] = [
  'draft',
  'awaiting_approval',
  'denied',
  'expired',
  'published',
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
