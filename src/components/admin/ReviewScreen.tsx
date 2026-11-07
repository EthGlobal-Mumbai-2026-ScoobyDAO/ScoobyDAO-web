'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  OctagonAlert,
  RotateCcw,
  ScanEye,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/Banner';
import { HashText } from '@/components/HashText';
import { ReferenceReader } from '@/components/reference/ReferenceReader';
import { Card, ErrorState, LoadState, PageHeader, TechnicalDetails } from '@/components/ui';
import { Digest, WorldConfirm, worldButtonClass } from '@/components/ui/WorldConfirm';
import { ApiError } from '@/lib/api';
import {
  adminApi,
  DECISION_LABEL,
  FINAL_ATTEMPT,
  reportKey,
  type Decision,
  type DecisionRecord,
  type ReviewAttempt,
  type ReviewDetail,
} from '@/lib/adminApi';
import { referenceReaderHref } from '@/lib/reference';
import { ReadGate } from './AdminGate';
import { ReviewStateChip, SourceBadge } from './ReviewQueue';
import {
  attemptPhase,
  caseFileHref,
  REASON_MAX,
  reasonOk,
  reportLabel,
  reviewQueueKey,
} from './reviewMeta';

const reviewKey = (id: string, version: string) => ['admin-review', id, version] as const;
const attemptKey = (id: string) => ['admin-review-attempt', id] as const;

export const DECISION_CONSEQUENCE: Record<Decision, string> = {
  approve: 'Approving makes this version public. Nothing goes onchain yet.',
  reject: 'Rejecting keeps this version out of the public library.',
  revise: 'Asks for a new version. This one stays out of the public library.',
};
const DECISION_ICON: Record<Decision, typeof CheckCircle2> = {
  approve: CheckCircle2,
  reject: XCircle,
  revise: RotateCcw,
};

/** Review workspace behind this report's Read confirmation. */
export function GatedReviewScreen({ id, version }: { id: string; version: string }) {
  const l = reportLabel(id, version);
  return (
    <main className="py-8 sm:py-10">
      <p className="mb-4 text-sm">
        <Link href="/admin" className="text-muted hover:text-text inline-flex items-center gap-1.5">
          <ArrowLeft size={14} aria-hidden /> Queue
        </Link>
      </p>
      <PageHeader
        title={l.name}
        status={<SourceBadge source={l.source} />}
        description={
          <span className="num text-sm break-all">
            {version}
            {l.chain ? <span className="font-sans"> · {l.chain}</span> : null}
          </span>
        }
      />
      <ReadGate id={id} version={version}>
        {() => <ReviewScreen id={id} version={version} />}
      </ReadGate>
    </main>
  );
}

export function ReviewScreen({ id, version }: { id: string; version: string }) {
  const detail = useQuery({
    queryKey: reviewKey(id, version),
    queryFn: () => adminApi.review(id, version),
  });
  if (detail.isError && detail.error instanceof ApiError && detail.error.status === 404)
    return (
      <ErrorState
        source="Review API"
        title="No report version with this id"
        message="Check the link, or go back to the queue."
        action={
          <Link href="/admin" className={worldButtonClass.secondary}>
            Back to the queue
          </Link>
        }
      />
    );
  return (
    <LoadState
      query={detail}
      source="Review API"
      skeleton={
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" aria-label="Loading the report">
          <div className="sweep h-96 rounded-xl" />
          <div className="sweep h-72 rounded-xl" />
        </div>
      }
    >
      {(d) => <Workspace d={d} />}
    </LoadState>
  );
}

