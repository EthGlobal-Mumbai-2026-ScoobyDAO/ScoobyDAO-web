'use client';

import { useQueries } from '@tanstack/react-query';
import { api } from './api';
import { qk, useReports } from './queries';
import { caseStatusOf, type CaseStatus } from './status';
import type { ClaimView, Report } from './types';

export interface CaseRow {
  report: Report;
  claim?: ClaimView;
  status: CaseStatus;
}

/** Every report joined with its ClaimView (when published). Used by the board and the landing stats. */
export function useCaseRows() {
  const reports = useReports();
  const published = (reports.data ?? []).filter((r) => r.claimId);
  const claimQs = useQueries({
    queries: published.map((r) => ({
      queryKey: qk.claim(r.claimId!),
      queryFn: () => api.getClaim(r.claimId!),
    })),
  });
  const claims = new Map<string, ClaimView>();
  claimQs.forEach((q) => q.data && claims.set(q.data.claimId, q.data));
  const rows: CaseRow[] = (reports.data ?? []).map((r) => {
    const claim = r.claimId ? claims.get(r.claimId) : undefined;
    return { report: r, claim, status: caseStatusOf(r, claim?.status) };
  });
  return { reports, rows, claimsLoading: claimQs.some((q) => q.isLoading) };
}
