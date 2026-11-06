'use client';

import { CaseFrame, CaseHeader, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxLink } from '@/components/TxLink';
import { formatDate } from '@/lib/format';
import { V2_INFO } from '@/protocol';
import { useProtocol } from '@/protocol/hooks';

export function ChainsScreen({ id, base }: { id: string; base: CaseBase }) {
  const { market } = useCase(id, base);
  const { protocol } = useProtocol();
  const info = protocol.kind === 'v2' ? (protocol as typeof import('@/protocol/v2').v2).deploymentBundle : V2_INFO;
  const hasSender = info.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000';
  return <CaseFrame state={market}>{market.data && <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
    <CaseHeader market={market.data} tab="chains" base={base} />
    <section className="glass space-y-4 p-5">
      <h2 className="font-display text-2xl">Cross-chain staking</h2>
      {market.data.series === false || !hasSender ? <p>This report has no configured Arbitrum CCIP sender yet. Local Ethereum Sepolia staking and trading remain available after market setup.</p> : <>
        <p>Arbitrum Sepolia sends dUSD and the stake intent through Chainlink CCIP. Ethereum Sepolia receives the collateral and credits the vote, or issues a recoverable REP receipt if delivery is late.</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt>Source <NetworkBadge chainId={421614} /></dt><dd><TxLink chainId={421614} kind="address" value={info.arbitrumSepolia.CCIPStakeSenderV2} /></dd></div>
          <div><dt>Destination <NetworkBadge chainId={11155111} /></dt><dd><TxLink chainId={11155111} kind="address" value={info.sepolia.CCIPStakeReceiverV2} /></dd></div>
          <div><dt>Cross-chain cutoff</dt><dd>{formatDate(market.data.remoteCutoff ?? market.data.crossChainCutoff)}</dd></div>
        </dl>
        <TrackedCcipList reportId={market.data.reportId} />
      </>}
    </section>
  </main>}</CaseFrame>;
}
