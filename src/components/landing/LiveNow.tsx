'use client';

import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { EmptyState } from '@/components/EmptyState';
import { OddsBar } from '@/components/OddsBar';
import { useReferenceCases } from '@/components/reference/ReferenceCases';
import { StatusChip } from '@/components/StatusChip';
import { LoadState } from '@/components/ui';
import { chainName } from '@/lib/explorer';
import { referenceStatus, reviewStateText, type ReferenceCase } from '@/lib/reference';
import { publicCasesUrl } from '@/lib/referenceApi';
import { nextDeadline, stakingOpen } from '@/protocol';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { StatsStrip, useLandingMarkets, type LandingMarket } from './StatsStrip';

const MAX_MARKETS = 3;
const MAX_REPORTS = 3;

/** Open markets first, then the rest by the nearest deadline. */
export function orderMarkets(ms: LandingMarket[]): LandingMarket[] {
  const rank = (m: LandingMarket) => (stakingOpen(m.view.phase) ? 0 : 1);
  return [...ms].sort((a, b) => rank(a) - rank(b) || (nextDeadline(a.view)?.at ?? Infinity) - (nextDeadline(b.view)?.at ?? Infinity));
}

/** Newest scouted reports first (by fetch time); undated ones last. */
export function latestReports(refs: ReferenceCase[], n = MAX_REPORTS): ReferenceCase[] {
  const t = (c: ReferenceCase) => (c.fetchedAt ? Date.parse(c.fetchedAt) : NaN);
  return [...refs]
    .sort((a, b) => (Number.isFinite(t(b)) ? t(b) : -Infinity) - (Number.isFinite(t(a)) ? t(a) : -Infinity))
    .slice(0, n);
}

/** Landing "Live now": the totals, open markets and the newest reports, each source in its own LoadState. */
export function LiveNow({ reports }: { reports: ReportChoice[] }) {
  const { query, stats, fixtureMode } = useLandingMarkets(reports);
  const refs = useReferenceCases();
  return (
    <section id="live" aria-labelledby="live-h">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <h2 id="live-h" className="text-[1.375rem] font-semibold sm:text-2xl">
            Live now
          </h2>
          <p className="text-muted mt-1 text-[15px]">Cases you can stake on, and what the agents filed last.</p>
        </div>
        <StatsStrip stats={stats} fixtureMode={fixtureMode} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-muted mb-3 text-sm font-medium">Markets</h3>
          <LoadState query={query} source="Ethereum Sepolia RPC" skeleton={<MarketSkeleton />}>
            {(ms) =>
              ms.length === 0 ? (
                <div className="glass">
                  <EmptyState pose="thinking" title="No markets yet">
                    Markets open once a reviewer approves a report.
                  </EmptyState>
                </div>
              ) : (
                <ul className="space-y-3">
                  {orderMarkets(ms)
                    .slice(0, MAX_MARKETS)
                    .map((m) => (
                      <li key={m.key}>
                        <MarketRow m={m} />
                      </li>
                    ))}
                </ul>
              )
            }
          </LoadState>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-muted text-sm font-medium">Latest reports</h3>
            <Link href="/cases" className="text-sm font-medium underline-offset-4 hover:underline">
              All cases
            </Link>
          </div>
          {!publicCasesUrl ? (
            <div className="glass">
              <EmptyState pose="shrug" title="Reports unavailable">
                The research API isn’t configured for this site.
              </EmptyState>
            </div>
          ) : (
            <LoadState query={refs} source="Research API" skeleton={<ReportSkeleton />}>
              {({ refs: list }) =>
                list.length === 0 ? (
                  <div className="glass">
                    <EmptyState pose="thinking" title="No reports filed yet" />
                  </div>
                ) : (
                  <ul className="paper-plain divide-y divide-line px-5">
                    {latestReports(list).map((c) => (
                      <li key={c.pair.case_id}>
                        <ReportRow c={c} />
                      </li>
                    ))}
                  </ul>
                )
              }
            </LoadState>
          )}
        </div>
      </div>
    </section>
  );
}

export function MarketRow({ m, now }: { m: LandingMarket; now?: number }) {
  const next = nextDeadline(m.view);
  const open = stakingOpen(m.view.phase);
  return (
    <article className="glass grid grid-cols-1 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" aria-label={m.name}>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href={m.href} className="text-lg font-semibold hover:underline">
            {m.name}
          </Link>
          <StatusChip status={m.view.phase} />
          {m.registry && <span className="text-muted text-[13px]">{m.registry}</span>}
        </div>
        <OddsBar yes={m.view.totals.yes} no={m.view.totals.no} compact />
        {next && (
          <p className="text-muted text-[13px]">
            {next.label}: <Countdown to={next.at} now={now} className="text-text" endedLabel="passed" />
          </p>
        )}
      </div>
      {open ? (
        <Link
          href={m.stakeHref}
          className="bg-beam text-on-beam inline-flex justify-center rounded-xl px-5 py-2.5 font-semibold hover:brightness-105"
          aria-label={`Stake on ${m.name}`}
        >
          Stake
        </Link>
      ) : (
        <Link
          href={m.href}
          className="border-line hover:border-text inline-flex justify-center rounded-xl border px-5 py-2.5 font-semibold"
          aria-label={`View ${m.name}`}
        >
          View
        </Link>
      )}
    </article>
  );
}

export function ReportRow({ c }: { c: ReferenceCase }) {
  const id = c.item.identity ?? {};
  const review = c.reports[0]?.review_state;
  return (
    <Link href="/cases" className="group flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-4">
      <div className="min-w-0">
        <p className="font-semibold group-hover:underline">
          {id.symbol ?? c.pair.symbol}
          <span className="ml-2 text-[13px] font-normal text-muted">{id.chain_id ? chainName(id.chain_id) : ''}</span>
        </p>
        <p className="text-[13px] text-muted">{c.label}</p>
      </div>
      <span title={review ? reviewStateText(review) : 'No linked report'}>
        <StatusChip status={referenceStatus(c)} />
      </span>
    </Link>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-3">
      <div className="sweep h-[124px]" />
      <div className="sweep h-[124px]" />
    </div>
  );
}

function ReportSkeleton() {
  return <div className="sweep h-[228px]" />;
}
