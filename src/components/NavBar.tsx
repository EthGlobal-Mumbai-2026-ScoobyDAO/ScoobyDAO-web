'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { NetworkBadge } from './NetworkBadge';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

const LINKS = [
  { href: '/cases', label: 'Cases' },
  { href: '/#how-it-works', label: 'How it works' },
];

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
            const active = l.href === '/cases' ? pathname.startsWith('/case') : false;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`hover:text-text ${active ? 'text-text decoration-beam underline decoration-2 underline-offset-8' : 'text-muted'}`}
                >
                  {l.label}
                </Link>
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
            <Link href={l.href} className="text-muted hover:text-text">
              {l.label}
            </Link>
          </li>
        ))}
        <li className="ml-auto">
          <NetworkBadge />
        </li>
      </ul>
    </header>
  );
}
