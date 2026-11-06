'use client';

import { ArrowDown, OctagonAlert } from 'lucide-react';
import { useState } from 'react';
import type { Address } from 'viem';
import { useSimulatedChain } from '@/lib/account';
import { fixtureChain } from '@/lib/fixtureChain';
import { formatUsdc, parseUsdc } from '@/lib/format';
import { useTx } from '@/lib/tx';
import type { ClaimView } from '@/lib/types';
import { approvalSteps, routeFor, swapCall, useQuote, type ShareSide } from './useSwap';

const SLIPPAGES = [50, 100, 200] as const; // bps

export function SwapPanel({
  claim,
  account,
  usdcBalance,
  forShares,
  againstShares,
}: {
  claim: ClaimView;
  account?: Address;
  usdcBalance: bigint;
  forShares: bigint;
  againstShares: bigint;
}) {
  const run = useTx();
  const simulated = useSimulatedChain();
  const [side, setSide] = useState<ShareSide>(0);
  const [buy, setBuy] = useState(true);
  const [input, setInput] = useState('');
  const [slippage, setSlippage] = useState<(typeof SLIPPAGES)[number]>(100);
  const [busy, setBusy] = useState(false);
  const [lastRevert, setLastRevert] = useState<string | null>(null);

  const halted = claim.status !== 'Open';
  const amountIn = parseUsdc(input);
  const quote = useQuote(claim, side, buy, halted ? null : amountIn);
  const out = quote.data;
  const minOut = out !== undefined ? (out * BigInt(10_000 - slippage)) / 10_000n : 0n;
  const shareName = side === 0 ? 'For' : 'Against';
  const balanceIn = buy ? usdcBalance : side === 0 ? forShares : againstShares;
  const tooMuch = amountIn !== null && amountIn > balanceIn;
  const route = routeFor(claim, side, buy);
  const poolProblem = !simulated && !route.poolMatches;
  const inLabel = buy ? 'USDC' : `${shareName} shares`;
  const outLabel = buy ? `${shareName} shares` : 'USDC';

  async function swap(force = false) {
    if (!account || !amountIn) return;
    setBusy(true);
    setLastRevert(null);
    try {
      if (!simulated && !force) {
        for (const step of await approvalSteps(account, route.tokenIn, amountIn, inLabel)) {
          if (!(await run(step))) return;
        }
      }
      await run({
        label: force
          ? `Force swap ${inLabel} → ${outLabel}`
          : `Swap ${formatUsdc(amountIn)} ${inLabel} → ${outLabel}`,
        force,
        live: () => swapCall(route, amountIn, force ? 0n : minOut),
        fixture: () =>
          fixtureChain.swap(claim.claimId, account, side, buy, amountIn, force ? 0n : minOut),
        onFailed: setLastRevert,
      });
    } finally {
      setBusy(false);
    }
  }

  const disabled = halted || busy || !account;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Which shares">
        {([0, 1] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={side === s}
            disabled={halted}
            onClick={() => setSide(s)}
            className={`font-display rounded-xl border-2 px-3 py-2.5 text-lg disabled:opacity-50 ${
              side === s
                ? s === 0
                  ? 'border-clue text-clue-ink'
                  : 'border-mask text-mask-ink'
                : 'border-line text-muted'
            }`}
          >
            {s === 0 ? 'For' : 'Against'} shares
          </button>
        ))}
      </div>

      <fieldset disabled={disabled} className="space-y-2 disabled:opacity-60">
        <legend className="sr-only">Swap</legend>
        <AmountBox
          label={`You pay (${inLabel})`}
          value={input}
          onChange={setInput}
          balance={balanceIn}
          onMax={() => setInput(formatUsdc(balanceIn, { exact: true }).replace(/,/g, ''))}
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setBuy(!buy);
              setInput('');
            }}
            aria-label={`Switch direction: ${buy ? 'sell shares for USDC' : 'buy shares with USDC'}`}
            className="border-line bg-surface grid h-9 w-9 place-items-center rounded-full border hover:border-[var(--fog-400)]"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        </div>
        <div className="border-line rounded-xl border px-4 py-3">
          <p className="text-muted text-sm">You receive ({outLabel})</p>
          <p className="num mt-1 text-2xl" aria-live="polite">
            {halted
              ? '—'
              : quote.isFetching
                ? '…'
                : out !== undefined
                  ? formatUsdc(out, { exact: true })
                  : '0.00'}
          </p>
        </div>
      </fieldset>

      {!halted && amountIn && out !== undefined && out > 0n && (
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted">Price</dt>
          <dd className="num text-right">
            {buy
              ? `${(Number(amountIn) / Number(out)).toFixed(4)} USDC per share`
              : `${(Number(out) / Number(amountIn)).toFixed(4)} USDC per share`}
          </dd>
          <dt className="text-muted">Minimum received ({slippage / 100}% slippage)</dt>
          <dd className="num text-right">{formatUsdc(minOut, { exact: true })}</dd>
        </dl>
      )}
      {!halted && (
        <div
          className="flex items-center gap-2 text-sm"
          role="radiogroup"
          aria-label="Slippage tolerance"
        >
          <span className="text-muted">Slippage</span>
          {SLIPPAGES.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={slippage === b}
              onClick={() => setSlippage(b)}
              className={`num rounded-full border px-2.5 py-0.5 ${slippage === b ? 'border-beam text-text' : 'border-line text-muted'}`}
            >
              {b / 100}%
            </button>
          ))}
        </div>
      )}

      {quote.isError && !halted && (
        <p role="alert" className="num text-mask-ink text-sm">
          Quote failed: {quote.error.message}
        </p>
      )}
      {tooMuch && <p className="text-mask-ink text-sm">That&apos;s more than this wallet holds.</p>}
      {poolProblem && (
        <p className="text-mask-ink text-sm">
          The pool settings in this app don&apos;t hash to the pool id the backend reports, so swaps
          are off. (See NOTES.md: fee / tick spacing.)
        </p>
      )}

      {!halted ? (
        <button
          type="button"
          onClick={() => swap()}
          disabled={
            disabled || !amountIn || tooMuch || poolProblem || out === undefined || out === 0n
          }
          className="bg-beam text-on-beam w-full rounded-xl px-5 py-3.5 font-semibold hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!account
            ? 'Connect a wallet to trade'
            : busy
              ? 'Waiting for wallet…'
              : `Swap ${inLabel} for ${outLabel}`}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--mask-500)_50%,transparent)] p-4">
          <p className="text-muted text-sm">
            Trading is halted, so the app won&apos;t send swaps. To prove the pool itself refuses,
            you can force a 1 USDC swap past the app. The hook reverts it onchain.
          </p>
          <button
            type="button"
            onClick={() => {
              setInput('1');
              setBuy(true);
              void (async () => {
                if (!account) return;
                setBusy(true);
                setLastRevert(null);
                try {
                  await run({
                    label: `Force swap 1 USDC → ${shareName} shares`,
                    force: true,
                    live: () => swapCall(routeFor(claim, side, true), 1_000_000n, 0n),
                    fixture: () =>
                      fixtureChain.swap(claim.claimId, account, side, true, 1_000_000n, 0n),
                    onFailed: setLastRevert,
                  });
                } finally {
                  setBusy(false);
                }
              })();
            }}
            disabled={busy || !account}
            className="border-mask text-mask-ink inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:bg-[color-mix(in_srgb,var(--mask-500)_10%,transparent)] disabled:opacity-50"
          >
            <OctagonAlert size={18} aria-hidden />{' '}
            {busy ? 'Sending…' : account ? 'Send it anyway' : 'Connect a wallet to try'}
          </button>
        </div>
      )}

      {lastRevert && (
        <div
          role="alert"
          className="border-mask rounded-xl border bg-[color-mix(in_srgb,var(--mask-500)_12%,transparent)] p-4"
        >
          <p className="text-mask-ink font-semibold">Swap reverted</p>
          <p className="num mt-1 text-lg">{lastRevert}</p>
        </div>
      )}
    </div>
  );
}

function AmountBox({
  label,
  value,
  onChange,
  balance,
  onMax,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  balance: bigint;
  onMax: () => void;
}) {
  return (
    <div className="border-line focus-within:border-beam rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-[var(--focus)]">
      <div className="flex items-baseline justify-between">
        <label htmlFor="swap-in" className="text-muted text-sm">
          {label}
        </label>
        <button type="button" onClick={onMax} className="text-muted hover:text-text text-xs">
          Balance <span className="num">{formatUsdc(balance)}</span> · Max
        </button>
      </div>
      <input
        id="swap-in"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num mt-1 w-full bg-transparent text-2xl outline-none focus-visible:outline-none"
      />
    </div>
  );
}
