'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { SimulatedYieldLabel, TestTokenLabel, YtNotPredictionLabel } from '@/components/HonestyLabels';
import { TxPlanStepper, usePlan, WrongChainPrompt } from '@/components/TxPlanStepper';
import { env } from '@/lib/env';
import { formatDuration, formatUsdc, formatWad, parseUsdc } from '@/lib/format';
import { useEnsureChain } from '@/lib/useEnsureChain';
import {
  DEFAULT_SLIPPAGE_BPS,
  formatRateWad,
  impliedAprFromPrice,
  marketBlock,
  minOutFor,
  SWAP_DEADLINE_SECONDS,
  type MarketBlock,
  type MarketView,
} from '@/protocol';
import { useActiveAccount, useChainTime, usePosition, useProtocol } from '@/protocol/hooks';

const SLIPPAGES = [50, 100, 200] as const;

export const BLOCK_COPY: Record<Exclude<MarketBlock, null>, string> = {
  not_locked: 'The YT is issued when stakes lock. Come back after lock.',
  not_deployed: 'Market not deployed yet.',
  no_router: 'Market not deployed yet (no swap router address in testnets.json).',
  not_configured: 'The pool exists but isn’t configured yet.',
  matured: 'Matured: the hook accepts no swaps after maturity.',
};

