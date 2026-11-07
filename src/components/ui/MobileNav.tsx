'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Hamburger + full-height sheet for narrow screens. Closes on route change, Escape or the close button. */
export function MobileNav({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sheet = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet after navigation
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
      if (e.key === 'Tab' && sheet.current) {
        const f = [...sheet.current.querySelectorAll<HTMLElement>('a, button, select, input')];
        if (!f.length) return;
        const first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggle}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(true)}
        className="border-line hover:border-beam inline-flex h-10 w-10 items-center justify-center rounded-xl border"
      >
        <Menu size={20} aria-hidden />
      </button>
      {open && (
        <div
          id="mobile-nav"
          ref={sheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="bg-bg fixed inset-0 z-50 flex flex-col overflow-y-auto px-4 pt-3 pb-8"
        >
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
              className="border-line hover:border-beam inline-flex h-10 w-10 items-center justify-center rounded-xl border"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          <nav aria-label="Mobile" className="mt-4 flex-1">
            {children}
          </nav>
          {footer && (
            <div className="border-line mt-6 flex flex-wrap items-center gap-3 border-t pt-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </>
  );
}
