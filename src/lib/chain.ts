'use client';

import type { Address, Hex } from 'viem';
import { useReadContracts, useTransactionReceipt } from 'wagmi';
import { addresses, claimRegistryAbi, shareTokenAbi, usdcAbi, verdictMarketAbi } from '@/contracts';
import { frozenBlocks } from '@/fixtures';
import { useSimulatedChain } from './account';
import { fixtureChain, useFixtureChainVersion } from './fixtureChain';
import type { ClaimView } from './types';

export interface StakeChainState {
  ready: boolean;
  excluded: boolean;
  feeBps: bigint;
  usdcBalance: bigint;
  allowance: bigint;
  forShares: bigint;
  againstShares: bigint;
  /** Fixture chain only; live chain has no view for it (NOTES.md). */
  redeemed?: bigint;
  hasCommit?: boolean;
  totals: ClaimView['totals'];
  frozenBlock?: bigint;
  refetch: () => void;
}

const isAddr = (a?: string): a is Address => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

/** Everything the stake page needs from the chain for one claim + account. */
export function useStakeChain(
  claim: ClaimView | undefined,
  account: Address | undefined,
): StakeChainState {
  const simulated = useSimulatedChain();
  useFixtureChainVersion(); // re-render on fixture tx effects
  const claimId = claim ? BigInt(claim.claimId) : 0n;
  const liveEnabled = !simulated && !!claim && !!account;

  const reads = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: addresses.ClaimRegistry,
        abi: claimRegistryAbi,
        functionName: 'isExcluded',
        args: [claimId, account!],
      },
      { address: addresses.VerdictMarket, abi: verdictMarketAbi, functionName: 'feeBps' },
      {
        address: addresses.VerdictMarket,
        abi: verdictMarketAbi,
        functionName: 'totals',
        args: [claimId],
      },
      { address: addresses.USDC, abi: usdcAbi, functionName: 'balanceOf', args: [account!] },
      {
        address: addresses.USDC,
        abi: usdcAbi,
        functionName: 'allowance',
        args: [account!, addresses.VerdictMarket],
      },
      {
        address: (isAddr(claim?.shareTokens.for)
          ? claim.shareTokens.for
          : addresses.USDC) as Address,
        abi: shareTokenAbi,
        functionName: 'balanceOf',
        args: [account!],
      },
      {
        address: (isAddr(claim?.shareTokens.against)
          ? claim.shareTokens.against
          : addresses.USDC) as Address,
        abi: shareTokenAbi,
        functionName: 'balanceOf',
        args: [account!],
      },
    ],
    query: { enabled: liveEnabled, refetchInterval: 8000 },
  });

  const receipt = useTransactionReceipt({
    hash: claim?.triggerTxHash as Hex | undefined,
    query: { enabled: !simulated && !!claim?.triggerTxHash },
  });

  if (!claim) {
    return {
      ready: false,
      excluded: false,
      feeBps: 300n,
      usdcBalance: 0n,
      allowance: 0n,
      forShares: 0n,
      againstShares: 0n,
      totals: { committed: '0', forRevealed: '0', againstRevealed: '0' },
      refetch: () => {},
    };
  }

  if (simulated) {
    const pos = account ? fixtureChain.position(claim.claimId, account) : undefined;
    const fb = frozenBlocks[claim.claimId];
    return {
      ready: true,
      excluded: account ? fixtureChain.isExcluded(claim.claimId, account) : false,
      feeBps: fixtureChain.feeBps(),
      usdcBalance: account ? fixtureChain.usdcBalance(account) : 0n,
      allowance: account ? fixtureChain.allowance(account) : 0n,
      forShares: pos?.forShares ?? 0n,
      againstShares: pos?.againstShares ?? 0n,
      redeemed: pos?.redeemed,
      hasCommit: (pos?.committed ?? 0n) > 0n,
      totals: fixtureChain.totals(claim.claimId) ?? claim.totals,
      frozenBlock: fb ? BigInt(fb) : undefined,
      refetch: () => {},
    };
  }

  const d = reads.data;
  return {
    ready: !account || reads.isSuccess,
    excluded: d?.[0] ?? false,
    feeBps: BigInt(d?.[1] ?? 300),
    totals: d
      ? {
          committed: d[2][0].toString(),
          forRevealed: d[2][1].toString(),
          againstRevealed: d[2][2].toString(),
        }
      : claim.totals,
    usdcBalance: d?.[3] ?? 0n,
    allowance: d?.[4] ?? 0n,
    forShares: d?.[5] ?? 0n,
    againstShares: d?.[6] ?? 0n,
    frozenBlock: receipt.data?.blockNumber,
    refetch: () => void reads.refetch(),
  };
}
