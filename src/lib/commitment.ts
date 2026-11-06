import { encodeAbiParameters, getAddress, isAddress, isHex, keccak256, toHex, type Address, type Hex } from 'viem';
import { Side } from './types';

/** What we keep so the user can reveal later. Amount is in 6-decimal base units. */
export interface SealedStake {
  claimId: string;
  side: Side;
  amount: string;
  salt: Hex;
}

export interface StakeBackup extends SealedStake {
  app: 'unmasked';
  version: 1;
  chainId: number;
  account: Address;
  commitment: Hex;
  savedAt: number;
}

export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** keccak256(abi.encode(claimId, account, uint8(side), amount, salt)) — matches VerdictMarket. */
export function computeCommitment(args: {
  claimId: bigint;
  account: Address;
  side: Side;
  amount: bigint;
  salt: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'bytes32' }],
      [args.claimId, args.account, args.side, args.amount, args.salt],
    ),
  );
}

export function storageKey(chainId: number, claimId: string, account: string): string {
  return `scoobydao:${chainId}:${claimId}:${account.toLowerCase()}`;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): KV | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Returns false if storage is unavailable (private mode, quota, blocked) — the UI then insists on the backup. */
export function saveStake(chainId: number, account: string, stake: SealedStake, storage = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(chainId, stake.claimId, account), JSON.stringify(stake));
    return true;
  } catch {
    return false;
  }
}

export function loadStake(chainId: number, claimId: string, account: string, storage = defaultStorage()): SealedStake | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(chainId, claimId, account));
    if (!raw) return null;
    return validateStake(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearStake(chainId: number, claimId: string, account: string, storage = defaultStorage()): void {
  try {
    storage?.removeItem(storageKey(chainId, claimId, account));
  } catch {
    /* ignore */
  }
}

function validateStake(v: unknown): SealedStake | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.claimId !== 'string' || !/^\d+$/.test(o.claimId)) return null;
  if (o.side !== Side.For && o.side !== Side.Against) return null;
  if (typeof o.amount !== 'string' || !/^\d+$/.test(o.amount)) return null;
  if (typeof o.salt !== 'string' || !isHex(o.salt) || o.salt.length !== 66) return null;
  return { claimId: o.claimId, side: o.side, amount: o.amount, salt: o.salt };
}

export function makeBackup(chainId: number, account: Address, stake: SealedStake): StakeBackup {
  return {
    app: 'unmasked',
    version: 1,
    chainId,
    account: getAddress(account),
    ...stake,
    commitment: computeCommitment({
      claimId: BigInt(stake.claimId),
      account,
      side: stake.side,
      amount: BigInt(stake.amount),
      salt: stake.salt,
    }),
    savedAt: Math.floor(Date.now() / 1000),
  };
}

export type BackupResult = { ok: true; backup: StakeBackup } | { ok: false; error: string };

/** Parses an uploaded backup and checks it belongs to this claim, wallet and chain. */
export function parseBackup(text: string, expect: { chainId: number; claimId: string; account: string }): BackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  const o = json as Record<string, unknown>;
  const stake = validateStake(json);
  if (!stake || o.app !== 'unmasked' || typeof o.account !== 'string' || !isAddress(o.account)) {
    return { ok: false, error: "This file isn't an Unmasked stake backup." };
  }
  if (o.chainId !== expect.chainId) return { ok: false, error: `This backup is for chain ${String(o.chainId)}, not ${expect.chainId}.` };
  if (stake.claimId !== expect.claimId) return { ok: false, error: `This backup is for case #${stake.claimId}, not #${expect.claimId}.` };
  if (o.account.toLowerCase() !== expect.account.toLowerCase())
    return { ok: false, error: 'This backup belongs to a different wallet. Connect that wallet to reveal.' };
  return { ok: true, backup: makeBackup(expect.chainId, o.account, stake) };
}

export function backupFilename(b: StakeBackup): string {
  return `unmasked-case-${b.claimId}-${b.account.slice(0, 8)}.json`;
}

/** Browser-only: triggers a JSON file download. */
export function downloadBackup(b: StakeBackup): void {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(b);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
