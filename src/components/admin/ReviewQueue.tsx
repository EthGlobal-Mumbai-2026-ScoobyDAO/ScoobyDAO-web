'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Hourglass,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, InfoTip, LoadState, Tabs, tabPanelProps } from '@/components/ui';
import { Digest } from '@/components/ui/WorldConfirm';
import { adminApi, REVIEW_STATE_LABEL, type PublicQueueItem, type ReviewState } from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import {
  filterQueue,
  QUEUE_TAB_LABEL,
  reportLabel,
  reviewHref,
  reviewQueueKey,
  tabCounts,
  type QueueTab,
} from './reviewMeta';

export { reviewHref, reviewQueueKey };

const STATE_ICON: Record<ReviewState, typeof Hourglass> = {
  pending_review: Hourglass,
  awaiting_confirmation: Hourglass,
  approved: CheckCircle2,
  rejected: XCircle,
  revision_requested: RotateCcw,
  unavailable: AlertOctagon,
};
const STATE_TONE: Record<ReviewState, string> = {
  pending_review: 'text-ghost-ink',
  awaiting_confirmation: 'text-ghost-ink',
  approved: 'text-clue-ink',
  rejected: 'text-mask-ink',
  revision_requested: 'text-beam-ink',
  unavailable: 'text-mask-ink',
};

export function ReviewStateChip({ state }: { state: ReviewState }) {
  const I = STATE_ICON[state];
  return (
    <span
      className={`border-line inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap ${STATE_TONE[state]}`}
    >
      <I size={14} aria-hidden />
      {REVIEW_STATE_LABEL[state]}
    </span>
  );
}

export function SourceBadge({ source }: { source: 'reference' | 'generated' }) {
  return (
    <span className="border-line text-muted inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      {source === 'reference' ? 'Reference' : 'Generated'}
    </span>
  );
}

const TABS_ORDER: QueueTab[] = ['waiting', 'approved', 'rejected', 'revision', 'unavailable'];

/**
 * Every installed report version with its review state (anonymous list, no report contents). Review opens one report
 * through its own World confirmation.
 */
export function ReviewQueue({ initialTab = 'waiting' }: { initialTab?: QueueTab }) {
  const queue = useQuery({
    queryKey: reviewQueueKey,
    queryFn: () => adminApi.publicQueue(),
    refetchInterval: 15_000,
  });
  return (
    <LoadState
      query={queue}
      source="Review API"
      skeleton={
        <div className="space-y-3" aria-label="Loading the review queue">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sweep h-20 rounded-xl" />
          ))}
        </div>
      }
    >
      {(data) => <QueueView items={data.items} initialTab={initialTab} />}
    </LoadState>
  );
}

export function QueueView({ items, initialTab = 'waiting' }: { items: PublicQueueItem[]; initialTab?: QueueTab }) {
  const [tab, setTab] = useState<QueueTab>(initialTab);
  const [search, setSearch] = useState('');
  const counts = tabCounts(items);
  const tabs = TABS_ORDER.filter((t) => t !== 'unavailable' || counts.unavailable > 0).map((t) => ({
    key: t,
    label: QUEUE_TAB_LABEL[t],
    count: counts[t],
  }));
  const shown = filterQueue(items, tab, search);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs id="queue" label="Review state" items={tabs} value={tab} onChange={setTab} className="min-w-0 flex-1" />
        <label className="border-line bg-surface flex w-full items-center gap-2 rounded-xl border px-3 py-2 sm:w-72">
          <Search size={16} aria-hidden className="text-muted" />
          <span className="sr-only">Search reports</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, id or version"
            className="w-full bg-transparent text-[15px] outline-none"
          />
        </label>
      </div>
      <div {...tabPanelProps('queue', tab)}>
        {!shown.length ? (
          <EmptyState
            pose="thinking"
            title={search ? 'No matches' : items.length ? `Nothing ${QUEUE_TAB_LABEL[tab].toLowerCase()}` : 'No reports yet'}
          >
            {search
              ? 'Try a symbol, report id or version.'
              : items.length
                ? 'Reports move here when a reviewer records a decision.'
                : 'Reports appear here as soon as the backend installs them.'}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {shown.map((item) => (
              <QueueRow key={`${item.report_id}@${item.report_version}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function QueueRow({ item }: { item: PublicQueueItem }) {
  const l = reportLabel(item.report_id, item.report_version, item.report_sha256);
  return (
    <li className="glass flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-semibold">{l.name}</span>
          {l.chain && <span className="text-muted text-sm">on {l.chain}</span>}
          <SourceBadge source={l.source} />
        </p>
        <p className="text-muted mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="num truncate" title={item.report_version}>
            {item.report_version}
          </span>
          <span aria-hidden>·</span>
          <span>Added {formatDate(item.created)}</span>
          <InfoTip label={`Technical details for ${l.name}`}>
            <span className="block">
              <span className="text-muted">Report id</span>{' '}
              <code className="num break-all">{item.report_id}</code>
            </span>
            <span className="mt-1 block">
              <span className="text-muted">Report SHA-256</span>{' '}
              <Digest value={item.report_sha256} label="report SHA-256" />
            </span>
          </InfoTip>
        </p>
      </div>
      <ReviewStateChip state={item.state} />
      <Link
        href={reviewHref(item)}
        className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
        aria-label={`Review ${l.name} ${item.report_version}`}
      >
        Review <ArrowRight size={16} aria-hidden />
      </Link>
    </li>
  );
}
