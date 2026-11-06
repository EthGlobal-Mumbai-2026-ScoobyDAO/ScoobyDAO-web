import * as fx from '@/fixtures';
import { env } from './env';
import type { Approval, ClaimView, Deployments, Report } from './types';

// Typed client for every route in INTERFACES.md §4. Read-only display of backend state:
// nothing here (or in the UI) decides that a report is approved.

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

let modePromise: Promise<boolean> | null = null;

/** True when NEXT_PUBLIC_USE_FIXTURES=true or the API's /health is unreachable. Checked once per page load. */
export function usingFixtures(): Promise<boolean> {
  if (env.forceFixtures) return Promise.resolve(true);
  modePromise ??= fetch(`${env.apiUrl}/health`, { signal: AbortSignal.timeout(2500), cache: 'no-store' })
    .then(async (r) => !(r.ok && (await r.json())?.ok === true))
    .catch(() => true);
  return modePromise;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `${init?.method ?? 'GET'} ${path} failed with ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') msg = body.error;
      else if (typeof body?.message === 'string') msg = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

// ------------------------------------------------------------ fixture backend

const now = () => Math.floor(Date.now() / 1000);
const clone = <T>(v: T): T => structuredClone(v);
const fxState = {
  reports: clone(fx.reports),
  approvals: new Map(fx.approvals.map((a) => [a.id, clone(a)])),
  liveStartedAt: new Map<string, number>(),
  claimWindowEnd: now() + 2 * 86400 + 3 * 3600,
  scans: 0,
};

/** Simulated device grant: live approvals flip after ~12s of polling. */
function fxApproval(id: string): Approval {
  const a = fxState.approvals.get(id);
  if (!a) throw new ApiError(404, `Approval ${id} not found`);
  if (a.expiresAt === 0) a.expiresAt = now() + 5 * 60;
  if (a.status === 'pending' && (id.startsWith('apr-live') || id.startsWith('apr-req-'))) {
    const started = fxState.liveStartedAt.get(id) ?? now();
    fxState.liveStartedAt.set(id, started);
    if (now() - started >= 12) {
      if (id === 'apr-live-deny') a.status = 'denied';
      else {
        a.status = 'approved';
        a.publishTxHash = `0x${'5e1f'.repeat(16)}`;
      }
    }
  }
  if (a.status === 'pending' && now() >= a.expiresAt) a.status = 'expired';
  return clone(a);
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const fixtureApi = {
  async health() {
    return { ok: true as const };
  },
  async getReports(): Promise<Report[]> {
    await delay();
    return clone(fxState.reports);
  },
  async getReport(id: string): Promise<Report> {
    await delay();
    const r = fxState.reports.find((x) => x.id === id);
    if (!r) throw new ApiError(404, `Report ${id} not found`);
    return clone(r);
  },
  async requestApproval(reportId: string): Promise<Approval> {
    await delay(500);
    const r = fxState.reports.find((x) => x.id === reportId);
    if (!r) throw new ApiError(404, `Report ${reportId} not found`);
    if (r.status === 'published') throw new ApiError(409, 'This report is already published.');
    const id = `apr-req-${reportId}-${now()}`;
    const a: Approval = {
      id,
      reportId,
      manifestHash: r.manifestHash,
      status: 'pending',
      userCode: `${reportId.slice(4, 8).toUpperCase().padEnd(4, 'X')}-${String(now()).slice(-4)}`,
      verificationUri: `https://world.org/verify?code=${id}`,
      expiresAt: now() + 5 * 60,
    };
    fxState.approvals.set(id, a);
    r.status = 'awaiting_approval';
    r.approvalId = id;
    return clone(a);
  },
  async getApproval(id: string): Promise<Approval> {
    await delay(120);
    return fxApproval(id);
  },
  async getClaim(claimId: string): Promise<ClaimView> {
    await delay();
    const c = fx.claims.find((x) => x.claimId === claimId);
    if (!c) throw new ApiError(404, `Claim ${claimId} not found`);
    const out = clone(c);
    if (out.windowEnd === 0) out.windowEnd = fxState.claimWindowEnd;
    return out;
  },
  async getDeployments(): Promise<Deployments> {
    return clone(fx.fixtureDeployments);
  },
  async demoScan(): Promise<unknown> {
    await delay(1600);
    fxState.scans += 1;
    const base = fxState.reports.find((r) => r.id === 'rpt-lantern')!;
    const r: Report = clone({ ...base, id: `rpt-scan-${fxState.scans}`, createdAt: now() });
    r.manifest.createdAt = r.createdAt;
    fxState.reports.unshift(r);
    return { ok: true, reportId: r.id };
  },
};

// ----------------------------------------------------------------- live API

const liveApi: typeof fixtureApi = {
  health: () => http<{ ok: true }>('/health'),
  getReports: () => http<Report[]>('/reports'),
  getReport: (id) => http<Report>(`/reports/${encodeURIComponent(id)}`),
  requestApproval: (id) => http<Approval>(`/reports/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  getApproval: (id) => http<Approval>(`/approvals/${encodeURIComponent(id)}`),
  getClaim: (claimId) => http<ClaimView>(`/claims/${encodeURIComponent(claimId)}`),
  getDeployments: () => http<Deployments>('/deployments'),
  demoScan: () => http<unknown>('/demo/scan', { method: 'POST' }),
};

type Api = typeof fixtureApi;

/** Every method picks live vs fixtures on call, so a backend that comes up later is picked up on reload. */
export const api: Api = new Proxy({} as Api, {
  get(_t, key: keyof Api) {
    return async (...args: unknown[]) => {
      const impl = (await usingFixtures()) ? fixtureApi : liveApi;
      return (impl[key] as (...a: unknown[]) => unknown)(...args);
    };
  },
});
