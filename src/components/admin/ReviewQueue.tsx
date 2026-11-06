'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { adminApi, REVIEW_STATE_LABEL, type PublicQueueItem } from '@/lib/adminApi';

export const reviewQueueKey = ['review-queue'] as const;

export function reviewHref(item: Pick<PublicQueueItem, 'report_id' | 'report_version'>) {
  return `/admin/reviews/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}`;
}

/**
 * Every installed report version with its review state (anonymous list, no report contents). Read opens one report
 * through its own World confirmation.
 */
export function ReviewQueue() {
  const queue = useQuery({
    queryKey: reviewQueueKey,
    queryFn: () => adminApi.publicQueue(),
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
        <li
          key={`${item.report_id}@${item.report_version}`}
          className="glass border-line flex flex-wrap items-center gap-x-6 gap-y-3 p-4"
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
          <span className="text-sm font-semibold">{REVIEW_STATE_LABEL[item.state]}</span>
          <Link
            href={reviewHref(item)}
            className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
            aria-label={`Read ${item.report_id} ${item.report_version}`}
          >
            <BookOpen size={16} aria-hidden /> Read
          </Link>
        </li>
      ))}
    </ul>
  );
}
