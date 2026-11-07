'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Download as DownloadIcon, Search } from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { Identicon } from '@/components/Identicon';
import { useReferenceCases } from '@/components/reference/ReferenceCases';
import { ReferenceChip } from '@/components/reference/ReferenceChip';
import { CopyAddress } from '@/components/report/ReaderLayout';
import { ReviewBadge, reviewKindOf, type ReviewKind } from '@/components/report/ReviewBadge';
import {
  Card,
  EmptyState,
  LoadState,
  Page,
  PageHeader,
  SegmentedControl,
  TechnicalDetails,
  type QueryLike,
} from '@/components/ui';
import { adminToken, reportKey } from '@/lib/adminToken';
import { chainName } from '@/lib/explorer';
import { REFERENCE_PAIRS, type ReferenceCase } from '@/lib/reference';
import {
  defaultReportAdapter,
  verifyAsset,
  type ReportAsset,
  type ReportAdapter,
  type ReportEntry,
} from '@/lib/reports';
import { AgentActivity } from './AgentActivity';
import { ReportWidget } from './ReportWidget';

/** One row of the library: a public backend report or one of the six historical references. */
export interface LibraryItem {
  key: string;
  kind: 'backend' | 'reference';
  symbol: string;
  chainId?: number;
  address?: string;
  summary: string | null;
  review: ReviewKind;
  date: string | null;
  href: string;
  /** Report key for the reviewer session lookup. */
  sessionKey: string;
  routing?: string | null;
}

const chainOf = (candidate: string) => {
  const [c, a] = candidate.split(':');
  const n = Number(c);
  return { chainId: Number.isInteger(n) && n > 0 ? n : undefined, address: a?.startsWith('0x') ? a : undefined };
};
const day = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
};

export function fromBackend(e: ReportEntry): LibraryItem {
  const { chainId, address } = chainOf(e.candidateId);
  return {
    key: `b:${e.id}`,
    kind: 'backend',
    symbol: e.symbol ?? e.title.replace(/ research report$/, ''),
    chainId,
    address,
    summary: e.context,
    review: reviewKindOf(e.reviewStatus),
    date: day(e.observedAt),
    href: `/reports/${encodeURIComponent(e.id)}`,
    sessionKey: reportKey(e.reportId, e.version),
  };
}

export function fromReference(c: ReferenceCase): LibraryItem[] {
  // Only report links that match the pinned table are listed; a mismatch is never turned into a link.
  return c.reports.map((r) => ({
    key: `r:${r.report_id}@${r.report_version}`,
    kind: 'reference' as const,
    symbol: c.item.identity?.symbol ?? c.pair.symbol,
    chainId: c.item.identity?.chain_id,
    address: c.item.identity?.address,
    summary: c.summary,
    review: reviewKindOf(r.review_state),
    date: day(c.fetchedAt),
    href: `/reports/${encodeURIComponent(r.report_id)}/${encodeURIComponent(r.report_version)}`,
    sessionKey: reportKey(r.report_id, r.report_version),
    routing: c.routing,
  }));
}

type Filter = 'all' | 'approved' | 'reference' | 'pending';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'reference', label: 'Reference' },
  { key: 'pending', label: 'Pending' },
];
const matches = (it: LibraryItem, f: Filter) =>
  f === 'all' ||
  (f === 'approved' && it.review === 'approved') ||
  (f === 'reference' && it.kind === 'reference') ||
  (f === 'pending' && it.review === 'pending');

const REFERENCE_KEYS = REFERENCE_PAIRS.map((p) => reportKey(p.report_id, p.report_version));

export function Reports({
  id,
  adapter = defaultReportAdapter,
}: {
  id?: string;
  adapter?: ReportAdapter;
}) {
  return id ? <ReportDetail id={id} adapter={adapter} /> : <Library adapter={adapter} />;
}

