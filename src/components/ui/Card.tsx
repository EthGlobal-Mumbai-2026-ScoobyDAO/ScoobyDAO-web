import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'paper' | 'highlight';

const VARIANT: Record<CardVariant, string> = {
  default: 'glass',
  paper: 'paper-plain rounded-xl',
  highlight:
    'rounded-[14px] border border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_8%,var(--surface))]',
};

/** A surface with 20–24px padding. `paper` is the case-file stock; `highlight` marks the one thing to act on. */
export function Card({
  variant = 'default',
  title,
  actions,
  children,
  className = '',
  padded = true,
  ...rest
}: {
  variant?: CardVariant;
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <div className={`${VARIANT[variant]} ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/** A big number with a small label. */
export function StatTile({
  label,
  value,
  hint,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass p-5 ${className}`}>
      <p className="text-muted text-[13px]">{label}</p>
      <p className="num mt-1 text-2xl font-semibold sm:text-3xl">{value}</p>
      {hint && <p className="text-muted mt-1 text-[13px]">{hint}</p>}
    </div>
  );
}

/** Label/value rows. Values wrap; long hashes should use HashText. */
export function KeyValue({
  items,
  className = '',
}: {
  items: { label: ReactNode; value: ReactNode; key?: string }[];
  className?: string;
}) {
  return (
    <dl className={`divide-line divide-y text-[15px] ${className}`}>
      {items.map((it, i) => (
        <div
          key={it.key ?? i}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
        >
          <dt className="text-muted">{it.label}</dt>
          <dd className="min-w-0 text-right break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
