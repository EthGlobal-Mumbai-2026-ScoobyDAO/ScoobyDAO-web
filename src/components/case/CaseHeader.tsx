'use client';

import Link from 'next/link';
import { DeploymentStatusChip } from '@/components/DeploymentCheck';
import { NetworkBadge } from '@/components/NetworkBadge';
import { StatusChip } from '@/components/StatusChip';
import { HonestyChips, InfoTip, Page, type HonestyFact } from '@/components/ui';
import type { WebReport } from '@/lib/types';
import type { MarketView } from '@/protocol';
import { useChainTime } from '@/protocol/hooks';
import { KeyDates } from './KeyDates';
import { choiceKey, linkTargets, useMarketChoices } from './MarketContext';
import { MarketPicker } from './MarketPicker';
import { marketTitle } from './marketName';
import { useLinkedReports } from './useLinkedReport';

export type CaseTab = 'overview' | 'stake' | 'market' | 'result' | 'chains';
/** '/case' for V1 and the fixture chain; '/onchain' for V2 (never mapped to a backend report). */
export type CaseBase = '/case' | '/onchain' | `/markets/${string}`;

const TABS: [CaseTab, string][] = [
  ['stake', 'Stake'],
  ['market', 'Trade YT'],
  ['result', 'Result & claims'],
  ['chains', 'Chains'],
];

export const casePath = (base: CaseBase, id: bigint | string, tab: CaseTab) => (tab === 'overview' ? `${base}/${id}` : `${base}/${id}/${tab}`);

export function CaseHeader({
  market: m,
  report,
  tab,
  base = '/case',
  facts = [],
}: {
  market: MarketView;
  report?: WebReport;
  tab: CaseTab;
  base?: CaseBase;
  /** Honesty facts for this screen, shown once as chips under the title. */
  facts?: HonestyFact[];
}) {
  const now = useChainTime() ?? m.chainTime;
  const ctx = useMarketChoices();
  const links = useLinkedReports(ctx ? linkTargets(ctx.choices) : [], !!ctx);
  const current = ctx ? choiceKey(ctx) : undefined;
  const linked = current ? links.get(current) : undefined;
  const tabs: [CaseTab, string][] = base !== '/case' ? [['overview', 'Overview'], ...TABS] : TABS;
  const caseRoute = base === '/case';
  const title = caseRoute
    ? `${report?.claimManifest.symbol ? `${report.claimManifest.symbol} · ` : ''}Case #${m.reportId.toString()}`
    : marketTitle({ id: m.reportId, deployment: ctx?.deployment, linked });
  const claim = caseRoute ? report?.claimManifest.claimText : linked?.claimManifest.claimText;
  const chips: HonestyFact[] = [...(m.demoReport && !linked ? (['demoReport'] as const) : []), ...facts, ...(m.demoClock ? (['demoClock'] as const) : [])];
  return (
    <header className="mb-8 space-y-5">
      {ctx && <MarketPicker choices={ctx.choices} current={current!} currentPhase={m.phase} links={links} />}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-[68ch] min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[2.5rem] leading-none break-words sm:text-[3.25rem]">{title}</h1>
            <StatusChip status={m.phase} size="lg" />
          </div>
          {claim ? (
            <p className="mt-3 text-base sm:text-lg">{claim}</p>
          ) : (
            <p className="text-muted mt-3 inline-flex items-center gap-1.5 text-base">
              Demo claim — no linked report
              <InfoTip label="About this demo claim">
                <strong className="block">Demo claim</strong>
                <span className="text-muted mt-1 block">
                  This market was published onchain with demo hashes. No backend research report is linked to it, so there is no token or claim text to show.
                </span>
              </InfoTip>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NetworkBadge chainId={11155111} />
          <DeploymentStatusChip />
        </div>
      </div>
      {chips.length > 0 && <HonestyChips facts={chips} reportId={m.reportId} />}
      <div className="glass px-5 pt-5 pb-4 sm:pt-10">
        <KeyDates market={m} now={now} />
      </div>
      <nav aria-label="Market sections" className="border-line flex gap-1 overflow-x-auto border-b">
        {report && (
          <Link href={`/cases/${encodeURIComponent(report.id)}`} className="text-muted hover:text-text -mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-[15px] whitespace-nowrap">
            Case file
          </Link>
        )}
        {tabs.map(([t, label]) => (
          <Link
            key={t}
            href={casePath(base, m.reportId, t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[15px] whitespace-nowrap ${tab === t ? 'border-beam text-text font-semibold' : 'text-muted hover:text-text border-transparent'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** Shared loading / error frame for /case/[id]/* and /onchain/[id]/* pages. */
export function CaseFrame({ state, children }: { state: { isError: boolean; error?: Error | null; data?: unknown }; children: React.ReactNode }) {
  if (state.isError)
    return (
      <Page>
        <div role="alert" className="glass p-6">
          <p className="font-display text-2xl">This case went cold.</p>
          <p className="text-muted mt-2">{state.error?.message}</p>
          <Link href="/cases" className="text-beam-ink mt-4 inline-block underline">
            Back to the case board
          </Link>
        </div>
      </Page>
    );
  if (!state.data)
    return (
      <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-8 sm:px-6 sm:py-12" aria-busy="true" aria-label="Loading market">
        <div className="sweep h-12 w-full max-w-96" />
        <div className="sweep h-24" />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="sweep h-96" />
          <div className="sweep h-72" />
        </div>
      </main>
    );
  return <>{children}</>;
}
