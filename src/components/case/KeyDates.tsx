'use client';

import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { Countdown } from '@/components/Countdown';
import { formatDate } from '@/lib/format';
import { claimsCloseAt, remoteCutoffOf, type MarketView } from '@/protocol';

export interface KeyDate {
  key: string;
  label: string;
  at: number;
  state: 'passed' | 'next' | 'upcoming';
}

/** The four dates that matter to a staker, from the market's own times. States use chain time (`now`). */
export function keyDates(m: MarketView, now: number): KeyDate[] {
  const remote = remoteCutoffOf(m);
  const closes = claimsCloseAt(m);
  const raw: Omit<KeyDate, 'state'>[] = [
    { key: 'cutoff', label: 'Cross-chain stakes close', at: remote ?? m.crossChainCutoff },
    { key: 'lock', label: 'Stakes lock', at: m.lockTime },
    { key: 'maturity', label: 'Trading ends', at: m.maturity },
    closes !== undefined ? { key: 'claims', label: 'Claims close', at: closes } : { key: 'deadline', label: 'Result due', at: m.resultDeadline },
  ];
  let nextSeen = false;
  return raw.map((d) => {
    if (now >= d.at) return { ...d, state: 'passed' };
    if (!nextSeen) {
      nextSeen = true;
      return { ...d, state: 'next' };
    }
    return { ...d, state: 'upcoming' };
  });
}

/** Where "now" sits on the track, 0..100, with items centred in equal columns. */
export function nowPosition(dates: KeyDate[], now: number): number {
  const n = dates.length;
  const i = dates.findIndex((d) => d.state !== 'passed');
  if (i === -1) return ((n - 0.25) / n) * 100;
  if (i === 0) return (0.25 / n) * 100;
  const prev = dates[i - 1].at;
  const next = dates[i].at;
  const frac = next > prev ? Math.min(1, Math.max(0, (now - prev) / (next - prev))) : 0.5;
  return ((i - 0.5 + frac) / n) * 100;
}

/** Compact horizontal timeline: four dates, a "now" marker, a countdown to the next one. */
export function KeyDates({ market: m, now }: { market: MarketView; now: number }) {
  const dates = keyDates(m, now);
  const pos = nowPosition(dates, now);
  return (
    <div className="relative">
      <div aria-hidden className="bg-line absolute top-[11px] right-[12.5%] left-[12.5%] hidden h-0.5 rounded sm:block">
        <div className="bg-beam h-full rounded" style={{ width: `${Math.min(100, Math.max(0, ((pos - 12.5) / 75) * 100))}%` }} />
      </div>
      <span
        aria-hidden
        className="bg-beam text-on-beam absolute -top-[22px] hidden -translate-x-1/2 rounded-full px-1.5 text-[10px] leading-4 font-bold tracking-wide uppercase sm:block"
        style={{ left: `${pos}%` }}
      >
        Now
      </span>
      <ol aria-label="Key dates" className="relative grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {dates.map((d) => (
          <li key={d.key} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
            <span className="bg-bg relative z-10 rounded-full">
              {d.state === 'passed' ? (
                <CheckCircle2 size={22} aria-hidden className="text-clue-ink" />
              ) : d.state === 'next' ? (
                <CircleDot size={22} aria-hidden className="text-beam-ink" />
              ) : (
                <Circle size={22} aria-hidden className="text-muted" />
              )}
            </span>
            <span className="min-w-0">
              <span className={`block text-[13px] ${d.state === 'upcoming' ? 'text-muted' : 'text-text font-medium'}`}>
                {d.label}
                <span className="sr-only"> ({d.state === 'passed' ? 'passed' : d.state === 'next' ? 'next' : 'upcoming'})</span>
              </span>
              <span className="text-muted block text-[13px]">{formatDate(d.at)}</span>
              {d.state === 'next' && (
                <span className="text-beam-ink block text-[13px] font-semibold">
                  in <Countdown to={d.at} now={now} endedLabel="now" />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
