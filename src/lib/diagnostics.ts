import { scoutingApiOrigin } from './scouting';
export type Diagnostic = {
  candidate_id: string;
  label: string;
  state: string;
  detail: string;
  updated: number;
  provenance: 'user_requested_historical_diagnostic';
  case_admitted: false;
  world_verified: false;
  attempt: {
    candidate_id: string;
    run_id: string;
    report_id: string;
    report_version: string;
    report_sha256: string;
    model_status: string;
  } | null;
  report: { id: string; version: string; sha256: string } | null;
};
const obj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const id = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(x);
const hash = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export function parseDiagnostics(data: unknown): Diagnostic[] {
  if (!Array.isArray(data) || data.length > 100) throw new Error('Invalid diagnostic list');
  const seen = new Set<string>();
  for (const x of data) {
    if (
      !obj(x) ||
      typeof x.candidate_id !== 'string' ||
      !/^(1|8453):0x[a-fA-F0-9]{40}$/.test(x.candidate_id) ||
      seen.has(x.candidate_id.toLowerCase()) ||
      typeof x.label !== 'string' ||
      !x.label.trim() ||
      typeof x.state !== 'string' ||
      !/^[a-z0-9_]{1,80}$/.test(x.state) ||
      typeof x.detail !== 'string' ||
      x.detail.length > 5000 ||
      typeof x.updated !== 'number' ||
      !Number.isFinite(x.updated) ||
      x.updated < 0 ||
      x.updated > 8_640_000_000 ||
      x.provenance !== 'user_requested_historical_diagnostic' ||
      x.case_admitted !== false ||
      x.world_verified !== false
    )
      throw new Error('Invalid diagnostic');
    seen.add(x.candidate_id.toLowerCase());
    if (
      x.attempt !== null &&
      (!obj(x.attempt) ||
        x.attempt.candidate_id !== x.candidate_id ||
        !id(x.attempt.run_id) ||
        !id(x.attempt.report_id) ||
        !id(x.attempt.report_version) ||
        !hash(x.attempt.report_sha256) ||
        typeof x.attempt.model_status !== 'string')
    )
      throw new Error('Invalid diagnostic attempt');
    if (
      x.report !== null &&
      (!obj(x.report) ||
        !id(x.report.id) ||
        !id(x.report.version) ||
        !hash(x.report.sha256) ||
        !obj(x.attempt) ||
        x.report.id !== x.attempt.report_id ||
        x.report.version !== x.attempt.report_version ||
        x.report.sha256 !== x.attempt.report_sha256)
    )
      throw new Error('Invalid diagnostic report binding');
  }
  return data as Diagnostic[];
}
export async function fetchDiagnostics(origin: string): Promise<Diagnostic[]> {
  if (scoutingApiOrigin(origin) !== origin) throw new Error('Invalid API origin');
  const response = await fetch(`${origin}/diagnostics`, {
    cache: 'no-store',
    redirect: 'error',
    credentials: 'omit',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Diagnostic status unavailable');
  return parseDiagnostics(await response.json());
}
