'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Fingerprint,
  ScanEye,
  ShieldCheck,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { SniffPose, type Pose } from '@/components/SniffPose';
import { formatDuration } from '@/lib/format';
import { InfoTip } from './InfoTip';
import { Stepper, type StepState } from './Stepper';

// One World ID confirmation experience for every reviewer action (read a draft, record a decision, publish).
// Presentational only: the caller drives it from its own state machine (admin session, review attempt or
// publication approval) and maps that machine's exact state names to a phase with the helpers below.

export type WorldAction = 'open' | 'approve' | 'reject' | 'revise' | 'publish' | 'investigate';

export type WorldPhase =
  | 'start'
  | 'waiting'
  | 'confirmed'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'not_permitted'
  | 'failed'
  | 'superseded'
  | 'revoked'
  | 'error';

export const WORLD_ACTION_LABEL: Record<WorldAction, string> = {
  open: 'Open report',
  approve: 'Approve report',
  reject: 'Reject report',
  revise: 'Request revision',
  publish: 'Publish onchain',
  investigate: 'Start investigation',
};

export const WORLD_ACTION_CONSEQUENCE: Record<WorldAction, string> = {
  open: 'Opens only this report version, in this tab. Nothing is decided.',
  approve: 'Approving makes this version public. Nothing goes onchain yet.',
  reject: 'Rejecting keeps this version out of the public library.',
  revise: 'Asks for a new version. This one stays out of the public library.',
  publish: 'Publishing records this exact claim and report hash onchain.',
  investigate: 'Starts an investigation for this case. Nothing goes onchain.',
};

/** What "nothing happened" means for each action, for the failure states. */
const NOTHING: Record<WorldAction, string> = {
  open: 'Nothing was opened.',
  approve: 'Nothing was recorded.',
  reject: 'Nothing was recorded.',
  revise: 'Nothing was recorded.',
  publish: 'Nothing was published onchain.',
  investigate: 'Nothing was started.',
};

export const WORLD_WARNING =
  "Only enter codes you started on this screen. World App shows only 'ScoobyDAO' and this code — check the action above.";

export const TWO_STEP_NOTE =
  "Reading a draft and recording a decision are separate World ID confirmations, so no one can approve with a session they didn't start.";

const RESULT: Record<
  Exclude<WorldPhase, 'start' | 'waiting'>,
  { pose: Pose; title: string; next: string; tone: 'ok' | 'bad' | 'warn' }
> = {
  confirmed: { pose: 'triumphant', title: 'Confirmed in World App', next: 'Continue', tone: 'ok' },
  denied: { pose: 'sad', title: 'Denied in World App', next: 'Try again', tone: 'bad' },
  expired: { pose: 'sad', title: 'The code expired', next: 'Get a new code', tone: 'warn' },
  cancelled: { pose: 'thinking', title: 'Cancelled', next: 'Start again', tone: 'warn' },
  not_permitted: {
    pose: 'sad',
    title: "This World ID isn't an enrolled reviewer",
    next: 'Try again',
    tone: 'bad',
  },
  failed: { pose: 'shrug', title: "World couldn't confirm", next: 'Try again', tone: 'bad' },
  error: { pose: 'shrug', title: 'World verification unavailable', next: 'Try again', tone: 'bad' },
  superseded: {
    pose: 'alert',
    title: 'The report changed',
    next: 'Review the new version',
    tone: 'warn',
  },
  revoked: { pose: 'thinking', title: 'Closed', next: 'Open again', tone: 'warn' },
};

const RESULT_BODY: Partial<Record<WorldPhase, string>> = {
  not_permitted: 'Ask an operator to add it to the reviewer list.',
  superseded: 'Review the new version before deciding.',
  revoked: 'This report is closed in this tab.',
};

export const isWorldResult = (p: WorldPhase) => p !== 'start' && p !== 'waiting';

/** Stepper states for 1 Start → 2 Confirm in World App → 3 Done. */
export function worldSteps(phase: WorldPhase): StepState[] {
  if (phase === 'start') return ['current', 'todo', 'todo'];
  if (phase === 'waiting') return ['done', 'current', 'todo'];
  if (phase === 'confirmed') return ['done', 'done', 'done'];
  return ['done', 'failed', 'todo'];
}

/** The code with spaces between characters, so screen readers spell it out. */
export const spelledCode = (code: string) => code.split('').join(' ');

/** Short digest `13cfdb…ea99` (no 0x) for display next to a copy button; the full value is copied. */
export function shortDigest(value: string, head = 6, tail = 4) {
  const v = value.startsWith('0x') ? value.slice(2) : value;
  const prefix = value.startsWith('0x') ? '0x' : '';
  return v.length <= head + tail + 1 ? value : `${prefix}${v.slice(0, head)}…${v.slice(-tail)}`;
}

