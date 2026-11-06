'use client';

import { useQuery } from '@tanstack/react-query';
import { Banner } from '@/components/Banner';
import { referenceApi, type ReferenceMetadata } from '@/lib/referenceApi';
import {
  RECONSTRUCTION_SAMPLE,
  formatUsd,
  horizonLabel,
  metricsAgree,
  parseGraphManifest,
  parseReconstructions,
  parseRunManifest,
  parseTokenDaily,
  parseVarMetrics,
  utcStamp,
  type DayPoint,
  type GraphManifest,
  type ReconstructionRow,
  type RunManifest,
  type VarMetrics,
} from '@/lib/referenceData';
import { LineChart, type ChartSeries } from './LineChart';
import { ErrorState } from './ReaderStates';

export type Loaded<T> =
  | { state: 'loading'; data?: undefined; error?: undefined }
  | { state: 'missing'; data?: undefined; error?: undefined }
  | { state: 'error'; data?: undefined; error: unknown }
  | { state: 'ok'; data: T; error?: undefined };

export const FILES = {
  graphManifest: 'evidence/graph/manifest.json',
  tokenDaily: 'evidence/graph/token_daily.json',
  legacyMetrics: 'evidence/legacy_metrics.json',
  reconstructions: 'evidence/legacy_reconstructions.csv',
  riskMetrics: 'evidence/graph_model/risk-metrics.json',
  runManifest: 'evidence/graph_model/run-manifest.json',
} as const;

/** One listed file, fetched with the report's session, hash-checked and parsed. Unlisted files are a data gap. */
export function useVerified<T>(
  meta: ReferenceMetadata,
  path: string,
  parse: (text: string) => T,
): Loaded<T> {
  const listed = !!meta.files[path];
  const q = useQuery({
    queryKey: ['reference-file', meta.report_id, meta.report_version, path, meta.files[path]],
    queryFn: async () => parse((await referenceApi.file(meta, path)).text),
    enabled: listed,
    retry: false,
    staleTime: Infinity,
  });
  if (!listed) return { state: 'missing' };
  if (q.isError) return { state: 'error', error: q.error };
  if (q.data === undefined) return { state: 'loading' };
  return { state: 'ok', data: q.data };
}

const Checking = ({ what }: { what: string }) => (
  <p className="text-muted text-sm" role="status">
    Checking {what}…
  </p>
);

// ---------------------------------------------------------------- Graph daily price

export function PriceSection({ meta }: { meta: ReferenceMetadata }) {
  const manifest = useVerified(meta, FILES.graphManifest, parseGraphManifest);
  const recorded = meta.files[FILES.tokenDaily];
  const rows = useQuery({
    queryKey: [
      'reference-price',
      meta.report_id,
      meta.report_version,
      recorded,
      manifest.data?.raw_sha256,
    ],
    enabled: manifest.state === 'ok' && !!recorded,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const m = manifest.data!;
      const file = await referenceApi.file(meta, FILES.tokenDaily);
      return parseTokenDaily(file.text, m);
    },
  });
  if (!recorded || manifest.state === 'missing')
    return (
      <p className="text-mask-ink text-sm">
        Data gap: no Graph daily price history in this report.
      </p>
    );
  if (manifest.state === 'error')
    return <ErrorState error={manifest.error} what="Graph source manifest" />;
  if (manifest.state === 'loading') return <Checking what="the Graph source manifest" />;
  if (manifest.data.raw_sha256 !== recorded)
    return (
      <Banner tone="danger" title="Price chart: integrity unavailable">
        The daily price file does not match the hash recorded in its Graph source manifest, so it is
        not charted.
      </Banner>
    );
  if (rows.isError) return <ErrorState error={rows.error} what="Daily price history" />;
  if (!rows.data) return <Checking what="the daily price history" />;
  return <PriceView manifest={manifest.data} points={rows.data} />;
}

