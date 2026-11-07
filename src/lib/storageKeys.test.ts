import { beforeEach, describe, expect, it } from 'vitest';
import { migrateStorageKey, resetStorageMigrations } from './storageKeys';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, v);
  removeItem = (k: string) => void this.m.delete(k);
  clear = () => this.m.clear();
}
const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
(globalThis as unknown as { window: unknown }).window = { localStorage, sessionStorage };

describe('migrateStorageKey', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetStorageMigrations();
  });

  it('copies the old value to the new key and deletes the old key', () => {
    localStorage.setItem('unmasked:ccip', '[{"messageId":"0x1"}]');
    migrateStorageKey('local', 'unmasked:ccip', 'scoobydao:ccip');
    expect(localStorage.getItem('scoobydao:ccip')).toBe('[{"messageId":"0x1"}]');
    expect(localStorage.getItem('unmasked:ccip')).toBeNull();
  });

  it('never overwrites a value already saved under the new key', () => {
    sessionStorage.setItem('unmasked.review-sessions', '{"a":"old"}');
    sessionStorage.setItem('scoobydao.review-sessions', '{"a":"new"}');
    migrateStorageKey('session', 'unmasked.review-sessions', 'scoobydao.review-sessions');
    expect(sessionStorage.getItem('scoobydao.review-sessions')).toBe('{"a":"new"}');
    expect(sessionStorage.getItem('unmasked.review-sessions')).toBeNull();
  });

  it('does nothing when there is no old key', () => {
    migrateStorageKey('local', 'unmasked:ccip', 'scoobydao:ccip');
    expect(localStorage.getItem('scoobydao:ccip')).toBeNull();
  });
});
