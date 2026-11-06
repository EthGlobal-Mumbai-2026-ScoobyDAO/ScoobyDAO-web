'use client';

import { CheckCircle2, ExternalLink, UserX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Banner } from '@/components/Banner';
import { Countdown } from '@/components/Countdown';
import { HashText } from '@/components/HashText';
import { TxLink } from '@/components/TxLink';
import { useEffect, useState } from 'react';
import { DemoIdentityLabel } from '@/components/HonestyLabels';
import { ClaimCard } from '@/components/report/ClaimCard';
import { ApiError, type ReportWithRaw } from '@/lib/api';
import { chainName } from '@/lib/explorer';
import { env } from '@/lib/env';
import { matchClaimHash, sameHash, type ClaimHashMatch } from '@/lib/hash';
import { useApproval, useFixturesMode, useReport } from '@/lib/queries';
import type { Approval } from '@/lib/types';

// Projector screen for the World Agent Pass sign-off. Display only: every state shown
// here comes from GET /approvals/:id (polled every 2s); the UI never decides approval.

export function ApproveScreen({ id }: { id: string }) {
  const approval = useApproval(id);
  const a = approval.data;
  const final = a && a.status !== 'pending';
  const report = useReport(a?.reportId);
  const fixtures = useFixturesMode().data ?? false;
  const r = report.data;

  if (approval.isError) {
    const notFound = approval.error instanceof ApiError && approval.error.status === 404;
    const signedOut = approval.error instanceof ApiError && (approval.error.status === 401 || approval.error.status === 403);
    if (signedOut)
      return (
        <Shell>
          <Banner tone="warning" title="Sign in at the review desk to follow this sign-off">
            Only the reviewer who requested it can see this sign-off.{' '}
            <Link href="/admin" className="underline underline-offset-4">
              Sign in with World ID
            </Link>{' '}
            with the same World ID, then reopen this page.
          </Banner>
        </Shell>
      );
    return (
      <Shell>
        <Banner
          tone="danger"
          title={
            notFound ? 'No sign-off request with this id' : "Couldn't load this sign-off request"
          }
        >
          {notFound
            ? 'Check the link, or request a new sign-off from the case file.'
            : approval.error.message}
        </Banner>
      </Shell>
    );
  }

  if (!a)
    return (
      <Shell>
        <Skeleton />
      </Shell>
    );

  return (
    <Shell status={a.status} demoIdentity={a.demoIdentity}>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        <ClaimToCheck approval={a} report={r} />
        <div
          className={`lg:sticky lg:top-24 lg:self-start ${final ? 'order-first lg:order-none' : ''}`}
        >
          {final ? (
            <Result approval={a} simulated={fixtures} />
          ) : (
            <CodePanel approval={a} />
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, status, demoIdentity }: { children: React.ReactNode; status?: Approval['status']; demoIdentity?: boolean }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-lg sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Human sign-off</h1>
          <p className="text-muted mt-2 max-w-2xl text-xl">
            No agent can open a case alone. An enrolled reviewer checks this exact report and claim and
            approves or denies it in World App.
          </p>
        </div>
        {status && <ApprovalChip status={status} />}
      </header>
      {demoIdentity && (
        <p className="mb-6">
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
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-semibold ${c.cls}`}
    >
      {status === 'pending' ? (
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="bg-ghost absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
          <span className="bg-ghost relative inline-flex h-2.5 w-2.5 rounded-full" />
        </span>
      ) : status === 'approved' || status === 'spent' ? (
        <CheckCircle2 size={18} aria-hidden />
      ) : status === 'rejected_not_reviewer' ? (
        <UserX size={18} aria-hidden />
      ) : (
        <XCircle size={18} aria-hidden />
      )}
      {c.label}
    </span>
  );
}

function ClaimToCheck({ approval, report }: { approval: Approval; report?: ReportWithRaw }) {
  // The backend's declared algorithm, else keccak256 (its default) then SHA-256.
  const [recomputed, setRecomputed] = useState<ClaimHashMatch | null>(null);
  useEffect(() => {
    if (report)
      void matchClaimHash(report.claimManifest, report.claimHash, report.claimHashAlg ?? approval.claimHashAlg)
        .then(setRecomputed)
        .catch(() => setRecomputed(null));
  }, [report, approval.claimHashAlg]);
  const hashOk = report ? sameHash(approval.claimHash, report.claimHash) && (!recomputed || recomputed.match) : undefined;
  const reportSha = approval.reportSha256 ?? report?.reportSha256;

  return (
    <section aria-labelledby="claim-h" className="glass p-6 sm:p-8">
      <h2 id="claim-h" className="text-muted text-xl font-semibold">
        {approval.status === 'pending' ? 'Check this claim before approving' : 'The claim the reviewer saw'}
      </h2>

      <dl className="mt-6 space-y-6">
        <div>
          <dt className="text-muted text-base">Report</dt>
          <dd className="mt-1 text-xl">
            {report ? (
              <>
                <span className="font-semibold">{report.report.identity.symbol}</span>{' '}
                <span className="text-muted">on {chainName(report.report.identity.chain_id)}</span>
                <span className="num mt-1 block text-base break-all">{report.report.identity.address}</span>
              </>
            ) : (
              <span className="sweep inline-block h-7 w-96 max-w-full" />
            )}
          </dd>
          {report && (
            <dd className="text-muted mt-1 text-base">
              Version <span className="num text-text">{report.version}</span> · schema v{report.report.schema_version}
            </dd>
          )}
        </div>

        <div>
          <dt className="sr-only">Claim</dt>
          <dd>{report ? <ClaimCard manifest={report.claimManifest} size="xl" /> : <span className="sweep block h-40" />}</dd>
        </div>

        <div>
          <dt className="text-muted text-base">Claim hash (goes onchain as claimHash)</dt>
          <dd className="mt-1">
            <HashText value={approval.claimHash} size="xl" label="claim hash" />
          </dd>
          {hashOk !== undefined && (
            <dd className={`mt-2 inline-flex items-center gap-2 text-base ${hashOk ? 'text-clue-ink' : 'text-mask-ink'}`}>
              {hashOk ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}
              {hashOk ? `Matches the case file (recomputed in this browser${recomputed ? `, ${recomputed.alg}` : ''})` : "Doesn't match the case file. Don't approve."}
            </dd>
          )}
        </div>

        {reportSha && (
          <div>
            <dt className="text-muted text-base">Report SHA-256 (goes onchain as reportHash)</dt>
            <dd className="mt-1">
              <HashText value={reportSha} size="xl" label="report SHA-256" />
            </dd>
          </div>
        )}
      </dl>

      {report && (
        <p className="mt-6 text-base">
          <Link href={`/cases/${encodeURIComponent(report.id)}`} className="text-beam-ink underline underline-offset-4">
            Open the full case file
          </Link>
        </p>
      )}
    </section>
  );
}

export function CodePanel({ approval }: { approval: Approval }) {
  return (
    <section
      aria-labelledby="code-h"
      className="bg-surface rounded-2xl border-2 border-[color-mix(in_srgb,var(--ghost-300)_45%,transparent)] p-6 sm:p-8"
    >
      <h2 id="code-h" className="text-muted text-xl font-semibold">
        Reviewer: approve in World App
      </h2>

      <p className="text-muted mt-6 text-base">Your code</p>
      <p
        className="num mt-1 text-5xl font-bold tracking-[0.12em] sm:text-6xl"
        aria-label={`Code ${approval.userCode?.split('').join(' ')}`}
      >
        {approval.userCode ?? '—'}
      </p>
      <p className="mt-3 text-base">
        World App shows only the requester and this code. Check the claim above before approving.
      </p>

      {(approval.verificationUriComplete ?? approval.verificationUri) && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="w-fit rounded-xl bg-white p-3">
            <QRCodeSVG
              value={approval.verificationUriComplete ?? approval.verificationUri!}
              size={176}
              marginSize={0}
              level="M"
              title="Scan to open World App"
            />
          </div>
          <a
            href={approval.verificationUri ?? approval.verificationUriComplete}
            target="_blank"
            rel="noreferrer"
            className="bg-beam text-on-beam inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-semibold hover:brightness-105"
          >
            Open World App <ExternalLink size={18} aria-hidden />
          </a>
        </div>
      )}

      <p className="border-line text-muted mt-6 flex items-baseline gap-3 border-t pt-5 text-base">
        Code expires in{' '}
        <Countdown
          to={approval.expiresAt}
          endedLabel="now"
          className="text-text text-3xl font-semibold"
        />
      </p>
      <p className="text-muted mt-2 text-sm">This page updates on its own every 2 seconds.</p>
    </section>
  );
}

export function Result({ approval, simulated }: { approval: Approval; simulated?: boolean }) {
  switch (approval.status) {
    case 'approved':
      return (
        <Banner tone="success" size="xl" title="Approved — publishing…">
          <p>The reviewer approved this exact claim. The backend is publishing it onchain.</p>
          {approval.publishTxHash && (
            <p className="mt-3 text-base">
              Publish tx: <TxLink value={approval.publishTxHash} chainId={11155111} simulated={simulated} />
            </p>
          )}
          <p className="text-muted mt-3 text-base">This page keeps checking every 2 seconds.</p>
        </Banner>
      );
    case 'spent':
      return (
        <Banner tone="success" size="xl" title="Published onchain">
          {approval.publishTxHash && (
            <p className="text-base">
              Publish tx: <TxLink value={approval.publishTxHash} chainId={11155111} simulated={simulated} />
            </p>
          )}
          {approval.onchainReportId && env.protocol === 'v2' && env.chainMode === 'live' ? (
            // V2: the case file links onchain only after the registry's claim hash matches, and a new
            // publication has no market until a per-report vault is deployed.
            <Link
              href={`/cases/${encodeURIComponent(approval.reportId)}`}
              className="bg-beam text-on-beam mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-lg font-semibold hover:brightness-105"
            >
              Open the case file to verify report #{approval.onchainReportId}
            </Link>
          ) : approval.onchainReportId ? (
            <Link
              href={`/case/${approval.onchainReportId}`}
              className="bg-beam text-on-beam mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-lg font-semibold hover:brightness-105"
            >
              Go to case #{approval.onchainReportId}
            </Link>
          ) : (
            <p className="text-muted mt-4 text-base">The case link appears once the backend reports the onchain id.</p>
          )}
        </Banner>
      );
    case 'denied':
      return (
        <Banner tone="danger" size="xl" title="Denied — no case opened.">
          <p>Draft only, no market opened.</p>
          <p className="text-muted mt-2 text-base">The reviewer turned this claim down. Nothing was published onchain.</p>
        </Banner>
      );
    case 'expired':
      return (
        <Banner tone="warning" size="xl" title="Expired — no case opened.">
          <p className="text-muted text-base">Nobody approved before the code ran out. Request a new approval from the case file.</p>
        </Banner>
      );
    case 'rejected_not_reviewer':
      return (
        <Banner tone="danger" size="xl" icon={UserX} title="This World ID isn't an enrolled reviewer — nothing published.">
          <p className="text-muted text-base">Only enrolled reviewers can approve a claim.</p>
        </Banner>
      );
    case 'error':
      return (
        <Banner tone="danger" size="xl" title="World verification unavailable — nothing published.">
          {approval.detail && <p className="text-muted text-base">{approval.detail}</p>}
        </Banner>
      );
    default:
      return null;
  }
}

function Skeleton() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[1.25fr_1fr]"
      aria-busy="true"
      aria-label="Loading sign-off request"
    >
      <div className="glass space-y-4 p-8">
        <div className="sweep h-6 w-1/3" />
        <div className="sweep h-10 w-full" />
        <div className="sweep h-20 w-full" />
        <div className="sweep h-8 w-2/3" />
      </div>
      <div className="glass space-y-4 p-8">
        <div className="sweep h-14 w-2/3" />
        <div className="sweep h-44 w-44" />
      </div>
    </div>
  );
}
