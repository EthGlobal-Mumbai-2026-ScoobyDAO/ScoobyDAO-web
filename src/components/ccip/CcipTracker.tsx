'use client';

import { CheckCircle2, Circle, ExternalLink, Loader2, PauseCircle, Undo2 } from 'lucide-react';
import Link from 'next/link';
import type { Hex } from 'viem';
import { zeroAddress } from 'viem';
import { Banner } from '@/components/Banner';
import { CcipNotVoteLabel } from '@/components/HonestyLabels';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { explorer } from '@/lib/explorer';
import { formatDate, formatUsdc, shortHex } from '@/lib/format';
import { CCIP_SLOW_MINUTES, isSlow, type CcipStake } from '@/protocol';
import { useActiveAccount, useCcip, useChainTime, useProtocol } from '@/protocol/hooks';

const ARB = 421614;
const SEPOLIA = 11155111;

type StepState = 'done' | 'current' | 'todo' | 'held';

/** Sent → In transit → Credited, or → Held → Recovered. Event logs and receiver state decide. */
export function ccipSteps(s: CcipStake) {
  const st = s.status;
  const sent: StepState = 'done';
  const transit: StepState = st === 'sent' || st === 'in_transit' ? 'current' : 'done';
  const landed: StepState = st === 'credited' ? 'done' : st === 'held' || st === 'recovered' ? 'held' : 'todo';
  return [
    { key: 'sent', label: 'Sent on Arbitrum Sepolia', state: sent },
    { key: 'transit', label: 'In transit (Chainlink CCIP)', state: transit },
    { key: 'credited', label: st === 'held' || st === 'recovered' ? 'Held on Ethereum Sepolia' : 'Credited as a vote', state: landed },
  ] as const;
}

