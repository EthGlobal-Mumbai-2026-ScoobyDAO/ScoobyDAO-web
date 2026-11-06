'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LogOut, ScanEye } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Banner } from '@/components/Banner';
import { Countdown } from '@/components/Countdown';
import { ApiError } from '@/lib/api';
import { adminApi, adminToken, FINAL_SESSION, reportKey, type AdminSession } from '@/lib/adminApi';

export const readSessionKey = (report: string) => ['admin-session', report] as const;

const ENDED: Record<string, { title: string; body: string }> = {
  denied: {
    title: 'Denied in World App',
    body: 'The report was not opened. Press Read to try again.',
  },
  expired: { title: 'The code expired', body: 'Press Read for a new code.' },
  cancelled: { title: 'Cancelled', body: 'Press Read to try again.' },
  not_permitted: {
    title: "This World ID can't review reports",
    body: 'The confirmed World ID is not an enrolled reviewer. Ask an operator to add it to the reviewer list.',
  },
  failed: {
    title: "World couldn't confirm",
    body: 'The report was not opened. Press Read to try again.',
  },
  revoked: { title: 'Closed', body: 'Press Read to open this report again.' },
};

/**
 * Read gate for one report version. Pressing Read starts a World login limited to this report; the backend decides
 * whether the confirmed World ID may review it. Children render only for an active session for this report, and
 * that session opens nothing else.
 */
export function ReadGate({
  id,
  version,
  children,
}: {
  id: string;
  version: string;
  children: (session: AdminSession) => ReactNode;
}) {
  const report = reportKey(id, version);
  const qc = useQueryClient();
  // Server render and first paint have no token (sessionStorage is client-only).
  const hasToken = useSyncExternalStore(
    adminToken.subscribe,
    () => !!adminToken.get(report),
    () => false,
  );

  const session = useQuery({
    queryKey: readSessionKey(report),
    queryFn: () => adminApi.getSession(report),
    enabled: hasToken,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.state === 'pending' ? Math.max(2, q.state.data.interval ?? 5) * 1000 : false,
    refetchIntervalInBackground: true,
  });
  const start = useMutation({
    mutationFn: () => adminApi.startSession(id, version),
    onSuccess: (s) => qc.setQueryData(readSessionKey(report), s),
  });
  const close = useMutation({
    mutationFn: () => adminApi.endSession(report),
    onSettled: () => qc.removeQueries({ queryKey: readSessionKey(report) }),
  });

  // An unknown or expired token: forget it and offer Read again.
  const unauthorized = session.error instanceof ApiError && session.error.status === 401;
  useEffect(() => {
    if (unauthorized) adminToken.clear(report);
  }, [unauthorized, report]);

  const s = hasToken ? session.data : undefined;
  if (s?.state === 'active')
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Opened with World ID
            {s.label ? (
              <>
                {' '}
                as <span className="text-text font-semibold">{s.label}</span>
              </>
            ) : null}{' '}
            · this report only
            {s.expires_at ? (
              <>
                {' '}
                · closes in <Countdown to={s.expires_at} endedLabel="now" />
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => close.mutate()}
            className="border-line inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-semibold hover:border-[var(--fog-400)]"
          >
            <LogOut size={16} aria-hidden /> Close report
          </button>
        </div>
        {children(s)}
      </>
    );

  if (s?.state === 'pending')
    return (
      <WorldCodePanel
        title="Read: confirm in World App"
        userCode={s.user_code}
        verificationUri={s.verification_uri}
        expiresAt={s.expires_at}
        note="Scan the QR code from inside World App (or open the link on the phone with World App) and check that it shows this code. This opens only this report."
        onCancel={() => close.mutate()}
      />
    );

  const ended = s && FINAL_SESSION.includes(s.state) ? ENDED[s.state] : undefined;
  return (
    <section aria-labelledby="read-h" className="glass max-w-2xl space-y-5 p-6 sm:p-8">
      <h2 id="read-h" className="font-display text-3xl">
        Read this report
      </h2>
      <p className="text-muted">
        This report is not public yet. Confirm with World ID to open it; the confirmation opens only
        this report. Each approval, rejection or revision is confirmed in World App again.
      </p>
      {ended && (
        <Banner tone={s?.state === 'revoked' ? 'info' : 'warning'} title={ended.title}>
          {s?.detail ?? ended.body}
        </Banner>
      )}
      {start.isError && (
        <Banner tone="danger" title="Read didn't start">
          {start.error.message}
        </Banner>
      )}
      <button
        type="button"
        onClick={() => start.mutate()}
        disabled={start.isPending}
        className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105 disabled:opacity-60"
      >
        <ScanEye size={18} aria-hidden /> {start.isPending ? 'Starting…' : 'Read with World ID'}
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
