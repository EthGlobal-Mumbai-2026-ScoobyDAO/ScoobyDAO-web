'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowRightLeft, Calculator, Gavel, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader, casePath, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { SniffPose } from '@/components/SniffPose';
import { Card, Disclosure, EmptyState, LoadState, Page, type HonestyFact } from '@/components/ui';
import type { WebReport } from '@/lib/types';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxPlanStepper, usePlan, WrongChainPrompt } from '@/components/TxPlanStepper';
import { revertReason } from '@/lib/errors';
import { formatDate, formatEth, formatUsdc } from '@/lib/format';
import { useEnsureChain } from '@/lib/useEnsureChain';
import {
  DEFAULT_SLIPPAGE_BPS,
  isFinal,
  localStakeOpen,
  minOutFor,
  newRemoteAttempt,
  randomNonce,
  remoteCutoffOf,
  remoteSendOpen,
  saveTracked,
  SWAP_DEADLINE_SECONDS,
  tradingOpen,
  V2_INFO,
  withFeeBuffer,
  type MarketView,
  type RemoteAttempt,
} from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol, useWritesAllowed } from '@/protocol/hooks';
import { GetTestFunds } from './GetTestFunds';
import { PayoutPreview } from './PayoutPreview';
import { RepReceiptPanel } from './RepReceiptPanel';
import { SidePicker, type SideKey } from './SidePicker';
import { TotalsCard } from './TotalsCard';
import { YtTransfer } from './YtTransfer';

type Source = 'local' | 'ccip';
const SEPOLIA = 11155111;
const ARB = 421614;
/** Warn about late arrival when a remote send is this close to the cutoff. */
const LATE_WARNING_SECONDS = 3600;

export function StakeScreen({ id, base = '/case' }: { id: string; base?: CaseBase }) {
  const { market, report } = useCase(id, base);
  return (
    <CaseFrame state={market}>
      {market.data && <StakeBody market={market.data} report={report} base={base} />}
    </CaseFrame>
  );
}

/** Remote staking is offered at all (sender configured), independent of whether it is open now. */
function useCcipAvailable() {
  const { protocol } = useProtocol();
  const isV2 = protocol.kind === 'v2';
  return !!protocol.stakeRemote && (!isV2 || (protocol as typeof import('@/protocol/v2').v2).deploymentBundle.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000');
}

function StakeBody({ market: m, report, base }: { market: MarketView; report?: WebReport; base: CaseBase }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const ccipAvailable = useCcipAvailable();
  const open = localStakeOpen(m, now) || (ccipAvailable && remoteSendOpen(m, now));
  const facts: HonestyFact[] = ['testToken', 'publicStakes', 'simulatedYield', 'estimate', ...(open && ccipAvailable ? (['ccipNotVote'] as const) : [])];
  return (
    <Page>
      <CaseHeader market={m} report={report} tab="stake" base={base} facts={facts} />
      {m.series === false ? (
        <Card>
          <EmptyState pose="thinking" title="No market here yet">
            This report is published onchain, but it has no stake vault yet, so there is nothing to stake.
          </EmptyState>
        </Card>
      ) : open ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <StakePanel market={m} />
          <div className="space-y-6">
            <TotalsCard market={m} />
            <PositionCard market={m} />
            {protocol.depositRep && <RepReceiptPanel market={m} />}
          </div>
        </div>
      ) : (
        <ClosedView market={m} base={base} />
      )}
    </Page>
  );
}

function closedReason(m: MarketView): string {
  switch (m.phase) {
    case 'locked':
      return `Stakes locked on ${formatDate(m.lockTime)}. YT keeps trading until ${formatDate(m.maturity)}.`;
    case 'matured':
      return `Stakes locked on ${formatDate(m.lockTime)}. Trading ended; waiting for the resolver to propose a result.`;
    case 'proposed':
    case 'challenged':
      return `Stakes locked on ${formatDate(m.lockTime)}. A result has been proposed.`;
    default:
      return `Stakes locked on ${formatDate(m.lockTime)}. This market has a final result.`;
  }
}

