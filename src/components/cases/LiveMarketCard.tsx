'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { DemoReportLabel, PublicStakesLabel, TestTokenLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { OddsBar } from '@/components/OddsBar';
import { StatusChip } from '@/components/StatusChip';
import { formatUsdc, formatWad } from '@/lib/format';
import { nextDeadline, type MarketView } from '@/protocol';

/** The V2 vault's report, read from Ethereum Sepolia. Shown even when the research backend is down. */
export function LiveMarketCard({ markets, loading, error, now }: { markets: MarketView[]; loading: boolean; error?: Error | null; now?: number }) {
  return (
    <section aria-labelledby="live-h" className="glass space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-h" className="font-display text-2xl">
          Live onchain market
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      {loading && markets.length === 0 ? (
        <div className="sweep h-28" aria-busy="true" aria-label="Loading the live market" />
      ) : markets.length === 0 ? (
        <p className="text-mask-ink text-sm">{error ? `Couldn't read the live market from Ethereum Sepolia: ${error.message}` : 'No report is served by the V2 vault.'}</p>
      ) : (
        markets.map((m) => {
          const next = nextDeadline(m);
          return (
            <article key={m.reportId.toString()} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold">Report #{m.reportId.toString()}</p>
                <StatusChip status={m.phase} />
              </div>
              <div className="flex flex-wrap gap-2">
                {m.demoReport && <DemoReportLabel id={m.reportId} />}
                <PublicStakesLabel />
                <TestTokenLabel />
              </div>
              <OddsBar yes={m.totals.yes} no={m.totals.no} />
              <p className="text-muted flex flex-wrap gap-x-4 text-sm">
                <span>
                  <span className="num text-text">{formatUsdc(m.totals.yes)}</span> Yes · <span className="num text-text">{formatUsdc(m.totals.no)}</span> No dUSD
                </span>
                {m.market?.spotPriceWad !== undefined && (
                  <span>
                    YT <span className="num text-text">{formatWad(m.market.spotPriceWad, 6)}</span> dUSD
                  </span>
                )}
                {next && (
                  <span>
                    {next.label}: <Countdown to={next.at} now={now} className="text-text" endedLabel="now" />
                  </span>
                )}
              </p>
              <Link href={`/onchain/${m.reportId}`} className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105">
                Open the live market <ArrowRight size={16} aria-hidden />
              </Link>
            </article>
          );
        })
      )}
    </section>
  );
}
