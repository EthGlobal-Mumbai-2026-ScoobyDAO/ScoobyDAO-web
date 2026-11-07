'use client';

import { ArrowRight, CheckCircle2, UserX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { HashText } from '@/components/HashText';
import { DemoIdentityLabel } from '@/components/HonestyLabels';
import { SniffPose } from '@/components/SniffPose';
import { TxLink } from '@/components/TxLink';
import { ClaimCard } from '@/components/report/ClaimCard';
import { EmptyState, LoadState, PageHeader, Stepper, TechnicalDetails, type StepState } from '@/components/ui';
import { Digest, WorldConfirm, worldButtonClass } from '@/components/ui/WorldConfirm';
import { approvalPhase } from '@/components/admin/reviewMeta';
import { ApiError, type ReportWithRaw } from '@/lib/api';
import { chainName } from '@/lib/explorer';
import { env } from '@/lib/env';
import { matchClaimHash, sameHash, type ClaimHashMatch } from '@/lib/hash';
import { useApproval, useFixturesMode, useReport } from '@/lib/queries';
import type { Approval } from '@/lib/types';

// Publication sign-off, step 3 of the reviewer journey. Display only: every state shown here comes from
// GET /approvals/:id (polled every 2s); the UI never decides approval.

const REGISTRY = 'ScoobyDAO report registry on Ethereum Sepolia';
const caseHref = (reportId: string) => `/cases/${encodeURIComponent(reportId)}`;

export function ApproveScreen({ id }: { id: string }) {
  const approval = useApproval(id);
  const fixtures = useFixturesMode().data;

  // /approve/demo-<status> are fixture-only previews; the live backend has no such ids.
  if (id.startsWith('demo-') && fixtures === false)
    return (
      <Shell>
        <EmptyState pose="shrug" title="Demo previews run in fixture mode only">
          This app talks to the live backend, so there is no demo sign-off to show.{' '}
          <Link href="/admin/publish" className="text-beam-ink underline underline-offset-4">
            Go to Publish
          </Link>
        </EmptyState>
      </Shell>
    );

  if (approval.isError && approval.error instanceof ApiError) {
    const st = approval.error.status;
    if (st === 401 || st === 403)
      return (
        <Shell>
          <EmptyState pose="alert" title="Open the report at the review desk first">
            Only the reviewer who requested this sign-off can follow it, from the same browser tab. Open the report
            with the same World ID, then reopen this page.
          </EmptyState>
          <p className="text-center">
            <Link href="/admin" className={worldButtonClass.primary}>
              Go to the review desk
            </Link>
          </p>
        </Shell>
      );
    if (st === 404)
      return (
        <Shell>
          <EmptyState pose="thinking" title="No sign-off request with this id">
            Check the link, or request a new sign-off from the case file.
          </EmptyState>
        </Shell>
      );
  }

  return (
    <LoadState
      query={approval}
      source="Review API"
      skeleton={
        <Shell>
          <Skeleton />
        </Shell>
      }
    >
      {(a) => <Body approval={a} simulated={fixtures ?? false} />}
    </LoadState>
  );
}

function Body({ approval: a, simulated }: { approval: Approval; simulated: boolean }) {
  const report = useReport(a.reportId);
  const r = report.data;
  return (
    <Shell status={a.status} demoIdentity={a.demoIdentity}>
      <Stepper className="mb-8 max-w-2xl" label="Reviewer journey" steps={journey(a.status)} />
      {a.status === 'pending' ? (
        <CodePanel approval={a} report={r} reportError={report.isError} />
      ) : (
        <div className="mx-auto max-w-[880px] space-y-6">
          <Result approval={a} simulated={simulated} />
          <Card title="What was published" approval={a} report={r} reportError={report.isError} />
        </div>
      )}
    </Shell>
  );
}

export function journey(status: Approval['status']): { label: string; state: StepState }[] {
  const publish: StepState =
    status === 'pending' ? 'current' : status === 'approved' || status === 'spent' ? 'done' : 'failed';
  const onchain: StepState = status === 'spent' ? 'done' : status === 'approved' ? 'current' : 'todo';
  return [
    { label: 'Review', state: 'done' },
    { label: 'Publish (World ID)', state: publish },
    { label: 'Onchain', state: onchain },
  ];
}

function Shell({
  children,
  status,
  demoIdentity,
}: {
  children: ReactNode;
  status?: Approval['status'];
  demoIdentity?: boolean;
}) {
  return (
    <main className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Step 3 · Publication sign-off"
        title="Publish onchain"
        description="No agent publishes alone. A reviewer checks this exact claim and confirms in World App."
        status={status && <ApprovalChip status={status} />}
      />
      {demoIdentity && (
        <p className="-mt-4 mb-6">
          <DemoIdentityLabel />
        </p>
      )}
      {children}
    </main>
  );
}

const CHIP: Record<Approval['status'], { label: string; cls: string }> = {
  pending: {
    label: 'Waiting for the reviewer',
    cls: 'text-ghost-ink border-[color-mix(in_srgb,var(--ghost-300)_50%,transparent)]',
  },
  error: {
    label: 'Verification unavailable',
    cls: 'text-mask-ink border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)]',
  },
  approved: {
    label: 'Approved · publishing',
    cls: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]',
  },
  spent: {
    label: 'Published onchain',
    cls: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]',
  },
  denied: {
    label: 'Denied',
    cls: 'text-mask-ink border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)]',
  },
  expired: {
    label: 'Expired',
    cls: 'text-beam-ink border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)]',
  },
  rejected_not_reviewer: {
    label: 'Not an enrolled reviewer',
    cls: 'text-mask-ink border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)]',
  },
};