export function MarketScreen({ id }: { id: string }) {
  const { market, report } = useCase(id);
  return (
    <CaseFrame state={market}>
      {market.data && (
        <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <CaseHeader market={market.data} report={report} tab="market" />
          <section className="space-y-2">
            <h2 className="font-display text-3xl">Trade the yield token (YT)</h2>
            <p className="max-w-3xl text-lg">
              Trade the interest earned on locked stakes. The YT price is not a prediction of the verdict.
            </p>
            <div className="flex flex-wrap gap-2">
              <YtNotPredictionLabel />
              <SimulatedYieldLabel />
              <TestTokenLabel />
            </div>
          </section>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <SwapPanel market={market.data} />
            <PoolStats market={market.data} />
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
  const position = usePosition(m.reportId, m.blockNumber);
  return (
    <section aria-labelledby="pool-h" className="glass space-y-4 p-5 sm:p-6">
      <h2 id="pool-h" className="font-semibold">
        Pool
      </h2>
      {!p ? (
        <p className="text-muted">{BLOCK_COPY[marketBlock(m, now) ?? 'not_deployed']}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4">
          <Stat label="Price (dUSD per YT)" value={formatWad(p.spotPriceWad)} />
          <Stat
            label={p.impliedRateWad !== undefined ? 'Implied APR' : 'Implied APR (from price)'}
            value={apr !== undefined ? formatRateWad(apr) : '—'}
            tag
          />
          <Stat label="Time to maturity" value={left > 0 ? formatDuration(left) : 'matured'} />
          <Stat label="Fee" value={p.feePips !== undefined ? `${(p.feePips / 10_000).toFixed(2)}%` : '—'} />
          {p.reserves && (
            <>
              <Stat label="dUSD reserve" value={formatUsdc(p.reserves.usdc)} />
              <Stat label="YT reserve" value={formatUsdc(p.reserves.yt)} />
            </>
          )}
        </dl>
      )}
      {position.data && (
        <p className="border-line border-t pt-3 text-sm">
          You hold <span className="num">{formatUsdc(position.data.yt)}</span> YT · claimable{' '}
          <span className="num">{formatUsdc(position.data.ytClaimable, { exact: true })}</span> dUSD <SimulatedYieldLabel />
        </p>
      )}
      {env.lpEnabled && position.data && <LiquidityPanel market={m} lpShares={position.data.lpShares} lpClaimable={position.data.lpClaimable} />}
    </section>
  );
}

function Stat({ label, value, tag }: { label: string; value: string; tag?: boolean }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="num mt-1 text-xl font-semibold">{value}</dd>
      {tag && (
        <dd>
          <SimulatedYieldLabel />
        </dd>
      )}
    </div>
  );
}

function LiquidityPanel({ market: m, lpShares, lpClaimable }: { market: MarketView; lpShares: bigint; lpClaimable: bigint }) {
  const { protocol } = useProtocol();
  const plan = usePlan();
  return (
    <div className="border-line space-y-2 border-t pt-3 text-sm">
      <p className="font-semibold">Liquidity</p>
      <p>
        LP shares <span className="num">{formatUsdc(lpShares)}</span> · claimable LP yield <span className="num">{formatUsdc(lpClaimable, { exact: true })}</span> dUSD
      </p>
      <p className="text-muted text-xs">Add and remove liquidity go straight to the hook (addLiquidity / removeLiquidity); not wired in this UI yet.</p>
      {protocol.claimLPYield && (
        <button
          type="button"
          disabled={plan.running || lpClaimable === 0n}
          onClick={() => void plan.start(() => protocol.claimLPYield!(m.reportId))}
          className="border-line rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-50"
        >
          Claim LP yield
        </button>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
    </div>
  );
}

function SwapPanel({ market: m }: { market: MarketView }) {
  const { protocol, fixtureMode } = useProtocol();
  const { address, connected } = useActiveAccount();
  const now = useChainTime() ?? m.chainTime;
  const position = usePosition(m.reportId, m.blockNumber);
  const plan = usePlan();
  const ensure = useEnsureChain(11155111);
  const [dir, setDir] = useState<'buy' | 'sell'>('buy');
  const [input, setInput] = useState('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const block = marketBlock(m, now);
  const amountIn = parseUsdc(input);
  const quote = useQuery({
    queryKey: ['protocol', protocol.kind, 'quoteYT', m.reportId.toString(), dir, amountIn?.toString(), m.blockNumber.toString()],
    queryFn: () => protocol.quoteYT(m.reportId, dir, amountIn!),
    enabled: !block && !!amountIn && amountIn > 0n,
  });
  const out = quote.data?.out;
  const minOut = out !== undefined ? minOutFor(out, slippage) : undefined;
  const bal = dir === 'buy' ? position.data?.dusdBalance : position.data?.yt;
  const tooMuch = amountIn !== null && bal !== undefined && amountIn > bal;

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
      <h2 id="swap-h" className="font-display text-2xl">
        Swap
      </h2>
      <div role="radiogroup" aria-label="Direction" className="flex gap-2">
        {(['buy', 'sell'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={dir === d}
            onClick={() => setDir(d)}
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
          <label className="block">
            <span className="text-muted text-sm">You pay ({dir === 'buy' ? 'dUSD' : 'YT'})</span>
            <input
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="5.00"
              className="num border-line focus:border-beam mt-1 w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-3 py-2.5 text-lg outline-none"
            />
            <span className={`text-sm ${tooMuch ? 'text-mask-ink' : 'text-muted'}`}>
              {tooMuch ? 'More than your balance. ' : ''}Balance {bal !== undefined ? formatUsdc(bal) : '…'}
            </span>
          </label>
          <ArrowDown className="text-muted mx-auto" aria-hidden />
          <div>
            <p className="text-muted text-sm">You receive about ({dir === 'buy' ? 'YT' : 'dUSD'})</p>
            <p className="num text-2xl font-semibold">{out !== undefined ? formatUsdc(out, { exact: true }) : quote.isFetching ? '…' : '—'}</p>
            {quote.isError && <p className="text-mask-ink text-sm">{quote.error.message}</p>}
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
                min received <span className="num">{formatUsdc(minOut, { exact: true })}</span> · deadline 10 min
              </span>
            )}
          </fieldset>
          {connected && <WrongChainPrompt ensure={ensure} />}
          <button
            type="button"
            disabled={!amountIn || !out || tooMuch || plan.running || !address}
            onClick={() => void plan.start(() => protocol.swapYT(m.reportId, dir, amountIn!, minOut!, now + SWAP_DEADLINE_SECONDS, address!))}
            className="bg-beam text-on-beam w-full rounded-xl px-4 py-3 text-lg font-semibold hover:brightness-105 disabled:opacity-50"
          >
            {plan.running ? 'Working…' : dir === 'buy' ? 'Buy YT' : 'Sell YT'}
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
          {plan.result?.ok && plan.result.effect.amountOut !== undefined && (
            <Banner tone="success" title="Swap confirmed">
              Received <span className="num">{formatUsdc(plan.result.effect.amountOut, { exact: true })}</span> {dir === 'buy' ? 'YT' : 'dUSD'} (from the Swapped event).
            </Banner>
          )}
        </>
      )}
    </section>
  );
}
