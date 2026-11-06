'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { CcipNotVoteLabel, PublicStakesLabel, TestTokenLabel } from '@/components/HonestyLabels';
import { TxPlanStepper, usePlan, WrongChainPrompt } from '@/components/TxPlanStepper';
import { env } from '@/lib/env';
import { formatDate, formatEth, formatUsdc, parseUsdc } from '@/lib/format';
import { useEnsureChain } from '@/lib/useEnsureChain';
import {
  ccipV1Deployed,
  ccipV2Deployed,
  DEFAULT_SLIPPAGE_BPS,
  minOutFor,
  saveTracked,
  stakingOpen,
  SWAP_DEADLINE_SECONDS,
  type MarketView,
  type PositionView,
} from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol } from '@/protocol/hooks';
import { CcipStakeList } from '../ccip/CcipTracker';
import { GetTestFunds } from './GetTestFunds';
import { PayoutPreview } from './PayoutPreview';
import { SidePicker, type SideKey } from './SidePicker';
import { TotalsCard } from './TotalsCard';

type Source = 'local' | 'ccip';
const SEPOLIA = 11155111;
const ARB = 421614;

export function StakeScreen({ id }: { id: string }) {
  const { market, report } = useCase(id);
  return (
    <CaseFrame state={market}>
      {market.data && (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <CaseHeader market={market.data} report={report} tab="stake" />
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <StakePanel market={market.data} />
            <div className="space-y-6">
              <TotalsCard market={market.data} />
            </div>
          </div>
        </main>
      )}
    </CaseFrame>
  );
}

function closedReason(m: MarketView): string {
  switch (m.phase) {
    case 'locked':
      return `Stakes locked at ${formatDate(m.lockTime)}. The pool now earns simulated yield until maturity.`;
    case 'matured':
      return `Stakes closed at ${formatDate(m.lockTime)}. The case matured on ${formatDate(m.maturity)}; waiting for the resolver.`;
    case 'proposed':
    case 'challenged':
      return `Stakes closed at ${formatDate(m.lockTime)}. A result has been proposed; see Result & claims.`;
    default:
      return `Stakes closed at ${formatDate(m.lockTime)}. This case is final; see Result & claims.`;
  }
}

