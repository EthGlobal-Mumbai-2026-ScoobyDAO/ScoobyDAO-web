'use client';

import { AlertTriangle, CircleCheck, CircleDashed, CircleSlash } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { READER_ERROR_TEXT, readerErrorKind } from '@/lib/referenceApi';

const STATUS: Record<string, { text: string; Icon: typeof CircleCheck; cls: string }> = {
  complete: { text: 'Complete', Icon: CircleCheck, cls: 'text-clue-ink' },
  partial: { text: 'Partial', Icon: CircleDashed, cls: 'text-beam-ink' },
  unavailable: { text: 'Unavailable', Icon: CircleSlash, cls: 'text-mask-ink' },
};
export function PillarStatus({ status }: { status: string | null | undefined }) {
  const s = (status && STATUS[status]) || {
    text: status ? `Status: ${status}` : 'Status unknown',
    Icon: AlertTriangle,
    cls: 'text-muted',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${s.cls}`}>
      <s.Icon size={16} aria-hidden /> {s.text}
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
