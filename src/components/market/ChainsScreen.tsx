'use client';

import { ArrowRight, Globe2 } from 'lucide-react';
import { CaseFrame, CaseHeader, casePath, type CaseBase } from '@/components/case/CaseHeader';
import { useCase } from '@/components/case/useCase';
import { TrackedCcipList } from '@/components/ccip/CcipTracker';
import { Countdown } from '@/components/Countdown';
import { NetworkBadge } from '@/components/NetworkBadge';
import { SniffPose } from '@/components/SniffPose';
import { TxLink } from '@/components/TxLink';
import { Card, KeyValue, Page, TechnicalDetails } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { remoteCutoffOf, remoteSendOpen, V2_INFO } from '@/protocol';
import { useChainTime, useProtocol, useTrackedCcip } from '@/protocol/hooks';
import Link from 'next/link';

const ARB = 421614;
const SEPOLIA = 11155111;

export function ChainsScreen({ id, base }: { id: string; base: CaseBase }) {
  const { market } = useCase(id, base);
  const { protocol } = useProtocol();
  const info = protocol.kind === 'v2' ? (protocol as typeof import('@/protocol/v2').v2).deploymentBundle : V2_INFO;
  const hasSender = info.arbitrumSepolia.CCIPStakeSenderV2 !== '0x0000000000000000000000000000000000000000';
  const now = useChainTime();
  const tracked = useTrackedCcip(market.data?.reportId);
  const m = market.data;
  const configured = !!m && m.series !== false && hasSender;
  const cutoff = m ? (remoteCutoffOf(m) ?? m.crossChainCutoff) : 0;
  const open = !!m && configured && remoteSendOpen(m, now ?? m.chainTime);
  return (
    <CaseFrame state={market}>
      {m && (
        <Page>
          <CaseHeader market={m} tab="chains" base={base} facts={['testToken', 'ccipNotVote']} />
          {!configured ? (
            <Card className="flex flex-wrap items-center gap-5">
              <SniffPose pose="shrug" size={88} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.375rem] font-semibold">Cross-chain staking isn&apos;t set up</h2>
                <p className="text-muted mt-1 text-[15px]">This market has no Arbitrum Sepolia sender yet. You can still stake directly on Ethereum Sepolia.</p>
              </div>
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
              <Card variant={open ? 'highlight' : 'default'}>
                <div className="flex flex-wrap items-center gap-2">
                  <NetworkBadge chainId={ARB} />
                  <ArrowRight size={16} aria-hidden className="text-muted" />
                  <NetworkBadge chainId={SEPOLIA} />
                </div>
                <h2 className="mt-4 text-[1.375rem] font-semibold sm:text-2xl">Stake from Arbitrum Sepolia</h2>
                <p className="text-muted mt-1 text-[15px]">Chainlink CCIP carries your dUSD and your Yes/No choice to Ethereum Sepolia. It counts once it is credited there.</p>
                <p className="mt-4 text-[15px]">
                  {open ? (
                    <>
                      Open until <span className="font-semibold">{formatDate(cutoff)}</span>{' '}
                      <span className="text-beam-ink font-semibold">
                        (in <Countdown to={cutoff} now={now ?? m.chainTime} endedLabel="now" />)
                      </span>
                    </>
                  ) : (
                    <>Closed on {formatDate(cutoff)}. Messages arriving later become REP receipts, not votes.</>
                  )}
                </p>
                {open && (
                  <Link
                    href={casePath(base, m.reportId, 'stake')}
                    className="bg-beam text-on-beam mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105"
                  >
                    <Globe2 size={18} aria-hidden /> Stake via CCIP
                  </Link>
                )}
              </Card>
              <Card title="Your cross-chain stakes">
                {tracked.length === 0 ? (
                  <p className="text-muted text-[15px]">None sent from this browser yet. Each one gets a live tracker page.</p>
                ) : (
                  <TrackedCcipList reportId={m.reportId} />
                )}
              </Card>
            </div>
          )}
          {configured && (
            <TechnicalDetails className="mt-8">
              <KeyValue
                items={[
                  {
                    label: (
                      <>
                        Sender on Arbitrum Sepolia <span className="num text-xs">CCIPStakeSenderV2</span>
                      </>
                    ),
                    value: <TxLink chainId={ARB} kind="address" value={info.arbitrumSepolia.CCIPStakeSenderV2} />,
                  },
                  {
                    label: (
                      <>
                        Receiver on Ethereum Sepolia <span className="num text-xs">CCIPStakeReceiverV2</span>
                      </>
                    ),
                    value: <TxLink chainId={SEPOLIA} kind="address" value={info.sepolia.CCIPStakeReceiverV2} />,
                  },
                  { label: 'Registry cross-chain cutoff', value: formatDate(m.crossChainCutoff) },
                  { label: 'Sender cutoff', value: m.remoteCutoff ? formatDate(m.remoteCutoff) : m.remoteError ? 'Arbitrum read failed' : '—' },
                ]}
              />
            </TechnicalDetails>
          )}
        </Page>
      )}
    </CaseFrame>
  );
}
