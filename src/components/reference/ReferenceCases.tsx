'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, ClipboardCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { tilt } from '@/components/cases/CaseCard';
import { Identicon } from '@/components/Identicon';
import { StatusChip } from '@/components/StatusChip';
import { chainName } from '@/lib/explorer';
import { formatDate } from '@/lib/format';
import { ReferenceChip } from './ReferenceChip';
import {
  REFERENCE_PAIRS,
  allowedCaseActions,
  isReferenceItem,
  openQuestions,
  referenceStatus,
  reviewWorkspaceHref,
  scoutFindings,
  snapshotExpired,
  toReferenceCase,
  type PublicCaseItem,
  type ReferenceCase,
} from '@/lib/reference';
import { publicCasesUrl, referenceApi } from '@/lib/referenceApi';

export function selectReferenceCases(items: PublicCaseItem[]) {
  const refs = items.map(toReferenceCase).filter((c): c is ReferenceCase => !!c);
  const order = (c: ReferenceCase) => REFERENCE_PAIRS.indexOf(c.pair);
  refs.sort((a, b) => order(a) - order(b));
  const unpinned = items.filter((i) => isReferenceItem(i) && !toReferenceCase(i)).length;
  return { refs, unpinned };
}

/** Scouted cases from the public case list, for the case board's docket. */
export function useReferenceCases() {
  return useQuery({
    queryKey: ['public-cases', publicCasesUrl],
    queryFn: async () => selectReferenceCases(await referenceApi.cases()),
    enabled: !!publicCasesUrl,
    retry: 1,
    refetchInterval: 60_000,
  });
}

export function ReferenceCaseList({
  refs,
  unpinned,
  now,
}: {
  refs: ReferenceCase[];
  unpinned: number;
  now?: number;
}) {
  return (
    <>
      {refs.length === 0 ? (
        <Banner tone="info" title="No scouted cases">
          The backend lists no scouted cases yet.
        </Banner>
      ) : (
        <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {refs.map((c) => (
            <li key={c.pair.case_id}>
              <ReferenceCaseCard c={c} now={now} />
            </li>
          ))}
        </ul>
      )}
      {unpinned > 0 && (
        <p className="text-muted mt-3 text-xs">
          {unpinned} other {unpinned === 1 ? 'item is' : 'items are'} not shown: the binding differs
          from the pinned report table.
        </p>
      )}
    </>
  );
}

/** A scouted case pinned to the docket. Display only: its one action is "Review report" in the review desk. */
export function ReferenceCaseCard({ c }: { c: ReferenceCase; now?: number }) {
  const id = c.item.identity ?? {};
  // Scouted cases never offer agent, World-attempt, investigation, refresh or onchain actions.
  const actions = allowedCaseActions(c.item);
  const { flagged, clear } = scoutFindings(c.summary);
  const questions = openQuestions(c);
  const scouted = c.fetchedAt ? Date.parse(c.fetchedAt) : NaN;
  return (
    <article
      className="paper-plain group relative flex h-full flex-col p-5 pt-6 transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none"
      style={{ transform: `rotate(${tilt(c.pair.case_id)}deg)` }}
      aria-labelledby={`ref-${c.pair.case_id}`}
      data-actions={actions.length}
    >
      <span
        aria-hidden
        className="bg-mask absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.4)]"
      />
      <div className="flex items-start gap-3">
        <Identicon address={id.address ?? c.pair.candidate_id} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h3 id={`ref-${c.pair.case_id}`} className="text-lg leading-tight font-semibold">
              {id.symbol ?? c.pair.symbol}
            </h3>
            <StatusChip status={referenceStatus(c)} />
          </div>
          <p className="text-muted mt-0.5 text-[13px]">
            {id.chain_id ? chainName(id.chain_id) : 'Chain unknown'}
            {Number.isFinite(scouted) && <> · scouted {formatDate(Math.floor(scouted / 1000))}</>}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-muted text-[13px] font-medium">Why Sniff flagged it</p>
        {flagged.length + clear.length > 0 ? (
          <ul
            className="mt-1.5 flex max-h-[3.6rem] flex-wrap gap-1.5 overflow-hidden"
            title={c.summary ?? undefined}
            aria-label="Scout findings from token-security provider data"
          >
            {flagged.map((f) => (
              <li
                key={f}
                className="text-mask-ink inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--mask-500)_55%,transparent)] bg-[color-mix(in_srgb,var(--mask-500)_12%,transparent)] px-2 py-0.5 text-xs font-medium"
              >
                <TriangleAlert size={12} aria-hidden /> {f}
              </li>
            ))}
            {clear.map((f) => (
              <li
                key={f}
                className="border-line text-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                <CircleCheck size={12} aria-hidden /> {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 line-clamp-2 text-[15px]" title={c.summary ?? undefined}>
            No contract flags raised; picked for a five-pillar review.
          </p>
        )}
      </div>

      {questions.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="text-muted hover:text-text cursor-pointer">
            Open questions ({questions.length})
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {questions.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-line mt-auto border-t pt-4">
        <div className="mt-0 flex flex-wrap items-center gap-2">
          <ReferenceChip>
            <strong className="block">Historical reference</strong>
            <span className="text-muted mt-1 block">
              {c.routing ?? 'A replay of captured evidence, kept for comparison.'}
            </span>
            {snapshotExpired(c.expiresAt) && (
              <span className="text-muted mt-1 block">The captured snapshot has expired.</span>
            )}
            <span className="text-muted mt-1 block">Flags come from token-security provider data.</span>
          </ReferenceChip>
        </div>
        <div className="mt-3">
          {c.reports.map((r) => (
            <Link
              key={`${r.report_id}@${r.report_version}`}
              href={reviewWorkspaceHref(r)}
              className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
              aria-label={`Review report ${r.report_id} ${r.report_version} in the review desk`}
            >
              <ClipboardCheck size={16} aria-hidden /> Review report
            </Link>
          ))}
          {c.reports.length === 0 && (
            <p className="text-mask-ink text-xs">
              {c.mismatched.length
                ? 'Report link withheld: the listed report does not match the pinned report table.'
                : 'No report is linked to this case.'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
