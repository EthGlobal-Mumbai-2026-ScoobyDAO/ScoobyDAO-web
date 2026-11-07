'use client';

import { useQueries } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { formatDate } from '@/lib/format';
import type { WebReport } from '@/lib/types';
import type { Phase } from '@/protocol';
import type { ReportChoice } from '@/protocol/reportDiscovery';
import { protocolForReport } from '@/protocol/reportProtocol';
import { choiceKey } from './MarketContext';
import { marketName } from './marketName';

/** One line under a market's name when its phase hasn't been read yet. */
export function choiceHint(c: ReportChoice): string {
  if (!c.tradable) return 'Market setup pending';
  return `Stakes lock ${formatDate(c.lockTime)}`;
}

/** Card-list popover for switching markets. Phases load only when it opens. */
export function MarketPicker({
  choices,
  current,
  currentPhase,
  links,
}: {
  choices: ReportChoice[];
  current: string;
  currentPhase?: Phase;
  links: Map<string, WebReport>;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const phases = useQueries({
    queries: choices.map((c) => {
      const p = protocolForReport(c);
      return {
        queryKey: ['protocol', 'v2', 'picker-phase', choiceKey(c)],
        queryFn: async () => (await p!.getMarket(BigInt(c.id))).phase,
        enabled: open && !!p && choiceKey(c) !== current,
        staleTime: 60_000,
        retry: false,
      };
    }),
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const cur = choices.find((c) => choiceKey(c) === current);
  return (
    <div ref={wrap} className="relative inline-block max-w-full">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="border-line bg-surface hover:border-[var(--fog-400)] inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
      >
        <span className="text-muted">Market</span>
        <span className="truncate">{cur ? marketName({ id: cur.id, deployment: cur.deployment, linked: links.get(current) }) : 'Choose a market'}</span>
        <span className="text-muted">· {choices.length}</span>
        <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={listId}
          className="bg-surface-raised border-line absolute top-full left-0 z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-xl border p-2 shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
        >
          <p className="text-muted px-2 pt-1 pb-2 text-[13px]">Switch market</p>
          <ul className="space-y-1">
            {choices.map((c, i) => {
              const k = choiceKey(c);
              const on = k === current;
              const phase = on ? currentPhase : phases[i]?.data;
              return (
                <li key={k}>
                  <Link
                    href={`/markets/${c.deployment}/${c.id}`}
                    aria-current={on ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${on ? 'border-beam bg-[color-mix(in_srgb,var(--beam-400)_8%,transparent)]' : 'hover:border-line border-transparent hover:bg-[color-mix(in_srgb,var(--fog-400)_8%,transparent)]'}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {on && <Check size={14} aria-hidden className="text-beam-ink shrink-0" />}
                        <span className="truncate">{marketName({ id: c.id, deployment: c.deployment, linked: links.get(k) })}</span>
                      </span>
                      <span className="text-muted block text-[13px]">{choiceHint(c)}</span>
                    </span>
                    {phase ? <StatusChip status={phase} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
