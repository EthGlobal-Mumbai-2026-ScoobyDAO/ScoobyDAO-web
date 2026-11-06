'use client';

import { AlertTriangle } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export function NetworkBadge() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const wrong = isConnected && chainId !== sepolia.id;

  if (wrong) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: sepolia.id })}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] px-2.5 py-1 text-xs font-medium text-mask-ink"
      >
        <AlertTriangle size={14} aria-hidden />
        Wrong network — switch to Sepolia
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-beam" aria-hidden />
      Sepolia testnet
    </span>
  );
}
