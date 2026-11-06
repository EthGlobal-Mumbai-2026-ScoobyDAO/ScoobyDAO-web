import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { sepolia as v1Sepolia } from '@/contracts/addresses';
import { poolKeyHashOf } from '@/protocol/deployment';
import { addressOf, allContracts, ARB_SEPOLIA_ID, SEPOLIA_ID, v2, v2Abis } from './index';

const dir = path.resolve(import.meta.dirname);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'abi-manifest.json'), 'utf8')) as Record<string, { file: string; entries: number; sha256: string }>;

describe('abi-manifest.json', () => {
  it.each(Object.entries(manifest))('%s matches its SHA-256 and entry count', (_name, entry) => {
    const bytes = fs.readFileSync(path.join(dir, entry.file));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const abi = JSON.parse(bytes.toString('utf8')) as unknown[];
    expect(Array.isArray(abi)).toBe(true);
    expect(abi).toHaveLength(entry.entries);
  });

  it('lists exactly the ABI files in abis/', () => {
    const listed = Object.values(manifest).map((e) => path.basename(e.file)).sort();
    const present = fs.readdirSync(path.join(dir, 'abis')).filter((f) => f.endsWith('.json')).sort();
    expect(present).toEqual(listed);
  });

  it('abis.ts is generated from exactly these files (run `npm run sync:v2` if this fails)', () => {
    expect(Object.keys(v2Abis).sort()).toEqual(Object.keys(manifest).sort());
    for (const [name, entry] of Object.entries(manifest)) {
      const json = JSON.parse(fs.readFileSync(path.join(dir, entry.file), 'utf8'));
      expect(v2Abis[name as keyof typeof v2Abis], name).toEqual(json);
    }
  });

  const handoff = path.resolve(dir, '../../../../v2');
  it.skipIf(!fs.existsSync(path.join(handoff, 'abi-manifest.json')))('the copy matches the handoff bundle in ../v2 byte for byte', () => {
    for (const f of ['addresses.json', 'abi-manifest.json', ...Object.values(manifest).map((e) => e.file)])
      expect(fs.readFileSync(path.join(dir, f)).equals(fs.readFileSync(path.join(handoff, f))), f).toBe(true);
  });
});

describe('addresses are keyed by (chainId, contract name)', () => {
  it('0xfb2c…88e5 is the V1 ReportRegistry on Ethereum Sepolia and the V2 CCIPStakeSenderV2 on Arbitrum Sepolia', () => {
    const fb2c = getAddress('0xfb2c164ddb3676d03e1e443f3f2934b8d0df88e5');
    expect(v1Sepolia.ReportRegistry).toBe(fb2c);
    expect(addressOf(ARB_SEPOLIA_ID, 'CCIPStakeSenderV2')).toBe(fb2c);
    // The V2 registry is a different contract, and the sender doesn't exist on Sepolia.
    expect(addressOf(SEPOLIA_ID, 'ReportRegistry')).toBe(getAddress('0x805d681383f580403b979bf1d017cff045dc7ebd'));
    expect(addressOf(SEPOLIA_ID, 'CCIPStakeSenderV2')).toBeUndefined();
    expect(addressOf(ARB_SEPOLIA_ID, 'ReportRegistry')).toBeUndefined();
    expect(addressOf(1, 'DemoUSD')).toBeUndefined();
  });

  it('every address is checksummed and appears once per chain', () => {
    for (const c of allContracts()) expect(c.address).toBe(getAddress(c.address));
    for (const chainId of [SEPOLIA_ID, ARB_SEPOLIA_ID]) {
      const names = allContracts().filter((c) => c.chainId === chainId).map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
    expect(allContracts()).toHaveLength(18);
  });
});

describe('selectors, pool key and report snapshot', () => {
  it('CCIP selectors are bigints beyond Number.MAX_SAFE_INTEGER', () => {
    expect(v2.selectors.sepolia).toBe(16015286601757825753n);
    expect(v2.selectors.arbitrumSepolia).toBe(3478487238524512106n);
    expect(v2.selectors.sepolia > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(v2.selectors.senderDestination).toBe(v2.selectors.sepolia);
  });

  it('the pool key is sorted dUSD/YT, fee 0, tick spacing 1, and hashes to poolKeyHash', () => {
    expect(v2.poolKey).toEqual({
      currency0: v2.sepolia.DemoUSD,
      currency1: v2.sepolia.StakerYieldToken,
      fee: 0,
      tickSpacing: 1,
      hooks: v2.sepolia.YieldCurveHookV2,
    });
    expect(BigInt(v2.poolKey.currency0) < BigInt(v2.poolKey.currency1)).toBe(true);
    expect(poolKeyHashOf(v2.poolKey)).toBe(v2.poolKeyHash);
  });

  it('report #1 snapshot (tests only; the UI reads these from chain)', () => {
    expect(v2.reportId).toBe(1n);
    expect(v2.report.maturity - v2.report.lockTime).toBe(30 * 86_400);
    expect(v2.report.lockTime - v2.report.crossChainCutoff).toBe(86_400);
    expect(v2.report.challengePeriod).toBe(86_400);
    expect(new Date(v2.report.crossChainCutoff * 1000).toISOString()).toBe('2026-11-08T07:44:00.000Z');
    expect(new Date(v2.report.resultDeadline * 1000).toISOString()).toBe('2026-12-13T07:44:00.000Z');
  });
});
