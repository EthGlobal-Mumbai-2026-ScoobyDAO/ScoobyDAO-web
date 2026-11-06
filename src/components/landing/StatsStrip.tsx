'use client';

import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCaseRows } from '@/components/cases/useCaseRows';
import { formatUsdc } from '@/lib/format';
import { useProtocol, useYtVolume } from '@/protocol/hooks';
import { bundleForMarket } from '@/protocol/dynamicMarket';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { v2ForBundle } from '@/protocol/v2';

/** Live numbers from the protocol adapter (no stats route; NOTES.md). Labelled "Demo data" in fixture mode. */
export function StatsStrip({ reports }: { reports: ReportChoice[] }) {
  const { markets, published, marketsLoading } = useCaseRows();
  const { fixtureMode, protocol } = useProtocol();
  const volume = useYtVolume();
  const activated = useMemo(
    () => reports.filter((report) => report.market && report.report).map((report) => ({ report, protocol: v2ForBundle(bundleForMarket(report)) })),
    [reports],
  );
  const allMarkets = useQueries({
    queries: activated.map(({ report, protocol: reportProtocol }) => ({
      queryKey: ['homepage', 'market', report.deployment, report.id, report.market!.vault],
      queryFn: () => reportProtocol.getMarket(BigInt(report.id)),
      refetchInterval: 30_000,
      retry: 1,
    })),
  });
  const allVolumes = useQueries({
    queries: activated.map(({ report, protocol: reportProtocol }) => ({
      queryKey: ['homepage', 'ytVolume', report.deployment, report.id, report.market!.hook],
      queryFn: () => reportProtocol.ytVolume!(),
      refetchInterval: 60_000,
      retry: false,
    })),
  });
  const aggregateLoading = allMarkets.some((query) => query.isLoading) || allVolumes.some((query) => query.isLoading);
  const fallbackLoading = published.isLoading || marketsLoading || volume.isLoading;
  const loading = fixtureMode ? fallbackLoading : aggregateLoading;
  const staked = fixtureMode
    ? markets.reduce((sum, market) => sum + market.totals.yes + market.totals.no, 0n)
    : allMarkets.reduce((sum, query) => sum + (query.data ? query.data.totals.yes + query.data.totals.no : 0n), 0n);
  const ytVolume = fixtureMode ? volume.data : allVolumes.reduce((sum, query) => sum + (query.data ?? 0n), 0n);
  const reportCount = fixtureMode ? (published.data?.length ?? 0) : reports.length;
  const flexibleCount = reports.filter((report) => report.deployment === 'flexible').length;
  const originalCount = reports.length - flexibleCount;
  const stats = [
    { label: 'Reports published', value: reportCount.toString() },
    { label: 'dUSD staked', value: formatUsdc(staked).replace(/\.00$/, '') },
    { label: protocol.kind === 'v2' ? 'YT traded (recent blocks)' : 'YT traded', value: ytVolume == null ? '—' : formatUsdc(ytVolume).replace(/\.00$/, '') },
  ];
  return (
    <section aria-label={fixtureMode ? 'Stats (demo data)' : 'Live stats'} className="border-line bg-surface border-y">
      <div className="mx-auto max-w-6xl px-4">
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="py-6 sm:py-8">
              <dt className="text-muted text-sm">{s.label}</dt>
              <dd className="num mt-1 text-3xl font-semibold sm:text-4xl">
                {s.label !== 'Reports published' && loading ? <span className="sweep inline-block h-9 w-20 align-middle" /> : s.value}
              </dd>
            </div>
          ))}
        </dl>
        {!fixtureMode && reports.length > 0 && (
          <div className="border-line border-t py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span className="text-muted">All reports: {flexibleCount} flexible · {originalCount} original</span>
              {reports.map((report) => (
                <Link
                  key={`${report.deployment}:${report.id}`}
                  href={`/markets/${report.deployment}/${report.id}`}
                  className="border-line hover:border-beam rounded-full border px-3 py-1.5 font-semibold"
                >
                  {report.deployment === 'flexible' ? 'Flexible' : 'Original'} #{report.id} · {report.market ? 'market deployed' : 'setup pending'}
                </Link>
              ))}
            </div>
          </div>
        )}
        {fixtureMode && <p className="text-muted pb-4 text-xs">Demo data: fixture chain, not live Sepolia numbers.</p>}
      </div>
    </section>
  );
}
