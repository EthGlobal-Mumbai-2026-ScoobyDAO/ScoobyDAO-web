'use client';

export type SideKey = 'yes' | 'no';

export const SIDE_COPY = {
  yes: {
    name: 'Yes',
    line: 'The claim holds by maturity.',
    ink: 'text-beam-ink',
    ring: 'border-beam',
    fill: 'bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]',
    dot: 'bg-beam',
  },
  no: {
    name: 'No',
    line: "The claim doesn't hold.",
    ink: 'text-clue-ink',
    ring: 'border-clue',
    fill: 'bg-[color-mix(in_srgb,var(--clue-500)_14%,transparent)]',
    dot: 'bg-clue',
  },
} as const;

export function SidePicker({ value, onChange, disabled }: { value: SideKey | null; onChange: (s: SideKey) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
      <legend className="text-muted mb-2 text-sm">Your position</legend>
      {(['yes', 'no'] as const).map((s) => {
        const c = SIDE_COPY[s];
        const on = value === s;
        return (
          <label
            key={s}
            className={`cursor-pointer rounded-xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
              on ? `${c.ring} ${c.fill}` : 'border-line hover:border-[color-mix(in_srgb,var(--fog-400)_60%,transparent)]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input type="radio" name="side" className="sr-only" checked={on} onChange={() => onChange(s)} />
            <span className={`font-display flex items-center gap-2 text-xl ${c.ink}`}>
              <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border-2 ${on ? c.ring : 'border-line'}`}>
                {on && <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />}
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
