'use client';

import { CheckCircle2, Circle, ExternalLink, Loader2, PauseCircle, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { Hex } from 'viem';
import { zeroAddress } from 'viem';
import { Banner } from '@/components/Banner';
import { Card, EmptyState, HonestyChips, KeyValue, LoadState, Page, PageHeader, TechnicalDetails } from '@/components/ui';
import { NetworkBadge } from '@/components/NetworkBadge';
import { TxPlanStepper, usePlan } from '@/components/TxPlanStepper';
import { explorer } from '@/lib/explorer';
import { formatDate, formatUsdc, shortHex } from '@/lib/format';
import { CCIP_SLOW_MINUTES, isSameAddress, isSlowStake, isV2Example, V2_INFO, type CcipStake, type CcipStatus, type TrackedCcip } from '@/protocol';
import { useActiveAccount, useCcip, useChainTime, useProtocol, useTrackedCcip, useWritesAllowed } from '@/protocol/hooks';

const ARB = 421614;
const SEPOLIA = 11155111;

export const CCIP_STATUS_LABEL: Record<CcipStatus, string> = {
  sent: 'Sent',
  in_transit: 'In transit',
  failed: 'Delivery failed',
  delivered: 'Delivered, not yet confirmed as a vote',
  credited: 'Credited as a vote',
  deferred_as_rep: 'Arrived late: became REP receipts',
  held: 'Held — not counted',
  recovered: 'Recovered',
};

type StepState = 'done' | 'current' | 'todo' | 'stopped';

/**
 * V2 counts a vote only after Credited plus a fresh position/YT read (`refreshed`). V1 and the fixture
 * chain have no receiver `delivered` flag; their Credited state is the vote itself.
 */
export const isVoted = (s: CcipStake) => s.status === 'credited' && (s.refreshed !== undefined || s.delivered === undefined);

/** Sent → in transit (CCIP) → outcome on Ethereum Sepolia. Chain state and the CCIP API decide. */
export function ccipSteps(s: CcipStake) {
  const st = s.status;
  const landed = st === 'credited' || st === 'deferred_as_rep' || st === 'held' || st === 'recovered' || st === 'delivered';
  const transit: StepState = landed ? 'done' : st === 'failed' ? 'stopped' : 'current';
  const outcome: StepState = st === 'credited' ? (isVoted(s) ? 'done' : 'current') : st === 'delivered' ? 'current' : landed ? 'stopped' : 'todo';
  const outcomeLabel =
    st === 'credited'
      ? isVoted(s)
        ? 'Voted: credited on Ethereum Sepolia'
        : 'Credited on Ethereum Sepolia (refreshing the position)'
      : st === 'deferred_as_rep'
        ? 'Not a vote: converted to REP receipts'
        : st === 'held' || st === 'recovered'
          ? 'Not a vote: held on Ethereum Sepolia'
          : st === 'delivered'
            ? 'Delivered: checking whether it was credited'
            : st === 'failed'
              ? 'Not executed on Ethereum Sepolia'
              : 'Outcome on Ethereum Sepolia';
  return [
    { key: 'sent', label: 'Sent on Arbitrum Sepolia', state: 'done' as StepState },
    { key: 'transit', label: st === 'failed' ? 'CCIP execution failed' : `In transit (Chainlink CCIP)${s.ccipApiStatus ? ` · ${s.ccipApiStatus}` : ''}`, state: transit },
    { key: 'outcome', label: outcomeLabel, state: outcome },
  ];
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <CheckCircle2 className="text-clue-ink mt-0.5 shrink-0" size={20} aria-hidden />;
  if (state === 'current') return <Loader2 className="text-beam-ink mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" size={20} aria-hidden />;
  if (state === 'stopped') return <PauseCircle className="text-mask-ink mt-0.5 shrink-0" size={20} aria-hidden />;
  return <Circle className="text-muted mt-0.5 shrink-0" size={20} aria-hidden />;
}

const ExtLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="num text-beam-ink inline-flex items-center gap-1 text-sm underline">
    {children} <ExternalLink size={12} aria-hidden />
  </a>
);

