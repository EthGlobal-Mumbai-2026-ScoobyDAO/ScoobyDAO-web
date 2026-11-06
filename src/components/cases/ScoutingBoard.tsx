'use client';
import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chainName } from '@/lib/explorer';
import {
  createScoutingAdapter,
  freshness,
  scoutingApiConfig,
  scoutingOrigin,
  sortScoutingCases,
  sourceAge,
  type ScoutingCase,
  type EvidenceReason,
} from '@/lib/scouting';
import { CasesBoard } from './CasesBoard';

const adapter = scoutingOrigin ? createScoutingAdapter(scoutingOrigin) : null;
const subscribeClock = (notify: () => void) => {
  const timer = window.setInterval(notify, 1000);
  return () => window.clearInterval(timer);
};
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => 0;

export function ScoutingBoard() {
  const [legacyOpen, setLegacyOpen] = useState(false);
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const query = useQuery({
    queryKey: ['scouting-cases', scoutingOrigin],
    queryFn: () => adapter!.list(),
    enabled: !!adapter,
    retry: false,
    refetchInterval: 60_000,
  });
  const result = query.data;
  const all = result?.cases ?? [];
  const freshCases = sortScoutingCases(all);
  const attention = freshCases.filter((c) => c.lane === 'human_review_required');
  const research = freshCases.filter(
    (c) => c.lane === 'research_running' || c.lane === 'auto_qualified',
  );
  const monitored = freshCases.filter((c) => c.lane === 'monitoring' || c.lane === 'unavailable');
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header>
        <p className="text-beam-ink text-sm font-semibold">SCOUTING</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">Case board</h1>
        <p className="text-muted mt-3 max-w-3xl">
          Candidates needing attention, active research and monitored leads. Evidence and source
          timing matter; a candidate is not an approved report.
        </p>
      </header>
      {!adapter && (
        <div role="status" className="border-line bg-surface mt-7 rounded-xl border p-5">
          <h2 className="font-semibold">Scouting unavailable</h2>
          <p className="text-muted mt-2 text-sm">
            {scoutingApiConfig
              ? 'The configured scouting service origin is invalid.'
              : 'The scouting service has not been connected yet.'}{' '}
            No discovery data is being shown.
          </p>
        </div>
      )}
      {adapter && query.isPending && (
        <p role="status" className="mt-7">
          Loading scouting candidates…
        </p>
      )}
      {adapter && query.isError && (
        <div role="alert" className="border-line bg-surface mt-7 rounded-xl border p-5">
          <h2 className="font-semibold">Scouting unavailable</h2>
          <p className="text-muted mt-2 text-sm">
            The service could not be reached or returned an unsupported response.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="text-beam-ink mt-3 underline"
          >
            Try again
          </button>
        </div>
      )}
      {result && !query.isError && (
        <>
          <p className="text-muted mt-7 text-sm">
            Snapshot generated {formatTime(result.generated_at)} ·{' '}
            {freshness(result.generated_at, result.stale_after_seconds, now) === 'fresh'
              ? 'current within the supplied window'
              : freshness(result.generated_at, result.stale_after_seconds, now) === 'stale'
                ? 'stale — refresh before acting'
                : 'freshness unknown'}
          </p>
          {result.truncated && (
            <p className="text-mask-ink mt-3 text-sm" role="status">
              This snapshot is truncated; additional cases are not shown.
            </p>
          )}
          <p className="text-muted mt-2 text-xs">
            Service-reported access: {result.authentication}
          </p>
          {!all.length && (
            <div className="border-line bg-surface mt-4 rounded-xl border p-5">
              <h2 className="font-semibold">No candidates yet</h2>
              <p className="text-muted mt-2 text-sm">
                The scouting service returned an empty snapshot.
              </p>
            </div>
          )}
          <Lane
            title="Needs human attention"
            subtitle="Ordered by the backend’s declared priority; review is not report sign-off."
            items={attention}
            now={now}
          />
          <Lane
            title="Qualified or research in progress"
            subtitle="Automatic qualification starts bounded research, not publication or human approval."
            items={research}
            now={now}
          />
          <Lane
            title="Monitored"
            subtitle="Leads remain under observation or have unavailable workflow state."
            items={monitored}
            now={now}
          />
        </>
      )}
      <section
        aria-label="Historical reference examples"
        className="border-line bg-surface mt-10 rounded-xl border p-5"
      >
        <h2 className="text-xl font-semibold">Historical reference examples</h2>
        <p className="text-muted mt-2 text-sm">
          The separately maintained historical catalog is not connected yet. It is distinct from
          fresh scouting alerts.
        </p>
      </section>
      <details
        className="border-line bg-surface mt-10 rounded-xl border"
        onToggle={(e) => setLegacyOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer p-5 text-lg font-semibold">
          Existing case files and demonstration markets
        </summary>
        <p className="text-muted px-5 pb-2 text-sm">
          Separate from scouting. The fixture-mode banner identifies when case files, approvals or
          markets are simulated; they are not fresh candidate alerts.
        </p>
        {legacyOpen && <CasesBoard />}
      </details>
    </main>
  );
}
function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'unknown';
}
function Lane({
  title,
  subtitle,
  items,
  now,
}: {
  title: string;
  subtitle: string;
  items: ScoutingCase[];
  now: number;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted mt-1 text-sm">{subtitle}</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.candidate_id}>
            <CandidateCard candidate={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
const REASON_LABELS = {
  triggered: 'Triggered',
  not_triggered: 'Not triggered',
  unknown: 'Unknown',
  held: 'Held',
} as const;
const LANE_LABELS = {
  human_review_required: 'Human review required',
  research_running: 'Research running',
  auto_qualified: 'Automatically qualified',
  monitoring: 'Monitored',
  unavailable: 'Workflow unavailable',
} as const;
function CandidateCard({ candidate: c, now }: { candidate: ScoutingCase; now: number }) {
  const showServerStatus = c.status_label.toLowerCase() !== c.lane.replaceAll('_', ' ');
  const laneLabel =
    c.lane === 'research_running' && c.research?.status === 'queued'
      ? 'Research queued'
      : LANE_LABELS[c.lane];
  return (
    <article className="border-line bg-surface flex h-full min-w-0 flex-col rounded-2xl border p-5 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-line text-beam-ink rounded-full border px-2 py-1 text-xs font-semibold">
          {laneLabel}
          {showServerStatus ? ` · ${c.status_label}` : ''}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold">
        {c.identity.symbol?.trim() || 'Symbol unknown'}
      </h3>
      {now > 0 && Date.parse(c.expires_at) <= now && (
        <p className="text-mask-ink mt-2 text-xs font-semibold">
          Snapshot expired — refresh before acting.
        </p>
      )}
      <p className="text-muted mt-1 text-sm">
        {chainName(c.identity.chain_id)} · <span className="break-all">{c.identity.address}</span>
      </p>
      <p className="mt-4 leading-relaxed">{c.summary}</p>
      <dl className="text-muted mt-4 space-y-1 text-xs">
        <div>
          <dt className="inline font-semibold">Observed: </dt>
          <dd className="inline">
            {formatTime(c.observed_at)} · {sourceAge(c.observed_at, now)}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Fetched: </dt>
          <dd className="inline">
            {formatTime(c.fetched_at)} · {sourceAge(c.fetched_at, now)}
          </dd>
        </div>
      </dl>
      <div className="mt-5">
        <h4 className="text-sm font-semibold">Evidence reasons</h4>
        <p className="text-muted mt-1 text-xs">
          Backend-reported fresh verified concern groups: {c.verified_triggered_count}
          {c.verified_triggered_count === 0 && ' · No verified groups does not mean no concerns.'}
        </p>
        <ReasonList reasons={c.reasons} now={now} />
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-semibold">Uncertainty</h4>
        {c.uncertainties.length ? (
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {c.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-2 text-sm">No uncertainty details supplied.</p>
        )}
      </div>
      {c.research && (
        <div className="text-muted mt-4 text-sm break-words">
          <p>
            Research: {c.research.status}
            {c.research.run_id ? ` · run ${c.research.run_id}` : ''}
          </p>
          {c.research.reason && <p className="mt-1">{c.research.reason}</p>}
          {c.research.pillars.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">Pillar states</summary>
              <ul className="mt-2 space-y-1">
                {c.research.pillars.map((pillar) => (
                  <li key={pillar.pillar}>
                    {pillar.pillar}: {pillar.status} · {pillar.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {c.human_action_required && (
        <div className="border-line mt-5 border-t pt-4">
          <button
            type="button"
            disabled
            className="border-line rounded-lg border px-3 py-2 text-sm opacity-60"
          >
            Continue to human verification
          </button>
          <p className="text-muted mt-2 text-xs">
            The authenticated verifier is not connected.{' '}
            {c.continuation.reason ?? 'Continuation is unavailable.'}
          </p>
        </div>
      )}
    </article>
  );
}

function ReasonList({ reasons, now }: { reasons: EvidenceReason[]; now: number }) {
  if (!reasons.length)
    return <p className="text-muted mt-2 text-sm">No evidence reasons supplied.</p>;
  const triggered = reasons.filter((reason) => reason.verification_status === 'triggered');
  const other = reasons.filter((reason) => reason.verification_status !== 'triggered');
  const shown = [...triggered, ...other.slice(0, 2)];
  const remaining = other.slice(2);
  const rows = (items: EvidenceReason[]) => (
    <ul className="mt-2 space-y-3">
      {items.map((e, i) => (
        <li key={`${e.group_id}-${i}`} className="border-line border-l-2 pl-3 text-sm">
          <p className="text-beam-ink text-xs font-semibold">
            {e.group_id} · {REASON_LABELS[e.verification_status]}
          </p>
          <p className="mt-1">{e.description}</p>
          <p className="text-muted mt-1 text-xs break-words">
            Observed {formatTime(e.observed_at)} · {sourceAge(e.observed_at, now)} · Sources:{' '}
            {e.evidence_ids.length ? e.evidence_ids.join(', ') : 'unavailable'}
          </p>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {rows(shown)}
      {remaining.length > 0 && (
        <details className="mt-3">
          <summary className="text-beam-ink cursor-pointer text-sm">
            Show {remaining.length} more screening groups
          </summary>
          {rows(remaining)}
        </details>
      )}
    </>
  );
}
