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

export type MarketBlock = 'not_deployed' | 'no_router' | 'not_configured' | 'matured' | 'not_locked' | 'no_series' | null;

/**
 * Why swaps are disabled, or null when open. The hooks require now < maturity. V1 issues YT only at
 * lock ('not_locked'); V2 mints YT on every stake, so its market is open before lock too.
 */
export function marketBlock(
  m: { market?: { router?: string; configured: boolean; maturity: number }; maturity: number; lockTime: number; series?: boolean },
  now: number,
): MarketBlock {
  if (m.series === false) return 'no_series';
  if (!m.market) return now < m.lockTime ? 'not_locked' : 'not_deployed';
  if (!m.market.router) return 'no_router';
  if (!m.market.configured) return 'not_configured';
  if (now >= (m.market.maturity || m.maturity)) return 'matured';
  return null;
}

// ------------------------------------------------------------------ V2 hook-owned LP

export interface LpPool {
  supply: bigint;
  usdcReserve: bigint;
  ytReserve: bigint;
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** YieldCurveHookV2._sqrt (Babylonian, floors). */
export function isqrt(x: bigint): bigint {
  if (x === 0n) return 0n;
  let z = (x + 1n) / 2n;
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / 2n;
  }
  return y;
}

/**
 * Shares YieldCurveHookV2.addLiquidity would mint, or undefined when it would revert. After the
 * first LP the deposit must match the reserves exactly: usdc·supply/usdcReserve == yt·supply/ytReserve.
 */
export function lpSharesFor(usdc: bigint, yt: bigint, pool: LpPool): bigint | undefined {
  if (usdc <= 0n || yt <= 0n) return undefined;
  if (pool.supply === 0n) {
    const s = isqrt(usdc * yt);
    return s > 0n ? s : undefined;
  }
  if (pool.usdcReserve === 0n || pool.ytReserve === 0n) return undefined;
  const byUsdc = (usdc * pool.supply) / pool.usdcReserve;
  const byYt = (yt * pool.supply) / pool.ytReserve;
  return byUsdc === byYt && byUsdc > 0n ? byUsdc : undefined;
}

/**
 * Exact (dUSD, YT) amounts from one input: the share count nearest the input that both sides can
 * hit exactly, using the smallest amount of each token. Undefined when nothing matches (or before
 * the first LP, when any ratio is accepted).
 */
export function pairLiquidity(anchor: 'usdc' | 'yt', amount: bigint, pool: LpPool): { usdc: bigint; yt: bigint; shares: bigint } | undefined {
  if (amount <= 0n || pool.supply === 0n || pool.usdcReserve === 0n || pool.ytReserve === 0n) return undefined;
  const target = (amount * pool.supply) / (anchor === 'usdc' ? pool.usdcReserve : pool.ytReserve);
  for (const d of [0n, -1n, 1n, -2n, 2n, -3n, 3n]) {
    const s = target + d;
    if (s <= 0n) continue;
    const usdc = ceilDiv(s * pool.usdcReserve, pool.supply);
    const yt = ceilDiv(s * pool.ytReserve, pool.supply);
    if (lpSharesFor(usdc, yt, pool) === s) return { usdc, yt, shares: s };
  }
  return undefined;
}

/** removeLiquidity outputs: reserve·shares/supply for each token (floors like the hook). */
export function lpRemoveOut(shares: bigint, pool: LpPool): { usdc: bigint; yt: bigint } {
  if (pool.supply === 0n || shares <= 0n) return { usdc: 0n, yt: 0n };
  return { usdc: (pool.usdcReserve * shares) / pool.supply, yt: (pool.ytReserve * shares) / pool.supply };
}

/** YT pending for an account: unclaimedUSDC + balance·(globalIndex − paidIndex)/1e18 (integer math). */
export function pendingYtYield(p: { unclaimed: bigint; balance: bigint; globalIndex: bigint; paidIndex: bigint }): bigint {
  const delta = p.globalIndex > p.paidIndex ? p.globalIndex - p.paidIndex : 0n;
  return p.unclaimed + (p.balance * delta) / WAD;
}

/**
 * What hook.claimLPYield() would pay now: the stored unclaimed amount plus the account's share of
 * yield the hook's YT has earned but not yet checkpointed. An estimate until the next checkpoint.
 */
export function pendingLpYield(p: {
  unclaimed: bigint;
  shares: bigint;
  supply: bigint;
  lpYieldPerShare: bigint;
  paidLPIndex: bigint;
  hookYtPending: bigint;
}): bigint {
  const perShare = p.lpYieldPerShare + (p.supply > 0n ? (p.hookYtPending * WAD) / p.supply : 0n);
  const delta = perShare > p.paidLPIndex ? perShare - p.paidLPIndex : 0n;
  return p.unclaimed + (p.shares * delta) / WAD;
}
