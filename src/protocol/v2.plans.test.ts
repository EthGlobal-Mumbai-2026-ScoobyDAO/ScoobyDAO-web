import { maxUint256 } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { runPlan, type RunDeps } from '@/lib/runPlan';
import { liveWorld, ME, setAllowance, setBalance, v2For } from '@/test/v2world';
import { minOutFor, SWAP_DEADLINE_SECONDS } from './market';
import { ProtocolRevert, type ContractCall, type TxPlan } from './types';
import { V2 } from './v2contracts';

const U = 1_000_000n;
const SEPOLIA = 11155111;
const ARB = 421614;
const req = (plan: TxPlan, i: number) => plan[i].request as ContractCall;
const shape = (plan: TxPlan) => plan.map((s) => `${s.chainId}:${(s.request ?? { functionName: 'prepare' }).functionName}`);

function funded(dusd = 50n * U) {
  const w = liveWorld();
  setBalance(w.dusd.balances, ME, dusd);
  return w;
}

describe('local stake plans (§B)', () => {
  it('allowance missing: approve exactly the amount to the vault, then stake(id, yes, amount, me, me)', async () => {
    const plan = await v2For(funded()).protocol.stakeLocal(1n, true, 5n * U, ME);
    expect(shape(plan)).toEqual([`${SEPOLIA}:approve`, `${SEPOLIA}:stake`]);
    expect(req(plan, 0)).toMatchObject({ address: V2.dusd.address, args: [V2.vault.address, 5n * U] });
    expect(req(plan, 1)).toMatchObject({ address: V2.vault.address, args: [1n, true, 5n * U, ME, ME] });
    expect(plan[0].label).toBe('Approve 5 dUSD for the vault');
  });

  it('unlimited only when the toggle is on', async () => {
    const plan = await v2For(funded()).protocol.stakeLocal(1n, false, 5n * U, ME, { unlimited: true });
    expect(req(plan, 0).args).toEqual([V2.vault.address, maxUint256]);
    expect(plan[0].label).toMatch(/^Approve unlimited dUSD/);
  });

  it('allowance present: a single stake step', async () => {
    const w = funded();
    setAllowance(w.dusd.allowances, ME, V2.vault.address, 5n * U);
    expect(shape(await v2For(w).protocol.stakeLocal(1n, false, 5n * U, ME))).toEqual([`${SEPOLIA}:stake`]);
  });

  it('balance too low: no plan, a clear reason', async () => {
    await expect(v2For(funded(2n * U)).protocol.stakeLocal(1n, true, 5n * U, ME)).rejects.toThrow(
      new ProtocolRevert('Insufficient dUSD on Ethereum Sepolia: you have 2, this needs 5.'),
    );
  });

  it('never stakes on a report the vault does not serve', async () => {
    await expect(v2For(funded()).protocol.stakeLocal(2n, true, U, ME)).rejects.toThrow('No market is deployed for report #2: the V2 vault serves report #1 only.');
  });

  it('wrong chain: the runner switches to Ethereum Sepolia before the first wallet prompt', async () => {
    const plan = await v2For(funded()).protocol.stakeLocal(1n, true, 5n * U, ME);
    const chain = { id: ARB };
    const order: string[] = [];
    const deps: RunDeps = {
      currentChainId: () => chain.id,
      switchChain: vi.fn(async (id: number) => {
        order.push(`switch:${id}`);
        chain.id = id;
      }),
      send: vi.fn(async (r: ContractCall, chainId: number) => {
        order.push(`send:${r.functionName}@${chainId}`);
        return `0x${'11'.repeat(32)}` as const;
      }),
      confirm: async () => ({ ok: true as const, logs: [] }),
      decode: () => ({}),
      fakeHash: () => '0x00',
      delay: async () => {},
      chainName: String,
    };
    expect((await runPlan(plan, deps)).ok).toBe(true);
    expect(order).toEqual([`switch:${SEPOLIA}`, `send:approve@${SEPOLIA}`, `send:stake@${SEPOLIA}`]);
  });
});

