'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleDot, ExternalLink, HelpCircle, Scale } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ReadGate } from '@/components/admin/AdminGate';
import { Banner } from '@/components/Banner';
import { ReaderShell, ReaderSection, CopyAddress, EvidenceChips, EvidenceTable, type TocItem } from '@/components/report/ReaderLayout';
import { ReviewBadge, reviewKindOf } from '@/components/report/ReviewBadge';
import { Card, Disclosure, LoadState, TechnicalDetails } from '@/components/ui';
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
  return (
    <LoadState
      query={meta}
      source="Review desk API"
      skeleton={<div className="sweep h-48 rounded-xl" aria-label="Loading the report" />}
    >
      {(m) => <ReaderBody meta={m} />}
    </LoadState>
  );
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


/** "run-…_20261107" → "7 Nov 2026"; null when the version carries no date. */
export function versionDate(version: string): string | null {
  const m = /(\d{4})(\d{2})(\d{2})$/.exec(version);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;
}

const FILE_STATE: Record<Loaded<unknown>['state'], string> = {
  ok: 'recomputed, matches',
  error: 'integrity unavailable',
  missing: 'not in this report',
  loading: 'checking…',
};

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
  const sources = new Map((ledger.data?.sources ?? []).map((s) => [s.id, s]));
  const chain = meta.identity?.chain_id;
  const date = versionDate(meta.report_version);
  const status = (k: PillarKey) => doc?.pillars[k]?.status ?? meta.pillars[k]?.status;

  const toc: TocItem[] = doc
    ? [
        { id: 'summary', label: 'Summary' },
        ...PILLARS.map(([k, label]) => ({
          id: `pillar-${k}`,
          label,
          marker: <PillarStatus status={status(k)} compact />,
        })),
        { id: 'evidence', label: 'Evidence' },
        ...(doc.limitations.length ? [{ id: 'limitations', label: 'Limitations' }] : []),
        { id: 'technical', label: 'Technical details' },
      ]
    : [{ id: 'technical', label: 'Technical details' }];

  const bullets = PILLARS.flatMap(([k, label]) =>
    (tldr.data?.[k] ?? []).map((b) => ({ ...b, pillar: label })),
  );
  const findings = [
    ...bullets.filter((b) => b.role === 'finding'),
    ...bullets.filter((b) => b.role === 'interpretation'),
  ].slice(0, 5);
  const caveats = bullets.filter((b) => b.role === 'caveat');

  const header = (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted text-[13px] font-medium">Five-pillar reference report</p>
          <h1 className="font-display mt-1 text-[2.5rem] leading-none sm:text-5xl">{meta.symbol}</h1>
          <p className="text-muted mt-2 flex flex-wrap items-center gap-x-2 text-sm">
            <span>{chain ? chainName(chain) : 'Chain unknown'}</span>
            {meta.identity?.address && (
              <>
                <span aria-hidden>·</span>
                <CopyAddress address={meta.identity.address} />
              </>
            )}
            {date && (
              <>
                <span aria-hidden>·</span>
                <span>Replay of {date}</span>
              </>
            )}
          </p>
        </div>
        {doc?.assessment.label && (
          <div className="text-right">
            <p className="text-muted text-[13px]">Proposed assessment (draft)</p>
            <p className="text-beam-ink mt-1 inline-flex items-center gap-2 text-xl font-semibold">
              <Scale size={20} aria-hidden /> {doc.assessment.label}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ReviewBadge
          kind={pending ? 'reference' : reviewKindOf(meta.review_state)}
          label={
            pending
              ? REFERENCE_LABEL
              : `Historical reference — ${reviewStateText(meta.review_state).toLowerCase()}`
          }
        />
        <ul className="contents" aria-label="Labels">
          {meta.labels.map((l) => (
            <li key={l} className="border-line text-muted rounded-full border px-2.5 py-0.5 text-xs">
              {LABEL_TEXT[l] ?? l}
            </li>
          ))}
        </ul>
      </div>
      <Disclosure summary="What these labels mean">
        <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
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
          {meta.description && <li>{meta.description}</li>}
        </ul>
      </Disclosure>
    </Card>
  );

  return (
    <article className="min-w-0">
      <ReaderShell toc={toc} header={header}>
        {report.state === 'error' ? (
          <ErrorState error={report.error} what="report.json" />
        ) : !doc ? (
          <div className="sweep h-40 rounded-xl" aria-busy="true" aria-label="Checking report.json" />
        ) : (
          <>
            <ReaderSection id="summary" title="Summary">
              <div className="space-y-4">
                <Card>
                  <p className="text-muted text-[13px]">
                    Proposed research judgment (draft, unreviewed)
                  </p>
                  {doc.assessment.summary ? (
                    <>
                      <p className="mt-2 line-clamp-4 max-w-[68ch] text-base">
                        {doc.assessment.summary}
                      </p>
                      {doc.assessment.summary.length > 360 && (
                        <Disclosure summary="Full assessment" className="mt-2">
                          <p className="max-w-[68ch]">{doc.assessment.summary}</p>
                        </Disclosure>
                      )}
                    </>
                  ) : (
                    <p className="text-muted mt-2">No assessment summary in this report.</p>
                  )}
                  {findings.length > 0 && (
                    <>
                      <h3 className="mt-5 text-lg font-semibold">Key findings</h3>
                      <ul className="mt-2 space-y-2">
                        {findings.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <CircleDot size={16} aria-hidden className="text-beam-ink mt-1 shrink-0" />
                            <span className="max-w-[68ch]">
                              {b.text}{' '}
                              <span className="text-muted text-[13px]">({b.pillar})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {doc.assessment.unknowns.length > 0 && (
                    <>
                      <h3 className="mt-5 text-lg font-semibold">Open questions</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {doc.assessment.unknowns.map((u, i) => (
                          <li
                            key={i}
                            className="border-line inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                          >
                            <HelpCircle size={14} aria-hidden className="text-muted" /> {u}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
                {caveats.length > 0 && (
                  <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--clue-500)_50%,transparent)] bg-[color-mix(in_srgb,var(--clue-500)_10%,var(--surface))] p-5 sm:p-6">
                    <h3 className="text-clue-ink inline-flex items-center gap-2 text-lg font-semibold">
                      <Scale size={18} aria-hidden /> Counterevidence and caveats
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {caveats.map((b, i) => (
                        <li key={i} className="max-w-[68ch]">
                          {b.text} <span className="text-muted text-[13px]">({b.pillar})</span>
                          <EvidenceChips ids={b.evidence_ids} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tldr.state === 'error' && <ErrorState error={tldr.error} what="TL;DR" />}
              </div>
            </ReaderSection>

            {PILLARS.map(([k, label]) => (
              <PillarSection
                key={k}
                pillar={k}
                label={label}
                doc={doc}
                meta={meta}
                tldr={tldr}
                irc={irc}
              >
                {k === 'technical_health' ? price : k === 'statistical_risk' ? vae : null}
              </PillarSection>
            ))}

            <ReaderSection id="evidence" title="Evidence">
              {ledger.state === 'error' && <ErrorState error={ledger.error} what="Source ledger" />}
              {ledger.state === 'missing' && (
                <p className="text-muted mb-3 text-sm">Data gap: this report has no source ledger.</p>
              )}
              <EvidenceTable
                rows={doc.evidence.map((e) => {
                  const src = sources.get(e.id);
                  const href = safeHttpsUrl(src?.url ?? null);
                  const listed = !!(e.path && meta.files[e.path]);
                  return {
                    id: e.id,
                    kind: e.kind,
                    coverage: e.coverage,
                    observed: (
                      <>
                        Fetched {utcStamp(e.fetched_at)}
                        <br />
                        observed {utcStamp(e.observed_at)}
                      </>
                    ),
                    details: (
                      <>
                        {e.path && (
                          <p>
                            File <code className="num">{e.path}</code>{' '}
                            {listed ? '(served with a recorded hash)' : '(not served)'}
                          </p>
                        )}
                        {e.sha256 && (
                          <p>
                            SHA-256 <code className="num break-all">{e.sha256}</code>
                          </p>
                        )}
                        {src && (
                          <p>
                            Source
                            {src.transport_mode ? ` (${src.transport_mode.replace(/_/g, ' ')})` : ''}:{' '}
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
                          <p key={i}>Limitation: {l}</p>
                        ))}
                      </>
                    ),
                  };
                })}
              />
            </ReaderSection>

            {doc.limitations.length > 0 && (
              <ReaderSection id="limitations" title="Limitations">
                <ul className="text-muted max-w-[68ch] list-disc space-y-1 pl-5 text-[15px]">
                  {doc.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </ReaderSection>
            )}
          </>
        )}

        <section id="technical" className="scroll-mt-28" aria-label="Technical details">
          <TechnicalDetails>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted">Case</dt>
              <dd className="num break-all">{meta.case_id}</dd>
              <dt className="text-muted">Report</dt>
              <dd className="num break-all">
                {meta.report_id} · {meta.report_version}
              </dd>
              <dt className="text-muted">Report SHA-256</dt>
              <dd className="num break-all">
                {meta.report_sha256}{' '}
                {report.state === 'ok' ? (
                  <span className="text-clue-ink font-semibold">(recomputed, matches)</span>
                ) : report.state === 'error' ? (
                  <span className="text-mask-ink font-semibold">(integrity unavailable)</span>
                ) : null}
              </dd>
              <dt className="text-muted">Mode</dt>
              <dd>{meta.mode === 'historical_replay' ? 'Historical replay' : meta.mode}</dd>
              <dt className="text-muted">Integrity checks</dt>
              <dd>
                <ul className="space-y-0.5">
                  {(
                    [
                      ['report.json', report],
                      ['pillar-tldr.json', tldr],
                      ['pillar-irc.json', irc],
                      ['source-ledger.json', ledger],
                    ] as const
                  ).map(([f, l]) => (
                    <li key={f}>
                      <code className="num">{f}</code>:{' '}
                      <span className={l.state === 'error' ? 'text-mask-ink font-semibold' : ''}>
                        {FILE_STATE[l.state]}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </dl>
            {doc && (
              <>
                <h3 className="mt-4 font-semibold">Report files</h3>
                <ul className="mt-1 space-y-1">
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
              </>
            )}
            <h3 className="mt-4 font-semibold">Manifest digests</h3>
            <ul className="mt-1 space-y-1">
              {Object.entries(meta.files).map(([path, sha]) => (
                <li key={path} className="break-all">
                  <code className="num">{path}</code>{' '}
                  <code className="num text-muted">{sha}</code>
                </li>
              ))}
            </ul>
          </TechnicalDetails>
        </section>

        <p className="text-muted border-line border-t pt-4 text-sm">
          Review decisions are made separately on the{' '}
          <Link
            href={`/admin/reviews/${encodeURIComponent(meta.report_id)}/${encodeURIComponent(meta.report_version)}`}
            className="text-beam-ink underline"
          >
            review page for this report
          </Link>
          , each confirmed in World App.
        </p>
      </ReaderShell>
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
  children,
}: {
  pillar: PillarKey;
  label: string;
  doc: ReportDoc;
  meta: ReferenceMetadata;
  tldr: Loaded<Tldr>;
  irc: Loaded<Irc>;
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
    <ReaderSection
      id={`pillar-${pillar}`}
      title={label}
      aside={<PillarStatus status={status} />}
    >
      <Card className="space-y-4">
        {!p && (
          <p className="text-mask-ink text-sm">Data gap: report.json has no record for this pillar.</p>
        )}
        {status === 'unavailable' && (
          <p className="text-mask-ink text-sm font-semibold">
            Data gap: this pillar is unavailable in this report.
          </p>
        )}
        {pillar === 'statistical_risk' && (
          <p className="text-muted text-[13px]">
            Any legacy risk label or VaR figure below is the original model’s historical, in-sample,
            uncalibrated output. It is not a finding and not a maximum loss.
          </p>
        )}

        <div>
          <h3 className="text-muted text-[13px] font-semibold">TL;DR</h3>
          {tldr.state === 'error' ? (
            <ErrorState error={tldr.error} what="TL;DR" />
          ) : tldr.state === 'missing' ? (
            <p className="text-muted mt-1 text-sm">Data gap: this report has no TL;DR file.</p>
          ) : tldr.state === 'loading' ? (
            <p className="text-muted mt-1 text-sm">Checking the TL;DR…</p>
          ) : bullets.length ? (
            <ul className="mt-2 space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="border-line max-w-[68ch] border-l-2 pl-3">
                  <span className="text-muted text-xs font-semibold uppercase">
                    {ROLE_TEXT[b.role] ?? b.role}
                  </span>
                  <p className="mt-0.5">{b.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-1 text-sm">No TL;DR for this pillar.</p>
          )}
        </div>

        {p?.summary && (
          <p className="max-w-[68ch] text-[15px]">
            <span className="text-muted">Report summary: </span>
            {p.summary}
          </p>
        )}

        {children}

        {irc.state === 'error' && <ErrorState error={irc.error} what="Context" />}
        {context && (
          <Disclosure summary="Insight, reasoning and open questions">
            <div className="max-w-[68ch] space-y-1.5 text-sm">
              {context.insight && (
                <p>
                  <span className="text-muted">Insight: </span>
                  {context.insight}
                </p>
              )}
              {context.reasoning && (
                <p>
                  <span className="text-muted">Reasoning: </span>
                  {context.reasoning}
                </p>
              )}
              {context.limitations.map((l, i) => (
                <p key={`l${i}`} className="text-muted">
                  Limitation: {l}
                </p>
              ))}
              {context.questions.map((q, i) => (
                <p key={`q${i}`} className="text-muted">
                  Question: {q}
                </p>
              ))}
            </div>
          </Disclosure>
        )}

        {issues.length > 0 && (
          <Disclosure summary={`Quality issues (${issues.length})`}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {issues.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </Disclosure>
        )}

        {cited.length > 0 && (
          <div>
            <h3 className="text-muted text-[13px] font-semibold">Evidence cited</h3>
            <EvidenceChips ids={cited} />
          </div>
        )}
      </Card>
    </ReaderSection>
  );
}
