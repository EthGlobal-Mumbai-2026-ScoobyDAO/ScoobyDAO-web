'use client';

import { useReports } from '@/lib/queries';
import { useMarket } from '@/protocol/hooks';

/** Onchain market for /case/[id] plus the backend report that published it (matched on onchainReportId). */
export function useCase(id: string) {
  const onchainId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const market = useMarket(onchainId);
  const reports = useReports();
  const report = reports.data?.find((r) => r.onchainReportId === id);
  return { onchainId, market, report, reportsLoading: reports.isLoading };
}