export function CcipTracker({ stake: s }: { stake: CcipStake }) {
  const now = useChainTime();
  const slow = now !== undefined && isSlowStake(s, now);
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {ccipSteps(s).map((step) => (
          <li key={step.key} className="flex items-start gap-3">
            <StepIcon state={step.state} />
            <div>
              <p className="font-semibold">
                {step.label}
                <span className="sr-only"> ({step.state})</span>
              </p>
              {step.key === 'sent' && s.sourceTx && s.sourceTx !== '0x' && <ExtLink href={explorer.tx(s.sourceTx, ARB)}>{shortHex(s.sourceTx, 10, 6)}</ExtLink>}
              {step.key === 'transit' && <ExtLink href={explorer.ccip(s.messageId)}>View in the CCIP Explorer</ExtLink>}
              {step.key === 'outcome' && s.destTx && <ExtLink href={explorer.tx(s.destTx, SEPOLIA)}>{shortHex(s.destTx, 10, 6)}</ExtLink>}
            </div>
          </li>
        ))}
      </ol>
      {s.ccipApiUnavailable && (s.status === 'sent' || s.status === 'in_transit') && (
        <p className="text-muted text-sm">The CCIP status API couldn&apos;t be reached from this browser, so progress shows onchain state only. Use the CCIP Explorer link.</p>
      )}
      {slow && (
        <p className="text-beam-ink text-sm" role="status">
          Still in transit after {CCIP_SLOW_MINUTES} minutes. Testnet lanes can be slow. A message that arrives after the stake window becomes REP receipts for
          the sender, not a vote.
        </p>
      )}
      <Outcome stake={s} />
    </div>
  );
}

function Outcome({ stake: s }: { stake: CcipStake }) {
  switch (s.status) {
    case 'credited':
      return s.refreshed ? (
        <Banner tone="success" title="Voted">
          The receiver credited <span className="num">{formatUsdc(s.amount)}</span> dUSD on {s.yes ? 'Yes' : 'No'} to <span className="num">{shortHex(s.recipient)}</span>. Their
          {s.yes ? ' Yes' : ' No'} position is now <span className="num">{formatUsdc(s.refreshed.position)}</span> dUSD and they hold{' '}
          <span className="num">{formatUsdc(s.refreshed.yt)}</span> YT (read at block {s.refreshed.blockNumber.toString()}).
        </Banner>
      ) : isVoted(s) ? (
        <Banner tone="success" title="Credited">
          This stake now counts on Ethereum Sepolia.
        </Banner>
      ) : (
        <Banner tone="info" title="Credited — refreshing the recipient's position">
          A Credited event was found. This page shows &ldquo;Voted&rdquo; once the position and YT balance have been re-read.
        </Banner>
      );
    case 'deferred_as_rep':
      return <DeferredPanel stake={s} />;
    case 'held':
      return <HeldPanel stake={s} />;
    case 'recovered':
      return (
        <Banner tone="info" title="Recovered" icon={Undo2}>
          The held dUSD was returned. It never counted as a vote.
        </Banner>
      );
    case 'failed':
      return (
        <Banner tone="danger" title="Delivery failed — an operator can manually retry it in the CCIP explorer." icon={XCircle}>
          Chainlink CCIP reports a failed execution on Ethereum Sepolia{s.readyForManualExecution ? ' and marks it ready for manual execution' : ''}. Nothing was credited.
          This page keeps checking.
        </Banner>
      );
    case 'delivered':
      return (
        <Banner tone="info" title="Delivered — delivery alone is not a vote">
          {s.outcomeUnknown
            ? 'The receiver marked this message delivered, but its Credited/DeferredAsREP/Held event wasn’t found in the recent log window. Check the destination transaction in the CCIP Explorer.'
            : 'The receiver marked this message delivered. Checking whether it was credited as a vote.'}
        </Banner>
      );
    default:
      return null;
  }
}

