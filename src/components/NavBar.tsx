'use client';

import { MoreHorizontal, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { env } from '@/lib/env';
import { selectProtocol } from '@/protocol';
import { MobileNav } from './ui/MobileNav';
import { Logo } from './Logo';
import { SectionLink } from './SectionLink';
import { NetworkBadge } from './NetworkBadge';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

type NavItem = { href: string; label: string; section?: string; match?: (p: string) => boolean };

// Consumer navigation only. The review desk and operator console live in the overflow menu and the footer.
export const CONSUMER_LINKS: NavItem[] = [
  { href: '/cases', label: 'Cases', match: (p) => p.startsWith('/case') },
  ...(selectProtocol().kind === 'v2'
    ? [
        {
          href: '/markets',
          label: 'Markets',
          match: (p: string) =>
            p.startsWith('/markets') || p.startsWith('/onchain') || p.startsWith('/accelerated'),
        },
      ]
    : []),
  { href: '/reports', label: 'Reports', match: (p) => p.startsWith('/reports') },
  { href: '/#how-it-works', label: 'How it works', section: 'how-it-works' },
];

export const STAFF_LINKS: NavItem[] = [
  {
    href: '/admin',
    label: 'Review desk',
    match: (p) => p.startsWith('/admin') || p.startsWith('/approve'),
  },
  ...(env.operatorView
    ? [{ href: '/operator', label: 'Operator', match: (p: string) => p === '/operator' }]
    : []),
];

function NavLink({
  link,
  className,
  current,
}: {
  link: NavItem;
  className: string;
  current?: boolean;
}) {
  if (link.section)
    return (
      <SectionLink section={link.section} className={className}>
        {link.label}
      </SectionLink>
    );
  return (
    <Link href={link.href} aria-current={current ? 'page' : undefined} className={className}>
      {link.label}
    </Link>
  );
}

/** "More" menu: staff links that don't belong in the consumer nav. */
function OverflowMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close after navigation
  useEffect(() => setOpen(false), [pathname]);
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
        aria-label="More"
        aria-expanded={open}
        aria-controls="nav-more"
        onClick={() => setOpen((o) => !o)}
        className="border-line hover:border-beam text-muted hover:text-text inline-flex h-10 w-10 items-center justify-center rounded-xl border"
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open && (
        <ul
          id="nav-more"
          className="bg-surface-raised border-line absolute right-0 z-50 mt-2 w-52 rounded-xl border p-1.5 text-sm shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
        >
          {STAFF_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.match?.(pathname) ? 'page' : undefined}
                className="hover:bg-surface block rounded-lg px-3 py-2"
              >
                {l.label}
                <span className="text-muted block text-xs">
                  {l.href === '/admin' ? 'For enrolled reviewers' : 'Demo operator actions'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const positionsActive = pathname === '/me';
  return (
    <header className="border-line sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6"
      >
        <Logo />
        <ul className="hidden items-center gap-6 text-[15px] whitespace-nowrap min-[900px]:flex">
          {CONSUMER_LINKS.map((l) => {
            const active = l.match?.(pathname) ?? false;
            return (
              <li key={l.href}>
                <NavLink
                  link={l}
                  current={active}
                  className={`hover:text-text ${active ? 'text-text decoration-beam underline decoration-2 underline-offset-8' : 'text-muted'}`}
                />
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden lg:inline-flex">
            <NetworkBadge />
          </span>
          <Link
            href="/me"
            aria-current={positionsActive ? 'page' : undefined}
            className={`border-line hover:border-beam hidden h-10 items-center gap-2 rounded-xl border px-3 text-sm whitespace-nowrap min-[900px]:inline-flex ${positionsActive ? 'border-beam text-text' : 'text-muted hover:text-text'}`}
          >
            <Wallet size={16} aria-hidden />
            <span className="hidden xl:inline">My positions</span>
            <span className="sr-only xl:hidden">My positions</span>
          </Link>
          <span className="hidden min-[900px]:inline-flex">
            <ThemeToggle />
          </span>
          <span className="hidden min-[900px]:inline-flex">
            <OverflowMenu pathname={pathname} />
          </span>
          <WalletButton />
          <span className="min-[900px]:hidden">
            <MobileNav
              footer={
                <>
                  <NetworkBadge />
                  <ThemeToggle />
                </>
              }
            >
              <ul className="space-y-1 text-lg">
                {[
                  ...CONSUMER_LINKS,
                  { href: '/me', label: 'My positions', match: (p: string) => p === '/me' },
                ].map((l) => (
                  <li key={l.href}>
                    <NavLink
                      link={l}
                      current={l.match?.(pathname)}
                      className={`hover:bg-surface block rounded-xl px-3 py-3 ${l.match?.(pathname) ? 'text-text font-semibold' : 'text-muted'}`}
                    />
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-6 px-3 text-xs font-medium">For reviewers</p>
              <ul className="mt-1 space-y-1">
                {STAFF_LINKS.map((l) => (
                  <li key={l.href}>
                    <NavLink
                      link={l}
                      current={l.match?.(pathname)}
                      className="text-muted hover:bg-surface block rounded-xl px-3 py-2.5"
                    />
                  </li>
                ))}
              </ul>
            </MobileNav>
          </span>
        </div>
      </nav>
    </header>
  );
}