export function CcipTracker({ stake: s }: { stake: CcipStake }) {
  const now = useChainTime();
  const slow = now !== undefined && isSlow({ sent: { tx: s.sourceTx ?? '0x', at: s.sentAt } }, now) && s.status === 'in_transit';
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {ccipSteps(s).map((step) => (
          <li key={step.key} className="flex items-start gap-3">
            {step.state === 'done' ? (
              <CheckCircle2 className="text-clue-ink mt-0.5 shrink-0" size={20} aria-hidden />
            ) : step.state === 'current' ? (
              <Loader2 className="text-beam-ink mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" size={20} aria-hidden />
            ) : step.state === 'held' ? (
              <PauseCircle className="text-mask-ink mt-0.5 shrink-0" size={20} aria-hidden />
            ) : (
              <Circle className="text-muted mt-0.5 shrink-0" size={20} aria-hidden />
            )}
            <div>
              <p className="font-semibold">
                {step.label}
                <span className="sr-only"> ({step.state === 'held' ? 'held' : step.state})</span>
              </p>
              {step.key === 'sent' && s.sourceTx && s.sourceTx !== '0x' && (
                <a href={explorer.tx(s.sourceTx, ARB)} target="_blank" rel="noreferrer" className="num text-beam-ink inline-flex items-center gap-1 text-sm underline">
                  {shortHex(s.sourceTx, 10, 6)} <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {step.key === 'transit' && (
                <a href={explorer.ccip(s.messageId)} target="_blank" rel="noreferrer" className="text-beam-ink inline-flex items-center gap-1 text-sm underline">
                  View in CCIP Explorer <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {step.key === 'credited' && s.destTx && s.destTx !== '0x' && (
                <a href={explorer.tx(s.destTx, SEPOLIA)} target="_blank" rel="noreferrer" className="num text-beam-ink inline-flex items-center gap-1 text-sm underline">
                  {shortHex(s.destTx, 10, 6)} <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      {slow && (
        <p className="text-beam-ink text-sm" role="status">
          Still in transit after {CCIP_SLOW_MINUTES} minutes. Testnet lanes can be slow; check the CCIP Explorer. If it arrives after lock it will be held, not
          counted.
        </p>
      )}
      {s.status === 'held' && <HeldPanel stake={s} />}
      {s.status === 'recovered' && (
        <Banner tone="info" title="Recovered" icon={Undo2}>
          The held dUSD was returned. It never counted as a vote.
        </Banner>
      )}
      {s.status === 'credited' && (
        <Banner tone="success" title="Credited">
          This stake now counts on Ethereum Sepolia.
        </Banner>
      )}
      <CcipNotVoteLabel />
    </div>
  );
}

function HeldPanel({ stake: s }: { stake: CcipStake }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const plan = usePlan();
  const operatorOnly = !s.recoveryRecipient || s.recoveryRecipient === zeroAddress;
  const mine = !!address && !!s.recoveryRecipient && s.recoveryRecipient.toLowerCase() === address.toLowerCase();
  const left = s.recoverable ?? 0n;
  return (
    <Banner tone="warning" title="Arrived late or invalid — not counted as a vote. Your dUSD is recoverable.">
      <p>
        Held: <span className="num">{formatUsdc(left)}</span> dUSD.
      </p>
      {operatorOnly ? (
        <p className="mt-2">The message couldn&apos;t be decoded, so only the recovery operator can return these funds (CCIPStakeReceiver.recover).</p>
      ) : !mine ? (
        <p className="mt-2">
          Only the recipient <span className="num">{shortHex(s.recoveryRecipient)}</span> can recover, to their own address.
        </p>
      ) : left > 0n && protocol.recoverCcip ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={plan.running}
            onClick={() => void plan.start(() => protocol.recoverCcip!(s.messageId, address!))}
            className="bg-beam text-on-beam rounded-xl px-4 py-2 font-semibold hover:brightness-105 disabled:opacity-60"
          >
            Recover {formatUsdc(left)} dUSD
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
        </div>
      ) : null}
    </Banner>
  );
}

export function CcipStakeList({ stakes }: { stakes: CcipStake[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {stakes.map((s) => (
        <li key={s.messageId} className="flex flex-wrap items-center gap-x-3">
          <span className="num">{formatUsdc(s.amount)} dUSD</span>
          <span>{s.yes ? 'Yes' : 'No'}</span>
          <span className={s.status === 'held' ? 'text-mask-ink' : 'text-beam-ink'}>{s.status.replace('_', ' ')}</span>
          <Link href={`/tx/ccip/${s.messageId}`} className="text-beam-ink underline">
            Track
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CcipTrackerPage({ messageId }: { messageId: string }) {
  const valid = /^0x[0-9a-fA-F]{64}$/.test(messageId);
  const q = useCcip(valid ? (messageId as Hex) : undefined);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl">Cross-chain stake</h1>
      <p className="num text-muted mt-2 break-all">{messageId}</p>
      <div className="glass mt-6 p-6">
        {!valid ? (
          <Banner tone="danger" title="That isn't a CCIP message id">
            A message id is 32 bytes of hex (0x + 64 characters).
          </Banner>
        ) : q.isError ? (
          <Banner tone="danger" title="Couldn't read this message">
            {q.error.message}
          </Banner>
        ) : q.isLoading ? (
          <div className="sweep h-40" aria-busy="true" aria-label="Loading message" />
        ) : !q.data ? (
          <Banner tone="info" title="No record of this message yet">
            If you just sent it, the source event may not be indexed yet. This page checks again every 15 seconds.
          </Banner>
        ) : (
          <>
            <p className="mb-4">
              <span className="num font-semibold">{formatUsdc(q.data.amount)} dUSD</span> on {q.data.yes ? 'Yes' : 'No'} for{' '}
              <Link href={`/case/${q.data.reportId}/stake`} className="text-beam-ink underline">
                case #{q.data.reportId.toString()}
              </Link>
              {q.data.sentAt ? <span className="text-muted"> · sent {formatDate(q.data.sentAt)}</span> : null}
            </p>
            <CcipTracker stake={q.data} />
          </>
        )}
      </div>
    </main>
  );
}