export function CopyButton({
  value,
  label,
  className = '',
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={`text-muted hover:text-text inline-flex shrink-0 items-center rounded p-1 ${className}`}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );
}

/** A short digest the user must verify, with the full value in the title and on the clipboard. */
export function Digest({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="num text-sm" title={value}>
        {shortDigest(value)}
      </code>
      <CopyButton value={value} label={label} />
    </span>
  );
}

/** Ring that empties toward expiry; the remaining time is in text inside it. */
export function CountdownRing({ expiresAt, size = 72 }: { expiresAt: number; size?: number }) {
  // The full ring is the time left when this code was first shown.
  const [t, setT] = useState<{ now: number; total: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      const n = Math.floor(Date.now() / 1000);
      setT((prev) => ({ now: n, total: prev?.total ?? Math.max(1, expiresAt - n) }));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiresAt]);
  const now = t?.now ?? null;
  const total = t?.total ?? null;
  const left = now === null ? null : Math.max(0, expiresAt - now);
  const frac = left === null || total === null ? 1 : Math.min(1, left / total);
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const low = left !== null && left <= 30;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={`${low ? 'stroke-mask' : 'stroke-beam'} transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {left === null ? (
          <span className="num text-sm">--:--</span>
        ) : (
          <time dateTime={new Date(expiresAt * 1000).toISOString()} className="num text-sm font-semibold">
            {left > 0 ? formatDuration(left) : 'now'}
          </time>
        )}
      </span>
    </span>
  );
}

export interface WorldConfirmProps {
  action: WorldAction;
  phase: WorldPhase;
  /** Token symbol or report name, and its version. */
  subject?: ReactNode;
  version?: string;
  /** The digest the confirmation is bound to (review target, report SHA-256, claim hash). */
  digest?: string | null;
  digestLabel?: string;
  reason?: string;
  /** Overrides the default consequence line for the action. */
  consequence?: ReactNode;
  /** Extra content inside "What you're confirming" (e.g. the claim card on the publication sign-off). */
  details?: ReactNode;
  userCode?: string;
  /** Value encoded in the QR (the World link the phone opens). */
  qrValue?: string;
  /** "Open World App" link, when the flow has one. */
  openUrl?: string;
  /** Unix seconds. */
  expiresAt?: number;
  /** Line from the backend explaining a result. */
  detail?: string | null;
  // start step
  startTitle?: string;
  startBody?: ReactNode;
  startLabel?: string;
  onStart?: () => void;
  starting?: boolean;
  /** Error starting or cancelling; shown in the current step. */
  error?: string | null;
  // waiting step
  onCancel?: () => void;
  cancelling?: boolean;
  /** Shown instead of the Cancel button when the flow can't be cancelled. */
  noCancelNote?: ReactNode;
  // results
  resultTitle?: string;
  resultBody?: ReactNode;
  /** Replaces the result's single next action. */
  resultAction?: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  /** Move focus into the panel on mount (when a click just opened it). */
  autoFocus?: boolean;
  /** When the page already shows its own journey stepper. */
  hideStepper?: boolean;
  className?: string;
}

const btnPrimary =
  'bg-beam text-on-beam inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold hover:brightness-105 disabled:opacity-60';
const btnSecondary =
  'border-line inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 font-semibold hover:border-[var(--fog-400)] disabled:opacity-60';

/**
 * The World ID confirmation panel: a stepper, "What you're confirming", then the start button, the code step or a
 * full-panel result with Sniff and one next action.
 */
export function WorldConfirm(p: WorldConfirmProps) {
  const {
    action,
    phase,
    autoFocus,
    hideStepper,
    className = '',
  } = p;
  const uid = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Esc asks before cancelling; the question belongs to this code only.
  const askKey = `${phase}:${p.userCode ?? ''}`;
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const askCancel = askedFor === askKey;
  const setAskCancel = (v: boolean) => setAskedFor(v ? askKey : null);
  // Focus follows the step: into the panel when it opens from a click, and on every phase change after that.
  const lastPhase = useRef<WorldPhase | null>(autoFocus ? null : phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    headingRef.current?.focus();
  }, [phase]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && phase === 'waiting' && p.onCancel && !askCancel) {
      e.preventDefault();
      setAskCancel(true);
    }
  };

  const steps = worldSteps(phase);
  const label = WORLD_ACTION_LABEL[action];
  const result = isWorldResult(phase) ? RESULT[phase as keyof typeof RESULT] : null;
  const heading =
    phase === 'start'
      ? (p.startTitle ?? 'Show your World ID')
      : phase === 'waiting'
        ? 'Confirm in World App'
        : (p.resultTitle ?? result!.title);
  const live =
    phase === 'waiting'
      ? 'Waiting for World App.'
      : phase === 'start'
        ? ''
        : `${heading}. ${phase === 'confirmed' ? '' : NOTHING[action]}`;

  return (
    <section
      aria-labelledby={`${uid}-h`}
      onKeyDown={onKeyDown}
      className={`mx-auto w-full max-w-[880px] space-y-6 ${className}`}
      data-world-phase={phase}
    >
      {!hideStepper && (
        <Stepper
          label="World ID confirmation"
          steps={[
            { label: 'Start', state: steps[0] },
            { label: 'Confirm in World App', state: steps[1] },
            { label: 'Done', state: steps[2] },
          ]}
        />
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {result ? (
        <ResultPanel {...p} headingId={`${uid}-h`} headingRef={headingRef} heading={heading} />
      ) : (
        <>
          <Confirming {...p} label={label} />
          {phase === 'start' ? (
            <div className="glass p-5 sm:p-6">
              <h2
                id={`${uid}-h`}
                ref={headingRef}
                tabIndex={-1}
                style={{ outline: 'none' }} className="text-[22px] font-semibold"
              >
                {heading}
              </h2>
              <p className="text-muted mt-1 max-w-[68ch]">
                {p.startBody ?? 'You confirm in World App on your phone. This screen shows a code to check.'}
              </p>
              {p.error && (
                <p role="alert" className="text-mask-ink mt-3 text-sm">
                  {p.error}
                </p>
              )}
              <button
                type="button"
                onClick={p.onStart}
                disabled={!p.onStart || p.starting}
                className={`${btnPrimary} mt-5 w-full sm:w-auto`}
              >
                <ScanEye size={18} aria-hidden />
                {p.starting ? 'Starting…' : (p.startLabel ?? `${label} with World ID`)}
              </button>
            </div>
          ) : (
            <CodeStep
              {...p}
              headingId={`${uid}-h`}
              headingRef={headingRef}
              heading={heading}
              askCancel={askCancel}
              setAskCancel={setAskCancel}
            />
          )}
        </>
      )}
    </section>
  );
}

function Confirming({
  action,
  label,
  subject,
  version,
  digest,
  digestLabel = 'Review target',
  reason,
  consequence,
  details,
}: WorldConfirmProps & { label: string }) {
  return (
    <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_8%,var(--surface))] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-muted text-sm font-medium">What you’re confirming</h3>
        <InfoTip label="Why World ID asks again">{TWO_STEP_NOTE}</InfoTip>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold">{label}</span>
        {subject && (
          <span className="text-lg">
            <span className="font-semibold">{subject}</span>
            {version && <span className="text-muted num ml-2 text-sm break-all">{version}</span>}
          </span>
        )}
      </p>
      {(digest || reason) && (
        <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-[auto_1fr] sm:gap-x-6">
          {digest && (
            <>
              <dt className="text-muted">{digestLabel}</dt>
              <dd>
                <Digest value={digest} label={digestLabel.toLowerCase()} />
              </dd>
            </>
          )}
          {reason && (
            <>
              <dt className="text-muted">Reason</dt>
              <dd className="break-words">“{reason}”</dd>
            </>
          )}
        </dl>
      )}
      {details && <div className="mt-4">{details}</div>}
      <p className="border-line mt-4 flex items-start gap-2 border-t pt-4 text-[15px]">
        <ShieldCheck size={18} aria-hidden className="text-beam-ink mt-0.5 shrink-0" />
        {consequence ?? WORLD_ACTION_CONSEQUENCE[action]}
      </p>
    </div>
  );
}

type Inner = WorldConfirmProps & {
  headingId: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  heading: string;
};

function CodeStep({
  userCode,
  qrValue,
  openUrl,
  expiresAt,
  onCancel,
  cancelling,
  noCancelNote,
  error,
  headingId,
  headingRef,
  heading,
  askCancel,
  setAskCancel,
}: Inner & { askCancel: boolean; setAskCancel: (v: boolean) => void }) {
  return (
    <div className="bg-surface rounded-2xl border-2 border-[color-mix(in_srgb,var(--ghost-300)_45%,transparent)] p-5 sm:p-8">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} style={{ outline: 'none' }} className="text-[22px] font-semibold">
        {heading}
      </h2>
      <div className="mt-5 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-muted text-sm">Your code</p>
          <p className="mt-1 flex flex-wrap items-center gap-3">
            <span aria-hidden className="num text-[2.5rem] leading-none font-bold tracking-[0.1em] whitespace-nowrap sm:text-6xl sm:tracking-[0.16em]">
              {userCode ?? '—'}
            </span>
            {userCode && <span className="sr-only">Code: {spelledCode(userCode)}</span>}
            {userCode && <CopyButton value={userCode} label="code" className="p-2" />}
          </p>
          <p className="mt-4 flex items-center gap-2 text-[15px]">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="bg-ghost absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
              <span className="bg-ghost relative inline-flex h-2.5 w-2.5 rounded-full" />
            </span>
            Waiting for World App…
          </p>
          {expiresAt && (
            <div className="mt-5 flex items-center gap-3">
              <CountdownRing expiresAt={expiresAt} />
              <span className="text-muted text-sm">until this code expires</span>
            </div>
          )}
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-6 w-full sm:w-auto`}>
              Open World App <ExternalLink size={18} aria-hidden />
            </a>
          )}
        </div>
        {qrValue && (
          <figure className="flex shrink-0 flex-col items-center gap-2 self-center md:self-start">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={qrValue} size={200} marginSize={0} level="M" title="Scan with World App" />
            </div>
            <figcaption className="text-muted text-[13px]">Scan from inside World App</figcaption>
          </figure>
        )}
      </div>
      <p className="mt-6 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] p-3 text-sm">
        <AlertTriangle size={16} aria-hidden className="text-beam-ink mt-0.5 shrink-0" />
        {WORLD_WARNING}
      </p>
      {error && (
        <p role="alert" className="text-mask-ink mt-3 text-sm">
          {error}
        </p>
      )}
      {onCancel ? (
        askCancel ? (
          <div role="alertdialog" aria-label="Cancel this confirmation?" className="border-line mt-4 rounded-xl border p-4">
            <p className="font-semibold">Cancel this confirmation?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" autoFocus onClick={() => setAskCancel(false)} className={btnSecondary}>
                Keep waiting
              </button>
              <button type="button" onClick={onCancel} disabled={cancelling} className={`${btnSecondary} text-mask-ink`}>
                <X size={16} aria-hidden /> Yes, cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onCancel} disabled={cancelling} className={`${btnSecondary} mt-4 w-full`}>
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )
      ) : (
        noCancelNote && <p className="text-muted mt-4 text-sm">{noCancelNote}</p>
      )}
    </div>
  );
}

