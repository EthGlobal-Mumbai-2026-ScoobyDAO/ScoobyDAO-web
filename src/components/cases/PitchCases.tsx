'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { defaultReportAdapter, verifyAsset, type ReportEntry } from '@/lib/reports';
import { loadNativeReport, type NativeReport } from '@/lib/report-widget';
import { reportMath } from '@/lib/report-math';

type Example = {
  entry: ReportEntry;
  data: NativeReport;
  pool: { name: string; address: string } | null;
};
type PoolRow = {
  attributes?: {
    address?: unknown;
    name?: unknown;
    reserve_in_usd?: unknown;
    volume_usd?: { h24?: unknown };
  };
  relationships?: {
    base_token?: { data?: { id?: unknown } };
    quote_token?: { data?: { id?: unknown } };
  };
};

async function matchedPool(data: NativeReport): Promise<Example['pool']> {
  const source = data.report.evidence.find((e) => e.id === 'pools');
  const m = reportMath(data.report);
  if (!source || typeof m.liquidity?.value !== 'number' || typeof m.volume?.value !== 'number')
    return null;
  try {
    const raw: unknown = JSON.parse(
      await (
        await verifyAsset({ url: data.assetBase + source.path, sha256: source.sha256 })
      ).text(),
    );
    if (!raw || typeof raw !== 'object' || !('data' in raw) || !Array.isArray(raw.data))
      return null;
    const token = data.report.candidate_id.toLowerCase().split(':').pop();
    const rows = (raw.data as PoolRow[]).filter(
      (row) =>
        row?.attributes &&
        typeof row.attributes.address === 'string' &&
        /^0x[0-9a-f]{40}$/i.test(row.attributes.address) &&
        typeof row.attributes.name === 'string' &&
        typeof row.attributes.reserve_in_usd === 'string' &&
        row.attributes.reserve_in_usd.trim() !== '' &&
        Number(row.attributes.reserve_in_usd) === m.liquidity?.value &&
        typeof row.attributes.volume_usd?.h24 === 'string' &&
        row.attributes.volume_usd.h24.trim() !== '' &&
        Number(row.attributes.volume_usd.h24) === m.volume?.value &&
        [row.relationships?.base_token?.data?.id, row.relationships?.quote_token?.data?.id].some(
          (id) => typeof id === 'string' && id.toLowerCase().endsWith('_' + token),
        ),
    );
    const item = rows[0]?.attributes;
    return rows.length === 1 && typeof item?.name === 'string' && typeof item.address === 'string'
      ? { name: item.name, address: item.address }
      : null;
  } catch {
    return null;
  }
}

/** Local pitch preview: these are historical research examples, not live scout decisions. */
export function PitchCases() {
  const local = useSyncExternalStore(
    () => () => {},
    () => ['localhost', '127.0.0.1'].includes(window.location.hostname),
    () => false,
  );
  if (process.env.NEXT_PUBLIC_LOCAL_PITCH_EXAMPLES !== 'true' || !local) return null;
  return <LocalPitchCases />;
}

