'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { CurveNotOracleLabel, SimulatedYieldLabel, TestTokenLabel, YtNotPredictionLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxLink } from '@/components/TxLink';
import { TxPlanStepper, usePlan, WrongChainPrompt } from '@/components/TxPlanStepper';
import { env } from '@/lib/env';
import { revertReason } from '@/lib/errors';
import { formatDuration, formatUsdc, formatWad } from '@/lib/format';
import { useEnsureChain } from '@/lib/useEnsureChain';
import {
  DEFAULT_SLIPPAGE_BPS,
  formatRateWad,
  impliedAprFromPrice,
  marketBlock,
  minOutFor,
  SWAP_DEADLINE_SECONDS,
  WAD,
  type MarketBlock,
  type MarketView,
  type PositionView,
} from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol, useWritesAllowed } from '@/protocol/hooks';
import { LiquidityPanel } from './LiquidityPanel';

const SLIPPAGES = [50, 100, 200] as const;

export const BLOCK_COPY: Record<Exclude<MarketBlock, null>, string> = {
  not_locked: 'The YT is issued when stakes lock. Come back after lock.',
  not_deployed: 'Market not deployed yet.',
  no_router: 'Market not deployed yet (no swap router address).',
  not_configured: 'The pool exists but isn’t configured yet.',
  matured: 'Matured: the hook accepts no swaps after maturity. Removing liquidity and claiming yield still work.',
  no_series: 'Published onchain — no market deployed for this report yet.',
};

