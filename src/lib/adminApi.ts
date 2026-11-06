// Typed client for the backend review desk, /web/v1/admin (ScoobyDAO-backend publication/admin_routes.py and the
// SME file routes in app.py; contract: schemas/runtime/admin-checkpoints-v1.schema.json). Display only: the backend
// decides who may sign in and whether a decision counts, and every decision needs its own World App confirmation.
//   POST/GET/DELETE /admin/session · GET /admin/reviews · GET /admin/reviews/:id/:version
//   GET /admin/reviews/:id/:version/artifacts · GET …/files/:name · POST …/attempts · POST …/revoke
//   GET /admin/review-attempts/:id · POST /admin/review-attempts/:id/cancel
import { ApiError } from './api';
import { adminAuthHeader, adminToken } from './adminToken';
import { env } from './env';

export { adminAuthHeader, adminToken };

// ---------------------------------------------------------------- shapes (snake_case, as the backend sends them)

export type AdminScope = 'case_investigation' | 'report_review' | 'publication';
export type SessionState =
  | 'pending'
  | 'active'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'not_permitted'
  | 'failed'
  | 'revoked';
export type ReviewState =
  | 'pending_review'
  | 'awaiting_confirmation'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'unavailable';
export type Decision = 'approve' | 'reject' | 'revise';
export type AttemptStatus =
  | 'pending'
  | 'confirmed'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'not_permitted'
  | 'failed'
  | 'superseded';

export interface AdminSession {
  schema: 'scooby.admin-session/1';
  state: SessionState;
  session_token?: string;
  user_code?: string;
  verification_uri?: string;
  interval?: number;
  expires_at?: number;
  label?: string | null;
  scopes?: AdminScope[];
  detail?: string;
}

export interface QueueItem {
  report_id: string;
  report_version: string;
  report_sha256: string;
  created: number;
  target_digest: string | null;
  candidate_id: string | null;
  case_id: string | null;
  state: ReviewState;
  decision: Decision | null;
  decided_at: number | null;
  detail: string | null;
}

export interface ReviewQueue {
  schema: 'scooby.admin-review-queue/1';
  generated_at: number;
  items: QueueItem[];
}

export interface DecisionRecord {
  receipt_id: string;
  decision: Decision;
  reason: string;
  decided_at: number;
  reviewer: string | null;
  acr: string;
  method: 'world_proof' | 'passkey';
  target_digest: string;
  current_target: boolean;
  revoked_at: number | null;
  revoke_reason: string | null;
}

export interface ReviewAttempt {
  schema: 'scooby.admin-review-attempt/1';
  id: string;
  report_id: string;
  report_version: string;
  target_digest: string;
  decision: Decision;
  reason: string;
  status: AttemptStatus;
  expires_at: number;
  binding_digest: string;
  user_code?: string;
  verification_uri?: string;
  interval?: number;
  detail?: string;
  receipt?: { id: string; decision: Decision; decided_at: number };
}

export interface ReviewSummary {
  assessment?: {
    status?: string | null;
    label?: string | null;
    summary?: string | null;
    unknowns?: unknown;
  };
  pillars?: { pillar: string; status?: string | null; summary?: string | null }[];
  limitations?: unknown[];
  evidence?: { id?: string; kind?: string; coverage?: string; path?: string; sha256?: string }[];
}

export interface ReviewDetail {
  schema: 'scooby.admin-review/1';
  report_id: string;
  report_version: string;
  report_sha256: string;
  state: ReviewState;
  target: Record<string, unknown> | null;
  target_digest: string | null;
  integrity: string;
  summary: ReviewSummary | null;
  decisions: DecisionRecord[];
  pending_attempt: ReviewAttempt | null;
  links: { artifacts?: string; public_artifacts?: string };
}

export interface ArtifactRef {
  availability: 'available' | 'unavailable';
  sha256: string | null;
  url: string | null;
}

export interface ReviewArtifacts {
  render_status: string;
  artifacts: { html?: ArtifactRef; markdown?: ArtifactRef; pdf?: ArtifactRef };
}

// ---------------------------------------------------------------- transport

