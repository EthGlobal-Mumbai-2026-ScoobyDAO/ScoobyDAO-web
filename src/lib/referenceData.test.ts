import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reconstructionSeries } from '@/components/reference/sections';
import {
  PAIR,
  graphManifest,
  ircJson,
  ledgerJson,
  legacyMetricsText,
  prices,
  reconstructionsCsv,
  reportJson,
  riskMetricsText,
  runManifestText,
  tldrJson,
  tokenDailyText,
} from '@/test/referenceFixtures';
import { REFERENCE_PAIRS } from './reference';
import {
  RECONSTRUCTION_SAMPLE,
  formatUsd,
  horizonLabel,
  linePath,
  linearScale,
  metricsAgree,
  parseGraphManifest,
  parseIrc,
  parseLedger,
  parseReconstructions,
  parseReport,
  parseRunManifest,
  parseTldr,
  parseTokenDaily,
  parseVarMetrics,
  safeHttpsUrl,
  type Box,
} from './referenceData';

const ident = { id: PAIR.report_id, version: PAIR.report_version };
const BOX: Box = { width: 640, height: 240, left: 8, right: 8, top: 10, bottom: 10 };
const manifest = () => parseGraphManifest(JSON.stringify(graphManifest));

describe('reference file parsers', () => {
  it('reads report.json identity, pillars, evidence and the unavailable pdf', () => {
    const r = parseReport(JSON.stringify(reportJson), { ...ident, candidate: PAIR.candidate_id });
    expect(r.pillars.fundamentals?.status).toBe('unavailable');
    expect(r.pillars.fundamentals?.quality_issues).toEqual(['Synthetic fundamentals gap.']);
    expect(r.artifacts.find((a) => a.kind === 'pdf')?.availability).toBe('unavailable');
    expect(r.evidence[0].fetched_at).toBe('2026-01-06T12:00:00+00:00');
    expect(() =>
      parseReport(JSON.stringify({ ...reportJson, report_version: 'x' }), {
        ...ident,
        candidate: PAIR.candidate_id,
      }),
    ).toThrow();
    expect(() =>
      parseReport(JSON.stringify({ ...reportJson, schema_version: '0.1' }), {
        ...ident,
        candidate: PAIR.candidate_id,
      }),
    ).toThrow();
  });

  it('reads TL;DR bullets, IRC context and the ledger, bound to the report', () => {
    const t = parseTldr(JSON.stringify(tldrJson), ident);
    expect(t.fundamentals?.[0]).toEqual({
      role: 'caveat',
      text: 'Synthetic fundamentals caveat.',
      evidence_ids: [],
    });
    expect(() => parseTldr(JSON.stringify({ ...tldrJson, report_id: 'other' }), ident)).toThrow();
    const i = parseIrc(JSON.stringify(ircJson), ident);
    expect(i.onchain?.questions).toEqual(['Synthetic question?']);
    expect(i.microstructure).toBeUndefined();
    expect(parseLedger(JSON.stringify(ledgerJson)).sources[0].url).toBe(
      'https://example.invalid/synthetic',
    );
  });

  it('links only credential-free https sources', () => {
    expect(safeHttpsUrl('https://example.invalid/a')).toBe('https://example.invalid/a');
    expect(safeHttpsUrl('http://example.invalid/a')).toBeNull();
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('https://u:p@example.invalid/')).toBeNull();
  });
});

describe('Graph daily price chart data', () => {
  it('plots exactly the parsed rows: same count, order, UTC dates and values', () => {
    const points = parseTokenDaily(tokenDailyText, manifest());
    expect(points.map((p) => p.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-04',
      '2026-01-05',
    ]);
    expect(points.map((p) => p.value)).toEqual(prices.map(Number));
    const s = linearScale(
      points.map((p) => p.t),
      points.map((p) => p.value),
      BOX,
    );
    const { d, vertices } = linePath(points, s);
    expect(vertices).toHaveLength(points.length);
    vertices.forEach((v, i) => {
      expect(s.invY(v.y)).toBeCloseTo(points[i].value, 9);
    });
    // Missing 2026-01-03 is not bridged: the path restarts with a move.
    expect(d.split(' ').map((c) => c[0])).toEqual(['M', 'L', 'M', 'L']);
    expect(s.minV).toBe(0.0000125);
    expect(s.maxV).toBe(1234.5);
  });

  it('rejects rows that disagree with the manifest', () => {
    const m = manifest();
    const rows = JSON.parse(tokenDailyText);
    expect(() => parseTokenDaily(JSON.stringify(rows.slice(1)), m)).toThrow(/Row count/);
    expect(() =>
      parseTokenDaily(JSON.stringify([rows[1], rows[0], rows[2], rows[3]]), m),
    ).toThrow();
    const bad = structuredClone(rows);
    bad[2].priceUSD = '-1';
    expect(() => parseTokenDaily(JSON.stringify(bad), m)).toThrow(/price/);
    const other = structuredClone(rows);
    other[0].token.id = '0x' + '1'.repeat(40);
    expect(() => parseTokenDaily(JSON.stringify(other), m)).toThrow(/token/);
    const offDay = structuredClone(rows);
    offDay[0].date += 3600;
    expect(() => parseTokenDaily(JSON.stringify(offDay), m)).toThrow(/date/);
    expect(() =>
      parseGraphManifest(JSON.stringify({ ...graphManifest, price_units: 'ETH' })),
    ).toThrow();
  });

  it('formats prices in USD from fractions of a cent upward', () => {
    expect(formatUsd(0.0000125)).toBe('$0.0000125');
    expect(formatUsd(0.52)).toBe('$0.5200');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });
});

