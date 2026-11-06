'use client';

import { FlaskConical } from 'lucide-react';
import { useFixturesMode } from '@/lib/queries';
import { useActiveAccount, useProtocol } from '@/protocol/hooks';

/** Shown on every page while reads/writes go to the in-memory fixture chain or fixture backend. */
export function FixtureModeBanner() {
  const api = useFixturesMode();
  const { fixtureMode } = useProtocol();
  const { isFixtureAccount } = useActiveAccount();
  if (!api.data && !fixtureMode) return null;
  return (
    <div role="status" className="border-line border-b bg-[color-mix(in_srgb,var(--ghost-300)_10%,transparent)]">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm">
        <FlaskConical size={16} className="text-ghost-ink" aria-hidden />
        <span className="font-semibold">Fixture mode</span>
        <span className="text-muted">
          {api.data ? 'Demo backend data' : 'Live backend'} · {fixtureMode ? 'simulated chain (no real transactions, demo clock)' : 'live chain'}
          {isFixtureAccount && ' · acting as a demo wallet; connect a wallet to use your own address'}
          {' · research reports load separately and remain drafts'}
        </span>
      </p>
    </div>
  );
}
