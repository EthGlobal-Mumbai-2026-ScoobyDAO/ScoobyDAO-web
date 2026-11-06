// Parsers for the verified files of a reference report (report v0.2 bundle). Each parser validates the subset it
// reads and throws on anything it cannot read exactly; a throw hides that section, it never fills in values.
// Charts use the parsed values as they are: no smoothing, interpolation, resampling or filled gaps.

export const PILLARS = [
  ['microstructure', 'Market microstructure'],
  ['onchain', 'On-chain mechanics'],
  ['fundamentals', 'Fundamentals & sentiment'],
  ['statistical_risk', 'Statistical risk'],
  ['technical_health', 'Technical health'],
] as const;
export type PillarKey = (typeof PILLARS)[number][0];

const DAY = 86_400_000;
const isStr = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function json(text: string): Record<string, unknown> {
  const v = JSON.parse(text) as unknown;
  if (!v || typeof v !== 'object') throw new Error('Expected a JSON object or array');
  return v as Record<string, unknown>;
}

// ---------------------------------------------------------------- report.json (subset)

export interface EvidenceRecord {
  id: string;
  path: string | null;
  sha256: string | null;
  kind: string | null;
  observed_at: string | null;
  fetched_at: string | null;
  coverage: string | null;
  limitations: string[];
}
export interface ArtifactRecord {
  kind: string;
  availability: string;
  path: string | null;
  sha256: string | null;
}
export interface PillarRecord {
  status: string;
  summary: string | null;
  quality_issues: string[];
  evidence_ids: string[];
}
export interface ReportDoc {
  report_id: string;
  report_version: string;
  candidate_id: string;
  mode: string | null;
  identity: { chain_id: number | null; address: string | null; symbol: string | null };
  assessment: {
    status: string | null;
    label: string | null;
    summary: string | null;
    unknowns: string[];
  };
  pillars: Record<PillarKey, PillarRecord | null>;
  evidence: EvidenceRecord[];
  artifacts: ArtifactRecord[];
  limitations: string[];
}

export function parseReport(
  text: string,
  expect: { id: string; version: string; candidate: string },
): ReportDoc {
  const r = json(text);
  if (r.schema_version !== '0.2') throw new Error('Not a report v0.2');
  if (
    r.report_id !== expect.id ||
    r.report_version !== expect.version ||
    r.candidate_id !== expect.candidate
  )
    throw new Error('report.json identity does not match the requested report');
  const p = (r.pillars ?? {}) as Record<string, Record<string, unknown>>;
  const pillars = Object.fromEntries(
    PILLARS.map(([k]) => {
      const x = p[k];
      return [
        k,
        x && isStr(x.status)
          ? {
              status: x.status,
              summary: isStr(x.summary) ? x.summary : null,
              quality_issues: strings(x.quality_issues),
              evidence_ids: strings(x.evidence_ids),
            }
          : null,
      ];
    }),
  ) as Record<PillarKey, PillarRecord | null>;
  const id = (r.identity ?? {}) as Record<string, unknown>;
  const a = (r.assessment ?? {}) as Record<string, unknown>;
  return {
    report_id: expect.id,
    report_version: expect.version,
    candidate_id: expect.candidate,
    mode: isStr(r.mode) ? r.mode : null,
    identity: {
      chain_id: fin(id.chain_id) ? id.chain_id : null,
      address: isStr(id.address) ? id.address : null,
      symbol: isStr(id.symbol) ? id.symbol : null,
    },
    assessment: {
      status: isStr(a.status) ? a.status : null,
      label: isStr(a.label) ? a.label : null,
      summary: isStr(a.summary) ? a.summary : null,
      unknowns: strings(a.unknowns),
    },
    pillars,
    evidence: (Array.isArray(r.evidence) ? r.evidence : [])
      .filter((e): e is Record<string, unknown> => !!e && isStr((e as Record<string, unknown>).id))
      .map((e) => ({
        id: e.id as string,
        path: isStr(e.path) ? e.path : null,
        sha256: isStr(e.sha256) ? e.sha256 : null,
        kind: isStr(e.kind) ? e.kind : null,
        observed_at: isStr(e.observed_at) ? e.observed_at : null,
        fetched_at: isStr(e.fetched_at) ? e.fetched_at : null,
        coverage: isStr(e.coverage) ? e.coverage : null,
        limitations: strings(e.limitations),
      })),
    artifacts: (Array.isArray(r.artifacts) ? r.artifacts : [])
      .filter(
        (x): x is Record<string, unknown> => !!x && isStr((x as Record<string, unknown>).kind),
      )
      .map((x) => ({
        kind: x.kind as string,
        availability: isStr(x.availability) ? x.availability : 'unknown',
        path: isStr(x.path) ? x.path : null,
        sha256: isStr(x.sha256) ? x.sha256 : null,
      })),
    limitations: strings(r.limitations),
  };
}

