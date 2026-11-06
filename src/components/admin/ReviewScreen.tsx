'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/Banner';
import { HashText } from '@/components/HashText';
import { ApiError } from '@/lib/api';
import {
  adminApi,
  DECISION_LABEL,
  FINAL_ATTEMPT,
  REVIEW_STATE_LABEL,
  type Decision,
  type ReviewAttempt,
  type ReviewDetail,
} from '@/lib/adminApi';
import { AdminGate, WorldCodePanel } from './AdminGate';
import { reviewQueueKey } from './ReviewQueue';

const reviewKey = (id: string, version: string) => ['admin-review', id, version] as const;
const attemptKey = (id: string) => ['admin-review-attempt', id] as const;

const ATTEMPT_RESULT: Record<
  string,
  { tone: 'success' | 'danger' | 'warning' | 'info'; title: string }
> = {
  confirmed: { tone: 'success', title: 'Confirmed in World App — decision recorded' },
  denied: { tone: 'danger', title: 'Denied in World App — no decision recorded' },
  expired: { tone: 'warning', title: 'The code expired — no decision recorded' },
  cancelled: { tone: 'info', title: 'Cancelled — no decision recorded' },
  not_permitted: {
    tone: 'danger',
    title: 'A different or unpermitted World ID confirmed — no decision recorded',
  },
  failed: { tone: 'danger', title: "World couldn't confirm — no decision recorded" },
  superseded: { tone: 'warning', title: 'The report changed while waiting — no decision recorded' },
};

/** Review page body behind the World ID sign-in (client component, so the gate can take a render function). */
export function GatedReviewScreen({ id, version }: { id: string; version: string }) {
  return <AdminGate>{() => <ReviewScreen id={id} version={version} />}</AdminGate>;
}

export function ReviewScreen({ id, version }: { id: string; version: string }) {
  const detail = useQuery({
    queryKey: reviewKey(id, version),
    queryFn: () => adminApi.review(id, version),
  });
  if (detail.isError) {
    const nf = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <Banner
        tone="danger"
        title={nf ? 'No report version with this id' : "Couldn't load this report"}
      >
        {nf ? 'Check the link, or go back to the queue.' : detail.error.message}
      </Banner>
    );
  }
  const d = detail.data;
  if (!d)
    return (
      <div className="sweep h-64 rounded-xl" aria-busy="true" aria-label="Loading the report" />
    );
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
      <div className="space-y-8">
        <Summary d={d} />
        <ReportFiles id={id} version={version} />
        <History d={d} />
      </div>
      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <DecisionPanel d={d} />
        <RevokePanel d={d} />
      </div>
    </div>
  );
}