export function MarketScreen({ id, base = '/case' }: { id: string; base?: CaseBase }) {
  const { market, report } = useCase(id, base);
  const { protocol } = useProtocol();
  const v2 = protocol.kind === 'v2';
  return (
    <CaseFrame state={market}>
      {market.data && (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <CaseHeader market={market.data} report={report} tab="market" base={base} />
          <section className="space-y-2">
            <h2 className="font-display text-3xl">Trade the yield token (YT)</h2>
            <p className="max-w-3xl text-lg">
              {v2
                ? 'One YT/dUSD pool on a Uniswap v4 hook. YT earns the simulated yield on staked dUSD until maturity; it trades until maturity, including after stakes lock.'
                : 'Trade the interest earned on locked stakes. The YT price is not a prediction of the verdict.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {v2 ? <CurveNotOracleLabel /> : <YtNotPredictionLabel />}
              <SimulatedYieldLabel />
              <TestTokenLabel />
            </div>
          </section>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              <SwapPanel market={market.data} />
              {v2 && <RecentTrades />}
            </div>
            <div className="space-y-6">
              <PoolStats market={market.data} />
              <MarketWallet market={market.data} />
            </div>
          </div>
        </main>
      )}
    </CaseFrame>
  );
}

function PoolStats({ market: m }: { market: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const p = m.market;
  const left = (p?.maturity || m.maturity) - now;
  const apr = p?.impliedRateWad ?? impliedAprFromPrice(p?.spotPriceWad, left);
  return (
    <section aria-labelledby="pool-h" className="glass space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pool-h" className="font-semibold">
          Pool
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      {!p ? (
        <p className="text-muted">{BLOCK_COPY[marketBlock(m, now) ?? 'not_deployed']}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Price (dUSD per YT)" value={formatWad(p.spotPriceWad, 6)} />
            <Stat label={p.impliedRateWad !== undefined ? 'Implied APR' : 'Implied APR (from price)'} value={apr !== undefined ? formatRateWad(apr) : '—'} />
            <Stat label="Time to maturity" value={left > 0 ? formatDuration(left) : 'matured'} />
            <Stat label="Hook fee" value={p.feePips !== undefined ? `${(p.feePips / 10_000).toFixed(2)}%` : '—'} />
            {p.reserves && (
              <>
                <Stat label="dUSD reserve" value={formatUsdc(p.reserves.usdc)} />
                <Stat label="YT reserve" value={formatUsdc(p.reserves.yt)} />
              </>
            )}
          </dl>
          <p className="text-muted text-xs">
            Curve output — not a Yes/No probability or verdict oracle. The price is the implied rate times the years left to maturity, so it falls toward 0 as
            maturity nears.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="num mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function MarketWallet({ market: m }: { market: MarketView }) {
  const position = usePosition(m.reportId, m.blockNumber);
  const pos = position.data;
  if (!pos) return null;
  return (
    <>
      <YieldCard market={m} pos={pos} />
      {env.lpEnabled && <LiquidityPanel market={m} pos={pos} />}
    </>
  );
}

/** Direct YT yield: pending = unclaimedUSDC + balance × (globalIndex − paidIndex) / 1e18; claimYield checkpoints itself. */
function YieldCard({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const writes = useWritesAllowed();
  const plan = usePlan();
  return (
    <section aria-labelledby="yt-yield-h" className="glass space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="yt-yield-h" className="font-semibold">
          Your YT yield
        </h2>
        <SimulatedYieldLabel />
      </div>
      <p className="text-sm">
        You hold <span className="num">{formatUsdc(pos.yt)}</span> YT · claimable <span className="num font-semibold">{formatUsdc(pos.ytClaimable, { exact: true })}</span> dUSD
      </p>
      <p className="text-muted text-xs">Claiming checkpoints your balance itself; no separate checkpoint transaction is needed. Works after maturity too.</p>
      <button
        type="button"
        disabled={plan.running || !address || pos.ytClaimable === 0n || !writes.allowed}
        onClick={() => void plan.start(() => protocol.claimYield(m.reportId, address!))}
        className="border-line rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
      >
        Claim YT yield
      </button>
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
      {plan.result?.ok && plan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(plan.result.effect.paid, { exact: true })} dUSD.
        </p>
      )}
    </section>
  );
}

function SwapPanel({ market: m }: { market: MarketView }) {
  const { protocol, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const now = useChainTime() ?? m.chainTime;
  const position = usePosition(m.reportId, m.blockNumber);
  const writes = useWritesAllowed();
  const plan = usePlan();
  const ensure = useEnsureChain(11155111);
  const [dir, setDir] = useState<'buy' | 'sell'>('buy');
  const [input, setInput] = useState('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [unlimited, setUnlimited] = useState(false);
  const [quoted, setQuoted] = useState<bigint | undefined>();
  const block = marketBlock(m, now);
  const bal = dir === 'buy' ? position.data?.dusdBalance : position.data?.yt;
  const amountIn = validAmount(input, bal);
  const quote = useQuery({
    queryKey: ['protocol', protocol.kind, 'quoteYT', m.reportId.toString(), dir, amountIn?.toString(), m.blockNumber.toString()],
    queryFn: () => protocol.quoteYT(m.reportId, dir, amountIn!),
    enabled: !block && !!amountIn && amountIn > 0n,
    retry: false,
  });
  const out = quote.data?.out;
  const minOut = out !== undefined ? minOutFor(out, slippage) : undefined;
  const reserves = m.market?.reserves;
  // About how much dUSD buys the pool's YT inventory at today's spot (the curve adds a little).
  const maxBuy = reserves && m.market?.spotPriceWad ? (reserves.yt * m.market.spotPriceWad) / WAD : undefined;

  if (block)
    return (
      <section className="glass p-6" aria-labelledby="swap-h">
        <h2 id="swap-h" className="font-display text-2xl">
          Swap
        </h2>
        <p className="mt-3">{BLOCK_COPY[block]}</p>
      </section>
    );

  return (
    <section aria-labelledby="swap-h" className="glass space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="swap-h" className="font-display text-2xl">
          Swap
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      <div role="radiogroup" aria-label="Direction" className="flex gap-2">
        {(['buy', 'sell'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={dir === d}
            onClick={() => {
              setDir(d);
              setQuoted(undefined);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${dir === d ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]' : 'border-line text-muted'}`}
          >
            {d === 'buy' ? 'Buy YT with dUSD' : 'Sell YT for dUSD'}
          </button>
        ))}
      </div>
      {!connected && !fixtureMode ? (
        <ConnectButton />
      ) : (
        <>
          <AmountField label={`You pay (${dir === 'buy' ? 'dUSD' : 'YT'})`} unit={dir === 'buy' ? 'dUSD' : 'YT'} value={input} onChange={setInput} balance={bal} placeholder="0.50" />
          {reserves && (
            <p className="text-muted text-xs">
              {dir === 'buy'
                ? `The pool holds ${formatUsdc(reserves.yt)} YT; a buy must leave some behind${maxBuy !== undefined ? ` (about ${formatUsdc(maxBuy)} dUSD buys all of it at today's price)` : ''}.`
                : `The pool holds ${formatUsdc(reserves.usdc)} dUSD; a sale must leave some behind.`}
            </p>
          )}
          <ArrowDown className="text-muted mx-auto" aria-hidden />
          <div>
            <p className="text-muted text-sm">You receive about ({dir === 'buy' ? 'YT' : 'dUSD'})</p>
            <p className="num text-2xl font-semibold">{out !== undefined ? formatUsdc(out, { exact: true }) : quote.isFetching ? '…' : '—'}</p>
            {quote.isError && <p className="text-mask-ink text-sm">{revertReason(quote.error)}</p>}
            {out === 0n && amountIn && <p className="text-mask-ink text-sm">This amount is outside what the pool can fill.</p>}
          </div>
          <fieldset className="flex flex-wrap items-center gap-2 text-sm">
            <legend className="text-muted mb-1">Slippage</legend>
            {SLIPPAGES.map((s) => (
              <label key={s} className={`cursor-pointer rounded-lg border px-2.5 py-1 ${slippage === s ? 'border-beam' : 'border-line'}`}>
                <input type="radio" name="slip" className="sr-only" checked={slippage === s} onChange={() => setSlippage(s)} />
                {(s / 100).toFixed(1)}%
              </label>
            ))}
            {minOut !== undefined && (
              <span className="text-muted">
                min received <span className="num">{formatUsdc(minOut, { exact: true })}</span> · deadline 10 min · re-quoted right before sending
              </span>
            )}
          </fieldset>
          {protocol.kind === 'v2' && <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />}
          {connected && <WrongChainPrompt ensure={ensure} />}
          <WritesBlockedNote />
          <button
            type="button"
            disabled={!amountIn || !out || plan.running || !address || !writes.allowed}
            onClick={async () => {
              setQuoted(out);
              await plan.start(() => protocol.swapYT(m.reportId, dir, amountIn!, minOut!, now + SWAP_DEADLINE_SECONDS, address!, { unlimited }));
            }}
            className="bg-beam text-on-beam w-full rounded-xl px-4 py-3 text-lg font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {plan.running ? 'Working…' : dir === 'buy' ? 'Buy YT' : 'Sell YT'}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {plan.result?.ok && plan.result.effect.amountOut !== undefined && (
            <Banner tone="success" title="Swap confirmed">
              Received <span className="num">{formatUsdc(plan.result.effect.amountOut, { exact: true })}</span> {dir === 'buy' ? 'YT' : 'dUSD'} (from the Swapped event).
              {quoted !== undefined && (
                <span className="mt-1 block">
                  Quoted <span className="num">{formatUsdc(quoted, { exact: true })}</span>
                  {quoted === plan.result.effect.amountOut ? (
                    <span className="text-clue-ink inline-flex items-center gap-1">
                      {' '}
                      <CircleCheck size={14} aria-hidden /> the quote matches the amount received
                    </span>
                  ) : (
                    ' — the pool moved between the quote and the swap.'
                  )}
                </span>
              )}
            </Banner>
          )}
        </>
      )}
    </section>
  );
}

/** Swapped + RateObserved from the hook over the last ~5,000 blocks (bounded, 1,000-block requests). */
function RecentTrades() {
  const { protocol } = useProtocol();
  const trades = useQuery({
    queryKey: ['protocol', protocol.kind, 'recentTrades'],
    queryFn: () => protocol.recentTrades!(),
    enabled: !!protocol.recentTrades,
    refetchInterval: 60_000,
    retry: false,
  });
  return (
    <section aria-labelledby="trades-h" className="glass space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trades-h" className="font-semibold">
          Recent trades
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      {trades.isError ? (
        <p className="text-muted text-sm">Recent trades are unavailable from this RPC ({revertReason(trades.error).split('\n')[0]}).</p>
      ) : !trades.data ? (
        <div className="sweep h-16" aria-busy="true" aria-label="Loading trades" />
      ) : trades.data.length === 0 ? (
        <p className="text-muted text-sm">No trades in the last ~5,000 blocks (about 17 hours).</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Recent YT trades</caption>
          <thead className="text-muted text-left text-xs">
            <tr>
              <th className="pb-1 font-normal">Trade</th>
              <th className="pb-1 font-normal">Rate after</th>
              <th className="pb-1 font-normal">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.data.slice(0, 8).map((t) => (
              <tr key={`${t.tx}-${t.amountIn}`} className="border-line border-t">
                <td className="num py-1.5">
                  {t.usdcIn ? `${formatUsdc(t.amountIn)} dUSD → ${formatUsdc(t.amountOut)} YT` : `${formatUsdc(t.amountIn)} YT → ${formatUsdc(t.amountOut, { exact: true })} dUSD`}
                </td>
                <td className="num py-1.5">{t.rateWad !== undefined ? formatRateWad(t.rateWad) : '—'}</td>
                <td className="py-1.5">
                  <TxLink value={t.tx} chainId={11155111} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-muted text-xs">The rate is the curve&apos;s implied APR after each trade. It reflects YT demand, not the report&apos;s outcome.</p>
    </section>
  );
}
