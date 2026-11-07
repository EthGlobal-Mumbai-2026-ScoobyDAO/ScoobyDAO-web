'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { NetworkBadge } from '@/components/NetworkBadge';
import { OddsBar } from '@/components/OddsBar';
import { StatusChip } from '@/components/StatusChip';
import { Card, HonestyChips, LoadState, type QueryLike } from '@/components/ui';
import { formatUsdc } from '@/lib/format';
import { nextDeadline, type MarketView } from '@/protocol';

/** The V2 vault's report, read from Ethereum Sepolia. Shown even when the research backend is down. */
export function LiveMarketCard({
  query,
  now,
}: {
  query: QueryLike<MarketView[]>;
  now?: number;
}) {
  return (
    <Card
      role="region"
      aria-labelledby="live-h"
      title={<span id="live-h">Live market</span>}
      actions={<NetworkBadge chainId={11155111} />}
    >
      <LoadState
        query={query}
        source="Ethereum Sepolia RPC"
        compact
        skeleton={<div className="sweep h-24 rounded-xl" aria-label="Loading the live market" />}
      >
        {(markets) =>
          markets.length === 0 ? (
            <p className="text-muted text-[15px]">No report is served by the market vault yet.</p>
          ) : (
            <div className="space-y-6">
              {markets.map((m) => (
                <LiveMarket key={m.reportId.toString()} m={m} now={now} />
              ))}
            </div>
          )
        }
      </LoadState>
    </Card>
  );
}

function LiveMarket({ m, now }: { m: MarketView; now?: number }) {
  const next = nextDeadline(m);
  return (
    <article className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-semibold">
            {m.demoReport ? `Demo report #${m.reportId}` : `Report #${m.reportId}`}
            <span className="text-muted font-normal">
              {' '}
              · {m.demoReport ? 'demo market, no research report attached' : 'onchain market'}
            </span>
          </p>
          <StatusChip status={m.phase} />
        </div>
        <OddsBar yes={m.totals.yes} no={m.totals.no} />
        <p className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="num text-text">{formatUsdc(m.totals.yes)}</span> Yes ·{' '}
            <span className="num text-text">{formatUsdc(m.totals.no)}</span> No dUSD staked
          </span>
          {next && (
            <span>
              {next.label}:{' '}
              <Countdown to={next.at} now={now} className="text-text" endedLabel="now" />
            </span>
          )}
        </p>
        <HonestyChips
          facts={m.demoReport ? ['demoReport', 'publicStakes', 'testToken'] : ['publicStakes', 'testToken']}
          reportId={m.reportId}
        />
      </div>
      <Link
        href={`/onchain/${m.reportId}`}
        className="bg-beam text-on-beam inline-flex items-center justify-center gap-2 self-end rounded-xl px-4 py-2.5 font-semibold whitespace-nowrap hover:brightness-105"
      >
        Open market <ArrowRight size={16} aria-hidden />
      </Link>
    </article>
  );
}
