'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** "More filters" popover: a real button (aria-expanded) and a panel that closes on Escape or an outside click. */
export function MoreFilters({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
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
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
          active ? 'border-beam text-text' : 'border-line text-muted hover:text-text'
        }`}
      >
        <SlidersHorizontal size={16} aria-hidden />
        More filters
        {active > 0 && <span className="num bg-beam text-on-beam rounded-full px-1.5 text-xs">{active}</span>}
      </button>
      {open && (
        <div
          id={id}
          role="group"
          aria-label="More filters"
          className="bg-surface-raised border-line absolute top-full right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border p-4 shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
