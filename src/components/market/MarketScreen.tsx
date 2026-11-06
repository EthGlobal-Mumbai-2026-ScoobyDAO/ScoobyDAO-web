'use client';

import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { CaseHeader } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { DemoWalletBar } from '@/components/DemoWalletBar';
import { FrozenBanner } from '@/components/FrozenBanner';
import { OddsBar } from '@/components/OddsBar';
import { TxLink } from '@/components/TxLink';
import { useActiveAccount } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { useStakeChain } from '@/lib/chain';
import { formatUsdc } from '@/lib/format';
import { SwapPanel } from './SwapPanel';

export function MarketScreen({ claimId }: { claimId: string }) {
  const { claim, report } = useCase(claimId);
  const { address } = useActiveAccount();
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
            <Link href="/cases" className="underline">
              Browse cases
            </Link>
          ) : (
            claim.error.message
          )}
        </Banner>
      </main>
    );
  }
  if (!c) {
    return (
      <main
        className="mx-auto max-w-6xl space-y-6 px-4 py-10"
        aria-busy="true"
        aria-label="Loading market"
      >
        <div className="sweep h-12 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="sweep h-96" />
          <div className="sweep h-64" />
        </div>
      </main>
    );
  }

  const resolved =
    c.status === 'ResolvedPass' || c.status === 'ResolvedFail' || c.status === 'Refunded';

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      <CaseHeader claim={c} report={report} tab="market" />
      {c.status === 'Frozen' && <FrozenBanner block={chain.frozenBlock} what="trading" />}
      {resolved && (
        <Banner tone="info" title="Case closed: trading has ended">
          Winning shares redeem for USDC on the{' '}
          <Link href={`/case/${c.claimId}/stake`} className="underline underline-offset-4">
            stake page
          </Link>
          .
        </Banner>
      )}
      <DemoWalletBar />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="swap-h" className="glass p-5 sm:p-6">
          <h2 id="swap-h" className="font-display mb-5 text-2xl">
            Trade shares
          </h2>
          <SwapPanel
            claim={c}
            account={address}
            usdcBalance={chain.usdcBalance}
            forShares={chain.forShares}
            againstShares={chain.againstShares}
          />
        </section>
        <section aria-labelledby="odds-h" className="glass space-y-5 p-5 sm:p-6">
          <h2 id="odds-h" className="font-semibold">
            Market odds
          </h2>
          <OddsBar
            probability={c.impliedForProbability}
            forRevealed={chain.totals.forRevealed}
            againstRevealed={chain.totals.againstRevealed}
          />
          <p className="text-muted text-sm">
            For and Against shares each redeem for a slice of the pot if their side wins. The For
            share price is the market&apos;s guess that the claim holds. A thin pool price
            isn&apos;t evidence; only the trigger decides the case.
          </p>
          {address && (
            <dl className="border-line grid grid-cols-3 gap-3 border-t pt-4">
              <div>
                <dt className="text-muted text-xs">Your USDC</dt>
                <dd className="num mt-1 text-lg">{formatUsdc(chain.usdcBalance)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Your For shares</dt>
                <dd className="num text-clue-ink mt-1 text-lg">{formatUsdc(chain.forShares)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Your Against shares</dt>
                <dd className="num text-mask-ink mt-1 text-lg">
                  {formatUsdc(chain.againstShares)}
                </dd>
              </div>
            </dl>
          )}
          <dl className="border-line space-y-1.5 border-t pt-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">For share token</dt>
              <dd>
                <TxLink kind="token" value={c.shareTokens.for} />
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">Against share token</dt>
              <dd>
                <TxLink kind="token" value={c.shareTokens.against} />
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">Pools</dt>
              <dd>Uniswap v4, guarded by the freeze hook</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
