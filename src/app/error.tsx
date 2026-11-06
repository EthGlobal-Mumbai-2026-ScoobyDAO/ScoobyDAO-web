'use client';

import { EmptyState } from '@/components/EmptyState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState
        pose="confused"
        title="Something broke on this page"
        action={
          <button
            type="button"
            onClick={reset}
            className="bg-beam text-on-beam rounded-xl px-5 py-3 font-semibold hover:brightness-105"
          >
            Try again
          </button>
        }
      >
        <span className="num text-sm">{error.message || 'Unknown error'}</span>
      </EmptyState>
    </main>
  );
}
