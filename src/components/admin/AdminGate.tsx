'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LogOut, ScanEye } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Banner } from '@/components/Banner';
import { Countdown } from '@/components/Countdown';
import { ApiError } from '@/lib/api';
import { adminApi, adminToken, FINAL_SESSION, type AdminSession } from '@/lib/adminApi';

export const adminSessionKey = ['admin-session'] as const;

const ENDED: Record<string, { title: string; body: string }> = {
  denied: {
    title: 'Sign-in denied in World App',
    body: 'Nothing was opened. Start again to sign in.',
  },
  expired: { title: 'The sign-in code expired', body: 'Start again for a new code.' },
  cancelled: { title: 'Sign-in cancelled', body: 'Start again to sign in.' },
  not_permitted: {
    title: "This World ID can't use the review desk",
    body: 'The backend did not grant it a review permission. Check that the World ID is Orb-verified and linked to a World ID account.',
  },
  failed: {
    title: "World couldn't confirm the sign-in",
    body: 'Nothing was opened. Start again to sign in.',
  },
  revoked: { title: 'Signed out', body: 'Sign in again to continue.' },
};

/**
 * Review desk sign-in. Anyone may start a World login; the backend decides whether the confirmed World ID may
 * review (any validated World ID when SCOOBY_OPEN_REVIEW is on). Children render only for an active session.
 */
export function AdminGate({ children }: { children: (session: AdminSession) => ReactNode }) {
  const qc = useQueryClient();
  // Server render and first paint have no token (sessionStorage is client-only).
  const hasToken = useSyncExternalStore(
    adminToken.subscribe,
    () => !!adminToken.get(),
    () => false,
  );

  const session = useQuery({
    queryKey: adminSessionKey,
    queryFn: () => adminApi.getSession(),
    enabled: hasToken,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.state === 'pending' ? Math.max(2, q.state.data.interval ?? 5) * 1000 : false,
    refetchIntervalInBackground: true,
  });
  const start = useMutation({
    mutationFn: () => adminApi.startSession(),
    onSuccess: (s) => qc.setQueryData(adminSessionKey, s),
  });
  const signOut = useMutation({
    mutationFn: () => adminApi.endSession(),
    onSettled: () => qc.removeQueries({ queryKey: adminSessionKey }),
  });

  // An unknown or expired token: forget it and offer a fresh sign-in.
  const unauthorized = session.error instanceof ApiError && session.error.status === 401;
  useEffect(() => {
    if (unauthorized) adminToken.clear();
  }, [unauthorized]);

  const s = hasToken ? session.data : undefined;
  if (s?.state === 'active')
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Signed in with World ID
            {s.label ? (
              <>
                {' '}
                as <span className="text-text font-semibold">{s.label}</span>
              </>
            ) : null}
            {s.scopes?.length ? <> · {s.scopes.join(', ')}</> : null}
            {s.expires_at ? (
              <>
                {' '}
                · session ends in <Countdown to={s.expires_at} endedLabel="now" />
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="border-line inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-semibold hover:border-[var(--fog-400)]"
          >
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
        {children(s)}
      </>
    );

  if (s?.state === 'pending') return <SignInCode session={s} onCancel={() => signOut.mutate()} />;

  const ended = s && FINAL_SESSION.includes(s.state) ? ENDED[s.state] : undefined;
  return (
    <section aria-labelledby="signin-h" className="glass max-w-2xl space-y-5 p-6 sm:p-8">
      <h2 id="signin-h" className="font-display text-3xl">
        Sign in with World ID
      </h2>
      <p className="text-muted">
        The review desk shows reports before they are public. Sign in with World App to read them;
        each approval, rejection or revision is confirmed in World App again.
      </p>
      {ended && (
        <Banner tone={s?.state === 'revoked' ? 'info' : 'warning'} title={ended.title}>
          {s?.detail ?? ended.body}
        </Banner>
      )}
      {start.isError && (
        <Banner tone="danger" title="The sign-in didn't start">
          {start.error.message}
        </Banner>
      )}
      <button
        type="button"
        onClick={() => start.mutate()}
        disabled={start.isPending}
        className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105 disabled:opacity-60"
      >
        <ScanEye size={18} aria-hidden /> {start.isPending ? 'Starting…' : 'Sign in with World App'}
      </button>
    </section>
  );
}

/** Code, QR and countdown for a World device login (sign-in or a decision confirmation). */
export function WorldCodePanel({
  title,
  userCode,
  verificationUri,
  expiresAt,
  note,
  onCancel,
}: {
  title: string;
  userCode?: string;
  verificationUri?: string;
  expiresAt?: number;
  note: ReactNode;
  onCancel?: () => void;
}) {
  return (
    <section
      aria-labelledby="world-code-h"
      className="bg-surface max-w-2xl rounded-2xl border-2 border-[color-mix(in_srgb,var(--ghost-300)_45%,transparent)] p-6 sm:p-8"
    >
      <h2 id="world-code-h" className="text-muted text-xl font-semibold">
        {title}
      </h2>
      <p className="text-muted mt-6 text-base">Your code</p>
      <p
        className="num mt-1 text-5xl font-bold tracking-[0.12em]"
        aria-label={`Code ${userCode?.split('').join(' ')}`}
      >
        {userCode ?? '—'}
      </p>
      <p className="mt-3 text-base">{note}</p>
      {verificationUri && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="w-fit rounded-xl bg-white p-3">
            <QRCodeSVG
              value={verificationUri}
              size={176}
              marginSize={0}
              level="M"
              title="Scan with World App"
            />
          </div>
          <a
            href={verificationUri}
            target="_blank"
            rel="noreferrer"
            className="bg-beam text-on-beam inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-semibold hover:brightness-105"
          >
            Open World App <ExternalLink size={18} aria-hidden />
          </a>
        </div>
      )}
      {expiresAt && (
        <p className="border-line text-muted mt-6 flex items-baseline gap-3 border-t pt-5 text-base">
          Code expires in{' '}
          <Countdown to={expiresAt} endedLabel="now" className="text-text text-3xl font-semibold" />
        </p>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-muted mt-4 text-sm underline underline-offset-4"
        >
          Cancel
        </button>
      )}
    </section>
  );
}

function SignInCode({ session, onCancel }: { session: AdminSession; onCancel: () => void }) {
  return (
    <WorldCodePanel
      title="Sign in: confirm in World App"
      userCode={session.user_code}
      verificationUri={session.verification_uri}
      expiresAt={session.expires_at}
      note="Scan the QR code from inside World App (or open the link on the phone with World App) and check that it shows this code."
      onCancel={onCancel}
    />
  );
}
