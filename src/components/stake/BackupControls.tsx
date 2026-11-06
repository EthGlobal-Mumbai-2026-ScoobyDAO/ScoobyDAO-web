'use client';

import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Address } from 'viem';
import {
  downloadBackup,
  makeBackup,
  parseBackup,
  saveStake,
  type SealedStake,
} from '@/lib/commitment';

export function DownloadBackupButton({
  chainId,
  account,
  stake,
  primary = false,
}: {
  chainId: number;
  account: Address;
  stake: SealedStake;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadBackup(makeBackup(chainId, account, stake))}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold ${primary ? 'bg-beam text-on-beam' : 'border-line border hover:border-[var(--fog-400)]'}`}
    >
      <Download size={16} aria-hidden /> Download backup
    </button>
  );
}

export function RestoreBackup({
  chainId,
  claimId,
  account,
  onRestored,
}: {
  chainId: number;
  claimId: string;
  account: Address;
  onRestored: (s: SealedStake) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Upload stake backup"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const res = parseBackup(await f.text(), { chainId, claimId, account });
          if (!res.ok) return setError(res.error);
          setError(null);
          const { claimId: c, side, amount, salt } = res.backup;
          const stake = { claimId: c, side, amount, salt };
          saveStake(chainId, account, stake);
          onRestored(stake);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="text-beam-ink inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
      >
        <Upload size={15} aria-hidden /> Restore from a backup file
      </button>
      {error && (
        <p role="alert" className="text-mask-ink mt-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
