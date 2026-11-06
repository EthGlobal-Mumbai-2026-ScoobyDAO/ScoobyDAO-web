'use client';

import { env } from '@/lib/env';
import { useReports } from '@/lib/queries';
import { useMarket, useProtocol } from '@/protocol/hooks';
import type { CaseBase } from './CaseHeader';

/**
 * Onchain market for /case/[id] or /onchain/[id], plus (V1 and the fixture chain only) the backend
 * report that published it, matched on onchainReportId. V2 never borrows a backend report by id:
 * report #1 carries demo hashes, and any other link needs the claim hash verified onchain first,
 * which the case file does. A fixture backend's onchain ids refer to the fixture chain only.
 */
export function useCase(id: string, base: CaseBase = '/case') {
  const onchainId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const market = useMarket(onchainId);
  const { protocol } = useProtocol();
  const linkable = base === '/case' && protocol.kind !== 'v2' && (!env.forceFixtures || protocol.kind === 'fixture');
  const reports = useReports({ enabled: linkable });
  const report = linkable ? reports.data?.find((r) => r.onchainReportId === id) : undefined;
  return { onchainId, market, report, reportsLoading: linkable && reports.isLoading };
}
