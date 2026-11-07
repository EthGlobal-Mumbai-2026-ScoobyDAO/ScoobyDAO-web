import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type StepState = 'todo' | 'current' | 'done' | 'failed';

/** Horizontal 3–4 step progress. Each step shows an icon or number plus its label, never colour alone. */
export function Stepper({
  steps,
  label = 'Progress',
  className = '',
}: {
  steps: { label: ReactNode; state: StepState }[];
  label?: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={`flex items-start gap-2 ${className}`}>
      {steps.map((s, i) => {
        const circle =
          s.state === 'done'
            ? 'bg-clue text-[var(--night-900)] border-transparent'
            : s.state === 'failed'
              ? 'bg-mask text-white border-transparent'
              : s.state === 'current'
                ? 'border-beam text-beam-ink'
                : 'border-line text-muted';
        return (
          <li
            key={i}
            aria-current={s.state === 'current' ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-start gap-2"
          >
            <span className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:text-left">
              <span
                className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${circle}`}
              >
                {s.state === 'done' ? (
                  <Check size={14} aria-hidden />
                ) : s.state === 'failed' ? (
                  <X size={14} aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-[13px] leading-tight ${s.state === 'todo' ? 'text-muted' : 'text-text font-medium'}`}
              >
                {s.label}
                <span className="sr-only">
                  {' '}
                  (
                  {s.state === 'done'
                    ? 'done'
                    : s.state === 'failed'
                      ? 'failed'
                      : s.state === 'current'
                        ? 'current step'
                        : 'not started'}
                  )
                </span>
              </span>
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="bg-line mt-3.5 hidden h-px min-w-4 flex-1 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
