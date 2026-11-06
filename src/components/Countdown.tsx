'use client';

import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/format';

/** Ticks every second toward `to` (unix seconds). Renders a stable placeholder before mount. */
export function Countdown({
  to,
  endedLabel = 'Ended',
  className = '',
}: {
  to: number;
  endedLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={`num ${className}`}>--:--</span>;
  const left = to - now;
  return (
    <time dateTime={new Date(to * 1000).toISOString()} className={`num ${className}`}>
      {left > 0 ? formatDuration(left) : endedLabel}
    </time>
  );
}
