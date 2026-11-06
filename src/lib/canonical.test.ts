import { keccak256, stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { reports } from '@/fixtures';
import { canonicalJSON, hashMatches, manifestHash } from './canonical';

describe('canonicalJSON', () => {
  it('sorts keys recursively, keeps array order, no whitespace', () => {
    const v = { b: 1, a: { d: [3, { z: true, y: null }], c: 'x y' } };
    expect(canonicalJSON(v)).toBe('{"a":{"c":"x y","d":[3,{"y":null,"z":true}]},"b":1}');
  });

  it('is independent of key insertion order', () => {
    expect(canonicalJSON({ x: 1, y: 2 })).toBe(canonicalJSON({ y: 2, x: 1 }));
  });

  it('escapes strings like JSON.stringify', () => {
    expect(canonicalJSON({ s: 'quote " and \n newline' })).toBe('{"s":"quote \\" and \\n newline"}');
  });

  it('drops undefined object fields', () => {
    expect(canonicalJSON({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe('manifestHash', () => {
  it('is keccak256 of the utf8 canonical JSON', () => {
    const m = { version: 1, chainId: 11155111, token: '0xabc' };
    expect(manifestHash(m)).toBe(keccak256(stringToHex('{"chainId":11155111,"token":"0xabc","version":1}')));
  });

  it('matches every fixture report and detects tampering', () => {
    for (const r of reports) expect(hashMatches(r.manifest, r.manifestHash)).toBe(true);
    const tampered = { ...reports[0].manifest, summary: reports[0].manifest.summary + '!' };
    expect(hashMatches(tampered, reports[0].manifestHash)).toBe(false);
  });
});