describe('REP receipt plans (§B): deposit → stakeFromREP → withdraw', () => {
  it('deposit approves dUSD to the vault and mints REP to me', async () => {
    const plan = await v2For(funded()).protocol.depositRep!(2n * U, ME);
    expect(shape(plan)).toEqual([`${SEPOLIA}:approve`, `${SEPOLIA}:deposit`]);
    expect(req(plan, 1).args).toEqual([2n * U, ME]);
  });

  it('stakeFromREP needs no REP approval and burns my REP into a position + YT', async () => {
    const w = funded();
    setBalance(w.rep.balances, ME, 2n * U);
    const plan = await v2For(w).protocol.stakeFromRep!(1n, true, 2n * U, ME);
    expect(shape(plan)).toEqual([`${SEPOLIA}:stakeFromREP`]);
    expect(req(plan, 0)).toMatchObject({ address: V2.vault.address, args: [1n, true, 2n * U, ME, ME] });
  });

  it('withdraw burns REP for dUSD (any time) and refuses more than my REP', async () => {
    const w = funded();
    setBalance(w.rep.balances, ME, 2n * U);
    const p = v2For(w).protocol;
    expect(req(await p.withdrawRep!(U, ME), 0)).toMatchObject({ functionName: 'withdraw', args: [U] });
    await expect(p.withdrawRep!(3n * U, ME)).rejects.toThrow('Insufficient REP on Ethereum Sepolia: you have 2, this needs 3.');
    w.now = w.vault.maturity + 10n; // long after lock and maturity
    expect(shape(await p.withdrawRep!(U, ME))).toEqual([`${SEPOLIA}:withdraw`]);
  });

  it('REP and YT transfers', async () => {
    const w = funded();
    setBalance(w.rep.balances, ME, 2n * U);
    setBalance(w.yt.balances, ME, 5n * U);
    const p = v2For(w).protocol;
    expect(req(await p.transferRep!(V2.vault.address, U, ME), 0)).toMatchObject({ address: V2.rep.address, functionName: 'transfer', args: [V2.vault.address, U] });
    expect(req(await p.transferYt!(V2.vault.address, U, ME), 0)).toMatchObject({ address: V2.yt.address, functionName: 'transfer' });
  });
});

describe('stake and sell (§C)', () => {
  it('minUsdcOut = quote × (10000 − slippageBps) / 10000', () => {
    expect(minOutFor(26_923n, 50)).toBe(26_788n);
    expect(minOutFor(26_923n, 0)).toBe(26_923n);
    expect(minOutFor(1_000_000n, 100)).toBe(990_000n);
  });

  it('approves dUSD to the stake-and-sell router, then stakeAndSellYield(yes, amount, minOut, deadline)', async () => {
    const w = funded();
    const p = v2For(w).protocol;
    const quote = await p.quoteStakeAndSell!(3n * U);
    expect(quote).toBe(26_922n); // 3 YT × 0.008974 dUSD on the recorded curve
    const minOut = minOutFor(quote, 50);
    const plan = await p.stakeAndSell!(1n, false, 3n * U, minOut, Number(w.now) + SWAP_DEADLINE_SECONDS, ME);
    expect(shape(plan)).toEqual([`${SEPOLIA}:approve`, `${SEPOLIA}:stakeAndSellYield`]);
    expect(req(plan, 0).args).toEqual([V2.stakeAndSell.address, 3n * U]);
    // prepare re-reads the quote and sets the deadline from the latest block
    w.now += 120n;
    const fresh = await plan[1].prepare!();
    expect(fresh.args).toEqual([false, 3n * U, minOut, w.now + BigInt(SWAP_DEADLINE_SECONDS)]);
  });

  it('a worse fresh quote stops the plan before the wallet prompt', async () => {
    const w = funded();
    const p = v2For(w).protocol;
    const plan = await p.stakeAndSell!(1n, true, 3n * U, 26_900n, Number(w.now) + 600, ME);
    w.hook.quoteSell = (x) => (x * 5_000n) / U; // the curve moved
    await expect(plan[1].prepare!()).rejects.toThrow(/now quotes 0.015 dUSD, below your minimum of 0.0269/);
  });
});

describe('settlement and operator plans (§F)', () => {
  const H = `0x${'ab'.repeat(32)}` as const;

  it('claimPrincipal(yes, amount) per held side; challenge needs a nonzero bytes32; finalize takes no args', async () => {
    const p = v2For(funded()).protocol;
    expect(req(await p.redeem(1n, false, 15n * U), 0)).toMatchObject({ address: V2.vault.address, functionName: 'claimPrincipal', args: [false, 15n * U] });
    expect(req(await p.challenge(1n, H), 0)).toMatchObject({ functionName: 'challenge', args: [H] });
    await expect(p.challenge(1n, `0x${'00'.repeat(32)}`)).rejects.toThrow(/nonzero bytes32/);
    expect(req(await p.finalize(1n), 0)).toMatchObject({ functionName: 'finalize', args: [] });
    await expect(p.redeem(2n, true, U)).rejects.toThrow(/No market is deployed for report #2/);
  });

  it('propose/adjudicate encode the Outcome enum (Yes=1, No=2, Void=3)', async () => {
    const p = v2For(funded()).protocol;
    expect(req(await p.propose!(1n, 'yes', H), 0).args).toEqual([1, H]);
    expect(req(await p.propose!(1n, 'no', H), 0).args).toEqual([2, H]);
    expect(req(await p.adjudicate!(1n, 'void', H), 0)).toMatchObject({ functionName: 'adjudicate', args: [3, H] });
  });

  it('injectYield approves dUSD to the vault first; claimFee pays the treasury (no args)', async () => {
    const p = v2For(funded()).protocol;
    const plan = await p.injectYield!(1n, 10n * U, ME);
    expect(plan.map((s) => s.request?.functionName)).toEqual(['approve', 'injectYield']);
    expect(req(plan, 0).args).toEqual([V2.vault.address, 10n * U]);
    expect(req(await p.claimFee!(1n), 0)).toMatchObject({ functionName: 'claimFee', args: [] });
  });
});
