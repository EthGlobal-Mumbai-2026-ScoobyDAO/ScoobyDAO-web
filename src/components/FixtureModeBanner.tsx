'use client';

import { FlaskConical } from 'lucide-react';
import { env } from '@/lib/env';
import { useActiveAccount } from '@/protocol/hooks';

/**
 * Shown on every page whenever fixture data is in use. Both switches are opt-in env values
 * (NEXT_PUBLIC_CHAIN_MODE=fixture, NEXT_PUBLIC_USE_FIXTURES=true); nothing turns them on implicitly.
 */
export function FixtureModeBanner() {
  const { isFixtureAccount } = useActiveAccount();
  const chain = env.chainMode === 'fixture';
  const backend = env.forceFixtures;
  if (!chain && !backend) return null;
  return (
    <div role="status" className="border-line border-b bg-[color-mix(in_srgb,var(--ghost-300)_10%,transparent)]">
      <p
        className="mx-auto flex max-w-[1200px] items-center gap-2 truncate px-4 py-2 text-sm sm:px-6"
        title={`${backend ? 'Demo backend data' : 'Live backend'}; ${chain ? 'simulated chain: no real transactions, demo clock' : 'live chain'}${isFixtureAccount ? '; acting as a demo wallet' : ''}`}
      >
        <FlaskConical size={16} className="text-ghost-ink shrink-0" aria-hidden />
        <span className="font-semibold">Fixture mode</span>
        <span className="text-muted truncate">
          {chain ? 'Simulated chain, no real transactions' : 'Live chain'} · {backend ? 'demo backend data' : 'live backend'}
          {isFixtureAccount && ' · demo wallet'}
        </span>
      </p>
    </div>
  );
}
