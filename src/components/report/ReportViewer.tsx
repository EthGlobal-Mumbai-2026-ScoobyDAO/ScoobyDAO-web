'use client';

import { AlertTriangle, ExternalLink, FileWarning, HelpCircle, Link2 } from 'lucide-react';
import { Identicon } from '@/components/Identicon';
import { TxLink } from '@/components/TxLink';
import { chainName, tokenExplorer } from '@/lib/explorer';
import { PILLARS, type Evidence, type Pillar, type PillarKey, type ReportV02 } from '@/lib/types';

// Renders report v0.2 as delivered. All text is untrusted data: rendered as text, never HTML.
// Unknown, unavailable and partial stay visible; null is shown as "unknown", never as zero.

const PILLAR_LABEL: Record<PillarKey, string> = {
  microstructure: 'Market microstructure',
  onchain: 'Onchain',
  fundamentals: 'Fundamentals',
  statistical_risk: 'Statistical risk',
  technical_health: 'Technical health',
};

const STATUS_CLS: Record<Pillar['status'], string> = {
  complete: 'text-clue-ink',
  partial: 'text-beam-ink',
  running: 'text-ghost-ink',
  not_started: 'text-muted',
  failed: 'text-mask-ink',
  unavailable: 'text-mask-ink',
};

export function IdentityHeader({ report }: { report: ReportV02 }) {
  const { identity } = report;
  const href = tokenExplorer(identity.chain_id, identity.address);
  return (
    <header className="flex flex-wrap items-start gap-4">
      <Identicon address={identity.address} size={64} />
      <div className="min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl">{identity.symbol || 'Unknown symbol'}</h1>
        <p className="mt-1 break-all">
          <TxLink kind="token" value={identity.address} full href={href} />
        </p>
        <p className="text-muted mt-1 text-sm">
          {chainName(identity.chain_id)} · report <span className="num">{report.report_id}</span> ·{' '}
          version <span className="num">{report.report_version}</span> · mode {report.mode.replace(/_/g, ' ')}
        </p>
      </div>
    </header>
  );
}

export function AssessmentCard({ report }: { report: ReportV02 }) {
  const a = report.assessment;
  const claimText = (id: string) => allClaims(report).find((c) => c.id === id)?.statement;
  return (
    <section aria-labelledby="assess-h" className="mt-6 space-y-4">
      <div>
        <h2 id="assess-h" className="font-display text-xl">
          Assessment
        </h2>
        <p className="mt-1">
          <span className="font-semibold">{a.label ?? 'No label'}</span>
          <span className="text-muted"> · status {a.status.replace(/_/g, ' ')}</span>
        </p>
        <p className="mt-2 leading-relaxed">{a.summary}</p>
      </div>
      <Callout icon={HelpCircle} title={`Unknowns (${a.unknowns.length})`}>
        {a.unknowns.length ? (
          <ul className="list-disc space-y-1 pl-5">{a.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
        ) : (
          <p>None listed.</p>
        )}
      </Callout>
      <Callout icon={AlertTriangle} title={`Counterevidence (${a.counterevidence_claim_ids.length})`}>
        {a.counterevidence_claim_ids.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {a.counterevidence_claim_ids.map((id) => (
              <li key={id}>
                <span className="num">{id}</span>: {claimText(id) ?? 'claim not found'}
              </li>
            ))}
          </ul>
        ) : (
          <p>No counterevidence claims are linked to the assessment.</p>
        )}
      </Callout>
      {a.supporting_claim_ids.length > 0 && (
        <p className="text-sm">
          Supporting claims: <span className="num">{a.supporting_claim_ids.join(', ')}</span>
        </p>
      )}
    </section>
  );
}

function Callout({ icon: Icon, title, children }: { icon: typeof HelpCircle; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border-l-4 border-[var(--beam-400)] bg-white/60 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Icon size={18} aria-hidden /> {title}
      </p>
      <div className="mt-2 text-[15px]">{children}</div>
    </div>
  );
}

const allClaims = (r: ReportV02) => PILLARS.flatMap((p) => r.pillars[p].claims);

const EvidenceRef = ({ id }: { id: string }) => (
  <a href={`#ev-${id}`} className="num text-beam-ink inline-flex items-center gap-0.5 underline underline-offset-2">
    <Link2 size={12} aria-hidden />
    {id}
  </a>
);

