// Admin review-desk session token (see adminApi.ts). Kept separate so api.ts can send it without importing adminApi.
const TOKEN_KEY = 'unmasked.admin-session';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** The session bearer token lives in sessionStorage only (cleared with the tab); never in a cookie. */
export const adminToken = {
  get(): string | null {
    try {
      return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked: the session only lasts for this page */
    }
    notify();
  },
  clear() {
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
    notify();
  },
  /** For useSyncExternalStore: called whenever the token is set or cleared in this tab. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Authorization header for the current admin session, if any. */
export function adminAuthHeader(): Record<string, string> {
  const t = adminToken.get();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
