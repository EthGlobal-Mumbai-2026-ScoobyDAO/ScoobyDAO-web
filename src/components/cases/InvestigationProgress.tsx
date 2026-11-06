'use client';
import { useQuery } from '@tanstack/react-query';
import { eventDescription, fetchInvestigationEvents } from '@/lib/investigationEvents';
import type { ScoutingCase } from '@/lib/scouting';

/** Shows backend-emitted status only; the timeline does not simulate model activity. */
export function InvestigationProgress({
  research,
  origin,
}: {
  research: NonNullable<ScoutingCase['research']>;
  origin: string;
}) {
  const run = research.run_id;
  const active = ['queued', 'running'].includes(research.status);
  const events = useQuery({
    queryKey: ['investigation-events', origin, run],
    queryFn: () => fetchInvestigationEvents(origin, run!),
    enabled: Boolean(run),
    retry: false,
    refetchInterval: active ? 3000 : 30000,
    refetchIntervalInBackground: false,
  });
  return (
    <section className="border-line mt-3 border-t pt-3" aria-label="Investigation progress">
      <h4 className="text-muted text-xs font-semibold uppercase">Investigation progress</h4>
      <p className="mt-1 text-sm">
        Status: <strong>{research.status.replaceAll('_', ' ')}</strong>
      </p>
      {research.budget && (
        <p className="text-muted mt-1 text-xs">
          Authorized budget: {research.budget.max_source_requests} source requests ·{' '}
          {research.budget.max_model_calls} model calls
        </p>
      )}
      {research.reason && <p className="text-muted mt-1 text-xs">{research.reason}</p>}
      {research.pillars.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs" aria-label="Pillar status">
          {research.pillars.map((pillar) => (
            <li key={pillar.pillar}>
              <strong>{pillar.pillar.replaceAll('_', ' ')}:</strong>{' '}
              {pillar.status.replaceAll('_', ' ')}
              {pillar.detail && <> · {pillar.detail}</>}
            </li>
          ))}
        </ul>
      )}
      {!run ? (
        <p className="text-muted mt-2 text-xs">Run details unavailable.</p>
      ) : events.isPending ? (
        <p className="text-muted mt-2 text-xs">Loading run activity…</p>
      ) : events.isError ? (
        <p className="text-muted mt-2 text-xs" role="status">
          Run activity unavailable.{' '}
          <button type="button" className="underline" onClick={() => void events.refetch()}>
            Retry
          </button>
        </p>
      ) : !events.data?.length ? (
        <p className="text-muted mt-2 text-xs">No run events reported yet.</p>
      ) : (
        <details className="mt-2" open={active || undefined}>
          <summary className="text-beam-ink cursor-pointer text-xs font-semibold">
            Run activity ({events.data.length})
          </summary>
          <ol className="mt-2 space-y-2 text-xs">
            {events.data.map((event) => (
              <li key={event.seq}>
                <strong>
                  {event.kind.startsWith('model_stage_')
                    ? 'Model activity'
                    : event.kind.startsWith('research_stage_')
                      ? 'Research activity'
                      : event.kind.replaceAll('_', ' ')}
                  :
                </strong>{' '}
                {eventDescription(event)}{' '}
                <span className="text-muted">
                  · {new Date(event.created * 1000).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
