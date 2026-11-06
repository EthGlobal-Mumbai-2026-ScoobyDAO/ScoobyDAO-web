'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ReadGate } from '@/components/admin/AdminGate';
import { Banner } from '@/components/Banner';
import { chainName } from '@/lib/explorer';
import { pairForReport, REFERENCE_LABEL, reviewStateText } from '@/lib/reference';
import { referenceApi, type ReferenceMetadata } from '@/lib/referenceApi';
import {
  PILLARS,
  parseIrc,
  parseLedger,
  parseReport,
  parseTldr,
  safeHttpsUrl,
  utcStamp,
  type Irc,
  type PillarKey,
  type ReportDoc,
  type Tldr,
} from '@/lib/referenceData';
import { ErrorState, PillarStatus } from './ReaderStates';
import { PriceSection, VaeSection, useVerified, type Loaded } from './sections';

const LABEL_TEXT: Record<string, string> = {
  historical: 'Historical',
  unreviewed: 'Unreviewed',
  synthetic_lineage: 'Synthetic lineage',
  uncalibrated_var: 'Uncalibrated VaR',
  snapshot_expired: 'Snapshot expired',
};

const ROLE_TEXT: Record<string, string> = {
  finding: 'Finding',
  interpretation: 'Interpretation',
  caveat: 'Caveat',
};

/** Reader behind this report's own World ID session (the review desk's Read flow). No other sign-in path exists. */
export function GatedReferenceReader({ id, version }: { id: string; version: string }) {
  if (!pairForReport(id, version))
    return (
      <Banner tone="danger" title="Not one of the six reference reports">
        This id and version are not in the historical reference table, so the reference reader does
        not open it. Use the review desk for other reports.
      </Banner>
    );
  return (
    <ReadGate id={id} version={version}>
      {() => <ReferenceReader id={id} version={version} />}
    </ReadGate>
  );
}

export function ReferenceReader({ id, version }: { id: string; version: string }) {
  const meta = useQuery({
    queryKey: ['reference-meta', id, version],
    queryFn: () => referenceApi.metadata(id, version),
    retry: false,
  });
  if (meta.isError) return <ErrorState error={meta.error} />;
  if (!meta.data)
    return (
      <div className="sweep h-48 rounded-xl" aria-busy="true" aria-label="Loading the report" />
    );
  return <ReaderBody meta={meta.data} />;
}

export function ReaderBody({ meta }: { meta: ReferenceMetadata }) {
  const ident = { id: meta.report_id, version: meta.report_version };
  const report = useVerified(meta, 'report.json', (t) =>
    parseReport(t, { ...ident, candidate: meta.candidate_id }),
  );
  const tldr = useVerified(meta, 'pillar-tldr.json', (t) => parseTldr(t, ident));
  const irc = useVerified(meta, 'pillar-irc.json', (t) => parseIrc(t, ident));
  const ledger = useVerified(meta, 'source-ledger.json', parseLedger);
  return (
    <ReaderView
      meta={meta}
      report={report}
      tldr={tldr}
      irc={irc}
      ledger={ledger}
      price={<PriceSection meta={meta} />}
      vae={<VaeSection meta={meta} />}
    />
  );
}

