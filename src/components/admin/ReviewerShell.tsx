'use client';

import { Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { InfoTip } from '@/components/ui';
import { TWO_STEP_NOTE } from '@/components/ui/WorldConfirm';

const LINKS = [
  { href: '/admin', label: 'Queue', match: (p: string) => p === '/admin' || p.startsWith('/admin/reviews') },
  { href: '/admin/decided', label: 'Decided', match: (p: string) => p.startsWith('/admin/decided') },
  {
    href: '/admin/publish',
    label: 'Publish',
    match: (p: string) => p.startsWith('/admin/publish') || p.startsWith('/approve'),
  },
];

/** Reviewer area frame: its own header and sub-nav (Queue · Decided · Publish), separate from the consumer nav. */
export function ReviewerShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '';
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <div className="border-line flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/admin" className="font-display text-lg leading-none">
            Review desk
          </Link>
          <nav aria-label="Review desk">
            <ul className="flex gap-1">
              {LINKS.map((l) => {
                const on = l.match(path);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={on ? 'page' : undefined}
                      className={`rounded-lg px-3 py-1.5 text-[15px] ${on ? 'bg-surface-raised text-text font-semibold' : 'text-muted hover:text-text'}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted inline-flex items-center gap-1.5 text-[13px]">
            <Fingerprint size={14} aria-hidden /> One World ID session per report
            <InfoTip label="How reviewer sessions work" align="end">
              {TWO_STEP_NOTE}
            </InfoTip>
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
