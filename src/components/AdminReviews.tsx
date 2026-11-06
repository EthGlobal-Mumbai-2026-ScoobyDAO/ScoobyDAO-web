'use client';
import { useEffect, useRef, useState } from 'react';
import { useAdminSession } from './AdminSession';
import { scoutingOrigin } from '@/lib/scouting';
type Item = {
  report_id: string;
  report_version: string;
  candidate_id: string | null;
  state: string;
  target_digest: string | null;
};
type Detail = {
  schema: string;
  report_id: string;
  report_version: string;
  report_sha256: string;
  target_digest: string | null;
  state: string;
  pending_attempt: Attempt | null;
  summary: {
    assessment?: { summary?: string; unknowns?: string[] };
    pillars?: { pillar: string; status: string; summary: string; quality_issues: string[] }[];
    evidence?: { id: string; kind: string; coverage: string; sha256: string }[];
    limitations?: string[];
  } | null;
};
type Attempt = {
  schema: string;
  id: string;
  report_id: string;
  report_version: string;
  target_digest: string;
  decision: string;
  reason: string;
  binding_digest: string;
  status: string;
  user_code?: string;
  verification_uri?: string;
  interval?: number;
  expires_at: number;
  binding: {
    audience: string;
    resource: string;
    scope: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  };
  receipt?: { id: string; decision: string; decided_at: number };
};
const id = /^[A-Za-z0-9._:-]{1,160}$/;
const digest = /^[a-f0-9]{64}$/;
async function call(path: string, token: string, init: RequestInit = {}) {
  if (!scoutingOrigin) throw new Error('Admin service unavailable.');
  const r = await fetch(scoutingOrigin + '/web/v1/admin' + path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 401 || r.status === 403
        ? 'Admin session or permission unavailable.'
        : r.status === 409
          ? 'Report target changed; reload before deciding.'
          : 'Admin review service unavailable.',
    );
  return r.json();
}
export function validateAttempt(
  x: Attempt,
  d: Detail,
  expected?: { id?: string; decision: string; reason: string; binding_digest?: string },
): Attempt {
  if (
    !x ||
    x.schema !== 'scooby.admin-review-attempt/1' ||
    !id.test(x.id) ||
    x.report_id !== d.report_id ||
    x.report_version !== d.report_version ||
    x.target_digest !== d.target_digest ||
    !['approve', 'reject', 'revise'].includes(x.decision) ||
    typeof x.reason !== 'string' ||
    !digest.test(x.binding_digest) ||
    typeof x.expires_at !== 'number' ||
    !Number.isFinite(x.expires_at) ||
    !x.binding ||
    typeof x.binding.audience !== 'string' ||
    !x.binding.audience ||
    x.binding.resource !== `report/${d.report_id}/${d.report_version}/${d.report_sha256}` ||
    x.binding.scope !== 'report_review' ||
    !digest.test(x.binding.nonce) ||
    !Number.isFinite(x.binding.issuedAt) ||
    x.binding.expiresAt !== x.expires_at ||
    (x.status === 'confirmed' &&
      (!x.receipt ||
        !id.test(x.receipt.id) ||
        x.receipt.decision !== x.decision ||
        !Number.isFinite(x.receipt.decided_at))) ||
    (expected !== undefined &&
      (x.decision !== expected.decision ||
        x.reason !== expected.reason ||
        (expected.id !== undefined && x.id !== expected.id) ||
        (expected.binding_digest !== undefined && x.binding_digest !== expected.binding_digest))) ||
    ![
      'pending',
      'confirmed',
      'denied',
      'expired',
      'cancelled',
      'not_permitted',
      'failed',
      'superseded',
    ].includes(x.status)
  )
    throw new Error('Review attempt binding invalid.');
  if (x.status === 'pending') {
    if (
      !x.verification_uri ||
      !x.user_code ||
      !x.interval ||
      !Number.isFinite(x.interval) ||
      x.interval < 1
    )
      throw new Error('Review confirmation invalid.');
    const u = new URL(x.verification_uri);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      !(u.hostname === 'world.org' || u.hostname.endsWith('.world.org'))
    )
      throw new Error('Untrusted World ID address.');
  }
  return x;
}
export function AdminReviews() {
  const { token, view } = useAdminSession();
  if (
    process.env.NEXT_PUBLIC_ADMIN_CHECKPOINTS_ENABLED !== 'true' ||
    !token ||
    view?.state !== 'active' ||
    !view.scopes?.includes('report_review')
  )
    return null;
  return <ReviewsForSession key={token} token={token} />;
}
function ReviewsForSession({ token }: { token: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [fullReport, setFullReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const selection = useRef(0);
  const [submission, setSubmission] = useState<{
    decision: 'approve' | 'reject' | 'revise';
    reason: string;
    key: string;
  } | null>(null);
  const [pollRevision, setPollRevision] = useState(0);
  async function queue() {
    if (!token) return;
    try {
      const q = await call('/reviews', token);
      if (
        q.schema !== 'scooby.admin-review-queue/1' ||
        !Array.isArray(q.items) ||
        q.items.some(
          (x: Item) =>
            !x ||
            typeof x.report_id !== 'string' ||
            !id.test(x.report_id) ||
            typeof x.report_version !== 'string' ||
            !id.test(x.report_version) ||
            typeof x.state !== 'string',
        )
      )
        throw new Error('Invalid review queue.');
      setItems(q.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review queue unavailable.');
    }
  }
  async function open(item: Item) {
    if (!token || (submission && !attempt) || attempt?.status === 'pending') return;
    const currentSelection = ++selection.current;
    setError('');
    try {
      const d: Detail = await call(
        `/reviews/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}`,
        token,
      );
      if (
        d.schema !== 'scooby.admin-review/1' ||
        d.report_id !== item.report_id ||
        d.report_version !== item.report_version ||
        !digest.test(d.report_sha256) ||
        !(d.target_digest === null || digest.test(d.target_digest)) ||
        typeof d.state !== 'string' ||
        (d.summary !== null &&
          (typeof d.summary !== 'object' ||
            (d.summary.pillars !== undefined &&
              (!Array.isArray(d.summary.pillars) ||
                d.summary.pillars.some(
                  (p) =>
                    !p ||
                    typeof p.pillar !== 'string' ||
                    typeof p.status !== 'string' ||
                    typeof p.summary !== 'string' ||
                    !Array.isArray(p.quality_issues),
                ))) ||
            (d.summary.evidence !== undefined && !Array.isArray(d.summary.evidence)) ||
            (d.summary.limitations !== undefined && !Array.isArray(d.summary.limitations))))
      )
        throw new Error('Review target invalid.');
      const pending = d.pending_attempt ? validateAttempt(d.pending_attempt, d) : null;
      if (currentSelection !== selection.current) return;
      setDetail(d);
      setAttempt(pending);
      setSubmission(null);
      setReason('');
      setFullReport(null);
    } catch (e) {
      if (currentSelection === selection.current)
        setError(e instanceof Error ? e.message : 'Review unavailable.');
    }
  }
  async function loadFullReport() {
    if (!detail || !scoutingOrigin) return;
    const currentSelection = selection.current;
    setError('');
    try {
      const base = `/reviews/${encodeURIComponent(detail.report_id)}/${encodeURIComponent(detail.report_version)}`;
      const listing = await call(`${base}/artifacts`, token);
      const artifact = listing.artifacts?.markdown;
      const expectedPath = `/web/v1/admin${base}/files/report.md`;
      if (
        listing.report_id !== detail.report_id ||
        listing.report_version !== detail.report_version ||
        listing.report_sha256 !== detail.report_sha256 ||
        artifact?.availability !== 'available' ||
        artifact.report_sha256 !== detail.report_sha256 ||
        artifact.url !== expectedPath ||
        typeof artifact.sha256 !== 'string' ||
        !digest.test(artifact.sha256)
      )
        throw new Error('Full report is unavailable or does not match this target.');
      const response = await fetch(scoutingOrigin + expectedPath, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Full report unavailable.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 10_000_000) throw new Error('Full report is too large to display.');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
      if (hash !== artifact.sha256) throw new Error('Full report integrity check failed.');
      if (currentSelection === selection.current)
        setFullReport(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (e) {
      if (currentSelection === selection.current)
        setError(e instanceof Error ? e.message : 'Full report unavailable.');
    }
  }
  async function decide(decision: 'approve' | 'reject' | 'revise') {
    if (!token || !detail?.target_digest || !reason.trim() || submitting.current) return;
    if (submission && (submission.decision !== decision || submission.reason !== reason.trim()))
      return;
    const request = submission ?? { decision, reason: reason.trim(), key: crypto.randomUUID() };
    setSubmission(request);
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const a = await call(
        `/reviews/${encodeURIComponent(detail.report_id)}/${encodeURIComponent(detail.report_version)}/attempts`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.key },
          body: JSON.stringify({
            decision,
            reason: request.reason,
            expected_target_digest: detail.target_digest,
          }),
        },
      );
      setAttempt(validateAttempt(a, detail, { decision, reason: request.reason }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review unavailable.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!token || !detail || attempt?.status !== 'pending') return;
    let stopped = false;
    const t = setTimeout(
      async () => {
        try {
          const a = validateAttempt(
            await call(`/review-attempts/${encodeURIComponent(attempt.id)}`, token),
            detail,
            {
              id: attempt.id,
              decision: attempt.decision,
              reason: attempt.reason,
              binding_digest: attempt.binding_digest,
            },
          );
          if (!stopped) setAttempt(a);
        } catch (e) {
          if (!stopped) setError(e instanceof Error ? e.message : 'Review status unavailable.');
        }
      },
      Math.max(1, attempt.interval || 5) * 1000,
    );
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [attempt, detail, token, pollRevision]);
  async function cancel() {
    if (!token || !attempt || !detail) return;
    try {
      setAttempt(
        validateAttempt(
          await call(`/review-attempts/${encodeURIComponent(attempt.id)}/cancel`, token, {
            method: 'POST',
          }),
          detail,
          {
            id: attempt.id,
            decision: attempt.decision,
            reason: attempt.reason,
            binding_digest: attempt.binding_digest,
          },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancellation unavailable.');
    }
  }
  return (
    <section
      className="border-line bg-surface mt-6 rounded-xl border p-4"
      aria-label="Admin report review"
    >
      <h2 className="text-xl font-semibold">Report review</h2>
      <p className="text-muted mt-1 text-sm">
        Review is separate from publication. A confirmation applies only to the displayed report
        target.
      </p>
      <button type="button" onClick={() => void queue()} className="mt-2 underline">
        Load / refresh queue
      </button>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={`${i.report_id}~${i.report_version}`}>
            <button
              type="button"
              disabled={(!!submission && !attempt) || attempt?.status === 'pending'}
              onClick={() => void open(i)}
              className="text-beam-ink break-all underline disabled:opacity-50"
            >
              {i.report_id} · {i.report_version} · {i.state.replaceAll('_', ' ')}
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <div className="border-line mt-4 border-t pt-4 [overflow-wrap:anywhere]">
          <h3 className="font-semibold">
            {detail.report_id} · {detail.report_version}
          </h3>
          <p className="mt-2 text-xs">
            Report SHA-256: {detail.report_sha256}
            <br />
            Review target: {detail.target_digest || 'unavailable'}
            <br />
            State: {detail.state}
          </p>
          <p className="mt-3 text-sm">{detail.summary?.assessment?.summary}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.summary?.pillars?.map((p) => (
              <li key={p.pillar}>
                <strong>
                  {p.pillar}: {p.status}
                </strong>{' '}
                · {p.summary} {p.quality_issues?.join(' ')}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            Limitations: {detail.summary?.limitations?.join(' ') || 'None supplied.'}
          </p>
          <ul className="mt-2 text-xs">
            {detail.summary?.evidence?.map((e) => (
              <li key={e.id}>
                {e.id} · {e.kind} · {e.coverage} · {e.sha256}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-beam-ink mt-3 underline"
            onClick={() => void loadFullReport()}
          >
            Load full draft
          </button>
          {fullReport !== null && (
            <pre className="border-line mt-3 max-h-96 overflow-auto rounded border p-3 text-xs whitespace-pre-wrap">
              {fullReport}
            </pre>
          )}
          {detail.state === 'pending_review' && detail.target_digest && !attempt && (
            <>
              <label className="mt-4 block text-sm">
                Decision reason
                <textarea
                  value={reason}
                  disabled={!!submission}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                  className="border-line mt-1 block w-full rounded border p-2"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-3">
                {(['approve', 'reject', 'revise'] as const).map((d) => (
                  <button
                    type="button"
                    key={d}
                    disabled={busy || !reason.trim() || (!!submission && submission.decision !== d)}
                    onClick={() => void decide(d)}
                    className="border-line rounded border px-3 py-2 disabled:opacity-50"
                  >
                    {submission?.decision === d ? `Retry ${d}` : d}
                  </button>
                ))}
              </div>
              {submission && (
                <p className="text-muted mt-2 text-xs">
                  If the request could not be confirmed, retry the same decision to recover its
                  result.
                </p>
              )}
            </>
          )}
          {attempt && (
            <div className="mt-4 text-sm" role="status">
              <p>Confirmation: {attempt.status}</p>
              {attempt.status === 'pending' && (
                <>
                  <p>
                    Code: <strong>{attempt.user_code}</strong> · expires{' '}
                    {new Date(attempt.expires_at * 1000).toLocaleString()}
                  </p>
                  <a
                    href={attempt.verification_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Open World ID
                  </a>
                  <button type="button" className="ml-4 underline" onClick={() => void cancel()}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
          {attempt?.status === 'pending' && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setPollRevision((n) => n + 1)}
            >
              Retry status check
            </button>
          )}
        </p>
      )}
    </section>
  );
}
