'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Paperclip, ScanEye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { Identicon } from '@/components/Identicon';
import { SniffPose } from '@/components/SniffPose';
import { StatusChip } from '@/components/StatusChip';
import { TxLink } from '@/components/TxLink';
import { api, ApiError } from '@/lib/api';
import { claimSentence, CLAIM_TYPE_LABEL } from '@/lib/claimText';
import { formatDate } from '@/lib/format';
import { qk, useClaim, useReport } from '@/lib/queries';
import { caseStatusOf, type CaseStatus } from '@/lib/status';
import type { Manifest, Report } from '@/lib/types';
import { HashCheck } from './HashCheck';
import { ManifestViewer } from './ManifestViewer';

const FILE_STAMP: Partial<Record<CaseStatus, { text: string; cls: string }>> = {
  draft: { text: 'Classified', cls: 'text-ghost-ink' },
  awaiting_approval: { text: 'Classified', cls: 'text-ghost-ink' },
  denied: { text: 'Denied', cls: 'text-mask-ink' },
  expired: { text: 'Expired', cls: 'text-beam-ink' },
  Frozen: { text: 'Trap sprung', cls: 'text-mask-ink' },
  ResolvedPass: { text: 'Unmasked', cls: 'text-beam-ink' },
  ResolvedFail: { text: 'Cleared', cls: 'text-clue-ink' },
};

