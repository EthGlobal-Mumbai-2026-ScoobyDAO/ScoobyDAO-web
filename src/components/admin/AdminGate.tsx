'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, LogOut } from 'lucide-react';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Countdown } from '@/components/Countdown';
import { WorldConfirm } from '@/components/ui/WorldConfirm';
import { ApiError } from '@/lib/api';
import { adminApi, adminToken, reportKey, type AdminSession } from '@/lib/adminApi';
import { reportLabel, reviewQueueKey, sessionPhase } from './reviewMeta';

export const readSessionKey = (report: string) => ['admin-session', report] as const;

/**
 * Read gate for one report version. Pressing Open starts a World login limited to this report; the backend decides
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
  // Anonymous list (ids, versions, report hashes): names the report and its hash on the confirm card.
  const queue = useQuery({
    queryKey: reviewQueueKey,
    queryFn: () => adminApi.publicQueue(),
    refetchInterval: 15_000,
  });
  const start = useMutation({
    mutationFn: () => adminApi.startSession(id, version),
    onSuccess: (s) => qc.setQueryData(readSessionKey(report), s),
  });
  const close = useMutation({
    mutationFn: () => adminApi.endSession(report),
    onSettled: () => qc.removeQueries({ queryKey: readSessionKey(report) }),
  });

  // An unknown or expired token: forget it and offer Open again.
  const unauthorized = session.error instanceof ApiError && session.error.status === 401;
  useEffect(() => {
    if (unauthorized) adminToken.clear(report);
  }, [unauthorized, report]);

  const s = hasToken ? session.data : undefined;
  if (s?.state === 'active')
    return (
      <>
        <SessionBar session={s} onClose={() => close.mutate()} closing={close.isPending} />
        {children(s)}
      </>
    );

  const item = queue.data?.items.find((i) => i.report_id === id && i.report_version === version);
  const label = reportLabel(id, version, item?.report_sha256);
  return (
    <WorldConfirm
      action="open"
      phase={sessionPhase(s?.state)}
      subject={label.name}
      version={version}
      digest={item?.report_sha256}
      digestLabel="Report SHA-256"
      startTitle="This draft isn’t public yet"
      startBody="Confirm with World ID to open it. The confirmation opens only this report."
      startLabel="Open with World ID"
      onStart={() => start.mutate()}
      starting={start.isPending}
      error={start.isError ? `Couldn’t start: ${start.error.message}` : close.isError ? close.error.message : null}
      userCode={s?.user_code}
      qrValue={s?.verification_uri}
      openUrl={s?.verification_uri}
      expiresAt={s?.expires_at}
      onCancel={() => close.mutate()}
      cancelling={close.isPending}
      detail={s?.detail}
      onNext={() => start.mutate()}
    />
  );
}

/** Slim bar under the nav while a report session is open. */
export function SessionBar({
  session,
  onClose,
  closing,
}: {
  session: Pick<AdminSession, 'label' | 'expires_at'>;
  onClose: () => void;
  closing?: boolean;
}) {
  return (
    <div className="border-line sticky top-16 z-30 -mx-4 mb-6 border-b bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <p className="text-muted flex items-center gap-2">
          <Fingerprint size={16} aria-hidden className="text-clue-ink shrink-0" />
          <span>
            Opened with World ID
            {session.label ? (
              <>
                {' '}
                as <span className="text-text font-semibold">{session.label}</span>
              </>
            ) : null}{' '}
            · this report only
            {session.expires_at ? (
              <>
                {' '}
                · closes in <Countdown to={session.expires_at} endedLabel="now" className="text-text" />
              </>
            ) : null}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={closing}
          className="border-line inline-flex items-center gap-2 rounded-lg border px-3 py-1 font-semibold hover:border-[var(--fog-400)] disabled:opacity-60"
        >
          <LogOut size={14} aria-hidden /> {closing ? 'Closing…' : 'Close'}
        </button>
      </div>
    </div>
  );
}
