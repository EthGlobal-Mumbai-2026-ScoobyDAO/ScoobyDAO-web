'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { CaseFrame, CaseHeader, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { SniffPose } from '@/components/SniffPose';
import { Card, Disclosure, KeyValue, LoadState, Page, SegmentedControl, type HonestyFact } from '@/components/ui';
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
  matured: 'Trading stopped at maturity. You can still remove liquidity and claim yield.',
  no_series: 'Published onchain — no market deployed for this report yet.',
};

export function MarketScreen({ id, base = '/case' }: { id: string; base?: CaseBase }) {
  const { market, report } = useCase(id, base);
  const { protocol } = useProtocol();
  const v2 = protocol.kind === 'v2';
  const facts: HonestyFact[] = ['testToken', 'simulatedYield', 'ytNotSignal', ...(v2 ? (['curveNotOracle'] as const) : [])];
  return (
    <CaseFrame state={market}>
      {market.data && (
        <Page>
          <CaseHeader market={market.data} report={report} tab="market" base={base} facts={facts} />
          <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="space-y-6">
              <SwapPanel market={market.data} />
              {v2 && <RecentTrades />}
            </div>
            <div className="space-y-6">
              <PoolStats market={market.data} />
              <MarketWallet market={market.data} />
            </div>
          </div>
        </Page>
      )}
    </CaseFrame>
  );
}

