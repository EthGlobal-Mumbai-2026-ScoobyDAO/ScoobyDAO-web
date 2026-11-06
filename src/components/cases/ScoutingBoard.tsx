'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CaseWorldAction, RetryInvestigation } from './CaseWorldAction';
import { InvestigationProgress } from './InvestigationProgress';
import { DiagnosticsBoard } from './DiagnosticsBoard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Identicon } from '@/components/Identicon';
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'research' | 'monitored'>('all');
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const query = useQuery({
    queryKey: ['scouting-cases', scoutingOrigin],
    queryFn: () => adapter!.list(),
    enabled: !!adapter,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.cases.some(
        (item) => item.research && ['queued', 'running'].includes(item.research.status),
      )
        ? 3_000
        : 60_000,
  });
  const result = query.data;
  const all = result?.cases ?? [];
  const freshCases = sortScoutingCases(all);
  const q = search.trim().toLowerCase();
  const matching = freshCases.filter(
    (c) =>
      !q ||
      c.candidate_id.toLowerCase().includes(q) ||
      (c.identity.symbol ?? '').toLowerCase().includes(q),
  );
  const filtered = matching.filter(
    (c) =>
      filter === 'all' ||
      (filter === 'attention' && c.lane === 'human_review_required') ||
      (filter === 'research' &&
        ['research_running', 'research_partial', 'research_complete', 'auto_qualified'].includes(
          c.lane,
        )) ||
      (filter === 'monitored' && (c.lane === 'monitoring' || c.lane === 'unavailable')),
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      {process.env.NEXT_PUBLIC_SYNTHETIC_JOURNEY === 'true' && (
        <p
          role="status"
          className="border-mask text-mask-ink mb-6 rounded-xl border p-3 text-sm font-semibold"
        >
          Synthetic acceptance environment: World ID, case admission and model responses are
          simulated.
        </p>
      )}
      <p className="border-line text-muted mb-6 rounded-xl border p-3 text-xs" role="note">
        Local admin prototype: admin sessions and private draft access controls are not yet
        connected.
      </p>
      <header>
        <p className="text-beam-ink text-sm font-semibold">SCOUTING</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">Case board</h1>
        <p className="text-muted mt-3 max-w-3xl">
          Candidates needing attention, active research and monitored leads. Evidence and source
          timing matter; a candidate is not an approved report.
        </p>
      </header>
      <div className="mt-8 space-y-4">
        <label className="relative block">
          <span className="sr-only">Search scouting by token, address or candidate ID</span>
          <Search
            size={16}
            className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Token, address or candidate ID"
            className="num border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] py-2.5 pr-3 pl-9 text-sm outline-none"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Filter scouting phase"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {(
            [
              ['all', 'All'],
              ['attention', 'Needs attention'],
              ['research', 'Research'],
              ['monitored', 'Monitored'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${filter === value ? 'border-beam text-text bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]' : 'border-line text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
          {all.length > 0 && matching.length === 0 && (
            <p className="text-muted mt-6">No scouting candidates match this search.</p>
          )}
          {matching.length > 0 && filtered.length === 0 && (
            <p className="text-muted mt-6">No candidates in this phase.</p>
          )}
          <Lane
            title="Scouting queue"
            subtitle="Ranked by the backend's investigation priority."
            items={filtered}
            now={now}
            actionable={result.schema_version === 'scouting-case-list/2'}
          />
        </>
      )}
      {scoutingOrigin && <DiagnosticsBoard origin={scoutingOrigin} />}
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
  actionable,
}: {
  title: string;
  subtitle: string;
  items: ScoutingCase[];
  now: number;
  actionable: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted mt-1 text-sm">{subtitle}</p>
      <div className="cork mt-4 rounded-2xl p-5 sm:p-8">
        <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.candidate_id}>
              <CandidateCard candidate={item} now={now} actionable={actionable} />
            </li>
          ))}
        </ul>
      </div>
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
  research_partial: 'Research partial',
  research_complete: 'Research complete',
  auto_qualified: 'Automatically qualified',
  monitoring: 'Monitored',
  unavailable: 'Workflow unavailable',
} as const;
function CandidateCard({
  candidate: c,
  now,
  actionable,
}: {
  candidate: ScoutingCase;
  now: number;
  actionable: boolean;
}) {
  const queryClient = useQueryClient();
  const onChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['scouting-cases', scoutingOrigin] });
  }, [queryClient]);
  const showServerStatus = c.status_label.toLowerCase() !== c.lane.replaceAll('_', ' ');
  const laneLabel =
    c.lane === 'research_running' && c.research?.status === 'queued'
      ? 'Research queued'
      : LANE_LABELS[c.lane];
  const triggered = c.reasons.filter((reason) => reason.verification_status === 'triggered');
  const missing = c.reasons.filter(
    (reason) => reason.verification_status === 'unknown' || reason.verification_status === 'held',
  );
  const clues = [...(c.scouting_clues ?? [])].sort(
    (a, b) => Number(b.kind === 'provider_claim') - Number(a.kind === 'provider_claim'),
  );
  const nextReason = c.routing_rationale || 'Routing rationale not supplied in this snapshot.';
  const shortReason = nextReason.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || nextReason;
  return (
    <article className="paper-plain relative flex h-full min-w-0 flex-col p-4 pt-7 [overflow-wrap:anywhere]">
      <span
        aria-hidden
        className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
      />
      <div className="flex items-start gap-3">
        <Identicon address={c.identity.address} size={52} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{c.identity.symbol?.trim() || 'Symbol unknown'}</h3>
          <p className="text-muted mt-0.5 text-xs">
            {chainName(c.identity.chain_id)} ·{' '}
            <span className="break-all">{c.identity.address}</span>
          </p>
          <span className="border-line text-beam-ink mt-2 inline-block rounded-full border px-2 py-1 text-xs font-semibold">
            {laneLabel}
            {showServerStatus ? ` · ${c.status_label}` : ''}
          </span>
        </div>
      </div>
      {now > 0 && Date.parse(c.expires_at) <= now && (
        <p className="text-mask-ink mt-3 text-xs font-semibold">
          Snapshot expired — refresh before acting.
        </p>
      )}
      <div className="border-line mt-4 border-t pt-3">
        <h4 className="text-muted text-xs font-semibold uppercase">Why scouted</h4>
        {clues.length ? (
          <ul className="mt-2 space-y-2">
            {clues.slice(0, 3).map((clue, i) => (
              <li key={i} className="text-sm">
                <span className="text-xs font-semibold">
                  {clue.verification === 'unverified_provider_claim'
                    ? 'Unverified provider claim'
                    : 'Unverified provider lead'}{' '}
                  ·{' '}
                </span>
                {clue.description}
                <span className="text-muted block text-xs">
                  Observed: {clue.observed_at ? formatTime(clue.observed_at) : 'time unknown'} ·
                  fetched {sourceAge(clue.fetched_at, now)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm">Original scouting trigger not supplied in this snapshot.</p>
        )}
      </div>
      <div className="border-line mt-3 border-t pt-3">
        <h4 className="text-muted text-xs font-semibold uppercase">What the checks found</h4>
        <p className="mt-1 text-sm">
          {c.verified_triggered_count} fresh verified concern{' '}
          {c.verified_triggered_count === 1 ? 'group' : 'groups'} ·{' '}
          {missing.filter((r) => r.verification_status === 'unknown').length} unknown ·{' '}
          {missing.filter((r) => r.verification_status === 'held').length} held
        </p>
        {triggered.map((reason, i) => (
          <p key={`${reason.group_id}-${i}`} className="mt-1 text-sm">
            <strong>{reason.name || reason.group_id}:</strong> {reason.description}
          </p>
        ))}
        {c.evidence_freshness && (
          <p className="text-muted mt-1 text-xs">Evidence freshness: {c.evidence_freshness}</p>
        )}
      </div>
      <div className="border-line mt-3 border-t pt-3">
        <h4 className="text-muted text-xs font-semibold uppercase">Next step / why waiting</h4>
        <p className="mt-1 text-sm">
          {laneLabel}. {shortReason}
        </p>
        {c.research && (
          <p className="text-muted mt-1 text-xs">
            Research status: {c.research.status}
            {c.research.run_id ? ` · run ${c.research.run_id}` : ''}
          </p>
        )}
      </div>
      {actionable &&
        scoutingOrigin &&
        c.research &&
        ['world_id_human', 'policy_qualified_local'].includes(c.research.authorization || '') && (
          <InvestigationProgress research={c.research} origin={scoutingOrigin} />
        )}
      {!actionable && c.human_action_required && (
        <p className="text-muted mt-3 text-xs">
          Investigation confirmation requires a version 2 service.
        </p>
      )}
      {actionable &&
        (c.human_action_required ||
          (c.lane === 'monitoring' && c.continuation.availability === 'available')) &&
        scoutingOrigin && (
          <CaseWorldAction candidate={c} origin={scoutingOrigin} onChanged={onChanged} now={now} />
        )}
      {actionable &&
        scoutingOrigin &&
        c.research &&
        ['blocked', 'failed'].includes(c.research.status) &&
        ['world_id_human', 'policy_qualified_local'].includes(c.research.authorization || '') && (
          <RetryInvestigation
            candidate={c}
            origin={scoutingOrigin}
            onChanged={onChanged}
            now={now}
          />
        )}
      {actionable &&
        c.research?.report_id &&
        c.research.report_version &&
        ['world_id_human', 'policy_qualified_local'].includes(c.research.authorization || '') && (
          <Link
            className="text-beam-ink mt-3 inline-block text-sm font-semibold underline"
            href={`/reports/${encodeURIComponent(`${c.research.report_id}~${c.research.report_version}`)}`}
          >
            Open investigation report →
          </Link>
        )}
      <details className="border-line mt-4 border-t pt-3">
        <summary className="text-beam-ink cursor-pointer text-sm font-semibold">
          Evidence and uncertainty
        </summary>
        <p className="text-muted mt-2 text-xs">{c.summary}</p>
        <p className="mt-2 text-sm">
          <strong>Routing rationale:</strong> {nextReason}
        </p>
        {clues.map((clue, i) => (
          <p key={i} className="text-muted mt-2 text-xs">
            {clue.description} · Source: {clue.evidence_id ?? 'unavailable'} · Observed:{' '}
            {formatTime(clue.observed_at)} · Fetched: {formatTime(clue.fetched_at)}
          </p>
        ))}
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

        <ReasonList reasons={c.reasons} now={now} />
        {c.uncertainties.length > 0 && (
          <ul className="text-muted mt-3 list-disc space-y-1 pl-5 text-xs">
            {c.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        )}
      </details>
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
          {e.measurements?.map((m, j) => (
            <p key={j} className="mt-1 text-xs">
              {m.label || 'Value'}: {m.value ?? 'unknown'}
              {m.unit ? ` ${m.unit}` : ''}
            </p>
          ))}
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
