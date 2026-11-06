import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { toFunctionSignature, type AbiFunction } from 'viem';
import { describe, expect, it } from 'vitest';
import { claimRegistryAbi, freezeHookAbi, verdictMarketAbi } from './abis';
import sepolia from './sepolia.json';

const dir = path.join(__dirname, 'abi');
const load = (name: string): AbiFunction[] => {
  const json = JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  const abi = Array.isArray(json) ? json : json.abi; // raw ABI or Foundry artifact
  return abi.filter((x: { type: string }) => x.type === 'function');
};
const sigs = (abi: readonly { type: string }[]) =>
  abi.filter((x): x is AbiFunction => x.type === 'function').map((f) => toFunctionSignature(f));

describe('synced ABIs still match the typed interface (INTERFACES.md §2)', () => {
  it.each([
    ['ClaimRegistry', claimRegistryAbi],
    ['VerdictMarket', verdictMarketAbi],
    ['FreezeHook', freezeHookAbi],
  ] as const)('%s', (name, typed) => {
    const synced = new Set(load(name).map((f) => toFunctionSignature(f)));
    for (const s of sigs(typed))
      expect(synced, `${name}.${s} missing from abi/${name}.json`).toContain(s);
  });

  it('has every artifact INTERFACES.md §1 lists', () => {
    const files = readdirSync(dir);
    for (const n of [
      'ClaimRegistry',
      'VerdictMarket',
      'ShareToken',
      'FreezeHook',
      'Treasury',
      'MockUSDC',
      'HoneypotToken',
      'HonestToken',
    ])
      expect(files).toContain(`${n}.json`);
  });

  it('sepolia.json has every contract key', () => {
    expect(Object.keys(sepolia.contracts).sort()).toEqual(
      [
        'ClaimRegistry',
        'FreezeHook',
        'HonestToken',
        'HoneypotToken',
        'PoolManager',
        'SwapRouter',
        'Treasury',
        'USDC',
        'VerdictMarket',
      ].sort(),
    );
  });
});
