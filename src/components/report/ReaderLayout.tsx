'use client';

import { Check, ChevronDown, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Disclosure } from '@/components/ui';

export interface TocItem {
  id: string;
  label: string;
  /** Small trailing marker, e.g. a pillar status icon. */
  marker?: ReactNode;
}

/** Report reader frame: a sticky table of contents on desktop and a collapsible "On this page" list on mobile. */
export function ReaderShell({
  toc,
  header,
  children,
}: {
  toc: TocItem[];
  header: ReactNode;
  children: ReactNode;
}) {
  const links = (
    <ol className="space-y-0.5">
      {toc.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            className="text-muted hover:text-text hover:bg-surface-raised flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm"
          >
            <span>{t.label}</span>
            {t.marker}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      {header}
      <details className="group border-line mt-6 rounded-xl border px-4 py-2 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label="On this page (mobile)" className="mt-2 pb-2">
          {links}
        </nav>
      </details>
      <div className="mt-8 grid gap-8 lg:grid-cols-[208px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-muted mb-2 px-3 text-[13px] font-semibold">On this page</p>
            {links}
          </div>
        </nav>
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    </div>
  );
}

/** One titled block in the reader, offset for the sticky nav bar when jumped to. */
export function ReaderSection({
  id,
  title,
  aside,
  children,
  className = '',
}: {
  id: string;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-28 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-h`} className="text-[1.375rem] font-semibold sm:text-2xl">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Short address with a copy button for the full value. */
export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
  return (
    <span className="inline-flex items-center gap-1">
      <code className="num text-[13px]" title={address}>
        {short}
      </code>
      <button
        type="button"
        aria-label={copied ? 'Address copied' : 'Copy token address'}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="text-muted hover:text-text rounded p-1"
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
    </span>
  );
}

export interface EvidenceRow {
  id: string;
  kind: string | null;
  observed: ReactNode;
  coverage: string | null;
  details?: ReactNode;
}

/** Evidence as a table (id, kind, observed, coverage); paths, hashes and sources sit in a per-row disclosure. */
export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  if (!rows.length) return <p className="text-muted text-sm">No evidence records.</p>;
  return (
    <div className="border-line overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-muted bg-surface-raised text-[13px]">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Evidence
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Kind
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Observed
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Coverage
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.id} id={`evidence-${r.id}`} className="scroll-mt-28 align-top">
              <td className="px-4 py-3">
                <code className="num text-[13px] font-semibold">{r.id}</code>
              </td>
              <td className="text-muted px-4 py-3">{r.kind ? r.kind.replace(/_/g, ' ') : '—'}</td>
              <td className="text-muted px-4 py-3 text-[13px]">{r.observed}</td>
              <td className="px-4 py-3">
                {r.coverage ?? <span className="text-muted">Not stated</span>}
                {r.details && (
                  <Disclosure summary="Details" className="mt-2">
                    <div className="text-muted space-y-1 text-[13px]">{r.details}</div>
                  </Disclosure>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evidence ids cited by a pillar or bullet, as small chips linking to the evidence table. */
export function EvidenceChips({ ids, onSelect }: { ids: string[]; onSelect?: (id: string) => void }) {
  if (!ids.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Evidence cited">
      {ids.map((id) => (
        <li key={id}>
          <a
            href={`#evidence-${id}`}
            onClick={onSelect ? () => onSelect(id) : undefined}
            className="border-line text-beam-ink hover:border-beam num inline-block max-w-full rounded-full border px-2 py-0.5 text-xs break-all"
          >
            {id}
          </a>
        </li>
      ))}
    </ul>
  );
}
