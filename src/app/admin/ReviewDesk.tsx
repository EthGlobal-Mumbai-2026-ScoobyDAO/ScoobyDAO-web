'use client';

import { ReviewQueue } from '@/components/admin/ReviewQueue';

export function ReviewDesk() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="font-display text-4xl sm:text-5xl">Review desk</h1>
        <p className="text-muted mt-2 max-w-2xl">
          Reports waiting for review. Press Read and confirm with World ID to open one; each
          confirmation opens only that report. Only approved versions appear in the public report
          library.
        </p>
      </header>
      <ReviewQueue />
    </main>
  );
}
