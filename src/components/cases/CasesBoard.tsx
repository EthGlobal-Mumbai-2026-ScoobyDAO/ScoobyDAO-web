'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { STATUS_META } from '@/components/StatusChip';
import { chainName } from '@/lib/explorer';
import { CASE_STATUSES, type CaseStatus } from '@/lib/status';
import { useChainTime, useProtocol } from '@/protocol/hooks';
import { Banner } from '@/components/Banner';
import { ReferenceCaseCard, useReferenceCases } from '@/components/reference/ReferenceCases';
import { referenceStatus } from '@/lib/reference';
import { CaseCard } from './CaseCard';
import { LiveMarketCard } from './LiveMarketCard';
import { useCaseRows } from './useCaseRows';

const STATUS_FILTERS: { key: 'all' | CaseStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  ...CASE_STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label })),
];

export function CasesBoard() {
  const { reports, rows, markets, marketsLoading, marketsError } = useCaseRows();
  const { protocol } = useProtocol();
  const now = useChainTime();
  const scouted = useReferenceCases();
  const refs = scouted.data?.refs ?? [];

  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [chain, setChain] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');
  const chains = [
    ...new Set(
      [...rows.map((r) => r.chainId), ...refs.map((c) => c.item.identity?.chain_id)].filter(
        (c): c is number => !!c,
      ),
    ),
  ];

  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      (chain === 'all' || row.chainId === chain) &&
      (!q ||
        row.report?.claimManifest.token.toLowerCase().includes(q) ||
        row.report?.claimManifest.symbol?.toLowerCase().includes(q) ||
        row.report?.id.toLowerCase().includes(q) ||
        row.onchainId?.toString() === q.replace('#', '')),
  );
  // Scouted cases share the docket and its filters.
  const shownRefs = refs.filter(
    (c) =>
      (status === 'all' || referenceStatus(c) === status) &&
      (chain === 'all' || c.item.identity?.chain_id === chain) &&
      (!q ||
        (c.item.identity?.symbol ?? c.pair.symbol).toLowerCase().includes(q) ||
        (c.item.identity?.address ?? '').toLowerCase().includes(q) ||
        c.reports.some((r) => r.report_id.toLowerCase().includes(q))),
  );
  const total = rows.length + refs.length;
  const shownTotal = shown.length + shownRefs.length;
  const loading = reports.isLoading && scouted.isLoading;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Case board</h1>
          <p className="text-muted mt-2 max-w-xl">
            Every report Sniff has filed. A case only opens onchain after an enrolled human approves the
            exact report and claim.
          </p>
        </div>
      </header>

      {protocol.kind === 'v2' && (
        <div className="mt-8">
          <LiveMarketCard markets={markets} loading={marketsLoading} error={marketsError} now={now} />
        </div>
      )}

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Search by token, symbol, report id or case number</span>
            <Search
              size={16}
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Token, symbol, report id or #case"
              className="num border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-2.5 pr-3 pl-9 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Token chain</span>
            <select
              value={String(chain)}
              onChange={(e) => setChain(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border-line bg-surface focus:border-beam rounded-xl border px-3 py-2.5 outline-none"
            >
              <option value="all">Any</option>
              {chains.map((c) => (
                <option key={c} value={c}>
                  {chainName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          role="radiogroup"
          aria-label="Filter by phase"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {STATUS_FILTERS.map((f) => {
            const n =
              f.key === 'all'
                ? total
                : rows.filter((r) => r.status === f.key).length +
                  refs.filter((c) => referenceStatus(c) === f.key).length;
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

      <section aria-labelledby="cases-h" className="cork mt-8 rounded-2xl p-5 sm:p-8">
        <h2 id="cases-h" className="sr-only">
          Cases ({shownTotal})
        </h2>
        {(reports.isError || scouted.isError) && total > 0 && (
          <div className="mb-6">
            <Banner tone="warning" title="Some case files can’t load right now">
              {[reports.error?.message, scouted.error?.message].filter(Boolean).join(' · ')}
            </Banner>
          </div>
        )}
        {loading ? (
          <div
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading cases"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sweep h-56" />
            ))}
          </div>
        ) : total === 0 && reports.isError ? (
          <EmptyState pose="confused" title="Research API unavailable">
            {reports.error.message}. Backend case files can&apos;t load right now; onchain staking, trading, CCIP and claims are unaffected.
          </EmptyState>
        ) : total === 0 ? (
          <EmptyState pose="asleep" title="No cases yet">
            Sniff hasn&apos;t filed anything. New reports appear here as the agents finish them.
          </EmptyState>
        ) : shownTotal === 0 ? (
          <EmptyState
            pose="confused"
            title="No cases match"
            action={
              <button
                type="button"
                onClick={() => {
                  setStatus('all');
                  setChain('all');
                  setQuery('');
                }}
                className="border-line rounded-xl border px-4 py-2 hover:border-[var(--fog-400)]"
              >
                Clear filters
              </button>
            }
          >
            Try another phase or chain, or check the address.
          </EmptyState>
        ) : (
          <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((row) => (
              <li key={row.key}>
                <CaseCard row={row} now={now} />
              </li>
            ))}
            {shownRefs.map((c) => (
              <li key={c.pair.case_id}>
                <ReferenceCaseCard c={c} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