// ---------------------------------------------------------------- pillar-tldr.json / pillar-irc.json

export interface TldrBullet {
  role: string;
  text: string;
  evidence_ids: string[];
}
export type Tldr = Partial<Record<PillarKey, TldrBullet[]>>;

export function parseTldr(text: string, expect: { id: string; version: string }): Tldr {
  const t = json(text);
  if (t.profile !== 'scooby.pillar-tldr/1') throw new Error('Not a pillar TL;DR');
  if (t.report_id !== expect.id || t.report_version !== expect.version)
    throw new Error('TL;DR belongs to a different report');
  const p = (t.pillars ?? {}) as Record<string, unknown>;
  const out: Tldr = {};
  for (const [k] of PILLARS) {
    if (!Array.isArray(p[k])) continue;
    out[k] = (p[k] as Record<string, unknown>[])
      .filter((b) => b && isStr(b.text) && b.text.trim())
      .map((b) => ({
        role: isStr(b.role) ? b.role : 'note',
        text: b.text as string,
        evidence_ids: strings(b.evidence_ids),
      }));
  }
  return out;
}

export interface IrcPillar {
  insight: string | null;
  reasoning: string | null;
  limitations: string[];
  questions: string[];
  evidence_ids: string[];
}
export type Irc = Partial<Record<PillarKey, IrcPillar>>;

export function parseIrc(text: string, expect: { id: string; version: string }): Irc {
  const t = json(text);
  if (t.profile !== 'scooby.pillar-irc/1') throw new Error('Not a pillar IRC file');
  if (t.report_id !== expect.id || t.report_version !== expect.version)
    throw new Error('IRC file belongs to a different report');
  const p = (t.pillars ?? {}) as Record<string, Record<string, unknown>>;
  const out: Irc = {};
  for (const [k] of PILLARS) {
    const x = p[k];
    if (!x) continue;
    const txt = (v: unknown) =>
      v && isStr((v as { text?: unknown }).text) ? (v as { text: string }).text : null;
    const cites = (x.citations ?? {}) as Record<string, unknown>;
    out[k] = {
      insight: txt(x.insight),
      reasoning: txt(x.reasoning),
      limitations: strings(x.limitations),
      questions: strings(x.questions),
      evidence_ids: strings(cites.evidence_ids),
    };
  }
  return out;
}

// ---------------------------------------------------------------- source-ledger.json

export interface LedgerSource {
  id: string;
  url: string | null;
  fetched_at: string | null;
  sha256: string | null;
  transport_mode: string | null;
}
export function parseLedger(text: string): { sources: LedgerSource[] } {
  const l = json(text);
  if (!Array.isArray(l.sources)) throw new Error('Source ledger has no sources');
  return {
    sources: (l.sources as Record<string, unknown>[])
      .filter((s) => s && isStr(s.id))
      .map((s) => ({
        id: s.id as string,
        url: isStr(s.url) ? s.url : null,
        fetched_at: isStr(s.fetched_at) ? s.fetched_at : null,
        sha256: isStr(s.sha256) ? s.sha256 : null,
        transport_mode: isStr(s.transport_mode) ? s.transport_mode : null,
      })),
  };
}

/** Only plain https links with no credentials are rendered as links; anything else is shown as text. */
export function safeHttpsUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Graph daily prices

export interface GraphManifest {
  source: string;
  chain: string | null;
  subgraph_id: string | null;
  token_address: string;
  start_inclusive_utc: string;
  end_exclusive_utc: string;
  fetched_at_utc: string | null;
  row_count: number;
  missing_utc_dates: string[];
  price_field: 'priceUSD' | 'close';
  price_units: string;
  notes: string[];
  /** SHA-256 of token_daily.json as recorded by the capture. */
  raw_sha256: string | null;
}

const ymd = /^\d{4}-\d{2}-\d{2}$/;
const ymdMs = (d: string) => (ymd.test(d) ? Date.parse(d + 'T00:00:00Z') : NaN);