export function PriceView({ manifest, points }: { manifest: GraphManifest; points: DayPoint[] }) {
  const series: ChartSeries[] = [
    { key: 'price', label: 'Daily price', color: 'var(--series-1)', points },
  ];
  return (
    <section
      aria-label="Historical daily price"
      className="border-line space-y-3 rounded-xl border p-4"
    >
      <LineChart
        title={`Daily price (${manifest.price_units}), historical`}
        description={`${manifest.source}, field ${manifest.price_field}; one value per UTC day as captured. Token-level subgraph data, not a selected-pool candle or an executable quote. Missing dates are not filled.`}
        series={series}
        format={formatUsd}
        valueHeading={`${manifest.price_field} (USD)`}
      />
      <dl className="text-muted grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        <dt>Source</dt>
        <dd>
          {manifest.source}
          {manifest.chain ? ` · ${manifest.chain}` : ''}
        </dd>
        <dt>Subgraph</dt>
        <dd className="num">{manifest.subgraph_id ?? 'not supplied'}</dd>
        <dt>Window (UTC)</dt>
        <dd className="num">
          {manifest.start_inclusive_utc} (inclusive) to {manifest.end_exclusive_utc} (exclusive)
        </dd>
        <dt>Captured</dt>
        <dd>{utcStamp(manifest.fetched_at_utc)}</dd>
        <dt>Rows</dt>
        <dd>
          {points.length} daily values · {manifest.missing_utc_dates.length} missing UTC dates
          reported
          {manifest.missing_utc_dates.length ? `: ${manifest.missing_utc_dates.join(', ')}` : ''}
        </dd>
      </dl>
      {manifest.notes.length > 0 && (
        <ul className="text-muted list-disc pl-5 text-xs">
          {manifest.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- VAE reconstructions and VaR

const SERIES_STYLE = [
  { color: 'var(--series-1)', dash: undefined },
  { color: 'var(--series-2)', dash: '6 3' },
  { color: 'var(--series-3)', dash: '2 3' },
  { color: 'var(--series-4)', dash: '10 3 2 3' },
  { color: 'var(--series-5)', dash: '1 2' },
];

export function VaeSection({ meta }: { meta: ReferenceMetadata }) {
  const metrics = useVerified(meta, FILES.legacyMetrics, parseVarMetrics);
  const riskAgrees = useVerified(meta, FILES.riskMetrics, (t) => t);
  const run = useVerified(meta, FILES.runManifest, parseRunManifest);
  const recon = useVerified(meta, FILES.reconstructions, (t) => parseReconstructions(t));
  if (metrics.state === 'missing' && recon.state === 'missing')
    return <p className="text-mask-ink text-sm">Data gap: no VAE output in this report.</p>;
  const agree =
    metrics.state === 'ok' && riskAgrees.state === 'ok'
      ? safeAgree(metrics.data, riskAgrees.data)
      : null;
  return (
    <VaeView
      metrics={metrics}
      agree={agree}
      run={run}
      recon={recon}
      reconstructionsSha={meta.files[FILES.reconstructions] ?? null}
    />
  );
}
function safeAgree(m: VarMetrics, text: string): boolean {
  try {
    return metricsAgree(m, text);
  } catch {
    return false;
  }
}

export const VAE_LABELS = [
  'Historical',
  'In-sample',
  'Unseeded',
  'Uncalibrated',
  'Not backtested',
  'Not a maximum loss',
] as const;

export function VaeView({
  metrics,
  agree,
  run,
  recon,
  reconstructionsSha,
}: {
  metrics: Loaded<VarMetrics>;
  /** null: risk-metrics.json not available to cross-check. */
  agree: boolean | null;
  run: Loaded<RunManifest>;
  recon: Loaded<ReconstructionRow[]>;
  reconstructionsSha: string | null;
}) {
  const m = metrics.data;
  const r = run.data;
  const unseeded = r?.randomness ? /unseeded/i.test(r.randomness) : null;
  const labels = [
    ...VAE_LABELS.filter((l) => l !== 'Unseeded' || unseeded !== false),
    ...(m ? [horizonLabel(m.time_horizon_days)] : []),
  ];
  return (
    <section
      aria-label="Original VAE output"
      className="border-line space-y-4 rounded-xl border p-4"
    >
      <div>
        <h3 className="font-semibold">Original VAE output (historical example)</h3>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Model limitations">
          {labels.map((l) => (
            <li
              key={l}
              className="border-line rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </li>
          ))}
        </ul>
        <p className="text-muted mt-2 text-sm">
          A legacy variational-autoencoder run on this token’s own captured history (in-sample).
          Training was
          {unseeded === false ? ' ' : ' unseeded, '}not backtested and not calibrated. VaR below is
          a model statistic on the original percent scale; it is not a forecast, not a loss bound
          and not a maximum loss.
          {unseeded === null ? ' The run manifest does not record its seeding.' : ''}
        </p>
      </div>

      {metrics.state === 'error' ? (
        <ErrorState error={metrics.error} what="VAE metrics" />
      ) : metrics.state === 'missing' ? (
        <p className="text-mask-ink text-sm">Data gap: VAE metrics not in this report.</p>
      ) : !m ? (
        <Checking what="the VAE metrics" />
      ) : agree === false ? (
        <Banner tone="danger" title="VAE metrics: integrity unavailable">
          legacy_metrics.json and graph_model/risk-metrics.json disagree, so neither is shown.
        </Banner>
      ) : (
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          {(
            [
              ['VaR 90%', m.var_90],
              ['VaR 95%', m.var_95],
              ['VaR 99%', m.var_99],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="bg-surface-raised rounded-lg p-3">
              <dt className="text-muted text-xs">
                {k}, {horizonLabel(m.time_horizon_days)}
              </dt>
              <dd className="num text-xl font-semibold">{v}%</dd>
              <dd className="text-muted text-xs">original percent scale</dd>
            </div>
          ))}
          <div className="text-muted text-xs min-[420px]:col-span-3">
            Confidence level {m.confidence_level} · {m.number_of_recreations} reconstructions
            {m.data_points !== null ? ` · ${m.data_points} daily returns` : ''}
            {agree === null
              ? ' · not cross-checked against graph_model/risk-metrics.json'
              : ' · matches graph_model/risk-metrics.json'}
            . The legacy risk score, risk label, expected shortfall and “max drawdown” fields are
            not shown: their interpretation is not validated.
          </div>
        </dl>
      )}

      {r && (
        <p className="text-muted text-xs">
          Run manifest: {r.source ?? 'source not supplied'} · {r.returns ?? '?'} returns ·{' '}
          {r.reconstructions ?? '?'} reconstructions · confidence {r.confidence ?? '?'} ·{' '}
          {r.days ?? '?'} days · randomness: {r.randomness ?? 'not recorded'}
          {r.scope ? ` · ${r.scope}` : ''}
        </p>
      )}
      {run.state === 'error' && <ErrorState error={run.error} what="VAE run manifest" />}

      {recon.state === 'error' ? (
        <ErrorState error={recon.error} what="Reconstructions" />
      ) : recon.state === 'missing' ? (
        <p className="text-mask-ink text-sm">Data gap: reconstruction series not in this report.</p>
      ) : !recon.data ? (
        <Checking what="the reconstruction series" />
      ) : (
        <>
          {r?.reconstructions_sha256 &&
            reconstructionsSha &&
            r.reconstructions_sha256 !== reconstructionsSha && (
              <Banner tone="warning" title="Reconstruction file differs from the run manifest">
                The plotted file is not the one the run manifest records.
              </Banner>
            )}
          <ReconstructionChart rows={recon.data} />
        </>
      )}
    </section>
  );
}

/** Five fixed reconstructions of 50, plotted as daily returns in percent (fraction × 100), unsmoothed. */
export function reconstructionSeries(rows: ReconstructionRow[]): ChartSeries[] {
  return RECONSTRUCTION_SAMPLE.map((col, j) => ({
    key: `r${col + 1}`,
    label: `Reconstruction ${col + 1}`,
    ...SERIES_STYLE[j],
    points: rows.map((row) => ({ t: row.t, value: row.values[col] * 100 })),
  }));
}

export function ReconstructionChart({ rows }: { rows: ReconstructionRow[] }) {
  const pct = (v: number) => `${Number(v.toFixed(3))}%`;
  return (
    <LineChart
      title={`Five of ${rows[0]?.values.length ?? 50} reconstructed daily-return series (historical, in-sample)`}
      description="Fixed examples 1, 13, 25, 37 and 50, chosen by position, not by value. Each is a model reconstruction of past daily returns, not observed returns and not a future price path. Fractions are multiplied by 100; dates are UTC calendar days."
      series={reconstructionSeries(rows)}
      format={pct}
      tableFormat={(v) => `${Number(v.toPrecision(12))}%`}
      valueHeading="Daily return (%)"
      includeZero
    />
  );
}
