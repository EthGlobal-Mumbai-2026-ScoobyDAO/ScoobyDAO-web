import { buildFixtureCases, RAW_REPORT, type FixtureApproval, type FixtureCase } from '@/fixtures';
import { fakeTxHash, publishFixture, setFixtureSeriesHashes } from '@/protocol/fixture';
import { adminAuthHeader } from './adminToken';
import { env } from './env';
import { parseApproval, parseReport, parseReports, ShapeError } from './guards';
import { toBytes32 } from './hash';
import type { Approval, ReportV02, ReputationBadgeAuthorizeResponse, WebReport } from './types';

// Typed client for ScoobyDAO-backend /web/v1 (publication/web_adapter.py). Display only:
// nothing here, or in the UI, decides that a report is approved.
//   GET  /health · GET /reports · GET /reports/:id · GET /reports/:id/raw
//   POST /reports/:id/approve · GET /approvals/:id   (need a review-desk session with the publication scope)
//   POST /reputation-badge/authorize  (V1 World ID badge; proposed, not implemented by the backend)

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------- mode switch


/**
 * Fixture backend data only with NEXT_PUBLIC_USE_FIXTURES=true. An unreachable or incompatible
 * backend is an error on the backend-sourced pages ("Research API unavailable"), never a silent
 * switch to fixtures, and it never affects the chain protocol (src/protocol/index.ts).
 */

export function usingFixtures(): Promise<boolean> {
  return Promise.resolve(env.forceFixtures);
}

/** Network-level failure (backend down, CORS, DNS), as opposed to an HTTP error from a running backend. */
export const isUnreachable = (e: unknown) => e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError');

async function http(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `${init?.method ?? 'GET'} ${path} failed with ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') msg = body.detail;
      else if (typeof body?.error === 'string') msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return res;
}
const json = async (path: string, init?: RequestInit) => (await http(path, init)).json() as Promise<unknown>;
const enc = encodeURIComponent;

export interface ReportWithRaw extends WebReport {
  report: ReportV02;
  raw: Uint8Array;
}

// ------------------------------------------------------------ fixture backend

const now = () => Math.floor(Date.now() / 1000);
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let fxCases: Promise<FixtureCase[]> | null = null;
const fxApprovals = new Map<string, FixtureApproval>();
const fxRequests = new Map<string, number>();

function cases() {
  fxCases ??= buildFixtureCases(now()).then((cs) => {
    for (const c of cs) if (c.onchain) setFixtureSeriesHashes(c.onchain, toBytes32(c.web.reportSha256), c.web.claimHash);
    return cs;
  });
  return fxCases;
}
async function fxCase(id: string) {
  const c = (await cases()).find((x) => x.web.id === id);
  if (!c) throw new ApiError(404, `Report ${id} not found`);
  return c;
}
const strip = (w: WebReport): WebReport => {
  const out = { ...w };
  delete out.report;
  return out;
};

/** Simulated World device grant: pending → denied (first request) or approved → spent. */
const STATIC_STATES: Approval['status'][] = ['pending', 'approved', 'spent', 'denied', 'expired', 'rejected_not_reviewer', 'error'];

/** /approve/demo-<status> shows one fixed state (for screenshots and the styleguide). */
async function staticApproval(status: Approval['status']): Promise<Approval> {
  const draft = (await cases())[0].web;
  return {
    id: `demo-${status}`,
    reportId: draft.id,
    status,
    userCode: status === 'pending' ? 'KQX-4821' : undefined,
    verificationUri: status === 'pending' ? 'https://example.org/fixture/world-device' : undefined,
    verificationUriComplete: status === 'pending' ? 'https://example.org/fixture/world-device?user_code=KQX4821' : undefined,
    expiresAt: now() + 300,
    reportSha256: draft.reportSha256,
    claimHash: draft.claimHash,
    publishTxHash: status === 'spent' || status === 'approved' ? `0x${'5e1f'.repeat(16)}` : undefined,
    onchainReportId: status === 'spent' ? '1' : undefined,
    demoIdentity: true,
    detail: status === 'error' ? 'Sign-off could not be verified; nothing was approved.' : undefined,
  };
}

async function fxApproval(id: string): Promise<Approval> {
  const st = id.startsWith('demo-') ? (id.slice(5) as Approval['status']) : undefined;
  if (st && STATIC_STATES.includes(st)) return staticApproval(st);
  const a = fxApprovals.get(id);
  if (!a) throw new ApiError(404, `Approval ${id} not found`);
  const c = await fxCase(a._reportKey);
  a._startedAt ??= now();
  const age = now() - a._startedAt;
  if (a.status === 'pending' && now() >= a.expiresAt) {
    a.status = 'expired';
    c.web.status = 'expired';
  } else if (a.status === 'pending' && age >= 8) {
    if (a._flow === 'deny') {
      a.status = 'denied';
      c.web.status = 'denied';
    } else a.status = 'approved';
  } else if (a.status === 'approved' && age >= 12) {
    const onchain = publishFixture(toBytes32(c.web.reportSha256), c.web.claimHash);
    c.onchain = onchain;
    a.status = 'spent';
    a.onchainReportId = onchain.toString();
    a.publishTxHash = fakeTxHash();
    c.web.status = 'published';
    c.web.onchainReportId = a.onchainReportId;
    c.web.txHash = a.publishTxHash;
  }
  const { _flow, _startedAt, _reportKey, ...pub } = a;
  void _flow;
  void _startedAt;
  void _reportKey;
  return structuredClone(pub);
}

const fixtureApi = {
  async health() {
    return { ok: true as const };
  },
  async getReports(): Promise<WebReport[]> {
    await delay();
    return (await cases()).map((c) => strip(c.web));
  },
  async getReport(id: string): Promise<ReportWithRaw> {
    await delay();
    const c = await fxCase(id);
    const raw = new TextEncoder().encode(RAW_REPORT);
    return { ...structuredClone(strip(c.web)), report: JSON.parse(RAW_REPORT) as ReportV02, raw };
  },
  async requestApproval(id: string): Promise<Approval> {
    await delay(500);
    const c = await fxCase(id);
    if (c.web.status === 'published') throw new ApiError(409, 'This report is already published.');
    const n = (fxRequests.get(id) ?? 0) + 1;
    fxRequests.set(id, n);
    const aid = `att-fixture-${n}-${now()}`;
    const code = `${String.fromCharCode(65 + (n % 26))}${'KQXZ'[n % 4]}${(now() % 9000) + 1000}`;
    const a: FixtureApproval = {
      id: aid,
      reportId: id,
      status: 'pending',
      userCode: `${code.slice(0, 3)}-${code.slice(3)}`,
      verificationUri: 'https://example.org/fixture/world-device',
      verificationUriComplete: `https://example.org/fixture/world-device?user_code=${code}`,
      expiresAt: now() + 5 * 60,
      reportSha256: c.web.reportSha256,
      claimHash: c.web.claimHash,
      demoIdentity: true,
      // The demo script: the first request is denied, later ones approved.
      _flow: n === 1 ? 'deny' : 'approve',
      _reportKey: id,
    };
    fxApprovals.set(aid, a);
    c.web.status = 'awaiting_approval';
    c.web.approvalId = aid;
    return fxApproval(aid);
  },
  async getApproval(id: string): Promise<Approval> {
    await delay(120);
    return fxApproval(id);
  },
  async authorizeReputationBadge(body: { reportId: string; recipient: string; proof: unknown }): Promise<ReputationBadgeAuthorizeResponse> {
    await delay(700);
    if (!body.proof) throw new ApiError(400, 'cancelled');
    const seen = fxRep.get(body.reportId);
    if (seen && seen !== body.recipient.toLowerCase()) throw new ApiError(409, 'This human already claimed a badge for this report');
    fxRep.set(body.reportId, body.recipient.toLowerCase());
    return {
      reportId: body.reportId,
      recipient: body.recipient as `0x${string}`,
      scopedNullifier: toBytes32('ab'.repeat(32)),
      nonce: String(now()),
      expiry: now() + 600,
      signature: `0x${'11'.repeat(65)}`,
    };
  },
};
const fxRep = new Map<string, string>();

