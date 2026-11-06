import { reportApiBase, verifyAsset, type ReportEntry } from './reports';

export const PILLARS = [
  ['microstructure', 'Market microstructure'],
  ['onchain', 'On-chain mechanics'],
  ['fundamentals', 'Fundamentals & sentiment'],
  ['statistical_risk', 'Statistical risk'],
  ['technical_health', 'Technical health'],
] as const;

type Source = {
  id: string;
  path: string;
  sha256: string;
  kind: string;
  observed_at: string | null;
  fetched_at: string | null;
  coverage: string;
  limitations: string[];
};
type Claim = {
  id: string;
  statement: string;
  kind: string;
  supporting_evidence_ids: string[];
  counterevidence_ids: string[];
  contradiction_claim_ids?: string[];
  uncertainties: string[];
};
type Measurement = {
  id: string;
  value: number | string | null;
  unit: string | null;
  method: string | null;
  quality: string;
  evidence_ids: string[];
  unknown_reason: string | null;
};
type Series = {
  id: string;
  unit: string | null;
  method: string | null;
  quality: string;
  evidence_ids: string[];
  points: { time: string; value: number | null }[];
};
type Pillar = {
  status: string;
  summary: string;
  evidence_ids: string[];
  measurements: Measurement[];
  series: Series[];
  claims: Claim[];
  quality_issues: string[];
};
type TextRef = { text: string; evidence_ids: string[]; input_ids?: string[]; claim_ids?: string[] };
export type Recommendation = {
  action: string;
  rationale: TextRef;
  counterevidence: TextRef[];
  reversal_conditions: string[];
};
type Irc = {
  insight: TextRef;
  reasoning: TextRef;
  citations: { evidence_ids: string[]; claim_ids: string[] };
  limitations: string[];
  questions: string[];
};
type Reason = { name: string; analysis: TextRef[]; limitations: string[]; questions: string[] };
type Artifact = {
  kind: string;
  availability: string;
  path: string | null;
  sha256: string | null;
  report_id: string;
  report_version: string;
};
export type NativeReport = {
  report: {
    schema_version: string;
    report_id: string;
    report_version: string;
    candidate_id: string;
    assessment: { label: string; summary: string; unknowns: string[] };
    pillars: Record<string, Pillar>;
    evidence: Source[];
    artifacts: Artifact[];
  };
  irc: { pillars: Record<string, Irc> } | null;
  reasoning: {
    profile: string;
    reasoning: {
      pillars: Reason[];
      conclusion?: { recommendation?: Recommendation; analysis?: TextRef[]; unknowns?: string[] };
    };
  } | null;
  assetBase: string;
};

