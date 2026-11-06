import { describe, expect, it } from 'vitest';
import { v2 } from '@/contracts/v2';
import { DEPLOYER, liveWorld, ME, setBalance, setPosition, v2For } from '@/test/v2world';
import { V2 } from './v2contracts';

const U = 1_000_000n;

describe('V2 reads (mocked transports, recorded live values)', () => {
  it('getMarket(1): the live report, its vault, pool and the Arbitrum cutoff', async () => {
    const w = liveWorld();
    const { protocol, eth } = v2For(w);
    const m = await protocol.getMarket(1n);
    expect(m).toMatchObject({
      reportId: 1n,
      series: true,
      demoReport: true,
      phase: 'open',
      totals: { yes: 100n * U, no: 15n * U },
      lockTime: v2.report.lockTime,
      crossChainCutoff: v2.report.crossChainCutoff,
      maturity: v2.report.maturity,
      resultDeadline: v2.report.resultDeadline,
      challengePeriod: 86_400,
      remoteCutoff: v2.report.crossChainCutoff,
      projectedPrincipal: 115n * U,
      principalAvailable: 0n,
      reviewer: DEPLOYER,
      treasury: DEPLOYER,
      chainTime: Number(w.now),
    });
    expect(m.decision).toBeUndefined();
    expect(m.market).toMatchObject({ configured: true, feePips: 3000, reserves: { usdc: 49_910_518n, yt: 109_999_768n }, shares: V2.lp.address, router: V2.swapRouter.address });
    expect(m.market!.poolKey).toEqual(v2.poolKey);
    expect(m.yt).toEqual({ address: V2.yt.address, totalSupply: 115n * U });
    // Everything on Sepolia comes from multicall (aggregate3), not one RPC per field.
    expect(eth.calls!.filter((c) => c.to === V2.vault.address.toLowerCase()).length).toBeGreaterThan(10);
  });

  it('phases follow chain time: cross-chain closed, locked, matured', async () => {
    const w = liveWorld();
    const { protocol } = v2For(w);
    w.now = w.report.crossChainCutoff;
    expect((await protocol.getMarket(1n)).phase).toBe('open_local_only');
    w.now = w.report.lockTime;
    expect((await protocol.getMarket(1n)).phase).toBe('locked');
    w.now = w.vault.maturity;
    expect((await protocol.getMarket(1n)).phase).toBe('matured');
  });

  it('a simulated loss shows in projected principal', async () => {
    const w = liveWorld();
    setBalance(w.dusd.balances, V2.vault.address, 100n * U); // 15 dUSD lost
    w.rep.totalSupply = 0n;
    expect((await v2For(w).protocol.getMarket(1n)).projectedPrincipal).toBe(100n * U);
  });

  it('a report published without a vault has no market (series false)', async () => {
    const w = liveWorld();
    w.extraReports['2'] = { ...w.report, reportHash: `0x${'ab'.repeat(32)}`, claimHash: `0x${'cd'.repeat(32)}` };
    const m = await v2For(w).protocol.getMarket(2n);
    expect(m).toMatchObject({ reportId: 2n, series: false, demoReport: false, totals: { yes: 0n, no: 0n } });
    expect(m.market).toBeUndefined();
    expect(m.yt).toBeUndefined();
  });

  it('an id the registry never published is an error, not an empty market', async () => {
    await expect(v2For(liveWorld()).protocol.getMarket(7n)).rejects.toThrow('Report #7 is not published in the V2 ReportRegistry.');
  });

  it('listPublished returns the vault series only', async () => {
    expect(await v2For(liveWorld()).protocol.listPublished()).toEqual([1n]);
  });

  it('getPosition: positions, REP receipt, YT pending and the LP estimate', async () => {
    const w = liveWorld();
    setPosition(w, ME, true, 5n * U);
    setPosition(w, ME, false, 3n * U);
    setBalance(w.rep.balances, ME, 2n * U);
    setBalance(w.dusd.balances, ME, 40n * U);
    setBalance(w.yt.balances, ME, 8n * U);
    setBalance(w.dusdArb.balances, ME, 7n * U);
    w.ethBalances[ME.toLowerCase()] = 10n ** 16n;
    // YT index: 0.25 dUSD per YT accrued since ME's last checkpoint, plus 0.1 already unclaimed.
    w.yt.globalIndex = 250_000_000_000_000_000n; // 0.25e18 per base unit of YT
    w.yt.unclaimed[ME.toLowerCase()] = 100_000n;
    const p = await v2For(w).protocol.getPosition(1n, ME);
    expect(p).toMatchObject({ yes: 5n * U, no: 3n * U, repReceipt: 2n * U, dusdBalance: 40n * U, yt: 8n * U, transferable: false, reputationBadge: false });
    expect(p.ytClaimable).toBe(100_000n + (8n * U * 250_000_000_000_000_000n) / 10n ** 18n);
    expect(p.remote).toEqual({ dusdBalance: 7n * U, allowance: 0n, ethBalance: 10n ** 16n });
    expect(p.redeemable).toBeUndefined();
  });

  it('LP estimate includes the hook YT yield not yet checkpointed', async () => {
    const w = liveWorld();
    setBalance(w.lp.balances, ME, 7_071_068n); // ~10% of supply
    w.hook.paidLPIndex[ME.toLowerCase()] = w.hook.lpYieldPerShare;
    w.yt.globalIndex = 10n ** 16n; // the hook's ~110 YT earned 0.01 dUSD per YT
    const p = await v2For(w).protocol.getPosition(1n, ME);
    const hookPending = (109_999_768n * 10n ** 16n) / 10n ** 18n;
    const perShare = w.hook.lpYieldPerShare + (hookPending * 10n ** 18n) / w.lp.totalSupply;
    expect(p.lpClaimable).toBe((7_071_068n * (perShare - w.hook.lpYieldPerShare)) / 10n ** 18n);
    expect(p.lpClaimable).toBeGreaterThan(0n);
  });

  it('after finalization, redeemable uses the claim formula scaled by principalAvailable', async () => {
    const w = liveWorld();
    setPosition(w, ME, true, 10n * U);
    w.vault.finalOutcome = 1; // Yes
    w.vault.finalizedAt = w.vault.maturity + 86_400n;
    w.vault.principalAvailable = 115n * U;
    const p = await v2For(w).protocol.getPosition(1n, ME);
    // 10 + 10 × (15 − 3) / 100 = 11.2 dUSD
    expect(p.redeemable).toBe(11_200_000n);
    w.vault.principalAvailable = 92n * U; // 80% after a simulated loss
    expect((await v2For(w).protocol.getPosition(1n, ME)).redeemable).toBe((11_200_000n * 92n) / 115n);
  });
});
