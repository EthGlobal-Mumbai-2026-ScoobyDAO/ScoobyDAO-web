'use client';

import { useQueries } from '@tanstack/react-query';
import { env } from '@/lib/env';
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

/**
 * Backend reports plus the onchain markets. V1 and the fixture chain merge them by onchainReportId
 * (and list onchain ids without a backend file). V2 never attaches a market to a backend row: report
 * #1 carries demo hashes, and a backend publication links onchain only after the case file verifies
 * its claim hash. V2's live market is returned separately (`markets`) for the "Live onchain market" card.
 */
export function useCaseRows() {
  const reports = useReports({ pollMs: 10_000 });
  const published = usePublished();
  const { protocol, ready } = useProtocol();
  const linkBackend = protocol.kind !== 'v2' && (!env.forceFixtures || protocol.kind === 'fixture');
  const fromReports = linkBackend ? (reports.data ?? []).map((r) => (r.onchainReportId ? BigInt(r.onchainReportId) : undefined)) : [];
  const ids = [...new Set([...fromReports.filter((x): x is bigint => x !== undefined), ...(published.data ?? [])].map(String))].map(BigInt);
  const marketQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['protocol', protocol.kind, 'market', id.toString()],
      queryFn: () => protocol.getMarket(id),
      enabled: ready,
      retry: 1,
    })),
  });
  const byId = new Map<string, MarketView>();
  marketQueries.forEach((q) => q.data && byId.set(q.data.reportId.toString(), q.data));

  const rows: CaseRow[] = (reports.data ?? []).map((r) => {
    const onchainId = linkBackend && r.onchainReportId ? BigInt(r.onchainReportId) : undefined;
    const m = onchainId !== undefined ? byId.get(onchainId.toString()) : undefined;
    return { key: r.id, report: r, onchainId, market: m, status: caseStatusOf(r, m?.phase), chainId: r.claimManifest.chainId || undefined };
  });
  if (linkBackend) {
    const known = new Set(rows.map((r) => r.onchainId?.toString()));
    for (const id of published.data ?? []) {
      if (known.has(id.toString())) continue;
      const m = byId.get(id.toString());
      rows.push({ key: `onchain-${id}`, onchainId: id, market: m, status: m?.phase ?? 'open' });
    }
  }
  const liveIds = (published.data ?? []).map(String);
  return {
    reports,
    published,
    rows,
    /** Markets for the published (vault-served) ids, read from chain. */
    markets: liveIds.map((id) => byId.get(id)).filter((m): m is MarketView => !!m),
    marketsError: marketQueries.find((q) => q.isError)?.error ?? published.error ?? undefined,
    marketsLoading: published.isLoading || marketQueries.some((q) => q.isLoading),
  };
}
