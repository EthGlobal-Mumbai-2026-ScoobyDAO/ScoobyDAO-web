// Client for the six-reference display contract (`scooby.reference-display/1`).
//   Public:  GET {research origin}/scouting/cases                       (through the /api/research proxy)
//   Admin:   GET /web/v1/admin/reference-reports/:id/:version           (Bearer: that report's World ID session)
//            GET /web/v1/admin/reference-reports/:id/:version/files/:path
// Reads only. Every fetched file is re-hashed (WebCrypto SHA-256) against the metadata `files` map; a mismatch is an
// IntegrityError and the section that needed the file is not rendered.
import { ApiError } from './api';
import { adminAuthHeader, reportKey } from './adminToken';
import { env } from './env';
import { sha256Hex } from './hash';
import { pairForReport, type PublicCaseItem } from './reference';
import { reportApiBase } from './reports';

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

export interface ReferenceMetadata {
  schema: 'scooby.reference-display/1';
  report_id: string;
  report_version: string;
  report_sha256: string;
  case_id: string;
  candidate_id: string;
  symbol: string;
  identity: { chain_id: number; address: string; symbol: string };
  mode: string;
  review_state: string;
  world_verified: boolean;
  gate_effect: string;
  association: string;
  labels: string[];
  description: string | null;
  pillars: Record<string, { status: string; quality_issues: string[] }>;
  files: Record<string, string>;
  file_base: string;
}

const hex64 = /^[a-f0-9]{64}$/;

/** A package-relative file path: no scheme, query, traversal or empty segments. */
export function safeFilePath(path: string): boolean {
  return (
    /^[A-Za-z0-9_./-]+$/.test(path) &&
    path.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
  );
}

/** Validates the metadata response and its binding to the requested report and the pinned contract table. */
export function parseMetadata(value: unknown, id: string, version: string): ReferenceMetadata {
  const m = value as ReferenceMetadata;
  if (!m || typeof m !== 'object' || m.schema !== 'scooby.reference-display/1')
    throw new ApiError(502, 'Unexpected response (expected scooby.reference-display/1)');
  if (m.report_id !== id || m.report_version !== version)
    throw new IntegrityError('The backend returned a different report than the one requested');
  const pair = pairForReport(id, version);
  if (
    !pair ||
    m.report_sha256 !== pair.report_sha256 ||
    m.case_id !== pair.case_id ||
    m.candidate_id !== pair.candidate_id
  )
    throw new IntegrityError('Report binding does not match the six-reference contract table');
  if (
    !m.files ||
    typeof m.files !== 'object' ||
    m.files['report.json'] !== m.report_sha256 ||
    !Object.entries(m.files).every(
      ([p, h]) => safeFilePath(p) && typeof h === 'string' && hex64.test(h),
    )
  )
    throw new IntegrityError('File list is missing report.json or has invalid entries');
  const expectedBase = `/web/v1/admin/reference-reports/${encodeURIComponent(id)}/${encodeURIComponent(version)}/files/`;
  if (m.file_base !== expectedBase) throw new IntegrityError('Unexpected file location');
  if (typeof m.world_verified !== 'boolean' || typeof m.review_state !== 'string')
    throw new ApiError(502, 'Review state missing from the response');
  return {
    ...m,
    labels: Array.isArray(m.labels) ? m.labels.filter((l) => typeof l === 'string') : [],
    pillars: m.pillars && typeof m.pillars === 'object' ? m.pillars : {},
    description: typeof m.description === 'string' ? m.description : null,
  };
}

