'use client';

import { History } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * "Historical reference" chip. Its caveats open from a native <details> (keyboard and screen-reader behaviour from
 * the browser), so a reference card stays free of buttons. The caveat text mounts only while open.
 */
export function ReferenceChip({
  children,
  label = 'Historical reference',
  align = 'start',
}: {
  children: ReactNode;
  label?: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="relative inline-block"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      data-reference-chip
    >
      <summary className="border-line text-muted hover:text-text inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&::-webkit-details-marker]:hidden">
        <History size={12} aria-hidden />
        {label}
      </summary>
      {open && (
        <div
          role="note"
          className={`bg-surface-raised border-line text-text absolute top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-3 text-left text-sm leading-snug shadow-[0_12px_32px_rgb(0_0_0/0.35)] ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </details>
  );
}