function ResultPanel({
  action,
  phase,
  detail,
  resultBody,
  resultAction,
  onNext,
  nextLabel,
  headingId,
  headingRef,
  heading,
  subject,
  version,
}: Inner) {
  const r = RESULT[phase as keyof typeof RESULT];
  const tone =
    r.tone === 'ok'
      ? 'border-[color-mix(in_srgb,var(--clue-500)_60%,transparent)]'
      : r.tone === 'bad'
        ? 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)]'
        : 'border-[color-mix(in_srgb,var(--beam-400)_60%,transparent)]';
  const body =
    resultBody ??
    (phase === 'confirmed' ? null : (
      <>
        {RESULT_BODY[phase] ? `${RESULT_BODY[phase]} ` : ''}
        {phase === 'revoked' ? '' : NOTHING[action]}
      </>
    ));
  return (
    <div
      role={r.tone === 'ok' ? undefined : 'alert'}
      className={`bg-surface flex flex-col items-center rounded-2xl border-2 px-5 py-10 text-center sm:px-10 ${tone}`}
    >
      <SniffPose pose={r.pose} size={132} />
      <h2 id={headingId} ref={headingRef} tabIndex={-1} style={{ outline: 'none' }} className="font-display mt-4 text-2xl sm:text-3xl">
        {heading}
      </h2>
      <p className="text-muted mt-1 text-sm">
        {WORLD_ACTION_LABEL[action]}
        {subject && (
          <>
            {' · '}
            <span className="text-text font-semibold">{subject}</span>
            {version && <span className="num"> {version}</span>}
          </>
        )}
      </p>
      {body && <div className="mt-3 max-w-[60ch] text-[15px]">{body}</div>}
      {detail && <p className="text-muted mt-2 max-w-[60ch] text-sm">{detail}</p>}
      {resultAction ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">{resultAction}</div>
      ) : (
        onNext && (
          <button type="button" onClick={onNext} className={`${btnPrimary} mt-6`}>
            {phase === 'confirmed' ? <Check size={18} aria-hidden /> : <Fingerprint size={18} aria-hidden />}
            {nextLabel ?? r.next}
          </button>
        )
      )}
    </div>
  );
}

export const worldButtonClass = { primary: btnPrimary, secondary: btnSecondary };
