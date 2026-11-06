import { Ban, CheckCircle2, Hourglass, Info, ShieldAlert } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { TrapIcon } from './icons';

type Tone = 'danger' | 'warning' | 'success' | 'info' | 'frozen' | 'barred';

const TONES: Record<
  Tone,
  { cls: string; Icon: ComponentType<{ size?: number; className?: string }> }
> = {
  danger: {
    cls: 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_14%,transparent)] [--accent:var(--mask-ink)]',
    Icon: Ban,
  },
  frozen: {
    cls: 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_14%,transparent)] [--accent:var(--mask-ink)]',
    Icon: TrapIcon,
  },
  barred: {
    cls: 'border-[color-mix(in_srgb,var(--mask-500)_60%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_10%,transparent)] [--accent:var(--mask-ink)]',
    Icon: ShieldAlert,
  },
  warning: {
    cls: 'border-[color-mix(in_srgb,var(--beam-400)_60%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_12%,transparent)] [--accent:var(--beam-ink)]',
    Icon: Hourglass,
  },
  success: {
    cls: 'border-[color-mix(in_srgb,var(--clue-500)_60%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_12%,transparent)] [--accent:var(--clue-ink)]',
    Icon: CheckCircle2,
  },
  info: {
    cls: 'border-line bg-[color-mix(in_srgb,var(--fog-400)_10%,transparent)] [--accent:var(--text)]',
    Icon: Info,
  },
};

export function Banner({
  tone,
  title,
  children,
  size = 'md',
  icon,
}: {
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  size?: 'md' | 'xl';
  icon?: ComponentType<{ size?: number; className?: string }> | null;
}) {
  const { cls, Icon: DefaultIcon } = TONES[tone];
  const Icon = icon === undefined ? DefaultIcon : icon;
  const xl = size === 'xl';
  return (
    <div
      role={tone === 'danger' || tone === 'frozen' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border ${xl ? 'p-6 sm:p-8' : 'p-4'} ${cls}`}
    >
      {Icon && <Icon size={xl ? 36 : 20} className="mt-0.5 shrink-0 text-[var(--accent)]" />}
      <div className="min-w-0">
        <p
          className={`font-semibold text-[var(--accent)] ${xl ? 'font-display text-2xl leading-tight sm:text-3xl' : ''}`}
        >
          {title}
        </p>
        {children && (
          <div className={`${xl ? 'mt-3 text-lg' : 'mt-1 text-sm'} text-text`}>{children}</div>
        )}
      </div>
    </div>
  );
}
