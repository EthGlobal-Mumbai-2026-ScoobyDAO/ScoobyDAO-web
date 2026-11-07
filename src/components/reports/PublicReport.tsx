'use client';

import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { GatedReferenceReader } from '@/components/reference/ReferenceReader';
import { EmptyState, Page } from '@/components/ui';
import { adminToken, reportKey } from '@/lib/adminToken';
import { pairForReport, reviewWorkspaceHref } from '@/lib/reference';
import { Reports } from './Reports';

/**
 * Public route for one report version. Backend reports (public /reports API) render as usual. The six historical
 * references are served only under the review desk's per-report World ID session (reference-display contract), so
 * without that session this page says so and links to the review desk instead of fetching anything.
 */
export function PublicReport({ id, version }: { id: string; version: string }) {
  const pair = pairForReport(id, version);
  const key = reportKey(id, version);
  const hasSession = useSyncExternalStore(
    adminToken.subscribe,
    () => !!adminToken.get(key),
    () => false,
  );
  if (!pair) return <Reports id={`${id}~${version}`} />;
  return (
    <Page>
      <Link
        href="/reports"
        className="text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={14} aria-hidden /> All reports
      </Link>
      {hasSession ? (
        <GatedReferenceReader id={id} version={version} />
      ) : (
        <ReviewersOnly id={id} version={version} symbol={pair.symbol} />
      )}
    </Page>
  );
}

export function ReviewersOnly({ id, version, symbol }: { id: string; version: string; symbol: string }) {
  return (
    <EmptyState
      pose="shrug"
      title="Available to reviewers only"
      action={
        <Link
          href={reviewWorkspaceHref({ report_id: id, report_version: version })}
          className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
        >
          <ClipboardCheck size={16} aria-hidden /> Open in review desk
        </Link>
      }
    >
      The {symbol} reference report opens only with a reviewer’s World ID session for now.
    </EmptyState>
  );
}
