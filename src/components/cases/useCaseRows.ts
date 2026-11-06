'use client';

import { useQueries } from '@tanstack/react-query';
import { useReports } from '@/lib/queries';
import { caseStatusOf, type CaseStatus } from '@/lib/status';
import type { WebReport } from '@/lib/types';
import type { MarketView } from '@/protocol';
import { useProtocol, usePublished } from '@/protocol/hooks';

export interface CaseRow {
  key: string;
  report?: WebReport;
  onchainId?: bigint;
  market?: MarketView;
  status: CaseStatus;
  chainId?: number;
}

/** Backend reports merged with onchain published ids; an onchain id without a backend file still gets a card. */
export function useCaseRows() {
  const reports = useReports({ pollMs: 10_000 });
  const published = usePublished();
  const { protocol, ready } = useProtocol();
  const fromReports = (reports.data ?? []).map((r) => (r.onchainReportId ? BigInt(r.onchainReportId) : undefined));
  const ids = [...new Set([...fromReports.filter((x): x is bigint => x !== undefined), ...(published.data ?? [])].map(String))].map(BigInt);
  const markets = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['protocol', protocol.kind, 'market', id.toString()],
      queryFn: () => protocol.getMarket(id),
      enabled: ready,
      retry: 1,
    })),
  });
  const byId = new Map<string, MarketView>();
  markets.forEach((q) => q.data && byId.set(q.data.reportId.toString(), q.data));

  const rows: CaseRow[] = (reports.data ?? []).map((r) => {
    const m = r.onchainReportId ? byId.get(r.onchainReportId) : undefined;
    return {
      key: r.id,
      report: r,
      onchainId: r.onchainReportId ? BigInt(r.onchainReportId) : undefined,
      market: m,
      status: caseStatusOf(r, m?.phase),
      chainId: r.claimManifest.chainId || undefined,
    };
  });
  const known = new Set(rows.map((r) => r.onchainId?.toString()));
  for (const id of published.data ?? []) {
    if (known.has(id.toString())) continue;
    const m = byId.get(id.toString());
    rows.push({ key: `onchain-${id}`, onchainId: id, market: m, status: m?.phase ?? 'open' });
  }
  return { reports, published, rows, marketsLoading: markets.some((q) => q.isLoading) };
}
