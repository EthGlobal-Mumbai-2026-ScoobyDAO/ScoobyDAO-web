'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

/**
 * Accessible tabs (WAI-ARIA tablist): arrow keys, Home and End move between tabs. Controlled; render the panel
 * yourself with `tabPanelProps(id, key)` so the tab and panel stay linked.
 */
export function Tabs<K extends string>({
  id,
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  /** Unique on the page; links each tab to its panel. */
  id: string;
  items: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  className?: string;
}) {
  const base = id;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const last = items.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowLeft'
          ? i === 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].key);
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`border-line flex gap-1 overflow-x-auto border-b ${className}`}
    >
      {items.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`${base}-panel-${t.key}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => move(e, i)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[15px] whitespace-nowrap ${
              on
                ? 'border-beam text-text font-semibold'
                : 'text-muted hover:text-text border-transparent'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="num text-muted ml-1.5 text-xs">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Props for the panel of tab `key` in the Tabs with this `id`. */
export function tabPanelProps(id: string, key: string) {
  return {
    role: 'tabpanel' as const,
    id: `${id}-panel-${key}`,
    'aria-labelledby': `${id}-tab-${key}`,
    tabIndex: 0,
  };
}

/** A compact radio group styled as a segmented control. */
export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: { key: K; label: ReactNode; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`border-line inline-flex flex-wrap gap-1 rounded-xl border p-1 ${className}`}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(it.key)}
            className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
              on ? 'bg-beam text-on-beam font-semibold' : 'text-muted hover:text-text'
            }`}
          >
            {it.label}
            {it.count !== undefined && (
              <span className="num ml-1.5 text-xs opacity-80">{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
