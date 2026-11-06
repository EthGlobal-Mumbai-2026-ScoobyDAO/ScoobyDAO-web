'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { adminApi, DECISION_LABEL, REVIEW_STATE_LABEL, type QueueItem } from '@/lib/adminApi';

export const reviewQueueKey = ['admin-review-queue'] as const;

export function reviewHref(item: Pick<QueueItem, 'report_id' | 'report_version'>) {
  return `/admin/reviews/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}`;
}

/** Every installed report version, undecided first (backend order). */
export function ReviewQueue() {
  const queue = useQuery({
    queryKey: reviewQueueKey,
    queryFn: () => adminApi.queue(),
    refetchInterval: 15_000,
  });
  if (queue.isError)
    return (
      <Banner tone="danger" title="Couldn't load the review queue">
        {queue.error.message}
      </Banner>
    );
  if (!queue.data)
    return (
      <div
        className="sweep h-40 rounded-xl"
        aria-busy="true"
        aria-label="Loading the review queue"
      />
    );
  const items = queue.data.items;
  if (!items.length)
    return (
      <Banner tone="info" title="No reports to review">
        Reports appear here as soon as the backend installs them.
      </Banner>
    );
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.report_id}@${item.report_version}`}>
          <Link
            href={reviewHref(item)}
            className="glass border-line flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:border-[var(--fog-400)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold break-all">
                {item.report_id}{' '}
                <span className="text-muted font-normal">· {item.report_version}</span>
              </span>
              <span className="text-muted mt-1 block text-sm">
                Report sha256 <code className="num">{item.report_sha256.slice(0, 12)}…</code>
              </span>
            </span>
            <span className="text-sm font-semibold">
              {REVIEW_STATE_LABEL[item.state]}
              {item.decision && item.state !== 'pending_review'
                ? ` · ${DECISION_LABEL[item.decision]}`
                : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
