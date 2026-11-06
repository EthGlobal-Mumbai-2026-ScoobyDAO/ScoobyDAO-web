'use client';

import { useClaim, useReports } from '@/lib/queries';

/** ClaimView + the report that published it (ClaimView has no reportId, so match on claimId). */
export function useCase(claimId: string) {
  const claim = useClaim(claimId, { poll: true });
  const reports = useReports();
  const report = reports.data?.find((r) => r.claimId === claimId);
  return { claim, report, reportsLoading: reports.isLoading };
}
