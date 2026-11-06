'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { env } from '@/lib/env';
import { selectProtocol, V2_INFO } from '@/protocol';
import { Logo } from './Logo';
import { SectionLink } from './SectionLink';
import { NetworkBadge } from './NetworkBadge';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

type NavItem = { href: string; label: string; section?: string };

const LIVE_MARKET = `/onchain/${V2_INFO.reportId}`;
const LINKS: NavItem[] = [
  { href: '/cases', label: 'Cases' },
  ...(selectProtocol().kind === 'v2' ? [{ href: LIVE_MARKET, label: 'Live market' }] : []),
  { href: '/reports', label: 'Reports' },
  { href: '/me', label: 'My positions' },
  ...(env.operatorView ? [{ href: '/operator', label: 'Operator' }] : []),
  { href: '/#how-it-works', label: 'How it works', section: 'how-it-works' },
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

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-line sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6"
      >
        <Logo />
        <ul className="hidden items-center gap-5 text-sm sm:flex">
          {LINKS.map((l) => {
            const active =
              l.href === '/cases'
                ? pathname.startsWith('/case')
                : l.href === LIVE_MARKET
                  ? pathname.startsWith('/onchain')
                  : l.href === '/reports'
                    ? pathname.startsWith('/reports')
                    : l.href === '/me' || l.href === '/operator'
                      ? pathname === l.href
                      : false;
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
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden md:inline-flex">
            <NetworkBadge />
          </span>
          <ThemeToggle />
          <WalletButton />
        </div>
      </nav>
      <ul className="border-line flex gap-5 border-t px-4 py-2 text-sm sm:hidden">
        {LINKS.map((l) => (
          <li key={l.href}>
            <NavLink link={l} className="text-muted hover:text-text" />
          </li>
        ))}
        <li className="ml-auto">
          <NetworkBadge />
        </li>
      </ul>
    </header>
  );
}
