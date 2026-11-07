import { getAddress, type Address } from 'viem';
import { describe, expect, it } from 'vitest';
import { ARB_SEPOLIA_ID, SEPOLIA_ID, v2 } from '@/contracts/v2';
import recorded from '@/test/recorded/v2-wiring.json';
import { deploymentQuery, deploymentQueryFor, runDeploymentCheck, WIRING, writeBlockReason, type DeploymentReads } from './deployment';

// The passing case replays reads recorded from the live chains (src/test/recorded/v2-wiring.json);
// the mismatched case changes a few of them. No network.

const fromRecorded = (v: unknown, expect: unknown): unknown =>
  typeof expect === 'bigint' ? BigInt(v as string) : typeof expect === 'boolean' ? v : v;

function mockReads(override: Record<string, unknown> = {}, missingCode: string[] = [], failing: string[] = []): DeploymentReads & { calls: number } {
  const byCall = new Map(WIRING.map((w) => [`${w.chainId}:${w.call.address.toLowerCase()}:${w.call.functionName}`, w]));
  const reads = {
    calls: 0,
    code: async (chainId: number, address: Address) => {
      const name = Object.entries(chainId === SEPOLIA_ID ? v2.sepolia : v2.arbitrumSepolia).find(([, a]) => a === address)?.[0];
      const key = `${chainId === SEPOLIA_ID ? 'sepolia' : 'arbitrumSepolia'}.${name}`;
      if (missingCode.includes(key)) return '0x' as const;
      return (recorded.code as Record<string, boolean>)[key] ? ('0x6080604052' as const) : ('0x' as const);
    },
    multicall: async (chainId: number, calls: { address: Address; functionName: string }[]) => {
      reads.calls++;
      return calls.map((c) => {
        const w = byCall.get(`${chainId}:${c.address.toLowerCase()}:${c.functionName}`);
        if (!w) return { ok: false as const, error: 'unexpected call' };
        if (failing.includes(w.id)) return { ok: false as const, error: 'execution reverted' };
        const raw = w.id in override ? override[w.id] : (recorded.reads as Record<string, unknown>)[w.id];
        return { ok: true as const, result: fromRecorded(raw, w.expect) };
      });
    },
  };
  return reads;
}

describe('deployment check against a mocked multicall', () => {
  it('passes on the recorded live reads: code everywhere and every wiring check green', async () => {
    const reads = mockReads();
    const report = await runDeploymentCheck(reads, 1);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.bundle).toBe(v2.version);
    // 18 bundle addresses + the wiring reads + 3 bundle-consistency checks
    expect(report.checks).toHaveLength(18 + WIRING.length + 3);
    expect(reads.calls).toBe(2); // one multicall per chain
    expect(writeBlockReason(report)).toBeUndefined();
  });

  it('covers every pairing the brief lists', () => {
    const ids = WIRING.map((w) => w.id);
    for (const id of [
      'vault.reportId', 'vault.yt', 'vault.rep', 'vault.registry', 'vault.usdc', 'hook.poolKeyHash', 'hook.shares',
      'stakeAndSell.vault', 'stakeAndSell.hook', 'stakeAndSell.swapRouter', 'stakeAndSell.yt',
      'receiver.vault', 'receiver.sourceSender', 'sender.destinationReceiver', 'sender.destinationSelector',
    ])
      expect(ids).toContain(id);
    expect(WIRING.find((w) => w.id === 'sender.destinationSelector')!.chainId).toBe(ARB_SEPOLIA_ID);
  });

  it('an address alone cannot tell the V1 Sepolia registry from the V2 Arbitrum sender', async () => {
    // Same 20 bytes on two chains: the receiver's sourceSender is checked against the Arbitrum
    // Sepolia CCIPStakeSenderV2 entry by name, so this (correct) value passes.
    const fb2c = getAddress('0xfb2c164ddb3676d03e1e443f3f2934b8d0df88e5');
    expect(v2.arbitrumSepolia.CCIPStakeSenderV2).toBe(fb2c);
    const report = await runDeploymentCheck(mockReads({ 'receiver.sourceSender': fb2c }), 1);
    expect(report.checks.find((c) => c.id === 'receiver.sourceSender')!.ok).toBe(true);
  });

  it('flags a mismatch, lists each failed check and blocks writes', async () => {
    // The receiver wired to the V2 registry instead of the sender, a different series id, a missing
    // contract on Arbitrum Sepolia and a reverted read.
    const report = await runDeploymentCheck(
      mockReads({ 'receiver.sourceSender': v2.sepolia.ReportRegistry, 'vault.reportId': '2' }, ['arbitrumSepolia.CCIPStakeSenderV2'], ['hook.shares']),
      1,
    );
    expect(report.ok).toBe(false);
    const failed = report.checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(['vault.reportId', 'hook.shares', 'receiver.sourceSender', `code.${ARB_SEPOLIA_ID}.CCIPStakeSenderV2`]));
    expect(failed).toHaveLength(4);
    const vault = report.checks.find((c) => c.id === 'vault.reportId')!;
    expect(vault).toMatchObject({ actual: '2', expected: '1' });
    expect(report.checks.find((c) => c.id === 'hook.shares')!.actual).toMatch(/read failed/);
    expect(writeBlockReason(report)).toMatch(/^Deployment mismatch: writes are disabled \(4 checks failed/);
  });

  it('pauses writes while checking and when the check itself errors', () => {
    expect(writeBlockReason(undefined)).toMatch(/Checking the V2 deployment/);
    expect(writeBlockReason(undefined, new Error('RPC down'))).toMatch(/Couldn't verify the V2 deployment.*RPC down/);
  });
});

describe('deploymentQueryFor', () => {
  it('falls back to the default check when there is no bundle (fixture or V1 protocol)', () => {
    expect(() => deploymentQueryFor(undefined)).not.toThrow();
    expect(deploymentQueryFor(undefined)).toBe(deploymentQuery);
  });

  it('uses the default check for the handoff bundle', () => {
    expect(deploymentQueryFor(v2)).toBe(deploymentQuery);
  });
});