export function parseGraphManifest(text: string): GraphManifest {
  const m = json(text);
  if (
    !isStr(m.source) ||
    !isStr(m.token_address) ||
    !isStr(m.start_inclusive_utc) ||
    !isStr(m.end_exclusive_utc) ||
    !Number.isFinite(ymdMs(m.start_inclusive_utc)) ||
    !Number.isFinite(ymdMs(m.end_exclusive_utc)) ||
    !fin(m.row_count) ||
    (m.price_field !== 'priceUSD' && m.price_field !== 'close') ||
    !isStr(m.price_units) ||
    !/USD/.test(m.price_units)
  )
    throw new Error('Unsupported Graph source manifest');
  return {
    source: m.source,
    chain: isStr(m.chain) ? m.chain : null,
    subgraph_id: isStr(m.subgraph_id) ? m.subgraph_id : null,
    token_address: m.token_address.toLowerCase(),
    start_inclusive_utc: m.start_inclusive_utc,
    end_exclusive_utc: m.end_exclusive_utc,
    fetched_at_utc: isStr(m.fetched_at_utc) ? m.fetched_at_utc : null,
    row_count: m.row_count,
    missing_utc_dates: strings(m.missing_utc_dates),
    price_field: m.price_field,
    price_units: m.price_units,
    notes: strings(m.notes),
    raw_sha256: isStr(m.raw_sha256) && /^[a-f0-9]{64}$/.test(m.raw_sha256) ? m.raw_sha256 : null,
  };
}

export interface DayPoint {
  /** UTC calendar date, YYYY-MM-DD. */
  date: string;
  /** Midnight UTC, ms. */
  t: number;
  value: number;
}

/**
 * Daily USD prices from token_daily.json, in the manifest's price field. Each row must be a distinct midnight-UTC
 * date inside the manifest window, ascending, for the manifest token, with a positive finite decimal price. The row
 * count must match the manifest. Any violation rejects the whole series.
 */
export function parseTokenDaily(text: string, manifest: GraphManifest): DayPoint[] {
  const rows = JSON.parse(text) as unknown;
  if (!Array.isArray(rows)) throw new Error('token_daily.json is not a list');
  if (rows.length !== manifest.row_count)
    throw new Error('Row count differs from the Graph manifest');
  const start = ymdMs(manifest.start_inclusive_utc);
  const end = ymdMs(manifest.end_exclusive_utc);
  let prev = -Infinity;
  return rows.map((row: Record<string, unknown>) => {
    const sec = row?.date;
    if (!fin(sec) || !Number.isInteger(sec) || (sec * 1000) % DAY !== 0)
      throw new Error('Invalid row date');
    const t = sec * 1000;
    if (t <= prev || t < start || t >= end)
      throw new Error('Row date out of order or outside the window');
    prev = t;
    const token = (row.token as { id?: unknown } | undefined)?.id;
    if (!isStr(token) || token.toLowerCase() !== manifest.token_address)
      throw new Error('Row for a different token');
    const raw = row[manifest.price_field];
    if (!isStr(raw) || !/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(raw)) throw new Error('Invalid price');
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid price');
    return { date: new Date(t).toISOString().slice(0, 10), t, value };
  });
}

// ---------------------------------------------------------------- VAE: metrics, run manifest, reconstructions

export interface VarMetrics {
  var_90: number;
  var_95: number;
  var_99: number;
  confidence_level: number;
  time_horizon_days: number;
  number_of_recreations: number;
  data_points: number | null;
}

/**
 * The numeric VaR fields of legacy_metrics.json (`risk_assessment` block) only. The legacy risk score, risk label and
 * "interpretation" sentence are deliberately not read: they are uncalibrated and must not be shown as a finding.
 */
export function parseVarMetrics(text: string): VarMetrics {
  const doc = json(text);
  const ra = (doc.risk_assessment ?? doc) as Record<string, unknown>;
  return varFrom(ra);
}
function varFrom(ra: Record<string, unknown>): VarMetrics {
  const v = (ra.var_metrics ?? {}) as Record<string, unknown>;
  const vae = (ra.vae_specific_metrics ?? {}) as Record<string, unknown>;
  if (
    !fin(v.var_90) ||
    !fin(v.var_95) ||
    !fin(v.var_99) ||
    !fin(v.confidence_level) ||
    !fin(v.time_horizon_days) ||
    !fin(vae.number_of_recreations)
  )
    throw new Error('VaR metrics incomplete');
  return {
    var_90: v.var_90,
    var_95: v.var_95,
    var_99: v.var_99,
    confidence_level: v.confidence_level,
    time_horizon_days: v.time_horizon_days,
    number_of_recreations: vae.number_of_recreations,
    data_points: fin(vae.data_points) ? vae.data_points : null,
  };
}
/** graph_model/risk-metrics.json carries the same block unwrapped; it must agree exactly with legacy_metrics.json. */
export function metricsAgree(a: VarMetrics, riskMetricsText: string): boolean {
  const b = varFrom(json(riskMetricsText));
  return (Object.keys(a) as (keyof VarMetrics)[]).every((k) => a[k] === b[k]);
}

