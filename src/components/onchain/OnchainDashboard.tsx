'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArrowRight, ArrowRightLeft, Gavel, HandCoins, Scale } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CaseFrame, CaseHeader, casePath, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { Countdown } from '@/components/Countdown';
import { DeploymentCheckCard } from '@/components/DeploymentCheck';
import { HashText } from '@/components/HashText';
import { NetworkBadge } from '@/components/NetworkBadge';
import { OddsBar } from '@/components/OddsBar';
import { PayoutCalculator } from '@/components/stake/PayoutCalculator';
import { TxLink } from '@/components/TxLink';
import { Card, EmptyState, KeyValue, LoadState, Page, TechnicalDetails } from '@/components/ui';
import { formatDate, formatDuration, formatEth, formatUsdc, formatWad } from '@/lib/format';
import { claimsCloseAt, formatRateWad, isSameAddress, remoteCutoffOf, stakingOpen, V2_INFO, type MarketView } from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol } from '@/protocol/hooks';
import { PHASE_LINE, primaryAction } from './primaryAction';

const SEPOLIA = 11155111;
const ARB = 421614;

const ACTION_ICON = { stake: Scale, market: ArrowRightLeft, result: Gavel, overview: Gavel, chains: Gavel } as const;

/** /onchain/[reportId] and /markets/…/[reportId]: one V2 report, summary first. Never mapped to a backend report by id. */
export function OnchainDashboard({ id, base = '/onchain' }: { id: string; base?: CaseBase }) {
  const { market } = useCase(id, base);
  return <CaseFrame state={market}>{market.data && <Dashboard m={market.data} base={base} />}</CaseFrame>;
}

function Dashboard({ m, base }: { m: MarketView; base: CaseBase }) {
  const { protocol } = useProtocol();
  const info = protocol.kind === 'v2' ? (protocol as typeof import('@/protocol/v2').v2).deploymentBundle : V2_INFO;
  const series = m.series !== false;
  return (
    <Page>
      <CaseHeader market={m} tab="overview" base={base} facts={['testToken', 'publicStakes', 'simulatedYield']} />
      {!series ? (
        <Card>
          <EmptyState pose="thinking" title="No market here yet">
            This report is published onchain, but nobody has deployed its stake vault or yield market, so there is nothing to stake, trade or claim.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <PoolSummary m={m} base={base} />
            <PositionCard m={m} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="How payouts work">
              <PayoutCalculator totals={m.totals} projectedPrincipal={stakingOpen(m.phase) ? m.projectedPrincipal : undefined} />
            </Card>
            <TimelineCard m={m} />
          </div>
        </>
      )}
      <TechnicalDetails className="mt-8">
        <div className="space-y-6">
          <ReportRecord m={m} />
          {series && <VaultDetails m={m} />}
          {series && <PoolDetails m={m} />}
          {series && <DeploymentCheckCard />}
          {series && <Contracts info={info} />}
        </div>
      </TechnicalDetails>
    </Page>
  );
}

