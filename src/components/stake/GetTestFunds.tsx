'use client';

import { ExternalLink, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import type { Address } from 'viem';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { TestTokenLabel } from '@/components/HonestyLabels';
import { TxLink } from '@/components/TxLink';
import { env } from '@/lib/env';
import { chainName } from '@/lib/explorer';

const CHAINS = [11155111, 421614] as const;

/**
 * DemoUSD is a Chainlink BurnMintERC20 with role-gated mint, so there's no public mint button.
 * The operator funds participant wallets on both chains; NEXT_PUBLIC_FAUCET_URL links a team-run faucet.
 */
export function GetTestFunds({ token, chains = CHAINS }: { token?: Address; chains?: readonly number[] }) {
  const { data: wallet } = useWalletClient();
  const { chainId: current } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [added, setAdded] = useState<string | null>(null);

  const watch = async (chainId: number) => {
    if (!wallet || !token) return;
    try {
      // wallet_watchAsset adds the token on the wallet's current network.
      if (current !== chainId) await switchChainAsync({ chainId: chainId as 11155111 | 421614 });
      await wallet.watchAsset({ type: 'ERC20', options: { address: token, symbol: 'dUSD', decimals: 6 } });
      setAdded(`dUSD added on ${chainName(chainId)}.`);
    } catch {
      setAdded(`Your wallet didn't add dUSD on ${chainName(chainId)}.`);
    }
  };

  return (
    <section aria-labelledby="funds-h" className="border-line rounded-xl border border-dashed p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="funds-h" className="font-semibold">
          Get demo dUSD
        </h3>
        <TestTokenLabel />
      </div>
      <p className="mt-2">Ask the team: an operator funds wallets on Ethereum Sepolia and Arbitrum Sepolia. Minting is role-gated, so there is no public mint.</p>
      {env.faucetUrl && (
        <a href={env.faucetUrl} target="_blank" rel="noreferrer" className="text-beam-ink mt-2 inline-flex items-center gap-1 font-semibold underline">
          Open the team&apos;s dUSD faucet <ExternalLink size={14} aria-hidden />
        </a>
      )}
      {token && (
        <div className="mt-3 space-y-2">
          <p className="text-muted">
            Token (same address on both chains): <TxLink kind="token" value={token} chainId={11155111} />
          </p>
          {wallet && (
            <div className="flex flex-wrap gap-2">
              {chains.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void watch(c)}
                  className="border-line inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold hover:border-[var(--fog-400)]"
                >
                  <PlusCircle size={14} aria-hidden /> Add dUSD on {chainName(c)}
                </button>
              ))}
            </div>
          )}
          {added && (
            <p className="text-muted" role="status">
              {added}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