/** Map backend-relative paths through the configured API base, including the same-origin proxy. */
export function backendUrl(path: string, apiBase = env.apiUrl): string {
  if (
    !path.startsWith('/web/v1/') ||
    /[?#\\]/.test(path) ||
    /%(?:2e|2f|5c)/i.test(path) ||
    path.split('/').some((part) => part === '.' || part === '..')
  )
    throw new Error('Invalid report file path');
  if (apiBase.startsWith('/')) {
    if (
      !/^\/(?!\/)[A-Za-z0-9/_-]+$/.test(apiBase) ||
      apiBase.split('/').some((part) => part === '..')
    )
      throw new Error('Invalid API base');
  } else {
    const base = new URL(apiBase);
    if (
      !['https:', 'http:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/web/v1'
    )
      throw new Error('Invalid API base');
  }
  return apiBase + path.slice('/web/v1'.length);
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...adminAuthHeader(),
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `${init.method ?? 'GET'} ${path} failed with ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') msg = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return res;
}

function expectSchema<T extends { schema: string }>(value: unknown, schema: T['schema']): T {
  if (!value || typeof value !== 'object' || (value as { schema?: unknown }).schema !== schema)
    throw new ApiError(502, `Unexpected response from the review desk (expected ${schema})`);
  return value as T;
}

const enc = encodeURIComponent;
const reviewPath = (id: string, version: string) => `/admin/reviews/${enc(id)}/${enc(version)}`;
const idempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const adminApi = {
  /** Starts a World login. The token is returned once; it is stored and stays inactive until World confirms. */
  async startSession(): Promise<AdminSession> {
    const s = expectSchema<AdminSession>(
      await (await call('/admin/session', { method: 'POST' })).json(),
      'scooby.admin-session/1',
    );
    if (s.session_token) adminToken.set(s.session_token);
    return s;
  },
  async getSession(): Promise<AdminSession> {
    return expectSchema<AdminSession>(
      await (await call('/admin/session')).json(),
      'scooby.admin-session/1',
    );
  },
  async endSession(): Promise<void> {
    try {
      await call('/admin/session', { method: 'DELETE' });
    } finally {
      adminToken.clear();
    }
  },
  async queue(): Promise<ReviewQueue> {
    return expectSchema<ReviewQueue>(
      await (await call('/admin/reviews')).json(),
      'scooby.admin-review-queue/1',
    );
  },
  async review(id: string, version: string): Promise<ReviewDetail> {
    return expectSchema<ReviewDetail>(
      await (await call(reviewPath(id, version))).json(),
      'scooby.admin-review/1',
    );
  },
  async artifacts(id: string, version: string): Promise<ReviewArtifacts> {
    return (await (await call(`${reviewPath(id, version)}/artifacts`)).json()) as ReviewArtifacts;
  },
  /** Fetches a rendered file with the session header (a plain link cannot send it) and returns its bytes. */
  async file(url: string): Promise<Blob> {
    const res = await fetch(backendUrl(url), {
      headers: adminAuthHeader(),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!res.ok)
      throw new ApiError(res.status, `Couldn't load ${url.split('/').pop()} (${res.status})`);
    return res.blob();
  },
  async startDecision(
    id: string,
    version: string,
    body: { decision: Decision; reason: string; expected_target_digest: string },
  ): Promise<ReviewAttempt> {
    const res = await call(`${reviewPath(id, version)}/attempts`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': idempotencyKey() },
    });
    return expectSchema<ReviewAttempt>(await res.json(), 'scooby.admin-review-attempt/1');
  },
  async attempt(attemptId: string): Promise<ReviewAttempt> {
    return expectSchema<ReviewAttempt>(
      await (await call(`/admin/review-attempts/${enc(attemptId)}`)).json(),
      'scooby.admin-review-attempt/1',
    );
  },
  async cancelAttempt(attemptId: string): Promise<ReviewAttempt> {
    const res = await call(`/admin/review-attempts/${enc(attemptId)}/cancel`, { method: 'POST' });
    return expectSchema<ReviewAttempt>(await res.json(), 'scooby.admin-review-attempt/1');
  },
  async revoke(id: string, version: string, reason: string): Promise<unknown> {
    return (
      await call(`${reviewPath(id, version)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
    ).json();
  },
};

export const FINAL_ATTEMPT: AttemptStatus[] = [
  'confirmed',
  'denied',
  'expired',
  'cancelled',
  'not_permitted',
  'failed',
  'superseded',
];
export const FINAL_SESSION: SessionState[] = [
  'denied',
  'expired',
  'cancelled',
  'not_permitted',
  'failed',
  'revoked',
];

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  pending_review: 'Waiting for review',
  awaiting_confirmation: 'Waiting for World App',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision requested',
  unavailable: 'Unavailable (integrity check failed)',
};

export const DECISION_LABEL: Record<Decision, string> = {
  approve: 'Approve',
  reject: 'Reject',
  revise: 'Request revision',
};
