'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { canonicalJSON } from '@/lib/canonical';
import type { Manifest } from '@/lib/types';

/** Pretty view for reading; canonical view is the exact string that gets hashed. */
export function ManifestViewer({ manifest }: { manifest: Manifest }) {
  const [mode, setMode] = useState<'pretty' | 'canonical'>('pretty');
  const [copied, setCopied] = useState(false);
  const text =
    mode === 'pretty' ? JSON.stringify(sortDeep(manifest), null, 2) : canonicalJSON(manifest);

  return (
    <div className="border-line overflow-hidden rounded-xl border bg-[#0e1430] text-[#e8ecff]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a3366] px-3 py-2 text-sm">
        <div role="tablist" aria-label="Manifest view" className="flex gap-1">
          {(['pretty', 'canonical'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 ${mode === m ? 'bg-[#232b5a] text-white' : 'text-[#9ba5d0] hover:text-white'}`}
            >
              {m === 'pretty' ? 'Readable' : 'Canonical (hashed)'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(canonicalJSON(manifest));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[#9ba5d0] hover:text-white"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy canonical JSON'}
        </button>
      </div>
      <pre
        tabIndex={0}
        aria-label={mode === 'pretty' ? 'Manifest JSON' : 'Canonical manifest JSON'}
        className={`num max-h-96 overflow-auto p-4 text-[13px] leading-relaxed ${mode === 'canonical' ? 'break-all whitespace-pre-wrap' : ''}`}
      >
        {mode === 'pretty' ? <Highlighted json={text} /> : text}
      </pre>
    </div>
  );
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
    );
  return v;
}

function Highlighted({ json }: { json: string }) {
  const parts = json.split(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g,
  );
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^".*":$/.test(p.replace(/\s/g, '')))
          return (
            <span key={i} className="text-[#b8a9ff]">
              {p}
            </span>
          );
        if (p.startsWith('"'))
          return (
            <span key={i} className="text-[#7fe0d6]">
              {p}
            </span>
          );
        if (/^(true|false|null|-?\d)/.test(p))
          return (
            <span key={i} className="text-[#ffc857]">
              {p}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