function Workspace({ d }: { d: ReviewDetail }) {
  const qc = useQueryClient();
  const report = reportKey(d.report_id, d.report_version);
  const label = reportLabel(d.report_id, d.report_version, d.report_sha256);
  const [decision, setDecision] = useState<Decision>('approve');
  const [reason, setReason] = useState('');
  const [attemptId, setAttemptId] = useState<string | null>(d.pending_attempt?.id ?? null);

  const attempt = useQuery({
    queryKey: attemptKey(attemptId ?? ''),
    queryFn: () => adminApi.attempt(report, attemptId!),
    enabled: !!attemptId,
    initialData: d.pending_attempt?.id === attemptId ? (d.pending_attempt ?? undefined) : undefined,
    refetchInterval: (q) =>
      q.state.data && FINAL_ATTEMPT.includes(q.state.data.status)
        ? false
        : Math.max(2, q.state.data?.interval ?? 5) * 1000,
    refetchIntervalInBackground: true,
  });
  const start = useMutation({
    mutationFn: (v: { decision: Decision; reason: string }) =>
      adminApi.startDecision(d.report_id, d.report_version, {
        decision: v.decision,
        reason: v.reason.trim(),
        expected_target_digest: d.target_digest!,
      }),
    onSuccess: (a) => {
      qc.setQueryData(attemptKey(a.id), a);
      setAttemptId(a.id);
    },
  });
  const cancel = useMutation({
    mutationFn: (aid: string) => adminApi.cancelAttempt(report, aid),
    onSuccess: (a) => qc.setQueryData(attemptKey(a.id), a),
  });

  const a: ReviewAttempt | undefined = attemptId ? attempt.data : undefined;
  const final = a && FINAL_ATTEMPT.includes(a.status);
  useEffect(() => {
    if (final) {
      qc.invalidateQueries({ queryKey: reviewKey(d.report_id, d.report_version) });
      qc.invalidateQueries({ queryKey: reviewQueueKey });
    }
  }, [final, qc, d.report_id, d.report_version]);

  const integrityOk = d.integrity === 'ok';
  const canDecide = !!d.target_digest && integrityOk;

  // While a decision waits for World App, and until its result is dismissed, the confirmation takes the page.
  if (a) {
    const dismiss = () => {
      if (a.status === 'confirmed') setReason('');
      setAttemptId(null);
      start.reset();
    };
    const back = (
      <button type="button" onClick={dismiss} className={worldButtonClass.secondary}>
        <ArrowLeft size={16} aria-hidden /> Back to the report
      </button>
    );
    const resultAction =
      a.status === 'confirmed' ? (
        <>
          {back}
          {a.decision === 'approve' && label.source === 'generated' && (
            <Link href={caseFileHref(d.report_id, d.report_version)} className={worldButtonClass.primary}>
              Publish onchain <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </>
      ) : a.status === 'expired' ? (
        <>
          {back}
          <button
            type="button"
            disabled={!canDecide || start.isPending}
            onClick={() => {
              setDecision(a.decision);
              setReason(a.reason);
              start.mutate({ decision: a.decision, reason: a.reason });
            }}
            className={worldButtonClass.primary}
          >
            <ScanEye size={16} aria-hidden /> {start.isPending ? 'Starting…' : 'Get a new code'}
          </button>
        </>
      ) : a.status === 'superseded' ? (
        <button type="button" onClick={dismiss} className={worldButtonClass.primary}>
          Review the new version
        </button>
      ) : (
        <button type="button" onClick={dismiss} className={worldButtonClass.primary}>
          <ArrowLeft size={16} aria-hidden /> Back to the decision
        </button>
      );
    return (
      <WorldConfirm
        autoFocus
        action={a.decision}
        phase={attemptPhase(a.status)}
        subject={label.name}
        version={d.report_version}
        digest={a.target_digest}
        reason={a.reason}
        userCode={a.user_code}
        qrValue={a.verification_uri}
        openUrl={a.verification_uri}
        expiresAt={a.expires_at}
        detail={a.detail}
        onCancel={() => cancel.mutate(a.id)}
        cancelling={cancel.isPending}
        error={
          cancel.isError
            ? `Couldn’t cancel: ${cancel.error.message}`
            : start.isError
              ? `Couldn’t start: ${start.error.message}`
              : null
        }
        resultTitle={a.status === 'confirmed' ? `${DECISION_LABEL[a.decision]}: recorded` : undefined}
        resultBody={
          a.status === 'confirmed'
            ? a.decision === 'approve'
              ? 'This version is now in the public report library. Nothing is onchain yet.'
              : 'The decision is recorded with your World ID confirmation.'
            : undefined
        }
        resultAction={resultAction}
      />
    );
  }

  return (
    <div className="space-y-6">
      {!integrityOk && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-[color-mix(in_srgb,var(--mask-500)_70%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_14%,transparent)] p-5"
        >
          <OctagonAlert size={22} aria-hidden className="text-mask-ink mt-0.5 shrink-0" />
          <div>
            <p className="text-mask-ink text-lg font-semibold">Integrity check failed — don’t approve</p>
            <p className="mt-1 text-[15px] break-words">{d.integrity}</p>
            <p className="text-muted mt-1 text-sm">Decisions are off until the backend’s check passes.</p>
          </div>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {label.source === 'reference' ? (
            <>
              <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
                <BookOpen size={16} aria-hidden /> Historical reference reader.
                <Link href={referenceReaderHref(d)} className="text-beam-ink underline underline-offset-4">
                  Open full width
                </Link>
              </p>
              <ReferenceReader id={d.report_id} version={d.report_version} />
            </>
          ) : (
            <>
              <Summary d={d} />
              <ReportFiles id={d.report_id} version={d.report_version} />
            </>
          )}
        </div>
        <aside
          aria-label="Decision"
          className="space-y-6 lg:sticky lg:top-[8.5rem] lg:max-h-[calc(100vh-9.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
        >
          <DecisionPanel
            d={d}
            decision={decision}
            setDecision={setDecision}
            reason={reason}
            setReason={setReason}
            disabled={!canDecide}
            starting={start.isPending}
            startError={start.isError ? start.error.message : null}
            onConfirm={() => start.mutate({ decision, reason })}
          />
          {d.state === 'approved' && <NextStep d={d} reference={label.source === 'reference'} />}
          <History decisions={d.decisions} />
          <RevokePanel d={d} />
        </aside>
      </div>
    </div>
  );
}

function Summary({ d }: { d: ReviewDetail }) {
  const s = d.summary;
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold">
          {s?.assessment?.label ? `Assessment: ${s.assessment.label}` : 'Assessment'}
        </h2>
        <ReviewStateChip state={d.state} />
      </div>
      {s?.assessment?.summary ? (
        <p className="max-w-[68ch] text-[15px]">{s.assessment.summary}</p>
      ) : (
        <p className="text-muted text-[15px]">The backend sent no assessment summary.</p>
      )}
      {!!s?.pillars?.length && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {s.pillars.map((p) => (
            <li key={p.pillar} className="border-line rounded-xl border p-4">
              <p className="font-semibold">
                {p.pillar}
                {p.status ? <span className="text-muted font-normal"> · {p.status}</span> : null}
              </p>
              {p.summary ? <p className="text-muted mt-1 text-sm">{p.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {!!s?.limitations?.length && (
        <div className="mt-5">
          <h3 className="font-semibold">Limitations</h3>
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {s.limitations.map((l, i) => (
              <li key={i}>{typeof l === 'string' ? l : JSON.stringify(l)}</li>
            ))}
          </ul>
        </div>
      )}
      {s?.evidence && <p className="text-muted mt-4 text-sm">Evidence items: {s.evidence.length}</p>}
      <TechnicalDetails className="mt-5">
        <dl className="space-y-3">
          <div>
            <dt className="text-muted">Report id</dt>
            <dd className="num break-all">{d.report_id}</dd>
          </div>
          <div>
            <dt className="text-muted">Report SHA-256</dt>
            <dd>
              <HashText value={d.report_sha256} label="report SHA-256" />
            </dd>
          </div>
          {d.target_digest && (
            <div>
              <dt className="text-muted">Review target (what your decision covers)</dt>
              <dd>
                <HashText value={d.target_digest} label="target digest" />
              </dd>
            </div>
          )}
        </dl>
      </TechnicalDetails>
    </Card>
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
      const blob = await adminApi.file(reportKey(id, version), url);
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

  return (
    <Card title="Full report">
      <LoadState
        query={listing}
        source="Review API"
        compact
        skeleton={<div className="sweep h-10 w-64 rounded-xl" />}
      >
        {(l) => {
          const a = l.artifacts;
          return (
            <>
              {l.render_status === 'not_rendered' && (
                <Banner tone="info" title="Not rendered yet">
                  No rendered HTML or PDF for these exact bytes. Review the summary, or render it first.
                </Banner>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
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
            </>
          );
        }}
      </LoadState>
      {error && (
        <div className="mt-3">
          <Banner tone="danger" title="Couldn't open the file">
            {error}
          </Banner>
        </div>
      )}
      {viewing && (
        // Sandboxed: the report's own scripts run in an opaque origin with no access to this page or its session.
        <iframe
          title="Full report"
          src={viewing}
          sandbox="allow-scripts"
          className="border-line mt-4 h-[70vh] w-full rounded-xl border bg-white"
        />
      )}
    </Card>
  );
}

export function DecisionPanel({
  d,
  decision,
  setDecision,
  reason,
  setReason,
  disabled,
  starting,
  startError,
  onConfirm,
}: {
  d: Pick<ReviewDetail, 'target_digest' | 'state'>;
  decision: Decision;
  setDecision: (x: Decision) => void;
  reason: string;
  setReason: (x: string) => void;
  disabled: boolean;
  starting: boolean;
  startError: string | null;
  onConfirm: () => void;
}) {
  const ok = !disabled && reasonOk(reason) && !starting;
  return (
    <section aria-labelledby="decide-h" className="glass p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="decide-h" className="text-[22px] font-semibold">
          Your verdict
        </h2>
        <ReviewStateChip state={d.state} />
      </div>
      <fieldset disabled={disabled} className="mt-4 space-y-2 disabled:opacity-60">
        <legend className="sr-only">Decision</legend>
        {(['approve', 'reject', 'revise'] as Decision[]).map((x) => {
          const I = DECISION_ICON[x];
          const on = decision === x;
          return (
            <label
              key={x}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                on ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_8%,transparent)]' : 'border-line hover:border-[var(--fog-400)]'
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={x}
                checked={on}
                onChange={() => setDecision(x)}
                className="sr-only"
              />
              <I
                size={20}
                aria-hidden
                className={`mt-0.5 shrink-0 ${x === 'approve' ? 'text-clue-ink' : x === 'reject' ? 'text-mask-ink' : 'text-beam-ink'}`}
              />
              <span>
                <span className="block font-semibold">{DECISION_LABEL[x]}</span>
                <span className="text-muted block text-[13px]">{DECISION_CONSEQUENCE[x]}</span>
              </span>
            </label>
          );
        })}
        <label className="mt-4 block">
          <span className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Reason</span>
            <span className={`num text-xs ${reason.length >= REASON_MAX ? 'text-mask-ink' : 'text-muted'}`}>
              {reason.length}/{REASON_MAX}
            </span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REASON_MAX}
            rows={3}
            required
            aria-describedby="reason-hint"
            className="border-line bg-surface mt-1 w-full rounded-xl border p-3 text-[15px]"
          />
          <span id="reason-hint" className="text-muted text-[13px]">
            Required. Recorded with your decision.
          </span>
        </label>
      </fieldset>
      <div className="border-line mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
        <span className="text-muted">Review target</span>
        {d.target_digest ? (
          <Digest value={d.target_digest} label="review target" />
        ) : (
          <span className="text-mask-ink">None — decisions unavailable</span>
        )}
      </div>
      {startError && (
        <p role="alert" className="text-mask-ink mt-3 text-sm">
          The decision didn’t start: {startError}
        </p>
      )}
      <button
        type="button"
        disabled={!ok}
        onClick={onConfirm}
        className="bg-beam text-on-beam mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold hover:brightness-105 disabled:opacity-60"
      >
        <ScanEye size={18} aria-hidden />
        {starting ? 'Starting…' : 'Confirm with World ID'}
      </button>
    </section>
  );
}

function NextStep({ d, reference }: { d: ReviewDetail; reference: boolean }) {
  return (
    <Card variant="highlight" title="Next: publish onchain">
      {reference ? (
        <p className="text-[15px]">Reference reports are display-only and never go onchain.</p>
      ) : (
        <>
          <p className="text-[15px]">
            Publishing records this report onchain; a market opens only once a vault is deployed for it. The case file
            shows whether one exists.
          </p>
          <Link href={caseFileHref(d.report_id, d.report_version)} className={`${worldButtonClass.primary} mt-4 w-full`}>
            Publish onchain <ArrowRight size={16} aria-hidden />
          </Link>
        </>
      )}
    </Card>
  );
}

export function History({ decisions }: { decisions: DecisionRecord[] }) {
  if (!decisions.length) return null;
  return (
    <section aria-labelledby="history-h" className="glass p-5 sm:p-6">
      <h2 id="history-h" className="text-lg font-semibold">
        Decision history
      </h2>
      <ol className="mt-4 space-y-5">
        {decisions.map((x, i) => {
          const I = DECISION_ICON[x.decision];
          return (
            <li key={x.receipt_id} className="relative pl-8">
              {i < decisions.length - 1 && (
                <span aria-hidden className="bg-line absolute top-6 bottom-[-1.25rem] left-[9px] w-px" />
              )}
              <I
                size={20}
                aria-hidden
                className={`absolute top-0 left-0 ${x.revoked_at ? 'text-muted' : x.decision === 'approve' ? 'text-clue-ink' : x.decision === 'reject' ? 'text-mask-ink' : 'text-beam-ink'}`}
              />
              <p className={`font-semibold ${x.revoked_at ? 'line-through' : ''}`}>
                {DECISION_LABEL[x.decision]}
                {x.reviewer ? <span className="font-normal"> by {x.reviewer}</span> : null}
              </p>
              <p className="text-muted text-[13px]">
                {new Date(x.decided_at * 1000).toLocaleString()}
                {!x.current_target ? ' · for an earlier version of these bytes' : ''}
                {x.revoked_at ? ' · withdrawn' : ''}
              </p>
              <p className="mt-1 text-sm break-words">{x.reason}</p>
              {x.revoke_reason && <p className="text-muted mt-1 text-sm">Withdrawn: {x.revoke_reason}</p>}
            </li>
          );
        })}
      </ol>
      <TechnicalDetails className="mt-5" title="Receipts">
        <ul className="space-y-2">
          {decisions.map((x) => (
            <li key={x.receipt_id} className="break-all">
              <code className="num">{x.receipt_id}</code> · {x.method} · {x.acr} · target{' '}
              <Digest value={x.target_digest} label="decision target" />
            </li>
          ))}
        </ul>
      </TechnicalDetails>
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
    <section
      aria-labelledby="revoke-h"
      className="rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] p-5"
    >
      <h2 id="revoke-h" className="text-mask-ink text-base font-semibold">
        Danger zone
      </h2>
      <p className="text-muted mt-1 text-sm">
        Withdrawing sends this version back to waiting for review and out of the public library.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REASON_MAX}
        placeholder="Reason"
        aria-label="Reason for withdrawing"
        className="border-line bg-surface mt-3 w-full rounded-xl border p-2.5 text-sm"
      />
      {revoke.isError && (
        <p role="alert" className="text-mask-ink mt-2 text-sm">
          Couldn’t withdraw: {revoke.error.message}
        </p>
      )}
      <button
        type="button"
        disabled={!reason.trim() || revoke.isPending}
        onClick={() => revoke.mutate()}
        className="text-mask-ink mt-3 w-full rounded-xl border border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] px-4 py-2 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--mask-500)_10%,transparent)] disabled:opacity-60"
      >
        {revoke.isPending ? 'Withdrawing…' : 'Withdraw decision'}
      </button>
    </section>
  );
}
