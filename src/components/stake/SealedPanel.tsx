'use client';

import { Eye, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Address } from 'viem';
import { addresses, verdictMarketAbi } from '@/contracts';
import { computeCommitment, type SealedStake } from '@/lib/commitment';
import { fixtureChain } from '@/lib/fixtureChain';
import { formatUsdc } from '@/lib/format';
import { useTx } from '@/lib/tx';
import { DownloadBackupButton } from './BackupControls';
import { SIDE_COPY } from './SidePicker';

export function SealedPanel({
  stake,
  account,
  chainId,
  onRevealed,
}: {
  stake: SealedStake;
  account: Address;
  chainId: number;
  onRevealed: () => void;
}) {
  const run = useTx();
  const [busy, setBusy] = useState(false);
  const side = SIDE_COPY[stake.side];

  async function reveal() {
    setBusy(true);
    const amount = BigInt(stake.amount);
    const ok = await run({
      label: 'Reveal stake',
      live: () => ({
        address: addresses.VerdictMarket,
        abi: verdictMarketAbi,
        functionName: 'reveal',
        args: [BigInt(stake.claimId), stake.side, amount, stake.salt],
      }),
      fixture: () =>
        fixtureChain.reveal(
          stake.claimId,
          account,
          stake.side,
          amount,
          computeCommitment({
            claimId: BigInt(stake.claimId),
            account,
            side: stake.side,
            amount,
            salt: stake.salt,
          }),
        ),
    });
    setBusy(false);
    if (ok) onRevealed();
  }

  return (
    <div className="space-y-5">
      <div className="paper-plain relative p-5">
        <span className="stamp text-ghost-ink absolute top-3 right-3 text-[0.65rem]">Sealed</span>
        <p className="text-muted flex items-center gap-2 text-sm">
          <Lock size={15} aria-hidden /> Your sealed stake (only you can see this)
        </p>
        <p className="mt-2 text-2xl">
          <span className="num font-semibold">{formatUsdc(stake.amount)}</span> USDC{' '}
          <span className={`font-display ${side.ink}`}>{side.name}</span>
        </p>
        <p className="text-muted mt-1 text-sm">{side.line}</p>
      </div>

      <p className="text-muted text-sm">
        Reveal to open your stake onchain and receive {side.name} shares 1:1. You can trade them on
        the market or hold them to redeem. Stakes that are never revealed are forfeited after the
        reveal deadline.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reveal}
          disabled={busy}
          className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105 disabled:opacity-50"
        >
          <Eye size={18} aria-hidden /> {busy ? 'Waiting for wallet…' : 'Reveal stake'}
        </button>
        <DownloadBackupButton chainId={chainId} account={account} stake={stake} />
      </div>
      <p className="text-muted text-xs">
        Changing browsers or clearing site data deletes the saved secret. Keep the backup file until
        you&apos;ve redeemed.{' '}
        <Link href="#how-payouts-work" className="underline underline-offset-2">
          How payouts work
        </Link>
      </p>
    </div>
  );
}
