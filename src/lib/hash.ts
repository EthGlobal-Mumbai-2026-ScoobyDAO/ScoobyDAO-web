import { keccak256 } from 'viem';

// Hash checks done in the browser.
//
// reportSha256 = SHA-256 over the exact report.json bytes from GET /web/v1/reports/:id/raw
//   (digest protocol in ScoobyDAO-backend/schemas/CONTRACT.md; no re-serialisation).
// claimHash    = keccak256 or SHA-256 over the canonical claim manifest (the backend's
//   SCOOBY_CLAIM_HASH_ALG; keccak256 by default since backend bd6f82a). Canonical must equal the
//   backend's store.dumps: json.dumps(x, sort_keys=True, separators=(',',':'), ensure_ascii=False,
//   allow_nan=False) encoded as UTF-8, integers only (publication/canonical.py rejects floats).
//
// Known divergence risks (NOTES.md): Python sorts keys by code point (handled below) and writes
// lone surrogates raw, while JSON.stringify escapes them; floats would format differently, so they
// are rejected here just as the backend rejects them.

export type Bytes = Uint8Array;

export async function sha256Hex(data: Bytes | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class CanonicalError extends Error {}

/** Python str ordering: by Unicode code point, not UTF-16 code unit. */
function cmpCodePoint(a: string, b: string): number {
  const A = Array.from(a);
  const B = Array.from(b);
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const d = A[i].codePointAt(0)! - B[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return A.length - B.length;
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isInteger(value)) throw new CanonicalError('canonical records must not contain floats');
      if (!Number.isSafeInteger(value)) throw new CanonicalError('integer outside the safe range');
      return String(value);
    case 'bigint':
      return value.toString();
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
      const keys = Object.keys(value as object).sort(cmpCodePoint);
      return `{${keys
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
        .join(',')}}`;
    }
    default:
      throw new CanonicalError(`unsupported value: ${typeof value}`);
  }
}

export const canonicalBytes = (value: unknown): Bytes => new TextEncoder().encode(canonicalJson(value));

/** 0x-prefixed lowercase bytes32 from a hex digest with or without 0x. */
export const toBytes32 = (hex: string) => `0x${hex.toLowerCase().replace(/^0x/, '')}` as `0x${string}`;
export const sameHash = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase().replace(/^0x/, '') === b.toLowerCase().replace(/^0x/, '');

export type ClaimHashAlg = 'keccak256' | 'sha256';

export async function claimHashOf(manifest: unknown, alg: ClaimHashAlg = 'sha256'): Promise<`0x${string}`> {
  const bytes = canonicalBytes(manifest);
  return alg === 'keccak256' ? keccak256(bytes) : toBytes32(await sha256Hex(bytes));
}

export interface ClaimHashMatch {
  /** The algorithm that matched, or the first one tried when nothing matched. */
  alg: ClaimHashAlg;
  hash: `0x${string}`;
  match: boolean;
  /** True when the backend declared the algorithm (claimHashAlg); false when it was inferred. */
  declared: boolean;
}

/**
 * Recomputes the claim hash and compares it with `expected`. A backend-declared algorithm is the
 * only one used; without one, keccak256 (the backend default) is tried first, then SHA-256, and the
 * result says which matched.
 */
export async function matchClaimHash(manifest: unknown, expected: string, alg?: ClaimHashAlg): Promise<ClaimHashMatch> {
  const algs: ClaimHashAlg[] = alg ? [alg] : ['keccak256', 'sha256'];
  let first: { alg: ClaimHashAlg; hash: `0x${string}` } | undefined;
  for (const a of algs) {
    const hash = await claimHashOf(manifest, a);
    first ??= { alg: a, hash };
    if (sameHash(hash, expected)) return { alg: a, hash, match: true, declared: !!alg };
  }
  return { ...first!, match: false, declared: !!alg };
}

/** Hash evidence for a challenge: bytes32 = SHA-256 of a file or of pasted UTF-8 text. */
export async function evidenceHash(input: File | string): Promise<`0x${string}`> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(await input.arrayBuffer());
  return toBytes32(await sha256Hex(bytes));
}
