'use client';

import { CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { HashText } from '@/components/HashText';
import { manifestHash } from '@/lib/canonical';
import type { Report } from '@/lib/types';

/** Recomputes keccak256(canonicalJSON(manifest)) in the browser and compares with the published hash. */
export function HashCheck({ report }: { report: Report }) {
  const [computed, setComputed] = useState<string | null>(null);
  const match = computed !== null && computed.toLowerCase() === report.manifestHash.toLowerCase();
  return (
    <div className="space-y-3">
      <div>
        <p className="text-muted text-sm">
          Manifest hash (from the backend
          {report.status === 'published' ? ', registered onchain' : ''})
        </p>
        <HashText value={report.manifestHash} label="manifest hash" />
      </div>
      <button
        type="button"
        onClick={() => setComputed(manifestHash(report.manifest))}
        className="border-line inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold hover:border-[var(--fog-400)]"
      >
        <RefreshCw size={15} aria-hidden /> Recompute hash
      </button>
      {computed && (
        <div
          role="status"
          className={`space-y-1 rounded-lg border p-3 ${match ? 'border-[color-mix(in_srgb,var(--clue-500)_55%,transparent)]' : 'border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)]'}`}
        >
          <p
            className={`flex items-center gap-2 font-semibold ${match ? 'text-clue-ink' : 'text-mask-ink'}`}
          >
            {match ? <CircleCheck size={18} aria-hidden /> : <CircleX size={18} aria-hidden />}
            {match
              ? '✓ Match: this is exactly the manifest that was hashed'
              : "✗ Mismatch: this manifest doesn't produce the published hash"}
          </p>
          <p className="text-muted text-xs">Computed in your browser:</p>
          <HashText value={computed} label="computed hash" />
        </div>
      )}
    </div>
  );
}
