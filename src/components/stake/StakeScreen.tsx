'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader, casePath, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { CcipNotVoteLabel, PublicStakesLabel, SimulatedYieldLabel, TestTokenLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxPlanStepper, usePlan, WrongChainPrompt } from '@/components/TxPlanStepper';
import { revertReason } from '@/lib/errors';
import { formatDate, formatEth, formatUsdc } from '@/lib/format';
import { useEnsureChain } from '@/lib/useEnsureChain';
import {
  DEFAULT_SLIPPAGE_BPS,
  localStakeOpen,
  minOutFor,
  newRemoteAttempt,
  randomNonce,
  remoteCutoffOf,
  remoteSendOpen,
  saveTracked,
  SWAP_DEADLINE_SECONDS,
  V2_INFO,
  withFeeBuffer,
  type MarketView,
  type PositionView,
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
  const { protocol } = useProtocol();
  return (
    <CaseFrame state={market}>
      {market.data && (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <CaseHeader market={market.data} report={report} tab="stake" base={base} />
          {market.data.series === false ? (
            <Banner tone="info" title="Published onchain — no market deployed for this report yet">
              The V2 vault serves one report. This one has no vault, YT or CCIP sender, so there is nothing to stake.
            </Banner>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <StakePanel market={market.data} base={base} />
              <div className="space-y-6">
                <TotalsCard market={market.data} />
                {protocol.depositRep && <RepReceiptPanel market={market.data} />}
              </div>
            </div>
          )}
        </main>
      )}
    </CaseFrame>
  );
}

function closedReason(m: MarketView): string {
  switch (m.phase) {
    case 'locked':
      return `Stakes locked at ${formatDate(m.lockTime)}. YT keeps trading until maturity (${formatDate(m.maturity)}).`;
    case 'matured':
      return `Stakes closed at ${formatDate(m.lockTime)}. The report matured on ${formatDate(m.maturity)}; waiting for the resolver.`;
    case 'proposed':
    case 'challenged':
      return `Stakes closed at ${formatDate(m.lockTime)}. A result has been proposed; see Result & claims.`;
    default:
      return `Stakes closed at ${formatDate(m.lockTime)}. This report is final; see Result & claims.`;
  }
}