// ----------------------------------------------------------------- live API

const liveApi: typeof fixtureApi = {
  health: async () => (await json('/health')) as { ok: true },
  getReports: async () => parseReports(await json('/reports')),
  async getReport(id) {
    const [meta, rawRes] = await Promise.all([json(`/reports/${enc(id)}`), http(`/reports/${enc(id)}/raw`)]);
    const web = parseReport(meta);
    const raw = new Uint8Array(await rawRes.arrayBuffer());
    let report: ReportV02;
    try {
      report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as ReportV02;
    } catch {
      throw new ShapeError('report.json is not valid UTF-8 JSON');
    }
    if (report?.schema_version !== '0.2') throw new ShapeError(`report schema_version ${String(report?.schema_version)} is not 0.2`);
    return { ...web, report, raw };
  },
  // Publication sign-off is bound to the signed-in reviewer (backend: admin session with the publication scope).
  requestApproval: async (id) =>
    parseApproval(await json(`/reports/${enc(id)}/approve`, { method: 'POST', headers: adminAuthHeader() })),
  getApproval: async (id) => parseApproval(await json(`/approvals/${enc(id)}`, { headers: adminAuthHeader() })),
  authorizeReputationBadge: async (body) =>
    (await json('/reputation-badge/authorize', { method: 'POST', body: JSON.stringify(body) })) as ReputationBadgeAuthorizeResponse,
};

type Api = typeof fixtureApi;

/** Fixture mode is explicit; live API errors propagate to the caller. */
export const api: Api = new Proxy({} as Api, {
  get(_t, key: keyof Api) {
    return async (...args: unknown[]) => {
      const impl = (await usingFixtures()) ? fixtureApi : liveApi;
      return (impl[key] as (...a: unknown[]) => unknown)(...args);
    };
  },
});

/** Test hook. */
export const __fixtureApi = fixtureApi;
