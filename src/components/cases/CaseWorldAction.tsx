'use client';
import { useEffect, useState } from 'react';
import type { ScoutingCase } from '@/lib/scouting';

type Binding = {
  challenge_id: string;
  case_id: string;
  candidate_id: string;
  snapshot_digest: string;
  policy_digest: string;
  action: string;
  nonce: string;
  state: string;
  expires_at: number;
};
type Attempt = Binding & {
  attempt_id: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
  interval_seconds: number;
  run_id: string | null;
};
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
function binding(v: unknown, c: ScoutingCase): Binding {
  if (
    !object(v) ||
    !id(v.challenge_id) ||
    v.case_id !== c.case_id ||
    v.candidate_id !== c.candidate_id ||
    v.snapshot_digest !== c.snapshot_digest ||
    v.policy_digest !== c.policy_digest ||
    v.action !== 'diagnostic_research' ||
    typeof v.nonce !== 'string' ||
    !/^[a-f0-9]{64}$/.test(v.nonce) ||
    typeof v.expires_at !== 'number' ||
    !Number.isFinite(v.expires_at) ||
    typeof v.state !== 'string'
  )
    throw new Error('Confirmation binding invalid. Refresh the case.');
  return v as Binding;
}
function attempt(v: unknown, c: ScoutingCase, ch: Binding): Attempt {
  const x = binding(v, c);
  if (
    !object(v) ||
    x.challenge_id !== ch.challenge_id ||
    x.nonce !== ch.nonce ||
    !id(v.attempt_id) ||
    !['pending', 'approved', 'denied', 'expired', 'failed', 'superseded', 'cancelled'].includes(
      x.state,
    ) ||
    typeof v.interval_seconds !== 'number' ||
    !Number.isFinite(v.interval_seconds) ||
    v.interval_seconds < 0 ||
    typeof v.user_code !== 'string' ||
    typeof v.verification_uri !== 'string' ||
    !(v.verification_uri_complete === null || typeof v.verification_uri_complete === 'string') ||
    !(v.run_id === null || id(v.run_id)) ||
    (x.state === 'approved' && !id(v.run_id))
  )
    throw new Error('Confirmation response invalid.');
  for (const uri of [v.verification_uri, v.verification_uri_complete])
    if (uri) {
      const u = new URL(uri as string);
      if (
        u.protocol !== 'https:' ||
        u.username ||
        u.password ||
        !(u.hostname === 'world.org' || u.hostname.endsWith('.world.org'))
      )
        throw new Error('Untrusted World ID verification address.');
    }
  return v as Attempt;
}
async function request(origin: string, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(origin + path, {
    ...init,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? 'World ID confirmation is unavailable. Try again when the service is configured.'
        : response.status === 409
          ? 'This case or confirmation has changed or expired. Refresh before trying again.'
          : 'Confirmation service unavailable. Please try again.',
    );
  return response.json();
}
export function CaseWorldAction({
  candidate: c,
  origin,
  onChanged,
  now,
}: {
  candidate: ScoutingCase;
  origin: string;
  onChanged: () => void;
  now: number;
}) {
  const [current, setCurrent] = useState<{ challenge: Binding; attempt: Attempt } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const available =
    c.continuation.availability === 'available' && now > 0 && Date.parse(c.expires_at) > now;
  async function start() {
    setBusy(true);
    setError('');
    try {
      const ch = binding(
        await request(origin, `/scouting/cases/${c.case_id}/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            expected_revision: c.snapshot_digest,
            action: 'diagnostic_research',
          }),
        }),
        c,
      );
      if (ch.state !== 'pending' || ch.expires_at * 1000 <= Date.now())
        throw new Error('Confirmation expired or changed. Refresh the case.');
      const a = attempt(
        await request(
          origin,
          `/scouting/challenges/${encodeURIComponent(ch.challenge_id)}/world-attempt`,
          { method: 'POST' },
        ),
        c,
        ch,
      );
      setCurrent({ challenge: ch, attempt: a });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirmation unavailable.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!current || current.attempt.state !== 'pending') return;
    let stopped = false;
    const timer = setTimeout(
      async () => {
        try {
          const a = attempt(
            await request(
              origin,
              `/scouting/world-attempts/${encodeURIComponent(current.attempt.attempt_id)}`,
            ),
            c,
            current.challenge,
          );
          if (!stopped) {
            setCurrent({ challenge: current.challenge, attempt: a });
            setError('');
            if (a.state === 'approved') onChanged();
          }
        } catch (e) {
          if (!stopped) setError(e instanceof Error ? e.message : 'Could not check confirmation.');
        }
      },
      Math.max(1, current.attempt.interval_seconds) * 1000,
    );
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [c, current, onChanged, origin]);
  async function cancel() {
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      const a = attempt(
        await request(
          origin,
          `/scouting/world-attempts/${encodeURIComponent(current.attempt.attempt_id)}/cancel`,
          { method: 'POST' },
        ),
        c,
        current.challenge,
      );
      setCurrent({ challenge: current.challenge, attempt: a });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  }
  const a = current?.attempt;
  return (
    <div className="border-line mt-4 border-t pt-3">
      {!a || a.state !== 'pending' ? (
        <button
          type="button"
          disabled={!available || busy || a?.state === 'approved'}
          onClick={() => void start()}
          className="border-line rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy ? 'Starting confirmation…' : 'Go for investigation'}
        </button>
      ) : null}
      {!available && !a && (
        <p className="text-muted mt-2 text-xs">
          {c.continuation.reason || 'Confirmation is unavailable or the case has expired.'}
        </p>
      )}
      {a?.state === 'pending' && (
        <div className="text-sm">
          <p className="font-semibold">Confirm this investigation in World ID</p>
          <p className="mt-1">
            Candidate: {c.candidate_id}. This authorizes investigation of this snapshot; it does not
            publish or approve a report.
          </p>
          <p className="mt-2">
            Code: <strong>{a.user_code}</strong> · expires{' '}
            {new Date(a.expires_at * 1000).toLocaleString()}
          </p>
          <a
            className="text-beam-ink mt-2 inline-block underline"
            href={a.verification_uri_complete || a.verification_uri}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open World ID
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="ml-4 underline"
          >
            Cancel
          </button>
          <p className="text-muted mt-2 text-xs">Waiting for confirmation…</p>
        </div>
      )}
      {a && a.state !== 'pending' && (
        <p role="status" className="mt-2 text-sm">
          {a.state === 'approved'
            ? 'Confirmed. Investigation queued.'
            : `Confirmation ${a.state}; no investigation was started by this attempt.`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}{' '}
          {a?.state === 'pending' && (
            <button className="underline" onClick={() => setCurrent({ ...current! })}>
              Retry status check
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export function RetryInvestigation({
  candidate,
  origin,
  onChanged,
  now,
}: {
  candidate: ScoutingCase;
  origin: string;
  onChanged: () => void;
  now: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = candidate.research?.run_id;
  async function retry() {
    if (!run || !id(run)) return;
    setBusy(true);
    setError('');
    try {
      await request(origin, `/investigations/${encodeURIComponent(run)}/resume`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        className="text-beam-ink underline disabled:opacity-60"
        disabled={busy || !run || now <= 0 || Date.parse(candidate.expires_at) <= now}
        onClick={() => void retry()}
      >
        {busy ? 'Retrying…' : 'Retry investigation'}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
