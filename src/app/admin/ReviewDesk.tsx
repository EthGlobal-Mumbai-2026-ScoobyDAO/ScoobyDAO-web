'use client';

import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { PageHeader } from '@/components/ui';
import type { QueueTab } from '@/components/admin/reviewMeta';

export function ReviewDesk({ view = 'queue' }: { view?: 'queue' | 'decided' }) {
  const decided = view === 'decided';
  return (
    <main className="py-8 sm:py-10">
      <PageHeader
        title={decided ? 'Case closed?' : 'Fresh leads'}
        description={
          decided
            ? 'Reports a reviewer approved, rejected or sent back. Only approved versions are public.'
            : 'Reports waiting for a human. Each one opens with its own World ID confirmation.'
        }
      />
      <ReviewQueue initialTab={(decided ? 'approved' : 'waiting') satisfies QueueTab} />
    </main>
  );
}
