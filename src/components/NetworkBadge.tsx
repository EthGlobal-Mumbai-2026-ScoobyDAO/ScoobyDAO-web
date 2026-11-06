'use client';

import { AlertTriangle } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia, sepolia } from 'wagmi/chains';
import { chainName } from '@/lib/explorer';

/**
 * Without `chainId`: the wallet's network (Ethereum Sepolia hosts the market; Arbitrum Sepolia is the
 * CCIP source; anything else is wrong). With `chainId`: a small tag naming the chain a card's
 * data was read from.
 */
export function NetworkBadge({ chainId, label }: { chainId?: number; label?: string } = {}) {
  if (chainId !== undefined) return <ReadSource chainId={chainId} label={label} />;
  return <WalletNetwork />;
}

function ReadSource({ chainId, label }: { chainId: number; label?: string }) {
  return (
    <span
      title={`Read from ${chainName(chainId)}`}
      className="border-line text-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${chainId === arbitrumSepolia.id ? 'bg-clue' : 'bg-beam'}`} aria-hidden />
      {label ?? chainName(chainId)}
    </span>
  );
}

function WalletNetwork() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const wrong = isConnected && chainId !== sepolia.id && chainId !== arbitrumSepolia.id;

  if (wrong) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: sepolia.id })}
        disabled={isPending}
        className="text-mask-ink inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] px-2.5 py-1 text-xs font-medium"
      >
        <AlertTriangle size={14} aria-hidden />
        Wrong network — switch to Sepolia
      </button>
    );
  }
  return (
    <span className="border-line text-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
      <span className="bg-beam h-1.5 w-1.5 rounded-full" aria-hidden />
      {chainId === arbitrumSepolia.id ? 'Arbitrum Sepolia (CCIP source)' : 'Sepolia testnet'}
    </span>
  );
}
