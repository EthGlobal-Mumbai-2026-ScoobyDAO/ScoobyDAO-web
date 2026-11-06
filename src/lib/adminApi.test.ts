import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { adminApi, adminToken, backendUrl } from './adminApi';

const TOKEN = 'sas_' + 'a'.repeat(32);
type Call = { url: string; init: RequestInit };
let calls: Call[];
let reply: (url: string, init: RequestInit) => Response;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const headers = (c: Call) => new Headers(c.init.headers);

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

describe('review desk client', () => {
  it('stores the session token from a new sign-in and sends it on later calls', async () => {
    reply = (url) =>
      url.endsWith('/admin/session')
        ? jsonResponse({
            schema: 'scooby.admin-session/1',
            state: 'pending',
            session_token: TOKEN,
            user_code: 'ABCD-1234',
            interval: 5,
            expires_at: 1,
          })
        : jsonResponse({ schema: 'scooby.admin-review-queue/1', generated_at: 1, items: [] });
    const s = await adminApi.startSession();
    expect(s.state).toBe('pending');
    expect(calls[0].init.method).toBe('POST');
    expect(headers(calls[0]).get('Authorization')).toBeNull();
    expect(adminToken.get()).toBe(TOKEN);
    await adminApi.queue();
    expect(calls[1].url).toBe('http://127.0.0.1:8000/web/v1/admin/reviews');
    expect(headers(calls[1]).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('starts a decision with an idempotency key and the digest the reviewer saw', async () => {
    adminToken.set(TOKEN);
    reply = () =>
      jsonResponse({
        schema: 'scooby.admin-review-attempt/1',
        id: 'att-1',
        report_id: 'r',
        report_version: 'v1',
        target_digest: 'a'.repeat(64),
        decision: 'approve',
        reason: 'ok',
        status: 'pending',
        expires_at: 1,
        binding_digest: 'b'.repeat(64),
        binding: {},
      });
    await adminApi.startDecision('r/x', 'v1', {
      decision: 'approve',
      reason: 'ok',
      expected_target_digest: 'a'.repeat(64),
    });
    expect(calls[0].url).toBe('http://127.0.0.1:8000/web/v1/admin/reviews/r%2Fx/v1/attempts');
    expect(headers(calls[0]).get('Idempotency-Key')).toBeTruthy();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      decision: 'approve',
      reason: 'ok',
      expected_target_digest: 'a'.repeat(64),
    });
  });

  it('turns backend errors into ApiError with the backend detail, and rejects unexpected shapes', async () => {
    reply = () => jsonResponse({ detail: 'admin session required' }, 401);
    await expect(adminApi.getSession()).rejects.toMatchObject({
      status: 401,
      message: 'admin session required',
    });
    reply = () => jsonResponse({ schema: 'something-else/1' });
    const e = await adminApi.getSession().catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
  });

  it('signing out forgets the token even if the backend call fails', async () => {
    adminToken.set(TOKEN);
    reply = () => jsonResponse({ detail: 'down' }, 503);
    await expect(adminApi.endSession()).rejects.toBeInstanceOf(ApiError);
    expect(adminToken.get()).toBeNull();
  });

  it('fetches review files from the API origin with the session header', async () => {
    adminToken.set(TOKEN);
    reply = () => new Response('<p>report</p>', { status: 200 });
    const blob = await adminApi.file('/web/v1/admin/reviews/r/v1/files/index.html');
    expect(await blob.text()).toBe('<p>report</p>');
    expect(calls[0].url).toBe('http://127.0.0.1:8000/web/v1/admin/reviews/r/v1/files/index.html');
    expect(headers(calls[0]).get('Authorization')).toBe(`Bearer ${TOKEN}`);
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

  it('publication sign-off calls carry the review desk session', async () => {
    adminToken.set(TOKEN);
    reply = () => jsonResponse({ detail: 'admin scope publication required' }, 403);
    await expect(api.requestApproval('r@v1')).rejects.toMatchObject({ status: 403 });
    await expect(api.getApproval('att-1')).rejects.toMatchObject({ status: 403 });
    expect(calls.map((c) => headers(c).get('Authorization'))).toEqual([
      `Bearer ${TOKEN}`,
      `Bearer ${TOKEN}`,
    ]);
  });
});
