'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, LoadState, PageHeader, Stepper } from '@/components/ui';
import { adminApi, type PublicQueueItem } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { caseFileHref, reportLabel, reviewHref, reviewQueueKey } from './reviewMeta';
import { SourceBadge } from './ReviewQueue';

/**
 * Approved versions, the ones that can be published. The backend has no list of open publication sign-offs, so this
 * page starts from the review queue and sends the reviewer to the case file, where the sign-off is requested.
 */
export function PublishList() {
  const queue = useQuery({
    queryKey: reviewQueueKey,
    queryFn: () => adminApi.publicQueue(),
    refetchInterval: 15_000,
  });
  return (
    <main className="py-8 sm:py-10">
      <PageHeader
        title="Publish onchain"
        description="Approved versions can go onchain. Request the sign-off from the case file; you’ll confirm it in World App."
      />
      <Stepper
        className="mb-8 max-w-xl"
        label="Reviewer journey"
        steps={[
          { label: 'Review', state: 'done' },
          { label: 'Publish (World ID)', state: 'current' },
          { label: 'Onchain', state: 'todo' },
        ]}
      />
      <LoadState
        query={queue}
        source="Review API"
        skeleton={<div className="sweep h-24 rounded-xl" aria-label="Loading approved reports" />}
      >
        {(d) => <PublishView items={d.items} />}
      </LoadState>
      <p className="text-muted mt-8 text-sm">
        There’s no list of open sign-off requests yet; each one opens on its own page from the case file.
      </p>
    </main>
  );
}

export function PublishView({ items }: { items: PublicQueueItem[] }) {
  const approved = items.filter((i) => i.state === 'approved').sort((a, b) => b.created - a.created);
  if (!approved.length)
    return (
      <EmptyState pose="thinking" title="Nothing approved yet">
        Approve a report in the queue first.{' '}
        <Link href="/admin" className="text-beam-ink underline underline-offset-4">
          Go to the queue
        </Link>
      </EmptyState>
    );
  return (
    <ul className="space-y-3">
      {approved.map((item) => {
        const l = reportLabel(item.report_id, item.report_version, item.report_sha256);
        return (
          <li key={`${item.report_id}@${item.report_version}`} className="glass flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-lg font-semibold">{l.name}</span>
                <SourceBadge source={l.source} />
              </p>
              <p className="text-muted num mt-1 truncate text-[13px]">
                {item.report_version} · added {formatDate(item.created)}
              </p>
            </div>
            {l.source === 'reference' ? (
              <span className="text-muted text-sm">Reference reports are display-only and never go onchain.</span>
            ) : (
              <Link
                href={caseFileHref(item.report_id, item.report_version)}
                className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
              >
                Open case file to publish <ArrowRight size={16} aria-hidden />
              </Link>
            )}
            <Link href={reviewHref(item)} className="text-muted hover:text-text text-sm underline underline-offset-4">
              Review
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
