'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PillarStatus } from '@/components/reference/ReaderStates';
import {
  EvidenceChips,
  EvidenceTable,
  ReaderSection,
  ReaderShell,
  type TocItem,
} from '@/components/report/ReaderLayout';
import { Card, Disclosure, ErrorState, LoadState } from '@/components/ui';
import { loadNativeReport, PILLARS, type NativeReport } from '@/lib/report-widget';
import { verifyAsset, type ReportEntry } from '@/lib/reports';

export function ReportWidget({ entry }: { entry: ReportEntry }) {
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
  if (query.isError)
    return (
      <ErrorState
        source="Research API"
        title="Research cards unavailable"
        message="The research cards are unavailable or the package could not be verified, so nothing is shown."
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <LoadState
      query={query}
      source="Research API"
      skeleton={<div className="sweep h-64 rounded-[14px]" aria-label="Loading research cards" />}
    >
      {(data) => <NativeReader data={data} />}
    </LoadState>
  );
}

function NativeReader({ data }: { data: NativeReport }) {
  const { report, irc, reasoning, assetBase } = data;
  const recommendation =
    reasoning?.profile === 'scooby.reasoning/2'
      ? reasoning.reasoning.conclusion?.recommendation
      : undefined;
  const toc: TocItem[] = [
    { id: 'summary', label: 'Summary' },
    ...PILLARS.map(([k, label]) => ({
      id: `pillar-${k}`,
      label,
      marker: <PillarStatus status={report.pillars[k]?.status} compact />,
    })),
    { id: 'evidence', label: 'Evidence' },
  ];
  const limitations = PILLARS.flatMap(([k]) => [
    ...(irc?.pillars?.[k]?.limitations ?? []),
    ...(report.pillars[k]?.quality_issues ?? []),
  ]);
  if (limitations.length) toc.push({ id: 'limitations', label: 'Limitations' });
  return (
    <ReaderShell toc={toc} header={null}>
      <ReaderSection id="summary" title="Summary">
        <div className="space-y-4">
          <Card>
            <p className="text-muted text-[13px]">Overall assessment (draft)</p>
            {report.assessment.label && (
              <p className="text-beam-ink mt-1 text-xl font-semibold">{report.assessment.label}</p>
            )}
            <p className="mt-2 line-clamp-4 max-w-[68ch]">{report.assessment.summary}</p>
            {(reasoning?.reasoning?.conclusion?.analysis?.length ?? 0) > 0 && (
              <Disclosure summary="Full reasoning" className="mt-3">
                <div className="space-y-3">
                  {reasoning!.reasoning.conclusion!.analysis!.map((paragraph, i) => (
                    <div key={i} className="max-w-[68ch]">
                      <p>{paragraph.text}</p>
                      <EvidenceChips ids={paragraph.evidence_ids} />
                      <InputRefs ids={paragraph.input_ids} report={report} />
                    </div>
                  ))}
                </div>
              </Disclosure>
            )}
            {report.assessment.unknowns.length > 0 && (
              <>
                <h3 className="mt-5 text-lg font-semibold">Open questions</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {report.assessment.unknowns.map((u, i) => (
                    <li key={i} className="border-line rounded-full border px-3 py-1 text-sm">
                      {u}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          {recommendation && (
            <Card aria-label="Proposed action">
              <p className="text-muted text-[13px]">Proposed action · pending review</p>
              <h3 className="mt-1 text-lg font-semibold">{recommendation.action}</h3>
              <p className="mt-2 max-w-[68ch]">{recommendation.rationale.text}</p>
              <EvidenceChips ids={recommendation.rationale.evidence_ids} />
              <InputRefs ids={recommendation.rationale.input_ids} report={report} />
              {recommendation.reversal_conditions.length > 0 && (
                <Disclosure summary="What would change this view" className="mt-3">
                  <ul className="text-muted list-disc space-y-1 pl-5">
                    {recommendation.reversal_conditions.map((condition, i) => (
                      <li key={i}>{condition}</li>
                    ))}
                  </ul>
                </Disclosure>
              )}
              <p className="text-muted mt-3 text-[13px]">
                Evidence references provide traceability, not proof of the interpretation or
                authenticated sign-off.
              </p>
            </Card>
          )}
          {recommendation && (
            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--clue-500)_50%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_10%,var(--surface))] p-5 sm:p-6">
              <h3 className="text-clue-ink text-lg font-semibold">Counterevidence</h3>
              {recommendation.counterevidence.length ? (
                <ul className="mt-2 space-y-3">
                  {recommendation.counterevidence.map((item, i) => (
                    <li key={i} className="max-w-[68ch]">
                      {item.text}
                      <EvidenceChips ids={item.evidence_ids} />
                      <InputRefs ids={item.input_ids} report={report} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mt-2">None supplied.</p>
              )}
            </div>
          )}
        </div>
      </ReaderSection>

      {PILLARS.map(([key, name]) => {
        const pillar = report.pillars[key];
        const summary = irc?.pillars?.[key];
        const deep = reasoning?.reasoning?.pillars?.find((p) => p.name === key);
        if (!pillar)
          return (
            <ReaderSection key={key} id={`pillar-${key}`} title={name}>
              <p className="text-mask-ink text-sm">Data gap: no record for this pillar.</p>
            </ReaderSection>
          );
        const issues = [...(summary?.limitations ?? []), ...(deep?.limitations ?? []), ...pillar.quality_issues];
        const questions = [...(summary?.questions ?? []), ...(deep?.questions ?? [])];
        return (
          <ReaderSection
            key={key}
            id={`pillar-${key}`}
            title={name}
            aside={<PillarStatus status={pillar.status} />}
          >
            <Card className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="text-muted text-[13px] font-semibold">Insight</h3>
                  <p className="mt-1">{summary?.insight?.text || pillar.summary || 'Insight pending.'}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="text-muted text-[13px] font-semibold">Reasoning</h3>
                  <p className="mt-1">{summary?.reasoning?.text || 'Reasoning pending.'}</p>
                </div>
              </div>
              {pillar.series.map((series) => (
                <SeriesChart key={series.id} series={series} />
              ))}
              {(deep?.analysis?.length || pillar.measurements.length || pillar.claims.length) ? (
                <Disclosure summary="Full analysis, measurements and claims">
                  <div className="space-y-4">
                    {deep?.analysis?.map((item, i) => (
                      <div key={i}>
                        <p className="max-w-[68ch]">{item.text}</p>
                        <EvidenceChips ids={item.evidence_ids} />
                      </div>
                    ))}
                    {pillar.measurements.map((m) => (
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
                        <EvidenceChips ids={m.evidence_ids} />
                      </div>
                    ))}
                    {pillar.claims.map((c) => (
                      <div key={c.id} className="border-line rounded-lg border p-3 text-sm">
                        <p className="font-semibold">
                          {c.id} · {c.kind}
                        </p>
                        <p className="mt-1">{c.statement}</p>
                        <p className="text-muted mt-2">Supporting evidence</p>
                        <EvidenceChips ids={c.supporting_evidence_ids} />
                        <p className="text-muted mt-2">Counterevidence</p>
                        {c.counterevidence_ids.length ? (
                          <EvidenceChips ids={c.counterevidence_ids} />
                        ) : (
                          <p className="text-muted">None supplied.</p>
                        )}
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
                    ))}
                  </div>
                </Disclosure>
              ) : null}
              {(issues.length > 0 || questions.length > 0) && (
                <Disclosure summary={`Quality issues and open questions (${issues.length + questions.length})`}>
                  <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
                    {issues.map((item, i) => (
                      <li key={`l${i}`}>Limitation: {item}</li>
                    ))}
                    {questions.map((item, i) => (
                      <li key={`q${i}`}>Open question: {item}</li>
                    ))}
                  </ul>
                </Disclosure>
              )}
              <div>
                <h3 className="text-muted text-[13px] font-semibold">Evidence cited</h3>
                {(summary?.citations?.evidence_ids ?? pillar.evidence_ids).length ? (
                  <EvidenceChips ids={summary?.citations?.evidence_ids ?? pillar.evidence_ids} />
                ) : (
                  <p className="text-muted text-sm">None supplied.</p>
                )}
              </div>
            </Card>
          </ReaderSection>
        );
      })}

      <ReaderSection id="evidence" title="Evidence">
        <EvidenceTable
          rows={report.evidence.map((source) => ({
            id: source.id,
            kind: source.kind,
            coverage: source.coverage,
            observed: (
              <>
                Observed {source.observed_at ?? 'unknown'}
                <br />
                fetched {source.fetched_at ?? 'unknown'}
              </>
            ),
            details: (
              <>
                <p>
                  File <code className="num">{source.path}</code>
                </p>
                <p>
                  SHA-256 <code className="num break-all">{source.sha256}</code>
                </p>
                {source.limitations?.map((x, i) => (
                  <p key={i}>Limitation: {x}</p>
                ))}
                <EvidenceDownload source={source} assetBase={assetBase} />
              </>
            ),
          }))}
        />
      </ReaderSection>

      {limitations.length > 0 && (
        <ReaderSection id="limitations" title="Limitations">
          <ul className="text-muted max-w-[68ch] list-disc space-y-1 pl-5 text-[15px]">
            {[...new Set(limitations)].map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </ReaderSection>
      )}
    </ReaderShell>
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
function EvidenceDownload({
  source,
  assetBase,
}: {
  source: NativeReport['report']['evidence'][number];
  assetBase: string;
}) {
  const [error, setError] = useState(false);
  async function download() {
    try {
      setError(false);
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
    <p>
      <button type="button" onClick={download} className="text-beam-ink underline">
        Download verified evidence
      </button>
      {error && <span role="alert"> Evidence unavailable or digest mismatch.</span>}
    </p>
  );
}
function SeriesChart({
  series,
}: {
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
    <div className="border-line min-w-0 rounded-xl border p-4">
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
      <EvidenceChips ids={series.evidence_ids} />
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
