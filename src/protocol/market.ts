import type { Address } from 'viem';
import type { PoolKey } from './types';

// Pure YT market math. V1 mirrors YieldMarketHook.beforeSwap (constant product with a pip fee);
// V2 quotes come from YieldCurveHookV2.quoteBuy/quoteSell views directly.

export const FEE_DENOMINATOR = 1_000_000n;
export const WAD = 10n ** 18n;

/** YieldMarketHook.beforeSwap: netIn = in * (1e6 - fee) / 1e6; out = rOut * netIn / (rIn + netIn). */
export function constantProductOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feePips: number,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const netIn = (amountIn * (FEE_DENOMINATOR - BigInt(feePips))) / FEE_DENOMINATOR;
  const out = (reserveOut * netIn) / (reserveIn + netIn);
  // The hook reverts SWAP_LIMIT unless 0 < out < reserveOut.
  return out > 0n && out < reserveOut ? out : 0n;
}

/** dUSD per YT, 1e18-scaled, from reserves (both 6 decimals). */
export function spotPriceWad(usdcReserve: bigint, ytReserve: bigint): bigint | undefined {
  return ytReserve > 0n ? (usdcReserve * WAD) / ytReserve : undefined;
}

/** minOut = floor(out * (10000 - bps) / 10000). Default slippage 0.5% = 50 bps. */
export function minOutFor(quote: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(5000, Math.round(slippageBps))));
  return (quote * (10_000n - bps)) / 10_000n;
}

export const DEFAULT_SLIPPAGE_BPS = 50;
export const SWAP_DEADLINE_SECONDS = 10 * 60;

/**
 * PoolKey exactly as YieldHookFactory.deployAndInitialize and test/UniswapHook.t.sol build it:
 * currencies sorted by address, fee 0, tickSpacing 1, hooks = the hook.
 */
export function yieldPoolKey(usdc: Address, yt: Address, hook: Address): PoolKey {
  const [c0, c1] = BigInt(usdc) < BigInt(yt) ? [usdc, yt] : [yt, usdc];
  return { currency0: c0, currency1: c1, fee: 0, tickSpacing: 1, hooks: hook };
}

/** zeroForOne for the swap direction: buying YT spends dUSD. */
export function zeroForOneFor(key: PoolKey, dir: 'buy' | 'sell', usdc: Address): boolean {
  const inputIsUsdc = dir === 'buy';
  const c0IsUsdc = key.currency0.toLowerCase() === usdc.toLowerCase();
  return inputIsUsdc === c0IsUsdc;
}

/** Implied APR shown for V2 (rateWad is a 1e18 fraction per year). */
export const formatRateWad = (rateWad: bigint) => `${(Number((rateWad * 10_000n) / WAD) / 100).toFixed(2)}%`;

const YEAR = 365n * 24n * 3600n;

/**
 * V1 has no rate view: one YT pays the yield on 1 dUSD of locked principal until maturity, so the
 * price implies an annual rate of price / years-left. Display only, labelled "Simulated yield".
 */
export function impliedAprFromPrice(spotWad: bigint | undefined, secondsLeft: number): bigint | undefined {
  if (spotWad === undefined || secondsLeft <= 0) return undefined;
  return (spotWad * YEAR) / BigInt(secondsLeft);
}

export type MarketBlock = 'not_deployed' | 'no_router' | 'not_configured' | 'matured' | 'not_locked' | null;

/** Why swaps are disabled, or null when open. YieldMarketHook.beforeSwap requires now < maturity. */
export function marketBlock(
  m: { market?: { router?: string; configured: boolean; maturity: number }; maturity: number; lockTime: number },
  now: number,
): MarketBlock {
  if (!m.market) return now < m.lockTime ? 'not_locked' : 'not_deployed';
  if (!m.market.router) return 'no_router';
  if (!m.market.configured) return 'not_configured';
  if (now >= (m.market.maturity || m.maturity)) return 'matured';
  return null;
}