function Summary({ d }: { d: ReviewDetail }) {
  const s = d.summary;
  return (
    <section aria-labelledby="summary-h" className="glass space-y-5 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="summary-h" className="font-display text-2xl break-all">
          {d.report_id} <span className="text-muted text-lg">· {d.report_version}</span>
        </h2>
        <span className="font-semibold">{REVIEW_STATE_LABEL[d.state]}</span>
      </div>
      {d.integrity !== 'ok' && (
        <Banner tone="danger" title="Integrity check failed — don't approve">
          {d.integrity}
        </Banner>
      )}
      <dl className="space-y-4">
        <div>
          <dt className="text-muted text-sm">Report sha256</dt>
          <dd>
            <HashText value={d.report_sha256} label="report sha256" />
          </dd>
        </div>
        {d.target_digest && (
          <div>
            <dt className="text-muted text-sm">Review target (what your decision covers)</dt>
            <dd>
              <HashText value={d.target_digest} label="target digest" />
            </dd>
          </div>
        )}
      </dl>
      {s?.assessment && (
        <div>
          <h3 className="font-semibold">
            Assessment{s.assessment.label ? `: ${s.assessment.label}` : ''}
          </h3>
          {s.assessment.summary && <p className="mt-1">{s.assessment.summary}</p>}
        </div>
      )}
      {!!s?.pillars?.length && (
        <div>
          <h3 className="font-semibold">Pillars</h3>
          <ul className="mt-2 space-y-2">
            {s.pillars.map((p) => (
              <li key={p.pillar}>
                <span className="font-semibold">{p.pillar}</span>
                {p.status ? <span className="text-muted"> · {p.status}</span> : null}
                {p.summary ? <p className="text-muted text-sm">{p.summary}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!s?.limitations?.length && (
        <div>
          <h3 className="font-semibold">Limitations</h3>
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {s.limitations.map((l, i) => (
              <li key={i}>{typeof l === 'string' ? l : JSON.stringify(l)}</li>
            ))}
          </ul>
        </div>
      )}
      {s?.evidence && <p className="text-muted text-sm">Evidence items: {s.evidence.length}</p>}
    </section>
  );
}

/** The rendered report. Files need the session header, so they are fetched and shown from a blob URL. */
function ReportFiles({ id, version }: { id: string; version: string }) {
  const listing = useQuery({
    queryKey: ['admin-review-artifacts', id, version],
    queryFn: () => adminApi.artifacts(id, version),
  });
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => void (viewing && URL.revokeObjectURL(viewing)), [viewing]);

  async function open(url: string, kind: 'html' | 'download', name: string) {
    setError(null);
    try {
      const blob = await adminApi.file(url);
      const href = URL.createObjectURL(blob);
      if (kind === 'html') setViewing(href);
      else {
        const a = document.createElement('a');
        a.href = href;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const a = listing.data?.artifacts;
  return (
    <section aria-labelledby="files-h" className="glass space-y-4 p-6">
      <h2 id="files-h" className="text-xl font-semibold">
        Full report
      </h2>
      {listing.isError && (
        <Banner tone="danger" title="Couldn't load the report files">
          {listing.error.message}
        </Banner>
      )}
      {listing.data && listing.data.render_status === 'not_rendered' && (
        <Banner tone="info" title="Not rendered yet">
          The backend has no rendered HTML or PDF for these exact bytes. Review the summary, or
          render it first.
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        {a?.html?.url && (
          <button
            type="button"
            onClick={() => open(a.html!.url!, 'html', 'report.html')}
            className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
          >
            <FileText size={16} aria-hidden /> View report
          </button>
        )}
        {a?.pdf?.url && (
          <button
            type="button"
            onClick={() => open(a.pdf!.url!, 'download', `${id}-${version}.pdf`)}
            className="border-line rounded-xl border px-4 py-2 font-semibold hover:border-[var(--fog-400)]"
          >
            Download PDF
          </button>
        )}
        {a?.markdown?.url && (
          <button
            type="button"
            onClick={() => open(a.markdown!.url!, 'download', `${id}-${version}.md`)}
            className="border-line rounded-xl border px-4 py-2 font-semibold hover:border-[var(--fog-400)]"
          >
            Download Markdown
          </button>
        )}
      </div>
      {error && (
        <Banner tone="danger" title="Couldn't open the file">
          {error}
        </Banner>
      )}
      {viewing && (
        // Sandboxed: the report's own scripts run in an opaque origin with no access to this page or its session.
        <iframe
          title="Full report"
          src={viewing}
          sandbox="allow-scripts"
          className="border-line h-[70vh] w-full rounded-xl border bg-white"
        />
      )}
    </section>
  );
}

function History({ d }: { d: ReviewDetail }) {
  if (!d.decisions.length) return null;
  return (
    <section aria-labelledby="history-h" className="glass space-y-3 p-6">
      <h2 id="history-h" className="text-xl font-semibold">
        Decision history
      </h2>
      <ul className="space-y-3">
        {d.decisions.map((x) => (
          <li key={x.receipt_id} className="border-line border-l-2 pl-3">
            <p className="font-semibold">
              {DECISION_LABEL[x.decision]}
              {x.reviewer ? ` by ${x.reviewer}` : ''} ·{' '}
              {new Date(x.decided_at * 1000).toLocaleString()}
              {!x.current_target ? ' · for an earlier version of these bytes' : ''}
              {x.revoked_at ? ' · revoked' : ''}
            </p>
            <p className="text-muted text-sm">{x.reason}</p>
            {x.revoke_reason && <p className="text-muted text-sm">Revoked: {x.revoke_reason}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecisionPanel({ d }: { d: ReviewDetail }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision>('approve');
  const [reason, setReason] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(d.pending_attempt?.id ?? null);

  const attempt = useQuery({
    queryKey: attemptKey(attemptId ?? ''),
    queryFn: () => adminApi.attempt(attemptId!),
    enabled: !!attemptId,
    initialData: d.pending_attempt?.id === attemptId ? (d.pending_attempt ?? undefined) : undefined,
    refetchInterval: (q) =>
      q.state.data && FINAL_ATTEMPT.includes(q.state.data.status)
        ? false
        : Math.max(2, q.state.data?.interval ?? 5) * 1000,
    refetchIntervalInBackground: true,
  });
  const start = useMutation({
    mutationFn: () =>
      adminApi.startDecision(d.report_id, d.report_version, {
        decision,
        reason: reason.trim(),
        expected_target_digest: d.target_digest!,
      }),
    onSuccess: (a) => {
      qc.setQueryData(attemptKey(a.id), a);
      setAttemptId(a.id);
    },
  });
  const cancel = useMutation({
    mutationFn: (aid: string) => adminApi.cancelAttempt(aid),
    onSuccess: (a) => qc.setQueryData(attemptKey(a.id), a),
  });

  const a: ReviewAttempt | undefined = attempt.data;
  const final = a && FINAL_ATTEMPT.includes(a.status);
  useEffect(() => {
    if (final) {
      qc.invalidateQueries({ queryKey: reviewKey(d.report_id, d.report_version) });
      qc.invalidateQueries({ queryKey: reviewQueueKey });
    }
  }, [final, qc, d.report_id, d.report_version]);

  if (a && !final)
    return (
      <WorldCodePanel
        title={`${DECISION_LABEL[a.decision]}: confirm in World App`}
        userCode={a.user_code}
        verificationUri={a.verification_uri}
        expiresAt={a.expires_at}
        note="Confirm with the same World ID you signed in with. World App shows only the requester and this code; your decision is bound to the review target above."
        onCancel={() => cancel.mutate(a.id)}
      />
    );

  const canDecide = d.target_digest && d.integrity === 'ok';
  return (
    <section aria-labelledby="decide-h" className="glass space-y-4 p-6">
      <h2 id="decide-h" className="text-xl font-semibold">
        Your decision
      </h2>
      {a && final && (
        <Banner tone={ATTEMPT_RESULT[a.status].tone} title={ATTEMPT_RESULT[a.status].title}>
          {a.detail ?? `${DECISION_LABEL[a.decision]} · ${a.reason}`}
        </Banner>
      )}
      <fieldset className="space-y-2">
        <legend className="text-muted text-sm">Decision</legend>
        {(['approve', 'reject', 'revise'] as Decision[]).map((x) => (
          <label key={x} className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value={x}
              checked={decision === x}
              onChange={() => setDecision(x)}
            />
            {DECISION_LABEL[x]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="text-muted text-sm">Reason (recorded with your decision)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          className="border-line bg-surface mt-1 w-full rounded-xl border p-3"
        />
      </label>
      {start.isError && (
        <Banner tone="danger" title="The decision didn't start">
          {start.error.message}
        </Banner>
      )}
      <button
        type="button"
        disabled={!canDecide || !reason.trim() || start.isPending}
        onClick={() => start.mutate()}
        className="bg-beam text-on-beam w-full rounded-xl px-4 py-2.5 font-semibold hover:brightness-105 disabled:opacity-60"
      >
        {start.isPending ? 'Starting…' : `${DECISION_LABEL[decision]} — confirm in World App`}
      </button>
      <p className="text-muted text-sm">
        Approving makes this version visible in the public report library. Publishing onchain is a
        separate sign-off from the{' '}
        <Link href="/cases" className="underline underline-offset-4">
          case file
        </Link>
        .
      </p>
    </section>
  );
}

function RevokePanel({ d }: { d: ReviewDetail }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const active = d.decisions.some((x) => x.current_target && !x.revoked_at);
  const revoke = useMutation({
    mutationFn: () => adminApi.revoke(d.report_id, d.report_version, reason.trim()),
    onSuccess: () => {
      setReason('');
      qc.invalidateQueries({ queryKey: reviewKey(d.report_id, d.report_version) });
      qc.invalidateQueries({ queryKey: reviewQueueKey });
    },
  });
  if (!active) return null;
  return (
    <section aria-labelledby="revoke-h" className="glass space-y-3 p-6">
      <h2 id="revoke-h" className="text-xl font-semibold">
        Withdraw the decision
      </h2>
      <p className="text-muted text-sm">
        The version goes back to waiting for review and leaves the public library.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        placeholder="Reason"
        aria-label="Reason for withdrawing"
        className="border-line bg-surface w-full rounded-xl border p-2.5"
      />
      {revoke.isError && (
        <Banner tone="danger" title="Couldn't withdraw">
          {revoke.error.message}
        </Banner>
      )}
      <button
        type="button"
        disabled={!reason.trim() || revoke.isPending}
        onClick={() => revoke.mutate()}
        className="border-line w-full rounded-xl border px-4 py-2 font-semibold hover:border-[var(--fog-400)] disabled:opacity-60"
      >
        {revoke.isPending ? 'Withdrawing…' : 'Withdraw decision'}
      </button>
    </section>
  );
}
