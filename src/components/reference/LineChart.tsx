'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { linePath, linearScale, type Box } from '@/lib/referenceData';

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS color (a theme variable). */
  color: string;
  /** SVG dash pattern: a secondary encoding so identity is not color alone. */
  dash?: string;
  points: { t: number; value: number }[];
}

const BOX: Box = { width: 640, height: 240, left: 8, right: 8, top: 10, bottom: 10 };
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Line chart over UTC days, drawn from the given points exactly (no smoothing; gaps over one day are not bridged).
 * Axis labels are HTML so they stay legible at phone width. Keyboard: focus the chart, then ←/→, Home/End move the
 * readout; pointer hover does the same. A data table with every plotted value sits underneath.
 */
export function LineChart({
  title,
  description,
  series,
  format,
  tableFormat = (v) => String(v),
  valueHeading,
  includeZero = false,
}: {
  title: string;
  description: string;
  series: ChartSeries[];
  format: (v: number) => string;
  tableFormat?: (v: number) => string;
  valueHeading: string;
  includeZero?: boolean;
}) {
  const id = useId();
  const ts = series.flatMap((s) => s.points.map((p) => p.t));
  const vs = series.flatMap((s) => s.points.map((p) => p.value));
  const dates = [...new Set(ts)].sort((a, b) => a - b);
  const [cursor, setCursor] = useState<number | null>(null);
  if (!dates.length) return <p className="text-muted text-sm">No data points.</p>;
  const scale = linearScale(ts, vs, BOX, includeZero);
  const at = cursor === null ? null : dates[cursor];

  const move = (e: KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    const last = dates.length - 1;
    setCursor((c) => {
      const cur = c ?? -1;
      if (e.key === 'ArrowRight') return Math.min(last, cur + 1);
      if (e.key === 'ArrowLeft') return Math.max(0, cur < 0 ? last : cur - 1);
      if (e.key === 'Home') return 0;
      if (e.key === 'End') return last;
      return null;
    });
  };
  const hover = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * BOX.width;
    let best = 0;
    dates.forEach((t, i) => {
      if (Math.abs(scale.x(t) - px) < Math.abs(scale.x(dates[best]) - px)) best = i;
    });
    setCursor(best);
  };
  const valuesAt = (t: number) => series.map((s) => ({ s, p: s.points.find((p) => p.t === t) }));

  return (
    <figure className="min-w-0" aria-labelledby={`${id}-t`}>
      <figcaption>
        <span id={`${id}-t`} className="block font-semibold">
          {title}
        </span>
        <span className="text-muted mt-1 block text-sm">{description}</span>
      </figcaption>
      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <svg width="28" height="10" aria-hidden>
                <line
                  x1="1"
                  y1="5"
                  x2="27"
                  y2="5"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dash}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2">
        <div
          className="text-muted num flex flex-col justify-between py-1 text-right text-xs whitespace-nowrap"
          aria-hidden
        >
          <span>{format(scale.maxV)}</span>
          {includeZero && scale.minV < 0 && scale.maxV > 0 ? <span>{format(0)}</span> : null}
          <span>{format(scale.minV)}</span>
        </div>
        <div
          tabIndex={0}
          role="group"
          aria-label={`${title}. ${dates.length} dates from ${day(dates[0])} to ${day(dates[dates.length - 1])} UTC. Use the arrow keys to read values.`}
          onKeyDown={move}
          onBlur={() => setCursor(null)}
          className="focus-visible:outline-beam min-w-0 rounded-md outline-offset-2 focus-visible:outline-2"
        >
          <svg
            viewBox={`0 0 ${BOX.width} ${BOX.height}`}
            className="bg-surface-raised block h-56 w-full touch-pan-y rounded-md sm:h-auto"
            aria-hidden
            onPointerMove={hover}
            onPointerLeave={() => setCursor(null)}
            preserveAspectRatio="none"
          >
            {[scale.minV, scale.maxV].map((v) => (
              <line
                key={v}
                x1={BOX.left}
                x2={BOX.width - BOX.right}
                y1={scale.y(v)}
                y2={scale.y(v)}
                stroke="var(--border)"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {includeZero && scale.minV < 0 && scale.maxV > 0 && (
              <line
                x1={BOX.left}
                x2={BOX.width - BOX.right}
                y1={scale.y(0)}
                y2={scale.y(0)}
                stroke="var(--text-muted)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {series.map((s) => (
              <path
                key={s.key}
                data-series={s.key}
                d={linePath(s.points, scale).d}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {at !== null && (
              <line
                x1={scale.x(at)}
                x2={scale.x(at)}
                y1={BOX.top}
                y2={BOX.height - BOX.bottom}
                stroke="var(--text)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>
        <span />
        <div
          className="text-muted num mt-1 flex justify-between gap-2 text-xs whitespace-nowrap"
          aria-hidden
        >
          <span>{day(dates[0])}</span>
          <span>{day(dates[dates.length - 1])} (UTC)</span>
        </div>
      </div>
      <p className="mt-2 min-h-[1.5rem] text-sm" aria-live="polite">
        {at !== null ? (
          <>
            <span className="num font-semibold">{day(at)}</span> UTC ·{' '}
            {valuesAt(at)
              .map(
                ({ s, p }) =>
                  `${series.length > 1 ? s.label + ': ' : ''}${p ? format(p.value) : 'no value'}`,
              )
              .join(' · ')}
          </>
        ) : (
          <span className="text-muted">
            Hover, or focus the chart and use the arrow keys, to read a date.
          </span>
        )}
      </p>
      <details className="mt-2 text-sm">
        <summary className="text-beam-ink cursor-pointer font-semibold">
          Data table ({dates.length} dates, every plotted value)
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="num w-full text-left text-xs">
            <thead className="bg-surface sticky top-0">
              <tr>
                <th scope="col" className="py-1 pr-3">
                  Date (UTC)
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1 pr-3">
                    {series.length > 1 ? s.label : valueHeading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((t) => (
                <tr key={t} className="border-line border-t">
                  <td className="py-1 pr-3">{day(t)}</td>
                  {valuesAt(t).map(({ s, p }) => (
                    <td key={s.key} className="py-1 pr-3">
                      {p ? tableFormat(p.value) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