function DeferredPanel({ stake: s }: { stake: CcipStake }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const writes = useWritesAllowed();
  const plan = usePlan();
  const mine = isSameAddress(address, s.sourceAccount);
  const rep = s.repBalance ?? 0n;
  return (
    <Banner tone="warning" title="Arrived after the stake window: converted to REP receipts for the source payer on Sepolia (withdrawable)">
      <p>
        Not a vote. <span className="num">{formatUsdc(s.amount)}</span> dUSD became REP for <span className="num">{shortHex(s.sourceAccount)}</span>, who holds{' '}
        <span className="num">{formatUsdc(rep)}</span> REP now. REP withdraws 1:1 to dUSD at any time (vault.withdraw).
      </p>
      {mine && rep > 0n && protocol.withdrawRep ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={plan.running || !writes.allowed}
            onClick={() => void plan.start(() => protocol.withdrawRep!(rep, address!))}
            className="bg-beam text-on-beam rounded-xl px-4 py-2 font-semibold hover:brightness-105 disabled:opacity-60"
          >
            Withdraw {formatUsdc(rep)} dUSD
          </button>
          <TxPlanStepper steps={plan.steps} buildError={plan.buildError} />
        </div>
      ) : (
        !mine && <p className="mt-2">Connect the source payer&apos;s wallet to withdraw it, or stake the REP from the REP panel before the lock.</p>
      )}
    </Banner>
  );
}

