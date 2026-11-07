import { PILLARS } from '@/lib/referenceData';

const DOT: Record<string, { cls: string; word: string }> = {
  complete: { cls: 'bg-clue border-clue', word: 'complete' },
  partial: { cls: 'border-beam bg-[linear-gradient(90deg,var(--beam-400)_50%,transparent_50%)]', word: 'partial' },
  unavailable: { cls: 'border-mask bg-transparent border-dashed', word: 'unavailable' },
};

/** Five-dot pillar mini-status. Each dot has a title and the row has a full text label, so colour is not the only signal. */
export function PillarDots({ statuses }: { statuses: Partial<Record<string, string | null | undefined>> }) {
  const known = PILLARS.filter(([k]) => statuses[k]);
  if (!known.length) return null;
  const summary = PILLARS.map(([k, l]) => `${l}: ${DOT[statuses[k] ?? '']?.word ?? statuses[k] ?? 'unknown'}`).join('; ');
  const complete = PILLARS.filter(([k]) => statuses[k] === 'complete').length;
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`Pillars — ${summary}`} title={summary}>
      <span className="inline-flex gap-1" aria-hidden>
        {PILLARS.map(([k]) => (
          <span
            key={k}
            className={`inline-block h-2.5 w-2.5 rounded-full border ${DOT[statuses[k] ?? '']?.cls ?? 'border-line'}`}
          />
        ))}
      </span>
      <span className="text-muted text-xs" aria-hidden>
        {complete}/5 pillars complete
      </span>
    </span>
  );
}