export function PillarCard({ name, pillar }: { name: PillarKey; pillar: Pillar }) {
  return (
    <section aria-labelledby={`p-${name}`} className="rounded-sm bg-white/70 p-4 shadow-[0_6px_14px_-8px_rgb(0_0_0/0.4)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`p-${name}`} className="font-display text-lg">
          {PILLAR_LABEL[name]}
        </h3>
        <span className={`stamp text-[0.7rem] ${STATUS_CLS[pillar.status]}`}>{pillar.status.replace(/_/g, ' ')}</span>
      </div>
      <p className="mt-2 leading-relaxed">{pillar.summary}</p>

      {pillar.measurements.length > 0 && (
        <div className="mt-3">
          <p className="text-muted text-sm font-semibold">Measurements</p>
          <ul className="mt-1 space-y-1.5 text-sm">
            {pillar.measurements.map((m) => (
              <li key={m.id}>
                <span className="num">{m.id}</span>:{' '}
                <span className="num font-semibold">{m.value === null ? 'unknown' : m.value}</span>{' '}
                <span className="text-muted">
                  {m.unit ?? 'unit unknown'} · method {m.method ?? 'unknown'} · {m.quality}
                </span>
                {m.unknown_reason && <span className="text-muted"> · {m.unknown_reason}</span>}{' '}
                {m.evidence_ids.map((e) => <EvidenceRef key={e} id={e} />)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pillar.claims.length > 0 && (
        <div className="mt-3">
          <p className="text-muted text-sm font-semibold">Findings ({pillar.claims.length})</p>
          <ul className="mt-1 space-y-2 text-sm">
            {pillar.claims.map((c) => (
              <li key={c.id} className="border-line border-l-2 pl-3">
                <p className="break-words">
                  <span className="text-muted">{c.kind}:</span> {c.statement}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                  {c.supporting_evidence_ids.map((e) => <EvidenceRef key={e} id={e} />)}
                  {c.counterevidence_ids.length > 0 && (
                    <span className="text-mask-ink">counterevidence: {c.counterevidence_ids.join(', ')}</span>
                  )}
                  {c.uncertainties.map((u, i) => (
                    <span key={i} className="text-muted">
                      · {u}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pillar.quality_issues.length > 0 && (
        <p className="text-mask-ink mt-3 flex gap-2 text-sm">
          <FileWarning size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{pillar.quality_issues.join(' · ')}</span>
        </p>
      )}
    </section>
  );
}

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <ol className="space-y-3">
      {evidence.map((e) => (
        <li key={e.id} id={`ev-${e.id}`} className="border-line scroll-mt-24 rounded-sm border bg-white/50 p-4 target:outline-2 target:outline-[var(--beam-400)]">
          <p className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="num font-semibold">{e.id}</span>
            <span className="text-muted">{e.kind.replace(/_/g, ' ')} · coverage {e.coverage}</span>
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Meta label="Source file" value={e.path} mono />
            <Meta label="Observed" value={e.observed_at} />
            <Meta label="Fetched" value={e.fetched_at} />
            <Meta label="Block" value={e.block_number?.toString() ?? null} mono />
            <Meta label="Window" value={e.window.start || e.window.end ? `${e.window.start ?? '?'} → ${e.window.end ?? '?'}` : null} />
            <Meta label="SHA-256" value={e.sha256} mono />
          </dl>
          <p className="text-muted mt-1 text-xs">Method and units are recorded per measurement in the pillars above.</p>
          {e.limitations.length > 0 && <p className="text-mask-ink mt-2 text-sm">{e.limitations.join(' · ')}</p>}
        </li>
      ))}
    </ol>
  );
}

function Meta({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted inline">{label}: </dt>
      <dd className={`inline break-all ${mono ? 'num' : ''}`}>{value ?? <span className="text-muted italic">unknown</span>}</dd>
    </div>
  );
}

/** Lists the bundle's artifacts. The backend has no public route for bundle files yet, so there are no links. */
export function Artifacts({ artifacts, readerUrl }: { artifacts: ReportV02['artifacts']; readerUrl?: string }) {
  return (
    <div className="space-y-3">
      {readerUrl && (
        <a href={readerUrl} target="_blank" rel="noreferrer" className="text-beam-ink inline-flex items-center gap-1 underline">
          Open the rendered report <ExternalLink size={14} aria-hidden />
        </a>
      )}
      <ul className="space-y-1.5 text-sm">
        {artifacts.map((a, i) => (
          <li key={i} className="flex flex-wrap gap-x-3">
            <span className="font-semibold">{a.kind.replace(/_/g, ' ')}</span>
            <span className={a.availability === 'available' ? 'text-clue-ink' : 'text-mask-ink'}>{a.availability}</span>
            {a.path && <span className="num text-muted">{a.path}</span>}
            {a.sha256 && <span className="num text-muted">sha256 {a.sha256.slice(0, 12)}…</span>}
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs">Rendered reader / PDF links appear here once the backend serves them.</p>
    </div>
  );
}

export function LimitationsNote({ report }: { report: ReportV02 }) {
  return (
    <div className="rounded-sm bg-[#fff3b8] p-4 text-[#2a2418] shadow-[0_8px_16px_-10px_rgb(0_0_0/0.45)]">
      <p className="font-semibold">Limitations</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{report.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="mt-3 text-xs text-[#5b5140]">
        Review status inside the report: {report.review.status.replace(/_/g, ' ')} (authentication: {report.review.authentication}). An
        embedded review is never treated as approval; only the World sign-off below counts.
      </p>
    </div>
  );
}

export function ReportViewer({ report, children }: { report: ReportV02; children?: React.ReactNode }) {
  return (
    <>
      <IdentityHeader report={report} />
      <AssessmentCard report={report} />
      {children}
      <Section title="Five pillars">
        <div className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((p) => (
            <PillarCard key={p} name={p} pillar={report.pillars[p]} />
          ))}
        </div>
      </Section>
      <Section title={`Evidence (${report.evidence.length})`}>
        <EvidenceList evidence={report.evidence} />
      </Section>
      <Section title="Artifacts">
        <Artifacts artifacts={report.artifacts} />
      </Section>
      <Section title="Limitations">
        <LimitationsNote report={report} />
      </Section>
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="border-line font-display mb-3 border-b pb-1 text-xl">{title}</h2>
      {children}
    </section>
  );
}