describe('VAE data', () => {
  it('reads only numeric VaR fields, never the legacy label or "maximum loss" text', () => {
    const m = parseVarMetrics(legacyMetricsText);
    expect(m).toEqual({
      var_90: 1.1,
      var_95: 1.5,
      var_99: 2.25,
      confidence_level: 0.95,
      time_horizon_days: 4,
      number_of_recreations: 50,
      data_points: 3,
    });
    expect(JSON.stringify(m)).not.toMatch(/Low|maximum loss|risk_level|interpretation/);
    expect(metricsAgree(m, riskMetricsText)).toBe(true);
    const changed = JSON.parse(riskMetricsText);
    changed.var_metrics.var_95 = 9;
    expect(metricsAgree(m, JSON.stringify(changed))).toBe(false);
    expect(horizonLabel(m.time_horizon_days)).toBe('four-day horizon');
    expect(parseRunManifest(runManifestText).randomness).toBe('legacy unseeded training');
  });

  it('charts five fixed reconstructions with values equal to the CSV × 100', () => {
    const rows = parseReconstructions(reconstructionsCsv());
    const series = reconstructionSeries(rows);
    expect(series.map((s) => s.label)).toEqual(
      RECONSTRUCTION_SAMPLE.map((c) => `Reconstruction ${c + 1}`),
    );
    const csv = reconstructionsCsv()
      .split('\n')
      .slice(1)
      .map((l) => l.split(','));
    series.forEach((s, j) => {
      expect(s.points).toHaveLength(rows.length);
      s.points.forEach((p, i) => {
        expect(p.value).toBe(Number(csv[i][RECONSTRUCTION_SAMPLE[j] + 1]) * 100);
        expect(p.t).toBe(Date.parse(csv[i][0] + 'T00:00:00Z'));
      });
    });
  });

  it('rejects malformed reconstruction files', () => {
    expect(() => parseReconstructions(reconstructionsCsv(3, 49))).toThrow();
    expect(() =>
      parseReconstructions(reconstructionsCsv().replace('2026-01-02', '2026-01-01')),
    ).toThrow();
    expect(() =>
      parseReconstructions(reconstructionsCsv().replace(/,0\.0[0-9]+/, ',abc')),
    ).toThrow();
  });
});

// Optional conformance check against locally extracted real bundles. Never runs in CI and reads nothing into the
// repository: set REFERENCE_BUNDLES_DIR to a directory holding <symbol>/ bundle folders.
const realDir = process.env.REFERENCE_BUNDLES_DIR;
describe.skipIf(!realDir || !existsSync(realDir))('real bundles (env-gated, local only)', () => {
  it.each(REFERENCE_PAIRS.map((p) => [p.symbol, p] as const))(
    '%s parses end to end',
    (symbol, p) => {
      const dir = path.join(realDir!, symbol.toLowerCase());
      const read = (f: string) => readFileSync(path.join(dir, f), 'utf8');
      const rpt = parseReport(read('report.json'), {
        id: p.report_id,
        version: p.report_version,
        candidate: p.candidate_id,
      });
      expect(Object.values(rpt.pillars).every(Boolean)).toBe(true);
      parseTldr(read('pillar-tldr.json'), { id: p.report_id, version: p.report_version });
      if (existsSync(path.join(dir, 'pillar-irc.json')))
        parseIrc(read('pillar-irc.json'), { id: p.report_id, version: p.report_version });
      parseLedger(read('source-ledger.json'));
      const m = parseGraphManifest(read('evidence/graph/manifest.json'));
      const pts = parseTokenDaily(read('evidence/graph/token_daily.json'), m);
      expect(pts.length).toBe(m.row_count);
      const v = parseVarMetrics(read('evidence/legacy_metrics.json'));
      expect(metricsAgree(v, read('evidence/graph_model/risk-metrics.json'))).toBe(true);
      expect(v.time_horizon_days).toBe(4);
      const rows = parseReconstructions(read('evidence/legacy_reconstructions.csv'));
      expect(rows[0].values).toHaveLength(50);
    },
  );
});
