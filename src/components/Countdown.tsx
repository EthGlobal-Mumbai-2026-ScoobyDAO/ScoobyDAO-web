'use client';

import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/format';

/**
 * Ticks toward `to` (unix seconds). Pass `now` (chain time from useChainTime) for onchain
 * deadlines; without it, the local clock is used (only for backend times such as code expiry).
 */
export function Countdown({
  to,
  now,
  endedLabel = 'Ended',
  className = '',
}: {
  to: number;
  now?: number;
  endedLabel?: string;
  className?: string;
}) {
  const [local, setLocal] = useState<number | null>(null);
  useEffect(() => {
    if (now !== undefined) return;
    const tick = () => setLocal(Math.floor(Date.now() / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [now]);
  const current = now ?? local;
  if (current === null) return <span className={`num ${className}`}>--:--</span>;
  const left = to - current;
  return (
    <time dateTime={new Date(to * 1000).toISOString()} className={`num ${className}`}>
      {left > 0 ? formatDuration(left) : endedLabel}
    </time>
  );
}
