'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { scoutingOrigin } from '@/lib/scouting';
type View = {
  schema: string;
  state: string;
  user_code?: string;
  verification_uri?: string;
  interval?: number;
  expires_at?: number;
  scopes?: string[];
  label?: string | null;
};
type Context = {
  token: string | null;
  view: View | null;
  start: () => Promise<void>;
  end: () => Promise<void>;
  retry: () => void;
  error: string;
  busy: boolean;
};
const Session = createContext<Context | null>(null);
export function parseAdminSession(value: unknown): View {
  if (!value || typeof value !== 'object') throw new Error('Invalid admin session');
  const x = value as View;
  if (
    x.schema !== 'scooby.admin-session/1' ||
    ![
      'pending',
      'active',
      'denied',
      'expired',
      'cancelled',
      'not_permitted',
      'failed',
      'revoked',
    ].includes(x.state)
  )
    throw new Error('Invalid admin session');
  if (x.state === 'pending') {
    if (
      typeof x.user_code !== 'string' ||
      typeof x.interval !== 'number' ||
      !Number.isFinite(x.interval) ||
      x.interval < 1 ||
      typeof x.expires_at !== 'number' ||
      !Number.isFinite(x.expires_at) ||
      typeof x.verification_uri !== 'string'
    )
      throw new Error('Invalid confirmation');
    const u = new URL(x.verification_uri);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      !(u.hostname === 'world.org' || u.hostname.endsWith('.world.org'))
    )
      throw new Error('Untrusted World ID address');
  }
  if (
    x.state === 'active' &&
    (!Array.isArray(x.scopes) ||
      !x.scopes.every((s) => ['case_investigation', 'report_review', 'publication'].includes(s)))
  )
    throw new Error('Invalid admin permissions');
  return x;
}
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  const starting = useRef(false);
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError('');
    try {
      if (!scoutingOrigin) throw new Error('Admin service is not configured.');
      const r = await fetch(scoutingOrigin + '/web/v1/admin/session', {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error('Admin sign-in is unavailable.');
      const body = await r.json();
      const v = parseAdminSession(body);
      if (
        typeof body.session_token !== 'string' ||
        !/^sas_[A-Za-z0-9_-]{20,}$/.test(body.session_token) ||
        v.state !== 'pending'
      )
        throw new Error('Invalid admin session');
      setToken(body.session_token);
      const { session_token: _discarded, ...visible } = body;
      void _discarded;
      setView(parseAdminSession(visible));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Admin sign-in unavailable.');
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }
  async function end() {
    const current = token;
    setToken(null);
    setView(null);
    if (current && scoutingOrigin)
      try {
        await fetch(scoutingOrigin + '/web/v1/admin/session', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${current}` },
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        setError('Session could not be revoked remotely.');
      }
  }
  useEffect(() => {
    if (!token || view?.state !== 'pending' || !scoutingOrigin) return;
    let cancelled = false;
    const t = setTimeout(
      async () => {
        try {
          const r = await fetch(scoutingOrigin + '/web/v1/admin/session', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw new Error('Could not check admin sign-in.');
          const next = parseAdminSession(await r.json());
          if (!cancelled) {
            setView(next);
            setError('');
            if (!['pending', 'active'].includes(next.state)) setToken(null);
          }
        } catch (e) {
          if (!cancelled)
            setError(e instanceof Error ? e.message : 'Could not check admin sign-in.');
        }
      },
      (view.interval || 5) * 1000,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, view, pollRevision]);
  return (
    <Session.Provider
      value={{ token, view, start, end, error, busy, retry: () => setPollRevision((n) => n + 1) }}
    >
      {children}
    </Session.Provider>
  );
}
export function useAdminSession() {
  const value = useContext(Session);
  if (!value) throw new Error('Missing admin session provider');
  return value;
}
export function AdminSignIn() {
  const { token, view, start, end, retry, error, busy } = useAdminSession();
  return (
    <section
      className="border-line bg-surface mt-6 rounded-xl border p-4"
      aria-label="Administrator sign-in"
    >
      <h2 className="font-semibold">Administrator sign-in</h2>
      <p className="text-muted mt-1 text-sm">
        World ID identifies the administrator; server-side permissions determine allowed actions.
      </p>
      {!token && (
        <button
          type="button"
          disabled={busy}
          className="text-beam-ink mt-2 underline disabled:opacity-60"
          onClick={() => void start()}
        >
          {busy ? 'Starting…' : 'Start admin sign-in'}
        </button>
      )}
      {view?.state === 'pending' && (
        <p className="mt-2 text-sm">
          Confirm code <strong>{view.user_code}</strong> in{' '}
          <a
            href={view.verification_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            World ID
          </a>
          . Waiting for confirmation…
        </p>
      )}
      {view?.state === 'active' && (
        <p className="mt-2 text-sm">
          Signed in: {view.label || 'administrator'} · {view.scopes?.join(', ')}
        </p>
      )}
      {token && (
        <button type="button" className="mt-2 block text-sm underline" onClick={() => void end()}>
          Sign out
        </button>
      )}
      {view && !['pending', 'active'].includes(view.state) && (
        <p role="status" className="mt-2 text-sm">
          Sign-in {view.state.replaceAll('_', ' ')}.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
          {token && view?.state === 'pending' && (
            <button type="button" className="ml-2 underline" onClick={retry}>
              Retry status check
            </button>
          )}
        </p>
      )}
    </section>
  );
}