async function errorFrom(res: Response, what: string): Promise<Error> {
  let msg = `${what} failed with ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') msg = body.detail;
  } catch {
    /* non-JSON body */
  }
  if (res.status === 409) return new IntegrityError(msg);
  return new ApiError(res.status, msg);
}

const enc = encodeURIComponent;
const metaPath = (id: string, version: string) =>
  `/admin/reference-reports/${enc(id)}/${enc(version)}`;

export interface VerifiedFile {
  path: string;
  sha256: string;
  bytes: Uint8Array;
  text: string;
}

/** The public case list's origin: the same-origin research proxy when NEXT_PUBLIC_REPORT_API_URL is valid. */
const configuredResearch =
  process.env.NEXT_PUBLIC_REPORT_API_URL === undefined
    ? 'https://scoobydao-backend.onrender.com'
    : process.env.NEXT_PUBLIC_REPORT_API_URL;
export const publicCasesUrl: string | null = reportApiBase(configuredResearch)
  ? '/api/research/scouting/cases'
  : null;

export const referenceApi = {
  /** Public case list (identifiers and labels only). */
  async cases(url: string | null = publicCasesUrl): Promise<PublicCaseItem[]> {
    if (!url) throw new ApiError(0, 'The research API origin is not configured');
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    } catch {
      throw new ApiError(0, 'Network error while loading cases');
    }
    if (!res.ok) throw await errorFrom(res, 'Loading cases');
    const body = (await res.json()) as { cases?: unknown };
    if (!body || !Array.isArray(body.cases))
      throw new ApiError(502, 'Unexpected case list response');
    return body.cases as PublicCaseItem[];
  },

  async metadata(id: string, version: string): Promise<ReferenceMetadata> {
    let res: Response;
    try {
      res = await fetch(`${env.apiUrl}${metaPath(id, version)}`, {
        headers: { Accept: 'application/json', ...adminAuthHeader(reportKey(id, version)) },
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(0, 'Network error while loading the report');
    }
    if (!res.ok) throw await errorFrom(res, 'Loading the report');
    return parseMetadata(await res.json(), id, version);
  },

  /** Fetches one listed file with the report's session and verifies its SHA-256 before returning it. */
  async file(meta: ReferenceMetadata, path: string): Promise<VerifiedFile> {
    const expected = meta.files[path];
    if (!expected || !safeFilePath(path))
      throw new IntegrityError(`${path} is not part of this report`);
    const url = `${env.apiUrl}${meta.file_base.slice('/web/v1'.length)}${path.split('/').map(enc).join('/')}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: adminAuthHeader(reportKey(meta.report_id, meta.report_version)),
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      throw new ApiError(0, `Network error while loading ${path}`);
    }
    if (!res.ok) throw await errorFrom(res, `Loading ${path}`);
    const headerFile = res.headers.get('X-File-SHA256');
    const headerReport = res.headers.get('X-Report-SHA256');
    const bytes = new Uint8Array(await res.arrayBuffer());
    const actual = await sha256Hex(bytes);
    if (actual !== expected) throw new IntegrityError(`${path} does not match its SHA-256`);
    if (headerFile && headerFile.toLowerCase() !== expected)
      throw new IntegrityError(`${path}: the server reported a different file hash`);
    if (headerReport && headerReport.toLowerCase() !== meta.report_sha256)
      throw new IntegrityError(`${path}: the server reported a different report hash`);
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError(502, `${path} is not UTF-8 text`);
    }
    return { path, sha256: actual, bytes, text };
  },
};

export type ReaderErrorKind =
  'signed_out' | 'forbidden' | 'not_found' | 'integrity' | 'network' | 'invalid' | 'unknown';

/** Maps a reader failure to an explicit state; nothing falls back to showing data. */
export function readerErrorKind(e: unknown): ReaderErrorKind {
  if (e instanceof IntegrityError) return 'integrity';
  if (e instanceof ApiError) {
    if (e.status === 401) return 'signed_out';
    if (e.status === 403) return 'forbidden';
    if (e.status === 404) return 'not_found';
    if (e.status === 409) return 'integrity';
    if (e.status === 0) return 'network';
    if (e.status === 502) return 'invalid';
    return 'unknown';
  }
  // Parser failures (malformed JSON/CSV, wrong identity inside a verified file) are plain Errors.
  if (e instanceof Error) return 'invalid';
  return 'unknown';
}

export const READER_ERROR_TEXT: Record<ReaderErrorKind, { title: string; body: string }> = {
  signed_out: {
    title: 'Session ended',
    body: 'This report’s World ID session is missing or expired. Close the report and press Read again.',
  },
  forbidden: {
    title: 'Not permitted',
    body: 'This session cannot open this report (wrong scope, or a session for a different report).',
  },
  not_found: {
    title: 'Not a linked reference report',
    body: 'The backend has no historical reference report with this id and version.',
  },
  integrity: {
    title: 'Integrity unavailable',
    body: 'A file did not match its recorded SHA-256, so it is not shown.',
  },
  network: {
    title: 'Backend unreachable',
    body: 'The request did not reach the backend. Try again later.',
  },
  invalid: {
    title: 'Unexpected data',
    body: 'The response could not be read, so it is not shown.',
  },
  unknown: { title: 'Couldn’t load', body: 'The request failed.' },
};
