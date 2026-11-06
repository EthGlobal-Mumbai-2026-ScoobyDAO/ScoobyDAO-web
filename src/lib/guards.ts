import type { Approval, ApprovalStatus, ClaimManifest, Hex, ReportStatus, WebReport } from './types';

// Hand-written shape guards for GET /web/v1 responses. They whitelist known fields and fail
// loudly on anything secret-looking, so a backend bug can never put a device code or token
// on screen. The backend still sends the older field names (manifest, manifestHash, token,
// chainId, claimId); they are mapped here, and the mapping is recorded in NOTES.md.

export class ShapeError extends Error {
  constructor(message: string) {
    super(`Unexpected API response: ${message}`);
    this.name = 'ShapeError';
  }
}

const FORBIDDEN = /device_?code|access_?token|id_?token|refresh_?token|client_?secret|private_?key|^tokens?$|secret|password/i;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isHex = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v);
const str = (o: Record<string, unknown>, k: string, required = true) => {
  const v = o[k];
  if (v === undefined || v === null) {
    if (required) throw new ShapeError(`missing ${k}`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ShapeError(`${k} must be a string`);
  return v;
};
const num = (o: Record<string, unknown>, k: string) => {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ShapeError(`${k} must be a number`);
  return v;
};

function assertKeys(o: Record<string, unknown>, allowed: readonly string[], what: string) {
  for (const k of Object.keys(o)) {
    if (FORBIDDEN.test(k) && k !== 'token') throw new ShapeError(`${what} contains a forbidden field "${k}"`);
    if (!allowed.includes(k)) throw new ShapeError(`${what} has an unexpected field "${k}"`);
  }
}

const APPROVAL_KEYS = [
  'id', 'reportId', 'status', 'userCode', 'verificationUri', 'verificationUriComplete', 'expiresAt',
  'reportSha256', 'claimHash', 'manifestHash', 'publishTxHash', 'onchainReportId', 'demoIdentity', 'detail',
] as const;
const APPROVAL_STATUS: ApprovalStatus[] = ['pending', 'approved', 'denied', 'expired', 'rejected_not_reviewer', 'spent', 'error'];

export function parseApproval(v: unknown): Approval {
  if (!isObj(v)) throw new ShapeError('approval must be an object');
  assertKeys(v, APPROVAL_KEYS, 'approval');
  const status = str(v, 'status') as ApprovalStatus;
  if (!APPROVAL_STATUS.includes(status)) throw new ShapeError(`unknown approval status "${status}"`);
  const claimHash = (v.claimHash ?? v.manifestHash) as unknown;
  if (!isHex(claimHash)) throw new ShapeError('claimHash must be hex');
  const uri = str(v, 'verificationUri', false);
  if (uri && !/^https:\/\//.test(uri)) throw new ShapeError('verificationUri must be https');
  const uriC = str(v, 'verificationUriComplete', false);
  if (uriC && !/^https:\/\//.test(uriC)) throw new ShapeError('verificationUriComplete must be https');
  const tx = v.publishTxHash;
  if (tx !== undefined && tx !== null && !isHex(tx)) throw new ShapeError('publishTxHash must be hex');
  return {
    id: str(v, 'id')!,
    reportId: str(v, 'reportId')!,
    status,
    userCode: str(v, 'userCode', false),
    verificationUri: uri,
    verificationUriComplete: uriC,
    expiresAt: num(v, 'expiresAt'),
    reportSha256: str(v, 'reportSha256', false),
    claimHash,
    publishTxHash: (tx as Hex | undefined) ?? undefined,
    onchainReportId: v.onchainReportId == null ? undefined : String(v.onchainReportId),
    demoIdentity: v.demoIdentity === true ? true : undefined,
    detail: str(v, 'detail', false),
  };
}

const REPORT_KEYS = [
  'id', 'reportId', 'version', 'status', 'report', 'claimManifest', 'reportSha256', 'claimHash', 'targetDigest',
  'approvalId', 'onchainReportId', 'txHash', 'createdAt', 'publicationState', 'revoked',
  // Older /web/v1 names, still emitted by publication/web_adapter.py:
  'manifest', 'manifestHash', 'token', 'chainId', 'claimId',
] as const;
const REPORT_STATUS: ReportStatus[] = ['draft', 'awaiting_approval', 'denied', 'expired', 'published'];

function parseManifest(v: unknown): ClaimManifest {
  if (!isObj(v)) throw new ShapeError('claim manifest must be an object');
  for (const k of Object.keys(v)) if (FORBIDDEN.test(k) && k !== 'token') throw new ShapeError(`claim manifest contains "${k}"`);
  return {
    ...(v as unknown as ClaimManifest),
    title: str(v, 'title')!,
    token: str(v, 'token')!,
    claimText: str(v, 'claimText')!,
    chainId: typeof v.chainId === 'number' ? v.chainId : 0,
    reportSha256: str(v, 'reportSha256')!,
  };
}

export function parseReport(v: unknown): WebReport {
  if (!isObj(v)) throw new ShapeError('report must be an object');
  assertKeys(v, REPORT_KEYS, 'report');
  const id = str(v, 'id')!;
  const status = str(v, 'status') as ReportStatus;
  if (!REPORT_STATUS.includes(status)) throw new ShapeError(`unknown report status "${status}"`);
  const claimManifest = parseManifest(v.claimManifest ?? v.manifest);
  const claimHash = (v.claimHash ?? v.manifestHash) as unknown;
  if (!isHex(claimHash)) throw new ShapeError('claimHash must be hex');
  const at = id.lastIndexOf('@');
  const onchain = v.onchainReportId ?? v.claimId;
  return {
    id,
    reportId: str(v, 'reportId', false) ?? (at > 0 ? id.slice(0, at) : id),
    version: str(v, 'version', false) ?? (at > 0 ? id.slice(at + 1) : ''),
    status,
    claimManifest,
    reportSha256: str(v, 'reportSha256')!.replace(/^0x/, ''),
    claimHash,
    targetDigest: str(v, 'targetDigest', false),
    approvalId: str(v, 'approvalId', false),
    onchainReportId: onchain == null ? undefined : String(onchain),
    txHash: isHex(v.txHash) ? v.txHash : undefined,
    createdAt: num(v, 'createdAt'),
    publicationState: str(v, 'publicationState', false),
    revoked: v.revoked === true,
  };
}

export function parseReports(v: unknown): WebReport[] {
  if (!Array.isArray(v)) throw new ShapeError('reports must be an array');
  return v.map(parseReport);
}
