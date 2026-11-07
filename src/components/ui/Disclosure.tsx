import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/** Native <details> with a consistent summary row. Keyboard and screen-reader behaviour come from the browser. */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={`group ${className}`} open={defaultOpen}>
      <summary className="text-muted hover:text-text flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={16}
          aria-hidden
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * Hashes, contract names and addresses, roles, the deployment check and raw ids. Collapsed by default so consumer
 * views lead with the summary.
 */
export function TechnicalDetails({
  children,
  title = 'Technical details',
  defaultOpen,
  className = '',
}: {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`group border-line rounded-[14px] border border-dashed px-5 py-3 ${className}`}
      open={defaultOpen}
      data-technical-details
    >
      <summary className="text-muted hover:text-text flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          size={16}
          aria-hidden
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-3 pb-2 text-sm">{children}</div>
    </details>
  );
}