/** Staking closed: one compact banner, then what you can do now. */
function ClosedView({ market: m, base }: { market: MarketView; base: CaseBase }) {
  const { protocol } = useProtocol();
  const now = useChainTime() ?? m.chainTime;
  const final = isFinal(m.phase);
  const trading = tradingOpen(m, now) && !!m.market;
  const actions = [
    { href: casePath(base, m.reportId, 'result'), Icon: Gavel, title: final ? 'Claim your payout' : 'View the result', line: final ? 'Final result is in. Claims stay open 90 days.' : 'Follow the proposal, challenge window and final result.', primary: true },
    ...(trading ? [{ href: casePath(base, m.reportId, 'market'), Icon: ArrowRightLeft, title: 'Trade YT', line: `Buy or sell yield tokens until ${formatDate(m.maturity)}.`, primary: false }] : []),
    ...(!final ? [{ href: casePath(base, m.reportId, 'overview'), Icon: Calculator, title: 'See the payout math', line: 'Try amounts in the payout calculator.', primary: false }] : []),
  ];
  return (
    <div className="space-y-6">
      <div role="status" className="border-line flex flex-wrap items-center gap-3 rounded-[14px] border bg-[color-mix(in_srgb,var(--fog-400)_10%,transparent)] px-5 py-4">
        <Lock size={20} aria-hidden className="text-muted shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Staking is closed.</span> <span className="text-muted">{closedReason(m)}</span>
        </p>
      </div>
      <section aria-labelledby="next-h">
        <h2 id="next-h" className="mb-4 text-[1.375rem] font-semibold sm:text-2xl">
          What you can do now
        </h2>
        <ul className={`grid gap-4 ${actions.length > 2 ? 'md:grid-cols-3' : actions.length === 2 ? 'md:grid-cols-2' : ''}`}>
          {actions.map(({ href, Icon, title, line, primary }) => (
            <li key={title}>
              <Link href={href} className={`group flex h-full items-start gap-3 p-5 ${primary ? 'rounded-[14px] border border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_8%,var(--surface))]' : 'glass'}`}>
                <Icon size={22} aria-hidden className={primary ? 'text-beam-ink mt-0.5 shrink-0' : 'text-muted mt-0.5 shrink-0'} />
                <span>
                  <span className="flex items-center gap-1 text-lg font-semibold">
                    {title} <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                  <span className="text-muted mt-1 block text-sm">{line}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TotalsCard market={m} />
        <div className="space-y-6">
          <PositionCard market={m} promptConnect />
          {protocol.depositRep && <RepReceiptPanel market={m} />}
        </div>
      </div>
    </div>
  );
}

function StakePanel({ market: m }: { market: MarketView }) {
  const { protocol, fixtureMode, deploymentKey } = useProtocol();
  const { address, connected } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const router = useRouter();
  const plan = usePlan();
  const [side, setSide] = useState<SideKey | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [source, setSource] = useState<Source>('local');
  const [ytMode, setYtMode] = useState<'keep' | 'sell'>('keep');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [unlimited, setUnlimited] = useState(false);
  const [recipientStr, setRecipientStr] = useState('');
  // One CCIP attempt = one nonce (and the deadline), the same for the quote and the send.
  const [nonce, setNonce] = useState<bigint>(() => randomNonce());
  const [done, setDone] = useState<string | null>(null);
  const ensureEth = useEnsureChain(SEPOLIA);
  const ensureArb = useEnsureChain(ARB);

  const isV2 = protocol.kind === 'v2';
  const localOpen = localStakeOpen(m, now);
  const remoteCutoff = remoteCutoffOf(m);
  const ccipOpen = !!protocol.stakeRemote && remoteSendOpen(m, now) && (!isV2 || (protocol as typeof import('@/protocol/v2').v2).deploymentBundle.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000');
  const src: Source = source === 'ccip' && ccipOpen ? 'ccip' : 'local';
  const pos = position.data;
  const balance = src === 'ccip' ? pos?.remote?.dusdBalance : pos?.dusdBalance;
  const amount = validAmount(amountStr, balance);
  const sell = isV2 && ytMode === 'sell' && src === 'local' && !!protocol.stakeAndSell;
  const recipient: Address | undefined = recipientStr.trim() ? (isAddress(recipientStr.trim()) ? getAddress(recipientStr.trim()) : undefined) : address;
  const attempt: RemoteAttempt | undefined = recipient ? newRemoteAttempt({ lockTime: m.lockTime, recipient, nonce }) : undefined;

  const ccipQuote = useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'ccipQuote', m.reportId.toString(), side, amount?.toString(), address, recipient, nonce.toString()],
    queryFn: () => protocol.quoteRemote!(m.reportId, side === 'yes', amount!, address!, attempt),
    enabled: src === 'ccip' && !!side && !!amount && !!address && !!attempt && !!protocol.quoteRemote,
    refetchInterval: 30_000,
  });
  const sellQuote = useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'sellQuote', amount?.toString(), m.blockNumber.toString()],
    queryFn: () => protocol.quoteStakeAndSell!(amount!),
    enabled: sell && !!amount && !!protocol.quoteStakeAndSell,
    refetchInterval: 15_000,
  });

  if (!localOpen && !ccipOpen) return null;

  const fee = ccipQuote.data?.fee;
  const ethShort = src === 'ccip' && fee !== undefined && pos?.remote !== undefined && pos.remote.ethBalance < withFeeBuffer(fee);
  const nearCutoff = src === 'ccip' && remoteCutoff !== undefined && remoteCutoff - now < LATE_WARNING_SECONDS;
  const localClosedForSource = src === 'local' && !localOpen;
  const canSubmit =
    !!side &&
    !!amount &&
    !!address &&
    !plan.running &&
    writes.allowed &&
    !localClosedForSource &&
    (!sell || sellQuote.data !== undefined) &&
    (src !== 'ccip' || (!!recipient && fee !== undefined && !ethShort));

  const submit = async () => {
    if (!side || !amount || !address) return;
    setDone(null);
    const yes = side === 'yes';
    const opts = { unlimited };
    const r = await plan.start(() =>
      src === 'ccip'
        ? protocol.stakeRemote!(m.reportId, yes, amount, address, attempt, opts)
        : sell
          ? protocol.stakeAndSell!(m.reportId, yes, amount, minOutFor(sellQuote.data ?? 0n, slippageBps), now + SWAP_DEADLINE_SECONDS, address, opts)
          : protocol.stakeLocal(m.reportId, yes, amount, address, opts),
    );
    if (!r.ok) return;
    setAmountStr('');
    if (r.effect.messageId) {
      saveTracked({
        messageId: r.effect.messageId,
        reportId: m.reportId.toString(),
        side,
        amount: amount.toString(),
        sourceTx: r.lastHash,
        recipient: r.effect.sent?.recipient ?? recipient,
        sourceAccount: address,
        savedAt: now,
      });
      setNonce(randomNonce());
      router.push(`/tx/ccip/${r.effect.messageId}`);
      return;
    }
    if (sell && r.effect.amountOut !== undefined)
      setDone(`You received ${formatUsdc(r.effect.amountOut, { exact: true })} dUSD for the new YT and kept your ${yes ? 'Yes' : 'No'} position.`);
    else setDone(`You got ${formatUsdc(r.effect.staked?.amount ?? amount)} YT (yield token) — it's transferable; your ${yes ? 'Yes' : 'No'} position is not.`);
  };

  const sideName = side === 'yes' ? 'Yes' : 'No';
  return (
    <section aria-labelledby="stake-h" className="glass space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stake-h" className="text-[1.375rem] font-semibold sm:text-2xl">
          Stake Yes or No
        </h2>
        <NetworkBadge chainId={src === 'ccip' ? ARB : SEPOLIA} />
      </div>

      {!connected && !fixtureMode ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <SniffPose pose="alert" size={96} />
          <p className="text-[15px]">Connect a wallet to stake.</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="text-muted mb-2 text-sm">Stake from</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['local', 'Ethereum Sepolia', localOpen ? `Direct · open until ${formatDate(m.lockTime)}` : `Locked ${formatDate(m.lockTime)}`],
                  [
                    'ccip',
                    'Arbitrum Sepolia',
                    ccipOpen
                      ? `Via Chainlink CCIP · until ${formatDate(remoteCutoff!)}`
                      : !protocol.stakeRemote
                        ? 'Not available'
                        : m.remoteError
                          ? 'Couldn’t read the Arbitrum Sepolia sender'
                          : remoteCutoff === undefined
                            ? 'Not set up for this market'
                            : 'Closed: past the cross-chain cutoff',
                  ],
                ] as const
              ).map(([k, label, hint]) => {
                const disabled = k === 'ccip' ? !ccipOpen : !localOpen;
                return (
                  <label
                    key={k}
                    className={`flex items-start gap-3 rounded-xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${src === k ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_8%,transparent)]' : 'border-line'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <input type="radio" name="source" className="mt-1" checked={src === k} disabled={disabled} onChange={() => setSource(k)} />
                    <span>
                      <span className="font-semibold">{label}</span>
                      <span className="text-muted block text-[13px]">{hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <SidePicker value={side} onChange={setSide} disabled={plan.running} totals={m.totals} />

          <AmountField label={`Amount (dUSD on ${src === 'ccip' ? 'Arbitrum Sepolia' : 'Ethereum Sepolia'})`} unit="dUSD" value={amountStr} onChange={setAmountStr} balance={balance} placeholder="5.00" />

          {src === 'ccip' && (
            <div className="border-line space-y-1.5 rounded-xl border p-3 text-sm">
              <p>
                CCIP fee:{' '}
                <span className="num font-semibold">{fee !== undefined ? `${formatEth(fee, 6)} ETH` : ccipQuote.isFetching ? 'quoting…' : '—'}</span>{' '}
                <span className="text-muted">on Arbitrum Sepolia, excess refunded</span>
              </p>
              {ethShort && <p className="text-mask-ink">Not enough Arbitrum Sepolia ETH for the fee ({formatEth(withFeeBuffer(fee!), 6)} ETH needed).</p>}
              {ccipQuote.isError && <p className="text-mask-ink">Couldn&apos;t quote the fee: {revertReason(ccipQuote.error)}</p>}
              {nearCutoff ? (
                <p className="text-beam-ink font-semibold">Close to the cutoff. Late arrivals become REP receipts for you, not a vote.</p>
              ) : (
                <p className="text-muted">Usually arrives in 20–30 minutes. Late arrivals become REP receipts, not a vote.</p>
              )}
              {ccipQuote.data?.nonceUsed && (
                <p className="text-beam-ink">
                  This nonce was already used by your wallet. A fresh one is picked (and re-quoted) right before sending.{' '}
                  <button type="button" className="underline" onClick={() => setNonce(randomNonce())}>
                    New nonce now
                  </button>
                </p>
              )}
            </div>
          )}

          {side && amount && <PayoutPreview totals={m.totals} side={side} amount={amount} projectedPrincipal={m.projectedPrincipal} />}

          <Disclosure summary={src === 'ccip' ? 'Advanced: recipient, intent and approval' : 'Advanced: sell your YT now, approval'}>
            <div className="space-y-4">
              {isV2 && src === 'local' && (
                <fieldset className="space-y-2">
                  <legend className="text-muted mb-1 text-sm">Your yield token (YT)</legend>
                  {(['keep', 'sell'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name="yt" checked={ytMode === k} onChange={() => setYtMode(k)} />
                      {k === 'keep' ? 'Keep my YT (earns simulated yield)' : 'Stake and sell my YT now (one transaction)'}
                    </label>
                  ))}
                  {ytMode === 'sell' ? (
                    <div className="space-y-1 text-sm">
                      <p>You keep your Yes/No position and get dUSD now instead of the yield later. If slippage fails, the whole action reverts.</p>
                      {sellQuote.isError ? (
                        <p className="text-mask-ink">Can&apos;t sell this much YT into the pool now: {revertReason(sellQuote.error)}</p>
                      ) : (
                        <p>
                          You receive about <span className="num font-semibold">{sellQuote.data !== undefined ? formatUsdc(sellQuote.data, { exact: true }) : '…'}</span> dUSD; minimum{' '}
                          <span className="num">{formatUsdc(minOutFor(sellQuote.data ?? 0n, slippageBps), { exact: true })}</span> at{' '}
                          <label>
                            <span className="sr-only">Slippage in percent</span>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              step={0.1}
                              value={slippageBps / 100}
                              onChange={(e) => setSlippageBps(Math.round(Number(e.target.value) * 100))}
                              className="num border-line w-16 rounded border bg-transparent px-1"
                            />
                          </label>
                          % slippage · deadline 10 min · re-quoted right before sending.
                        </p>
                      )}
                      {m.market?.reserves && (
                        <p className="text-muted text-xs">
                          Pool dUSD: <span className="num">{formatUsdc(m.market.reserves.usdc)}</span>. The sale must leave some dUSD in the pool.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted text-xs">You get as much YT as you stake. YT is transferable; your Yes/No position is not.</p>
                  )}
                </fieldset>
              )}
              {src === 'ccip' && (
                <div className="space-y-2 text-sm">
                  <label className="block">
                    <span className="text-muted">Recipient on Ethereum Sepolia (gets the position and YT)</span>
                    <input
                      value={recipientStr}
                      onChange={(e) => setRecipientStr(e.target.value)}
                      placeholder={address ?? '0x…'}
                      className="num border-line focus:border-beam mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                    />
                    {recipientStr && !recipient && <span className="text-mask-ink">Not a valid address.</span>}
                    {!recipientStr && <span className="text-muted text-xs">Defaults to your own wallet.</span>}
                  </label>
                  <p className="text-muted text-xs">
                    Intent: nonce <span className="num">{nonce.toString().slice(0, 10)}…</span>, credit deadline {formatDate(Number(attempt?.deadline ?? 0n))}, minimum amount = amount. The
                    send adds 10% to the fee and the sender refunds the excess; the fee is re-quoted with the same intent right before sending.
                  </p>
                  {isV2 && deploymentKey === 'riskfi-v2-demo-1' && (
                    <Link href={`/tx/ccip/${V2_INFO.exampleCCIP.messageId}`} className="text-beam-ink text-xs underline">
                      See a delivered example
                    </Link>
                  )}
                </div>
              )}
              <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />
            </div>
          </Disclosure>

          {connected && <WrongChainPrompt ensure={src === 'ccip' ? ensureArb : ensureEth} />}
          <WritesBlockedNote />
          {localClosedForSource && <p className="text-mask-ink text-sm">Local stakes are locked. Pick Arbitrum Sepolia while it&apos;s open, or see Result &amp; claims.</p>}
          {unlimited && <p className="text-beam-ink text-sm">Unlimited approval is on (Advanced).</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="bg-beam text-on-beam w-full rounded-xl px-4 py-3 text-lg font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {plan.running
              ? 'Working…'
              : !side
                ? 'Pick Yes or No'
                : src === 'ccip'
                  ? `Send ${amount ? formatUsdc(amount) : ''} dUSD on ${sideName} via CCIP`
                  : sell
                    ? `Stake ${amount ? formatUsdc(amount) : ''} dUSD on ${sideName} and sell the YT`
                    : `Stake ${amount ? formatUsdc(amount) : ''} dUSD on ${sideName}`}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {done && <Banner tone="success" title={done} />}
          <Disclosure summary="Need test dUSD?">
            <GetTestFunds token={protocol.dusd} />
          </Disclosure>
        </>
      )}
    </section>
  );
}

/** Your Yes/No position, YT and cross-chain stakes for this market. */
function PositionCard({ market: m, promptConnect }: { market: MarketView; promptConnect?: boolean }) {
  const { protocol } = useProtocol();
  const { address, connected } = useActiveAccount();
  const position = usePosition(m.reportId, m.blockNumber);
  if (!address)
    return promptConnect ? (
      <Card title="Your position">
        <p className="text-muted mb-4 text-[15px]">Connect a wallet to see your stake, yield tokens and claims.</p>
        {!connected && <ConnectButton />}
      </Card>
    ) : null;
  return (
    <Card title="Your position">
      <LoadState query={position} source="Ethereum Sepolia RPC" compact skeleton={<div className="sweep h-24" />}>
        {(pos) => (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-beam-ink text-[13px]">Yes</dt>
                <dd className="num text-xl font-semibold">{formatUsdc(pos.yes)}</dd>
              </div>
              <div>
                <dt className="text-clue-ink text-[13px]">No</dt>
                <dd className="num text-xl font-semibold">{formatUsdc(pos.no)}</dd>
              </div>
              {protocol.kind === 'v2' && (
                <>
                  <div>
                    <dt className="text-muted text-[13px]">Yield tokens (YT)</dt>
                    <dd className="num font-semibold">{formatUsdc(pos.yt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted text-[13px]">YT yield to claim</dt>
                    <dd className="num">{formatUsdc(pos.ytClaimable, { exact: true })} dUSD</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="text-muted text-[13px]">{pos.transferable ? 'V1 positions are transferable ERC-1155 balances.' : 'Your Yes/No position stays in the vault and can’t be transferred; YT can.'}</p>
            {protocol.kind === 'v2' && pos.yt > 0n && <YtTransfer ytBalance={pos.yt} />}
            <TrackedCcipList reportId={m.reportId} extra={pos.pendingCcip} />
          </div>
        )}
      </LoadState>
    </Card>
  );
}
