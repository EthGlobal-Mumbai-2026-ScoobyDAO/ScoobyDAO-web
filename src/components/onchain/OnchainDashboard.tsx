'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArrowRightLeft, Gavel, Globe2, Scale } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader, casePath, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { Countdown } from '@/components/Countdown';
import { DeploymentCheckCard } from '@/components/DeploymentCheck';
import { HashText } from '@/components/HashText';
import { CurveNotOracleLabel, DemoReportLabel, PublicStakesLabel, SimulatedYieldLabel, TestTokenLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { OddsBar } from '@/components/OddsBar';
import { TxLink } from '@/components/TxLink';
import { formatDate, formatDuration, formatEth, formatUsdc, formatWad } from '@/lib/format';
import { claimsCloseAt, formatRateWad, isSameAddress, remoteCutoffOf, V2_INFO, type MarketView } from '@/protocol';
import { useProtocol } from '@/protocol/hooks';
import { useActiveAccount, useChainTime, usePosition } from '@/protocol/hooks';

const SEPOLIA = 11155111;
const ARB = 421614;

/** /onchain/[reportId]: everything read from chain for one V2 report. Never mapped to a backend report. */
export function OnchainDashboard({ id, base = '/onchain' }: { id: string; base?: CaseBase }) {
  const { market } = useCase(id, base);
  return <CaseFrame state={market}>{market.data && <Dashboard m={market.data} base={base} />}</CaseFrame>;
}

function Dashboard({ m, base }: { m: MarketView; base: CaseBase }) {
  const { protocol } = useProtocol();
  const info = protocol.kind === 'v2' ? (protocol as typeof import('@/protocol/v2').v2).deploymentBundle : V2_INFO;
  const series = m.series !== false;
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
      <CaseHeader market={m} tab="overview" base={base} />
      <div className="flex flex-wrap gap-2">
        {m.demoReport && <DemoReportLabel id={m.reportId} />}
        <PublicStakesLabel />
        <TestTokenLabel />
        <SimulatedYieldLabel />
      </div>
      {!series && (
        <Banner tone="info" title="Published onchain — no market deployed for this report yet">
          One V2 vault serves one report. This report is in the registry, but it has no vault, yield token, pool or CCIP sender, so there is nothing to stake,
          trade or claim here.
        </Banner>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard m={m} />
        <TimesCard m={m} />
        {series && <VaultCard m={m} />}
        {series && <PoolCard m={m} />}
        {series && <PositionCard m={m} />}
        {series && <DeploymentCheckCard />}
        {series && <ContractsCard info={info} />}
      </div>
      {series && (
        <nav aria-label="Report actions" className="flex flex-wrap gap-3">
          <Link href={casePath(base, m.reportId, 'stake')} className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105">
            <Scale size={16} aria-hidden /> Stake Yes / No
          </Link>
          <Link href={casePath(base, m.reportId, 'market')} className="border-line inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]">
            <ArrowRightLeft size={16} aria-hidden /> Trade YT
          </Link>
          <Link href={casePath(base, m.reportId, 'result')} className="border-line inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]">
            <Gavel size={16} aria-hidden /> Result &amp; claims
          </Link>
          {info.exampleCCIP.messageId !== `0x${'0'.repeat(64)}` && <Link href={`/tx/ccip/${info.exampleCCIP.messageId}`} className="border-line inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]">
            <Globe2 size={16} aria-hidden /> See a delivered CCIP example
          </Link>}
        </nav>
      )}
    </main>
  );
}

function Card({ title, chains, children, labels }: { title: string; chains: number[]; children: ReactNode; labels?: ReactNode }) {
  return (
    <section aria-label={title} className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="flex flex-wrap gap-1.5">
          {chains.map((c) => (
            <NetworkBadge key={c} chainId={c} />
          ))}
        </span>
      </div>
      {labels && <div className="flex flex-wrap gap-2">{labels}</div>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function ReportCard({ m }: { m: MarketView }) {
  const demoRoles = [m.reviewer, m.resolver, m.adjudicator].every((a) => isSameAddress(a, V2_INFO.deployer));
  return (
    <Card title={`Report #${m.reportId} · ReportRegistry`} chains={[SEPOLIA]}>
      <dl className="space-y-3 text-sm">
        <Row label="reportHash">
          <HashText value={m.reportHash} label="report hash" />
        </Row>
        <Row label="claimHash">
          <HashText value={m.claimHash} label="claim hash" />
        </Row>
      </dl>
      <p className="text-muted text-sm">
        {m.demoReport
          ? 'Demo hashes — no backend report is linked. Nothing here was approved through World ID.'
          : 'These hashes are not matched to a backend research report on this page. A backend case file links here only after its claim hash matches the registry.'}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Reviewer">
          <TxLink kind="address" value={m.reviewer} chainId={SEPOLIA} />
        </Row>
        <Row label="Resolver (proposes)">
          <TxLink kind="address" value={m.resolver} chainId={SEPOLIA} />
        </Row>
        <Row label="Adjudicator (settles challenges)">
          <TxLink kind="address" value={m.adjudicator} chainId={SEPOLIA} />
        </Row>
        {m.treasury && (
          <Row label="Treasury (receives the 20% fee)">
            <TxLink kind="address" value={m.treasury} chainId={SEPOLIA} />
          </Row>
        )}
      </dl>
      {demoRoles && <p className="text-beam-ink text-sm font-semibold">Demo roles: all held by the deployer wallet.</p>}
    </Card>
  );
}

function TimesCard({ m }: { m: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const remote = remoteCutoffOf(m);
  const claimsClose = claimsCloseAt(m);
  const rows: [string, number | undefined, string][] = [
    ['Cross-chain sends close (CCIP sender cutoff)', remote, 'Arbitrum Sepolia stakeRemote reverts from here'],
    ['Local stakes lock', m.lockTime, 'vault.stake reverts CLOSED from here'],
    ['Maturity (lock + 30 days)', m.maturity, 'Swaps and new liquidity stop; the resolver may propose'],
    ['Result deadline', m.resultDeadline, 'After this, finalize() makes the report Void'],
    ['Claims close (finalized + 90 days)', claimsClose, 'claimPrincipal reverts EXPIRED after this'],
  ];
  return (
    <Card title="Timeline (from the latest block)" chains={remote !== undefined ? [SEPOLIA, ARB] : [SEPOLIA]}>
      <dl className="space-y-3 text-sm">
        {rows.map(([label, at, hint]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt>
              {label}
              <span className="text-muted block text-xs">{hint}</span>
            </dt>
            <dd className="text-right">
              {at ? (
                <>
                  <span className="block">{formatDate(at)}</span>
                  <span className="text-muted text-xs">
                    <Countdown to={at} now={now} endedLabel="passed" />
                  </span>
                </>
              ) : (
                <span className="text-muted">{label.startsWith('Cross') ? (m.remoteError ? 'Arbitrum read failed' : 'not configured') : 'after finalization'}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted text-xs">
        Registry crossChainCutoff {formatDate(m.crossChainCutoff)} · challenge period {formatDuration(m.challengePeriod)}. Countdowns use the chain&apos;s block
        time, not this computer&apos;s clock.
      </p>
    </Card>
  );
}

function VaultCard({ m }: { m: MarketView }) {
  const d = m.decision;
  const total = m.totals.yes + m.totals.no;
  return (
    <Card title="Vault (RiskFiStakeVaultV2)" chains={[SEPOLIA]} labels={<PublicStakesLabel />}>
      <dl className="grid grid-cols-3 gap-3">
        {[
          ['Total', total, 'text-text'],
          ['Yes', m.totals.yes, 'text-beam-ink'],
          ['No', m.totals.no, 'text-clue-ink'],
        ].map(([label, v, ink]) => (
          <div key={label as string}>
            <dt className="text-muted text-xs">{label as string} (dUSD)</dt>
            <dd className={`num mt-1 text-lg font-semibold ${ink as string}`}>{formatUsdc(v as bigint)}</dd>
          </div>
        ))}
      </dl>
      <OddsBar yes={m.totals.yes} no={m.totals.no} />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label={d?.finalizedAt ? 'Principal available (set at finalization)' : 'Principal backing positions now'}>
          <span className="num">{formatUsdc((d?.finalizedAt ? m.principalAvailable : m.projectedPrincipal) ?? 0n)}</span> of{' '}
          <span className="num">{formatUsdc(total)}</span> dUSD
        </Row>
        <Row label="YT minted">
          <span className="num">{m.yt?.totalSupply !== undefined ? formatUsdc(m.yt.totalSupply) : '—'}</span> YT
        </Row>
        <Row label="Proposed">{d?.proposedAt ? `${d.proposed?.toUpperCase() ?? '—'} on ${formatDate(d.proposedAt)}` : 'Not yet (opens at maturity)'}</Row>
        <Row label="Challenged">{d?.challenged ? 'Yes — the adjudicator decides' : 'No'}</Row>
        <Row label="Final outcome">{d?.outcome ? `${d.outcome.toUpperCase()} on ${formatDate(d.finalizedAt!)}` : 'Not final'}</Row>
        {d?.proposedAt ? (
          <Row label="Evidence hash">
            <HashText value={d.evidenceHash} label="evidence hash" />
          </Row>
        ) : null}
      </dl>
      <p className="text-muted text-xs">Yes/No positions are recorded in the vault and can&apos;t be transferred. The YT minted with each stake can.</p>
    </Card>
  );
}

function PoolCard({ m }: { m: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const p = m.market;
  return (
    <Card title="YT/dUSD market (YieldCurveHookV2)" chains={[SEPOLIA]} labels={<><CurveNotOracleLabel /><SimulatedYieldLabel /></>}>
      {!p ? (
        <p className="text-muted text-sm">The hook isn&apos;t configured for this report.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Row label="Price (dUSD per YT)">
            <span className="num text-lg font-semibold">{formatWad(p.spotPriceWad, 6)}</span>
          </Row>
          <Row label="Implied APR">
            <span className="num text-lg font-semibold">{p.impliedRateWad !== undefined ? formatRateWad(p.impliedRateWad) : '—'}</span>
          </Row>
          <Row label="dUSD reserve">
            <span className="num">{formatUsdc(p.reserves?.usdc ?? 0n)}</span>
          </Row>
          <Row label="YT reserve">
            <span className="num">{formatUsdc(p.reserves?.yt ?? 0n)}</span>
          </Row>
          <Row label="Time to maturity">{now < p.maturity ? formatDuration(p.maturity - now) : 'matured'}</Row>
          <Row label="Hook fee">{p.feePips !== undefined ? `${(p.feePips / 10_000).toFixed(2)}%` : '—'}</Row>
          <Row label="Time remaining (years, curve input)">
            <span className="num">{formatWad(p.timeRemainingWad, 4)}</span>
          </Row>
          <Row label="RF-YLP supply">
            <span className="num">{p.sharesSupply !== undefined ? formatUsdc(p.sharesSupply) : '—'}</span>
          </Row>
        </dl>
      )}
    </Card>
  );
}

function PositionCard({ m }: { m: MarketView }) {
  const { address, connected } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  const pos = position.data;
  return (
    <Card title="Your wallet" chains={[SEPOLIA, ARB]}>
      {!address ? (
        <div className="space-y-2">
          <p className="text-sm">Connect a wallet to see your positions, REP receipts, YT and LP shares.</p>
          {!connected && <ConnectButton />}
        </div>
      ) : position.isError ? (
        <p className="text-mask-ink text-sm">Couldn&apos;t read your balances: {position.error.message}</p>
      ) : !pos ? (
        <div className="sweep h-32" aria-busy="true" aria-label="Loading your balances" />
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Yes position (not transferable)">
            <span className="num text-beam-ink font-semibold">{formatUsdc(pos.yes)}</span>
          </Row>
          <Row label="No position (not transferable)">
            <span className="num text-clue-ink font-semibold">{formatUsdc(pos.no)}</span>
          </Row>
          <Row label="REP receipts (deposited, not staked)">
            <span className="num">{formatUsdc(pos.repReceipt)}</span> REP
          </Row>
          <Row label="Yield token (transferable)">
            <span className="num">{formatUsdc(pos.yt)}</span> YT · claimable <span className="num">{formatUsdc(pos.ytClaimable, { exact: true })}</span> dUSD
          </Row>
          <Row label="LP shares">
            <span className="num">{formatUsdc(pos.lpShares)}</span> RF-YLP · LP yield ≈ <span className="num">{formatUsdc(pos.lpClaimable, { exact: true })}</span> dUSD
          </Row>
          <Row label="dUSD on Ethereum Sepolia">
            <span className="num">{formatUsdc(pos.dusdBalance)}</span>
          </Row>
          <Row label="On Arbitrum Sepolia (CCIP source)">
            {pos.remote ? (
              <>
                <span className="num">{formatUsdc(pos.remote.dusdBalance)}</span> dUSD · <span className="num">{formatEth(pos.remote.ethBalance, 5)}</span> ETH
              </>
            ) : (
              <span className="text-muted">unavailable</span>
            )}
          </Row>
        </dl>
      )}
    </Card>
  );
}

function ContractsCard({ info }: { info: typeof V2_INFO | typeof import('@/contracts/v2').v2 }) {
  const rows: [string, string, number][] = [
    ['ReportRegistry (V2)', info.sepolia.ReportRegistry, SEPOLIA],
    ['RiskFiStakeVaultV2', info.sepolia.RiskFiStakeVaultV2, SEPOLIA],
    ['StakeReceiptREP', info.sepolia.StakeReceiptREP, SEPOLIA],
    ['StakerYieldToken (YT)', info.sepolia.StakerYieldToken, SEPOLIA],
    ['YieldCurveHookV2', info.sepolia.YieldCurveHookV2, SEPOLIA],
    ['YieldLPShare (RF-YLP)', info.sepolia.YieldLPShare, SEPOLIA],
    ['YieldSwapRouter', info.sepolia.YieldSwapRouter, SEPOLIA],
    ['StakeAndSellRouterV2', info.sepolia.StakeAndSellRouterV2, SEPOLIA],
    ['CCIPStakeReceiverV2', info.sepolia.CCIPStakeReceiverV2, SEPOLIA],
    ['DemoUSD (dUSD, test token)', info.sepolia.DemoUSD, SEPOLIA],
    ['CCIPStakeSenderV2', info.arbitrumSepolia.CCIPStakeSenderV2, ARB],
    ['DemoUSD (dUSD, test token)', info.arbitrumSepolia.DemoUSD, ARB],
  ];
  return (
    <Card title={`Contracts (handoff bundle ${info.version})`} chains={[SEPOLIA, ARB]}>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([name, address, chainId]) => (
          <div key={`${chainId}:${name}`} className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-muted">
              {name} <NetworkBadge chainId={chainId} label={chainId === ARB ? 'Arbitrum' : 'Sepolia'} />
            </dt>
            <dd>
              <TxLink kind="address" value={address} chainId={chainId} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted text-xs">
        Pool key: dUSD/YT, fee 0, tick spacing 1, hooks = YieldCurveHookV2 (hash <span className="num">{info.poolKeyHash.slice(0, 10)}…</span>). Liquidity is hook-owned.
      </p>
    </Card>
  );
}
