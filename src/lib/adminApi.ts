// Typed client for the backend review desk, /web/v1/admin (ScoobyDAO-backend publication/admin_routes.py and the
// SME file routes in app.py; contract: schemas/runtime/admin-checkpoints-v1.schema.json). Display only: the backend
// decides who may sign in and whether a decision counts, and every decision needs its own World App confirmation.
//   GET /review-queue (anonymous) · POST/GET/DELETE /admin/session (per report) · GET /admin/reviews/:id/:version
//   GET /admin/reviews/:id/:version/artifacts · GET …/files/:name · POST …/attempts · POST …/revoke
//   GET /admin/review-attempts/:id · POST /admin/review-attempts/:id/cancel
import { ApiError } from './api';
import { adminAuthHeader, adminToken, reportKey } from './adminToken';
import { env } from './env';

export { adminAuthHeader, adminToken, reportKey };

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

/**
 * Backend file paths (/web/v1/admin/…) resolved through the configured API base, so they work both with an absolute
 * NEXT_PUBLIC_API_URL (…/web/v1) and with the same-origin proxy (/api/backend).
 */
export function backendUrl(path: string): string {
  if (path.startsWith('/web/v1/')) return `${env.apiUrl}${path.slice('/web/v1'.length)}`;
  return path;
}

async function call(
  path: string,
  init: RequestInit = {},
  report?: string | null,
): Promise<Response> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...adminAuthHeader(report),
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

export interface PublicQueueItem {
  report_id: string;
  report_version: string;
  report_sha256: string;
  created: number;
  state: ReviewState;
}

export const adminApi = {
  /** Anonymous list for the Read buttons: ids, versions, report hashes and review states only. */
  async publicQueue(): Promise<{ items: PublicQueueItem[] }> {
    const body = (await (await call('/review-queue')).json()) as {
      schema?: string;
      items?: PublicQueueItem[];
    };
    if (body?.schema !== 'scooby.review-queue-public/1' || !Array.isArray(body.items))
      throw new ApiError(
        502,
        'Unexpected response from the review desk (expected scooby.review-queue-public/1)',
      );
    return { items: body.items };
  },
  /**
   * Read button: starts a World login limited to one report version. The token is returned once; it is stored for
   * that report and stays inactive until World confirms.
   */
  async startSession(id: string, version: string): Promise<AdminSession> {
    const s = expectSchema<AdminSession>(
      await (
        await call('/admin/session', {
          method: 'POST',
          body: JSON.stringify({ report_id: id, version }),
        })
      ).json(),
      'scooby.admin-session/1',
    );
    if (s.session_token) adminToken.set(reportKey(id, version), s.session_token);
    return s;
  },
  async getSession(report: string): Promise<AdminSession> {
    return expectSchema<AdminSession>(
      await (await call('/admin/session', {}, report)).json(),
      'scooby.admin-session/1',
    );
  },
  async endSession(report: string): Promise<void> {
    try {
      await call('/admin/session', { method: 'DELETE' }, report);
    } finally {
      adminToken.clear(report);
    }
  },
  async review(id: string, version: string): Promise<ReviewDetail> {
    return expectSchema<ReviewDetail>(
      await (await call(reviewPath(id, version), {}, reportKey(id, version))).json(),
      'scooby.admin-review/1',
    );
  },
  async artifacts(id: string, version: string): Promise<ReviewArtifacts> {
    return (await (
      await call(`${reviewPath(id, version)}/artifacts`, {}, reportKey(id, version))
    ).json()) as ReviewArtifacts;
  },
  /** Fetches a rendered file with the report's session header (a plain link cannot send it) and returns its bytes. */
  async file(report: string, url: string): Promise<Blob> {
    const res = await fetch(backendUrl(url), {
      headers: adminAuthHeader(report),
      cache: 'no-store',
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
    const res = await call(
      `${reviewPath(id, version)}/attempts`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey() },
      },
      reportKey(id, version),
    );
    return expectSchema<ReviewAttempt>(await res.json(), 'scooby.admin-review-attempt/1');
  },
  async attempt(report: string, attemptId: string): Promise<ReviewAttempt> {
    return expectSchema<ReviewAttempt>(
      await (await call(`/admin/review-attempts/${enc(attemptId)}`, {}, report)).json(),
      'scooby.admin-review-attempt/1',
    );
  },
  async cancelAttempt(report: string, attemptId: string): Promise<ReviewAttempt> {
    const res = await call(
      `/admin/review-attempts/${enc(attemptId)}/cancel`,
      { method: 'POST' },
      report,
    );
    return expectSchema<ReviewAttempt>(await res.json(), 'scooby.admin-review-attempt/1');
  },
  async revoke(id: string, version: string, reason: string): Promise<unknown> {
    return (
      await call(
        `${reviewPath(id, version)}/revoke`,
        { method: 'POST', body: JSON.stringify({ reason }) },
        reportKey(id, version),
      )
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
