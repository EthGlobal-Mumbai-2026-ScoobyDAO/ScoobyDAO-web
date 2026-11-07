'use client';

import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A small accessible popover for definitions and honesty facts. The trigger is a real button (Enter/Space toggle,
 * aria-expanded); Escape or a click outside closes it and returns focus to the trigger.
 */
export function InfoTip({
  label,
  children,
  trigger,
  align = 'start',
  className = '',
}: {
  /** Accessible name of the trigger, e.g. "About dUSD". */
  label: string;
  children: ReactNode;
  /** Visible trigger content; defaults to an info icon. */
  trigger?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <span ref={wrap} className={`relative inline-flex ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-label={trigger ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-text inline-flex items-center gap-1 rounded"
      >
        {trigger ?? <Info size={15} aria-hidden />}
      </button>
      {open && (
        <span
          id={id}
          role="note"
          aria-label={label}
          className={`bg-surface-raised border-line text-text absolute top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-3 text-left text-sm leading-snug font-normal whitespace-normal shadow-[0_12px_32px_rgb(0_0_0/0.35)] ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
