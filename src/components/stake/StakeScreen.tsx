'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArrowRightLeft, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Address } from 'viem';
import { Banner } from '@/components/Banner';
import { CaseHeader } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { DemoWalletBar } from '@/components/DemoWalletBar';
import { FrozenBanner } from '@/components/FrozenBanner';
import { MaskOffIcon } from '@/components/icons';
import { MaskPop } from '@/components/MaskPop';
import { SniffPose } from '@/components/SniffPose';
import { useActiveAccount } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { useStakeChain, type StakeChainState } from '@/lib/chain';
import { loadStake, type SealedStake } from '@/lib/commitment';
import { env } from '@/lib/env';
import { formatUsdc } from '@/lib/format';
import type { ClaimView } from '@/lib/types';
import { RestoreBackup } from './BackupControls';
import { CommitForm } from './CommitForm';
import { RedeemPanel } from './RedeemPanel';
import { SealedPanel } from './SealedPanel';
import { TotalsCard } from './TotalsCard';

export function StakeScreen({ claimId }: { claimId: string }) {
  const { claim, report } = useCase(claimId);
  const { address, isDemo } = useActiveAccount();
  const c = claim.data;
  const chain = useStakeChain(c, address);

  if (claim.isError) {
    const nf = claim.error instanceof ApiError && claim.error.status === 404;
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Banner
          tone="danger"
          title={nf ? `There's no case #${claimId}` : "Couldn't load this case"}
        >
          {nf ? (
            <>
              It may not be published yet.{' '}
              <Link href="/cases" className="underline">
                Browse open cases
              </Link>
              .
            </>
          ) : (
            claim.error.message
          )}
        </Banner>
      </main>
    );
  }
  if (!c) return <StakeSkeleton />;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      <CaseHeader claim={c} report={report} tab="stake" />
      <StatusBanner claim={c} frozenBlock={chain.frozenBlock} />
      <DemoWalletBar />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="action-h" className="glass p-5 sm:p-6">
          <h2 id="action-h" className="font-display mb-5 text-2xl">
            {c.status === 'Open'
              ? 'Stake your verdict'
              : c.status === 'Frozen'
                ? 'Your stake'
                : 'Redeem'}
          </h2>
          {!address ? (
            <div className="space-y-4">
              <p className="text-muted">Connect a wallet on Sepolia to stake, reveal or redeem.</p>
              <ConnectButton />
            </div>
          ) : (
            <Actions key={`${address}:${isDemo}`} claim={c} account={address} chain={chain} />
          )}
        </section>
        <TotalsCard claim={c} totals={chain.totals} feeBps={chain.feeBps} />
      </div>
    </main>
  );
}

function StatusBanner({ claim, frozenBlock }: { claim: ClaimView; frozenBlock?: bigint }) {
  switch (claim.status) {
    case 'Frozen':
      return <FrozenBanner block={frozenBlock} what="staking and trading" />;
    case 'ResolvedPass':
      return (
        <div className="relative">
          <Banner tone="warning" size="xl" icon={MaskOffIcon} title="Unmasked: the claim held">
            <p className="sm:pr-40">
              The trap sprang during the case window. For shares win; redeem below.
            </p>
          </Banner>
          <MaskPop
            claimId={claim.claimId}
            className="pointer-events-none absolute top-1/2 right-4 hidden h-36 w-36 -translate-y-1/2 sm:block"
          />
        </div>
      );
    case 'ResolvedFail':
      return (
        <div className="relative">
          <Banner tone="info" size="xl" icon={CircleCheck} title="Cleared: the claim didn't hold">
            <p className="sm:pr-36">
              The window ended without a trigger. Against shares win; redeem below.
            </p>
          </Banner>
          <div className="pointer-events-none absolute top-1/2 right-6 hidden -translate-y-1/2 sm:block">
            <SniffPose pose="shrug" size={104} decorative />
          </div>
        </div>
      );
    case 'Refunded':
      return (
        <Banner tone="info" title="Refunded">
          Only one side revealed a stake, so every revealed stake is refunded minus the fee.
        </Banner>
      );
    default:
      return null;
  }
}

function Actions({
  claim,
  account,
  chain,
}: {
  claim: ClaimView;
  account: Address;
  chain: StakeChainState;
}) {
  const chainId = env.chainId;
  const [local, setLocal] = useState<SealedStake | null>(() =>
    loadStake(chainId, claim.claimId, account),
  );
  const shares = chain.forShares + chain.againstShares;
  const resolved =
    claim.status === 'ResolvedPass' ||
    claim.status === 'ResolvedFail' ||
    claim.status === 'Refunded';

  if (!chain.ready)
    return <div className="sweep h-48" aria-busy="true" aria-label="Reading the chain" />;

  const barred = chain.excluded && (
    <Banner tone="barred" title="This wallet can't stake on this case">
      Wallets linked to the token deployer can&apos;t stake on this claim.
    </Banner>
  );

  if (resolved) {
    return (
      <div className="space-y-5">
        <RedeemPanel
          claim={claim}
          account={account}
          forShares={chain.forShares}
          againstShares={chain.againstShares}
          totals={chain.totals}
          feeBps={chain.feeBps}
          redeemed={chain.redeemed}
        />
        {local && shares === 0n && !chain.redeemed && (
          <SealedPanel
            stake={local}
            account={account}
            chainId={chainId}
            onRevealed={chain.refetch}
          />
        )}
      </div>
    );
  }

  if (shares > 0n) {
    const side = chain.forShares > 0n ? 'For' : 'Against';
    return (
      <div className="space-y-4">
        <p className="text-lg">
          Revealed: you hold <span className="num font-semibold">{formatUsdc(shares)}</span>{' '}
          <span className={side === 'For' ? 'text-clue-ink' : 'text-mask-ink'}>{side} shares</span>.
        </p>
        <p className="text-muted text-sm">
          Hold them to redeem when the case resolves, or trade them against USDC.
        </p>
        {claim.status === 'Open' && (
          <Link
            href={`/case/${claim.claimId}/market`}
            className="border-line inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]"
          >
            <ArrowRightLeft size={18} aria-hidden /> Trade shares
          </Link>
        )}
      </div>
    );
  }

  if (local) {
    return (
      <SealedPanel stake={local} account={account} chainId={chainId} onRevealed={chain.refetch} />
    );
  }

  if (claim.status !== 'Open') {
    return (
      <div className="space-y-4">
        {barred}
        <p className="text-muted">
          Staking closed when the trap sprang. If you staked from another browser, restore your
          backup to reveal.
        </p>
        <RestoreBackup
          chainId={chainId}
          claimId={claim.claimId}
          account={account}
          onRestored={setLocal}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {barred}
      <CommitForm
        claim={claim}
        account={account}
        chainId={chainId}
        usdcBalance={chain.usdcBalance}
        allowance={chain.allowance}
        feeBps={chain.feeBps}
        totals={chain.totals}
        disabled={chain.excluded}
        onCommitted={setLocal}
      />
      {!chain.excluded && (
        <RestoreBackup
          chainId={chainId}
          claimId={claim.claimId}
          account={account}
          onRestored={setLocal}
        />
      )}
    </div>
  );
}

function StakeSkeleton() {
  return (
    <main
      className="mx-auto max-w-6xl space-y-6 px-4 py-10"
      aria-busy="true"
      aria-label="Loading case"
    >
      <div className="sweep h-12 w-64" />
      <div className="sweep h-6 w-full max-w-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="sweep h-80" />
        <div className="sweep h-80" />
      </div>
    </main>
  );
}
