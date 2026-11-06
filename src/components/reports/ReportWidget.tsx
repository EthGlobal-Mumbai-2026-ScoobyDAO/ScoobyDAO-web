'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadNativeReport, PILLARS, type NativeReport } from '@/lib/report-widget';
import { verifyAsset, type ReportEntry } from '@/lib/reports';

export function ReportWidget({ entry }: { entry: ReportEntry }) {
  const [index, setIndex] = useState(0);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [
      'native-report',
      entry.reportId,
      entry.version,
      entry.digest,
      entry.packageUrl,
      entry.html?.url,
    ],
    queryFn: () => loadNativeReport(entry),
    retry: false,
  });
  if (query.isPending)
    return (
      <p className="mt-6" role="status">
        Loading research cards…
      </p>
    );
  if (query.isError || !query.data)
    return (
      <p className="mt-6" role="alert">
        Research cards are unavailable or the package could not be verified.
      </p>
    );
  const { report, irc, reasoning, assetBase } = query.data;
  const [key, name] = PILLARS[index];
  const pillar = report.pillars[key];
  const summary = irc?.pillars?.[key];
  const deep = reasoning?.reasoning?.pillars?.find((p) => p.name === key);
  const evidence = report.evidence.find((source) => source.id === evidenceId);
  const recommendation =
    reasoning?.profile === 'scooby.reasoning/2'
      ? reasoning.reasoning.conclusion?.recommendation
      : undefined;
  const select = (i: number) => {
    setIndex(i);
    setEvidenceId(null);
  };
  return (
    <section className="mt-8" aria-labelledby="research-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-beam-ink text-sm font-semibold">FIVE PILLARS</p>
          <h2 id="research-heading" className="mt-1 text-2xl font-semibold">
            The research, in context
          </h2>
          <p className="text-muted mt-1 text-sm">
            Select a pillar to explore its findings and evidence.
          </p>
        </div>
        <p className="text-muted text-sm" aria-live="polite">
          {index + 1} of {PILLARS.length}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose a pillar">
        {PILLARS.map(([id, label], i) => (
          <button
            key={id}
            type="button"
            aria-pressed={i === index}
            onClick={() => select(i)}
            className={`rounded-full border px-3 py-2 text-sm ${i === index ? 'border-beam bg-beam text-on-beam' : 'border-line bg-surface text-text'}`}
          >
            {label}
            <span className="ml-1 text-xs opacity-80">· {report.pillars[id].status}</span>
          </button>
        ))}
      </div>
      <article
        className="border-line bg-surface mt-4 min-w-0 rounded-2xl border p-5 sm:p-8"
        aria-labelledby="pillar-title"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' && index < PILLARS.length - 1) {
            event.preventDefault();
            select(index + 1);
          }
          if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            select(index - 1);
          }
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-beam-ink text-xs font-semibold">
              PILLAR {String(index + 1).padStart(2, '0')}
            </p>
            <h3 id="pillar-title" className="mt-2 text-2xl font-semibold">
              {name}
            </h3>
            <p className="text-muted mt-1 text-sm">Status: {pillar.status}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous pillar"
              disabled={index === 0}
              onClick={() => select(index - 1)}
              className="border-line rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next pillar"
              disabled={index === PILLARS.length - 1}
              onClick={() => select(index + 1)}
              className="border-line rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="bg-surface-raised min-w-0 rounded-xl p-4">
            <h4 className="text-beam-ink text-xs font-semibold uppercase">Insight</h4>
            <p className="mt-2 leading-relaxed">
              {summary?.insight?.text || pillar.summary || 'Insight pending.'}
            </p>
          </div>
          <div className="bg-surface-raised min-w-0 rounded-xl p-4">
            <h4 className="text-clue-ink text-xs font-semibold uppercase">Reasoning</h4>
            <p className="mt-2 leading-relaxed">
              {summary?.reasoning?.text || 'Reasoning pending.'}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <h4 className="text-muted text-xs font-semibold uppercase">Citations</h4>
          <CitationLinks
            ids={summary?.citations?.evidence_ids ?? pillar.evidence_ids}
            onSelect={setEvidenceId}
          />
        </div>
        {pillar.series.map((series) => (
          <SeriesChart key={series.id} series={series} onSelect={setEvidenceId} />
        ))}
        <details className="border-line mt-6 border-t pt-4">
          <summary className="cursor-pointer font-semibold">
            View full analysis, measurements and claims
          </summary>
          <div className="mt-4 space-y-4">
            {deep?.analysis?.length ? (
              deep.analysis.map((item, i) => (
                <div key={i}>
                  <p className="leading-relaxed">{item.text}</p>
                  <CitationLinks ids={item.evidence_ids} onSelect={setEvidenceId} />
                </div>
              ))
            ) : (
              <p className="text-muted">Detailed reasoning unavailable.</p>
            )}
            {[
              ...(summary?.limitations ?? []),
              ...(deep?.limitations ?? []),
              ...pillar.quality_issues,
            ].map((item, i) => (
              <p key={i} className="text-muted text-sm">
                Limitation: {item}
              </p>
            ))}
            {[...(summary?.questions ?? []), ...(deep?.questions ?? [])].map((item, i) => (
              <p key={i} className="text-muted text-sm">
                Open question: {item}
              </p>
            ))}
            <h4 className="font-semibold">Measurements</h4>
            {pillar.measurements.length ? (
              pillar.measurements.map((m) => (
                <div key={m.id} className="border-line rounded-lg border p-3 text-sm">
                  <p className="font-semibold break-words">
                    {m.id}:{' '}
                    {m.value === null
                      ? `Unknown${m.unknown_reason ? ` — ${m.unknown_reason}` : ''}`
                      : String(m.value)}{' '}
                    {m.unit ?? '(unit unknown)'}
                  </p>
                  <p className="text-muted mt-1">
                    Method: {m.method ?? 'unknown'} · Quality: {m.quality}
                  </p>
                  <CitationLinks ids={m.evidence_ids} onSelect={setEvidenceId} />
                </div>
              ))
            ) : (
              <p className="text-muted">No measurements supplied.</p>
            )}
            <h4 className="font-semibold">Claims and counterevidence</h4>
            {pillar.claims.length ? (
              pillar.claims.map((c) => (
                <div key={c.id} className="border-line rounded-lg border p-3 text-sm">
                  <p className="font-semibold">
                    {c.id} · {c.kind}
                  </p>
                  <p className="mt-1">{c.statement}</p>
                  <p className="text-muted mt-2">Supporting evidence</p>
                  <CitationLinks ids={c.supporting_evidence_ids} onSelect={setEvidenceId} />
                  <p className="text-muted mt-2">Counterevidence</p>
                  <CitationLinks ids={c.counterevidence_ids} onSelect={setEvidenceId} />
                  {c.contradiction_claim_ids?.length ? (
                    <p className="text-muted mt-2">
                      Contradicting claims: {c.contradiction_claim_ids.join(', ')}
                    </p>
                  ) : null}
                  {c.uncertainties?.map((u, i) => (
                    <p key={i} className="text-muted mt-1">
                      Uncertainty: {u}
                    </p>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-muted">No claims supplied.</p>
            )}
          </div>
        </details>
      </article>
      {evidenceId && (
        <Evidence
          source={evidence}
          id={evidenceId}
          assetBase={assetBase}
          onClose={() => setEvidenceId(null)}
        />
      )}
      {recommendation && (
        <section
          className="border-line bg-surface mt-4 rounded-xl border p-5"
          aria-label="Proposed action"
        >
          <p className="text-beam-ink text-xs font-semibold uppercase">
            Proposed action · pending review
          </p>
          <h3 className="mt-2 text-xl font-semibold">{recommendation.action}</h3>
          <p className="mt-3">{recommendation.rationale.text}</p>
          <CitationLinks ids={recommendation.rationale.evidence_ids} onSelect={setEvidenceId} />
          <InputRefs ids={recommendation.rationale.input_ids} report={report} />
          <h4 className="mt-5 font-semibold">Counterevidence</h4>
          {recommendation.counterevidence.length ? (
            recommendation.counterevidence.map((item, i) => (
              <div key={i} className="mt-2">
                <p>{item.text}</p>
                <CitationLinks ids={item.evidence_ids} onSelect={setEvidenceId} />
                <InputRefs ids={item.input_ids} report={report} />
              </div>
            ))
          ) : (
            <p className="text-muted mt-2">None supplied.</p>
          )}
          <h4 className="mt-5 font-semibold">What would change this view</h4>
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5">
            {recommendation.reversal_conditions.map((condition, i) => (
              <li key={i}>{condition}</li>
            ))}
          </ul>
          <p className="text-muted mt-4 text-sm">
            Evidence references provide traceability, not proof of the interpretation or
            authenticated sign-off.
          </p>
        </section>
      )}
      <details className="border-line bg-surface mt-4 rounded-xl border p-5">
        <summary className="cursor-pointer font-semibold">Overall assessment and unknowns</summary>
        <p className="mt-3 font-semibold">{report.assessment.label}</p>
        <p className="mt-2">{report.assessment.summary}</p>{' '}
        {reasoning?.reasoning?.conclusion?.analysis?.map((paragraph, i) => (
          <div key={i} className="mt-3">
            <p>{paragraph.text}</p>
            <CitationLinks ids={paragraph.evidence_ids} onSelect={setEvidenceId} />
            <InputRefs ids={paragraph.input_ids} report={report} />
          </div>
        ))}
        <ul className="text-muted mt-3 list-disc space-y-1 pl-5">
          {report.assessment.unknowns.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
function InputRefs({ ids, report }: { ids?: string[]; report: NativeReport['report'] }) {
  if (!ids?.length) return null;
  const inputs = Object.values(report.pillars).flatMap((pillar) => [
    ...pillar.claims,
    ...pillar.measurements,
    ...pillar.series,
  ]);
  return (
    <div className="mt-2 space-y-1">
      {ids.map((id) => {
        const item = inputs.find((input) => input.id === id);
        if (!item) return null;
        return (
          <details key={id} className="text-sm">
            <summary className="text-beam-ink cursor-pointer">Input: {id}</summary>
            <p className="text-muted mt-1 break-words">
              {'statement' in item
                ? item.statement
                : 'value' in item
                  ? `${item.value ?? 'unknown'} ${item.unit ?? '(unit unknown)'} · ${item.method ?? 'method unknown'}`
                  : `${item.points.length} observations · ${item.unit ?? 'unit unknown'} · ${item.method ?? 'method unknown'}`}
            </p>
          </details>
        );
      })}
    </div>
  );
}
function CitationLinks({
  ids,
  onSelect,
}: {
  ids: string[] | undefined;
  onSelect: (id: string) => void;
}) {
  if (!ids?.length) return <span className="text-muted text-sm">None supplied.</span>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onSelect(id);
            setTimeout(() => document.getElementById('source-detail')?.focus(), 0);
          }}
          className="text-beam-ink border-line max-w-full rounded border px-2 py-1 text-left text-xs break-all underline"
        >
          {id}
        </button>
      ))}
    </div>
  );
}
function Evidence({
  source,
  id,
  assetBase,
  onClose,
}: {
  source: NativeReport['report']['evidence'][number] | undefined;
  id: string;
  assetBase: string;
  onClose: () => void;
}) {
  const [error, setError] = useState(false);
  async function download() {
    try {
      setError(false);
      if (!source) throw new Error();
      const blob = await verifyAsset({ url: assetBase + source.path, sha256: source.sha256 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = source.path.split('/').pop() || 'evidence';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    }
  }
  return (
    <section
      id="source-detail"
      tabIndex={-1}
      aria-label="Evidence detail"
      className="border-line bg-surface-raised mt-4 rounded-xl border p-5"
    >
      <div className="flex justify-between gap-4">
        <h3 className="font-semibold break-all">Evidence: {id}</h3>
        <button type="button" onClick={onClose} className="text-beam-ink underline">
          Close
        </button>
      </div>
      {source ? (
        <>
          <p className="text-muted mt-2 text-sm">
            {source.kind} · Observed: {source.observed_at ?? 'unknown'} · Fetched:{' '}
            {source.fetched_at ?? 'unknown'}
          </p>
          <p className="mt-2 text-sm">{source.coverage}</p>
          {source.limitations?.map((x, i) => (
            <p key={i} className="text-muted mt-1 text-sm">
              {x}
            </p>
          ))}
          <button type="button" onClick={download} className="text-beam-ink mt-3 underline">
            Download verified evidence
          </button>
          {error && <p role="alert">Evidence unavailable or digest mismatch.</p>}
        </>
      ) : (
        <p className="mt-2">Evidence reference unavailable.</p>
      )}
    </section>
  );
}
function SeriesChart({
  series,
  onSelect,
}: {
  onSelect: (id: string) => void;
  series: NativeReport['report']['pillars'][string]['series'][number];
}) {
  const points = series.points.filter(
    (p) =>
      typeof p.value === 'number' &&
      Number.isFinite(p.value) &&
      typeof p.time === 'string' &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(p.time) &&
      Number.isFinite(Date.parse(p.time)),
  );
  const times = points.map((p) => Date.parse(p.time));
  const values = points.map((p) => p.value as number);
  const minT = Math.min(...times),
    maxT = Math.max(...times),
    minV = Math.min(...values),
    maxV = Math.max(...values);
  return (
    <div className="border-line mt-6 min-w-0 rounded-xl border p-4">
      <h4 className="font-semibold break-words">{series.id}</h4>
      <p className="text-muted mt-1 text-sm">
        {series.unit ?? 'Unit unknown'} · {series.quality} · {series.method ?? 'Method unknown'}
      </p>
      {points.length ? (
        <>
          <svg
            viewBox="0 0 600 180"
            role="img"
            aria-label={`${series.id}: ${points.length} observed points, not interpolated`}
            className="mt-3 h-auto w-full"
          >
            <line x1="40" y1="145" x2="570" y2="145" stroke="currentColor" opacity=".4" />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={
                  40 + (maxT === minT ? 265 : ((Date.parse(p.time) - minT) / (maxT - minT)) * 530)
                }
                cy={
                  145 - (maxV === minV ? 55 : (((p.value as number) - minV) / (maxV - minV)) * 110)
                }
                r="5"
                fill="var(--beam-400)"
              >
                <title>
                  {p.time}: {p.value}
                </title>
              </circle>
            ))}
          </svg>
          <p className="text-muted text-xs">
            Observed points only; gaps are not filled or connected.
          </p>
        </>
      ) : (
        <p className="text-muted mt-3">No plottable timestamped observations.</p>
      )}
      <CitationLinks ids={series.evidence_ids} onSelect={onSelect} />
      <details className="mt-3">
        <summary className="cursor-pointer text-sm">View observations</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {series.points.map((p, i) => (
            <li key={i} className="break-words">
              {p.time || 'Time unknown'}: {p.value ?? 'unknown'} {series.unit ?? ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
