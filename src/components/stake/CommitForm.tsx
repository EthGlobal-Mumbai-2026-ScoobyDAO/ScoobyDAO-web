'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import type { Address } from 'viem';
import { addresses, usdcAbi, verdictMarketAbi } from '@/contracts';
import {
  clearStake,
  computeCommitment,
  downloadBackup,
  makeBackup,
  randomSalt,
  saveStake,
  type SealedStake,
} from '@/lib/commitment';
import { fixtureChain } from '@/lib/fixtureChain';
import { formatUsdc, parseUsdc } from '@/lib/format';
import { winningPayout } from '@/lib/payout';
import { useTx } from '@/lib/tx';
import { Side, type ClaimView } from '@/lib/types';
import { SIDE_COPY, SidePicker } from './SidePicker';

export function CommitForm({
  claim,
  account,
  chainId,
  usdcBalance,
  allowance,
  feeBps,
  totals,
  disabled,
  onCommitted,
}: {
  claim: ClaimView;
  account: Address;
  chainId: number;
  usdcBalance: bigint;
  allowance: bigint;
  feeBps: bigint;
  totals: ClaimView['totals'];
  disabled?: boolean;
  onCommitted: (s: SealedStake) => void;
}) {
  const run = useTx();
  const [side, setSide] = useState<Side | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = parseUsdc(input);
  const tooMuch = amount !== null && amount > usdcBalance;
  const invalid = input !== '' && (amount === null || amount === 0n);
  const needsApproval = amount !== null && allowance < amount;
  const canSubmit =
    !disabled && !busy && side !== null && amount !== null && amount > 0n && !tooMuch;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || side === null || amount === null) return;
    setBusy(true);
    const stake: SealedStake = {
      claimId: claim.claimId,
      side,
      amount: amount.toString(),
      salt: randomSalt(),
    };
    const commitment = computeCommitment({
      claimId: BigInt(claim.claimId),
      account,
      side,
      amount,
      salt: stake.salt,
    });
    // Save the salt before any tx: without it the stake can never be revealed.
    if (!saveStake(chainId, account, stake)) downloadBackup(makeBackup(chainId, account, stake));

    try {
      if (needsApproval) {
        const ok = await run({
          label: `Approve ${formatUsdc(amount)} USDC`,
          live: () => ({
            address: addresses.USDC,
            abi: usdcAbi,
            functionName: 'approve',
            args: [addresses.VerdictMarket, amount],
          }),
          fixture: () => fixtureChain.approve(account, amount),
        });
        if (!ok) return clearStake(chainId, claim.claimId, account);
      }
      const ok = await run({
        label: 'Commit sealed stake',
        live: () => ({
          address: addresses.VerdictMarket,
          abi: verdictMarketAbi,
          functionName: 'commit',
          args: [BigInt(claim.claimId), commitment, amount],
        }),
        fixture: () => fixtureChain.commit(claim.claimId, account, commitment, amount),
      });
      if (!ok) return clearStake(chainId, claim.claimId, account);
      onCommitted(stake);
    } finally {
      setBusy(false);
    }
  }

  const W = BigInt(totals.forRevealed);
  const L = BigInt(totals.againstRevealed);
  const preview =
    side !== null && amount
      ? side === Side.For
        ? winningPayout(amount, W + amount, L, feeBps)
        : winningPayout(amount, L + amount, W, feeBps)
      : null;

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="sealed-help">
      <SidePicker value={side} onChange={setSide} disabled={disabled || busy} />

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="amount" className="text-muted text-sm">
            Stake (USDC)
          </label>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setInput(formatUsdc(usdcBalance, { exact: true }).replace(/,/g, ''))}
            className="text-muted hover:text-text text-xs"
          >
            Balance: <span className="num">{formatUsdc(usdcBalance)}</span> · Max
          </button>
        </div>
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={input}
          disabled={disabled || busy}
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={invalid || tooMuch}
          aria-describedby="amount-err"
          className="num border-line focus:border-beam mt-1.5 w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-4 py-3 text-2xl outline-none disabled:opacity-50"
        />
        <p
          id="amount-err"
          className="text-mask-ink mt-1 min-h-5 text-sm"
          role={invalid || tooMuch ? 'alert' : undefined}
        >
          {invalid
            ? 'Enter an amount above 0 with up to 6 decimals.'
            : tooMuch
              ? "That's more USDC than this wallet holds."
              : ''}
        </p>
      </div>

      <p
        id="sealed-help"
        className="text-muted flex items-start gap-2 text-sm"
        title="Your side stays sealed until reveal"
      >
        <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
        Your side stays sealed until reveal. Only a hash goes onchain now; the secret that unlocks
        it is saved in this browser, and you can download a backup.
      </p>

      {preview !== null && side !== null && (
        <p className="rounded-lg bg-[color-mix(in_srgb,var(--fog-400)_10%,transparent)] px-3 py-2 text-sm">
          If <span className={SIDE_COPY[side].ink}>{SIDE_COPY[side].name}</span> wins with
          today&apos;s revealed stakes, this pays{' '}
          <span className="num font-semibold">{formatUsdc(preview, { exact: true })} USDC</span>. It
          changes as others reveal.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="bg-beam text-on-beam w-full rounded-xl px-5 py-3.5 text-base font-semibold hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? 'Waiting for wallet…'
          : needsApproval
            ? 'Approve USDC, then commit'
            : 'Commit sealed stake'}
      </button>
      {needsApproval && !busy && (
        <p className="text-muted -mt-3 text-center text-xs">
          Two transactions: USDC approval, then the sealed commit.
        </p>
      )}
    </form>
  );
}
