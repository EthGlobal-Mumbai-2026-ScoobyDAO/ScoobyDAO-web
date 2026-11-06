import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildClaimManifest, historicalReport, RAW_REPORT } from '@/fixtures';
import { HISTORICAL_DIGEST_SHA256 } from '@/fixtures/historicalReport';
import vector from '@/test/recorded/claim-hash-vector.json';
import { canonicalBytes, canonicalJson, CanonicalError, claimHashOf, evidenceHash, matchClaimHash, sameHash, sha256Hex } from './hash';

describe('sha256Hex (Web Crypto)', () => {
  it('known vector: "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('historical bundle: SHA-256 of the exact report.json bytes equals digest.json', async () => {
    expect(await sha256Hex(new TextEncoder().encode(RAW_REPORT))).toBe(HISTORICAL_DIGEST_SHA256);
    expect(HISTORICAL_DIGEST_SHA256).toBe('3d1678e793b50ba36edcb051f94a6d80d40d5498c49ce7637a7ab43d118f0f3c');
  });
  it('re-serialising the parsed report changes the bytes (why /raw is required)', async () => {
    expect(await sha256Hex(JSON.stringify(historicalReport))).not.toBe(HISTORICAL_DIGEST_SHA256);
  });
});

describe('canonicalJson = json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)', () => {
  it('sorts keys, no whitespace, keeps non-ASCII raw', () => {
    // Python: json.dumps({"b":1,"a":[True,None,"é"]}, sort_keys=True, separators=(',',':'), ensure_ascii=False)
    expect(canonicalJson({ b: 1, a: [true, null, 'é'] })).toBe('{"a":[true,null,"é"],"b":1}');
  });
  it('escapes like Python for quotes, backslashes and control characters', () => {
    expect(canonicalJson('a"b\\c\n\u0001')).toBe('"a\\"b\\\\c\\n\\u0001"');
  });
  it('sorts keys by code point, like Python str ordering', () => {
    expect(canonicalJson({ '\u{1F600}': 1, '￿': 2 })).toBe('{"￿":2,"\u{1F600}":1}');
  });
  it('rejects floats (the backend rejects them too)', () => {
    expect(() => canonicalJson({ x: 1.5 })).toThrow(CanonicalError);
  });
  it('a manifest built from the bundle hashes deterministically', async () => {
    const m = buildClaimManifest(historicalReport, HISTORICAL_DIGEST_SHA256, 1_700_000_000, 1_700_010_800);
    const viaNode = '0x' + createHash('sha256').update(canonicalJson(m), 'utf8').digest('hex');
    expect(await claimHashOf(m)).toBe(viaNode);
    expect(m.claimText.startsWith('not stated. ')).toBe(true);
    expect(m.windowSeconds).toBe(10_800);
  });
});

describe('helpers', () => {
  it('evidenceHash hashes pasted text to a bytes32', async () => {
    expect(await evidenceHash('abc')).toBe('0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('sameHash ignores 0x and case', () => {
    expect(sameHash('0xABcd', 'abcd')).toBe(true);
    expect(sameHash(undefined, 'abcd')).toBe(false);
  });
});

describe('claim hash algorithms (§3.9): the backend default is keccak256 since bd6f82a', () => {
  // Vector from the backend's own claim_hash(): web and backend must agree byte for byte.
  it('keccak256 and SHA-256 of the canonical manifest equal the backend values', async () => {
    expect(canonicalBytes(vector.manifest)).toHaveLength(vector.canonicalLength);
    expect(await claimHashOf(vector.manifest, 'keccak256')).toBe(vector.keccak256);
    expect(await claimHashOf(vector.manifest, 'sha256')).toBe(vector.sha256);
    expect(await claimHashOf(vector.manifest)).toBe(vector.sha256); // default kept for existing callers
  });

  it('without claimHashAlg: keccak256 is tried first, then SHA-256, and the result says which matched', async () => {
    expect(await matchClaimHash(vector.manifest, vector.keccak256)).toEqual({ alg: 'keccak256', hash: vector.keccak256, match: true, declared: false });
    expect(await matchClaimHash(vector.manifest, vector.sha256)).toEqual({ alg: 'sha256', hash: vector.sha256, match: true, declared: false });
    expect(await matchClaimHash(vector.manifest, `0x${'00'.repeat(32)}`)).toMatchObject({ alg: 'keccak256', match: false, declared: false });
  });

  it('a declared algorithm is the only one used', async () => {
    expect(await matchClaimHash(vector.manifest, vector.sha256, 'sha256')).toMatchObject({ match: true, declared: true });
    expect(await matchClaimHash(vector.manifest, vector.sha256, 'keccak256')).toMatchObject({ alg: 'keccak256', match: false, declared: true });
  });

  it('report #1’s demo claimHash matches no manifest here (it isn’t linked to a backend report)', async () => {
    expect((await matchClaimHash(vector.manifest, '0x9d6133237e7553b91eb075f559c645abd7ab3eb1592e377496c1fa8dc2f8a112')).match).toBe(false);
  });
});