export interface RunManifest {
  randomness: string | null;
  days: number | null;
  confidence: number | null;
  reconstructions: number | null;
  returns: number | null;
  reconstructions_sha256: string | null;
  scope: string | null;
  source: string | null;
}
export function parseRunManifest(text: string): RunManifest {
  const m = json(text);
  return {
    randomness: isStr(m.randomness) ? m.randomness : null,
    days: fin(m.days) ? m.days : null,
    confidence: fin(m.confidence) ? m.confidence : null,
    reconstructions: fin(m.reconstructions) ? m.reconstructions : null,
    returns: fin(m.returns) ? m.returns : null,
    reconstructions_sha256: isStr(m.reconstructions_sha256) ? m.reconstructions_sha256 : null,
    scope: isStr(m.scope) ? m.scope : null,
    source: isStr(m.source) ? m.source : null,
  };
}

export type ReconstructionRow = { date: string; t: number; values: number[] };

/** Strictly parses the 50-column, unquoted reconstruction CSV (simple daily-return fractions). From web PR #9. */
export function parseReconstructions(csv: string, columns = 50): ReconstructionRow[] {
  if (csv.length > 5_000_000 || csv.includes('"'))
    throw new Error('Unsupported reconstruction data');
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  const header = lines.shift()?.split(',');
  if (
    !header ||
    header.length !== columns + 1 ||
    header[0] !== 'datetime' ||
    header.slice(1).some((name, i) => name !== `TOKEN_recreation_${i + 1}`) ||
    lines.length < 2 ||
    lines.length > 4000
  )
    throw new Error('Invalid reconstruction header');
  let prev = -Infinity;
  return lines.map((line) => {
    const cols = line.split(',');
    const t = ymdMs(cols[0]);
    if (cols.length !== columns + 1 || !Number.isFinite(t) || t <= prev)
      throw new Error('Invalid reconstruction date');
    prev = t;
    const values = cols.slice(1).map((v) => {
      if (!v.trim()) throw new Error('Missing reconstruction value');
      const n = Number(v);
      if (!Number.isFinite(n) || n < -1) throw new Error('Invalid reconstruction value');
      return n;
    });
    return { date: cols[0], t, values };
  });
}

/** Fixed, evenly spread examples (reconstructions 1, 13, 25, 37 and 50); never chosen by value. */
export const RECONSTRUCTION_SAMPLE = [0, 12, 24, 36, 49] as const;

// ---------------------------------------------------------------- chart geometry (pure, testable)

export interface Box {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Scale {
  x: (t: number) => number;
  y: (v: number) => number;
  /** Inverse of y, for tests and readouts. */
  invY: (py: number) => number;
  minT: number;
  maxT: number;
  minV: number;
  maxV: number;
}

export function linearScale(ts: number[], vs: number[], box: Box, includeZero = false): Scale {
  const minT = Math.min(...ts);
  const maxT = Math.max(...ts);
  let minV = Math.min(...vs, ...(includeZero ? [0] : []));
  let maxV = Math.max(...vs, ...(includeZero ? [0] : []));
  if (minV === maxV) {
    const pad = Math.abs(minV) || 1;
    minV -= pad / 2;
    maxV += pad / 2;
  }
  const w = box.width - box.left - box.right;
  const h = box.height - box.top - box.bottom;
  const x = (t: number) => box.left + (maxT === minT ? w / 2 : ((t - minT) / (maxT - minT)) * w);
  const y = (v: number) => box.top + h - ((v - minV) / (maxV - minV)) * h;
  const invY = (py: number) => minV + ((box.top + h - py) / h) * (maxV - minV);
  return { x, y, invY, minT, maxT, minV, maxV };
}

/**
 * SVG path through the points in order. A gap of more than one UTC day starts a new segment (M), so missing dates
 * are never bridged. Returns the path and the exact vertices used, one per input point.
 */
export function linePath(points: { t: number; value: number }[], s: Scale) {
  const vertices = points.map((p) => ({ x: s.x(p.t), y: s.y(p.value) }));
  const d = vertices
    .map(
      (v, i) =>
        `${i && points[i].t - points[i - 1].t === DAY ? 'L' : 'M'}${v.x.toFixed(2)},${v.y.toFixed(2)}`,
    )
    .join(' ');
  return { d, vertices };
}

/** Readable USD for anything from SHIB-sized fractions of a cent to thousands. */
export function formatUsd(v: number): string {
  if (v === 0) return '$0';
  if (Math.abs(v) < 0.01) return `$${Number(v.toPrecision(4)).toString()}`;
  if (Math.abs(v) < 1) return `$${v.toFixed(4)}`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function utcStamp(iso: string | null): string {
  if (!iso) return 'time not supplied';
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : 'time not supplied';
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];
/** "four-day horizon" from the data's own horizon; never assumed. */
export function horizonLabel(days: number): string {
  return `${Number.isInteger(days) && days <= 10 ? NUMBER_WORDS[days] : days}-day horizon`;
}
