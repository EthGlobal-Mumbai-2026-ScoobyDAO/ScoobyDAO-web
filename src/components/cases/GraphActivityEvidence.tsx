import { parseGraphActivity } from '@/lib/graphActivity';

/** Historical-only until a backend supplies an authoritative freshness contract and verified sidecar. */
export function GraphActivityEvidence({
  value,
  candidateId,
}: {
  value: unknown;
  candidateId: string;
}) {
  const a = parseGraphActivity(value, candidateId);
  if (!a)
    return (
      <p role="status" className="text-muted text-sm">
        Indexed 30-day activity is unavailable or could not be verified.
      </p>
    );
  return (
    <section
      className="border-line bg-surface mt-4 rounded-xl border p-4 [overflow-wrap:anywhere]"
      aria-label="Historical indexed activity"
    >
      <p className="text-mask-ink text-xs font-semibold uppercase">
        Historical capture · current status unknown
      </p>
      <h3 className="mt-1 font-semibold">Ethereum Uniswap V3 indexed token activity</h3>
      <p className="mt-2 text-sm">
        Captured result:{' '}
        {a.status === 'pass'
          ? 'threshold met within this indexed scope'
          : a.status === 'below_indexed_scope_threshold'
            ? 'below threshold within this indexed scope'
            : 'unknown'}{' '}
        · {a.observedHours}/720 closed hourly observations.
      </p>
      <p className="text-muted mt-1 text-xs">Capture reason: {a.reason.replaceAll('_', ' ')}</p>
      <p className="text-muted mt-2 text-xs">
        UTC window {a.windowStart} to {a.windowEnd}; evaluated {a.evaluatedAt}. This point-in-time
        capture does not establish current activity, other protocols, other chains or all-venue
        volume.
      </p>
      {a.volumeInr !== null && (
        <p className="mt-2 text-sm">
          Captured volume: ₹{a.volumeInr} (USD {a.volumeUsd}); threshold ₹10,000,000.
        </p>
      )}
      {a.fx && (
        <p className="text-muted mt-2 text-xs">
          One {a.fx.provider} reference rate for the full window: {a.fx.rate} INR/USD, dated{' '}
          {a.fx.date}, captured {a.fx.capturedAt}. FX evidence SHA-256: {a.fx.evidenceId}.
        </p>
      )}
      {a.source && (
        <p className="text-muted mt-2 text-xs">
          Graph response captured {a.source.fetchedAt}; indexed block {a.source.block}, time{' '}
          {new Date(a.source.blockTimestamp * 1000).toISOString()}. Deployment:{' '}
          {a.source.deployment}. Response SHA-256: {a.source.responseHash}.
        </p>
      )}
      <p className="text-muted mt-2 text-xs">
        Activity is a separate screen and does not constitute a concern-gate vote or World ID
        approval.
      </p>
      {a.limitations.length > 0 && (
        <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-xs">
          {a.limitations.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
