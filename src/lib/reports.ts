export type ReportAsset = { url: string; sha256: string };
export type ReportEntry = {
  id: string;
  apiOrigin: string;
  title: string;
  reportId: string;
  version: string;
  candidateId: string;
  digest: string;
  context: string;
  observed: string;
  review: string;
  listUnavailable?: boolean;
  admission?: string;
  diagnostic?: string;
  diagnosticDescription?: string;
  sourceContext?: string;
  fetched?: string;
  runStatus?: string;
  caseId?: string;
  runId?: string;
  coverage?: { pillar: string; status: string }[];
  packageUrl?: string;
  packageUnavailable?: boolean;
  html: ReportAsset | null;
  markdown: ReportAsset | null;
  pdf: ReportAsset | null;
};
export interface ReportAdapter {
  list(): Promise<ReportEntry[]>;
  get(id: string): Promise<ReportEntry | null>;
}

type Metadata = {
  report_id: string;
  report_version: string;
  candidate_id: string;
  report_sha256: string;
  provenance?: string;
  diagnostic?: {
    description?: string;
    model_status?: string;
    case_admitted?: boolean;
    world_verified?: boolean;
  } | null;
  mode?: string;
  case_id?: string | null;
  run_id?: string;
  run_status?: string;
  fetch_times?: string[];
  pillars?: Record<string, { status: string }> | null;
  identity: { symbol: string };
  observation_times: string[];
  selection: {
    kind: string;
    reason?: string;
    authentication?: string;
    admission_qualified: boolean | null;
  };
  review: { status: string };
  package?: { availability: string; package_sha256: string | null; url: string | null };
  artifacts?: Record<
    string,
    { availability: string; sha256: string | null; url: string | null; report_sha256: string }
  >;
};
const hashPattern = /^[a-f0-9]{64}$/;
const identifier = /^[a-zA-Z0-9._:-]+$/;
const artifactPath =
  /^\/artifacts\/[a-zA-Z0-9_-]+\/(index\.html|report\.json|report\.md|report\.pdf)$/;

