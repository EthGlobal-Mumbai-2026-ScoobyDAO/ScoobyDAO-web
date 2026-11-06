'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, History } from 'lucide-react';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { Identicon } from '@/components/Identicon';
import { chainName } from '@/lib/explorer';
import { shortHex } from '@/lib/format';
import {
  REFERENCE_PAIRS,
  allowedCaseActions,
  isReferenceItem,
  referenceReaderHref,
  reviewStateText,
  snapshotExpired,
  toReferenceCase,
  type PublicCaseItem,
  type ReferenceCase,
} from '@/lib/reference';
import { publicCasesUrl, referenceApi } from '@/lib/referenceApi';
import { utcStamp } from '@/lib/referenceData';

export function selectReferenceCases(items: PublicCaseItem[]) {
  const refs = items.map(toReferenceCase).filter((c): c is ReferenceCase => !!c);
  const order = (c: ReferenceCase) => REFERENCE_PAIRS.indexOf(c.pair);
  refs.sort((a, b) => order(a) - order(b));
  const unpinned = items.filter((i) => isReferenceItem(i) && !toReferenceCase(i)).length;
  return { refs, unpinned };
}

/** Historical reference cases from the public case list. Display only: each card's one action is "Read report". */
export function ReferenceCases() {
  const cases = useQuery({
    queryKey: ['public-cases', publicCasesUrl],
    queryFn: () => referenceApi.cases(),
    enabled: !!publicCasesUrl,
    retry: 1,
    refetchInterval: 60_000,
  });
  if (!publicCasesUrl) return null;
  return (
    <section aria-labelledby="refs-h" className="mt-8">
      <h2 id="refs-h" className="font-display text-2xl">
        Historical reference cases
      </h2>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        Six earlier research cases replayed from captured evidence. They are unreviewed, have no
        World ID or case-gate approval, and cannot start an investigation, a model run or anything
        onchain. Reading a report needs a reviewer’s World ID confirmation for that report.
      </p>
      <div className="mt-4">
        {cases.isError ? (
          <Banner tone="warning" title="Reference cases unavailable">
            {cases.error.message}
          </Banner>
        ) : !cases.data ? (
          <div
            className="sweep h-40 rounded-xl"
            aria-busy="true"
            aria-label="Loading reference cases"
          />
        ) : (
          <ReferenceCaseList {...selectReferenceCases(cases.data)} />
        )}
      </div>
    </section>
  );
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
        <Banner tone="info" title="No reference cases installed">
          The backend lists none of the six historical reference cases.
        </Banner>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {refs.map((c) => (
            <li key={c.pair.case_id}>
              <ReferenceCaseCard c={c} now={now} />
            </li>
          ))}
        </ul>
      )}
      {unpinned > 0 && (
        <p className="text-muted mt-3 text-xs">
          {unpinned} other reference {unpinned === 1 ? 'item is' : 'items are'} not shown: the
          binding differs from the six-reference table.
        </p>
      )}
    </>
  );
}

export function ReferenceCaseCard({ c, now }: { c: ReferenceCase; now?: number }) {
  const id = c.item.identity ?? {};
  const expired = snapshotExpired(c.expiresAt, now);
  // Reference cases never offer agent, World-attempt, investigation, refresh or onchain actions.
  const actions = allowedCaseActions(c.item);
  return (
    <article
      className="paper-plain flex h-full flex-col gap-3 p-4"
      aria-labelledby={`ref-${c.pair.case_id}`}
      data-actions={actions.length}
    >
      <p className="border-line inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
        <History size={14} aria-hidden /> {c.label}
      </p>
      <div className="flex items-start gap-3">
        <Identicon address={id.address ?? c.pair.candidate_id} size={44} />
        <div className="min-w-0">
          <h3 id={`ref-${c.pair.case_id}`} className="text-lg font-semibold">
            {id.symbol ?? c.pair.symbol}
          </h3>
          <p className="text-muted text-xs">
            {id.chain_id ? chainName(id.chain_id) : 'Chain unknown'}
            {id.address ? <span className="num"> · {shortHex(id.address, 6, 4)}</span> : null}
          </p>
        </div>
      </div>
      {c.summary && (
        <p className="text-sm">
          <span className="text-muted">Why it is a case: </span>
          {c.summary}
        </p>
      )}
      {c.routing && (
        <p className="text-sm">
          <span className="text-muted">Routing: </span>
          {c.routing}
        </p>
      )}
      {c.uncertainties.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted cursor-pointer">
            Uncertainties ({c.uncertainties.length})
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {c.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-muted text-xs">
        {expired
          ? `Snapshot expired (${utcStamp(c.expiresAt)}): evidence is historical, not current.`
          : 'Snapshot not yet expired.'}
      </p>
      <div className="mt-auto space-y-2 pt-2">
        {c.reports.map((r) => (
          <div key={`${r.report_id}@${r.report_version}`} className="space-y-2">
            <p className="text-muted text-xs">
              {reviewStateText(r.review_state)} ·{' '}
              {r.world_verified ? 'World ID verified (backend)' : 'no World ID approval'} ·{' '}
              {r.gate_effect === 'none' ? 'no gate effect' : `gate effect: ${r.gate_effect}`}
            </p>
            <Link
              href={referenceReaderHref(r)}
              className="bg-beam text-on-beam inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-105"
              aria-label={`Read report ${r.report_id} ${r.report_version}`}
            >
              <BookOpen size={16} aria-hidden /> Read report
            </Link>
          </div>
        ))}
        {c.reports.length === 0 && (
          <p className="text-mask-ink text-xs">
            {c.mismatched.length
              ? 'Report link withheld: the listed report does not match the reference table.'
              : 'No report is linked to this case.'}
          </p>
        )}
      </div>
    </article>
  );
}
