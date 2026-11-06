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
  identity: { symbol: string };
  observation_times: string[];
  selection: { kind: string; reason?: string; admission_qualified: boolean | null };
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
export function backendReportAdapter(base: string): ReportAdapter {
  if (base !== '/api/research' && reportApiBase(base) !== base) throw new Error('Invalid report API origin');
  async function list(): Promise<ReportEntry[]> {
    const items = await json(`${base}/reports`);
    if (!Array.isArray(items)) throw new Error('Invalid report list');
    return Promise.all(
      items.map(async (item: Metadata) => {
        validateIdentity(item);
        const detail = (await json(
          `${base}/reports/${encodeURIComponent(item.report_id)}/${encodeURIComponent(item.report_version)}/artifacts`,
        )) as Metadata;
        validateIdentity(detail);
        if (
          ['report_id', 'report_version', 'candidate_id', 'report_sha256'].some(
            (key) => item[key as keyof Metadata] !== detail[key as keyof Metadata],
          )
        )
          throw new Error('Report identity mismatch');
        let packageUrl: string | undefined;
        if (detail.package?.availability === 'available') {
          const pkg = detail.package;
          if (
            !pkg.package_sha256 ||
            !hashPattern.test(pkg.package_sha256) ||
            pkg.url !== `/packages/${pkg.package_sha256}`
          )
            throw new Error('Invalid package binding');
          packageUrl = base + pkg.url;
        }
        const html = asset(base, detail, 'html');
        const markdown = asset(base, detail, 'markdown');
        const pdf = asset(base, detail, 'pdf');
        if (html && !packageUrl && !detail.package) {
          const reportUrl = html.url.replace(/index\.html$/, 'report.json');
          const reportBlob = await verifyAsset({ url: reportUrl, sha256: detail.report_sha256 });
          const report = JSON.parse(await reportBlob.text());
          if (
            report.report_id !== detail.report_id ||
            report.report_version !== detail.report_version ||
            report.candidate_id !== detail.candidate_id
          )
            throw new Error('Report bytes do not match identity');
          await verifyAsset(html);
        }
        return {
          id: `${detail.report_id}~${detail.report_version}`,
          apiOrigin: base,
          title: `${detail.identity.symbol} research report`,
          reportId: detail.report_id,
          version: detail.report_version,
          candidateId: detail.candidate_id,
          digest: detail.report_sha256,
          context:
            detail.selection.kind === 'diagnostic_exception' &&
            detail.selection.reason?.includes('reference report integration') &&
            detail.selection.admission_qualified === false
              ? 'Labeled reference · integration only · not gate-qualified'
              : 'Research draft · qualification unverified',
          observed: detail.observation_times.length
            ? `Source observations: ${detail.observation_times.join(', ')}`
            : 'Observation time unavailable.',
          review: `Review: ${detail.review.status} · local operator identity unverified; no authenticated sign-off.`,
          packageUrl,
          packageUnavailable: Boolean(
            detail.package && detail.package.availability !== 'available',
          ),
          html,
          markdown,
          pdf,
        };
      }),
    );
  }
  return {
    list,
    async get(id) {
      return (await list()).find((entry) => entry.id === id) ?? null;
    },
  };
}
const configured = process.env.NEXT_PUBLIC_REPORT_API_URL === undefined ? 'https://scoobydao-backend.onrender.com' : process.env.NEXT_PUBLIC_REPORT_API_URL;
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
  ? backendReportAdapter('/api/research')
  : configured
    ? invalidAdapter
    : emptyAdapter;