function StakePanel({ market: m, base }: { market: MarketView; base: CaseBase }) {
  const { protocol, fixtureMode } = useProtocol();
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
  const ccipOpen = !!protocol.stakeRemote && remoteSendOpen(m, now);
  const src: Source = source === 'ccip' && ccipOpen ? 'ccip' : 'local';
  const pos = position.data;
  const balance = src === 'ccip' ? pos?.remote?.dusdBalance : pos?.dusdBalance;
  const amount = validAmount(amountStr, balance);
  const sell = isV2 && ytMode === 'sell' && src === 'local' && !!protocol.stakeAndSell;
  const recipient: Address | undefined = recipientStr.trim() ? (isAddress(recipientStr.trim()) ? getAddress(recipientStr.trim()) : undefined) : address;
  const attempt: RemoteAttempt | undefined = recipient ? newRemoteAttempt({ lockTime: m.lockTime, recipient, nonce }) : undefined;

  const ccipQuote = useQuery({
    queryKey: ['protocol', protocol.kind, 'ccipQuote', m.reportId.toString(), side, amount?.toString(), address, recipient, nonce.toString()],
    queryFn: () => protocol.quoteRemote!(m.reportId, side === 'yes', amount!, address!, attempt),
    enabled: src === 'ccip' && !!side && !!amount && !!address && !!attempt && !!protocol.quoteRemote,
    refetchInterval: 30_000,
  });
  const sellQuote = useQuery({
    queryKey: ['protocol', protocol.kind, 'sellQuote', amount?.toString(), m.blockNumber.toString()],
    queryFn: () => protocol.quoteStakeAndSell!(amount!),
    enabled: sell && !!amount && !!protocol.quoteStakeAndSell,
    refetchInterval: 15_000,
  });

  if (!localOpen && !ccipOpen)
    return (
      <section className="glass space-y-4 p-6">
        <h2 className="font-display text-2xl">Staking is closed</h2>
        <p>{closedReason(m)}</p>
        <Link href={casePath(base, m.reportId, 'result')} className="text-beam-ink underline">
          Go to result &amp; claims
        </Link>
        {pos && <MyPosition market={m} pos={pos} />}
      </section>
    );

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
                ['local', 'Ethereum Sepolia (direct)', localOpen ? `Open until the lock, ${formatDate(m.lockTime)}.` : `Locked at ${formatDate(m.lockTime)}.`],
                [
                  'ccip',
                  'Arbitrum Sepolia (via Chainlink CCIP)',
                  ccipOpen
                    ? `Open until the cross-chain cutoff, ${formatDate(remoteCutoff!)}.`
                    : !protocol.stakeRemote
                      ? 'Not available.'
                      : m.remoteError
                        ? 'Couldn’t read the Arbitrum Sepolia sender.'
                        : remoteCutoff === undefined
                          ? 'Not configured for this report.'
                          : 'Closed: past the cross-chain cutoff.',
                ],
              ] as const
            ).map(([k, label, hint]) => {
              const disabled = k === 'ccip' ? !ccipOpen : !localOpen;
              return (
                <label key={k} className={`flex items-start gap-3 rounded-xl border p-3 ${src === k ? 'border-beam' : 'border-line'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <input type="radio" name="source" className="mt-1" checked={src === k} disabled={disabled} onChange={() => setSource(k)} />
                  <span>
                    <span className="font-semibold">{label}</span>
                    <span className="text-muted block text-sm">{hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <SidePicker value={side} onChange={setSide} disabled={plan.running} />

          <AmountField label={`Amount (dUSD on ${src === 'ccip' ? 'Arbitrum Sepolia' : 'Ethereum Sepolia'})`} unit="dUSD" value={amountStr} onChange={setAmountStr} balance={balance} placeholder="5.00" />

          {isV2 && src === 'local' && (
            <fieldset className="space-y-2">
              <legend className="text-muted mb-1 text-sm">Your yield token (YT)</legend>
              {(['keep', 'sell'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="yt" checked={ytMode === k} onChange={() => setYtMode(k)} />
                  {k === 'keep' ? 'Keep my YT' : 'Sell my YT now (one transaction)'}
                </label>
              ))}
              {ytMode === 'sell' ? (
                <div className="space-y-1 text-sm">
                  <p>You keep your Yes/No position; you get dUSD now instead of the yield later. If slippage fails, the whole action reverts.</p>
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
                      % slippage · deadline 10 min after the latest block. The quote is re-read right before sending.
                    </p>
                  )}
                  {m.market?.reserves && (
                    <p className="text-muted text-xs">
                      Pool dUSD reserve: <span className="num">{formatUsdc(m.market.reserves.usdc)}</span>. The sale must leave some dUSD in the pool.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted text-xs">
                  You get the same amount of YT as you stake. YT is transferable and earns <SimulatedYieldLabel />; your Yes/No position is not transferable.
                </p>
              )}
            </fieldset>
          )}

          {src === 'ccip' && (
            <div className="border-line space-y-2 rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Chainlink CCIP</p>
                <NetworkBadge chainId={ARB} />
              </div>
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
              <p>
                CCIP fee:{' '}
                <span className="num font-semibold">{fee !== undefined ? `${formatEth(fee, 6)} ETH` : ccipQuote.isFetching ? 'quoting…' : '—'}</span>{' '}
                <span className="text-muted">(Arbitrum Sepolia ETH; the send adds 10% and the sender refunds the excess)</span>
              </p>
              {ethShort && <p className="text-mask-ink">Not enough Arbitrum Sepolia ETH for the fee ({formatEth(withFeeBuffer(fee!), 6)} ETH needed).</p>}
              {ccipQuote.isError && <p className="text-mask-ink">Couldn&apos;t quote the fee: {revertReason(ccipQuote.error)}</p>}
              <p className="text-muted">
                Intent: nonce <span className="num">{nonce.toString().slice(0, 10)}…</span>, credit deadline {formatDate(Number(attempt?.deadline ?? 0n))}, minimum amount = amount.
                The fee is re-quoted right before sending, with the same intent.
              </p>
              {ccipQuote.data?.nonceUsed && (
                <p className="text-beam-ink">
                  This nonce was already used by your wallet. A fresh one is picked (and re-quoted) right before sending.{' '}
                  <button type="button" className="underline" onClick={() => setNonce(randomNonce())}>
                    New nonce now
                  </button>
                </p>
              )}
              {nearCutoff ? (
                <p className="text-beam-ink font-semibold">Close to the cutoff. Late arrivals become REP receipts for you, not a vote.</p>
              ) : (
                <p className="text-muted">Late arrivals become REP receipts for you, not a vote. Delivery usually takes 20–30 minutes.</p>
              )}
              <CcipNotVoteLabel />
              {isV2 && (
                <p>
                  <Link href={`/tx/ccip/${V2_INFO.exampleCCIP.messageId}`} className="text-beam-ink underline">
                    See a delivered example
                  </Link>
                </p>
              )}
            </div>
          )}

          {side && amount && <PayoutPreview totals={m.totals} side={side} amount={amount} projectedPrincipal={m.projectedPrincipal} />}

          <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />
          {connected && <WrongChainPrompt ensure={src === 'ccip' ? ensureArb : ensureEth} />}
          <WritesBlockedNote />
          {localClosedForSource && <p className="text-mask-ink text-sm">Local stakes are locked. Pick the CCIP source while it&apos;s open, or see Result &amp; claims.</p>}

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
                  ? `Send ${amount ? formatUsdc(amount) : ''} dUSD on ${side === 'yes' ? 'Yes' : 'No'} via CCIP`
                  : sell
                    ? `Stake ${amount ? formatUsdc(amount) : ''} dUSD on ${side === 'yes' ? 'Yes' : 'No'} and sell the YT`
                    : `Stake ${amount ? formatUsdc(amount) : ''} dUSD on ${side === 'yes' ? 'Yes' : 'No'}`}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {done && <Banner tone="success" title={done} />}
          <GetTestFunds token={protocol.dusd} />
        </>
      )}
      {pos && <MyPosition market={m} pos={pos} />}
    </section>
  );
}

function MyPosition({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  return (
    <div className="border-line space-y-3 border-t pt-4">
      <h3 className="font-semibold">Your position</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Yes</dt>
          <dd className="num text-beam-ink text-lg font-semibold">{formatUsdc(pos.yes)}</dd>
        </div>
        <div>
          <dt className="text-muted">No</dt>
          <dd className="num text-clue-ink text-lg font-semibold">{formatUsdc(pos.no)}</dd>
        </div>
        {protocol.kind === 'v2' && (
          <>
            <div>
              <dt className="text-muted">Yield token (YT)</dt>
              <dd className="num font-semibold">{formatUsdc(pos.yt)}</dd>
            </div>
            <div>
              <dt className="text-muted">YT yield claimable</dt>
              <dd className="num">{formatUsdc(pos.ytClaimable, { exact: true })} dUSD</dd>
            </div>
          </>
        )}
      </dl>
      <p className="text-muted text-xs">
        {pos.transferable ? 'V1 positions are ERC-1155 VotingPositionToken balances at tokenId(reportId, yes).' : 'V2 Yes/No positions live in the vault and are not transferable; the YT is.'}
      </p>
      {protocol.kind === 'v2' && pos.yt > 0n && <YtTransfer ytBalance={pos.yt} />}
      <div>
        <p className="text-sm font-semibold">Cross-chain stakes from this browser</p>
        <TrackedCcipList reportId={m.reportId} extra={pos.pendingCcip} />
      </div>
    </div>
  );
}
