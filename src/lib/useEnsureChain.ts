'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { chainName } from './explorer';

/**
 * Wrong-chain helper for write buttons. The plan runner also switches before each step, but
 * pages use this to show the prompt up front ("Switch to Arbitrum Sepolia").
 */
export function useEnsureChain(chainId: number) {
  const { chainId: current, isConnected } = useAccount();
  const { switchChainAsync, isPending, error } = useSwitchChain();
  const wrong = isConnected && current !== chainId;
  return {
    wrong,
    current,
    name: chainName(chainId),
    switching: isPending,
    error: error?.message,
    ensure: async () => {
      if (!wrong) return true;
      try {
        await switchChainAsync({ chainId: chainId as 11155111 | 421614 });
        return true;
      } catch {
        return false;
      }
    },
  };
}
