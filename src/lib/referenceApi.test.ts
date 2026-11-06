import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAIR, metadataFor, tokenDailyText } from '@/test/referenceFixtures';
import { ApiError } from './api';
import { adminToken, reportKey } from './adminToken';
import { sha256Hex } from './hash';
import {
  allowedCaseActions,
  referenceReaderHref,
  toReferenceCase,
  type PublicCaseItem,
} from './reference';
import { IntegrityError, parseMetadata, readerErrorKind, referenceApi } from './referenceApi';

type Call = { url: string; init: RequestInit };
let calls: Call[];
let reply: (url: string) => Response | Promise<Response>;
const TOKEN = 'sas_' + 'r'.repeat(32);
const OTHER = 'sas_' + 'o'.repeat(32);
const json = (b: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

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
    return reply(url);
  });
  adminToken.set(reportKey(PAIR.report_id, PAIR.report_version), TOKEN);
  adminToken.set(reportKey('other-report', 'v1'), OTHER);
});
afterEach(() => vi.unstubAllGlobals());

const PATH = 'evidence/graph/token_daily.json';

describe('reference reader client', () => {
  it('reads metadata with this report’s own session and validates the pinned binding', async () => {
    const meta = metadataFor({});
    reply = () => json(meta);
    const m = await referenceApi.metadata(PAIR.report_id, PAIR.report_version);
    expect(m.symbol).toBe('SPX');
    expect(calls[0].url).toBe(
      `http://127.0.0.1:8000/web/v1/admin/reference-reports/${PAIR.report_id}/${PAIR.report_version}`,
    );
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(calls.every((c) => (c.init.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('rejects wrong schemas, other reports, rebound hashes and unsafe file lists', () => {
    const ok = metadataFor({});
    expect(() =>
      parseMetadata({ ...ok, schema: 'x' }, PAIR.report_id, PAIR.report_version),
    ).toThrow(ApiError);
    expect(() => parseMetadata(ok, 'case-reference_fet', PAIR.report_version)).toThrow(
      IntegrityError,
    );
    expect(() =>
      parseMetadata({ ...ok, report_sha256: '0'.repeat(64) }, PAIR.report_id, PAIR.report_version),
    ).toThrow(IntegrityError);
    expect(() =>
      parseMetadata({ ...ok, case_id: 'f'.repeat(64) }, PAIR.report_id, PAIR.report_version),
    ).toThrow(IntegrityError);
    expect(() =>
      parseMetadata(
        metadataFor({ '../secret': 'a'.repeat(64) }),
        PAIR.report_id,
        PAIR.report_version,
      ),
    ).toThrow(IntegrityError);
    expect(() =>
      parseMetadata(
        { ...ok, files: { 'report.json': 'a'.repeat(64) } },
        PAIR.report_id,
        PAIR.report_version,
      ),
    ).toThrow(IntegrityError);
    expect(() =>
      parseMetadata(
        { ...ok, file_base: 'https://evil.example/' },
        PAIR.report_id,
        PAIR.report_version,
      ),
    ).toThrow(IntegrityError);
  });

  it.each([
    [401, 'signed_out'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'integrity'],
    [500, 'unknown'],
  ])('maps HTTP %i to the %s state', async (status, kind) => {
    reply = () => json({ detail: 'nope' }, status);
    const err = await referenceApi.metadata(PAIR.report_id, PAIR.report_version).catch((e) => e);
    expect(readerErrorKind(err)).toBe(kind);
    expect(err.message).toBe('nope');
  });

  it('maps a network failure to the network state', async () => {
    reply = () => {
      throw new TypeError('fetch failed');
    };
    const err = await referenceApi.metadata(PAIR.report_id, PAIR.report_version).catch((e) => e);
    expect(readerErrorKind(err)).toBe('network');
  });

  it('returns a file only when its recomputed SHA-256 matches the files map', async () => {
    const sha = await sha256Hex(tokenDailyText);
    const meta = metadataFor({ [PATH]: sha });
    reply = () =>
      new Response(tokenDailyText, {
        headers: { 'X-File-SHA256': sha, 'X-Report-SHA256': PAIR.report_sha256 },
      });
    const f = await referenceApi.file(meta, PATH);
    expect(f.text).toBe(tokenDailyText);
    expect(f.sha256).toBe(sha);
    expect(calls[0].url).toBe(
      `http://127.0.0.1:8000/web/v1/admin/reference-reports/${PAIR.report_id}/${PAIR.report_version}/files/evidence/graph/token_daily.json`,
    );
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('refuses tampered bytes, a mismatching header and unlisted paths', async () => {
    const sha = await sha256Hex(tokenDailyText);
    const meta = metadataFor({ [PATH]: sha });
    reply = () => new Response(tokenDailyText + ' ');
    await expect(referenceApi.file(meta, PATH)).rejects.toBeInstanceOf(IntegrityError);
    reply = () => new Response(tokenDailyText, { headers: { 'X-File-SHA256': 'b'.repeat(64) } });
    await expect(referenceApi.file(meta, PATH)).rejects.toBeInstanceOf(IntegrityError);
    reply = () => new Response(tokenDailyText, { headers: { 'X-Report-SHA256': 'b'.repeat(64) } });
    await expect(referenceApi.file(meta, PATH)).rejects.toBeInstanceOf(IntegrityError);
    const before = calls.length;
    await expect(referenceApi.file(meta, 'evidence/other.json')).rejects.toBeInstanceOf(
      IntegrityError,
    );
    expect(calls.length).toBe(before); // never requested
  });

  it('a synthetic report.json cannot pass as the pinned report hash', async () => {
    reply = () => new Response('{"schema_version":"0.2"}');
    const err = await referenceApi.file(metadataFor({}), 'report.json').catch((e) => e);
    expect(readerErrorKind(err)).toBe('integrity');
  });

  it('a 409 from the file route is an integrity failure', async () => {
    reply = () => json({ detail: 'bundle hash mismatch' }, 409);
    const err = await referenceApi
      .file(metadataFor({ [PATH]: 'a'.repeat(64) }), PATH)
      .catch((e) => e);
    expect(err).toBeInstanceOf(IntegrityError);
  });

  it('reads the public case list without a session header', async () => {
    reply = () =>
      json({
        schema_version: 'scouting-case-list/2',
        cases: [{ case_id: 'a', candidate_id: 'b', reference: null }],
      });
    const cases = await referenceApi.cases('/api/research/scouting/cases');
    expect(cases).toHaveLength(1);
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBeNull();
    reply = () => json({ nope: true });
    await expect(referenceApi.cases('/api/research/scouting/cases')).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(referenceApi.cases(null)).rejects.toBeInstanceOf(ApiError);
  });
});

// Producer/consumer conformance against backend response samples saved locally. Never runs in CI and copies nothing
// into the repository: set REFERENCE_CONTRACT_SAMPLES to the directory holding the backend's sample JSON files.
const samples = process.env.REFERENCE_CONTRACT_SAMPLES;
describe.skipIf(!samples || !existsSync(samples))(
  'backend contract samples (env-gated, local only)',
  () => {
    const read = (f: string) => JSON.parse(readFileSync(path.join(samples!, f), 'utf8'));
    it('public case list yields the six cards with exact reader links and no actions', () => {
      const items = read('public-scouting-cases.json').cases as PublicCaseItem[];
      const refs = items.map(toReferenceCase).filter(Boolean);
      expect(refs).toHaveLength(6);
      for (const c of refs) {
        expect(c!.reports).toHaveLength(1);
        expect(c!.mismatched).toEqual([]);
        expect(referenceReaderHref(c!.reports[0])).toBe(
          `/admin/reviews/${c!.pair.report_id}/${c!.pair.report_version}/reference`,
        );
        expect(allowedCaseActions(c!.item)).toEqual([]);
        expect(c!.item.continuation?.action_url ?? null).toBeNull();
      }
    });
    it.each(['admin-reference-report-shib.json', 'admin-reference-report-fet.json'])(
      '%s passes metadata validation',
      (f) => {
        const m = read(f);
        const parsed = parseMetadata(m, m.report_id, m.report_version);
        expect(parsed.files['report.json']).toBe(parsed.report_sha256);
        expect(parsed.world_verified).toBe(false);
      },
    );
    it('error bodies map to explicit states', () => {
      const errors = read('admin-error-bodies.json') as Record<
        string,
        { status: number; body: { detail: string } }
      >;
      for (const e of Object.values(errors)) {
        const kind = readerErrorKind(new ApiError(e.status, e.body.detail));
        expect(kind).toBe(
          { 401: 'signed_out', 403: 'forbidden', 404: 'not_found', 409: 'integrity' }[e.status],
        );
      }
    });
  },
);
