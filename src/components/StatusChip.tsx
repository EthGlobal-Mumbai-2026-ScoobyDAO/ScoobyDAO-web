import { Ban, CircleCheck, FileText, Flashlight, Hourglass, Search, Undo2 } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CaseStatus } from '@/lib/status';
import { MaskOffIcon, TrapIcon } from './icons';

type Tone = 'fog' | 'ghost' | 'dim' | 'clue' | 'mask' | 'beam' | 'cleared';

/** THEME.md §2.3. Every status has colour + icon + label; colour is never the only signal. */
export const STATUS_META: Record<
  CaseStatus,
  { label: string; reason?: string; tone: Tone; Icon: ComponentType<{ size?: number }> }
> = {
  draft: { label: 'Case file', tone: 'fog', Icon: FileText },
  awaiting_approval: { label: 'Awaiting a human', tone: 'ghost', Icon: Search },
  denied: { label: 'No case opened', reason: 'Denied', tone: 'dim', Icon: Ban },
  expired: { label: 'No case opened', reason: 'Expired', tone: 'dim', Icon: Hourglass },
  Open: { label: 'Case open', tone: 'clue', Icon: Flashlight },
  Frozen: { label: 'Trap sprung — frozen', tone: 'mask', Icon: TrapIcon },
  ResolvedPass: { label: 'Unmasked', tone: 'beam', Icon: MaskOffIcon },
  ResolvedFail: { label: 'Cleared', tone: 'cleared', Icon: CircleCheck },
  Refunded: { label: 'Refunded', tone: 'fog', Icon: Undo2 },
};

const TONE_CLASS: Record<Tone, string> = {
  fog: 'text-muted border-line bg-[color-mix(in_srgb,var(--fog-400)_12%,transparent)]',
  dim: 'text-muted border-dashed border-line bg-transparent',
  ghost:
    'text-ghost-ink border-[color-mix(in_srgb,var(--ghost-300)_45%,transparent)] bg-[color-mix(in_srgb,var(--ghost-300)_12%,transparent)]',
  clue: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_45%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_12%,transparent)]',
  mask: 'text-mask-ink border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_14%,transparent)]',
  beam: 'text-beam-ink border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_14%,transparent)]',
  cleared: 'text-text border-line bg-[color-mix(in_srgb,var(--fog-100)_8%,transparent)]',
};

export function StatusChip({ status, size = 'md' }: { status: CaseStatus; size?: 'md' | 'lg' }) {
  const { label, reason, tone, Icon } = STATUS_META[status];
  const big = size === 'lg';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        big ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs'
      } ${TONE_CLASS[tone]}`}
    >
      <Icon size={big ? 18 : 14} />
      {reason && <span>{reason}:</span>}
      <span>{label}</span>
    </span>
  );
}
