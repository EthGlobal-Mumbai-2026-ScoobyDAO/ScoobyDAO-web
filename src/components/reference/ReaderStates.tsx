'use client';

import { AlertTriangle, CircleCheck, CircleDashed, CircleSlash } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { READER_ERROR_TEXT, readerErrorKind } from '@/lib/referenceApi';

const STATUS: Record<string, { text: string; Icon: typeof CircleCheck; cls: string }> = {
  complete: { text: 'Complete', Icon: CircleCheck, cls: 'text-clue-ink' },
  partial: { text: 'Partial', Icon: CircleDashed, cls: 'text-beam-ink' },
  unavailable: { text: 'Unavailable', Icon: CircleSlash, cls: 'text-mask-ink' },
};
export function PillarStatus({
  status,
  compact = false,
}: {
  status: string | null | undefined;
  /** Icon only, with the status as screen-reader text and a tooltip. */
  compact?: boolean;
}) {
  const s = (status && STATUS[status]) || {
    text: status ? `Status: ${status}` : 'Status unknown',
    Icon: AlertTriangle,
    cls: 'text-muted',
  };
  if (compact)
    return (
      <span className={`inline-flex shrink-0 ${s.cls}`} title={s.text}>
        <s.Icon size={14} aria-hidden />
        <span className="sr-only">{s.text}</span>
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/40 px-2.5 py-0.5 text-sm font-semibold ${s.cls}`}
    >
      <s.Icon size={15} aria-hidden /> {s.text}
    </span>
  );
}

export function ErrorState({ error, what }: { error: unknown; what?: string }) {
  const kind = readerErrorKind(error);
  const t = READER_ERROR_TEXT[kind];
  return (
    <Banner
      tone={kind === 'integrity' ? 'danger' : 'warning'}
      title={what ? `${what}: ${t.title.toLowerCase()}` : t.title}
    >
      {t.body}
      {error instanceof Error && error.message ? (
        <span className="text-muted mt-1 block text-xs">{error.message}</span>
      ) : null}
    </Banner>
  );
}
