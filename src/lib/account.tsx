'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { contractsDeployed } from '@/contracts';
import { DEMO_WALLETS, type DemoWallet } from './fixtureChain';
import { useFixturesMode } from './queries';

const Ctx = createContext<{ demo: DemoWallet | null; setDemo: (d: DemoWallet | null) => void }>({
  demo: null,
  setDemo: () => {},
});

export function DemoWalletProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState<DemoWallet | null>(null);
  return <Ctx.Provider value={{ demo, setDemo }}>{children}</Ctx.Provider>;
}

export const useDemoWallet = () => useContext(Ctx);

/**
 * The account the stake/market pages act as. A real connected wallet always wins;
 * a demo wallet is only possible in fixtures mode (no real transactions there).
 */
export function useActiveAccount(): { address?: Address; isDemo: boolean; fixtures: boolean } {
  const { address } = useAccount();
  const { demo } = useDemoWallet();
  const fixtures = useFixturesMode().data ?? false;
  if (fixtures && demo) return { address: DEMO_WALLETS[demo] as Address, isDemo: true, fixtures };
  return { address, isDemo: false, fixtures };
}

/** Reads and writes go to the in-memory fixture chain in fixtures mode or before contracts are synced. */
export function useSimulatedChain(): boolean {
  const fixtures = useFixturesMode().data ?? true;
  return fixtures || !contractsDeployed;
}
