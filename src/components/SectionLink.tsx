'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';

/**
 * Link to a section on the landing page (`/#id`). Next only scrolls when the hash changes,
 * so repeat clicks did nothing; on `/` this scrolls every time and moves focus to the
 * section. Elsewhere it navigates to `/#id` normally.
 */
export function SectionLink({
  section,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { section: string }) {
  const pathname = usePathname();

  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      pathname !== '/' ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.button !== 0
    )
      return;
    const el = document.getElementById(section);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (location.hash !== `#${section}`) history.pushState(null, '', `#${section}`);
    el.focus({ preventScroll: true });
  }

  return <Link href={`/#${section}`} onClick={handle} {...props} />;
}