function StakePanel({ market: m }: { market: MarketView }) {
  const { protocol, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  const now = useChainTime() ?? m.chainTime;
  const plan = usePlan();
  const [side, setSide] = useState<SideKey | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [source, setSource] = useState<Source>('local');
  const [ytMode, setYtMode] = useState<'keep' | 'sell'>('keep');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const ensureEth = useEnsureChain(SEPOLIA);
  const ensureArb = useEnsureChain(ARB);

  const open = stakingOpen(m.phase);
  const ccipDeployed = fixtureMode || (env.protocol === 'v2' ? ccipV2Deployed : ccipV1Deployed);
  const remoteCutoff = m.remoteCutoff || 0;
  const ccipOpen = m.phase === 'open' && ccipDeployed && remoteCutoff > now;
  const src: Source = source === 'ccip' && ccipOpen ? 'ccip' : 'local';
  const amount = parseUsdc(amountStr);
  const pos = position.data;
  const balance = src === 'ccip' ? pos?.remote?.dusdBalance : pos?.dusdBalance;
  const v2Sell = env.protocol === 'v2' && ytMode === 'sell' && src === 'local';

  const ccipQuote = useQuery({
    queryKey: ['protocol', protocol.kind, 'ccipQuote', m.reportId.toString(), side, amount?.toString(), address],
    queryFn: () => protocol.quoteRemote!(m.reportId, side === 'yes', amount!, address!),
    enabled: src === 'ccip' && !!side && !!amount && !!address && !!protocol.quoteRemote,
    refetchInterval: 30_000,
  });
  const sellQuote = useQuery({
    queryKey: ['protocol', protocol.kind, 'sellQuote', amount?.toString()],
    queryFn: () => protocol.quoteStakeAndSell!(amount!),
    enabled: v2Sell && !!amount && !!protocol.quoteStakeAndSell,
    refetchInterval: 15_000,
  });

  if (!open)
    return (
      <section className="glass space-y-4 p-6">
        <h2 className="font-display text-2xl">Staking is closed</h2>
        <p>{closedReason(m)}</p>
        <Link href={`/case/${m.reportId}/result`} className="text-beam-ink underline">
          Go to result &amp; claims
        </Link>
        {pos && <MyPosition pos={pos} />}
      </section>
    );

  const error =
    amountStr && amount === null
      ? 'Enter an amount with at most 6 decimals.'
      : amount !== null && amount <= 0n
        ? 'Enter more than 0.'
        : amount && balance !== undefined && amount > balance
          ? `Insufficient dUSD on ${src === 'ccip' ? 'Arbitrum Sepolia' : 'Ethereum Sepolia'} (you have ${formatUsdc(balance)}).`
          : null;
  const canSubmit = !!side && !!amount && amount > 0n && !error && !!address && !plan.running && (!v2Sell || sellQuote.data !== undefined);

  const submit = async () => {
    if (!side || !amount || !address) return;
    const yes = side === 'yes';
    const deadline = now + SWAP_DEADLINE_SECONDS;
    const r = await plan.start(() =>
      src === 'ccip'
        ? protocol.stakeRemote!(m.reportId, yes, amount, address)
        : v2Sell
          ? protocol.stakeAndSell!(m.reportId, yes, amount, minOutFor(sellQuote.data ?? 0n, slippageBps), deadline, address)
          : protocol.stakeLocal(m.reportId, yes, amount, address),
    );
    if (r.ok && r.effect.messageId) {
      saveTracked({
        messageId: r.effect.messageId,
        reportId: m.reportId.toString(),
        side,
        amount: amount.toString(),
        sourceTx: r.lastHash,
        savedAt: now,
      });
      setLastMessage(r.effect.messageId);
    }
    if (r.ok) setAmountStr('');
  };

  return (
    <section aria-labelledby="stake-h" className="glass space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stake-h" className="font-display text-2xl">
          Stake Yes or No
        </h2>
        <div className="flex flex-wrap gap-2">
          <PublicStakesLabel />
          <TestTokenLabel />
        </div>
      </div>

      {!connected && !fixtureMode ? (
        <div className="space-y-3">
          <p>Connect a wallet to stake.</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-muted mb-1 text-sm">Stake from</legend>
            {(
              [
                ['local', 'Ethereum Sepolia (direct)', 'VoteMarket.stakeLocal. Open until lock.'],
                ['ccip', 'Arbitrum Sepolia (via Chainlink CCIP)', ccipOpen ? `Open until the cross-chain cutoff, ${formatDate(remoteCutoff)}.` : !ccipDeployed ? 'Not deployed yet.' : m.phase !== 'open' ? 'Closed: past the cross-chain cutoff.' : 'Not configured for this report yet.'],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${src === k ? 'border-beam' : 'border-line'} ${k === 'ccip' && !ccipOpen ? 'cursor-not-allowed opacity-60' : ''}`}>
                <input type="radio" name="source" className="mt-1" checked={src === k} disabled={k === 'ccip' && !ccipOpen} onChange={() => setSource(k)} />
                <span>
                  <span className="font-semibold">{label}</span>
                  <span className="text-muted block text-sm">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <SidePicker value={side} onChange={setSide} disabled={plan.running} />

          <div>
            <label htmlFor="amount" className="text-muted text-sm">
              Amount (dUSD)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="10.00"
                aria-invalid={!!error}
                aria-describedby="amount-help"
                className="num border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-3 py-2.5 text-lg outline-none"
              />
              <button
                type="button"
                disabled={balance === undefined}
                onClick={() => balance !== undefined && setAmountStr(formatUsdc(balance, { exact: true }).replace(/,/g, ''))}
                className="border-line rounded-xl border px-3 font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
              >
                Max
              </button>
            </div>
            <p id="amount-help" className={`mt-1 text-sm ${error ? 'text-mask-ink' : 'text-muted'}`}>
              {error ?? (balance !== undefined ? `Balance: ${formatUsdc(balance)} dUSD` : 'Reading balance…')}
            </p>
          </div>

          {env.protocol === 'v2' && src === 'local' && (
            <fieldset className="space-y-2">
              <legend className="text-muted mb-1 text-sm">Your yield token (YT)</legend>
              {(['keep', 'sell'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="yt" checked={ytMode === k} onChange={() => setYtMode(k)} />
                  {k === 'keep' ? 'Keep my YT' : 'Sell my YT now'}
                </label>
              ))}
              {ytMode === 'sell' && (
                <p className="text-sm">
                  You receive about <span className="num font-semibold">{sellQuote.data !== undefined ? formatUsdc(sellQuote.data, { exact: true }) : '…'}</span> dUSD now; minimum{' '}
                  <span className="num">{formatUsdc(minOutFor(sellQuote.data ?? 0n, slippageBps), { exact: true })}</span> at{' '}
                  <label>
                    <span className="sr-only">Slippage in percent</span>
                    <input type="number" min={0} max={50} step={0.1} value={slippageBps / 100} onChange={(e) => setSlippageBps(Math.round(Number(e.target.value) * 100))} className="num border-line w-16 rounded border bg-transparent px-1" />
                  </label>
                  % slippage.
                </p>
              )}
              <p className="text-muted text-xs">V2 positions are non-transferable. Selling YT keeps your Yes/No position.</p>
            </fieldset>
          )}

          {src === 'ccip' && (
            <div className="border-line space-y-1 rounded-xl border p-3 text-sm">
              <p>
                CCIP fee:{' '}
                <span className="num font-semibold">{ccipQuote.data ? `${formatEth(ccipQuote.data.fee, 6)} ETH` : ccipQuote.isFetching ? 'quoting…' : '—'}</span>{' '}
                <span className="text-muted">(paid on Arbitrum Sepolia; any excess is refunded)</span>
              </p>
              {ccipQuote.data && (
                <p className="text-muted">
                  Must be credited by {formatDate(ccipQuote.data.deadline)}. Cross-chain cutoff {formatDate(ccipQuote.data.cutoff)}. A message that arrives after
                  lock is held, not counted, and your dUSD stays recoverable.
                </p>
              )}
              {ccipQuote.isError && <p className="text-mask-ink">Couldn&apos;t quote the fee: {ccipQuote.error.message}</p>}
              <CcipNotVoteLabel />
            </div>
          )}

          {side && amount && amount > 0n && <PayoutPreview totals={m.totals} side={side} amount={amount} />}

          {connected && <WrongChainPrompt ensure={src === 'ccip' ? ensureArb : ensureEth} />}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="bg-beam text-on-beam w-full rounded-xl px-4 py-3 text-lg font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {plan.running ? 'Working…' : side ? `Stake ${amount ? formatUsdc(amount) : ''} dUSD on ${side === 'yes' ? 'Yes' : 'No'}${src === 'ccip' ? ' via CCIP' : ''}` : 'Pick Yes or No'}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {plan.result?.ok && !lastMessage && <Banner tone="success" title="Stake recorded">Your position is below.</Banner>}
          {lastMessage && (
            <Banner tone="info" title="Sent via Chainlink CCIP">
              Not a vote until it is credited on Ethereum Sepolia.{' '}
              <Link href={`/tx/ccip/${lastMessage}`} className="text-beam-ink underline">
                Track message
              </Link>
            </Banner>
          )}
          <GetTestFunds token={protocol.dusd} chainId={src === 'ccip' ? ARB : SEPOLIA} />
        </>
      )}
      {pos && <MyPosition pos={pos} />}
    </section>
  );
}

function MyPosition({ pos }: { pos: PositionView }) {
  return (
    <div className="border-line border-t pt-4">
      <h3 className="font-semibold">Your position</h3>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Yes</dt>
          <dd className="num text-beam-ink text-lg font-semibold">{formatUsdc(pos.yes)}</dd>
        </div>
        <div>
          <dt className="text-muted">No</dt>
          <dd className="num text-clue-ink text-lg font-semibold">{formatUsdc(pos.no)}</dd>
        </div>
      </dl>
      <p className="text-muted mt-1 text-xs">
        {pos.transferable ? 'V1 positions are ERC-1155 VotingPositionToken balances at tokenId(reportId, yes).' : 'V2 positions are non-transferable.'}
      </p>
      {pos.pendingCcip.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Cross-chain stakes not yet counted</p>
          <CcipStakeList stakes={pos.pendingCcip} />
        </div>
      )}
    </div>
  );
}
