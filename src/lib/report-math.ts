import type { NativeReport } from './report-widget';

type Report = NativeReport['report'];

/** Derived display calculations use the supplied report only; never manufacture missing data. */
export function reportMath(report: Report) {
  const technical = report.pillars.technical_health;
  const projected = (id: string, unit: string) => {
    const m = technical?.measurements.find((item) => item.id === id && item.unit === unit);
    return m && typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : null;
  };
  const closes = technical?.series.find((s) => s.id === 'observed_daily_closes') ?? technical?.series.find((s) => s.id === 'graph_token_daily_price_usd');
  const returns = technical?.series.find((s) => s.id === 'observed_daily_returns') ?? technical?.series.find((s) => s.id === 'graph_token_daily_returns');
  const points = (closes?.points ?? [])
    .filter(
      (p): p is { time: string; value: number } =>
        typeof p.time === 'string' &&
        Number.isFinite(Date.parse(p.time)) &&
        typeof p.value === 'number' &&
        Number.isFinite(p.value) &&
        p.value > 0,
    )
    .slice()
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const first = points[0];
  const last = points[points.length - 1];
  const derivedChange =
    points.length >= 2 && Date.parse(last.time) > Date.parse(first.time)
      ? (last.value / first.value - 1) * 100
      : null;
  const derivedReturns = (returns?.points ?? []).filter(
    (p) =>
      typeof p.value === 'number' &&
      Number.isFinite(p.value) &&
      typeof p.time === 'string' &&
      Number.isFinite(Date.parse(p.time)),
  ).length;
  const holders = (report.pillars.onchain?.claims ?? []).flatMap((claim) => {
    const match =
      /^The security provider reports holder (0x[0-9a-f]{40}); supply fraction = ([0-9]+(?:\.[0-9]+)?);/i.exec(
        claim.statement,
      );
    if (!match) return [];
    const fraction = Number(match[2]);
    const claimNumber = /^provider-holder-(\d+)$/.exec(claim.id ?? '');
    const measurement =
      claimNumber &&
      report.pillars.onchain.measurements.find(
        (m) =>
          m.id === `provider_holder_${claimNumber[1]}_supply_percent` &&
          m.unit === 'percent of provider-reported total supply' &&
          typeof m.value === 'number' &&
          Number.isFinite(m.value) &&
          m.value >= 0 &&
          m.value <= 100 &&
          m.method?.includes(match[1].toLowerCase()) &&
          m.method?.includes(claim.id),
      );
    return Number.isFinite(fraction) && fraction >= 0 && fraction <= 1
      ? [
          {
            address: match[1],
            fraction,
            percent:
              measurement && typeof measurement.value === 'number'
                ? measurement.value
                : fraction * 100,
            projected: Boolean(measurement),
            evidenceIds: measurement?.evidence_ids ?? claim.supporting_evidence_ids,
            statement: claim.statement,
          },
        ]
      : [];
  });
  const liquidity = report.pillars.microstructure?.measurements.find(
    (m) => m.id === 'liquidity_usd' && m.unit === 'USD',
  );
  const volume = report.pillars.microstructure?.measurements.find(
    (m) => m.id === 'volume_24h_usd' && m.unit === 'USD',
  );
  const roundedLiquidity = report.pillars.microstructure?.measurements.find(
    (m) =>
      m.id === 'liquidity_usd_rounded' &&
      m.unit === 'USD' &&
      typeof m.value === 'number' &&
      Number.isFinite(m.value) &&
      m.evidence_ids.some((id) => liquidity?.evidence_ids.includes(id)),
  );
  return {
    closes,
    first,
    last,
    endpointChange: projected('observed_endpoint_change_percent', 'percent') ?? derivedChange,
    closeCount:
      projected('observed_closed_daily_count', 'closed daily observations') ?? points.length,
    adjacentReturns:
      projected('observed_adjacent_daily_return_count', 'adjacent daily returns') ?? derivedReturns,
    gapIntervals: projected('observed_gap_interval_count', 'gap intervals'),
    holders,
    liquidity,
    displayLiquidity:
      typeof roundedLiquidity?.value === 'number' ? roundedLiquidity.value : liquidity?.value,
    volume,
  };
}
