'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { linkTargets } from '@/components/case/MarketContext';
import { marketName } from '@/components/case/marketName';
import { useLinkedReports } from '@/components/case/useLinkedReport';
import { Card, EmptyState, HonestyChips, LoadState, Page, PageHeader, StatTile } from '@/components/ui';
import { StatusChip } from '@/components/StatusChip';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { TxProvider } from '@/lib/tx';
import { formatDate, formatUsdc } from '@/lib/format';
import { estimatePaid } from '@/lib/payout';
import { claimPrincipalOpen, claimsCloseAt, claimsExpired, type MarketView, type PositionView } from '@/protocol';
import { ProtocolOverrideProvider, useActiveAccount, useChainTime, useProtocol, usePublished, useTrackedCcip, useWritesAllowed } from '@/protocol/hooks';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { protocolForReport } from '@/protocol/reportProtocol';
import { summarize } from './summarize';

export function PositionsScreen({ reports }: { reports: ReportChoice[] }) {
  const { protocol, ready, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const published = usePublished();
  const tracked = useTrackedCcip();
  const sources = useMemo(
    () => reports.flatMap((report) => {
      const reportProtocol = protocolForReport(report);
      return reportProtocol ? [{ report, protocol: reportProtocol }] : [];
    }),
    [reports],
  );
  const fixtureRows = useQueries({
    queries: (fixtureMode ? (published.data ?? []) : []).map((id) => ({
      queryKey: ['protocol', protocol.kind, 'me', id.toString(), address],
      queryFn: async () => ({ market: await protocol.getMarket(id), pos: await protocol.getPosition(id, address!) }),
      enabled: ready && !!address,
    })),
  });
  const reportRows = useQueries({
    queries: sources.map(({ report, protocol: reportProtocol }) => ({
      queryKey: ['protocol', 'v2', 'me', report.deployment, report.id, report.market?.vault ?? reportProtocol.deploymentBundle.sepolia.RiskFiStakeVaultV2, address],
      queryFn: async () => ({ market: await reportProtocol.getMarket(BigInt(report.id)), pos: await reportProtocol.getPosition(BigInt(report.id), address!) }),
      enabled: !fixtureMode && !!address,
      retry: 1,
    })),
  });
  const loaded = fixtureMode
    ? fixtureRows.filter((row) => row.data).map((row) => ({ ...row.data!, deployment: undefined, reportProtocol: protocol }))
    : reportRows.flatMap((row, index) => row.data ? [{ ...row.data, deployment: sources[index].report.deployment, reportProtocol: sources[index].protocol }] : []);
  const rows = fixtureMode ? fixtureRows : reportRows;
  const failed = rows.find((row) => row.isError);
  const loading = fixtureMode ? published.isLoading || fixtureRows.some((row) => row.isLoading) : reportRows.some((row) => row.isLoading);
  const links = useLinkedReports(linkTargets(reports), !fixtureMode);
  const query = {
    data: loading ? undefined : loaded,
    isError: (fixtureMode && published.isError) || !!failed,
    error: fixtureMode && published.isError ? published.error : failed?.error,
    refetch: () => {
      void published.refetch();
      rows.forEach((r) => void r.refetch());
    },
  };

  return (
    <Page>
      <PageHeader
        title="My positions"
        description="Everything this wallet holds across markets, read from chain. Each claim is its own button."
        actions={
          (connected || fixtureMode) && <Link href="/markets" className="border-line inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 font-semibold hover:border-[var(--fog-400)]">
            Browse markets <ArrowRight size={16} aria-hidden />
          </Link>
        }
      />
      {!connected && !fixtureMode ? (
        <Card>
          <EmptyState
            pose="alert"
            title="Connect a wallet"
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ConnectButton />
                <Link href="/markets" className="text-beam-ink font-semibold underline underline-offset-4">
                  Browse markets
                </Link>
              </div>
            }
          >
            Connect a wallet to see your stakes, yield tokens and claims.
          </EmptyState>
        </Card>
      ) : (
        <LoadState
          query={query}
          source="Ethereum Sepolia RPC"
          skeleton={
            <div className="grid gap-4" aria-label="Loading positions">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="sweep h-24" />
                ))}
              </div>
              <div className="sweep h-40" />
            </div>
          }
        >
          {(all) => {
            const mine = all.filter(({ pos }) => hasAnything(pos));
            const reportIds = new Set(all.map(({ market }) => market.reportId.toString()));
            const otherTracked = tracked.filter((t) => !reportIds.has(t.reportId));
            if (mine.length === 0 && tracked.length === 0)
              return (
                <Card>
                  <EmptyState
                    pose="thinking"
                    title="Nothing here yet"
                    action={
                      <Link href="/markets" className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105">
                        Browse markets <ArrowRight size={16} aria-hidden />
                      </Link>
                    }
                  >
                    This wallet has no stakes, yield tokens, REP receipts, liquidity or cross-chain stakes yet.
                  </EmptyState>
                </Card>
              );
            const t = summarize(mine);
            return (
              <div className="space-y-8">
                <HonestyChips facts={['testToken', 'publicStakes', 'simulatedYield', 'estimate']} />
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatTile label="Staked" value={`${formatUsdc(t.staked)}`} hint="dUSD on Yes and No" />
                  <StatTile label="Claimable now" value={`${formatUsdc(t.claimable)}`} hint="dUSD, estimate" />
                  <StatTile label="Yield tokens" value={`${formatUsdc(t.yt)}`} hint="YT across markets" />
                  <StatTile label="REP receipts" value={`${formatUsdc(t.rep)}`} hint="dUSD deposited, not staked" />
                </div>
                <ul className="space-y-6">
                  {all
                    .filter(({ market, pos }) => hasAnything(pos) || tracked.some((x) => x.reportId === market.reportId.toString()))
                    .map(({ market, pos, deployment, reportProtocol }) => {
                      const name = deployment
                        ? marketName({ id: market.reportId, deployment, linked: links.get(`${deployment}:${market.reportId}`) })
                        : `Case #${market.reportId.toString()}`;
                      return (
                        <li key={`${deployment ?? 'fixture'}:${market.reportId.toString()}`}>
                          {deployment ? (
                            <ProtocolOverrideProvider protocol={reportProtocol}>
                              <TxProvider bundle={reportProtocol.deploymentBundle}>
                                <PositionRow market={market} pos={pos} deployment={deployment} name={name} />
                              </TxProvider>
                            </ProtocolOverrideProvider>
                          ) : (
                            <PositionRow market={market} pos={pos} name={name} />
                          )}
                        </li>
                      );
                    })}
                  {otherTracked.length > 0 && (
                    <li>
                      <Card title="Other cross-chain stakes from this browser">
                        <TrackedCcipList items={otherTracked} />
                      </Card>
                    </li>
                  )}
                </ul>
              </div>
            );
          }}
        </LoadState>
      )}
    </Page>
  );
}

