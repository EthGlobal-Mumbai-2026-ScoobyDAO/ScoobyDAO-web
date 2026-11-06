// Mirrors INTERFACES.md §2–4 exactly. Don't change shapes here; change INTERFACES.md first.

export type Hex = `0x${string}`;

export type ClaimType = 'SELL_REVERTS' | 'SELL_TAX_ABOVE' | 'OWNER_CAN_PAUSE_OR_BLACKLIST';

/** INTERFACES.md §3 (the doc shows JSON; field types inferred from the example). */
export interface ManifestClaim {
  id: number;
  type: ClaimType;
  params: Record<string, number | string | boolean>;
}
export interface ManifestEvidence {
  kind: string;
  result: string;
  detail: string;
}
export interface Manifest {
  version: number;
  chainId: number;
  token: string;
  claims: ManifestClaim[];
  evidence: ManifestEvidence[];
  summary: string;
  excludedWallets: string[];
  windowSeconds: number;
  createdAt: number;
}

export type ReportStatus = 'draft' | 'awaiting_approval' | 'denied' | 'expired' | 'published';
export interface Report {
  id: string;
  token: string;
  chainId: number;
  status: ReportStatus;
  manifest: Manifest;
  manifestHash: `0x${string}`;
  approvalId?: string;
  claimId?: string;
  txHash?: `0x${string}`;
  createdAt: number;
}

export type ApprovalStatus =
  'pending' | 'approved' | 'denied' | 'expired' | 'rejected_not_reviewer' | 'spent';
export interface Approval {
  id: string;
  reportId: string;
  manifestHash: `0x${string}`;
  status: ApprovalStatus;
  userCode?: string;
  verificationUri?: string;
  expiresAt: number;
  publishTxHash?: `0x${string}`;
}

export type ClaimStatus = 'Open' | 'Frozen' | 'ResolvedPass' | 'ResolvedFail' | 'Refunded';
export interface ClaimView {
  claimId: string;
  token: string;
  status: ClaimStatus;
  windowEnd: number;
  frozenAt?: number;
  totals: { committed: string; forRevealed: string; againstRevealed: string };
  shareTokens: { for: string; against: string };
  pools: { for?: string; against?: string };
  impliedForProbability?: number;
  evidenceHash?: string;
  triggerTxHash?: string;
}

export interface Deployments {
  chainId: number;
  deployedAt: string;
  commit: string;
  contracts: {
    ClaimRegistry: Hex;
    VerdictMarket: Hex;
    FreezeHook: Hex;
    Treasury: Hex;
    USDC: Hex;
    HoneypotToken: Hex;
    HonestToken: Hex;
    PoolManager: Hex;
    SwapRouter: Hex;
  };
  roles: { publisher: Hex; resolver: Hex };
  demo: { deployer: Hex; funder: Hex };
}

/** Onchain enums (INTERFACES.md §2). */
export enum Side {
  For = 0,
  Against = 1,
}
export const CHAIN_STATUS = [
  'None',
  'Open',
  'Frozen',
  'ResolvedPass',
  'ResolvedFail',
  'Refunded',
] as const;
