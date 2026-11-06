import { describe, expect, it } from 'vitest';
import { reportMath } from './report-math';
import type { NativeReport } from './report-widget';

function report(
  points: { time: string; value: number | null }[],
  fraction = '0.420735121185671944',
) {
  return {
    pillars: {
      microstructure: {
        measurements: [{ id: 'liquidity_usd', value: 43.5993399753, unit: 'USD' }],
        claims: [],
        series: [],
      },
      onchain: {
        measurements: [],
        series: [],
        claims: [
          {
            statement: `The security provider reports holder 0x000000000000000000000000000000000000dead; supply fraction = ${fraction}; is_locked = 1.`,
            supporting_evidence_ids: ['security'],
          },
        ],
      },
      technical_health: {
        measurements: [],
        claims: [],
        series: [
          { id: 'observed_daily_closes', points, evidence_ids: ['daily'] },
          {
            id: 'observed_daily_returns',
            points: [{ time: '2026-04-15T00:00:00Z', value: 0.16789 }],
          },
        ],
      },
    },
  } as unknown as NativeReport['report'];
}

describe('report math from supplied evidence', () => {
  it('sorts observations and computes endpoint change without treating gaps as daily returns', () => {
    const value = reportMath(
      report([
        { time: '2026-09-05T00:00:00Z', value: 9.365830996613419e-14 },
        { time: '2025-10-02T00:00:00Z', value: 4.31055863021459e-13 },
      ]),
    );
    expect(value.endpointChange).toBeCloseTo(-78.27, 1);
    expect(value.closeCount).toBe(2);
    expect(value.adjacentReturns).toBe(1);
    expect(value.holders[0].fraction * 100).toBeCloseTo(42.0735121);
    expect(value.liquidity?.value).toBe(43.5993399753);
  });
  it('does not fabricate an endpoint change or accept invalid supply fractions', () => {
    const value = reportMath(report([{ time: '2026-01-01T00:00:00Z', value: 0 }], '1.2'));
    expect(value.endpointChange).toBeNull();
    expect(value.closeCount).toBe(0);
    expect(value.holders).toEqual([]);
  });
  it('prefers linked structured projections over legacy display calculations', () => {
    const r = report([
      { time: '2026-01-01T00:00:00Z', value: 1 },
      { time: '2026-01-03T00:00:00Z', value: 2 },
    ]);
    const technical = r.pillars.technical_health;
    technical.measurements.push({
      id: 'observed_endpoint_change_percent',
      unit: 'percent',
      value: 99.99,
    } as never);
    technical.measurements.push({
      id: 'observed_closed_daily_count',
      unit: 'closed daily observations',
      value: 9,
    } as never);
    const claim = r.pillars.onchain.claims[0];
    claim.id = 'provider-holder-1';
    r.pillars.onchain.measurements.push({
      id: 'provider_holder_1_supply_percent',
      unit: 'percent of provider-reported total supply',
      value: 42.08,
      method: 'provider-holder-1 0x000000000000000000000000000000000000dead',
      evidence_ids: ['security'],
    } as never);
    const result = reportMath(r);
    expect(result.endpointChange).toBe(99.99);
    expect(result.closeCount).toBe(9);
    expect(result.holders[0].percent).toBe(42.08);
    expect(result.holders[0].projected).toBe(true);
  });
});