export function reportApiBase(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      !(
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
      ) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
function validateIdentity(value: Metadata): void {
  if (
    !value ||
    typeof value.report_id !== 'string' ||
    typeof value.report_version !== 'string' ||
    typeof value.candidate_id !== 'string' ||
    !identifier.test(value.report_id) ||
    !identifier.test(value.report_version) ||
    !identifier.test(value.candidate_id) ||
    !hashPattern.test(value.report_sha256) ||
    !value.identity ||
    typeof value.identity.symbol !== 'string' ||
    !Array.isArray(value.observation_times) ||
    !value.observation_times.every((time) => typeof time === 'string') ||
    !value.selection ||
    typeof value.selection.kind !== 'string' ||
    (value.selection.reason !== undefined && typeof value.selection.reason !== 'string') ||
    !value.review ||
    typeof value.review.status !== 'string'
  )
    throw new Error('Invalid report metadata');
}
function asset(base: string, value: Metadata, name: string): ReportAsset | null {
  const item = value.artifacts?.[name];
  if (!item || item.availability !== 'available') return null;
  if (
    !item.url ||
    !artifactPath.test(item.url) ||
    !item.sha256 ||
    !hashPattern.test(item.sha256) ||
    item.report_sha256 !== value.report_sha256
  )
    throw new Error('Invalid artifact binding');
  const expected = { html: 'index.html', markdown: 'report.md', pdf: 'report.pdf' }[name];
  if (!item.url.endsWith(`/${expected}`)) throw new Error('Invalid artifact type');
  return { url: base + item.url, sha256: item.sha256 };
}
async function json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Reports API unavailable');
  return response.json();
}
export async function verifyAsset(item: ReportAsset): Promise<Blob> {
  const response = await fetch(item.url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Artifact unavailable');
  const bytes = await response.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  if (hex !== item.sha256) throw new Error('Artifact digest mismatch');
  return new Blob([bytes], {
    type: response.headers.get('content-type') ?? 'application/octet-stream',
  });
}
function summarizeTimes(label: string, times: string[]): string {
  if (!times.length) return `${label}: unavailable.`;
  if (times.length === 1) return `${label}: ${times[0]}`;
  const parsed = times.map((value) => ({ value, epoch: Date.parse(value) }));
  if (parsed.some((time) => !Number.isFinite(time.epoch)))
    return `${label}: ${times.length} timestamps supplied; details available in evidence.`;
  parsed.sort((a, b) => a.epoch - b.epoch);
  return `${label}: ${times.length} timestamps, ${parsed[0].value} to ${parsed[parsed.length - 1].value}`;
}
export function backendReportAdapter(base: string): ReportAdapter {
  if (base !== '/api/research' && reportApiBase(base) !== base)
    throw new Error('Invalid report API origin');
  async function metadata(): Promise<unknown[]> {
    const items = await json(`${base}/reports`);
    if (!Array.isArray(items)) throw new Error('Invalid report list');
    return items;
  }
  function entry(value: Metadata): ReportEntry {
    return {
      id: `${value.report_id}~${value.report_version}`,
      apiOrigin: base,
      title: `${value.identity.symbol || 'Symbol unknown'} research report`,
      reportId: value.report_id,
      version: value.report_version,
      candidateId: value.candidate_id,
      digest: value.report_sha256,
      context:
        value.provenance === 'source_curated_reference' ||
        (value.selection.kind === 'diagnostic_exception' &&
          value.selection.reason?.includes('reference report integration') &&
          value.selection.admission_qualified === false)
          ? 'Labeled reference · integration only · not gate-qualified'
          : 'Research draft · qualification unverified',
      observed: summarizeTimes('Source observations', value.observation_times),
      review: `Review: ${value.review.status} · local operator identity unverified; no authenticated sign-off.`,
      diagnostic:
        value.provenance === 'user_requested_historical_diagnostic' &&
        value.diagnostic?.case_admitted === false &&
        value.diagnostic?.world_verified === false
          ? `User-requested historical diagnostic · not case-admitted · World ID not verified${typeof value.diagnostic.model_status === 'string' ? ` · model status: ${value.diagnostic.model_status}` : ''}`
          : undefined,
      diagnosticDescription:
        value.provenance === 'user_requested_historical_diagnostic' &&
        typeof value.diagnostic?.description === 'string'
          ? value.diagnostic.description
          : undefined,
      admission: `Admission: ${value.selection.kind.replaceAll('_', ' ')} · authentication: ${typeof value.selection.authentication === 'string' ? value.selection.authentication : 'not supplied'}`,
      fetched:
        Array.isArray(value.fetch_times) &&
        value.fetch_times.every((time) => typeof time === 'string') &&
        value.fetch_times.length
          ? summarizeTimes('Source fetches', value.fetch_times)
          : undefined,
      sourceContext:
        typeof value.provenance === 'string'
          ? `Provenance: ${value.provenance.replaceAll('_', ' ')}${typeof value.mode === 'string' ? ` · mode: ${value.mode}` : ''}`
          : undefined,
      runStatus: typeof value.run_status === 'string' ? value.run_status : undefined,
      caseId: typeof value.case_id === 'string' ? value.case_id : undefined,
      runId: typeof value.run_id === 'string' ? value.run_id : undefined,
      coverage:
        value.pillars &&
        ['microstructure', 'onchain', 'fundamentals', 'statistical_risk', 'technical_health'].every(
          (key) => typeof value.pillars?.[key]?.status === 'string',
        )
          ? [
              'microstructure',
              'onchain',
              'fundamentals',
              'statistical_risk',
              'technical_health',
            ].map((pillar) => ({ pillar, status: value.pillars![pillar].status }))
          : undefined,

      html: null,
      markdown: null,
      pdf: null,
    };
  }
  async function detail(item: Metadata, verifyBytes: boolean): Promise<ReportEntry> {
    const value = (await json(
      `${base}/reports/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}/artifacts`,
    )) as Metadata;
    validateIdentity(value);
    if (
      ['report_id', 'report_version', 'candidate_id', 'report_sha256'].some(
        (key) => item[key as keyof Metadata] !== value[key as keyof Metadata],
      )
    )
      throw new Error('Report identity mismatch');
    let packageUrl: string | undefined;
    if (value.package?.availability === 'available') {
      const pkg = value.package;
      if (
        !pkg.package_sha256 ||
        !hashPattern.test(pkg.package_sha256) ||
        pkg.url !== `/packages/${pkg.package_sha256}`
      )
        throw new Error('Invalid package binding');
      packageUrl = base + pkg.url;
    }
    const html = asset(base, value, 'html');
    const markdown = asset(base, value, 'markdown');
    const pdf = asset(base, value, 'pdf');
    if (verifyBytes && html && !packageUrl && !value.package) {
      const reportUrl = html.url.replace(/index\.html$/, 'report.json');
      const reportBlob = await verifyAsset({ url: reportUrl, sha256: value.report_sha256 });
      const report = JSON.parse(await reportBlob.text());
      if (
        report.report_id !== value.report_id ||
        report.report_version !== value.report_version ||
        report.candidate_id !== value.candidate_id
      )
        throw new Error('Report bytes do not match identity');
      await verifyAsset(html);
    }
    return {
      ...entry(value),
      packageUrl,
      packageUnavailable: Boolean(value.package && value.package.availability !== 'available'),
      html,
      markdown,
      pdf,
    };
  }
  return {
    async list() {
      const items = await metadata();
      return Promise.all(
        items.map(async (raw, index) => {
          let item: Metadata;
          try {
            item = raw as Metadata;
            validateIdentity(item);
          } catch {
            return {
              id: `unavailable-${index}`,
              apiOrigin: base,
              title: 'Report unavailable',
              reportId: '',
              version: '',
              candidateId: '',
              digest: '',
              context: 'Report metadata unavailable',
              observed: 'Observation time unavailable.',
              review: 'Review state unavailable.',
              listUnavailable: true,
              html: null,
              markdown: null,
              pdf: null,
            };
          }
          try {
            return await detail(item, false);
          } catch {
            return { ...entry(item), listUnavailable: true };
          }
        }),
      );
    },
    async get(id) {
      const items = await metadata();
      for (const raw of items) {
        try {
          const item = raw as Metadata;
          validateIdentity(item);
          if (`${item.report_id}~${item.report_version}` === id) return await detail(item, true);
        } catch (error) {
          // A matching report failure must not silently resolve to another report.
          if (
            raw &&
            typeof raw === 'object' &&
            `${(raw as Metadata).report_id}~${(raw as Metadata).report_version}` === id
          )
            throw error;
        }
      }
      return null;
    },
  };
}
const configured = process.env.NEXT_PUBLIC_REPORT_API_URL;
const base = reportApiBase(configured);
const emptyAdapter: ReportAdapter = {
  async list() {
    return [];
  },
  async get() {
    return null;
  },
};
const invalidAdapter: ReportAdapter = {
  async list() {
    throw new Error('Invalid report API origin');
  },
  async get() {
    throw new Error('Invalid report API origin');
  },
};
export const defaultReportAdapter: ReportAdapter = base
  ? backendReportAdapter(new URL(base).protocol === 'http:' ? base : '/api/research')
  : configured
    ? invalidAdapter
    : emptyAdapter;
