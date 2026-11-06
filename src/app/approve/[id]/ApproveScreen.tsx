'use client';

import { CheckCircle2, ExternalLink, UserX, XCircle } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Banner } from '@/components/Banner';
import { Countdown } from '@/components/Countdown';
import { HashText } from '@/components/HashText';
import { TxLink } from '@/components/TxLink';
import { hashMatches } from '@/lib/canonical';
import { claimSentence } from '@/lib/claimText';
import { ApiError } from '@/lib/api';
import { useApproval, useReport } from '@/lib/queries';
import type { Approval, Report } from '@/lib/types';

// Projector screen for the World Agent Pass sign-off. Display only: every state shown
// here comes from GET /approvals/:id (polled every 2s); the UI never decides approval.

export function ApproveScreen({ id }: { id: string }) {
  const approval = useApproval(id);
  const a = approval.data;
  const final = a && a.status !== 'pending';
  const approved = a?.status === 'approved' || a?.status === 'spent';
  // After approval, keep polling the report until the backend has a claimId to link to.
  const report = useReport(a?.reportId, {
    pollMs: approved ? (q) => (q.state.data?.claimId ? false : 3000) : false,
  });
  const r = report.data;

  if (approval.isError) {
    const notFound = approval.error instanceof ApiError && approval.error.status === 404;
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
    <Shell status={a.status}>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        <ClaimToCheck approval={a} report={r} />
        <div
          className={`lg:sticky lg:top-24 lg:self-start ${final ? 'order-first lg:order-none' : ''}`}
        >
          {final ? (
            <Result approval={a} report={r} onRefresh={() => report.refetch()} />
          ) : (
            <CodePanel approval={a} />
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, status }: { children: React.ReactNode; status?: Approval['status'] }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-lg sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Human sign-off</h1>
          <p className="text-muted mt-2 max-w-2xl text-xl">
            No agent can open a case alone. A registered reviewer checks this claim and approves or
            denies it in World App.
          </p>
        </div>
        {status && <ApprovalChip status={status} />}
      </header>
      {children}
    </main>
  );
}

const CHIP: Record<Approval['status'], { label: string; cls: string }> = {
  pending: {
    label: 'Waiting for the reviewer',
    cls: 'text-ghost-ink border-[color-mix(in_srgb,var(--ghost-300)_50%,transparent)]',
  },
  approved: {
    label: 'Approved',
    cls: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]',
  },
  spent: {
    label: 'Approved · published',
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
    label: 'Not a reviewer',
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

function ClaimToCheck({ approval, report }: { approval: Approval; report?: Report }) {
  const m = report?.manifest;
  const hashOk = report
    ? approval.manifestHash.toLowerCase() === report.manifestHash.toLowerCase() &&
      hashMatches(report.manifest, report.manifestHash)
    : undefined;

  return (
    <section aria-labelledby="claim-h" className="glass p-6 sm:p-8">
      <h2 id="claim-h" className="text-muted text-xl font-semibold">
        {approval.status === 'pending'
          ? 'Check this claim before approving'
          : 'The claim the reviewer saw'}
      </h2>

      <dl className="mt-6 space-y-6">
        <div>
          <dt className="text-muted text-base">Token</dt>
          <dd className="mt-1 text-xl">
            {report ? (
              <TxLink kind="token" value={report.token} full />
            ) : (
              <span className="sweep inline-block h-7 w-96 max-w-full" />
            )}
          </dd>
          <dd className="text-muted mt-1 text-base">
            Chain: Sepolia testnet <span className="num">({report?.chainId ?? 11155111})</span>
          </dd>
        </div>

        <div>
          <dt className="text-muted text-base">
            {m && m.claims.length > 1 ? `Claims (${m.claims.length})` : 'Claim'}
          </dt>
          <dd className="mt-2">
            {m ? (
              <ol className="space-y-3">
                {m.claims.map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-3 text-2xl leading-snug font-medium sm:text-[1.7rem]"
                  >
                    {m.claims.length > 1 && (
                      <span className="num text-muted pt-1 text-lg">{c.id + 1}.</span>
                    )}
                    <span>{claimSentence(c)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <span className="sweep block h-16" />
            )}
          </dd>
          {m && (
            <dd className="text-muted mt-3 text-base">
              Case window: <span className="num">{Math.round(m.windowSeconds / 3600)}</span> hours ·
              Wallets barred from betting: <span className="num">{m.excludedWallets.length}</span>
            </dd>
          )}
        </div>

        <div>
          <dt className="text-muted text-base">Manifest hash (goes onchain)</dt>
          <dd className="mt-1">
            <HashText value={approval.manifestHash} size="xl" label="manifest hash" />
          </dd>
          {hashOk !== undefined && (
            <dd
              className={`mt-2 inline-flex items-center gap-2 text-base ${hashOk ? 'text-clue-ink' : 'text-mask-ink'}`}
            >
              {hashOk ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}
              {hashOk
                ? 'Matches the case file (recomputed in this browser)'
                : "Doesn't match the case file. Don't approve."}
            </dd>
          )}
        </div>
      </dl>

      {report && (
        <p className="mt-6 text-base">
          <Link href={`/cases/${report.id}`} className="text-beam-ink underline underline-offset-4">
            Open the full case file
          </Link>
        </p>
      )}
    </section>
  );
}

function CodePanel({ approval }: { approval: Approval }) {
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

      {approval.verificationUri && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="w-fit rounded-xl bg-white p-3">
            <QRCodeSVG
              value={approval.verificationUri}
              size={176}
              marginSize={0}
              level="M"
              title="Scan to open World App"
            />
          </div>
          <a
            href={approval.verificationUri}
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

function Result({
  approval,
  report,
  onRefresh,
}: {
  approval: Approval;
  report?: Report;
  onRefresh: () => void;
}) {
  switch (approval.status) {
    case 'approved':
    case 'spent':
      return <ApprovedResult approval={approval} report={report} onRefresh={onRefresh} />;
    case 'denied':
      return (
        <Banner tone="danger" size="xl" title="Denied — no case opened">
          <p>Denied — draft only, no market opened</p>
          <p className="text-muted mt-2 text-base">
            The reviewer turned this claim down. It stays a draft in the case files; nothing was
            published onchain.
          </p>
        </Banner>
      );
    case 'expired':
      return (
        <Banner tone="warning" size="xl" title="Expired — no case opened">
          <p>Expired — draft only, no market opened</p>
          <p className="text-muted mt-2 text-base">
            Nobody approved before the code ran out. Request a new sign-off from the case file to
            try again.
          </p>
        </Banner>
      );
    case 'rejected_not_reviewer':
      return (
        <Banner
          tone="danger"
          size="xl"
          icon={UserX}
          title="Not a registered reviewer — nothing published"
        >
          <p>This World ID isn&apos;t a registered reviewer — nothing published</p>
        </Banner>
      );
    default:
      return null;
  }
}

function ApprovedResult({
  approval,
  report,
  onRefresh,
}: {
  approval: Approval;
  report?: Report;
  onRefresh: () => void;
}) {
  const claimId = report?.claimId;
  return (
    <Banner tone="success" size="xl" title="Case opened">
      <p>Approved — claim published</p>
      {approval.publishTxHash && (
        <p className="mt-3 text-base">
          Publish tx: <TxLink value={approval.publishTxHash} />
        </p>
      )}
      {claimId ? (
        <Link
          href={`/case/${claimId}/stake`}
          className="bg-beam text-on-beam mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-lg font-semibold hover:brightness-105"
        >
          Go to case #{claimId}
        </Link>
      ) : (
        <p className="text-muted mt-4 text-base">
          The case link appears once the publish transaction confirms.{' '}
          <button
            type="button"
            onClick={onRefresh}
            className="text-beam-ink underline underline-offset-4"
          >
            Check again
          </button>
        </p>
      )}
    </Banner>
  );
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
