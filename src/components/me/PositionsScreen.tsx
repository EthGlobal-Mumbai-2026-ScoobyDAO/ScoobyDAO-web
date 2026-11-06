'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueries } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { CcipStakeList } from '@/components/ccip/CcipTracker';
import { EmptyState } from '@/components/EmptyState';
import { SimulatedYieldLabel } from '@/components/HonestyLabels';
import { StatusChip } from '@/components/StatusChip';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatUsdc } from '@/lib/format';
import { payoutFor } from '@/lib/payout';
import type { MarketView, PositionView } from '@/protocol';
import { useActiveAccount, useProtocol, usePublished } from '@/protocol/hooks';

export function PositionsScreen() {
  const { protocol, ready, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const published = usePublished();
  const rows = useQueries({
    queries: (published.data ?? []).map((id) => ({
      queryKey: ['protocol', protocol.kind, 'me', id.toString(), address],
      queryFn: async () => ({ market: await protocol.getMarket(id), pos: await protocol.getPosition(id, address!) }),
      enabled: ready && !!address,
    })),
  });
  const loaded = rows.filter((r) => r.data).map((r) => r.data!);
  const mine = loaded.filter(({ pos }) => hasAnything(pos));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-4xl sm:text-5xl">My positions</h1>
      <p className="text-muted mt-2 max-w-2xl">Everything this wallet holds across published cases. Each claim is its own button.</p>
      {!connected && !fixtureMode ? (
        <div className="mt-8">
          <ConnectButton />
        </div>
      ) : published.isError ? (
        <EmptyState pose="confused" title="Couldn't read the published cases">
          {published.error.message}
        </EmptyState>
      ) : published.isLoading || rows.some((r) => r.isLoading) ? (
        <div className="mt-8 grid gap-4" aria-busy="true" aria-label="Loading positions">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sweep h-32" />
          ))}
        </div>
      ) : mine.length === 0 ? (
        <EmptyState pose="asleep" title="Nothing here yet">
          This wallet has no positions, YT or pending cross-chain stakes. <Link href="/cases" className="text-beam-ink underline">Browse cases</Link>.
        </EmptyState>
      ) : (
        <ul className="mt-8 space-y-4">
          {mine.map(({ market, pos }) => (
            <li key={market.reportId.toString()}>
              <PositionRow market={market} pos={pos} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const hasAnything = (p: PositionView) =>
  p.yes > 0n || p.no > 0n || p.yt > 0n || p.ytClaimable > 0n || p.lpShares > 0n || p.lpClaimable > 0n || p.pendingCcip.length > 0 || p.repBadge;

function PositionRow({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const plan = usePlan();
  const outcome = m.decision?.outcome;
  return (
    <article className="glass space-y-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">
          <Link href={`/case/${m.reportId}/result`} className="hover:underline">
            Case #{m.reportId.toString()}
          </Link>
        </h2>
        <StatusChip status={m.phase} />
        {pos.repBadge && (
          <span className="text-clue-ink inline-flex items-center gap-1 text-sm font-semibold">
            <BadgeCheck size={16} aria-hidden /> REP badge
          </span>
        )}
      </header>
      <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {(['yes', 'no'] as const).map((s) =>
          pos[s] > 0n ? (
            <Item key={s} title={`${s === 'yes' ? 'Yes' : 'No'} position`} value={`${formatUsdc(pos[s])} dUSD`}>
              {outcome ? (
                <>
                  <p>Redeemable {formatUsdc(payoutFor(outcome, s, pos[s], m.totals), { exact: true })}</p>
                  <button type="button" disabled={plan.running} onClick={() => void plan.start(() => protocol.redeem(m.reportId, s === 'yes', pos[s]))} className="btn-claim">
                    Claim
                  </button>
                </>
              ) : (
                <p className="text-muted">Redeemable once final</p>
              )}
            </Item>
          ) : null,
        )}
        {(pos.yt > 0n || pos.ytClaimable > 0n) && (
          <Item title="Yield token (YT)" value={`${formatUsdc(pos.yt)} YT`}>
            <p>
              Claimable {formatUsdc(pos.ytClaimable, { exact: true })} dUSD <SimulatedYieldLabel />
            </p>
            <button type="button" disabled={plan.running} onClick={() => void plan.start(() => protocol.claimYield(m.reportId, address!))} className="btn-claim">
              Claim
            </button>
          </Item>
        )}
        {(pos.lpShares > 0n || pos.lpClaimable > 0n) && (
          <Item title="LP shares" value={formatUsdc(pos.lpShares)}>
            <p>Claimable LP yield {formatUsdc(pos.lpClaimable, { exact: true })} dUSD</p>
            {protocol.claimLPYield && (
              <button type="button" disabled={plan.running} onClick={() => void plan.start(() => protocol.claimLPYield!(m.reportId))} className="btn-claim">
                Claim
              </button>
            )}
          </Item>
        )}
      </div>
      {pos.pendingCcip.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Pending or held CCIP stakes</p>
          <CcipStakeList stakes={pos.pendingCcip} />
        </div>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </article>
  );
}

function Item({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="border-line space-y-1 rounded-xl border p-3">
      <p className="text-muted">{title}</p>
      <p className="num text-lg font-semibold">{value}</p>
      {children}
    </div>
  );
}
