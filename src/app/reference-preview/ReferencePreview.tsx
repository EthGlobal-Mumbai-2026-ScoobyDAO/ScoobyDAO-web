'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportWidget } from '@/components/reports/ReportWidget';
import type { ReportEntry } from '@/lib/reports';

type Reference = {
  symbol: string;
  case_id: string;
  candidate_id: string;
  report_id: string;
  version: string;
  report_sha256: string;
  status: string;
  world_verified: boolean;
  gate_effect: string;
};
const order = ['SHIB', 'FET', 'SPX', 'YFI', 'GRT', 'METIS'];
const base = 'http://127.0.0.1:60990';
function entry(r: Reference): ReportEntry {
  return {
    id: `${r.report_id}~${r.version}`,
    apiOrigin: base,
    localPreviewBase: `${base}/preview/${r.symbol.toLowerCase()}`,
    title: `${r.symbol} reference research`,
    reportId: r.report_id,
    version: r.version,
    candidateId: r.candidate_id,
    digest: r.report_sha256,
    context: 'Local historical reference',
    observed: 'See source timestamps in the evidence.',
    review: 'Unreviewed; no World ID or case-gate approval.',
    html: null,
    markdown: null,
    pdf: null,
  };
}
async function load(): Promise<Reference[]> {
  const response = await fetch(base + '/preview', {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Local reference service unavailable');
  const data = await response.json();
  if (!Array.isArray(data.reports) || data.reports.length !== 6)
    throw new Error('Incomplete reference set');
  const seen = new Set<string>();
  for (const r of data.reports) {
    if (
      !r ||
      !order.includes(r.symbol) ||
      seen.has(r.symbol) ||
      !/^1:0x[a-f0-9]{40}$/i.test(r.candidate_id) ||
      !/^[a-f0-9]{64}$/.test(r.case_id) ||
      !/^[a-f0-9]{64}$/.test(r.report_sha256) ||
      !/^[a-zA-Z0-9._:-]+$/.test(r.report_id) ||
      !/^[a-zA-Z0-9._:-]+$/.test(r.version) ||
      r.status !== 'unreviewed_historical_reference' ||
      r.world_verified !== false ||
      r.gate_effect !== 'none'
    )
      throw new Error('Invalid reference binding');
    seen.add(r.symbol);
  }
  return data.reports.sort(
    (a: Reference, b: Reference) => order.indexOf(a.symbol) - order.indexOf(b.symbol),
  );
}
export function ReferencePreview() {
  const local = useSyncExternalStore(
    () => () => {},
    () => ['localhost', '127.0.0.1'].includes(window.location.hostname),
    () => false,
  );
  if (process.env.NEXT_PUBLIC_LOCAL_REFERENCE_PREVIEW !== 'true' || !local)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Local reference preview unavailable</h1>
      </main>
    );
  return <LocalReferences />;
}
function LocalReferences() {
  const [selected, setSelected] = useState<string | null>(null);
  const reportSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) reportSection.current?.focus();
  }, [selected]);
  const query = useQuery({
    queryKey: ['local-six-reference-preview'],
    queryFn: load,
    retry: false,
  });
  const chosen = query.data?.find((r) => r.symbol === selected);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <p className="text-beam-ink text-xs font-semibold uppercase">Local research preview</p>
      <h1 className="font-display mt-2 text-4xl">Six cases, five pillars</h1>
      <p className="border-mask text-mask-ink mt-4 rounded-xl border p-4 text-sm" role="note">
        Historical replay · unreviewed · synthetic lineage. These are local reference reports, not
        live case admissions, World ID approvals, or published findings. SHIB is the reference; the
        other five are selected research examples.
      </p>
      <p className="text-muted mt-3 text-sm">
        Choose a case to explore its source-backed report. Activity screens and concerns require
        separate verification.
      </p>
      {query.isPending && (
        <p role="status" className="mt-6">
          Loading the six local cases…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="mt-6">
          Local case references are unavailable.{' '}
          <button className="underline" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      )}
      {query.data && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((r) => (
            <button
              key={r.case_id}
              type="button"
              aria-pressed={r.symbol === selected}
              onClick={() => setSelected(r.symbol)}
              className={`border-line bg-surface rounded-xl border p-4 text-left ${selected === r.symbol ? 'outline-beam outline-2' : ''}`}
            >
              <span className="text-beam-ink block text-xs font-semibold uppercase">
                {r.symbol === 'SHIB' ? 'Reference case' : 'Historical research'}
              </span>
              <span className="mt-1 block text-xl font-semibold">{r.symbol}</span>
              <span className="text-muted mt-2 block text-xs break-all">{r.candidate_id}</span>
              <span className="text-muted mt-2 block text-xs">
                Unreviewed · no World or gate approval
              </span>
              <span className="text-beam-ink mt-3 block text-sm font-semibold">
                Explore report →
              </span>
            </button>
          ))}
        </div>
      )}
      {chosen && (
        <section
          ref={reportSection}
          tabIndex={-1}
          className="mt-8 scroll-mt-36 outline-none"
          aria-label={`${chosen.symbol} case report`}
        >
          <div className="border-line bg-surface rounded-xl border p-5">
            <p className="text-beam-ink text-xs font-semibold uppercase">
              Selected case · {chosen.symbol}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{chosen.symbol} research</h2>
            <p className="text-muted mt-2 text-sm">
              Unreviewed historical replay. Report version and evidence are bound to the selected
              case.
            </p>
            <p className="text-muted mt-2 text-xs break-all">
              Case {chosen.case_id} · Report {chosen.report_id} · Version {chosen.version} · SHA-256{' '}
              {chosen.report_sha256}
            </p>
          </div>
          <ReportWidget key={chosen.report_sha256} entry={entry(chosen)} />
        </section>
      )}
    </main>
  );
}
