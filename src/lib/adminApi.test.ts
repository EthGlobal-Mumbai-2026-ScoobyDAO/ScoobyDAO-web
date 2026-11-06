import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { adminApi, adminToken, backendUrl, reportKey } from './adminApi';

const TOKEN_A = 'sas_' + 'a'.repeat(32);
const TOKEN_B = 'sas_' + 'b'.repeat(32);
const A = reportKey('ray-ref', 'v1');
const B = reportKey('hex', 'v2');
type Call = { url: string; init: RequestInit };
let calls: Call[];
let reply: (url: string, init: RequestInit) => Response;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const headers = (c: Call) => new Headers(c.init.headers);
const attempt = {
  schema: 'scooby.admin-review-attempt/1',
  id: 'att-1',
  report_id: 'ray-ref',
  report_version: 'v1',
  target_digest: 'a'.repeat(64),
  decision: 'approve',
  reason: 'ok',
  status: 'pending',
  expires_at: 1,
  binding_digest: 'b'.repeat(64),
  binding: {},
};

beforeEach(() => {
  calls = [];
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return reply(url, init);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('review desk client (per-report Read sessions)', () => {
  it('lists the queue anonymously', async () => {
    adminToken.set(A, TOKEN_A);
    reply = () =>
      jsonResponse({
        schema: 'scooby.review-queue-public/1',
        generated_at: 1,
        items: [
          {
            report_id: 'ray-ref',
            report_version: 'v1',
            report_sha256: 'c'.repeat(64),
            created: 1,
            state: 'pending_review',
          },
        ],
      });
    const q = await adminApi.publicQueue();
    expect(q.items).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:8000/web/v1/review-queue');
    expect(headers(calls[0]).get('Authorization')).toBeNull();
  });

  it('Read starts a login limited to one report and stores the token for that report only', async () => {
    reply = () =>
      jsonResponse({
        schema: 'scooby.admin-session/1',
        state: 'pending',
        session_token: TOKEN_A,
        user_code: 'ABCD-1234',
        interval: 5,
        expires_at: 1,
      });
    await adminApi.startSession('ray-ref', 'v1');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ report_id: 'ray-ref', version: 'v1' });
    expect(adminToken.get(A)).toBe(TOKEN_A);
    expect(adminToken.get(B)).toBeNull();
  });

  it('each report call carries that report’s own session', async () => {
    adminToken.set(A, TOKEN_A);
    adminToken.set(B, TOKEN_B);
    reply = () => jsonResponse({ schema: 'scooby.admin-review/1' });
    await adminApi.review('ray-ref', 'v1');
    await adminApi.review('hex', 'v2');
    expect(headers(calls[0]).get('Authorization')).toBe(`Bearer ${TOKEN_A}`);
    expect(headers(calls[1]).get('Authorization')).toBe(`Bearer ${TOKEN_B}`);
    expect(calls[1].url).toBe('http://127.0.0.1:8000/web/v1/admin/reviews/hex/v2');
  });

  it('starts a decision with an idempotency key, the digest the reviewer saw, and the report session', async () => {
    adminToken.set(A, TOKEN_A);
    reply = () => jsonResponse(attempt);
    await adminApi.startDecision('ray-ref', 'v1', {
      decision: 'approve',
      reason: 'ok',
      expected_target_digest: 'a'.repeat(64),
    });
    expect(calls[0].url).toBe('http://127.0.0.1:8000/web/v1/admin/reviews/ray-ref/v1/attempts');
    expect(headers(calls[0]).get('Idempotency-Key')).toBeTruthy();
    expect(headers(calls[0]).get('Authorization')).toBe(`Bearer ${TOKEN_A}`);
    await adminApi.attempt(A, 'att-1');
    expect(headers(calls[1]).get('Authorization')).toBe(`Bearer ${TOKEN_A}`);
  });

  it('turns backend errors into ApiError with the backend detail, and rejects unexpected shapes', async () => {
    reply = () => jsonResponse({ detail: 'admin session required' }, 401);
    await expect(adminApi.getSession(A)).rejects.toMatchObject({
      status: 401,
      message: 'admin session required',
    });
    reply = () => jsonResponse({ schema: 'something-else/1' });
    const e = await adminApi.getSession(A).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
  });

  it('closing a report forgets only its token, even if the backend call fails', async () => {
    adminToken.set(A, TOKEN_A);
    adminToken.set(B, TOKEN_B);
    reply = () => jsonResponse({ detail: 'down' }, 503);
    await expect(adminApi.endSession(A)).rejects.toBeInstanceOf(ApiError);
    expect(adminToken.get(A)).toBeNull();
    expect(adminToken.get(B)).toBe(TOKEN_B);
  });

  it('maps backend file paths through the configured API base (absolute or the /api/backend proxy)', async () => {
    adminToken.set(A, TOKEN_A);
    reply = () => new Response('<p>report</p>', { status: 200 });
    const blob = await adminApi.file(A, '/web/v1/admin/reviews/ray-ref/v1/files/index.html');
    expect(await blob.text()).toBe('<p>report</p>');
    expect(calls[0].url).toBe(
      'http://127.0.0.1:8000/web/v1/admin/reviews/ray-ref/v1/files/index.html',
    );
    expect(headers(calls[0]).get('Authorization')).toBe(`Bearer ${TOKEN_A}`);
    expect(backendUrl('/web/v1/x')).toBe('http://127.0.0.1:8000/web/v1/x');
  });

  it('routes protected files through the same-origin proxy without sending credentials elsewhere', () => {
    const path = '/web/v1/admin/reviews/r/v1/files/index.html';
    expect(backendUrl(path, '/api/backend')).toBe(
      '/api/backend/admin/reviews/r/v1/files/index.html',
    );
    expect(backendUrl(path, 'https://backend.example/web/v1')).toBe(
      'https://backend.example/web/v1/admin/reviews/r/v1/files/index.html',
    );
    for (const unsafe of [
      'https://evil.example/file',
      '//evil.example/file',
      '/web/v1/../escape',
      '/web/v1/%2e%2e/escape',
      '/web/v1/admin/x?redirect=evil',
    ]) {
      expect(() => backendUrl(unsafe, '/api/backend')).toThrow();
    }
  });

  it('publication sign-off uses the session of its report, also when polling the attempt', async () => {
    adminToken.set(A, TOKEN_A);
    reply = (url) =>
      url.endsWith('/approve')
        ? jsonResponse({ detail: 'admin scope publication required' }, 403)
        : jsonResponse({ detail: 'nope' }, 403);
    await expect(api.requestApproval(A)).rejects.toMatchObject({ status: 403 });
    expect(headers(calls[0]).get('Authorization')).toBe(`Bearer ${TOKEN_A}`);
    await expect(api.getApproval('unknown-attempt')).rejects.toMatchObject({ status: 403 });
    expect(headers(calls[1]).get('Authorization')).toBeNull();
  });
});
