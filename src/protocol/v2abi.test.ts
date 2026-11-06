import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KNOWN_ERRORS } from './effects';
import { STAKE_INTENT_V2_FIELDS } from './ccip';
import { V2, V2_USAGE, type V2Handle } from './v2contracts';

// ABI coverage for V2: every function and event the adapter, the CCIP tracker and the deployment
// check use (V2_USAGE, enforced by TypeScript on read()/write()/logsOf()) must exist in the bundle
// ABI of that contract. A bundle refresh that drops or renames one fails here.

type Param = { name: string; type: string; indexed?: boolean; components?: Param[] };
type Item = { type: string; name?: string; inputs?: Param[]; outputs?: Param[] };
const abi = (h: V2Handle) => V2[h].abi as unknown as Item[];
const fn = (h: V2Handle, name: string) => abi(h).find((i) => i.type === 'function' && i.name === name)!;
const ev = (h: V2Handle, name: string) => abi(h).find((i) => i.type === 'event' && i.name === name)!;
const types = (ps: Param[] | undefined): string[] => (ps ?? []).map((p) => (p.type === 'tuple' ? `(${types(p.components).join(',')})` : p.type));

describe.each(Object.keys(V2_USAGE) as V2Handle[])('%s', (h) => {
  const use = V2_USAGE[h];
  it.each([...use.functions])(`function %s exists in ${V2[h].name}.json`, (name) => expect(fn(h, name), name).toBeDefined());
  it.each(use.events.length ? [...use.events] : ['(none)'])(`event %s exists in ${V2[h].name}.json`, (name) => {
    if (name !== '(none)') expect(ev(h, name), name).toBeDefined();
  });
});

describe('the adapter reaches V2 contracts only through v2contracts', () => {
  const dir = path.resolve(import.meta.dirname);
  const src = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

  it.each(['v2.ts', 'deployment.ts'])('%s imports no raw ABI and names only declared calls', (file) => {
    const s = src(file);
    expect(s).not.toMatch(/\b\w+V2Abi\b|\bdemoUsdAbi\b|\breportRegistryAbi\b|\byieldLpShareAbi\b|\byieldSwapRouterAbi\b|\bstakeReceiptRepAbi\b/);
    const used = [...s.matchAll(/\b(?:read|write)\('(\w+)',\s*(?:dir === 'buy' \? )?'(\w+)'(?: : '(\w+)')?/g)];
    expect(used.length).toBeGreaterThan(file === 'v2.ts' ? 40 : 20);
    for (const [, h, a, b] of used)
      for (const name of [a, b].filter(Boolean)) expect((V2_USAGE[h as V2Handle].functions as readonly string[]).includes(name!), `${h}.${name}`).toBe(true);
  });

  it('v2.ts has no unconditional unlimited approval, no fixed gas and no fixture path', () => {
    const s = src('v2.ts');
    expect(s).not.toMatch(/maxUint256|500_000|fixture|gas:/);
  });
});

describe('signatures the integration depends on', () => {
  it('stakeRemote/quoteFee take (StakeIntentV2, uint256 amount, bytes extraArgs) in tuple order', () => {
    for (const name of ['stakeRemote', 'quoteFee']) {
      const inputs = fn('sender', name).inputs!;
      expect(inputs.map((i) => i.name)).toEqual(['intent', 'amount', 'extraArgs']);
      expect(inputs[0].components!.map((c) => c.name)).toEqual([...STAKE_INTENT_V2_FIELDS]);
      expect(types(inputs)).toEqual(['(uint8,uint256,bool,address,address,uint256,uint64,uint256)', 'uint256', 'bytes']);
    }
    expect(fn('sender', 'stakeRemote')).toMatchObject({ stateMutability: 'payable' });
  });

  it('vault writes', () => {
    expect(types(fn('vault', 'stake').inputs)).toEqual(['uint256', 'bool', 'uint256', 'address', 'address']);
    expect(types(fn('vault', 'stakeFromREP').inputs)).toEqual(['uint256', 'bool', 'uint256', 'address', 'address']);
    expect(types(fn('vault', 'deposit').inputs)).toEqual(['uint256', 'address']);
    expect(types(fn('vault', 'withdraw').inputs)).toEqual(['uint256']);
    expect(types(fn('vault', 'claimPrincipal').inputs)).toEqual(['bool', 'uint256']);
    expect(types(fn('vault', 'propose').inputs)).toEqual(['uint8', 'bytes32']);
    expect(types(fn('vault', 'challenge').inputs)).toEqual(['bytes32']);
  });

  it('market writes use the v4 PoolKey tuple and hook-owned liquidity', () => {
    expect(types(fn('swapRouter', 'swapExactInput').inputs)).toEqual(['(address,address,uint24,int24,address)', 'bool', 'uint256', 'uint256', 'uint64']);
    expect(types(fn('stakeAndSell', 'stakeAndSellYield').inputs)).toEqual(['bool', 'uint256', 'uint256', 'uint64']);
    expect(types(fn('hook', 'addLiquidity').inputs)).toEqual(['uint256', 'uint256', 'uint256']);
    expect(types(fn('hook', 'removeLiquidity').inputs)).toEqual(['uint256', 'uint256', 'uint256']);
  });

  it('CCIP events: Sent and the receiver outcomes are indexed by messageId', () => {
    expect(ev('sender', 'Sent').inputs!.map((i) => `${i.name}:${i.type}${i.indexed ? ':i' : ''}`)).toEqual([
      'messageId:bytes32:i',
      'sourceAccount:address:i',
      'reportId:uint256:i',
      'recipient:address',
      'yes:bool',
      'amount:uint256',
    ]);
    for (const e of ['Credited', 'DeferredAsREP', 'Held', 'Recovered']) expect(ev('receiver', e).inputs![0]).toMatchObject({ name: 'messageId', type: 'bytes32', indexed: true });
  });

  it('custom errors decode: TokenCallFailed() and InvalidRouter(address) are known', () => {
    const names = KNOWN_ERRORS.map((e) => `${e.name}(${e.inputs.map((i) => i.type).join(',')})`);
    expect(names).toEqual(expect.arrayContaining(['TokenCallFailed()', 'InvalidRouter(address)', 'InvalidRecipient(address)', 'MaxSupplyExceeded(uint256)']));
  });
});
