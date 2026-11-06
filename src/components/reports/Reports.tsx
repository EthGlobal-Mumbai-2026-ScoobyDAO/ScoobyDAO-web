'use client';
import Link from 'next/link';
import { ReportWidget } from './ReportWidget';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgentActivity } from './AgentActivity';
import {
  defaultReportAdapter,
  verifyAsset,
  type ReportAsset,
  type ReportAdapter,
} from '@/lib/reports';

export function Reports({
  id,
  adapter = defaultReportAdapter,
}: {
  id?: string;
  adapter?: ReportAdapter;
}) {
  const query = useQuery({
    queryKey: ['research-reports', id],
    queryFn: () =>
      id ? adapter.get(id).then((report) => (report ? [report] : [])) : adapter.list(),
    retry: false,
  });
  const state = { loading: query.isPending, error: query.isError, reports: query.data ?? [] };
  const report = state.reports[0];
  const html = report?.html ?? null;
  const markdown = report?.markdown ?? null;
  const pdf = report?.pdf ?? null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <p className="text-beam-ink text-sm font-semibold">RESEARCH LIBRARY</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">{id ? 'Report' : 'Reports'}</h1>
      <p className="text-muted mt-3 max-w-3xl">
        Explore research, reasoning and evidence. Reports are drafts; a selection or local review
        record does not establish authenticated approval.
      </p>
      <div className="border-line bg-surface mt-6 rounded-xl border p-4 text-sm" role="note">
        This library is a local integration draft. Review and publication are separate from report
        selection.
      </div>
      {!id && <AgentActivity />}
      {state.loading && (
        <p className="mt-8" role="status">
          Loading reports…
        </p>
      )}
      {state.error && (
        <p className="mt-8" role="alert">
          Reports are unavailable. Please try again later.
        </p>
      )}
      {!state.loading && !state.error && !state.reports.length && (
        <p className="mt-8">
          {id ? 'Report not found or unavailable.' : 'No reports available yet.'}
        </p>
      )}
      {!id &&
        state.reports.map((item) => (
          <article key={item.id} className="border-line bg-surface mt-6 rounded-xl border p-5">
            <p className="text-beam-ink text-sm">{item.context}</p>
            <h2 className="mt-2 text-2xl font-semibold">{item.title}</h2>
            <p className="text-muted mt-2 text-sm">{item.review}</p>
            <Link
              className="text-beam-ink mt-4 inline-block underline"
              href={`/reports/${encodeURIComponent(item.id)}`}
            >
              View report <span className="sr-only">{item.title}</span> →
            </Link>
          </article>
        ))}
      {id && report && (
        <>
          <Link href="/reports" className="text-beam-ink mt-6 inline-block underline">
            ← All reports
          </Link>
          <section
            className="border-line bg-surface mt-4 rounded-xl border p-5"
            aria-label="Report identity and access"
          >
            <p className="text-beam-ink text-sm font-semibold">{report.context}</p>
            <h2 className="mt-2 text-2xl font-semibold">{report.title}</h2>
            <p className="mt-2">{report.review}</p>
            <p className="text-muted mt-2 text-sm">{report.observed}</p>
            <dl className="text-muted mt-4 grid gap-2 text-xs">
              <div>
                <dt className="inline font-semibold">Report: </dt>
                <dd className="inline break-all">{report.reportId}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Version: </dt>
                <dd className="inline break-all">{report.version}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Candidate: </dt>
                <dd className="inline break-all">{report.candidateId}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Report SHA-256: </dt>
                <dd className="inline break-all">{report.digest}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <Link href={`/markets/publish?research=${encodeURIComponent(report.id)}`} className="text-beam-ink underline">Publish onchain</Link>
              {html ? <Download item={html} name="report.html" /> : <span>HTML unavailable</span>}
              {markdown ? (
                <Download item={markdown} name="report.md" />
              ) : (
                <span>Markdown unavailable</span>
              )}
              {pdf ? <Download item={pdf} name="report.pdf" /> : <span>PDF unavailable</span>}
            </div>
          </section>
          <ReportWidget
            key={report.reportId + ':' + report.version + ':' + report.digest}
            entry={report}
          />
        </>
      )}
    </main>
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
    <span>
      <button type="button" onClick={download} className="text-beam-ink underline">
        Download{' '}
        {name.endsWith('.md')
          ? 'Markdown'
          : name.endsWith('.pdf')
            ? 'PDF (unverified draft)'
            : 'HTML'}
      </button>
      {error && <span role="alert"> Download unavailable or digest mismatch.</span>}
    </span>
  );
}