// The backend serves only files from the verified package under this job path.
// Never decode paths or allow URLs, traversal, query/fragment or encoded separators.
export function safePackagePath(path: string): boolean {
  return (
    /^[A-Za-z0-9_./-]+$/.test(path) &&
    path.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
  );
}
async function boundJson(url: string, sha256: string): Promise<unknown> {
  return JSON.parse(await (await verifyAsset({ url, sha256 })).text());
}
export async function loadNativeReport(entry: ReportEntry): Promise<NativeReport> {
  if (entry.packageUnavailable) throw new Error('Report package unavailable');
  let assetBase: string;
  let reportUrl: string;
  if (entry.packageUrl) {
    const proxied = entry.apiOrigin === '/api/research';
    const packageAddress = new URL(entry.packageUrl, 'https://local.invalid');
    if (
      (!proxied && reportApiBase(entry.apiOrigin) !== entry.apiOrigin) ||
      (proxied ? packageAddress.origin !== 'https://local.invalid' || !entry.packageUrl.startsWith('/api/research/') : packageAddress.origin !== entry.apiOrigin) ||
      !new RegExp(`^${proxied ? '/api/research' : ''}/packages/[a-f0-9]{64}$`).test(packageAddress.pathname) ||
      packageAddress.username ||
      packageAddress.password ||
      packageAddress.search ||
      packageAddress.hash
    )
      throw new Error('Unsafe package URL');
    const response = await fetch(entry.packageUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Package descriptor unavailable');
    const descriptor = await response.json();
    const packageId = entry.packageUrl.split('/').pop();
    if (
      descriptor.package_sha256 !== packageId ||
      descriptor.report_id !== entry.reportId ||
      descriptor.report_version !== entry.version ||
      descriptor.candidate_id !== entry.candidateId ||
      descriptor.report_sha256 !== entry.digest ||
      descriptor.manifest?.sha256 !== packageId ||
      descriptor.manifest?.url !== `/packages/${packageId}/manifest.json` ||
      descriptor.report?.availability !== 'available' ||
      descriptor.report?.sha256 !== entry.digest ||
      descriptor.report?.url !== `/packages/${packageId}/report.json`
    )
      throw new Error('Package descriptor identity mismatch');
    const manifest = (await boundJson(`${entry.packageUrl}/manifest.json`, packageId!)) as {
      report_id: string;
      report_version: string;
      report_sha256: string;
    };
    if (
      manifest.report_id !== entry.reportId ||
      manifest.report_version !== entry.version ||
      manifest.report_sha256 !== entry.digest
    )
      throw new Error('Package manifest identity mismatch');
    reportUrl = `${entry.packageUrl}/report.json`;
    assetBase = `${entry.packageUrl}/assets/`;
  } else {
    // Compatibility with the current loopback backend; mutable job URLs are local-only.
    const legacyOrigin = new URL(entry.apiOrigin);
    if (!['localhost', '127.0.0.1'].includes(legacyOrigin.hostname))
      throw new Error('Immutable report package required');
    if (!entry.html) throw new Error('Report package unavailable');
    const address = new URL(entry.html.url);
    if (
      reportApiBase(entry.apiOrigin) !== entry.apiOrigin ||
      address.origin !== entry.apiOrigin ||
      !/^\/artifacts\/[a-zA-Z0-9_-]+\/index\.html$/.test(address.pathname) ||
      address.username ||
      address.password ||
      address.search ||
      address.hash
    )
      throw new Error('Unsafe report URL');
    assetBase = entry.html.url.replace(/index\.html$/, 'assets/');
    reportUrl = entry.html.url.replace(/index\.html$/, 'report.json');
  }
  const report = (await boundJson(reportUrl, entry.digest)) as NativeReport['report'];
  if (
    report.schema_version !== '0.2' ||
    report.report_id !== entry.reportId ||
    report.report_version !== entry.version ||
    report.candidate_id !== entry.candidateId ||
    !report.pillars ||
    !Array.isArray(report.evidence) ||
    !Array.isArray(report.artifacts) ||
    !report.assessment ||
    !Array.isArray(report.assessment.unknowns)
  )
    throw new Error('Report identity or structure mismatch');
  for (const [key] of PILLARS) {
    const p = report.pillars[key];
    if (
      !p ||
      !Array.isArray(p.claims) ||
      !Array.isArray(p.measurements) ||
      !Array.isArray(p.series) ||
      !Array.isArray(p.evidence_ids) ||
      !Array.isArray(p.quality_issues)
    )
      throw new Error('Invalid pillar');
  }
  for (const source of report.evidence) {
    if (!source || !safePackagePath(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256))
      throw new Error('Invalid evidence binding');
  }
  async function sidecar(kind: string, profiles: string[]) {
    const records = report.artifacts.filter(
      (a) => a.kind === kind && a.availability === 'available',
    );
    if (records.length === 0) return null;
    if (records.length !== 1) throw new Error('Ambiguous sidecar');
    const a = records[0];
    if (
      !a.path ||
      !safePackagePath(a.path) ||
      !a.sha256 ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      a.report_id !== entry.reportId ||
      a.report_version !== entry.version
    )
      throw new Error('Invalid sidecar binding');
    const value = (await boundJson(assetBase + a.path, a.sha256)) as {
      profile: string;
      schema_version: string;
      report_id: string;
      report_version: string;
      candidate_id?: string;
    };
    if (
      !profiles.includes(value.profile) ||
      value.report_id !== entry.reportId ||
      value.report_version !== entry.version ||
      (value.profile === 'scooby.reasoning/2'
        ? value.candidate_id !== entry.candidateId
        : Boolean(value.candidate_id && value.candidate_id !== entry.candidateId))
    )
      throw new Error('Sidecar identity mismatch');
    return value;
  }
  const [irc, tldr, reasoning] = await Promise.all([
    sidecar('pillar_irc', ['scooby.pillar-irc/1']),
    sidecar('pillar_tldr', ['scooby.pillar-tldr/1']),
    sidecar('reasoning', ['scooby.reasoning/1', 'scooby.reasoning/2']),
  ]);
  let typedIrc = irc as NativeReport['irc'];
  if (!typedIrc && tldr) {
    const source = tldr as unknown as {
      pillars: Record<
        string,
        { role: string; text: string; evidence_ids: string[]; claim_ids: string[] }[]
      >;
    };
    const pillars: Record<string, Irc> = {};
    for (const [key] of PILLARS) {
      const items = source.pillars?.[key];
      if (!Array.isArray(items)) throw new Error('Invalid pillar summary');
      const finding = items.find((item) => item.role === 'finding');
      const interpretation = items.find((item) => item.role === 'interpretation');
      pillars[key] = {
        insight: finding ?? { text: 'Insight pending.', evidence_ids: [] },
        reasoning: interpretation ?? { text: 'Reasoning pending.', evidence_ids: [] },
        citations: {
          evidence_ids: [...new Set(items.flatMap((item) => item.evidence_ids))],
          claim_ids: [...new Set(items.flatMap((item) => item.claim_ids))],
        },
        limitations: [],
        questions: [],
      };
    }
    typedIrc = { pillars };
  }
  const typedReasoning = reasoning as NativeReport['reasoning'];
  const evidenceIds = new Set(report.evidence.map((e) => e.id));
  const inputs = Object.values(report.pillars).flatMap((p) => [
    ...p.claims,
    ...p.measurements,
    ...p.series,
  ]);
  const byId = new Map(inputs.map((item) => [item.id, item]));
  function checkRefs(ids: string[] | undefined, allowed: Set<string>) {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !allowed.has(id)))
      throw new Error('Unresolved reference');
  }
  if (typedIrc)
    for (const [key] of PILLARS) {
      const p = typedIrc.pillars?.[key];
      if (!p || typeof p.insight?.text !== 'string' || typeof p.reasoning?.text !== 'string')
        throw new Error('Invalid IRC');
      checkRefs(p.insight.evidence_ids, evidenceIds);
      checkRefs(p.reasoning.evidence_ids, evidenceIds);
      checkRefs(p.citations?.evidence_ids, evidenceIds);
      const claimIds = new Set(
        Object.values(report.pillars).flatMap((pillar) => pillar.claims.map((claim) => claim.id)),
      );
      checkRefs(p.citations?.claim_ids, claimIds);
      if (p.insight.claim_ids) checkRefs(p.insight.claim_ids, claimIds);
      if (p.reasoning.claim_ids) checkRefs(p.reasoning.claim_ids, claimIds);
    }
  if (typedReasoning?.profile === 'scooby.reasoning/2') {
    const rec = typedReasoning.reasoning?.conclusion?.recommendation;
    if (
      !rec ||
      typeof rec.action !== 'string' ||
      !rec.action.trim() ||
      !Array.isArray(rec.counterevidence) ||
      !Array.isArray(rec.reversal_conditions) ||
      !rec.reversal_conditions.length ||
      rec.reversal_conditions.some((x) => typeof x !== 'string' || !x.trim())
    )
      throw new Error('Invalid recommendation');
    for (const para of [rec.rationale, ...rec.counterevidence]) {
      if (!para || typeof para.text !== 'string' || !para.text.trim())
        throw new Error('Invalid recommendation paragraph');
      checkRefs(para.evidence_ids, evidenceIds);
      checkRefs(para.input_ids, new Set(byId.keys()));
      if (para.input_ids?.length && !para.evidence_ids.length)
        throw new Error('Missing input evidence');
      for (const id of para.input_ids ?? []) {
        const input = byId.get(id)!;
        const refs =
          'evidence_ids' in input
            ? input.evidence_ids
            : [...input.supporting_evidence_ids, ...input.counterevidence_ids];
        if (!para.evidence_ids.some((e) => refs.includes(e)))
          throw new Error('Input evidence mismatch');
      }
    }
    if (evidenceIds.size && !rec.rationale.evidence_ids.length)
      throw new Error('Rationale evidence missing');
  }
  return {
    report,
    irc: typedIrc,
    reasoning: typedReasoning,
    assetBase,
  };
}
