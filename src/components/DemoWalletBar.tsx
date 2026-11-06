'use client';

import { FlaskConical } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useDemoWallet } from '@/lib/account';
import { useFixturesMode } from '@/lib/queries';

/** Fixtures mode only: lets you act as an honest or a barred wallet. No real transactions. */
export function DemoWalletBar() {
  const fixtures = useFixturesMode().data;
  const { demo, setDemo } = useDemoWallet();
  const { isConnected } = useAccount();
  if (!fixtures) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--ghost-300)_50%,transparent)] px-4 py-3 text-sm">
      <span className="text-ghost-ink inline-flex items-center gap-2">
        <FlaskConical size={16} aria-hidden />
        Fixture mode: sample data, no real transactions.
      </span>
      <span className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Act as">
        <span className="text-muted whitespace-nowrap">Act as</span>
        {(
          [
            [null, isConnected ? 'My wallet' : 'No wallet'],
            ['honest', 'Honest wallet'],
            ['barred', 'Deployer-linked wallet'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={demo === v}
            onClick={() => setDemo(v)}
            className={`rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${demo === v ? 'border-ghost text-text bg-[color-mix(in_srgb,var(--ghost-300)_18%,transparent)]' : 'border-line text-muted hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}
