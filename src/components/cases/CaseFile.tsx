'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Gavel, Paperclip, ScanEye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banner } from '@/components/Banner';
import { Countdown } from '@/components/Countdown';
import { DemoClockLabel } from '@/components/HonestyLabels';
import { EmptyState } from '@/components/EmptyState';
import { OddsBar } from '@/components/OddsBar';
import { ClaimCard } from '@/components/report/ClaimCard';
import { ReportViewer, Section } from '@/components/report/ReportViewer';
import { StatusChip } from '@/components/StatusChip';
import { TxLink } from '@/components/TxLink';
import { api, ApiError, type ReportWithRaw } from '@/lib/api';
import { formatDate, formatUsdc } from '@/lib/format';
import { useReport } from '@/lib/queries';
import { caseStatusOf, type CaseStatus } from '@/lib/status';
import { nextDeadline, type MarketView } from '@/protocol';
import { useChainTime, useMarket } from '@/protocol/hooks';
import { HashCheck } from './HashCheck';

const FILE_STAMP: Partial<Record<CaseStatus, { text: string; cls: string }>> = {
  draft: { text: 'Classified', cls: 'text-ghost-ink' },
  awaiting_approval: { text: 'Classified', cls: 'text-ghost-ink' },
  denied: { text: 'Denied', cls: 'text-mask-ink' },
  expired: { text: 'Expired', cls: 'text-beam-ink' },
  final_yes: { text: 'Unmasked', cls: 'text-beam-ink' },
  final_no: { text: 'Cleared', cls: 'text-clue-ink' },
  void: { text: 'Void', cls: 'text-muted' },
};

export function CaseFile({ id }: { id: string }) {
  const report = useReport(id, { pollMs: 4000 });
  const r = report.data;
  const onchainId = r?.onchainReportId ? BigInt(r.onchainReportId) : undefined;
  const market = useMarket(onchainId);

  if (report.isError) {
    const nf = report.error instanceof ApiError && report.error.status === 404;
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        {nf ? (
          <EmptyState
            as="h1"
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
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-busy="true" aria-label="Loading case file">
        <div className="sweep h-12 w-80" />
        <div className="sweep h-96" />
      </main>
    );
  }

  const status = caseStatusOf(r, market.data?.phase);
  const stamp = FILE_STAMP[status];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <p className="text-muted text-sm">
        <Link href="/cases" className="hover:text-text">
          Case board
        </Link>{' '}
        / <span className="num">{r.id}</span>
      </p>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="paper relative px-5 pt-8 pb-8 pl-14 sm:px-10 sm:pl-16">
          <Paperclip size={34} className="absolute -top-4 left-8 rotate-12 text-[#8b8f9c]" aria-hidden />
          {stamp && <span className={`stamp absolute top-6 right-6 text-base sm:text-xl ${stamp.cls}`}>{stamp.text}</span>}
          <div className="pr-24">
            <StatusChip status={status} />
            <p className="text-muted mt-2 text-sm">Filed {formatDate(r.createdAt)}</p>
          </div>
          <div className="mt-6">
            <ReportViewer report={r.report}>
              <Section title="The claim">
                <ClaimCard manifest={r.claimManifest} market={market.data} />
              </Section>
              <Section title="Hashes">
                <HashCheck
                  raw={r.raw}
                  reportSha256={r.reportSha256}
                  claimManifest={r.claimManifest}
                  claimHash={r.claimHash}
                  onchain={market.data ? { reportHash: market.data.reportHash, claimHash: market.data.claimHash } : undefined}
                />
              </Section>
            </ReportViewer>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Case status">
          {onchainId !== undefined ? (
            <MarketRail id={onchainId} market={market.data} loading={market.isLoading} error={market.error?.message} tx={r.txHash} />
          ) : (
            <ApprovalRail report={r} />
          )}
        </aside>
      </div>
    </main>
  );
}

function MarketRail({ id, market: m, loading, error, tx }: { id: bigint; market?: MarketView; loading: boolean; error?: string; tx?: string }) {
  const now = useChainTime();
  if (error) return <Banner tone="danger" title="Couldn't read the market">{error}</Banner>;
  if (loading || !m) return <div className="sweep h-64" aria-busy="true" aria-label="Loading market" />;
  const next = nextDeadline(m);
  return (
    <div className="glass space-y-4 p-5">
      <div>
        <p className="text-muted text-sm">Onchain case</p>
        <p className="font-display text-2xl">#{id.toString()}</p>
        {tx && (
          <p className="text-sm">
            Published in <TxLink value={tx} simulated={m.demoClock} />
          </p>
        )}
      </div>
      <StatusChip status={m.phase} size="lg" />
      <OddsBar yes={m.totals.yes} no={m.totals.no} />
      <p className="text-sm">
        <span className="num">{formatUsdc(m.totals.yes + m.totals.no)}</span> dUSD staked
      </p>
      {next && (
        <p className="text-sm">
          {next.label} in <Countdown to={next.at} now={now} className="font-semibold" />
        </p>
      )}
      {m.demoClock && <DemoClockLabel />}
      <nav className="flex flex-col gap-2" aria-label="Case actions">
        <Link href={`/case/${id}/stake`} className="bg-beam text-on-beam rounded-xl px-4 py-2.5 text-center font-semibold hover:brightness-105">
          Stake Yes / No
        </Link>
        <Link href={`/case/${id}/market`} className="border-line inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]">
          <ArrowRightLeft size={16} aria-hidden /> Trade YT
        </Link>
        <Link href={`/case/${id}/result`} className="border-line inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-semibold hover:border-[var(--fog-400)]">
          <Gavel size={16} aria-hidden /> Result &amp; claims
        </Link>
      </nav>
    </div>
  );
}

function ApprovalRail({ report }: { report: ReportWithRaw }) {
  const router = useRouter();
  const request = useMutation({
    mutationFn: () => api.requestApproval(report.id),
    onSuccess: (a) => router.push(`/approve/${encodeURIComponent(a.id)}`),
  });
  if (report.status === 'awaiting_approval' && report.approvalId)
    return (
      <div className="glass space-y-3 p-5">
        <StatusChip status="awaiting_approval" size="lg" />
        <p>A sign-off request is open. The reviewer approves or denies it in World App.</p>
        <Link href={`/approve/${encodeURIComponent(report.approvalId)}`} className="bg-beam text-on-beam block rounded-xl px-4 py-2.5 text-center font-semibold hover:brightness-105">
          Open the sign-off screen
        </Link>
      </div>
    );
  return (
    <div className="glass space-y-3 p-5">
      <StatusChip status={caseStatusOf(report)} size="lg" />
      <p>
        {report.status === 'draft'
          ? 'Draft. Nothing is public onchain until an enrolled human reviewer approves this exact report and claim.'
          : report.status === 'published'
            ? 'Published; waiting for the onchain report id.'
            : `The last sign-off request was ${report.status}. No case opened. You can ask a reviewer again.`}
      </p>
      {report.status !== 'published' && (
        <button
          type="button"
          onClick={() => request.mutate()}
          disabled={request.isPending}
          className="bg-beam text-on-beam inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
        >
          <ScanEye size={18} aria-hidden /> {request.isPending ? 'Requesting…' : 'Request human approval'}
        </button>
      )}
      {request.isError && (
        <Banner tone="danger" title="The approval request didn't start">
          {request.error.message}
        </Banner>
      )}
    </div>
  );
}
