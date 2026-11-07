// Review desk session tokens (see adminApi.ts). Kept separate so api.ts can send them without importing adminApi.
// Each report version is read through its own World confirmation ("Read" button), so each has its own session token,
// keyed by `<report_id>@<version>` (the same id the /web/v1 report adapter uses). Tokens live in sessionStorage only
// (cleared with the tab), never in a cookie.
import { migrateStorageKey } from './storageKeys';

const TOKENS_KEY = 'scoobydao.review-sessions';
const ATTEMPTS_KEY = 'scoobydao.publication-attempts';
const OLD_KEYS: Record<string, string> = {
  [TOKENS_KEY]: 'unmasked.review-sessions',
  [ATTEMPTS_KEY]: 'unmasked.publication-attempts',
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const reportKey = (reportId: string, version: string) => `${reportId}@${version}`;

function readMap(key: string): Record<string, string> {
  if (OLD_KEYS[key]) migrateStorageKey('session', OLD_KEYS[key], key);
  try {
    if (typeof window === 'undefined') return {};
    const v = JSON.parse(window.sessionStorage.getItem(key) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeMap(key: string, map: Record<string, string>) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage blocked: the session only lasts for this page */
  }
}

export const adminToken = {
  get(report: string): string | null {
    return readMap(TOKENS_KEY)[report] ?? null;
  },
  set(report: string, token: string) {
    writeMap(TOKENS_KEY, { ...readMap(TOKENS_KEY), [report]: token });
    notify();
  },
  clear(report: string) {
    const map = readMap(TOKENS_KEY);
    delete map[report];
    writeMap(TOKENS_KEY, map);
    notify();
  },
  /** For useSyncExternalStore: called whenever a token is set or cleared in this tab. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Authorization header for the session of one report version, if this tab has one. */
export function adminAuthHeader(report: string | null | undefined): Record<string, string> {
  const t = report ? adminToken.get(report) : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Publication sign-off attempts (GET /approvals/:id) are read with the session of the report they belong to. */
export const publicationAttempts = {
  remember(attemptId: string, report: string) {
    writeMap(ATTEMPTS_KEY, { ...readMap(ATTEMPTS_KEY), [attemptId]: report });
  },
  reportFor(attemptId: string): string | null {
    return readMap(ATTEMPTS_KEY)[attemptId] ?? null;
  },
};