const hasAnything = (p: PositionView) =>
  p.yes > 0n || p.no > 0n || p.yt > 0n || p.ytClaimable > 0n || p.lpShares > 0n || p.lpClaimable > 0n || p.pendingCcip.length > 0 || p.reputationBadge || p.repReceipt > 0n;

function PositionRow({ market: m, pos, deployment, name }: { market: MarketView; pos: PositionView; deployment?: ReportChoice['deployment']; name: string }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const v2 = protocol.kind === 'v2';
  const outcome = m.decision?.outcome;
  const claimOpen = v2 ? claimPrincipalOpen(m, now) : !!outcome;
  const closes = claimsCloseAt(m);
  const href = deployment ? `/markets/${deployment}/${m.reportId}` : v2 ? `/onchain/${m.reportId}` : `/case/${m.reportId}/result`;
  const busy = plan.running || !writes.allowed;
  return (
    <article className="glass space-y-5 p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="min-w-0 text-lg font-semibold">
          <Link href={href} className="hover:underline">
            {name}
          </Link>
        </h2>
        <StatusChip status={m.phase} />
        {pos.reputationBadge && (
          <span className="text-clue-ink inline-flex items-center gap-1 text-sm font-semibold">
            <BadgeCheck size={16} aria-hidden /> Reputation badge (World ID, V1)
          </span>
        )}
        <Link href={href} className="text-beam-ink ml-auto inline-flex items-center gap-1 text-sm font-semibold">
          Open market <ArrowRight size={14} aria-hidden />
        </Link>
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
            <p>Claimable {formatUsdc(pos.ytClaimable, { exact: true })} dUSD</p>
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
          <Item title="Liquidity shares" value={formatUsdc(pos.lpShares)}>
            <p>Liquidity yield ≈ {formatUsdc(pos.lpClaimable, { exact: true })} dUSD</p>
            {protocol.claimLPYield && (
              <button type="button" disabled={busy} onClick={() => void plan.start(() => protocol.claimLPYield!(m.reportId, address))} className="btn-claim">
                Claim
              </button>
            )}
          </Item>
        )}
      </div>
      <TrackedCcipList reportId={m.reportId} extra={pos.pendingCcip} />
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
    <div className="border-line space-y-1.5 rounded-xl border p-4">
      <p className="text-muted text-[13px]">{title}</p>
      <p className="num text-lg font-semibold">{value}</p>
      {children}
    </div>
  );
}
