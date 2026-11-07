import { BadgeCheck, CircleDashed, History, XCircle } from 'lucide-react';

export type ReviewKind = 'approved' | 'pending' | 'reference' | 'rejected';

const META: Record<ReviewKind, { short: string; long: string; Icon: typeof BadgeCheck; cls: string }> = {
  approved: {
    short: 'Approved by a verified human',
    long: 'Approved by a verified human with World ID',
    Icon: BadgeCheck,
    cls: 'text-clue-ink border-[color-mix(in_srgb,var(--clue-500)_45%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_12%,transparent)]',
  },
  pending: {
    short: 'Pending review',
    long: 'Pending review',
    Icon: CircleDashed,
    cls: 'text-ghost-ink border-[color-mix(in_srgb,var(--ghost-300)_45%,transparent)] bg-[color-mix(in_srgb,var(--ghost-300)_12%,transparent)]',
  },
  reference: {
    short: 'Historical reference — unreviewed',
    long: 'Historical reference — unreviewed',
    Icon: History,
    cls: 'text-beam-ink border-[color-mix(in_srgb,var(--beam-400)_55%,transparent)] bg-[color-mix(in_srgb,var(--beam-400)_12%,transparent)]',
  },
  rejected: {
    short: 'Not approved',
    long: 'Not approved by the reviewer',
    Icon: XCircle,
    cls: 'text-muted border-line border-dashed',
  },
};

/** Review state as icon + words. The label only repeats what the backend says; the UI never decides approval. */
export function ReviewBadge({ kind, long = false, label }: { kind: ReviewKind; long?: boolean; label?: string }) {
  const m = META[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}
    >
      <m.Icon size={13} aria-hidden />
      {label ?? (long ? m.long : m.short)}
    </span>
  );
}

/** Maps a backend review status string to a badge kind. Only an explicit approval reads as approved. */
export function reviewKindOf(status: string | null | undefined): ReviewKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'approved' || s === 'published') return 'approved';
  if (s === 'rejected' || s === 'denied' || s === 'expired') return 'rejected';
  return 'pending';
}