function Library({ adapter }: { adapter: ReportAdapter }) {
  const backend = useQuery({
    queryKey: ['research-reports', undefined],
    queryFn: () => adapter.list(),
    retry: false,
  });
  const refs = useReferenceCases();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const keys = [...REFERENCE_KEYS, ...(backend.data ?? []).map((e) => reportKey(e.reportId, e.version))];
  // "Pending" is a reviewer's view: shown only while this tab holds a review session for a listed report.
  const reviewer = useSyncExternalStore(
    adminToken.subscribe,
    () => keys.some((k) => !!adminToken.get(k)),
    () => false,
  );

  const items = [
    ...(backend.data ?? []).map(fromBackend),
    ...(refs.data?.refs ?? []).flatMap(fromReference),
  ];
  const q = query.trim().toLowerCase();
  const searched = items.filter(
    (it) =>
      !q ||
      it.symbol.toLowerCase().includes(q) ||
      (it.address ?? '').toLowerCase().includes(q),
  );
  const filters = FILTERS.filter((f) => f.key !== 'pending' || reviewer);
  const active = filters.some((f) => f.key === filter) ? filter : 'all';
  const shown = searched.filter((it) => matches(it, active));

  const both: QueryLike<true> = {
    data: backend.data !== undefined || refs.data !== undefined ? true : undefined,
    isError:
      backend.isError && (refs.isError || (refs.data === undefined && refs.fetchStatus === 'idle')),
    error: backend.error ?? refs.error,
    refetch: () => {
      void backend.refetch();
      void refs.refetch();
    },
  };

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="Every case file Sniff has written."
        actions={<AgentActivity />}
      />
      <LoadState
        query={both}
        source="Research API"
        skeleton={
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading reports">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sweep h-52 rounded-[14px]" />
            ))}
          </div>
        }
      >
        {() =>
          items.length === 0 ? (
            <EmptyState
              pose="thinking"
              title="No public reports yet"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link
                    href="/cases"
                    className="bg-beam text-on-beam rounded-xl px-4 py-2 font-semibold hover:brightness-105"
                  >
                    Open the case board
                  </Link>
                  <Link href="/#how-it-works" className="border-line rounded-xl border px-4 py-2">
                    How it works
                  </Link>
                </div>
              }
            >
              Reports appear here once Sniff files them.
            </EmptyState>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <SegmentedControl
                  label="Filter reports"
                  items={filters.map((f) => ({
                    ...f,
                    count: searched.filter((it) => matches(it, f.key)).length,
                  }))}
                  value={active}
                  onChange={setFilter}
                />
                <label className="relative min-w-56 flex-1">
                  <span className="sr-only">Search by symbol or address</span>
                  <Search
                    size={16}
                    className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Symbol or address"
                    className="border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-2.5 pr-3 pl-9 text-sm outline-none"
                  />
                </label>
              </div>
              {(backend.isError || refs.isError) && (
                <p role="status" className="text-muted mb-6 text-sm">
                  Some reports didn’t load from the Research API.{' '}
                  <button type="button" onClick={() => both.refetch()} className="text-text underline underline-offset-4">
                    Retry
                  </button>
                </p>
              )}
              {shown.length === 0 ? (
                <EmptyState pose="thinking" title="No reports match">
                  Try another filter or symbol.
                </EmptyState>
              ) : (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((it) => (
                    <li key={it.key}>
                      <LibraryCard item={it} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }
      </LoadState>
    </Page>
  );
}

export function LibraryCard({ item }: { item: LibraryItem }) {
  return (
    <Card className="relative flex h-full flex-col">
      <div className="flex items-start gap-3">
        <Identicon address={item.address ?? item.key} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight font-semibold">
            <Link href={item.href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {item.symbol}
            </Link>
          </h3>
          <p className="text-muted mt-0.5 text-[13px]">
            {item.chainId ? chainName(item.chainId) : 'Chain unknown'}
            {item.date && <> · {item.date}</>}
          </p>
        </div>
      </div>
      {item.summary && (
        <p className="mt-3 line-clamp-2 text-[15px]" title={item.summary}>
          {item.summary}
        </p>
      )}
      <div className="border-line relative z-10 mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        <ReviewBadge kind={item.review} />
        {item.kind === 'reference' && (
          <ReferenceChip align="end">
            <strong className="block">Historical reference</strong>
            <span className="text-muted mt-1 block">
              {item.routing ?? 'A replay of captured evidence, kept for comparison.'}
            </span>
          </ReferenceChip>
        )}
        <ArrowRight size={16} aria-hidden className="text-muted ml-auto" />
      </div>
    </Card>
  );
}

function ReportDetail({ id, adapter }: { id: string; adapter: ReportAdapter }) {
  const query = useQuery({
    queryKey: ['research-reports', id],
    queryFn: () => adapter.get(id).then((report) => (report ? [report] : [])),
    retry: false,
  });
  return (
    <Page>
      <Link
        href="/reports"
        className="text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} aria-hidden /> All reports
      </Link>
      <LoadState
        query={query}
        source="Research API"
        skeleton={<div className="sweep h-48 rounded-[14px]" aria-label="Loading the report" />}
      >
        {(list) =>
          list[0] ? (
            <BackendReport report={list[0]} />
          ) : (
            <EmptyState pose="shrug" title="Report not found">
              It may have been withdrawn, or the link is wrong.
            </EmptyState>
          )
        }
      </LoadState>
    </Page>
  );
}

function BackendReport({ report }: { report: ReportEntry }) {
  const item = fromBackend(report);
  return (
    <>
      <Card aria-label="Report identity and access" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted text-[13px] font-medium">{report.context}</p>
            <h1 className="font-display mt-1 text-[2.5rem] leading-none sm:text-5xl">{item.symbol}</h1>
            <p className="text-muted mt-2 flex flex-wrap items-center gap-x-2 text-sm">
              <span>{item.chainId ? chainName(item.chainId) : 'Chain unknown'}</span>
              {item.address && <CopyAddress address={item.address} />}
              {item.date && <span>· observed {item.date}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/markets/publish?research=${encodeURIComponent(report.id)}`}
              className="border-line rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Publish onchain
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReviewBadge kind={item.review} long />
          <span className="text-muted text-[13px]">{report.review}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {report.html ? <Download item={report.html} name="report.html" /> : null}
          {report.pdf ? <Download item={report.pdf} name="report.pdf" /> : null}
          {report.markdown ? <Download item={report.markdown} name="report.md" /> : null}
          {!report.html && !report.pdf && !report.markdown && (
            <span className="text-muted">No downloadable files for this report.</span>
          )}
        </div>
      </Card>
      <div className="mt-8">
        <ReportWidget key={report.reportId + ':' + report.version + ':' + report.digest} entry={report} />
      </div>
      <TechnicalDetails className="mt-8">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted">Report</dt>
          <dd className="num break-all">{report.reportId}</dd>
          <dt className="text-muted">Version</dt>
          <dd className="num break-all">{report.version}</dd>
          <dt className="text-muted">Candidate</dt>
          <dd className="num break-all">{report.candidateId}</dd>
          <dt className="text-muted">Report SHA-256</dt>
          <dd className="num break-all">{report.digest}</dd>
          <dt className="text-muted">Observations</dt>
          <dd>{report.observed}</dd>
        </dl>
      </TechnicalDetails>
    </>
  );
}

function Download({ item, name }: { item: ReportAsset; name: string }) {
  const [error, setError] = useState(false);
  async function download() {
    try {
      setError(false);
      const blob = await verifyAsset(item);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={download}
        className="border-line hover:border-beam inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
      >
        <DownloadIcon size={14} aria-hidden />
        Download{' '}
        {name.endsWith('.md') ? 'Markdown' : name.endsWith('.pdf') ? 'PDF (unverified draft)' : 'HTML'}
      </button>
      {error && (
        <span role="alert" className="text-mask-ink text-[13px]">
          Download unavailable or digest mismatch.
        </span>
      )}
    </span>
  );
}
