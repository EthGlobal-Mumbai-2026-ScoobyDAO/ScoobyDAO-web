// Web-side shapes. ReportV02 is generated from the backend's frozen schema; WebReport, ClaimManifest
// and Approval are what src/lib/api.ts hands to pages after normalising GET /web/v1 responses.
// See INTERFACES.md (v2, Nov 2026) and NOTES.md "Revamp (Nov 2026)" for unconfirmed fields.
import type { ScoobyDAOReportCheckpointProposalV02 } from './report.generated';

export type Hex = `0x${string}`;
export type ReportV02 = ScoobyDAOReportCheckpointProposalV02;
export type PillarKey = keyof ReportV02['pillars'];
export type Pillar = ReportV02['pillars'][PillarKey];
export type Evidence = ReportV02['evidence'][number];
export type Artifact = ReportV02['artifacts'][number];
export type ReportClaim = Pillar['claims'][number];

/** publication/canonical.py fills missing text with this. */
export const NOT_STATED = 'not stated';

export const PILLARS: PillarKey[] = ['microstructure', 'onchain', 'fundamentals', 'statistical_risk', 'technical_health'];

/**
 * scooby.claim-manifest/1, built by ScoobyDAO-backend/publication/canonical.py. The reviewer
 * approves exactly this record; claimHash = sha256(canonical JSON of it).
 * The backend doesn't emit measurementMethod / observationWindow / voidRule yet (NOTES.md);
 * the UI shows "not stated" for them.
 */
export interface ClaimManifest {
  schema?: string;
  version?: number;
  title: string;
  chainId: number;
  token: string;
  symbol?: string;
  claimText: string;
  assessmentStatus?: string;
  claims?: { id: number; type: string; params: Record<string, string | number | boolean> }[];
  evidence?: { kind: string; result: string; detail: string }[];
  summary?: string;
  windowSeconds?: number;
  createdAt?: number;
  reportId?: string;
  reportVersion?: string;
  reportSha256: string;
  measurementMethod?: string;
  observationWindow?: string;
  voidRule?: string;
  /** Kept only because it is part of the hashed record; not used by the UI. */
  excludedWallets?: string[];
}

export type ReportStatus = 'draft' | 'awaiting_approval' | 'denied' | 'expired' | 'published';

export interface WebReport {
  /** `report_id@version`, the backend's web id. */
  id: string;
  reportId: string;
  version: string;
  status: ReportStatus;
  report?: ReportV02;
  claimManifest: ClaimManifest;
  /** Hex SHA-256 of the exact report.json bytes (no 0x). */
  reportSha256: string;
  /** 0x-prefixed bytes32 of the canonical claim manifest digest. */
  claimHash: Hex;
  targetDigest?: string;
  approvalId?: string;
  onchainReportId?: string;
  txHash?: Hex;
  createdAt: number;
  publicationState?: string;
  revoked?: boolean;
}

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'rejected_not_reviewer'
  | 'spent'
  | 'error';

export interface Approval {
  id: string;
  reportId: string;
  status: ApprovalStatus;
  userCode?: string;
  verificationUri?: string;
  verificationUriComplete?: string;
  expiresAt: number;
  /** May be absent when the backend only sends manifestHash (it then equals claimHash). */
  reportSha256?: string;
  claimHash: Hex;
  publishTxHash?: Hex;
  onchainReportId?: string;
  demoIdentity?: boolean;
  detail?: string;
}

/** Proposed POST /web/v1/rep/authorize response (doesn't exist yet; NOTES.md). */
export interface RepAuthorizeResponse {
  reportId: string;
  recipient: Hex;
  scopedNullifier: Hex;
  nonce: string;
  expiry: number;
  signature: Hex;
}
