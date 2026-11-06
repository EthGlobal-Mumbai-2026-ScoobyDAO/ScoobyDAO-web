'use client';

import { formatUsdc } from '@/lib/format';
import { useCaseRows } from '@/lib/useCaseRows';

/** Computed from GET /reports + /claims (the API has no stats route; see NOTES.md). */
export function StatsStrip() {
  const { rows, reports, claimsLoading } = useCaseRows();
  const loading = reports.isLoading || claimsLoading;
  const staked = rows.reduce((sum, r) => sum + BigInt(r.claim?.totals.committed ?? '0'), 0n);
  const stats = [
    { label: 'Cases open', value: rows.filter((r) => r.status === 'Open').length.toString() },
    { label: 'USDC staked', value: formatUsdc(staked).replace(/\.00$/, '') },
    { label: 'Unmasked', value: rows.filter((r) => r.status === 'ResolvedPass').length.toString() },
    { label: 'Cleared', value: rows.filter((r) => r.status === 'ResolvedFail').length.toString() },
  ];
  return (
    <section aria-label="Live stats" className="border-line bg-surface border-y">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="py-6 sm:py-8">
            <dt className="text-muted text-sm">{s.label}</dt>
            <dd className="num mt-1 text-3xl font-semibold sm:text-4xl">
              {loading ? (
                <span className="sweep inline-block h-9 w-20 align-middle" />
              ) : reports.isError ? (
                '—'
              ) : (
                s.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
