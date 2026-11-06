import { UserRejectedRequestError } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { ProtocolRevert, type TxPlan } from '@/protocol/types';
import { runPlan, type RunDeps, type StepProgress } from './runPlan';

const req = { address: '0x0000000000000000000000000000000000000001' as const, abi: [], functionName: 'f' };
const plan: TxPlan = [
  { label: 'Approve dUSD', chainId: 421614, request: req },
  { label: 'Send stake via CCIP', chainId: 421614, request: req },
];

function deps(over: Partial<RunDeps> = {}): RunDeps & { chain: { id: number } } {
  const chain = { id: 11155111 };
  return {
    chain,
    currentChainId: () => chain.id,
    switchChain: vi.fn(async (id: number) => {
      chain.id = id;
    }),
    send: vi.fn(async () => `0x${'11'.repeat(32)}` as const),
    confirm: async () => ({ ok: true as const, logs: [] }),
    decode: () => ({ messageId: `0x${'22'.repeat(32)}` }),
    fakeHash: () => '0x00',
    delay: async () => {},
    chainName: (id) => (id === 421614 ? 'Arbitrum Sepolia' : 'Ethereum Sepolia'),
    ...over,
  };
}

describe('runPlan (the TxPlan stepper)', () => {
  it('runs steps in order: "1/2 Approve dUSD → 2/2 Send stake"', async () => {
    const seen: StepProgress[] = [];
    const d = deps();
    const r = await runPlan(plan, d, (p) => seen.push(p));
    expect(r.ok).toBe(true);
    expect(r.effect.messageId).toBe(`0x${'22'.repeat(32)}`);
    expect(seen.filter((p) => p.status === 'done').map((p) => `${p.index + 1}/${p.total} ${p.label}`)).toEqual([
      '1/2 Approve dUSD',
      '2/2 Send stake via CCIP',
    ]);
  });

  it('wrong chain: prompts a switch once, then sends', async () => {
    const d = deps();
    const seen: string[] = [];
    await runPlan(plan, d, (p) => seen.push(p.status));
    expect(d.switchChain).toHaveBeenCalledTimes(1);
    expect(d.switchChain).toHaveBeenCalledWith(421614);
    expect(seen[0]).toBe('switching');
  });

  it('wrong chain and the user refuses the switch: fails before sending', async () => {
    const d = deps({ switchChain: async () => Promise.reject(new UserRejectedRequestError(new Error('no'))) });
    const r = await runPlan(plan, d);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Switch your wallet to Arbitrum Sepolia/);
    expect(d.send).not.toHaveBeenCalled();
  });

  it('user-rejected signature stops the plan with a clear reason', async () => {
    const d = deps({ send: async () => Promise.reject(new UserRejectedRequestError(new Error('denied'))) });
    d.chain.id = 421614;
    const r = await runPlan(plan, d);
    expect(r).toMatchObject({ ok: false, failedAt: 0, reason: 'You rejected the request in your wallet.' });
  });

  it('a mined revert surfaces the replayed reason (phase closed)', async () => {
    const d = deps({ confirm: async () => ({ ok: false as const, reason: 'CLOSED' }) });
    d.chain.id = 421614;
    const r = await runPlan(plan, d);
    expect(r).toMatchObject({ ok: false, failedAt: 0, reason: 'CLOSED' });
  });

  it('fixture steps run their effect and surface ProtocolRevert reasons', async () => {
    const r = await runPlan(
      [{ label: 'Stake', chainId: 11155111, fixture: () => { throw new ProtocolRevert('TokenCallFailed'); } }],
      deps(),
    );
    expect(r).toMatchObject({ ok: false, reason: 'TokenCallFailed' });
  });
});
