'use client';

import { useId } from 'react';
import { formatUsdc, parseUsdc } from '@/lib/format';
import { useWritesAllowed } from '@/protocol/hooks';

/** 6-decimal amount input (dUSD, REP, YT, RF-YLP). Parsing uses parseUnits, never floats. */
export function AmountField({
  label,
  value,
  onChange,
  balance,
  unit,
  placeholder = '1.00',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  balance?: bigint;
  unit: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const parsed = parseUsdc(value);
  const error =
    value && parsed === null
      ? 'Enter an amount with at most 6 decimals.'
      : parsed !== null && parsed <= 0n
        ? 'Enter more than 0.'
        : parsed && balance !== undefined && parsed > balance
          ? `More than your balance (${formatUsdc(balance)} ${unit}).`
          : null;
  return (
    <div>
      <label htmlFor={id} className="text-muted text-sm">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
          className="num border-line focus:border-beam w-full rounded-xl border bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-3 py-2.5 text-lg outline-none disabled:opacity-60"
        />
        <button
          type="button"
          disabled={balance === undefined || disabled}
          onClick={() => balance !== undefined && onChange(formatUsdc(balance, { exact: true }).replace(/,/g, ''))}
          className="border-line rounded-xl border px-3 font-semibold hover:border-[var(--fog-400)] disabled:opacity-50"
        >
          Max
        </button>
      </div>
      <p id={`${id}-help`} className={`mt-1 text-sm ${error ? 'text-mask-ink' : 'text-muted'}`}>
        {error ?? (balance !== undefined ? `Balance: ${formatUsdc(balance)} ${unit}` : 'Reading balance…')}
      </p>
    </div>
  );
}

/** Valid amount for a field (null when empty, invalid, zero or above the balance). */
export function validAmount(value: string, balance?: bigint): bigint | null {
  const v = parseUsdc(value);
  if (v === null || v <= 0n) return null;
  if (balance !== undefined && v > balance) return null;
  return v;
}

/** Exact-amount approvals by default; maxUint256 only when the user opts in. */
export function ApprovalToggle({ unlimited, onChange }: { unlimited: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="text-muted flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={unlimited} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Unlimited approval <span className="text-xs">(default: approve exactly this amount; an approve step appears only when the allowance is short)</span>
      </span>
    </label>
  );
}

/** Explains disabled write buttons (deployment check pending, mismatched or unreachable). */
export function WritesBlockedNote() {
  const { allowed, reason } = useWritesAllowed();
  if (allowed || !reason) return null;
  return (
    <p className="text-mask-ink text-sm" role="status">
      {reason}
    </p>
  );
}
