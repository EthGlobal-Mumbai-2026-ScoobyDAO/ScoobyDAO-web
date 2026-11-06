import { concat, keccak256, numberToHex, pad, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  computeCommitment,
  loadStake,
  makeBackup,
  parseBackup,
  randomSalt,
  saveStake,
  storageKey,
  type SealedStake,
} from './commitment';
import { Side } from './types';

const account = '0x1111111111111111111111111111111111111111';
const salt = `0x${'ab'.repeat(32)}` as Hex;

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe('computeCommitment', () => {
  it('equals keccak256 of five 32-byte abi.encode words (independent encoding)', () => {
    const claimId = 7n;
    const amount = 1_500_000n;
    const manual = keccak256(
      concat([
        pad(numberToHex(claimId), { size: 32 }),
        pad(account, { size: 32 }),
        pad(numberToHex(Side.Against), { size: 32 }),
        pad(numberToHex(amount), { size: 32 }),
        salt,
      ]),
    );
    expect(computeCommitment({ claimId, account, side: Side.Against, amount, salt })).toBe(manual);
  });

  it('changes when any input changes', () => {
    const base = { claimId: 1n, account, side: Side.For, amount: 1_000_000n, salt } as const;
    const h = computeCommitment(base);
    expect(computeCommitment({ ...base, side: Side.Against })).not.toBe(h);
    expect(computeCommitment({ ...base, amount: 1_000_001n })).not.toBe(h);
    expect(computeCommitment({ ...base, claimId: 2n })).not.toBe(h);
    expect(computeCommitment({ ...base, salt: randomSalt() })).not.toBe(h);
  });
});

describe('randomSalt', () => {
  it('is 32 random bytes', () => {
    const a = randomSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(randomSalt()).not.toBe(a);
  });
});

describe('storage round trip', () => {
  const stake: SealedStake = { claimId: '42', side: Side.For, amount: '2500000', salt };

  it('saves under scoobydao:<chainId>:<claimId>:<account> and loads back', () => {
    const s = memoryStorage();
    expect(saveStake(11155111, account, stake, s)).toBe(true);
    expect([...s.raw.keys()]).toEqual([`scoobydao:11155111:42:${account}`]);
    expect(loadStake(11155111, '42', account.toUpperCase().replace('0X', '0x'), s)).toEqual(stake);
  });

  it('key is case-insensitive on the account', () => {
    expect(storageKey(1, '2', '0xABCDEF')).toBe('scoobydao:1:2:0xabcdef');
  });

  it('returns false/null instead of throwing when storage fails', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(saveStake(1, account, stake, broken)).toBe(false);
    expect(loadStake(1, '42', account, broken)).toBeNull();
    expect(saveStake(1, account, stake, null)).toBe(false);
  });

  it('ignores corrupted entries', () => {
    const s = memoryStorage();
    s.setItem(storageKey(1, '42', account), '{"claimId":"42","side":5}');
    expect(loadStake(1, '42', account, s)).toBeNull();
  });
});

describe('backup', () => {
  const stake: SealedStake = { claimId: '42', side: Side.Against, amount: '2500000', salt };
  const expect_ = { chainId: 11155111, claimId: '42', account };

  it('round-trips through JSON and recomputes the commitment', () => {
    const b = makeBackup(11155111, account, stake);
    const parsed = parseBackup(JSON.stringify(b), expect_);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.commitment).toBe(b.commitment);
      expect(parsed.backup.salt).toBe(salt);
    }
  });

  it('rejects backups for another wallet, claim or chain', () => {
    const b = JSON.stringify(makeBackup(11155111, account, stake));
    expect(
      parseBackup(b, { ...expect_, account: '0x2222222222222222222222222222222222222222' }).ok,
    ).toBe(false);
    expect(parseBackup(b, { ...expect_, claimId: '43' }).ok).toBe(false);
    expect(parseBackup(b, { ...expect_, chainId: 1 }).ok).toBe(false);
    expect(parseBackup('not json', expect_).ok).toBe(false);
  });
});
