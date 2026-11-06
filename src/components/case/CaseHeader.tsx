'use client';

import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { DemoClockLabel } from '@/components/HonestyLabels';
import { StatusChip } from '@/components/StatusChip';
import { formatDate } from '@/lib/format';
import type { WebReport } from '@/lib/types';
import { nextDeadline, type MarketView } from '@/protocol';
import { useChainTime } from '@/protocol/hooks';

const TABS = [
  ['stake', 'Stake'],
  ['market', 'Trade YT'],
  ['result', 'Result & claims'],
] as const;

export function CaseHeader({ market: m, report, tab }: { market: MarketView; report?: WebReport; tab: (typeof TABS)[number][0] }) {
  const now = useChainTime();
  const next = nextDeadline(m);
  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-display text-4xl sm:text-5xl">
          {report?.claimManifest.symbol ? `${report.claimManifest.symbol} · ` : ''}Case #{m.reportId.toString()}
        </h1>
        <StatusChip status={m.phase} size="lg" />
        {m.demoClock && <DemoClockLabel />}
      </div>
      {report && <p className="max-w-3xl text-lg">{report.claimManifest.claimText}</p>}
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted">Cross-chain cutoff</dt>
          <dd className="mt-0.5">{formatDate(m.crossChainCutoff)}</dd>
        </div>
        <div>
          <dt className="text-muted">Lock</dt>
          <dd className="mt-0.5">{formatDate(m.lockTime)}</dd>
        </div>
        <div>
          <dt className="text-muted">Maturity</dt>
          <dd className="mt-0.5">{formatDate(m.maturity)}</dd>
        </div>
        {next && (
          <div>
            <dt className="text-muted">{next.label} in</dt>
            <dd className="mt-0.5 text-base font-semibold">
              <Countdown to={next.at} now={now} endedLabel="now" />
            </dd>
          </div>
        )}
      </dl>
      <nav aria-label="Case sections" className="border-line flex gap-1 overflow-x-auto border-b text-sm">
        {report && (
          <Link href={`/cases/${encodeURIComponent(report.id)}`} className="text-muted hover:text-text -mb-px shrink-0 border-b-2 border-transparent px-3 py-2">
            Case file
          </Link>
        )}
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/case/${m.reportId}/${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 ${tab === t ? 'border-beam text-text' : 'text-muted hover:text-text border-transparent'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** Shared loading / error frame for /case/[id]/* pages. */
export function CaseFrame({ state, children }: { state: { isError: boolean; error?: Error | null; data?: unknown }; children: React.ReactNode }) {
  if (state.isError)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div role="alert" className="glass p-6">
          <p className="font-display text-2xl">This case went cold.</p>
          <p className="text-muted mt-2">{state.error?.message}</p>
          <Link href="/cases" className="text-beam-ink mt-4 inline-block underline">
            Back to the case board
          </Link>
        </div>
      </main>
    );
  if (!state.data)
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-busy="true" aria-label="Loading case">
        <div className="sweep h-12 w-96" />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="sweep h-96" />
          <div className="sweep h-72" />
        </div>
      </main>
    );
  return <>{children}</>;
}
