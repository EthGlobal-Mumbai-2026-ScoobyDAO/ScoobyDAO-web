import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as abis from '@/contracts/generated';

// V1 only: fails if a generated ABI lacks any function or event the V1 adapter calls. It scans the
// adapter source for functionName / eventName / call(..., abi, 'fn') and checks each name against
// the ABIs that file imports. V2 ABIs come from the handoff bundle and are covered by v2abi.test.ts.
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

describe.each(['v1.ts'])('%s uses only functions present in the generated ABIs', (file) => {
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
  it('generated.ts carries no V2 ABIs (they come only from the bundle)', () =>
    expect(Object.keys(ABIS).filter((k) => /V2Abi$/.test(k))).toEqual([]));
  it('YieldSwapRouter.swapExactInput(PoolKey,bool,uint256,uint256,uint64)', () =>
    expect(fn('yieldSwapRouterAbi', 'swapExactInput').inputs.map((i) => i.type)).toEqual(['tuple', 'bool', 'uint256', 'uint256', 'uint64']));
  it('Settlement.decisions returns the Decision struct fields in order', () => {
    const d = ABIS.settlementAbi.find((i) => i.name === 'decisions') as unknown as { outputs: { name: string }[] };
    expect(d.outputs.map((o) => o.name)).toEqual(['proposed', 'finalOutcome', 'evidenceHash', 'proposedAt', 'finalizedAt', 'challenged']);
  });
});