function HeldPanel({ stake: s }: { stake: CcipStake }) {
  const { protocol } = useProtocol();
  const { address } = useActiveAccount();
  const writes = useWritesAllowed();
  const plan = usePlan();
  const operatorOnly = !s.recoveryRecipient || s.recoveryRecipient === zeroAddress;
  const mine = !operatorOnly && isSameAddress(address, s.recoveryRecipient);
  const left = s.recoverable ?? 0n;
  return (
    <Banner tone="warning" title="Held — not counted as a vote">
      <p>
        Recoverable: <span className="num">{formatUsdc(left)}</span> dUSD.
      </p>
      {operatorOnly ? (
        <p className="mt-2">
          The message couldn&apos;t be decoded, so only the recovery operator
          {s.recoveryOperator ? (
            <>
              {' '}
              (<span className="num">{shortHex(s.recoveryOperator)}</span>)
            </>
          ) : null}{' '}
          can return these funds.
        </p>
      ) : !mine ? (
        <p className="mt-2">
          Only the source payer <span className="num">{shortHex(s.recoveryRecipient)}</span> can recover, to their own address.
        </p>
      ) : left > 0n && protocol.recoverCcip ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={plan.running || !writes.allowed}
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

/** Compact rows for positions pages: one live status per message. */
export function CcipStakeList({ stakes }: { stakes: CcipStake[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {stakes.map((s) => (
        <StakeRow key={s.messageId} s={s} />
      ))}
    </ul>
  );
}

function StakeRow({ s }: { s: Pick<CcipStake, 'messageId' | 'amount' | 'yes' | 'status'> }) {
  const bad = s.status === 'held' || s.status === 'failed' || s.status === 'deferred_as_rep';
  return (
    <li className="flex flex-wrap items-center gap-x-3">
      <span className="num">{formatUsdc(s.amount)} dUSD</span>
      <span>{s.yes ? 'Yes' : 'No'}</span>
      <span className={bad ? 'text-mask-ink' : s.status === 'credited' ? 'text-clue-ink' : 'text-beam-ink'}>{CCIP_STATUS_LABEL[s.status]}</span>
      <Link href={`/tx/ccip/${s.messageId}`} className="text-beam-ink underline">
        Track
      </Link>
    </li>
  );
}

function TrackedRow({ t }: { t: TrackedCcip }) {
  const q = useCcip(t.messageId);
  const s = q.data;
  return (
    <li className="flex flex-wrap items-center gap-x-3">
      <span className="num">{formatUsdc(BigInt(t.amount))} dUSD</span>
      <span>{t.side === 'yes' ? 'Yes' : 'No'}</span>
      <span className={s && (s.status === 'held' || s.status === 'failed' || s.status === 'deferred_as_rep') ? 'text-mask-ink' : s?.status === 'credited' ? 'text-clue-ink' : 'text-beam-ink'}>
        {q.isError ? 'status unavailable' : s ? CCIP_STATUS_LABEL[s.status] : 'checking…'}
      </span>
      <span className="text-muted">sent {formatDate(t.savedAt)}</span>
      <Link href={`/tx/ccip/${t.messageId}`} className="text-beam-ink underline">
        Track
      </Link>
    </li>
  );
}

/** Cross-chain stakes this browser sent (and any the protocol reports), each with its live status. */
export function TrackedCcipList({ reportId, extra = [], items }: { reportId?: bigint; extra?: CcipStake[]; items?: TrackedCcip[] }) {
  const all = useTrackedCcip(reportId);
  const tracked = items ?? all;
  const ids = new Set(tracked.map((t) => t.messageId.toLowerCase()));
  const others = extra.filter((s) => !ids.has(s.messageId.toLowerCase()));
  if (tracked.length === 0 && others.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {tracked.map((t) => (
        <TrackedRow key={t.messageId} t={t} />
      ))}
      {others.map((s) => (
        <StakeRow key={s.messageId} s={s} />
      ))}
    </ul>
  );
}

export function CcipTrackerPage({ messageId }: { messageId: string }) {
  const valid = /^0x[0-9a-fA-F]{64}$/.test(messageId);
  const q = useCcip(valid ? (messageId as Hex) : undefined);
  const { protocol } = useProtocol();
  const example = valid && isV2Example(messageId);
  const reportHref = (id: bigint) => (protocol.kind === 'v2' ? `/onchain/${id}` : `/case/${id}/stake`);
  return (
    <Page className="max-w-[860px]">
      <PageHeader
        eyebrow={<NetworkBadge chainId={ARB} label="Arbitrum Sepolia → Ethereum Sepolia" />}
        title="Cross-chain stake"
        description="Live status of one Chainlink CCIP message, read from both chains and the CCIP API."
      />
      <HonestyChips facts={['ccipNotVote', 'testToken']} className="-mt-4 mb-6" />
      {!valid ? (
        <Card>
          <EmptyState pose="confused" title="That isn’t a CCIP message id">
            A message id is 32 bytes of hex (0x + 64 characters).
          </EmptyState>
        </Card>
      ) : (
        <LoadState query={q} source="CCIP API and Ethereum Sepolia RPC" skeleton={<div className="sweep h-56 rounded-[14px]" aria-label="Loading message" />}>
          {(data) =>
            !data ? (
              <Card>
                <EmptyState pose="sniffing" title="No record of this message yet">
                  Neither this browser, the CCIP API nor the receiver knows it yet. If you just sent it, this page checks again every 15 seconds.
                </EmptyState>
              </Card>
            ) : (
              <Card>
                <dl className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted text-[13px]">Stake</dt>
                    <dd className="mt-0.5">
                      <span className="num text-xl font-semibold">{formatUsdc(data.amount)} dUSD</span> on{' '}
                      <span className={data.yes ? 'text-beam-ink font-semibold' : 'text-clue-ink font-semibold'}>{data.yes ? 'Yes' : 'No'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-[13px]">Market</dt>
                    <dd className="mt-0.5">
                      {data.reportId > 0n ? (
                        <Link href={reportHref(data.reportId)} className="text-beam-ink underline">
                          Market #{data.reportId.toString()}
                        </Link>
                      ) : (
                        'Unknown market'
                      )}
                      {data.sentAt ? <span className="text-muted text-[13px]"> · sent {formatDate(data.sentAt)}</span> : null}
                    </dd>
                  </div>
                </dl>
                <CcipTracker stake={data} />
              </Card>
            )
          }
        </LoadState>
      )}
      {valid && (
        <TechnicalDetails className="mt-6">
          <KeyValue
            items={[
              { label: 'CCIP message id', value: <span className="num text-xs break-all">{messageId}</span> },
              ...(q.data?.sourceAccount ? [{ label: 'Source payer (Arbitrum Sepolia)', value: <span className="num">{shortHex(q.data.sourceAccount)}</span> }] : []),
              ...(q.data && q.data.recipient !== zeroAddress ? [{ label: 'Recipient (Ethereum Sepolia)', value: <span className="num">{shortHex(q.data.recipient)}</span> }] : []),
              ...(q.data?.ccipApiStatus ? [{ label: 'CCIP API status', value: q.data.ccipApiStatus }] : []),
            ]}
          />
          {example && (
            <p className="text-muted mt-2 text-[13px]">
              The handoff bundle&apos;s delivered example: its first destination attempt failed on low callback gas and was retried manually with 1,500,000 gas. New
              sends use 1,500,000 from the start.
            </p>
          )}
        </TechnicalDetails>
      )}
      {!example && protocol.kind === 'v2' && (
        <p className="mt-4 text-sm">
          <Link href={`/tx/ccip/${V2_INFO.exampleCCIP.messageId}`} className="text-beam-ink underline">
            See a delivered example
          </Link>
        </p>
      )}
    </Page>
  );
}
