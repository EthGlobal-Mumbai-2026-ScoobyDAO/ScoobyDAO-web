'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ErrorState } from './States';

export const STILL_LOADING_MS = 8_000;
export const GIVE_UP_MS = 20_000;

/** The parts of a TanStack Query result LoadState reads. */
export interface QueryLike<T> {
  data: T | undefined;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

export type LoadPhase = 'loading' | 'slow' | 'timeout' | 'error' | 'ready';

/** Pure: which phase to show for a query after `elapsed` ms without data. */
export function loadPhase(
  q: Pick<QueryLike<unknown>, 'data' | 'isError'>,
  elapsed: number,
): LoadPhase {
  if (q.data !== undefined) return 'ready';
  if (q.isError) return 'error';
  if (elapsed >= GIVE_UP_MS) return 'timeout';
  if (elapsed >= STILL_LOADING_MS) return 'slow';
  return 'loading';
}

const message = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : undefined;

/**
 * Wraps one query: a skeleton for up to 8s, then "Still loading…", then (at 20s or on error) an ErrorState that
 * names the source and offers Retry. Data that arrives later still renders.
 */
export function LoadState<T>({
  query,
  source,
  skeleton,
  children,
  compact,
}: {
  query: QueryLike<T>;
  source: string;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
  /** Inline error line instead of the full Sniff state, for small cards. */
  compact?: boolean;
}) {
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  const waiting = query.data === undefined && !query.isError;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const phase = loadPhase(query, now - start);
  const retry = () => {
    const t = Date.now();
    setStart(t);
    setNow(t);
    void query.refetch();
  };

  if (phase === 'ready') return <>{children(query.data as T)}</>;
  if (phase === 'error' || phase === 'timeout') {
    const why =
      phase === 'timeout'
        ? `No answer after ${GIVE_UP_MS / 1000} seconds.`
        : (message(query.error) ?? 'The request failed.');
    return compact ? (
      <p role="alert" className="text-mask-ink flex flex-wrap items-center gap-2 text-sm">
        {source} isn’t responding. {why}
        <button type="button" onClick={retry} className="text-text underline underline-offset-4">
          Retry
        </button>
      </p>
    ) : (
      <ErrorState source={source} message={why} onRetry={retry} />
    );
  }
  return (
    <div aria-busy="true">
      {skeleton}
      {phase === 'slow' && (
        <p role="status" className="text-muted mt-3 text-sm">
          Still loading from {source}…
        </p>
      )}
    </div>
  );
}
