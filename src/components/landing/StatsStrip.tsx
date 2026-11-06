'use client';

import { useCaseRows } from '@/components/cases/useCaseRows';
import { formatUsdc } from '@/lib/format';
import { useProtocol, useYtVolume } from '@/protocol/hooks';

/** Live numbers from the protocol adapter (no stats route; NOTES.md). Labelled "Demo data" in fixture mode. */
export function StatsStrip() {
  const { rows, published, marketsLoading } = useCaseRows();
  const { fixtureMode } = useProtocol();
  const volume = useYtVolume();
  const loading = published.isLoading || marketsLoading;
  const staked = rows.reduce((sum, r) => sum + (r.market ? r.market.totals.yes + r.market.totals.no : 0n), 0n);
  const stats = [
    { label: 'Reports published', value: (published.data?.length ?? 0).toString() },
    { label: 'dUSD staked', value: formatUsdc(staked).replace(/\.00$/, '') },
    { label: 'YT traded', value: volume.data == null ? '—' : formatUsdc(volume.data).replace(/\.00$/, '') },
  ];
  return (
    <section aria-label={fixtureMode ? 'Stats (demo data)' : 'Live stats'} className="border-line bg-surface border-y">
      <div className="mx-auto max-w-6xl px-4">
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="py-6 sm:py-8">
              <dt className="text-muted text-sm">{s.label}</dt>
              <dd className="num mt-1 text-3xl font-semibold sm:text-4xl">
                {loading ? <span className="sweep inline-block h-9 w-20 align-middle" /> : published.isError ? '—' : s.value}
              </dd>
            </div>
          ))}
        </dl>
        {fixtureMode && <p className="text-muted pb-4 text-xs">Demo data: fixture chain, not live Sepolia numbers.</p>}
      </div>
    </section>
  );
}
