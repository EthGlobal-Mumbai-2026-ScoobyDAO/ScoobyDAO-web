import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as abis from '@/contracts/generated';

// Fails if a generated ABI lacks any function or event the adapters call. It scans the adapter
// sources for functionName / eventName / call(..., abi, 'fn') / V('fn') and checks each name
// against the ABIs that file imports.
type Item = { type: string; name?: string };
const ABIS = abis as unknown as Record<string, Item[]>;
const dir = path.resolve(import.meta.dirname);

function usage(file: string) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const imported = Object.keys(ABIS).filter((k) => new RegExp(`\\b${k}\\b`).test(src));
  const fns = new Set<string>();
  const events = new Set<string>();
  for (const m of src.matchAll(/functionName:\s*(?:dir === 'buy' \? )?'(\w+)'(?: : '(\w+)')?/g)) [m[1], m[2]].filter(Boolean).forEach((f) => fns.add(f!));
  for (const m of src.matchAll(/\bcall\([^,]+,\s*\w+ as Abi,\s*'(\w+)'/g)) fns.add(m[1]);
  for (const m of src.matchAll(/\bV\('(\w+)'/g)) fns.add(m[1]);
  for (const m of src.matchAll(/'(\w+)'\]\.map\(H\)/g)) fns.add(m[1]);
  for (const m of src.matchAll(/eventName:\s*'(\w+)'/g)) events.add(m[1]);
  for (const m of src.matchAll(/find\('(\w+)'\)/g)) events.add(m[1]);
  return { imported, fns, events };
}

const has = (names: string[], kind: string, name: string) => names.some((k) => ABIS[k].some((i) => i.type === kind && i.name === name));

describe.each(['v1.ts', 'v2.ts'])('%s uses only functions present in the generated ABIs', (file) => {
  const u = usage(file);
  it('finds calls to check', () => expect(u.fns.size).toBeGreaterThan(10));
  it.each([...u.fns])('function %s', (fn) => expect(has(u.imported, 'function', fn)).toBe(true));
  it.each([...u.events].length ? [...u.events] : ['__none__'])('event %s', (ev) => {
    if (ev !== '__none__') expect(has(u.imported, 'event', ev)).toBe(true);
  });
});

describe('key signatures match the contracts', () => {
  const fn = (abi: string, name: string) => ABIS[abi].find((i) => i.type === 'function' && i.name === name) as unknown as {
    inputs: { type: string; components?: { name: string; type: string }[] }[];
  };
  it('VoteMarket.stakeLocal(uint256,bool,uint256,address)', () =>
    expect(fn('voteMarketAbi', 'stakeLocal').inputs.map((i) => i.type)).toEqual(['uint256', 'bool', 'uint256', 'address']));
  it('Settlement.redeemVPT(uint256,bool,uint256)', () =>
    expect(fn('settlementAbi', 'redeemVPT').inputs.map((i) => i.type)).toEqual(['uint256', 'bool', 'uint256']));
  it('CCIPStakeSender.stakeRemote(StakeIntent, uint256, bytes) with the StakeIntent.sol fields', () => {
    const i = fn('ccipStakeSenderAbi', 'stakeRemote').inputs;
    expect(i.map((x) => x.type)).toEqual(['tuple', 'uint256', 'bytes']);
    expect(i[0].components!.map((c) => c.name)).toEqual(['protocolVersion', 'reportId', 'yes', 'recipient', 'nonce', 'deadline', 'minAmount']);
  });
  it('CCIPStakeSenderV2 uses StakeIntentV2 (sourceAccount, uint8 version)', () => {
    const c = fn('ccipStakeSenderV2Abi', 'stakeRemote').inputs[0].components!;
    expect(c.map((x) => x.name)).toEqual(['protocolVersion', 'reportId', 'yes', 'sourceAccount', 'recipient', 'nonce', 'deadline', 'minAmount']);
    expect(c[0].type).toBe('uint8');
  });
  it('YieldSwapRouter.swapExactInput(PoolKey,bool,uint256,uint256,uint64)', () =>
    expect(fn('yieldSwapRouterAbi', 'swapExactInput').inputs.map((i) => i.type)).toEqual(['tuple', 'bool', 'uint256', 'uint256', 'uint64']));
  it('Settlement.decisions returns the Decision struct fields in order', () => {
    const d = ABIS.settlementAbi.find((i) => i.name === 'decisions') as unknown as { outputs: { name: string }[] };
    expect(d.outputs.map((o) => o.name)).toEqual(['proposed', 'finalOutcome', 'evidenceHash', 'proposedAt', 'finalizedAt', 'challenged']);
  });
});
