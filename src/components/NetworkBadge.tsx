'use client';

import { AlertTriangle } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia, sepolia } from 'wagmi/chains';

/** Ethereum Sepolia hosts the market; Arbitrum Sepolia is the CCIP source. Anything else is wrong. */
export function NetworkBadge() {
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
