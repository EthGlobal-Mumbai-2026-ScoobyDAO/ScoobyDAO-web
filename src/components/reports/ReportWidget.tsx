'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadNativeReport, PILLARS, type NativeReport } from '@/lib/report-widget';
import { verifyAsset, type ReportEntry } from '@/lib/reports';
import { reportMath } from '@/lib/report-math';
import { parseReconstructions } from '@/lib/reconstructions';

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
    <section className="mt-8 min-w-0 [overflow-wrap:anywhere]" aria-labelledby="research-heading">
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
        <EvidenceMath report={report} pillar={key} assetBase={assetBase} onSelect={setEvidenceId} />
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
            {key === 'statistical_risk' &&
              pillar.claims.some(
                (c) =>
                  c.id === 'legacy-risk_assessment-interpretation' ||
                  c.id === 'legacy-risk_assessment-risk_level',
              ) && (
                <p className="text-muted text-sm">
                  The original risk label and loss interpretation are available in the source
                  evidence. They are uncalibrated and do not establish a maximum loss.
                </p>
              )}
            {pillar.claims.length ? (
              pillar.claims
                .filter(
                  (c) =>
                    key !== 'statistical_risk' ||
                    ![
                      'legacy-risk_assessment-interpretation',
                      'legacy-risk_assessment-risk_level',
                    ].includes(c.id),
                )
                .map((c) => (
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
function EvidenceMath({
  report,
  pillar,
  assetBase,
  onSelect,
}: {
  report: NativeReport['report'];
  pillar: string;
  assetBase: string;
  onSelect: (id: string) => void;
}) {
  const math = reportMath(report);
  const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const usd = (value: number) =>
    Math.abs(value) < 0.0001 && value !== 0
      ? `$${value.toPrecision(5)}`
      : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const day = (value: string) => new Date(value).toISOString().slice(0, 10);
  const fetched = (id: string) => report.evidence.find((item) => item.id === id)?.fetched_at;
  const stamp = (id: string) => {
    const value = fetched(id);
    return value && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
      : 'time not supplied';
  };
  if (
    pillar === 'statistical_risk' &&
    report.evidence.some((e) => e.id === 'graph_model_risk') &&
    report.evidence.some((e) => e.id === 'graph_model_reconstructions')
  ) {
    const values = report.pillars.statistical_risk.measurements;
    const read = (id: string) =>
      values.find(
        (m) =>
          m.id === id &&
          m.evidence_ids.includes('legacy_metrics') &&
          typeof m.value === 'number' &&
          Number.isFinite(m.value),
      );
    const risk = read('legacy_var_metrics_var_95');
    const horizon = read('legacy_var_metrics_time_horizon_days');
    const confidence = read('legacy_var_metrics_confidence_level');
    const reconstructions = read('legacy_vae_specific_metrics_number_of_recreations');
    if (
      risk &&
      horizon?.value === 4 &&
      confidence?.value === 0.95 &&
      reconstructions?.value === 50 &&
      typeof risk.value === 'number'
    )
      return (
        <section
          className="border-line mt-6 rounded-xl border p-4"
          aria-label="Historical VAE risk output"
        >
          <h4 className="font-semibold">Original VAE output · historical example</h4>
          <p className="mt-2 text-sm">
            Reported 95% VaR: <strong>{risk.value}%</strong> over a{' '}
            <strong>four-day horizon</strong>, from <strong>50 reconstructions</strong>.
          </p>
          <p className="text-muted mt-2 text-sm">
            An in-sample model estimate, not a calibrated forecast, guaranteed maximum loss, or
            evidence of fraud. Graph inputs describe indexed token-level USD data, not an executable
            pool quote. The original legacy “max drawdown” field is the minimum reconstructed daily
            return, not peak-to-trough drawdown.
          </p>
          <CitationLinks
            ids={[
              'legacy_metrics',
              'graph_model_risk',
              'graph_model_manifest',
              'graph_model_reconstructions',
            ]}
            onSelect={onSelect}
          />
          <ReconstructionChart
            source={report.evidence.find((e) => e.id === 'graph_model_reconstructions')}
            assetBase={assetBase}
          />
        </section>
      );
  }
  if (
    pillar === 'microstructure' &&
    (numeric(math.liquidity?.value) || numeric(math.volume?.value))
  ) {
    return (
      <section className="border-line mt-6 rounded-xl border p-4" aria-label="Pool figures">
        <h4 className="font-semibold">What the pool snapshot shows</h4>
        <p className="text-muted mt-1 text-sm">
          Historical provider data; this is not a current executable quote.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {numeric(math.liquidity?.value) && (
            <li>
              Reported pool liquidity value:{' '}
              <strong>
                {usd(
                  typeof math.displayLiquidity === 'number'
                    ? math.displayLiquidity
                    : math.liquidity.value,
                )}
              </strong>
              . {math.liquidity.method || 'Method not supplied.'} Sources fetched:{' '}
              {math.liquidity.evidence_ids.map((id) => `${id}: ${stamp(id)}`).join(' · ') ||
                'unknown'}
              .
              <CitationLinks ids={math.liquidity.evidence_ids} onSelect={onSelect} />
            </li>
          )}
          {numeric(math.volume?.value) && (
            <li>
              Reported 24-hour pool volume: <strong>{usd(math.volume.value)}</strong>.{' '}
              {math.volume.method || 'Method not supplied.'} Sources fetched:{' '}
              {math.volume.evidence_ids.map((id) => `${id}: ${stamp(id)}`).join(' · ') || 'unknown'}
              .
              <CitationLinks ids={math.volume.evidence_ids} onSelect={onSelect} />
            </li>
          )}
        </ul>
        <p className="text-muted mt-3 text-sm">
          These figures cannot calculate the price impact of a trade. That requires current
          reserves, the intended trade size, fees and route; other pools may differ.
        </p>
      </section>
    );
  }
  if (pillar === 'onchain' && math.holders.length) {
    return (
      <section
        className="border-line mt-6 rounded-xl border p-4"
        aria-label="Reported holder fractions"
      >
        <h4 className="font-semibold">Reported token supply distribution</h4>
        <p className="text-muted mt-1 text-sm">
          Security provider snapshot fetched {stamp('security')}. Percentages below are the
          provider&apos;s supply fractions multiplied by 100.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {math.holders.slice(0, 3).map((holder) => (
            <li key={holder.address}>
              <span className="break-all">{holder.address}</span>:{' '}
              <strong>{holder.percent.toFixed(2)}%</strong>{' '}
              {!holder.projected && '(display calculation)'}
              {holder.statement.includes('tag = UniswapV2')
                ? ' (provider labels this a Uniswap V2 pool)'
                : ''}
              {holder.address.toLowerCase() === '0x000000000000000000000000000000000000dead'
                ? ' (dead address)'
                : ''}
              <CitationLinks ids={holder.evidenceIds} onSelect={onSelect} />
            </li>
          ))}
        </ul>
        <p className="text-muted mt-3 text-sm">
          These are token-supply shares, not LP-token ownership. A pool or dead address should not
          be described as an individual holder; the labels and control are not independently
          verified.
        </p>
      </section>
    );
  }
  if (pillar === 'statistical_risk' && report.pillars.statistical_risk.status === 'unavailable') {
    return (
      <section
        className="border-line mt-6 rounded-xl border p-4"
        aria-label="Why VaR is unavailable"
      >
        <h4 className="font-semibold">VaR was not calculated</h4>
        {math.closeCount > 0 ? (
          <p className="mt-2 text-sm">
            The supplied history contains{' '}
            <strong>{math.closeCount} dated price observations</strong> and{' '}
            <strong>
              {math.adjacentReturns} adjacent-day{' '}
              {math.adjacentReturns === 1 ? 'return' : 'returns'}
            </strong>
            . This is not a completed, identity-bound VAE run.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            No usable historical price series is supplied in this report.
          </p>
        )}
        <p className="text-muted mt-2 text-sm">
          This legacy VAE-based VaR requires a defined horizon, adequate validated return history
          and an actual model run. These counts alone do not establish a sufficient sample, and the
          available evidence does not support a numerical risk estimate.
        </p>
        <CitationLinks ids={math.closes?.evidence_ids ?? []} onSelect={onSelect} />
      </section>
    );
  }
  if (
    pillar === 'technical_health' &&
    math.first &&
    math.last &&
    math.endpointChange !== null &&
    ['USD', 'USD per token'].includes(math.closes?.unit ?? '')
  ) {
    return (
      <section
        className="border-line mt-6 rounded-xl border p-4"
        aria-label="Observed price calculation"
      >
        <h4 className="font-semibold">Observed prices: calculation and coverage</h4>
        <p className="text-muted mt-1 text-sm">
          Source method: {math.closes?.method ?? 'not supplied'}.
        </p>
        <p className="mt-2 text-sm">
          First: <strong>{usd(math.first.value)}</strong> on {day(math.first.time)}. Last:{' '}
          <strong>{usd(math.last.value)}</strong> on {day(math.last.time)}.
        </p>
        <p className="mt-2 text-sm">
          Endpoint change = (last close ÷ first close − 1) × 100 = approximately{' '}
          <strong>{math.endpointChange.toFixed(2)}%</strong>, using the supplied endpoint
          measurement when available.
        </p>
        <p className="text-muted mt-2 text-sm">
          The series has {math.closeCount} supplied closes and {math.adjacentReturns} adjacent-day{' '}
          {math.adjacentReturns === 1 ? 'return' : 'returns'}.
          {math.gapIntervals !== null && (
            <>
              {' '}
              The producer reported {math.gapIntervals} gap intervals between observed dates; this
              is not a count of missing days.
            </>
          )}{' '}
          An endpoint comparison is not a daily return, a continuous trend, or a current executable
          price; dates between observations may be missing.
        </p>
        <CitationLinks ids={math.closes?.evidence_ids ?? []} onSelect={onSelect} />
      </section>
    );
  }
  return null;
}
function ReconstructionChart({
  source,
  assetBase,
}: {
  source: NativeReport['report']['evidence'][number] | undefined;
  assetBase: string;
}) {
  const [open, setOpen] = useState(false);
  const data = useQuery({
    queryKey: ['vae-reconstructions', assetBase, source?.sha256],
    enabled: open && !!source,
    retry: false,
    queryFn: async () =>
      parseReconstructions(
        await (await verifyAsset({ url: assetBase + source!.path, sha256: source!.sha256 })).text(),
      ),
  });
  const rows = data.data;
  const indices = [0, 12, 24, 36, 49];
  const values = rows?.flatMap((row) => indices.map((i) => row.values[i] * 100)) ?? [];
  const min = Math.min(...values),
    max = Math.max(...values);
  const first = rows ? Date.parse(rows[0].day + 'T00:00:00Z') : 0;
  const last = rows ? Date.parse(rows[rows.length - 1].day + 'T00:00:00Z') : 0;
  return (
    <div className="border-line mt-4 border-t pt-4">
      <button
        type="button"
        className="text-beam-ink text-sm font-semibold underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide reconstruction chart' : 'Show reconstruction chart'}
      </button>
      {open && data.isPending && (
        <p role="status" className="mt-2 text-sm">
          Checking reconstruction evidence…
        </p>
      )}
      {open && data.isError && (
        <p role="alert" className="mt-2 text-sm">
          Reconstruction evidence is unavailable, invalid or did not match its hash.
        </p>
      )}
      {open && rows && (
        <div className="mt-3">
          <p className="text-sm font-semibold">
            Five of 50 original reconstructed daily-return series
          </p>
          <p className="text-muted mt-1 text-xs">
            Fixed examples 1, 13, 25, 37 and 50; each is a model reconstruction, not observed
            returns or a future price path. Simple-return fractions are multiplied by 100 for this
            chart.
          </p>
          <svg
            viewBox="0 0 600 180"
            role="img"
            aria-label={`Five original reconstructed daily-return series, ${rows.length} dates, shown as percentages`}
            className="mt-3 h-auto w-full"
          >
            <line x1="40" y1="145" x2="570" y2="145" stroke="currentColor" opacity=".4" />
            {indices.map((index, j) => (
              <path
                key={index}
                fill="none"
                stroke={['#f9c74f', '#4ecdc4', '#f9844a', '#8ab4f8', '#ce93d8'][j]}
                strokeWidth="1.5"
                opacity=".8"
                d={rows
                  .map((row, i) => {
                    const t = Date.parse(row.day + 'T00:00:00Z');
                    const x = 40 + (last === first ? 265 : ((t - first) / (last - first)) * 530);
                    const y =
                      145 -
                      (max === min ? 55 : ((row.values[index] * 100 - min) / (max - min)) * 110);
                    const previous = i ? Date.parse(rows[i - 1].day + 'T00:00:00Z') : 0;
                    return `${i && t - previous === 86400000 ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
                  })
                  .join(' ')}
              />
            ))}
          </svg>
          <p className="text-muted text-xs">
            Vertical scale {min.toFixed(2)}% to {max.toFixed(2)}%; horizontal scale {rows[0].day} to{' '}
            {rows[rows.length - 1].day} (supplied calendar dates). Gaps are not filled. The original
            file and all 50 series are available through the reconstruction evidence link above.
          </p>
        </div>
      )}
    </div>
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
            {[
              'legacy-risk_assessment-interpretation',
              'legacy-risk_assessment-risk_level',
            ].includes(id) && (
              <p className="text-muted mt-1">
                Original model text is uncalibrated and does not establish a maximum loss.
              </p>
            )}
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
  const legacyDates = series.id.startsWith('legacy_');
  const points = series.points
    .map((p) => ({
      ...p,
      time:
        (/^graph_token_daily_(?:price_usd|returns)$/.test(series.id) &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.time)) ||
        (legacyDates && /^\d{4}-\d{2}-\d{2}T00:00:00$/.test(p.time))
          ? `${p.time.slice(0, 10)}T00:00:00Z`
          : p.time,
    }))
    .filter(
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
  const axisValue = (v: number) =>
    Math.abs(v) < 0.0001 && v !== 0
      ? v.toExponential(3)
      : Number(v.toPrecision(5)).toLocaleString('en-US');
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
            Vertical scale: {axisValue(minV)} to {axisValue(maxV)} {series.unit ?? '(unit unknown)'}
            . Horizontal scale: {new Date(minT).toISOString().slice(0, 10)} to{' '}
            {new Date(maxT).toISOString().slice(0, 10)}{' '}
            {legacyDates ? '(supplied calendar dates; timezone not specified)' : 'UTC'}. Observed
            points only; gaps are not filled or connected.
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
