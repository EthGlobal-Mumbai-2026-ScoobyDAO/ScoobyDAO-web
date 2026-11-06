import { keccak256, stringToHex } from 'viem';

/**
 * Canonical JSON per INTERFACES.md §3: object keys sorted (by UTF-16 code unit,
 * i.e. JS default sort), no whitespace, arrays keep their order.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    if (s === undefined) throw new Error(`Cannot canonicalize ${typeof value}`);
    return s;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`).join(',')}}`;
}

/** manifestHash = keccak256(utf8(canonicalJSON(manifest))) */
export function manifestHash(manifest: unknown): `0x${string}` {
  return keccak256(stringToHex(canonicalJSON(manifest)));
}

export function hashMatches(manifest: unknown, expected: string): boolean {
  return manifestHash(manifest).toLowerCase() === expected.toLowerCase();
}
