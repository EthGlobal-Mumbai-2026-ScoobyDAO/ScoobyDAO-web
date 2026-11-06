'use client';

import { ExternalLink, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import type { Address } from 'viem';
import { useWalletClient } from 'wagmi';
import { TestTokenLabel } from '@/components/HonestyLabels';
import { TxLink } from '@/components/TxLink';
import { env } from '@/lib/env';

/**
 * DemoUSD is a Chainlink BurnMintERC20 with role-gated mint, so there's no public faucet.
 * NEXT_PUBLIC_FAUCET_URL points at a team-run faucet when one exists.
 */
export function GetTestFunds({ token, chainId = 11155111 }: { token?: Address; chainId?: number }) {
  const { data: wallet } = useWalletClient();
  const [added, setAdded] = useState<string | null>(null);
  return (
    <section aria-labelledby="funds-h" className="border-line rounded-xl border border-dashed p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="funds-h" className="font-semibold">
          Need test dUSD?
        </h3>
        <TestTokenLabel />
      </div>
      {env.faucetUrl ? (
        <a href={env.faucetUrl} target="_blank" rel="noreferrer" className="text-beam-ink mt-2 inline-flex items-center gap-1 font-semibold underline">
          Open the dUSD faucet <ExternalLink size={14} aria-hidden />
        </a>
      ) : (
        <p className="mt-2">Ask the team for test dUSD. There&apos;s no public faucet: minting is role-gated.</p>
      )}
      {token && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-muted">
            Token: <TxLink kind="token" value={token} chainId={chainId} />
          </span>
          {wallet && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await wallet.watchAsset({ type: 'ERC20', options: { address: token, symbol: 'dUSD', decimals: 6 } });
                  setAdded('Added to your wallet.');
                } catch {
                  setAdded('Your wallet declined to add the token.');
                }
              }}
              className="border-line inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold hover:border-[var(--fog-400)]"
            >
              <PlusCircle size={14} aria-hidden /> Add to wallet
            </button>
          )}
          {added && <span className="text-muted" role="status">{added}</span>}
        </div>
      )}
    </section>
  );
}
