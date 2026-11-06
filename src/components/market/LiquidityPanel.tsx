'use client';

import { useState } from 'react';
import { Banner } from '@/components/Banner';
import { AmountField, ApprovalToggle, validAmount, WritesBlockedNote } from '@/components/forms';
import { SimulatedYieldLabel } from '@/components/HonestyLabels';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { formatDate, formatUsdc } from '@/lib/format';
import { lpRemoveOut, lpSharesFor, minOutFor, pairLiquidity, tradingOpen, DEFAULT_SLIPPAGE_BPS, type MarketView, type PositionView } from '@/protocol';
import { useActiveAccount, useChainTime, useProtocol, useWritesAllowed } from '@/protocol/hooks';

type Mode = 'add' | 'remove';

/**
 * Hook-owned liquidity (YieldCurveHookV2): add approves dUSD and YT to the hook and must match the
 * reserves exactly after the first LP; remove burns RF-YLP (no approval) and stays open after
 * maturity, as does claimLPYield. Never the PoolManager's own liquidity methods.
 */
export function LiquidityPanel({ market: m, pos }: { market: MarketView; pos: PositionView }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const now = useChainTime() ?? m.chainTime;
  const writes = useWritesAllowed();
  const plan = usePlan();
  const claimPlan = usePlan();
  const [mode, setMode] = useState<Mode>('add');
  const [anchor, setAnchor] = useState<'usdc' | 'yt'>('usdc');
  const [amountStr, setAmountStr] = useState('');
  const [initialUsdcStr, setInitialUsdcStr] = useState('');
  const [initialYtStr, setInitialYtStr] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const p = m.market;
  if (!p || !protocol.addLiquidity) return null;
  const pool = { supply: p.sharesSupply ?? 0n, usdcReserve: p.reserves?.usdc ?? 0n, ytReserve: p.reserves?.yt ?? 0n };
  const initialPool = pool.supply === 0n;
  const addOpen = tradingOpen(m, now);
  const share = pool.supply > 0n ? Number((pos.lpShares * 10_000n) / pool.supply) / 100 : 0;
  const mine = lpRemoveOut(pos.lpShares, pool);

  const anchorBalance = anchor === 'usdc' ? pos.dusdBalance : pos.yt;
  const amount = validAmount(amountStr, mode === 'add' ? anchorBalance : pos.lpShares);
  const initialUsdc = mode === 'add' && initialPool ? validAmount(initialUsdcStr, pos.dusdBalance) : undefined;
  const initialYt = mode === 'add' && initialPool ? validAmount(initialYtStr, pos.yt) : undefined;
  const initialShares = initialUsdc && initialYt ? lpSharesFor(initialUsdc, initialYt, pool) : undefined;
  const pair = mode === 'add'
    ? initialPool
      ? initialUsdc && initialYt && initialShares
        ? { usdc: initialUsdc, yt: initialYt, shares: initialShares }
        : undefined
      : amount
        ? pairLiquidity(anchor, amount, pool)
        : undefined
    : undefined;
  const pairShort = pair && (pair.usdc > pos.dusdBalance || pair.yt > pos.yt);
  const removeOut = mode === 'remove' && amount ? lpRemoveOut(amount, pool) : undefined;

  const submit = async () => {
    if (!address) return;
    setDone(null);
    let r;
    if (mode === 'add') {
      if (!pair) return;
      r = await plan.start(() => protocol.addLiquidity!(pair.usdc, pair.yt, pair.shares, address, { unlimited }));
    } else {
      if (!amount || !removeOut) return;
      const shareAmount = amount;
      const output = removeOut;
      r = await plan.start(() =>
        protocol.removeLiquidity!(shareAmount, minOutFor(output.usdc, DEFAULT_SLIPPAGE_BPS), minOutFor(output.yt, DEFAULT_SLIPPAGE_BPS), address),
      );
    }
    if (!r.ok) return;
    setAmountStr('');
    setInitialUsdcStr('');
    setInitialYtStr('');
    setDone(
      mode === 'add'
        ? `Minted ${formatUsdc(r.effect.lpMinted ?? pair!.shares)} RF-YLP.`
        : `Received ${formatUsdc(r.effect.lpRemoved?.usdc ?? removeOut!.usdc)} dUSD and ${formatUsdc(r.effect.lpRemoved?.yt ?? removeOut!.yt)} YT.`,
    );
  };

  return (
    <section aria-labelledby="lp-h" className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lp-h" className="font-semibold">
          Liquidity (RF-YLP)
        </h2>
        <NetworkBadge chainId={11155111} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Your RF-YLP</dt>
          <dd className="num font-semibold">
            {formatUsdc(pos.lpShares)} <span className="text-muted font-normal">({share.toFixed(2)}% of the pool)</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Your share of reserves</dt>
          <dd className="num">
            {formatUsdc(mine.usdc)} dUSD + {formatUsdc(mine.yt)} YT
          </dd>
        </div>
        <div>
          <dt className="text-muted">LP yield claimable (estimate until checkpoint)</dt>
          <dd className="num">{formatUsdc(pos.lpClaimable, { exact: true })} dUSD</dd>
        </div>
        <div>
          <dt className="text-muted">LP yield index</dt>
          <dd className="num text-xs break-all">{p.lpYieldPerShare?.toString() ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={claimPlan.running || pos.lpShares === 0n && pos.lpClaimable === 0n || !writes.allowed}
          onClick={() => void claimPlan.start(() => protocol.claimLPYield!(m.reportId, address))}
          className="border-line rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
        >
          Claim LP yield
        </button>
        <SimulatedYieldLabel />
      </div>
      <TxPlanStepper steps={claimPlan.steps} buildError={claimPlan.buildError} />
      {claimPlan.result?.ok && claimPlan.result.effect.paid !== undefined && (
        <p className="text-clue-ink text-sm" role="status">
          Received {formatUsdc(claimPlan.result.effect.paid, { exact: true })} dUSD.
        </p>
      )}

      <div role="radiogroup" aria-label="Liquidity action" className="flex gap-2">
        {(['add', 'remove'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => {
              setMode(k);
              setAmountStr('');
              setInitialUsdcStr('');
              setInitialYtStr('');
              setDone(null);
            }}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${mode === k ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]' : 'border-line text-muted'}`}
          >
            {k === 'add' ? 'Add liquidity' : 'Remove liquidity'}
          </button>
        ))}
      </div>

      {mode === 'add' ? (
        !addOpen ? (
          <p className="text-muted text-sm">The market matured on {formatDate(p.maturity || m.maturity)}: the hook accepts no new liquidity. Removing and claiming still work.</p>
        ) : (
          <div className="space-y-3">
            {initialPool ? (
              <>
                <Banner tone="info" title="Create the initial liquidity position">
                  This pool is empty. Choose both amounts; this deposit establishes the dUSD/YT reserve ratio for later LPs and swaps.
                </Banner>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AmountField label="Initial dUSD" unit="dUSD" value={initialUsdcStr} onChange={setInitialUsdcStr} balance={pos.dusdBalance} />
                  <AmountField label="Initial YT" unit="YT" value={initialYtStr} onChange={setInitialYtStr} balance={pos.yt} />
                </div>
                {pair && (
                  <p className="text-sm">
                    Deposits <span className="num font-semibold">{formatUsdc(pair.usdc, { exact: true })}</span> dUSD +{' '}
                    <span className="num font-semibold">{formatUsdc(pair.yt, { exact: true })}</span> YT and mints about{' '}
                    <span className="num font-semibold">{formatUsdc(pair.shares, { exact: true })}</span> RF-YLP.
                  </p>
                )}
                <p className="text-muted text-xs">Both amounts must be above zero and within your balances. A 1:1 starting pair such as 50 dUSD + 50 YT is simplest for the demo.</p>
              </>
            ) : (
              <>
                <fieldset className="flex flex-wrap gap-3 text-sm">
                  <legend className="text-muted mb-1">Enter the amount of</legend>
                  {(['usdc', 'yt'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1.5">
                      <input type="radio" name="anchor" checked={anchor === k} onChange={() => setAnchor(k)} />
                      {k === 'usdc' ? 'dUSD' : 'YT'}
                    </label>
                  ))}
                </fieldset>
                <AmountField label={`Amount (${anchor === 'usdc' ? 'dUSD' : 'YT'})`} unit={anchor === 'usdc' ? 'dUSD' : 'YT'} value={amountStr} onChange={setAmountStr} balance={anchorBalance} />
                {amount &&
                  (pair ? (
                    <p className={`text-sm ${pairShort ? 'text-mask-ink' : ''}`}>
                      Deposits exactly <span className="num font-semibold">{formatUsdc(pair.usdc, { exact: true })}</span> dUSD +{' '}
                      <span className="num font-semibold">{formatUsdc(pair.yt, { exact: true })}</span> YT for <span className="num">{formatUsdc(pair.shares, { exact: true })}</span> RF-YLP
                      {pairShort ? ' — more than you hold.' : '.'}
                    </p>
                  ) : (
                    <p className="text-mask-ink text-sm">No exact match with the reserves for this amount. Try a slightly different amount.</p>
                  ))}
                <p className="text-muted text-xs">Deposits must follow the current reserve ratio. The ratio is checked again right before sending.</p>
              </>
            )}
            <ApprovalToggle unlimited={unlimited} onChange={setUnlimited} />
          </div>
        )
      ) : (
        <div className="space-y-3">
          <AmountField label="Shares to remove (RF-YLP)" unit="RF-YLP" value={amountStr} onChange={setAmountStr} balance={pos.lpShares} />
          {removeOut && (
            <p className="text-sm">
              You receive about <span className="num">{formatUsdc(removeOut.usdc, { exact: true })}</span> dUSD + <span className="num">{formatUsdc(removeOut.yt, { exact: true })}</span> YT
              (0.5% minimum-out). No approval needed.
            </p>
          )}
        </div>
      )}
      <WritesBlockedNote />
      {(mode === 'remove' || addOpen) && (
        <button
          type="button"
          disabled={!address || plan.running || !writes.allowed || (mode === 'add' ? !pair || !!pairShort : !amount)}
          onClick={() => void submit()}
          className="bg-beam text-on-beam w-full rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-50"
        >
          {plan.running ? 'Working…' : mode === 'add' ? 'Add liquidity' : 'Remove liquidity'}
        </button>
      )}
      <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
      {done && <Banner tone="success" title={done} />}
    </section>
  );
}
