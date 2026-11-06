'use client';

import { useQuery } from '@tanstack/react-query';
import { maxUint160, maxUint256, type Address } from 'viem';
import { readContract, simulateContract } from 'wagmi/actions';
import { addresses, shareTokenAbi } from '@/contracts';
import {
  PERMIT2,
  V4_QUOTER,
  encodeExactInSingle,
  permit2Abi,
  poolIdOf,
  poolKeyFor,
  universalRouterAbi,
  v4QuoterAbi,
  type PoolKey,
} from '@/contracts/v4';
import { useSimulatedChain } from '@/lib/account';
import { revertReason } from '@/lib/errors';
import { fixtureChain } from '@/lib/fixtureChain';
import type { TxSpec } from '@/lib/tx';
import type { ClaimView } from '@/lib/types';
import { wagmiConfig } from '@/lib/wagmi';

export type ShareSide = 0 | 1; // 0 = For, 1 = Against

export interface SwapRoute {
  key: PoolKey;
  zeroForOne: boolean;
  tokenIn: Address;
  /** False when our PoolKey doesn't hash to the pool id the backend reports. */
  poolMatches: boolean;
}

export function routeFor(claim: ClaimView, side: ShareSide, buy: boolean): SwapRoute {
  const share = (side === 0 ? claim.shareTokens.for : claim.shareTokens.against) as Address;
  const key = poolKeyFor(share, addresses.USDC, addresses.FreezeHook);
  const tokenIn = buy ? addresses.USDC : share;
  const expected = side === 0 ? claim.pools.for : claim.pools.against;
  return {
    key,
    zeroForOne: tokenIn.toLowerCase() === key.currency0.toLowerCase(),
    tokenIn,
    poolMatches: !!expected && poolIdOf(key).toLowerCase() === expected.toLowerCase(),
  };
}

/** amountOut for an exact-in swap. Live: V4Quoter (reverts with the hook's reason when frozen). */
export function useQuote(claim: ClaimView, side: ShareSide, buy: boolean, amountIn: bigint | null) {
  const simulated = useSimulatedChain();
  return useQuery({
    queryKey: ['quote', simulated, claim.claimId, side, buy, amountIn?.toString()],
    enabled: !!amountIn && amountIn > 0n,
    retry: false,
    queryFn: async () => {
      if (simulated) {
        if (claim.status !== 'Open') throw new Error('RiskFi: claim frozen');
        return fixtureChain.quote(claim.claimId, side, buy, amountIn!);
      }
      const r = routeFor(claim, side, buy);
      try {
        const { result } = await simulateContract(wagmiConfig, {
          address: V4_QUOTER,
          abi: v4QuoterAbi,
          functionName: 'quoteExactInputSingle',
          args: [
            { poolKey: r.key, zeroForOne: r.zeroForOne, exactAmount: amountIn!, hookData: '0x' },
          ],
        });
        return result[0];
      } catch (e) {
        throw new Error(revertReason(e));
      }
    },
  });
}

/** Ensures ERC20 → Permit2 → Universal Router allowances, returning the tx specs still needed. */
export async function approvalSteps(
  account: Address,
  tokenIn: Address,
  amountIn: bigint,
  label: string,
): Promise<TxSpec[]> {
  const router = addresses.SwapRouter;
  const steps: TxSpec[] = [];
  const erc20Allowance = await readContract(wagmiConfig, {
    address: tokenIn,
    abi: shareTokenAbi,
    functionName: 'allowance',
    args: [account, PERMIT2],
  });
  if (erc20Allowance < amountIn) {
    steps.push({
      label: `Allow Permit2 to move ${label}`,
      live: () => ({
        address: tokenIn,
        abi: shareTokenAbi,
        functionName: 'approve',
        args: [PERMIT2, maxUint256],
      }),
      fixture: () => {},
    });
  }
  const [amount, expiration] = await readContract(wagmiConfig, {
    address: PERMIT2,
    abi: permit2Abi,
    functionName: 'allowance',
    args: [account, tokenIn, router],
  });
  const now = Math.floor(Date.now() / 1000);
  if (amount < amountIn || expiration < now + 60) {
    steps.push({
      label: `Allow the Uniswap router to spend ${label}`,
      live: () => ({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: 'approve',
        args: [tokenIn, router, maxUint160, now + 30 * 86400],
      }),
      fixture: () => {},
    });
  }
  return steps;
}

export function swapCall(route: SwapRoute, amountIn: bigint, minOut: bigint) {
  const { commands, inputs } = encodeExactInSingle({
    key: route.key,
    zeroForOne: route.zeroForOne,
    amountIn,
    minAmountOut: minOut,
  });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  return {
    address: addresses.SwapRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  } as const;
}