function PoolStats({ market: m }: { market: MarketView }) {
  const now = useChainTime() ?? m.chainTime;
  const p = m.market;
  const left = (p?.maturity || m.maturity) - now;
  const apr = p?.impliedRateWad ?? impliedAprFromPrice(p?.spotPriceWad, left);
  const ytPerDusd = p?.spotPriceWad ? (WAD * WAD) / p.spotPriceWad : undefined;
  return (
    <Card title="Yield market" actions={<NetworkBadge chainId={11155111} />}>
      {!p ? (
        <p className="text-muted">{BLOCK_COPY[marketBlock(m, now) ?? 'not_deployed']}</p>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="1 YT costs" value={formatWad(p.spotPriceWad, 6)} unit="dUSD" />
            <Stat label={p.impliedRateWad !== undefined ? 'Implied APR' : 'Implied APR (from price)'} value={apr !== undefined ? formatRateWad(apr) : '—'} />
            <Stat label="Trading ends" value={left > 0 ? formatDuration(left) : 'ended'} />
          </dl>
          <p className="text-muted text-[13px]">YT earns the simulated yield on staked dUSD until maturity, so its price falls toward 0 as maturity nears.</p>
          <Disclosure summary="Pool details">
            <KeyValue
              items={[
                { label: '1 dUSD buys (spot)', value: <span className="num">{formatWad(ytPerDusd, 6)} YT</span> },
                ...(p.reserves
                  ? [
                      { label: 'Pool dUSD', value: <span className="num">{formatUsdc(p.reserves.usdc)}</span> },
                      { label: 'Pool YT', value: <span className="num">{formatUsdc(p.reserves.yt)}</span> },
                    ]
                  : []),
                { label: 'Pool fee', value: p.feePips !== undefined ? `${(p.feePips / 10_000).toFixed(2)}%` : '—' },
                { label: 'Engine', value: 'Uniswap v4 yield market' },
              ]}
            />
          </Disclosure>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted text-[13px]">{label}</dt>
      <dd className="num mt-1 text-xl font-semibold break-words">
        {value}
        {unit && <span className="text-muted ml-1 text-xs font-normal">{unit}</span>}
      </dd>
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
    <section aria-labelledby="yt-yield-h" className="glass space-y-3 p-5 sm:p-6">
      <h2 id="yt-yield-h" className="text-lg font-semibold">
        Your YT yield
      </h2>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-muted text-[13px]">You hold</dt>
          <dd className="num text-xl font-semibold">{formatUsdc(pos.yt)} <span className="text-muted text-xs font-normal">YT</span></dd>
        </div>
        <div>
          <dt className="text-muted text-[13px]">Yield to claim</dt>
          <dd className="num text-xl font-semibold">{formatUsdc(pos.ytClaimable, { exact: true })} <span className="text-muted text-xs font-normal">dUSD</span></dd>
        </div>
      </dl>
      <p className="text-muted text-[13px]">One transaction, no checkpoint needed. Works after maturity too.</p>
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
  const rangeCap = (() => {
    if (!bal || bal <= 0n) return undefined;
    if (dir === 'sell') return bal;
    const poolEstimate = maxBuy !== undefined ? maxBuy * 64n + 64n : 1_000_000n;
    return bal < poolEstimate ? bal : poolEstimate;
  })();
  const executableRange = useQuery({
    queryKey: ['protocol', protocol.kind, 'quoteYTRange', m.reportId.toString(), dir, rangeCap?.toString(), m.blockNumber.toString()],
    queryFn: async () => {
      const cap = rangeCap!;
      const works = async (amount: bigint) => {
        try {
          return (await protocol.quoteYT(m.reportId, dir, amount)).out > 0n;
        } catch {
          return false;
        }
      };

      let first: bigint | undefined;
      const tinyLimit = cap < 64n ? cap : 64n;
      for (let amount = 1n; amount <= tinyLimit; amount += 1n) {
        if (await works(amount)) {
          first = amount;
          break;
        }
      }
      if (first === undefined) {
        for (let amount = 128n; amount <= cap; amount *= 2n) {
          if (await works(amount)) {
            first = amount;
            break;
          }
        }
      }
      if (first === undefined && cap > tinyLimit && (await works(cap))) first = cap;
      if (first === undefined) return null;
      if (first === cap || (await works(cap))) return { min: first, max: cap };

      let low = first;
      let high = cap;
      while (high - low > 1n) {
        const mid = (low + high) / 2n;
        if (await works(mid)) low = mid;
        else high = mid;
      }
      return { min: first, max: low };
    },
    enabled: !block && rangeCap !== undefined,
    staleTime: 30_000,
    retry: false,
  });

  if (block)
    return (
      <section className="glass flex flex-wrap items-center gap-5 p-5 sm:p-6" aria-labelledby="swap-h">
        <SniffPose pose={block === 'matured' ? 'sad' : 'shrug'} size={88} />
        <div className="min-w-0 flex-1">
          <h2 id="swap-h" className="text-[1.375rem] font-semibold sm:text-2xl">
            {block === 'matured' ? 'Trading has ended' : 'Trading isn’t available'}
          </h2>
          <p className="text-muted mt-1 text-[15px]">{BLOCK_COPY[block]}</p>
        </div>
      </section>
    );

  return (
    <section aria-labelledby="swap-h" className="glass space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="swap-h" className="text-[1.375rem] font-semibold sm:text-2xl">
          Trade yield tokens
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      <SegmentedControl
        label="Direction"
        value={dir}
        onChange={(d) => {
          setDir(d);
          setQuoted(undefined);
        }}
        items={[
          { key: 'buy', label: 'Buy YT with dUSD' },
          { key: 'sell', label: 'Sell YT for dUSD' },
        ]}
      />
      {!connected && !fixtureMode ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <SniffPose pose="alert" size={96} />
          <p className="text-[15px]">Connect a wallet to trade.</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <AmountField label={`You pay (${dir === 'buy' ? 'dUSD' : 'YT'})`} unit={dir === 'buy' ? 'dUSD' : 'YT'} value={input} onChange={setInput} balance={bal} placeholder="0.50" />
          <p className="text-muted text-xs" aria-live="polite">
            {executableRange.isFetching
              ? 'Checking the executable range for your balance and the current pool…'
              : executableRange.data
                ? `Enter ${formatUsdc(executableRange.data.min, { exact: true })} to ${formatUsdc(executableRange.data.max, { exact: true })} ${dir === 'buy' ? 'dUSD' : 'YT'} at the current pool state.`
                : 'No executable amount is available for your balance at the current pool state.'}
          </p>
          {reserves && (
            <p className="text-muted text-xs">
              {dir === 'buy'
                ? `The pool holds ${formatUsdc(reserves.yt)} YT; a buy must leave some behind${maxBuy !== undefined ? ` (spot-value estimate: ${formatUsdc(maxBuy, { exact: true })} dUSD for that inventory)` : ''}.`
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
          {protocol.kind === 'v2' && (
            <Disclosure summary="Advanced: approval">
              <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />
            </Disclosure>
          )}
          {unlimited && <p className="text-beam-ink text-sm">Unlimited approval is on (Advanced).</p>}
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
    <section aria-labelledby="trades-h" className="glass space-y-3 p-5 sm:p-6">
      <h2 id="trades-h" className="text-lg font-semibold">
        Recent trades
      </h2>
      <LoadState query={trades} source="Ethereum Sepolia RPC" compact skeleton={<div className="sweep h-16" aria-label="Loading trades" />}>
      {(list) => list.length === 0 ? (
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
            {list.slice(0, 8).map((t) => (
              <tr key={`${t.tx}-${t.amountIn}`} className="border-line border-t">
                <td className="num py-1.5">
                  {t.usdcIn
                    ? `${formatUsdc(t.amountIn, { exact: true })} dUSD → ${formatUsdc(t.amountOut, { exact: true })} YT`
                    : `${formatUsdc(t.amountIn, { exact: true })} YT → ${formatUsdc(t.amountOut, { exact: true })} dUSD`}
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
      </LoadState>
      <p className="text-muted text-[13px]">Rate = implied APR after each trade. It reflects YT demand, not the verdict.</p>
    </section>
  );
}
