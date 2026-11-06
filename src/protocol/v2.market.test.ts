import { encodeAbiParameters, encodeEventTopics, type Address, type Log } from 'viem';
import { describe, expect, it } from 'vitest';
import { v2 } from '@/contracts/v2';
import { explainRevert, revertReason } from '@/lib/errors';
import { DEPLOYER, liveWorld, ME, setAllowance, setBalance, v2For } from '@/test/v2world';
import { isqrt, lpRemoveOut, lpSharesFor, marketBlock, pairLiquidity, pendingLpYield, pendingYtYield, zeroForOneFor } from './market';
import { tradingOpen } from './phase';
import type { ContractCall, TxPlan } from './types';
import { V2 } from './v2contracts';

const U = 1_000_000n;
const req = (plan: TxPlan, i: number) => plan[i].request as ContractCall;
const LIVE_POOL = { supply: 70_710_678n, usdcReserve: 49_910_518n, ytReserve: 109_999_768n };

describe('one YT/dUSD pool from the bundle', () => {
  it('zeroForOne comes from the sorted key: dUSD is currency0, so buying YT is zeroForOne', () => {
    expect(v2.poolKey.currency0).toBe(V2.dusd.address);
    expect(zeroForOneFor(v2.poolKey, 'buy', V2.dusd.address)).toBe(true);
    expect(zeroForOneFor(v2.poolKey, 'sell', V2.dusd.address)).toBe(false);
    // The same helper flips when YT sorts first (as the V1 fixture key does).
    const flipped = { ...v2.poolKey, currency0: v2.poolKey.currency1, currency1: v2.poolKey.currency0 };
    expect(zeroForOneFor(flipped, 'buy', V2.dusd.address)).toBe(false);
  });

  it('V2 trades before lock and stops at maturity; a registry-only report has no market', () => {
    const m = { lockTime: 1_000, maturity: 2_000, market: { router: '0x1', configured: true, maturity: 2_000 } };
    expect(marketBlock(m, 500)).toBeNull();
    expect(marketBlock(m, 1_500)).toBeNull();
    expect(marketBlock(m, 1_999)).toBeNull();
    expect(marketBlock(m, 2_000)).toBe('matured');
    expect(marketBlock({ ...m, series: false }, 500)).toBe('no_series');
    expect(tradingOpen({ maturity: 2_000 }, 1_999)).toBe(true);
    expect(tradingOpen({ maturity: 2_000 }, 2_000)).toBe(false);
  });
});

describe('buy and sell plans (§D)', () => {
  it('buy: approve dUSD to YieldSwapRouter, swapExactInput(poolKey, true, in, minOut, deadline); requote before sending', async () => {
    const w = liveWorld();
    setBalance(w.dusd.balances, ME, 5n * U);
    const p = v2For(w).protocol;
    const q = await p.quoteYT(1n, 'buy', 500_000n);
    expect(q.out).toBe(55_236_618n);
    const plan = await p.swapYT(1n, 'buy', 500_000n, q.out - 1_000n, Number(w.now) + 600, ME);
    expect(plan.map((s) => s.request?.functionName)).toEqual(['approve', 'swapExactInput']);
    expect(req(plan, 0)).toMatchObject({ address: V2.dusd.address, args: [V2.swapRouter.address, 500_000n] });
    expect(req(plan, 1)).toMatchObject({ address: V2.swapRouter.address, args: [v2.poolKey, true, 500_000n, q.out - 1_000n, w.now + 600n] });
    w.now += 30n;
    expect((await plan[1].prepare!()).args).toEqual([v2.poolKey, true, 500_000n, q.out - 1_000n, w.now + 600n]);
    w.hook.quoteBuy = (x) => (x * 100n * U) / U; // price moved against the buyer
    await expect(plan[1].prepare!()).rejects.toThrow(/The pool now quotes 50 YT, below your minimum/);
  });

  it('sell: approve YT (not dUSD) to the router, zeroForOne = false', async () => {
    const w = liveWorld();
    setBalance(w.yt.balances, ME, 5n * U);
    setAllowance(w.dusd.allowances, ME, V2.swapRouter.address, 10n * U); // a dUSD allowance doesn't help a YT sale
    const plan = await v2For(w).protocol.swapYT(1n, 'sell', 3n * U, 26_000n, Number(w.now) + 600, ME);
    expect(req(plan, 0)).toMatchObject({ address: V2.yt.address, functionName: 'approve', args: [V2.swapRouter.address, 3n * U] });
    expect(req(plan, 1).args?.[1]).toBe(false);
  });

  it('a buy that would empty the YT inventory reverts in the quote with a friendly reason (live: 1 dUSD)', async () => {
    const p = v2For(liveWorld()).protocol;
    const err = await p.quoteYT(1n, 'buy', U).catch((e: unknown) => e);
    expect(revertReason(err)).toBe('Not enough YT in the pool for this buy; try a smaller amount (YT_RESERVE)');
    expect(explainRevert('RATE_BOUND')).toMatch(/implied rate past the curve’s bounds/);
    expect(explainRevert('EXACT_INPUT_OR_MATURED')).toMatch(/matured/);
    expect(explainRevert('BUY_DUST')).toMatch(/buys no YT/);
    expect(explainRevert('SWAP_LIMIT')).toMatch(/^Slippage/);
  });
});