function ApprovalChip({ status }: { status: Approval['status'] }) {
  const c = CHIP[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${c.cls}`}>
      {status === 'pending' ? (
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="bg-ghost absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
          <span className="bg-ghost relative inline-flex h-2.5 w-2.5 rounded-full" />
        </span>
      ) : status === 'approved' || status === 'spent' ? (
        <CheckCircle2 size={16} aria-hidden />
      ) : status === 'rejected_not_reviewer' ? (
        <UserX size={16} aria-hidden />
      ) : (
        <XCircle size={16} aria-hidden />
      )}
      {c.label}
    </span>
  );
}

/** Recomputes the claim hash from the case file's manifest in this browser and compares it with the approval. */
function useHashCheck(approval: Approval, report?: ReportWithRaw) {
  // The backend's declared algorithm, else keccak256 (its default) then SHA-256.
  const [recomputed, setRecomputed] = useState<ClaimHashMatch | null>(null);
  useEffect(() => {
    if (report)
      void matchClaimHash(report.claimManifest, report.claimHash, report.claimHashAlg ?? approval.claimHashAlg)
        .then(setRecomputed)
        .catch(() => setRecomputed(null));
  }, [report, approval.claimHashAlg]);
  const ok = report ? sameHash(approval.claimHash, report.claimHash) && (!recomputed || recomputed.match) : undefined;
  return { ok, alg: recomputed?.alg };
}

/** "What you're publishing": claim, token, version, hashes (short, with copy), registry; full values in a drawer. */
export function PublishingDetails({
  approval,
  report,
  reportError,
}: {
  approval: Approval;
  report?: ReportWithRaw;
  reportError?: boolean;
}) {
  const check = useHashCheck(approval, report);
  const reportSha = approval.reportSha256 ?? report?.reportSha256;
  return (
    <div className="space-y-4">
      {report ? (
        <ClaimCard manifest={report.claimManifest} />
      ) : reportError ? (
        <p role="alert" className="text-mask-ink text-sm">
          Couldn’t load the case file, so the claim can’t be shown or checked here. Don’t approve until it loads.
        </p>
      ) : (
        <span className="sweep block h-32 rounded-xl" aria-label="Loading the claim" />
      )}
      <dl className="grid gap-3 text-[15px] sm:grid-cols-[auto_1fr] sm:gap-x-6">
        <dt className="text-muted">Claim hash</dt>
        <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Digest value={approval.claimHash} label="claim hash" />
          {check.ok !== undefined && (
            <span className={`inline-flex items-center gap-1.5 text-sm ${check.ok ? 'text-clue-ink' : 'text-mask-ink font-semibold'}`}>
              {check.ok ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
              {check.ok
                ? `Matches the case file (recomputed in this browser${check.alg ? `, ${check.alg}` : ''})`
                : "Doesn't match the case file. Don't approve."}
            </span>
          )}
        </dd>
        {reportSha && (
          <>
            <dt className="text-muted">Report SHA-256</dt>
            <dd>
              <Digest value={reportSha} label="report SHA-256" />
            </dd>
          </>
        )}
        <dt className="text-muted">Goes to</dt>
        <dd>{REGISTRY}</dd>
      </dl>
      <TechnicalDetails>
        <dl className="space-y-3">
          <div>
            <dt className="text-muted">Claim hash (onchain claimHash)</dt>
            <dd>
              <HashText value={approval.claimHash} label="claim hash" />
            </dd>
          </div>
          {reportSha && (
            <div>
              <dt className="text-muted">Report SHA-256 (onchain reportHash)</dt>
              <dd>
                <HashText value={reportSha} label="report SHA-256" />
              </dd>
            </div>
          )}
          {report && (
            <div>
              <dt className="text-muted">Token address · schema</dt>
              <dd className="num break-all">
                {report.report.identity.address} · v{report.report.schema_version}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Report id · sign-off id</dt>
            <dd className="num break-all">
              {approval.reportId} · {approval.id}
            </dd>
          </div>
        </dl>
      </TechnicalDetails>
      {report && (
        <p className="text-sm">
          <Link href={caseHref(report.id)} className="text-beam-ink underline underline-offset-4">
            Open the full case file
          </Link>
        </p>
      )}
    </div>
  );
}

function subjectOf(report?: ReportWithRaw) {
  return report
    ? `${report.report.identity.symbol} on ${chainName(report.report.identity.chain_id)}`
    : undefined;
}

function Card({
  title,
  approval,
  report,
  reportError,
}: {
  title: string;
  approval: Approval;
  report?: ReportWithRaw;
  reportError?: boolean;
}) {
  return (
    <section aria-label={title} className="glass p-5 sm:p-6">
      <h2 className="text-muted text-sm font-medium">{title}</h2>
      <p className="mt-1 text-lg font-semibold">
        {subjectOf(report) ?? approval.reportId}
        {report && <span className="text-muted num ml-2 text-sm font-normal">{report.version}</span>}
      </p>
      <div className="mt-4">
        <PublishingDetails approval={approval} report={report} reportError={reportError} />
      </div>
    </section>
  );
}

/** Pending: the World code step, with "What you're publishing" first. */
export function CodePanel({
  approval,
  report,
  reportError,
}: {
  approval: Approval;
  report?: ReportWithRaw;
  reportError?: boolean;
}) {
  return (
    <WorldConfirm
      hideStepper
      action="publish"
      phase="waiting"
      subject={subjectOf(report)}
      version={report?.version}
      consequence="Publishing records this exact claim and report hash onchain. Nothing is published unless you confirm."
      details={<PublishingDetails approval={approval} report={report} reportError={reportError} />}
      userCode={approval.userCode}
      qrValue={approval.verificationUriComplete ?? approval.verificationUri}
      openUrl={approval.verificationUri ?? approval.verificationUriComplete}
      expiresAt={approval.expiresAt}
      noCancelNote="There’s no cancel for a sign-off: the code expires on its own. This page checks every 2 seconds."
    />
  );
}

const again = (a: Approval, label: string) => (
  <Link href={caseHref(a.reportId)} className={worldButtonClass.primary}>
    {label} <ArrowRight size={16} aria-hidden />
  </Link>
);

export function Result({ approval, simulated }: { approval: Approval; simulated?: boolean }) {
  const tx = approval.publishTxHash && (
    <p className="text-[15px]">
      Publish tx: <TxLink value={approval.publishTxHash} chainId={11155111} simulated={simulated} />
    </p>
  );
  switch (approval.status) {
    case 'approved':
      return (
        <section
          aria-labelledby="publishing-h"
          className="bg-surface flex flex-col items-center rounded-2xl border-2 border-[color-mix(in_srgb,var(--clue-500)_60%,transparent)] px-5 py-10 text-center"
        >
          <SniffPose pose="sniffing" size={120} />
          <h2 id="publishing-h" className="font-display mt-4 text-2xl sm:text-3xl">
            Approved — publishing…
          </h2>
          <p className="mt-2 max-w-[60ch]">The reviewer approved this exact claim. The backend is publishing it onchain.</p>
          <div className="mt-3 space-y-1">
            {tx ?? <p className="text-muted text-sm">Transaction pending; the link appears once the backend sends it.</p>}
          </div>
          <p role="status" className="text-muted mt-3 text-sm">
            This page keeps checking every 2 seconds.
          </p>
        </section>
      );
    case 'spent':
      return (
        <section
          aria-labelledby="published-h"
          className="bg-surface flex flex-col items-center rounded-2xl border-2 border-[color-mix(in_srgb,var(--clue-500)_60%,transparent)] px-5 py-10 text-center"
        >
          <SniffPose pose="triumphant" size={132} />
          <h2 id="published-h" className="font-display mt-4 text-2xl sm:text-3xl">
            Published onchain
          </h2>
          <div className="mt-3">{tx}</div>
          {approval.onchainReportId && env.protocol === 'v2' && env.chainMode === 'live' ? (
            // V2: the case file links onchain only after the registry's claim hash matches, and a new
            // publication has no market until a per-report vault is deployed.
            <>
              <Link href={caseHref(approval.reportId)} className={`${worldButtonClass.primary} mt-6`}>
                Open the case file to verify report #{approval.onchainReportId}
              </Link>
              <p className="text-muted mt-2 max-w-[60ch] text-sm">
                The market opens from the case file once the onchain record checks out and a vault exists.
              </p>
            </>
          ) : approval.onchainReportId ? (
            <Link href={`/case/${approval.onchainReportId}`} className={`${worldButtonClass.primary} mt-6`}>
              Open market for case #{approval.onchainReportId}
            </Link>
          ) : (
            <p className="text-muted mt-4 text-sm">The case link appears once the backend reports the onchain id.</p>
          )}
        </section>
      );
    case 'denied':
      return (
        <WorldConfirm
          hideStepper
          action="publish"
          phase={approvalPhase('denied')}
          resultTitle="Denied — no case opened."
          resultBody={<p>Draft only, no market opened. Nothing was published onchain.</p>}
          resultAction={again(approval, 'Back to the case file')}
        />
      );
    case 'expired':
      return (
        <WorldConfirm
          hideStepper
          action="publish"
          phase={approvalPhase('expired')}
          resultTitle="Expired — no case opened."
          resultBody="Nobody approved before the code ran out. Nothing was published onchain."
          resultAction={again(approval, 'Get a new code from the case file')}
        />
      );
    case 'rejected_not_reviewer':
      return (
        <WorldConfirm
          hideStepper
          action="publish"
          phase={approvalPhase('rejected_not_reviewer')}
          resultTitle="This World ID isn't an enrolled reviewer — nothing published."
          resultBody="Only enrolled reviewers can approve a claim."
          resultAction={again(approval, 'Back to the case file')}
        />
      );
    case 'error':
      return (
        <WorldConfirm
          hideStepper
          action="publish"
          phase={approvalPhase('error')}
          resultTitle="World verification unavailable — nothing published."
          detail={approval.detail}
          resultAction={again(approval, 'Try again from the case file')}
        />
      );
    default:
      return null;
  }
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[880px] space-y-6" aria-label="Loading sign-off request">
      <div className="sweep h-6 w-1/2 rounded" />
      <div className="glass space-y-4 p-6">
        <div className="sweep h-8 w-1/3" />
        <div className="sweep h-28 w-full" />
      </div>
      <div className="glass space-y-4 p-6">
        <div className="sweep h-14 w-2/3" />
        <div className="sweep h-44 w-44" />
      </div>
    </div>
  );
}