/** Pure view, so it can be rendered from fixtures in tests. */
export function ReaderView({
  meta,
  report,
  tldr,
  irc,
  ledger,
  price,
  vae,
}: {
  meta: ReferenceMetadata;
  report: Loaded<ReportDoc>;
  tldr: Loaded<Tldr>;
  irc: Loaded<Irc>;
  ledger: Loaded<ReturnType<typeof parseLedger>>;
  price: ReactNode;
  vae: ReactNode;
}) {
  const doc = report.data;
  const pending = meta.review_state === 'pending_review';
  const evidence = new Map((doc?.evidence ?? []).map((e) => [e.id, e]));
  const sources = new Map((ledger.data?.sources ?? []).map((s) => [s.id, s]));
  const chain = meta.identity?.chain_id;

  return (
    <article className="min-w-0 space-y-8 [overflow-wrap:anywhere]">
      <Banner
        tone="warning"
        title={
          pending
            ? REFERENCE_LABEL
            : `Historical reference — ${reviewStateText(meta.review_state).toLowerCase()}`
        }
        icon={ShieldAlert}
      >
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Historical replay of captured evidence with synthetic lineage; not a fresh or live
            observation.
          </li>
          <li>{reviewStateText(meta.review_state)}.</li>
          <li>
            {meta.world_verified
              ? 'The backend reports a World ID verification.'
              : 'No World ID approval.'}{' '}
            {meta.gate_effect === 'none'
              ? 'No case-gate approval or qualification.'
              : `Gate effect: ${meta.gate_effect}.`}
          </li>
          <li>Reading this report does not review, approve or publish it.</li>
        </ul>
      </Banner>

      <header className="space-y-3">
        <p className="text-beam-ink text-sm font-semibold tracking-wide uppercase">
          Five-pillar reference report
        </p>
        <h1 className="font-display text-3xl sm:text-4xl">{meta.symbol}</h1>
        <ul className="flex flex-wrap gap-2" aria-label="Labels">
          {meta.labels.map((l) => (
            <li key={l} className="border-line rounded-full border px-3 py-1 text-xs font-semibold">
              {LABEL_TEXT[l] ?? l}
            </li>
          ))}
        </ul>
        {meta.description && <p className="text-muted max-w-3xl">{meta.description}</p>}
        <dl className="text-muted grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          <dt>Token</dt>
          <dd className="num text-text">
            {chain ? chainName(chain) : 'Chain unknown'} · {meta.identity?.address}
          </dd>
          <dt>Case</dt>
          <dd className="num">{meta.case_id}</dd>
          <dt>Report</dt>
          <dd className="num">
            {meta.report_id} · {meta.report_version}
          </dd>
          <dt>Report SHA-256</dt>
          <dd className="num">
            {meta.report_sha256}{' '}
            {report.state === 'ok' ? (
              <span className="text-clue-ink font-semibold">(recomputed, matches)</span>
            ) : report.state === 'error' ? (
              <span className="text-mask-ink font-semibold">(integrity unavailable)</span>
            ) : null}
          </dd>
          <dt>Mode</dt>
          <dd>{meta.mode === 'historical_replay' ? 'Historical replay' : meta.mode}</dd>
        </dl>
      </header>

      {report.state === 'error' ? (
        <ErrorState error={report.error} what="report.json" />
      ) : !doc ? (
        <div className="sweep h-40 rounded-xl" aria-busy="true" aria-label="Checking report.json" />
      ) : (
        <>
          <section aria-labelledby="assessment-h" className="glass space-y-3 p-5">
            <h2 id="assessment-h" className="text-lg font-semibold">
              Proposed research judgment{' '}
              <span className="text-muted text-sm font-normal">(draft, unreviewed)</span>
            </h2>
            {doc.assessment.label && <p className="font-semibold">{doc.assessment.label}</p>}
            {doc.assessment.summary && <p>{doc.assessment.summary}</p>}
            {doc.assessment.unknowns.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">Open questions</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {doc.assessment.unknowns.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <nav
            aria-label="Pillars"
            className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-5"
          >
            {PILLARS.map(([k, label]) => (
              <a
                key={k}
                href={`#pillar-${k}`}
                className="border-line bg-surface hover:border-beam focus-visible:outline-beam block rounded-xl border p-3 focus-visible:outline-2"
              >
                <span className="block text-sm font-semibold">{label}</span>
                <PillarStatus status={doc.pillars[k]?.status ?? meta.pillars[k]?.status} />
              </a>
            ))}
          </nav>

          {PILLARS.map(([k, label]) => (
            <PillarSection
              key={k}
              pillar={k}
              label={label}
              doc={doc}
              meta={meta}
              tldr={tldr}
              irc={irc}
              evidence={evidence}
            >
              {k === 'technical_health' ? price : k === 'statistical_risk' ? vae : null}
            </PillarSection>
          ))}

          <section aria-labelledby="evidence-h" className="space-y-3">
            <h2 id="evidence-h" className="text-2xl font-semibold">
              Evidence and sources
            </h2>
            {ledger.state === 'error' && <ErrorState error={ledger.error} what="Source ledger" />}
            {ledger.state === 'missing' && (
              <p className="text-muted text-sm">Data gap: this report has no source ledger.</p>
            )}
            <ul className="space-y-2">
              {doc.evidence.map((e) => {
                const src = sources.get(e.id);
                const href = safeHttpsUrl(src?.url ?? null);
                const listed = !!(e.path && meta.files[e.path]);
                return (
                  <li
                    key={e.id}
                    id={`evidence-${e.id}`}
                    className="border-line scroll-mt-28 rounded-lg border p-3 text-sm"
                  >
                    <p className="font-semibold">
                      <code className="num">{e.id}</code>
                      {e.kind ? (
                        <span className="text-muted font-normal">
                          {' '}
                          · {e.kind.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </p>
                    {e.coverage && <p className="mt-1">{e.coverage}</p>}
                    <p className="text-muted mt-1 text-xs">
                      Fetched {utcStamp(e.fetched_at)} · observed {utcStamp(e.observed_at)}
                      {e.path ? (
                        <>
                          {' '}
                          · <code className="num">{e.path}</code>{' '}
                          {listed ? '(served with a recorded hash)' : '(not served)'}
                        </>
                      ) : null}
                    </p>
                    {src && (
                      <p className="text-muted mt-1 text-xs">
                        Source
                        {src.transport_mode
                          ? ` (${src.transport_mode.replace(/_/g, ' ')})`
                          : ''}:{' '}
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-beam-ink inline-flex items-center gap-1 underline"
                          >
                            {new URL(href).host} <ExternalLink size={12} aria-hidden />
                          </a>
                        ) : (
                          <span>{src.url ?? 'not supplied'}</span>
                        )}
                      </p>
                    )}
                    {e.limitations.map((l, i) => (
                      <p key={i} className="text-muted mt-1 text-xs">
                        Limitation: {l}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="artifacts-h" className="space-y-2">
            <h2 id="artifacts-h" className="text-xl font-semibold">
              Report files
            </h2>
            <ul className="space-y-1 text-sm">
              {doc.artifacts.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <span className="font-semibold">{a.kind.replace(/_/g, ' ')}</span>:{' '}
                  {a.availability === 'available' && a.path ? (
                    <>
                      available · <code className="num">{a.path}</code>
                      {meta.files[a.path] ? '' : ' (not served by the reader)'}
                    </>
                  ) : (
                    <span className="text-mask-ink">
                      unavailable (not generated for this report)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {doc.limitations.length > 0 && (
            <section aria-labelledby="limits-h" className="space-y-2">
              <h2 id="limits-h" className="text-xl font-semibold">
                Limitations
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {doc.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <footer className="border-line text-muted border-t pt-4 text-sm">
        Review decisions are separate from reading: they are made on the{' '}
        <Link
          href={`/admin/reviews/${encodeURIComponent(meta.report_id)}/${encodeURIComponent(meta.report_version)}`}
          className="text-beam-ink underline"
        >
          review page for this report
        </Link>{' '}
        and each one is confirmed in World App.
      </footer>
    </article>
  );
}

function PillarSection({
  pillar,
  label,
  doc,
  meta,
  tldr,
  irc,
  evidence,
  children,
}: {
  pillar: PillarKey;
  label: string;
  doc: ReportDoc;
  meta: ReferenceMetadata;
  tldr: Loaded<Tldr>;
  irc: Loaded<Irc>;
  evidence: Map<string, ReportDoc['evidence'][number]>;
  children?: ReactNode;
}) {
  const p = doc.pillars[pillar];
  const status = p?.status ?? meta.pillars[pillar]?.status;
  const issues = [
    ...new Set([...(meta.pillars[pillar]?.quality_issues ?? []), ...(p?.quality_issues ?? [])]),
  ];
  const bullets = tldr.data?.[pillar] ?? [];
  const context = irc.data?.[pillar];
  const cited = [
    ...new Set([
      ...bullets.flatMap((b) => b.evidence_ids),
      ...(context?.evidence_ids ?? []),
      ...(p?.evidence_ids ?? []),
    ]),
  ];
  return (
    <section
      id={`pillar-${pillar}`}
      aria-labelledby={`pillar-${pillar}-h`}
      className="glass scroll-mt-28 space-y-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`pillar-${pillar}-h`} className="text-2xl font-semibold">
          {label}
        </h2>
        <PillarStatus status={status} />
      </div>
      {!p && (
        <p className="text-mask-ink text-sm">
          Data gap: report.json has no record for this pillar.
        </p>
      )}
      {status === 'unavailable' && (
        <p className="text-mask-ink text-sm font-semibold">
          Data gap: this pillar is unavailable in this report.
        </p>
      )}
      {pillar === 'statistical_risk' && (
        <p className="text-muted border-line rounded-lg border p-3 text-sm">
          Any legacy risk label or VaR figure quoted below is the original model’s historical,
          in-sample, uncalibrated output. It is not a finding and not a maximum loss.
        </p>
      )}

      <div>
        <h3 className="text-beam-ink text-xs font-semibold tracking-wide uppercase">TL;DR</h3>
        {tldr.state === 'error' ? (
          <ErrorState error={tldr.error} what="TL;DR" />
        ) : tldr.state === 'missing' ? (
          <p className="text-muted mt-2 text-sm">Data gap: this report has no TL;DR file.</p>
        ) : tldr.state === 'loading' ? (
          <p className="text-muted mt-2 text-sm">Checking the TL;DR…</p>
        ) : bullets.length ? (
          <ul className="mt-2 space-y-3">
            {bullets.map((b, i) => (
              <li key={i} className="border-line border-l-2 pl-3">
                <span className="text-muted text-xs font-semibold uppercase">
                  {ROLE_TEXT[b.role] ?? b.role}
                </span>
                <p className="mt-0.5">{b.text}</p>
                <EvidenceRefs ids={b.evidence_ids} evidence={evidence} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-2 text-sm">No TL;DR for this pillar.</p>
        )}
      </div>

      {p?.summary && (
        <p className="text-sm">
          <span className="text-muted">Report summary: </span>
          {p.summary}
        </p>
      )}

      {irc.state === 'error' && <ErrorState error={irc.error} what="Context" />}
      {context && (
        <details className="border-line rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Context: insight, reasoning and open questions
          </summary>
          {context.insight && (
            <p className="mt-2">
              <span className="text-muted">Insight: </span>
              {context.insight}
            </p>
          )}
          {context.reasoning && (
            <p className="mt-2">
              <span className="text-muted">Reasoning: </span>
              {context.reasoning}
            </p>
          )}
          {context.limitations.map((l, i) => (
            <p key={`l${i}`} className="text-muted mt-1">
              Limitation: {l}
            </p>
          ))}
          {context.questions.map((q, i) => (
            <p key={`q${i}`} className="text-muted mt-1">
              Question: {q}
            </p>
          ))}
        </details>
      )}

      {children}

      {issues.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Quality issues and data gaps</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {issues.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {cited.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Evidence cited</h3>
          <ul className="text-muted mt-1 space-y-0.5 text-xs">
            {cited.map((eid) => (
              <li key={eid}>
                <a href={`#evidence-${eid}`} className="text-beam-ink num underline">
                  {eid}
                </a>{' '}
                · fetched {utcStamp(evidence.get(eid)?.fetched_at ?? null)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EvidenceRefs({
  ids,
  evidence,
}: {
  ids: string[];
  evidence: Map<string, { fetched_at: string | null }>;
}) {
  if (!ids.length) return null;
  return (
    <p className="text-muted mt-1 text-xs">
      Evidence:{' '}
      {ids.map((eid, i) => (
        <span key={eid}>
          {i ? ', ' : ''}
          <a href={`#evidence-${eid}`} className="text-beam-ink num underline">
            {eid}
          </a>
          {evidence.get(eid)?.fetched_at
            ? ` (fetched ${utcStamp(evidence.get(eid)!.fetched_at)})`
            : ''}
        </span>
      ))}
    </p>
  );
}
