'use client';

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCaseRows } from '@/components/cases/useCaseRows';
import { formatUsdc } from '@/lib/format';
import type { MarketView } from '@/protocol';
import { useProtocol, useYtVolume } from '@/protocol/hooks';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { protocolForReport } from '@/protocol/reportProtocol';
import { marketName } from '@/components/case/marketName';

export interface LandingMarket {
  key: string;
  /** "Demo report #1", "Report #3" */
  name: string;
  /** Which registry the id belongs to, when there are two. */
  registry?: string;
  view: MarketView;
  href: string;
  stakeHref: string;
}

const trim = (v: bigint) => formatUsdc(v).replace(/\.00$/, '');

/**
 * Every onchain market the landing page shows, read through the protocol adapter (no stats
 * route; NOTES.md). Live V2: one query per discovered report. Fixture mode: the case rows.
 * Returns a LoadState-compatible query plus the summary numbers.
 */
export function useLandingMarkets(reports: ReportChoice[]) {
  const { markets: fixtureMarkets, published, marketsLoading, marketsError } = useCaseRows();
  const { fixtureMode, protocol } = useProtocol();
  const volume = useYtVolume();
  const activated = useMemo(
    () =>
      reports.flatMap((report) => {
        const reportProtocol = protocolForReport(report);
        return reportProtocol ? [{ report, protocol: reportProtocol }] : [];
      }),
    [reports],
  );
  const marketQs = useQueries({
    queries: activated.map(({ report, protocol: p }) => ({
      queryKey: ['homepage', 'market', report.deployment, report.id, report.market?.vault ?? p.deploymentBundle.sepolia.RiskFiStakeVaultV2],
      queryFn: () => p.getMarket(BigInt(report.id)),
      refetchInterval: 30_000,
      retry: 1,
    })),
  });
  const volumeQs = useQueries({
    queries: activated.map(({ report, protocol: p }) => ({
      queryKey: ['homepage', 'ytVolume', report.deployment, report.id, report.market?.hook ?? p.deploymentBundle.sepolia.YieldCurveHookV2],
      queryFn: () => p.ytVolume!(),
      refetchInterval: 60_000,
      retry: false,
    })),
  });

  let data: LandingMarket[] | undefined;
  let isError = false;
  let error: unknown;
  let refetch: () => unknown;
  if (fixtureMode) {
    data = marketsLoading ? undefined : fixtureMarkets.map((view) => fixtureMarket(view));
    isError = !marketsLoading && fixtureMarkets.length === 0 && !!marketsError;
    error = marketsError;
    refetch = () => published.refetch();
  } else {
    const settled = marketQs.every((q) => !q.isPending);
    data = settled
      ? marketQs.flatMap((q, i) => {
          if (!q.data) return [];
          const { report } = activated[i];
          const base = `/markets/${report.deployment}/${report.id}`;
          return [
            {
              key: `${report.deployment}:${report.id}`,
              name: marketName({ id: report.id, deployment: report.deployment }),
              registry: undefined,
              view: q.data,
              href: base,
              stakeHref: `${base}/stake`,
            },
          ];
        })
      : undefined;
    isError = marketQs.length > 0 && marketQs.every((q) => q.isError);
    error = marketQs.find((q) => q.error)?.error;
    refetch = () => marketQs.forEach((q) => void q.refetch());
  }

  const staked = (data ?? []).reduce((s, m) => s + m.view.totals.yes + m.view.totals.no, 0n);
  const ytVolume = fixtureMode ? volume.data : volumeQs.every((q) => !q.isPending) ? volumeQs.reduce((s, q) => s + (q.data ?? 0n), 0n) : undefined;
  const reportCount = fixtureMode ? published.data?.length : reports.length;
  return {
    query: { data, isError, error, refetch },
    fixtureMode,
    stats: [
      { label: 'Reports published', value: reportCount === undefined ? undefined : String(reportCount) },
      { label: 'dUSD staked', value: data ? trim(staked) : undefined },
      {
        label: protocol.kind === 'v2' ? 'YT traded (recent blocks)' : 'YT traded',
        value: ytVolume === null || (ytVolume === undefined && fixtureMode && !volume.isLoading) ? '—' : ytVolume === undefined ? undefined : trim(ytVolume),
      },
    ],
  };
}

function fixtureMarket(view: MarketView): LandingMarket {
  const id = view.reportId.toString();
  return { key: `fixture:${id}`, name: `Report #${id}`, view, href: `/case/${id}`, stakeHref: `/case/${id}/stake` };
}

/** Three totals in a row: small labels, big numbers. Folded into "Live now" (no separate band). */
export function StatsStrip({ stats, fixtureMode }: { stats: { label: string; value?: string }[]; fixtureMode: boolean }) {
  return (
    <div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3" aria-label={fixtureMode ? 'Totals (demo data)' : 'Live totals'}>
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-muted text-[13px]">{s.label}</dt>
            <dd className="font-display mt-0.5 text-2xl leading-none tabular-nums sm:text-[1.75rem]">
              {s.value ?? <span className="sweep inline-block h-7 w-16 align-middle" aria-label="Loading" />}
            </dd>
          </div>
        ))}
      </dl>
      {fixtureMode && <p className="text-muted mt-2 text-xs">Demo data: fixture chain, not live Sepolia numbers.</p>}
    </div>
  );
}
