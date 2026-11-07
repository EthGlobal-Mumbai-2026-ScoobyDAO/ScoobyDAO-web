// Browser storage keys moved from the old `unmasked*` names to `scoobydao*` (rebrand, Nov 2026).
// Each old key is read once, copied to its new name unless that already has a value, then deleted, so saved CCIP
// tracking and open review sessions survive the rename. Storage errors are swallowed: the app works without storage.

type Kind = 'local' | 'session';
const done = new Set<string>();

function store(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function migrateStorageKey(kind: Kind, oldKey: string, newKey: string): void {
  const id = `${kind}:${oldKey}`;
  if (done.has(id)) return;
  const s = store(kind);
  if (!s) return;
  done.add(id);
  try {
    const old = s.getItem(oldKey);
    if (old === null) return;
    if (s.getItem(newKey) === null) s.setItem(newKey, old);
    s.removeItem(oldKey);
  } catch {
    /* storage blocked: nothing to migrate */
  }
}

/** Test hook: forget which keys were migrated in this page. */
export const resetStorageMigrations = () => done.clear();
