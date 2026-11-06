import {
  Ban,
  CircleCheck,
  FileText,
  Flashlight,
  Globe2,
  Hourglass,
  Lock,
  Megaphone,
  Search,
  Swords,
  Timer,
  Undo2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { CaseStatus } from '@/lib/status';
import { MaskOffIcon } from './icons';

type Tone = 'fog' | 'ghost' | 'dim' | 'clue' | 'mask' | 'beam' | 'cleared';

/** Every status has colour + icon + label; colour is never the only signal. Inks pass 4.5:1 (scripts/contrast.mjs). */
export const STATUS_META: Record<
  CaseStatus,
  { label: string; tone: Tone; Icon: ComponentType<{ size?: number }>; hint: string }
> = {
  draft: { label: 'Draft', tone: 'fog', Icon: FileText, hint: 'Report filed; no human has approved it.' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'ghost', Icon: Search, hint: 'A reviewer is checking it in World App.' },
  denied: { label: 'Denied', tone: 'dim', Icon: Ban, hint: 'The reviewer declined. No case opened.' },
  expired: { label: 'Expired', tone: 'dim', Icon: Hourglass, hint: 'Nobody approved in time. No case opened.' },
  open: { label: 'Open', tone: 'clue', Icon: Flashlight, hint: 'Stakes open on Ethereum Sepolia and via CCIP.' },
  open_local_only: { label: 'Cross-chain closed', tone: 'clue', Icon: Globe2, hint: 'Only direct stakes on Ethereum Sepolia until lock.' },
  locked: { label: 'Locked', tone: 'ghost', Icon: Lock, hint: 'Stakes are locked; YT accrues simulated yield.' },
  matured: { label: 'Matured', tone: 'beam', Icon: Timer, hint: 'Waiting for the resolver to propose a result.' },
  proposed: { label: 'Proposed', tone: 'beam', Icon: Megaphone, hint: 'Result proposed; challenge window running.' },
  challenged: { label: 'Challenged', tone: 'mask', Icon: Swords, hint: 'The adjudicator decides.' },
  final_yes: { label: 'Final · Yes', tone: 'beam', Icon: MaskOffIcon, hint: 'Unmasked: the claim held.' },
  final_no: { label: 'Final · No', tone: 'cleared', Icon: CircleCheck, hint: 'Case closed — cleared.' },
  void: { label: 'Void', tone: 'fog', Icon: Undo2, hint: 'No verdict; stakes refunded, no fee.' },
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
  const { label, tone, Icon, hint } = STATUS_META[status];
  const big = size === 'lg';
  return (
    <span
      title={hint}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        big ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs'
      } ${TONE_CLASS[tone]}`}
    >
      <Icon size={big ? 18 : 14} />
      <span>{label}</span>
    </span>
  );
}
