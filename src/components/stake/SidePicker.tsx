'use client';

import { Side } from '@/lib/types';

export const SIDE_COPY = {
  [Side.For]: {
    name: 'For',
    line: 'The claim holds: this token is a trap.',
    ink: 'text-clue-ink',
    ring: 'border-clue',
    fill: 'bg-[color-mix(in_srgb,var(--clue-500)_14%,transparent)]',
  },
  [Side.Against]: {
    name: 'Against',
    line: "The claim is wrong: the token isn't a trap.",
    ink: 'text-mask-ink',
    ring: 'border-mask',
    fill: 'bg-[color-mix(in_srgb,var(--mask-500)_14%,transparent)]',
  },
} as const;

export function SidePicker({
  value,
  onChange,
  disabled,
}: {
  value: Side | null;
  onChange: (s: Side) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
      <legend className="text-muted mb-2 text-sm">Your verdict</legend>
      {[Side.For, Side.Against].map((s) => {
        const c = SIDE_COPY[s];
        const on = value === s;
        return (
          <label
            key={s}
            className={`cursor-pointer rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
              on
                ? `${c.ring} ${c.fill}`
                : 'border-line hover:border-[color-mix(in_srgb,var(--fog-400)_60%,transparent)]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="radio"
              name="side"
              className="sr-only"
              checked={on}
              onChange={() => onChange(s)}
            />
            <span className={`font-display flex items-center gap-2 text-xl ${c.ink}`}>
              <span
                aria-hidden
                className={`grid h-4 w-4 place-items-center rounded-full border-2 ${on ? c.ring : 'border-line'}`}
              >
                {on && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${s === Side.For ? 'bg-clue' : 'bg-mask'}`}
                  />
                )}
              </span>
              {c.name}
            </span>
            <span className="text-muted mt-1 block text-sm">{c.line}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
