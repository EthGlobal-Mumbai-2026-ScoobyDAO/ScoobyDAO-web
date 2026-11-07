'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { STATUS_META } from '@/components/StatusChip';
import { chainName } from '@/lib/explorer';
import { CASE_STATUSES, type CaseStatus } from '@/lib/status';
import { scoutFindings, referenceStatus, type ReferenceCase } from '@/lib/reference';
import type { MarketView } from '@/protocol';
import { useChainTime, useProtocol } from '@/protocol/hooks';
import { ReferenceCaseCard, useReferenceCases } from '@/components/reference/ReferenceCases';
import {
  EmptyState,
  LoadState,
  Page,
  PageHeader,
  SegmentedControl,
  type QueryLike,
} from '@/components/ui';
import { CaseCard } from './CaseCard';
import { CASE_GROUPS, inGroup, type CaseGroup } from './filters';
import { LiveMarketCard } from './LiveMarketCard';
import { MoreFilters } from './MoreFilters';
import { useCaseRows, type CaseRow } from './useCaseRows';

const errText = (e: unknown) => (e instanceof Error ? e.message : undefined);

/** Most flags first, then the pinned table order. Ranking reads only the scout's own summary. */
const bySuspicion = (refs: ReferenceCase[]) =>
  refs
    .map((c, i) => ({ c, i, n: scoutFindings(c.summary).flagged.length }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.c);

export function CasesBoard() {
  const { reports, published, rows, markets, marketsLoading, marketsError } = useCaseRows();
  const { protocol } = useProtocol();
  const now = useChainTime();
  const scouted = useReferenceCases();
  const refs = bySuspicion(scouted.data?.refs ?? []);

  const [group, setGroup] = useState<CaseGroup>('all');
  const [phase, setPhase] = useState<'all' | CaseStatus>('all');
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
  const passes = (status: CaseStatus, chainId: number | undefined, g: CaseGroup = group) =>
    inGroup(status, g) && (phase === 'all' || status === phase) && (chain === 'all' || chainId === chain);
  const matchRow = (row: CaseRow) =>
    !q ||
    row.report?.claimManifest.token.toLowerCase().includes(q) ||
    row.report?.claimManifest.symbol?.toLowerCase().includes(q) ||
    row.report?.id.toLowerCase().includes(q) ||
    row.onchainId?.toString() === q.replace('#', '');
  const matchRef = (c: ReferenceCase) =>
    !q ||
    (c.item.identity?.symbol ?? c.pair.symbol).toLowerCase().includes(q) ||
    (c.item.identity?.address ?? '').toLowerCase().includes(q) ||
    c.reports.some((r) => r.report_id.toLowerCase().includes(q));

  const shown = rows.filter((r) => passes(r.status, r.chainId) && matchRow(r));
  const shownRefs = refs.filter(
    (c) => passes(referenceStatus(c), c.item.identity?.chain_id) && matchRef(c),
  );
  const count = (g: CaseGroup) =>
    rows.filter((r) => passes(r.status, r.chainId, g) && matchRow(r)).length +
    refs.filter((c) => passes(referenceStatus(c), c.item.identity?.chain_id, g) && matchRef(c))
      .length;
  const shownTotal = shown.length + shownRefs.length;
  const extra = (phase !== 'all' ? 1 : 0) + (chain !== 'all' ? 1 : 0);

  // One load state for the docket: ready once either source answers; an error only when both fail.
  const docket: QueryLike<true> = {
    data: reports.data !== undefined || scouted.data !== undefined ? true : undefined,
    isError:
      reports.isError &&
      (scouted.isError || (scouted.data === undefined && scouted.fetchStatus === 'idle')),
    error: scouted.error ?? reports.error,
    refetch: () => {
      void reports.refetch();
      void scouted.refetch();
    },
  };
  const marketsQuery: QueryLike<MarketView[]> = {
    data: markets.length > 0 || (!marketsLoading && !marketsError) ? markets : undefined,
    isError: !!marketsError && markets.length === 0,
    error: marketsError,
    refetch: () => published.refetch(),
  };
  const clear = () => {
    setGroup('all');
    setPhase('all');
    setChain('all');
    setQuery('');
  };

  return (
    <Page>
      <PageHeader title="Case board" description="Live scouts ranked by how suspicious they look." />

      {protocol.kind === 'v2' && (
        <div className="mb-8">
          <LiveMarketCard query={marketsQuery} now={now} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Filter by stage"
          items={CASE_GROUPS.map((g) => ({ ...g, count: count(g.key) }))}
          value={group}
          onChange={setGroup}
        />
        <label className="relative min-w-56 flex-1">
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
            placeholder="Token, symbol or #case"
            className="border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-2.5 pr-3 pl-9 text-sm outline-none"
          />
        </label>
        <MoreFilters active={extra}>
          <label className="block text-sm">
            <span className="text-muted mb-1 block">Exact phase</span>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as 'all' | CaseStatus)}
              className="border-line bg-surface focus:border-beam w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="all">Any phase</option>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted mb-1 block">Token chain</span>
            <select
              value={String(chain)}
              onChange={(e) => setChain(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border-line bg-surface focus:border-beam w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="all">Any chain</option>
              {chains.map((c) => (
                <option key={c} value={c}>
                  {chainName(c)}
                </option>
              ))}
            </select>
          </label>
        </MoreFilters>
      </div>

      <section aria-labelledby="cases-h" className="cork mt-6 rounded-2xl p-5 sm:p-8">
        <h2 id="cases-h" className="sr-only">
          Cases ({shownTotal})
        </h2>
        <LoadState
          query={docket}
          source="Research API"
          skeleton={
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading cases">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="sweep h-64 rounded-xl" />
              ))}
            </div>
          }
        >
          {() =>
            rows.length + refs.length === 0 ? (
              <EmptyState pose="thinking" title="No cases yet">
                New scouts appear here as Sniff files them.
              </EmptyState>
            ) : shownTotal === 0 ? (
              <EmptyState
                pose="thinking"
                title="No cases match"
                action={
                  <button
                    type="button"
                    onClick={clear}
                    className="border-line rounded-xl border px-4 py-2 hover:border-[var(--fog-400)]"
                  >
                    Clear filters
                  </button>
                }
              >
                Try another stage or chain, or check the address.
              </EmptyState>
            ) : (
              <>
                {(reports.isError || scouted.isError) && (
                  <p
                    role="status"
                    className="bg-surface text-text border-line mb-6 inline-flex flex-wrap items-center gap-x-2 rounded-xl border px-3 py-2 text-sm"
                    title={errText(reports.error) ?? errText(scouted.error)}
                  >
                    Some case files didn’t load from the Research API.
                    <button
                      type="button"
                      onClick={() => docket.refetch()}
                      className="underline underline-offset-4"
                    >
                      Retry
                    </button>
                  </p>
                )}
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
              </>
            )
          }
        </LoadState>
      </section>
    </Page>
  );
}
