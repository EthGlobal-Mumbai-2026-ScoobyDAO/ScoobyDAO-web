import type { ReactNode } from 'react';

/** A titled block inside a page. Section titles use Inter semibold, not Bungee. */
export function Section({
  id,
  title,
  description,
  actions,
  children,
  className = '',
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-h` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`mt-10 first:mt-0 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-[68ch]">
            {title && (
              <h2 id={headingId} className="text-[1.375rem] font-semibold sm:text-2xl">
                {title}
              </h2>
            )}
            {description && <p className="text-muted mt-1 text-[15px]">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
