'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { SniffPose } from '@/components/SniffPose';
import { STATUS_META } from '@/components/StatusChip';
import { api } from '@/lib/api';
import { CLAIM_TYPE_LABEL } from '@/lib/claimText';
import { env } from '@/lib/env';
import { qk } from '@/lib/queries';
import { useCaseRows } from '@/lib/useCaseRows';
import { CASE_STATUSES, type CaseStatus } from '@/lib/status';
import type { ClaimType } from '@/lib/types';
import { CaseCard } from './CaseCard';

const STATUS_FILTERS: { key: 'all' | CaseStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  ...CASE_STATUSES.map((s) => ({ key: s, label: STATUS_META[s].reason ?? STATUS_META[s].label })),
];

export function CasesBoard() {
  const { reports, rows } = useCaseRows();
  const qc = useQueryClient();

  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [type, setType] = useState<'all' | ClaimType>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      (type === 'all' || row.report.manifest.claims.some((c) => c.type === type)) &&
      (!q ||
        row.report.token.toLowerCase().includes(q) ||
        row.report.manifest.excludedWallets.some((w) => w.toLowerCase().includes(q))),
  );

  const scan = useMutation({
    mutationFn: () => api.demoScan(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reports }),
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Case board</h1>
          <p className="text-muted mt-2 max-w-xl">
            Every token Sniff has a file on. A case only opens after a verified human signs off on
            the claim.
          </p>
        </div>
        {env.demoMode && (
          <button
            type="button"
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
          >
            {scan.isPending ? 'Sniffing…' : 'Send Sniff to scan'}
          </button>
        )}
      </header>

      {scan.isPending && (
        <div
          role="status"
          className="border-line mt-6 flex items-center gap-4 rounded-xl border p-4"
        >
          <span className="animate-bounce motion-reduce:animate-none">
            <SniffPose pose="sniffing" size={64} decorative />
          </span>
          <p>Sniff is following the trail: simulating buys and sells on new tokens…</p>
        </div>
      )}
      {scan.isError && (
        <div className="mt-6">
          <Banner tone="danger" title="The scan didn't start">
            {scan.error.message}
          </Banner>
        </div>
      )}
      {scan.isSuccess && (
        <p role="status" className="text-clue-ink mt-6 text-sm">
          Scan finished. New files appear at the top of the board.
        </p>
      )}

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Search by token or wallet address</span>
            <Search
              size={16}
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Token or wallet address (0x…)"
              className="num border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-2.5 pr-3 pl-9 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Claim type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="border-line bg-surface focus:border-beam rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="all">Any</option>
              {(Object.keys(CLAIM_TYPE_LABEL) as ClaimType[]).map((t) => (
                <option key={t} value={t}>
                  {CLAIM_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          role="radiogroup"
          aria-label="Filter by status"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {STATUS_FILTERS.map((f) => {
            const n = f.key === 'all' ? rows.length : rows.filter((r) => r.status === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={status === f.key}
                onClick={() => setStatus(f.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${status === f.key ? 'border-beam text-text bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]' : 'border-line text-muted hover:text-text'}`}
              >
                {f.label} <span className="num text-xs">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label="Cases" className="cork mt-8 rounded-2xl p-5 sm:p-8">
        {reports.isLoading ? (
          <div
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading cases"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sweep h-56" />
            ))}
          </div>
        ) : reports.isError ? (
          <EmptyState pose="confused" title="Couldn't reach the case files">
            {reports.error.message}
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState pose="asleep" title="No cases yet">
            Sniff hasn&apos;t filed anything.{' '}
            {env.demoMode
              ? 'Send Sniff to scan to start one.'
              : 'New files appear here as the agents find them.'}
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState
            pose="confused"
            title="No cases match"
            action={
              <button
                type="button"
                onClick={() => {
                  setStatus('all');
                  setType('all');
                  setQuery('');
                }}
                className="border-line rounded-xl border px-4 py-2 hover:border-[var(--fog-400)]"
              >
                Clear filters
              </button>
            }
          >
            Try another status or claim type, or check the address.
          </EmptyState>
        ) : (
          <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((row) => (
              <li key={row.report.id}>
                <CaseCard {...row} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
