'use client';

import Link from 'next/link';
import { ErrorState, Page } from '@/components/ui';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page className="grid min-h-[60vh] place-items-center">
      <ErrorState
        source="This page"
        title="Something broke on this page"
        pose="alert"
        onRetry={reset}
        action={
          <Link href="/" className="border-line hover:border-text inline-flex items-center rounded-xl border px-4 py-2 font-semibold">
            Home
          </Link>
        }
        message={<span className="num text-sm">{error.message || 'Unknown error'}</span>}
      />
    </Page>
  );
}
