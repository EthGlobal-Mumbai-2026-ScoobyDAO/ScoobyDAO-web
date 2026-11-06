'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueries } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { EmptyState } from '@/components/EmptyState';
import { DemoReportLabel, SimulatedYieldLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { StatusChip } from '@/components/StatusChip';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatDate, formatUsdc } from '@/lib/format';
import { estimatePaid } from '@/lib/payout';
import { claimPrincipalOpen, claimsCloseAt, claimsExpired, type MarketView, type PositionView } from '@/protocol';
import { useActiveAccount, useChainTime, useProtocol, usePublished, useTrackedCcip, useWritesAllowed } from '@/protocol/hooks';

export function PositionsScreen() {
  const { protocol, ready, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const published = usePublished();
  const tracked = useTrackedCcip();
  const rows = useQueries({
    queries: (published.data ?? []).map((id) => ({
      queryKey: ['protocol', protocol.kind, 'me', id.toString(), address],
      queryFn: async () => ({ market: await protocol.getMarket(id), pos: await protocol.getPosition(id, address!) }),
      enabled: ready && !!address,
    })),
  });
  const loaded = rows.filter((r) => r.data).map((r) => r.data!);
  const failed = rows.find((r) => r.isError);
  const mine = loaded.filter(({ pos }) => hasAnything(pos));
  const reportIds = new Set(loaded.map(({ market }) => market.reportId.toString()));
  const otherTracked = tracked.filter((t) => !reportIds.has(t.reportId));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-4xl sm:text-5xl">My positions</h1>
      <p className="text-muted mt-2 max-w-2xl">Everything this wallet holds, read from chain. Each claim is its own button.</p>
      {!connected && !fixtureMode ? (
        <div className="mt-8">
          <ConnectButton />
        </div>
      ) : published.isError || failed ? (
        <EmptyState pose="confused" title="Couldn't read your positions from chain">
          {(published.error ?? failed?.error)?.message}
        </EmptyState>
      ) : published.isLoading || rows.some((r) => r.isLoading) ? (
        <div className="mt-8 grid gap-4" aria-busy="true" aria-label="Loading positions">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sweep h-32" />
          ))}
        </div>
      ) : mine.length === 0 && tracked.length === 0 ? (
        <EmptyState pose="asleep" title="Nothing here yet">
          This wallet has no positions, YT, REP receipts, LP shares or cross-chain stakes. <Link href="/cases" className="text-beam-ink underline">Browse cases</Link>.
        </EmptyState>
      ) : (
        <ul className="mt-8 space-y-4">
          {loaded
            .filter(({ market, pos }) => hasAnything(pos) || tracked.some((t) => t.reportId === market.reportId.toString()))
            .map(({ market, pos }) => (
              <li key={market.reportId.toString()}>
                <PositionRow market={market} pos={pos} />
              </li>
            ))}
          {otherTracked.length > 0 && (
            <li className="glass p-5">
              <p className="font-semibold">Other cross-chain stakes from this browser</p>
              <TrackedCcipList items={otherTracked} />
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

const hasAnything = (p: PositionView) =>
  p.yes > 0n || p.no > 0n || p.yt > 0n || p.ytClaimable > 0n || p.lpShares > 0n || p.lpClaimable > 0n || p.pendingCcip.length > 0 || p.reputationBadge || p.repReceipt > 0n;

function PositionRow({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const v2 = protocol.kind === 'v2';
  const outcome = m.decision?.outcome;
  const claimOpen = v2 ? claimPrincipalOpen(m, now) : !!outcome;
  const closes = claimsCloseAt(m);
  const href = v2 ? `/onchain/${m.reportId}` : `/case/${m.reportId}/result`;
  const busy = plan.running || !writes.allowed;
  return (
    <article className="glass space-y-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">
          <Link href={href} className="hover:underline">
            {v2 ? 'Report' : 'Case'} #{m.reportId.toString()}
          </Link>
        </h2>
        <StatusChip status={m.phase} />
        <NetworkBadge chainId={11155111} />
        {m.demoReport && <DemoReportLabel id={m.reportId} />}
        {pos.reputationBadge && (
          <span className="text-clue-ink inline-flex items-center gap-1 text-sm font-semibold">
            <BadgeCheck size={16} aria-hidden /> Reputation badge (World ID, V1)
          </span>
        )}
      </header>
      <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {(['yes', 'no'] as const).map((s) =>
          pos[s] > 0n ? (
            <Item key={s} title={`${s === 'yes' ? 'Yes' : 'No'} position${v2 ? ' (not transferable)' : ''}`} value={`${formatUsdc(pos[s])} dUSD`}>
              {!outcome ? (
                <p className="text-muted">Claimable once final (no earlier than {formatDate(m.maturity)})</p>
              ) : claimsExpired(m, now) ? (
                <p className="text-mask-ink">Claims expired {formatDate(closes!)}</p>
              ) : (
                <>
                  <p>
                    Claim {formatUsdc(estimatePaid(outcome, s, pos[s], m.totals, v2 ? m.principalAvailable : undefined), { exact: true })} dUSD
                    {closes && <span className="text-muted"> · until {formatDate(closes)}</span>}
                  </p>
                  <button type="button" disabled={busy || !claimOpen} onClick={() => void plan.start(() => protocol.redeem(m.reportId, s === 'yes', pos[s]))} className="btn-claim">
                    Claim
                  </button>
                </>
              )}
            </Item>
          ) : null,
        )}
        {(pos.yt > 0n || pos.ytClaimable > 0n) && (
          <Item title="Yield token (YT, transferable)" value={`${formatUsdc(pos.yt)} YT`}>
            <p>
              Claimable {formatUsdc(pos.ytClaimable, { exact: true })} dUSD <SimulatedYieldLabel />
            </p>
            <button type="button" disabled={busy || pos.ytClaimable === 0n} onClick={() => void plan.start(() => protocol.claimYield(m.reportId, address!))} className="btn-claim">
              Claim
            </button>
          </Item>
        )}
        {pos.repReceipt > 0n && (
          <Item title="REP receipts (deposited, not staked)" value={`${formatUsdc(pos.repReceipt)} REP`}>
            <p className="text-muted">Withdraw 1:1 to dUSD any time.</p>
            <button type="button" disabled={busy || !protocol.withdrawRep} onClick={() => void plan.start(() => protocol.withdrawRep!(pos.repReceipt, address!))} className="btn-claim">
              Withdraw {formatUsdc(pos.repReceipt)} dUSD
            </button>
          </Item>
        )}
        {(pos.lpShares > 0n || pos.lpClaimable > 0n) && (
          <Item title="LP shares (RF-YLP)" value={formatUsdc(pos.lpShares)}>
            <p>LP yield ≈ {formatUsdc(pos.lpClaimable, { exact: true })} dUSD (estimate until checkpoint)</p>
            {protocol.claimLPYield && (
              <button type="button" disabled={busy} onClick={() => void plan.start(() => protocol.claimLPYield!(m.reportId, address))} className="btn-claim">
                Claim
              </button>
            )}
          </Item>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold">Cross-chain stakes</p>
        <TrackedCcipList reportId={m.reportId} extra={pos.pendingCcip} />
      </div>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
      {plan.result?.ok && plan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD.
        </p>
      )}
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