export function CaseFile({ id }: { id: string }) {
  const report = useReport(id);
  const r = report.data;
  const claim = useClaim(r?.claimId);
  const deployments = useQuery({
    queryKey: qk.deployments,
    queryFn: () => api.getDeployments(),
    staleTime: 60_000,
  });

  if (report.isError) {
    const nf = report.error instanceof ApiError && report.error.status === 404;
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        {nf ? (
          <EmptyState
            pose="confused"
            title="This case went cold."
            action={
              <Link href="/cases" className="text-beam-ink underline underline-offset-4">
                Back to the case board
              </Link>
            }
          >
            There&apos;s no case file with the id <span className="num">{id}</span>.
          </EmptyState>
        ) : (
          <Banner tone="danger" title="Couldn't load this case file">
            {report.error.message}
          </Banner>
        )}
      </main>
    );
  }
  if (!r) {
    return (
      <main
        className="mx-auto max-w-5xl space-y-6 px-4 py-10"
        aria-busy="true"
        aria-label="Loading case file"
      >
        <div className="sweep h-12 w-80" />
        <div className="sweep h-96" />
      </main>
    );
  }

  const status = caseStatusOf(r, claim.data?.status);
  const stamp = FILE_STAMP[status];
  const m = r.manifest;
  const named = (addr: string) => {
    const d = deployments.data?.demo;
    if (!d) return undefined;
    if (addr.toLowerCase() === d.deployer.toLowerCase()) return 'Token deployer';
    if (addr.toLowerCase() === d.funder.toLowerCase()) return 'Funded the deployer';
    return undefined;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <p className="text-muted text-sm">
        <Link href="/cases" className="hover:text-text">
          Case board
        </Link>{' '}
        / <span className="num">{r.id}</span>
      </p>

      <article className="paper relative mt-4 px-5 pt-8 pb-8 pl-14 sm:px-10 sm:pl-16">
        <Paperclip
          size={34}
          className="absolute -top-4 left-8 rotate-12 text-[#8b8f9c]"
          aria-hidden
        />
        {stamp && (
          <span className={`stamp absolute top-6 right-6 text-base sm:text-xl ${stamp.cls}`}>
            {stamp.text}
          </span>
        )}

        <header className="flex flex-wrap items-start gap-4 pr-28">
          <Identicon address={r.token} size={64} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl">Case file</h1>
            <p className="mt-1 break-all">
              <TxLink kind="token" value={r.token} full />
            </p>
            <p className="text-muted mt-1 text-sm">
              Sepolia · filed {formatDate(r.createdAt)} · window{' '}
              {Math.round(m.windowSeconds / 3600)}h
            </p>
          </div>
        </header>
        <div className="mt-4">
          <StatusChip status={status} />
        </div>

        <Section title="The claims">
          <ul className="grid gap-4 md:grid-cols-2">
            {m.claims.map((c) => (
              <li
                key={c.id}
                className="rounded-sm bg-white/70 p-4 shadow-[0_6px_14px_-8px_rgb(0_0_0/0.4)]"
                style={{ borderTop: '3px solid var(--mask-500)' }}
              >
                <p className="text-muted flex items-baseline justify-between gap-2 text-sm">
                  <span>Claim {c.id + 1}</span>
                  <span className="num text-xs">{c.type}</span>
                </p>
                <p className="font-display mt-1 text-lg">{CLAIM_TYPE_LABEL[c.type]}</p>
                <p className="mt-2 font-mono text-[15px] leading-relaxed">{claimSentence(c)}</p>
                {Object.keys(c.params).length > 0 && (
                  <dl className="num text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {Object.entries(c.params).map(([k, v]) => (
                      <div key={k}>
                        <dt className="inline">{k}: </dt>
                        <dd className="text-text inline">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Evidence" stamp="Evidence">
          <ol className="space-y-3">
            {m.evidence.map((e, i) => (
              <li key={i} className="border-line relative rounded-sm border bg-white/50 p-4 pr-24">
                <span
                  className={`stamp absolute top-3 right-3 text-[0.7rem] ${e.result === 'pass' ? 'text-clue-ink' : 'text-mask-ink'}`}
                >
                  {e.result}
                </span>
                <p className="text-muted text-sm">
                  <span className="num">#{i + 1}</span> · {e.kind} · result:{' '}
                  <span className="num text-text font-semibold">{e.result}</span>
                </p>
                <p className="mt-1">{e.detail}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Sniff's notes (AI-written; not the verdict)">
          <div
            className="flex gap-4 rounded-sm bg-[#fff3b8] p-4 text-[#2a2418] shadow-[0_8px_16px_-10px_rgb(0_0_0/0.45)]"
            style={{ transform: 'rotate(-0.6deg)' }}
          >
            <SniffPose pose="thinking" size={56} decorative />
            <div>
              <p className="leading-relaxed">{m.summary}</p>
              <p className="mt-2 text-xs text-[#5b5140]">
                Drafted by an AI agent from the evidence above. It isn&apos;t a finding: only the
                checks above and a human sign-off count.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Suspects barred from betting">
          <SuspectList wallets={m.excludedWallets} named={named} />
        </Section>

        <Section title="Manifest">
          <div className="space-y-4">
            <HashCheck report={r} />
            <ManifestViewer manifest={m} />
          </div>
        </Section>
      </article>

      <NextStep report={r} status={status} />
    </main>
  );
}

function Section({
  title,
  stamp,
  children,
}: {
  title: string;
  stamp?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="border-line font-display mb-3 flex items-center gap-3 border-b pb-1 text-xl">
        {title}
        {stamp && (
          <span className="stamp text-mask-ink text-[0.65rem]" aria-hidden>
            {stamp}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function SuspectList({
  wallets,
  named,
}: {
  wallets: Manifest['excludedWallets'];
  named: (a: string) => string | undefined;
}) {
  if (wallets.length === 0)
    return (
      <p className="text-muted">No wallets are linked to the deployer, so nobody is barred.</p>
    );
  return (
    <>
      <p className="text-muted mb-3 text-sm">
        These wallets are linked to whoever deployed the token. The contract rejects their stakes so
        nobody can bet on their own rug.
      </p>
      <ul className="space-y-2">
        {wallets.map((w) => (
          <li key={w} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Identicon address={w} size={22} />
            <TxLink kind="address" value={w} full />
            {named(w) && (
              <span className="border-line text-muted rounded border px-1.5 text-xs">
                {named(w)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function NextStep({ report, status }: { report: Report; status: CaseStatus }) {
  const router = useRouter();
  const request = useMutation({
    mutationFn: () => api.requestApproval(report.id),
    onSuccess: (a) => router.push(`/approve/${a.id}`),
  });

  if (report.status === 'published' && report.claimId) {
    return (
      <div className="glass mt-8 flex flex-wrap items-center gap-4 p-5">
        <p className="mr-auto">
          This claim is published as <span className="font-semibold">case #{report.claimId}</span>
          {report.txHash && (
            <>
              {' '}
              in tx <TxLink value={report.txHash} />
            </>
          )}
          .
        </p>
        <Link
          href={`/case/${report.claimId}/stake`}
          className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105"
        >
          {status === 'Open' ? 'Stake your verdict' : 'View stakes'}
        </Link>
        <Link
          href={`/case/${report.claimId}/market`}
          className="border-line inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]"
        >
          <ArrowRightLeft size={16} aria-hidden /> Trade shares
        </Link>
      </div>
    );
  }

  if (report.status === 'awaiting_approval' && report.approvalId) {
    return (
      <div className="glass mt-8 flex flex-wrap items-center gap-4 p-5">
        <p className="mr-auto">
          A sign-off request is open. The reviewer approves or denies it in World App.
        </p>
        <Link
          href={`/approve/${report.approvalId}`}
          className="bg-beam text-on-beam rounded-xl px-4 py-2.5 font-semibold hover:brightness-105"
        >
          Open the sign-off screen
        </Link>
      </div>
    );
  }

  return (
    <div className="glass mt-8 space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <p className="mr-auto max-w-xl">
          {report.status === 'draft'
            ? 'This is a draft. Nothing is public onchain until a registered human reviewer signs off on the exact claim above.'
            : `The last sign-off request was ${report.status}. You can ask a reviewer again.`}
        </p>
        <button
          type="button"
          onClick={() => request.mutate()}
          disabled={request.isPending}
          className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
        >
          <ScanEye size={18} aria-hidden />{' '}
          {request.isPending ? 'Requesting…' : 'Request a human sign-off'}
        </button>
      </div>
      {request.isError && (
        <Banner tone="danger" title="The sign-off request didn't start">
          {request.error.message}
        </Banner>
      )}
    </div>
  );
}