function PoolSummary({ m, base }: { m: MarketView; base: CaseBase }) {
  const now = useChainTime() ?? m.chainTime;
  const action = primaryAction(m, now);
  const total = m.totals.yes + m.totals.no;
  const Icon = action ? ACTION_ICON[action.tab] : Gavel;
  return (
    <Card variant="highlight" className="flex flex-col">
      <p className="text-muted text-[13px]">Total staked</p>
      <p className="font-display mt-1 text-4xl leading-none sm:text-5xl">
        {formatUsdc(total)} <span className="text-muted font-sans text-lg font-semibold">dUSD</span>
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-beam-ink text-[13px] font-medium">Yes</dt>
          <dd className="num text-xl font-semibold">{formatUsdc(m.totals.yes)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-clue-ink text-[13px] font-medium">No</dt>
          <dd className="num text-xl font-semibold">{formatUsdc(m.totals.no)}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <OddsBar yes={m.totals.yes} no={m.totals.no} />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-6">
        {action && (
          <Link
            href={casePath(base, m.reportId, action.tab)}
            className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105"
          >
            <Icon size={18} aria-hidden /> {action.label}
            <ArrowRight size={16} aria-hidden />
          </Link>
        )}
        <p className="text-muted text-sm">{PHASE_LINE[m.phase]}</p>
      </div>
    </Card>
  );
}

function PositionCard({ m }: { m: MarketView }) {
  const { address, connected } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  return (
    <Card title="Your position" actions={address ? <NetworkBadge chainId={SEPOLIA} /> : undefined}>
      {!address ? (
        <div className="space-y-4">
          <p className="text-muted text-[15px]">Connect a wallet to see your stake, yield tokens and claims.</p>
          {!connected && <ConnectButton />}
        </div>
      ) : (
        <LoadState query={position} source="Ethereum Sepolia RPC" compact skeleton={<div className="sweep h-40" />}>
          {(pos) => (
            <KeyValue
              items={[
                { label: 'Yes stake', value: <span className="num text-beam-ink font-semibold">{formatUsdc(pos.yes)} dUSD</span> },
                { label: 'No stake', value: <span className="num text-clue-ink font-semibold">{formatUsdc(pos.no)} dUSD</span> },
                {
                  label: 'Yield tokens (YT)',
                  value: (
                    <span className="num">
                      {formatUsdc(pos.yt)} YT <span className="text-muted text-[13px]">· {formatUsdc(pos.ytClaimable, { exact: true })} dUSD to claim</span>
                    </span>
                  ),
                },
                ...(pos.repReceipt > 0n ? [{ label: 'REP receipts (not staked)', value: <span className="num">{formatUsdc(pos.repReceipt)} REP</span> }] : []),
                ...(pos.lpShares > 0n
                  ? [{ label: 'Liquidity shares', value: <span className="num">{formatUsdc(pos.lpShares)} · ≈{formatUsdc(pos.lpClaimable, { exact: true })} dUSD yield</span> }]
                  : []),
                {
                  label: 'Wallet dUSD',
                  value: (
                    <span className="num">
                      {formatUsdc(pos.dusdBalance)}
                      {pos.remote && <span className="text-muted text-[13px]"> · Arbitrum {formatUsdc(pos.remote.dusdBalance)} · {formatEth(pos.remote.ethBalance, 4)} ETH</span>}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </LoadState>
      )}
    </Card>
  );
}

function TimelineCard({ m }: { m: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const remote = remoteCutoffOf(m);
  const closes = claimsCloseAt(m);
  const rows: { label: string; at?: number; hint: string; missing?: string }[] = [
    { label: 'Cross-chain stakes close', at: remote, hint: 'Last moment to stake from Arbitrum Sepolia', missing: m.remoteError ? 'Arbitrum read failed' : 'Not set up' },
    { label: 'Stakes lock', at: m.lockTime, hint: 'Last moment to stake on Ethereum Sepolia' },
    { label: 'Trading ends', at: m.maturity, hint: 'YT stops trading; a result can be proposed' },
    { label: 'Result due', at: m.resultDeadline, hint: 'No final result by then → Void, stakes back' },
    { label: 'Claims close', at: closes, hint: '90 days after the final result', missing: 'After the result' },
  ];
  return (
    <Card title="Timeline">
      <ol className="space-y-3">
        {rows.map((r) => {
          const passed = r.at !== undefined && now >= r.at;
          return (
            <li key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span>
                <span className={`text-[15px] ${passed ? 'text-muted' : 'font-medium'}`}>{r.label}</span>
                <span className="text-muted block text-[13px]">{r.hint}</span>
              </span>
              <span className="text-right text-[15px]">
                {r.at ? (
                  <>
                    <span className="block">{formatDate(r.at)}</span>
                    <span className={`text-[13px] ${passed ? 'text-muted' : 'text-beam-ink font-semibold'}`}>
                      {passed ? 'passed' : <>in <Countdown to={r.at} now={now} endedLabel="now" /></>}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">{r.missing}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted mt-4 text-[13px]">Countdowns use the chain&apos;s block time.</p>
    </Card>
  );
}

function Group({ title, contract, chains = [SEPOLIA], children }: { title: string; contract?: string; chains?: number[]; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        {contract && <span className="num text-muted text-xs">{contract}</span>}
        <span className="ml-auto flex gap-1.5">
          {chains.map((c) => (
            <NetworkBadge key={c} chainId={c} />
          ))}
        </span>
      </div>
      {children}
    </section>
  );
}

function ReportRecord({ m }: { m: MarketView }) {
  const demoRoles = [m.reviewer, m.resolver, m.adjudicator].every((a) => isSameAddress(a, V2_INFO.deployer));
  return (
    <Group title="Report record" contract="ReportRegistry">
      <KeyValue
        items={[
          { label: 'Report hash', value: <HashText value={m.reportHash} label="report hash" /> },
          { label: 'Claim hash', value: <HashText value={m.claimHash} label="claim hash" /> },
          { label: 'Reviewer', value: <TxLink kind="address" value={m.reviewer} chainId={SEPOLIA} /> },
          { label: 'Resolver (proposes the result)', value: <TxLink kind="address" value={m.resolver} chainId={SEPOLIA} /> },
          { label: 'Adjudicator (settles challenges)', value: <TxLink kind="address" value={m.adjudicator} chainId={SEPOLIA} /> },
          ...(m.treasury ? [{ label: 'Treasury (receives the 20% fee)', value: <TxLink kind="address" value={m.treasury} chainId={SEPOLIA} /> }] : []),
          { label: 'Challenge period', value: formatDuration(m.challengePeriod) },
          { label: 'Registry cross-chain cutoff', value: formatDate(m.crossChainCutoff) },
        ]}
      />
      <p className="text-muted mt-2 text-[13px]">
        {m.demoReport ? 'Demo hashes — no backend report is linked; nothing here was approved through World ID.' : 'A backend case file links here only after its claim hash matches the registry.'}
        {demoRoles && ' Demo roles: all held by the deployer wallet.'}
      </p>
    </Group>
  );
}

function VaultDetails({ m }: { m: MarketView }) {
  const d = m.decision;
  const total = m.totals.yes + m.totals.no;
  return (
    <Group title="Stake vault" contract="RiskFiStakeVaultV2">
      <KeyValue
        items={[
          {
            label: d?.finalizedAt ? 'Principal available (set at finalization)' : 'Principal backing positions now',
            value: <span className="num">{formatUsdc((d?.finalizedAt ? m.principalAvailable : m.projectedPrincipal) ?? 0n)} of {formatUsdc(total)} dUSD</span>,
          },
          { label: 'YT minted', value: <span className="num">{m.yt?.totalSupply !== undefined ? formatUsdc(m.yt.totalSupply) : '—'} YT</span> },
          { label: 'Proposed', value: d?.proposedAt ? `${d.proposed?.toUpperCase() ?? '—'} on ${formatDate(d.proposedAt)}` : 'Not yet (opens at maturity)' },
          { label: 'Challenged', value: d?.challenged ? 'Yes — the adjudicator decides' : 'No' },
          { label: 'Final outcome', value: d?.outcome ? `${d.outcome.toUpperCase()} on ${formatDate(d.finalizedAt!)}` : 'Not final' },
          ...(d?.proposedAt ? [{ label: 'Evidence hash', value: <HashText value={d.evidenceHash} label="evidence hash" /> }] : []),
        ]}
      />
      <p className="text-muted mt-2 text-[13px]">Yes/No positions live in the vault and can&apos;t be transferred. The YT minted with each stake can.</p>
    </Group>
  );
}

function PoolDetails({ m }: { m: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const p = m.market;
  return (
    <Group title="Yield market (Uniswap v4)" contract="YieldCurveHookV2">
      {!p ? (
        <p className="text-muted">The yield market isn&apos;t configured for this report.</p>
      ) : (
        <KeyValue
          items={[
            { label: 'Price (dUSD per YT)', value: <span className="num">{formatWad(p.spotPriceWad, 6)}</span> },
            { label: 'Implied APR', value: <span className="num">{p.impliedRateWad !== undefined ? formatRateWad(p.impliedRateWad) : '—'}</span> },
            { label: 'Pool dUSD / YT', value: <span className="num">{formatUsdc(p.reserves?.usdc ?? 0n)} / {formatUsdc(p.reserves?.yt ?? 0n)}</span> },
            { label: 'Time to maturity', value: now < p.maturity ? formatDuration(p.maturity - now) : 'matured' },
            { label: 'Pool fee', value: p.feePips !== undefined ? `${(p.feePips / 10_000).toFixed(2)}%` : '—' },
            { label: 'Time remaining (years, curve input)', value: <span className="num">{formatWad(p.timeRemainingWad, 4)}</span> },
            { label: 'Liquidity share supply (RF-YLP)', value: <span className="num">{p.sharesSupply !== undefined ? formatUsdc(p.sharesSupply) : '—'}</span> },
          ]}
        />
      )}
    </Group>
  );
}

function Contracts({ info }: { info: typeof V2_INFO | typeof import('@/contracts/v2').v2 }) {
  const rows: [string, string, string, number][] = [
    ['Report registry', 'ReportRegistry', info.sepolia.ReportRegistry, SEPOLIA],
    ['Stake vault', 'RiskFiStakeVaultV2', info.sepolia.RiskFiStakeVaultV2, SEPOLIA],
    ['REP receipt', 'StakeReceiptREP', info.sepolia.StakeReceiptREP, SEPOLIA],
    ['Yield token (YT)', 'StakerYieldToken', info.sepolia.StakerYieldToken, SEPOLIA],
    ['Yield market hook', 'YieldCurveHookV2', info.sepolia.YieldCurveHookV2, SEPOLIA],
    ['Liquidity share', 'YieldLPShare', info.sepolia.YieldLPShare, SEPOLIA],
    ['Swap router', 'YieldSwapRouter', info.sepolia.YieldSwapRouter, SEPOLIA],
    ['Stake-and-sell router', 'StakeAndSellRouterV2', info.sepolia.StakeAndSellRouterV2, SEPOLIA],
    ['CCIP receiver', 'CCIPStakeReceiverV2', info.sepolia.CCIPStakeReceiverV2, SEPOLIA],
    ['dUSD (test token)', 'DemoUSD', info.sepolia.DemoUSD, SEPOLIA],
    ['CCIP sender', 'CCIPStakeSenderV2', info.arbitrumSepolia.CCIPStakeSenderV2, ARB],
    ['dUSD (test token)', 'DemoUSD', info.arbitrumSepolia.DemoUSD, ARB],
  ];
  return (
    <Group title="Contracts" chains={[SEPOLIA, ARB]}>
      <KeyValue
        items={rows.map(([label, name, address, chainId]) => ({
          key: `${chainId}:${name}`,
          label: (
            <>
              {label} <span className="num text-xs">{name}</span> <span className="text-xs">· {chainId === ARB ? 'Arbitrum' : 'Sepolia'}</span>
            </>
          ),
          value: <TxLink kind="address" value={address} chainId={chainId} />,
        }))}
      />
      <p className="text-muted mt-2 text-[13px]">
        Bundle <span className="num break-all">{info.version}</span>. Pool key: dUSD/YT, fee 0, tick spacing 1, hook-owned liquidity (hash{' '}
        <span className="num">{info.poolKeyHash.slice(0, 10)}…</span>).
      </p>
      {info.exampleCCIP.messageId !== `0x${'0'.repeat(64)}` && (
        <Link href={`/tx/ccip/${info.exampleCCIP.messageId}`} className="text-beam-ink mt-2 inline-flex items-center gap-1 text-sm underline">
          <HandCoins size={14} aria-hidden /> See a delivered CCIP example
        </Link>
      )}
    </Group>
  );
}