function LocalPitchCases() {
  const [maximumLiquidity, setMaximumLiquidity] = useState('');
  const query = useQuery({
    queryKey: ['local-pitch-examples'],
    retry: false,
    queryFn: async () => {
      const all = await defaultReportAdapter.list();
      const wanted = [
        'case-diagnostic_bliss',
        'case-diagnostic_ase',
        'case-diagnostic_ftt',
        'case-diagnostic_hex',
        'case-diagnostic_wrapped_ust',
        'case-diagnostic_rbif',
        'case-diagnostic_hydro_old',
      ];
      const entries = wanted.flatMap((id) => {
        const entry = all.find(
          (item) => item.reportId === id && item.diagnostic && !item.listUnavailable,
        );
        return entry ? [entry] : [];
      });
      const results = await Promise.allSettled(
        entries.map(async (entry): Promise<Example> => {
          const data = await loadNativeReport(entry);
          return { entry, data, pool: await matchedPool(data) };
        }),
      );
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    },
  });
  if (query.isPending)
    return (
      <p className="text-muted mt-6 text-sm" role="status">
        Loading historical pitch examples…
      </p>
    );
  if (query.isError || !query.data?.length)
    return (
      <p className="text-muted mt-6 text-sm" role="status">
        Historical pitch examples are unavailable from the configured report service.
      </p>
    );
  const entered = maximumLiquidity.trim();
  const maximum = entered === '' ? null : Number(entered);
  const invalid = maximum !== null && (!Number.isFinite(maximum) || maximum < 0);
  const shown = invalid
    ? []
    : query.data.filter(({ data }) => {
        if (maximum === null) return true;
        const liquidity = reportMath(data.report).liquidity?.value;
        return typeof liquidity === 'number' && Number.isFinite(liquidity) && liquidity <= maximum;
      });
  return (
    <section className="mt-8" aria-label="Historical pitch examples">
      <p className="text-beam-ink text-xs font-semibold uppercase">
        Pitch demo · historical examples
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Examples ready to explore</h2>
      <p className="text-muted mt-2 max-w-3xl text-sm">
        Local-only curated research snapshots. They are not live scout results, case admissions,
        World ID approvals or current trading signals. Only reports returned by the configured
        service are shown.
      </p>
      <label className="mt-4 block max-w-xs text-sm font-semibold">
        Maximum historical pool liquidity (USD)
        <input
          type="number"
          min="0"
          step="any"
          value={maximumLiquidity}
          onChange={(event) => setMaximumLiquidity(event.target.value)}
          placeholder="All available values"
          className="border-line bg-surface mt-2 w-full rounded-lg border px-3 py-2 font-normal"
        />
      </label>
      <p className="text-muted mt-2 text-xs">
        Filters these historical examples only; missing liquidity is excluded when a limit is set.
        The proposed scout requirement is at least ₹1 crore in 30-day volume, but these reports do
        not contain a validated 30-day INR total. A volatility filter also requires a comparable
        validated measure.
      </p>
      {invalid && (
        <p role="alert" className="mt-2 text-sm">
          Enter a non-negative number.
        </p>
      )}
      {!invalid && shown.length === 0 && (
        <p role="status" className="mt-3 text-sm">
          No historical examples match this liquidity limit.
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {shown.map(({ entry, data, pool }) => {
          const m = reportMath(data.report);
          const liquidity = typeof m.displayLiquidity === 'number' ? m.displayLiquidity : null;
          const volume = typeof m.volume?.value === 'number' ? m.volume.value : null;
          const poolEvidence = data.report.evidence.find((source) => source.id === 'pools');
          const captured =
            poolEvidence?.fetched_at && Number.isFinite(Date.parse(poolEvidence.fetched_at))
              ? new Date(poolEvidence.fetched_at).toISOString().replace('T', ' ').slice(0, 19) +
                ' UTC'
              : 'date unavailable';
          const observed =
            poolEvidence?.observed_at && Number.isFinite(Date.parse(poolEvidence.observed_at))
              ? new Date(poolEvidence.observed_at).toISOString().replace('T', ' ').slice(0, 19) +
                ' UTC'
              : 'not supplied';
          return (
            <article key={entry.id} className="border-line bg-surface rounded-xl border p-5">
              <p className="text-mask-ink text-xs font-semibold uppercase">
                Historical diagnostic · review not established here
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                {entry.title.replace(/ research report$/, '')}
              </h3>
              <p className="text-muted mt-1 text-xs break-all">{entry.candidateId}</p>
              <p className="mt-3 text-sm">
                {data.irc?.pillars?.microstructure?.insight?.text ??
                  data.report.pillars.microstructure.summary}
              </p>
              {liquidity !== null && volume !== null && (
                <p className="mt-3 text-sm">
                  Selected-pool reserve: <strong>${liquidity.toFixed(2)}</strong> · reported 24h
                  volume: <strong>${volume.toFixed(2)}</strong>
                </p>
              )}
              <p className="text-muted mt-2 text-xs break-all">
                {pool
                  ? `Matched pool: ${pool.name} · ${pool.address}`
                  : 'Pool identity unavailable.'}{' '}
                Provider-reported figures are unvalidated and describe this pool only.
              </p>
              <p className="text-muted mt-2 text-xs">
                30-day ₹1 crore screen: not assessed; 24-hour volume is not a 30-day total.
              </p>
              <p className="text-muted mt-2 text-xs">
                Pool snapshot fetched {captured}; observation time {observed}. Historical data; no
                current execution test.
              </p>
              <p className="text-muted mt-2 text-xs">
                Statistical risk:{' '}
                {data.report.pillars.statistical_risk.status === 'unavailable'
                  ? 'VaR unavailable'
                  : data.report.pillars.statistical_risk.status}{' '}
                · No World ID approval
              </p>
              <Link
                href={`/reports/${encodeURIComponent(entry.id)}`}
                className="text-beam-ink mt-4 inline-block text-sm font-semibold underline"
              >
                Explore the evidence and report →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
