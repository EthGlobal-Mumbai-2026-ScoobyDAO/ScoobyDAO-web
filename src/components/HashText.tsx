'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Full hash in groups of 4 so it can be read aloud and compared on a projector. */
export function HashText({
  value,
  size = 'md',
  label = 'hash',
}: {
  value: string;
  size?: 'md' | 'xl';
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const body = value.startsWith('0x') ? value.slice(2) : value;
  const groups = body.match(/.{1,4}/g) ?? [];
  return (
    <span className="inline-flex items-start gap-2">
      <code
        className={`num flex flex-wrap gap-x-[0.35em] ${size === 'xl' ? 'text-xl leading-relaxed sm:text-2xl' : 'text-sm'}`}
      >
        {groups.map((g, i) => (
          <span key={i} className={`whitespace-nowrap ${i % 2 ? 'text-muted' : ''}`}>
            {i === 0 && <span className="text-muted">0x</span>}
            {g}
          </span>
        ))}
      </code>
      <button
        type="button"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="text-muted hover:text-text mt-0.5 shrink-0 rounded p-1"
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
    </span>
  );
}
