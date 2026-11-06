'use client';

import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import type { Address } from 'viem';
import { addresses, verdictMarketAbi } from '@/contracts';
import { fixtureChain } from '@/lib/fixtureChain';
import { formatUsdc } from '@/lib/format';
import { refundPayout, winnerOf, winningPayout } from '@/lib/payout';
import { useTx } from '@/lib/tx';
import type { ClaimView } from '@/lib/types';
import { PayoutPreview } from './PayoutPreview';

export function RedeemPanel({
  claim,
  account,
  forShares,
  againstShares,
  totals,
  feeBps,
  redeemed,
}: {
  claim: ClaimView;
  account: Address;
  forShares: bigint;
  againstShares: bigint;
  totals: ClaimView['totals'];
  feeBps: bigint;
  redeemed?: bigint;
}) {
  const run = useTx();
  const [busy, setBusy] = useState(false);
  const F = BigInt(totals.forRevealed);
  const A = BigInt(totals.againstRevealed);
  const refunded = claim.status === 'Refunded';
  const winner = winnerOf(claim.status);

  if (redeemed && redeemed > 0n) {
    return (
      <p className="flex items-start gap-2 text-lg">
        <CircleCheck className="text-clue-ink mt-1 shrink-0" size={20} aria-hidden />
        <span>
          Redeemed{' '}
          <span className="num font-semibold">{formatUsdc(redeemed, { exact: true })} USDC</span> to
          this wallet.
        </span>
      </p>
    );
  }

  const s = refunded ? forShares + againstShares : winner === 'For' ? forShares : againstShares;
  const W = winner === 'For' ? F : A;
  const L = winner === 'For' ? A : F;
  const losing = refunded ? 0n : winner === 'For' ? againstShares : forShares;
  const payout = refunded ? refundPayout(s, feeBps) : winningPayout(s, W, L, feeBps);

  if (s === 0n) {
    return (
      <p className="text-muted text-base">
        {losing > 0n
          ? `Your ${winner === 'For' ? 'Against' : 'For'} shares (${formatUsdc(losing)}) were on the losing side, so there's nothing to redeem.`
          : "This wallet holds no winning shares for this case. If you staked but never revealed, the stake can't be redeemed."}
      </p>
    );
  }

  async function redeem() {
    setBusy(true);
    await run({
      label: `Redeem ${formatUsdc(payout)} USDC`,
      live: () => ({
        address: addresses.VerdictMarket,
        abi: verdictMarketAbi,
        functionName: 'redeem',
        args: [BigInt(claim.claimId)],
      }),
      fixture: () => fixtureChain.redeem(claim.claimId, account, payout),
    });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <PayoutPreview
        s={s}
        W={W}
        L={L}
        feeBps={feeBps}
        refund={refunded}
        caption={
          refunded
            ? 'Only one side revealed, so every revealed stake is refunded minus the fee.'
            : `${winner} won. Your ${winner} shares redeem for:`
        }
      />
      <button
        type="button"
        onClick={redeem}
        disabled={busy}
        className="bg-beam text-on-beam w-full rounded-xl px-5 py-3.5 font-semibold hover:brightness-105 disabled:opacity-50"
      >
        {busy ? 'Waiting for wallet…' : `Redeem ${formatUsdc(payout, { exact: true })} USDC`}
      </button>
    </div>
  );
}