describe('hook-owned LP: the add ratio must match the reserves exactly', () => {
  it('pairLiquidity always returns amounts the hook accepts (byUSDC == byYT), for many inputs', () => {
    for (const anchor of ['usdc', 'yt'] as const)
      for (let i = 1n; i <= 400n; i++) {
        const amount = i * 12_345n + (anchor === 'usdc' ? 7n : 3n);
        const pair = pairLiquidity(anchor, amount, LIVE_POOL);
        expect(pair, `${anchor} ${amount}`).toBeDefined();
        expect(lpSharesFor(pair!.usdc, pair!.yt, LIVE_POOL)).toBe(pair!.shares);
      }
  });

  it('lpSharesFor rejects a ratio off by a unit (the hook would revert RATIO)', () => {
    const pair = pairLiquidity('usdc', 2n * U, LIVE_POOL)!;
    expect(lpSharesFor(pair.usdc, pair.yt + 2n, LIVE_POOL)).toBeUndefined();
    expect(lpSharesFor(pair.usdc + 2n, pair.yt, LIVE_POOL)).toBeUndefined();
  });

  it('first LP: any ratio, shares = floor(sqrt(usdc × yt)) like YieldCurveHookV2._sqrt', () => {
    expect(lpSharesFor(50n * U, 100n * U, { supply: 0n, usdcReserve: 0n, ytReserve: 0n })).toBe(70_710_678n); // the live seed deposit
    expect(isqrt(10n ** 18n)).toBe(10n ** 9n);
    expect(pairLiquidity('usdc', U, { supply: 0n, usdcReserve: 0n, ytReserve: 0n })).toBeUndefined();
  });

  it('removal outputs and yield estimates use the contracts’ integer math', () => {
    expect(lpRemoveOut(LIVE_POOL.supply, LIVE_POOL)).toEqual({ usdc: LIVE_POOL.usdcReserve, yt: LIVE_POOL.ytReserve });
    expect(lpRemoveOut(7_071_068n, LIVE_POOL)).toEqual({ usdc: (49_910_518n * 7_071_068n) / LIVE_POOL.supply, yt: (109_999_768n * 7_071_068n) / LIVE_POOL.supply });
    expect(pendingYtYield({ unclaimed: 5n, balance: 2n * U, globalIndex: 3n * 10n ** 16n, paidIndex: 10n ** 16n })).toBe(5n + 40_000n);
    expect(pendingLpYield({ unclaimed: 0n, shares: 10n, supply: 100n, lpYieldPerShare: 0n, paidLPIndex: 0n, hookYtPending: 1_000n })).toBe(100n);
  });

  it('add plan: approve dUSD and YT to the hook, addLiquidity(usdc, yt, minShares); moved reserves stop it before sending', async () => {
    const w = liveWorld();
    setBalance(w.dusd.balances, ME, 10n * U);
    setBalance(w.yt.balances, ME, 10n * U);
    const p = v2For(w).protocol;
    const pair = pairLiquidity('usdc', U, LIVE_POOL)!;
    const plan = await p.addLiquidity!(pair.usdc, pair.yt, pair.shares, ME);
    expect(plan.map((s) => s.request?.functionName)).toEqual(['approve', 'approve', 'addLiquidity']);
    expect(req(plan, 0)).toMatchObject({ address: V2.dusd.address, args: [V2.hook.address, pair.usdc] });
    expect(req(plan, 1)).toMatchObject({ address: V2.yt.address, args: [V2.hook.address, pair.yt] });
    expect(req(plan, 2)).toMatchObject({ address: V2.hook.address, args: [pair.usdc, pair.yt, pair.shares] });
    await expect(plan[2].prepare!()).resolves.toMatchObject({ functionName: 'addLiquidity' });
    w.hook.ytReserve += 3n * U; // someone sold YT into the pool
    await expect(plan[2].prepare!()).rejects.toThrow(/reserves moved/);
    await expect(p.addLiquidity!(pair.usdc, pair.yt + 5n, 0n, ME)).rejects.toThrow(/don't match the pool's reserves exactly/);
  });

  it('remove needs no approval; claims decode the dUSD actually received', async () => {
    const w = liveWorld();
    const p = v2For(w).protocol;
    const plan = await p.removeLiquidity!(1_000n, 0n, 0n, DEPLOYER);
    expect(plan.map((s) => s.request?.functionName)).toEqual(['removeLiquidity']);
    await expect(p.removeLiquidity!(1_000n, 0n, 0n, ME)).rejects.toThrow(/Insufficient RF-YLP/);

    const transfer = (from: Address, to: Address, value: bigint) =>
      ({
        address: V2.dusd.address,
        topics: encodeEventTopics({ abi: V2.dusd.abi, eventName: 'Transfer', args: { from, to } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [value]),
      }) as unknown as Log;
    const lp = await p.claimLPYield!(1n, ME);
    expect(lp[0].decode!([transfer(V2.hook.address, ME, 9_999_977n), transfer(V2.hook.address, DEPLOYER, 1n)])).toEqual({ paid: 9_999_977n });
    const yt = await p.claimYield(1n, ME);
    expect(yt[0].request).toMatchObject({ address: V2.yt.address, functionName: 'claimYield' });
    expect(yt[0].decode!([transfer(V2.yt.address, ME, 434_802n)])).toEqual({ paid: 434_802n });
  });
});
