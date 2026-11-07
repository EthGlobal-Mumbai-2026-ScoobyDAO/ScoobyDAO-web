import type { ReactNode } from 'react';

/** The shared page container: 1200px max, 24px gutters (16px on phones). */
export function Page({
  children,
  className = '',
  as: Tag = 'main',
}: {
  children: ReactNode;
  className?: string;
  as?: 'main' | 'div';
}) {
  return (
    <Tag className={`mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12 ${className}`}>
      {children}
    </Tag>
  );
}

/** Page title block: optional eyebrow, a Bungee title, one line of description, actions and a status chip. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  status,
  className = '',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}
    >
      <div className="max-w-[68ch] min-w-0">
        {eyebrow && <p className="text-muted mb-2 text-sm font-medium">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[2.5rem] leading-none sm:text-[3.25rem]">{title}</h1>
          {status}
        </div>
        {description && <p className="text-muted mt-3 text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
