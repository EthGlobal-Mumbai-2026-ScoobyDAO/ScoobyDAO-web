import { claimHashOf, sha256Hex, toBytes32 } from '@/lib/hash';
import { NOT_STATED, PILLARS, type Approval, type ClaimManifest, type ReportV02, type WebReport } from '@/lib/types';
import { HISTORICAL_REPORT_JSON } from './historicalReport';

// Fixture backend data built from the real v0.2 historical bundle (ScoobyDAO-backend/tests/
// historical-bundle). The bytes are served unchanged from /raw; reportSha256 is computed from them.
// Claim manifests are built with a port of publication/canonical.py:build_claim_manifest.

export { NOT_STATED };
export const RAW_REPORT = HISTORICAL_REPORT_JSON;
export const historicalReport = JSON.parse(HISTORICAL_REPORT_JSON) as ReportV02;

/** Port of build_claim_manifest (scooby.claim-manifest/1). Uses only v0.2 fields; invents no findings. */
export function buildClaimManifest(
  report: ReportV02,
  reportSha256: string,
  createdAt: number,
  lockTime: number,
  excludedWallets: string[] = [],
): ClaimManifest {
  const identity = report.identity ?? ({} as ReportV02['identity']);
  const assessment = report.assessment ?? ({} as ReportV02['assessment']);
  const symbol = identity.symbol || NOT_STATED;
  const chainId = identity.chain_id;
  const address = identity.address || NOT_STATED;
  const claims: NonNullable<ClaimManifest['claims']> = [];
  for (const pillar of PILLARS)
    for (const c of report.pillars?.[pillar]?.claims ?? [])
      claims.push({
        id: claims.length,
        type: 'REPORT_CLAIM',
        params: { statement: c.statement || NOT_STATED, kind: c.kind || NOT_STATED, pillar, reportClaimId: c.id || NOT_STATED },
      });
  const evidence = (report.evidence ?? []).map((e) => ({
    kind: e.kind || NOT_STATED,
    result: e.coverage || NOT_STATED,
    detail: `${e.id || NOT_STATED} sha256:${e.sha256 || NOT_STATED}`,
  }));
  const summary = assessment.summary || NOT_STATED;
  return {
    schema: 'scooby.claim-manifest/1',
    version: 1,
    title: `${symbol} on chain ${chainId ?? NOT_STATED}: ${report.report_id || NOT_STATED}@${report.report_version || NOT_STATED}`,
    chainId: typeof chainId === 'number' ? chainId : 0,
    token: address,
    symbol,
    claimText: `${assessment.label ? assessment.label : NOT_STATED}. ${summary}`,
    assessmentStatus: assessment.status || NOT_STATED,
    claims,
    evidence,
    summary,
    excludedWallets: [...new Set(excludedWallets.map((w) => w.toLowerCase()))].sort(),
    windowSeconds: Math.max(0, lockTime - createdAt),
    createdAt,
    reportId: report.report_id || NOT_STATED,
    reportVersion: report.report_version || NOT_STATED,
    reportSha256,
  };
}

export interface FixtureCase {
  web: WebReport;
  /** Fixture onchain report id (src/protocol/fixture.ts scenario), if published. */
  onchain?: bigint;
}

const DRAFT_ID = `${historicalReport.report_id}@${historicalReport.report_version}`;
export const DRAFT_REPORT_ID = DRAFT_ID;

/** Published demo cases reuse the same report bytes; each id maps to one fixture scenario. */
const PUBLISHED: { slug: string; onchain: bigint; ageDays: number }[] = [
  { slug: 'demo-open', onchain: 1n, ageDays: 0.2 },
  { slug: 'demo-locked', onchain: 2n, ageDays: 3 },
  { slug: 'demo-proposed', onchain: 3n, ageDays: 31 },
  { slug: 'demo-final-yes', onchain: 4n, ageDays: 41 },
  { slug: 'demo-void', onchain: 5n, ageDays: 51 },
];

export async function buildFixtureCases(now: number): Promise<FixtureCase[]> {
  const reportSha256 = await sha256Hex(RAW_REPORT);
  const make = async (id: string, status: WebReport['status'], createdAt: number, onchain?: bigint): Promise<FixtureCase> => {
    const claimManifest = buildClaimManifest(historicalReport, reportSha256, createdAt, createdAt + 3 * 3600);
    const claimHash = await claimHashOf(claimManifest);
    const at = id.lastIndexOf('@');
    return {
      onchain,
      web: {
        id,
        reportId: id.slice(0, at),
        version: id.slice(at + 1),
        status,
        report: historicalReport,
        claimManifest,
        reportSha256,
        claimHash,
        targetDigest: (await sha256Hex(`${id}:${claimHash}`)).slice(0, 64),
        onchainReportId: onchain?.toString(),
        txHash: onchain ? toBytes32(await sha256Hex(`publish-${id}`)) : undefined,
        createdAt,
        publicationState: onchain ? 'confirmed' : 'prepared',
      },
    };
  };
  const draft = await make(DRAFT_ID, 'draft', now - 600);
  const published = await Promise.all(
    PUBLISHED.map((p) => make(`${historicalReport.report_id}@${p.slug}`, 'published', Math.floor(now - p.ageDays * 86400), p.onchain)),
  );
  return [draft, ...published];
}

export type FixtureApproval = Approval & { _flow: 'deny' | 'approve'; _startedAt?: number; _reportKey: string };
