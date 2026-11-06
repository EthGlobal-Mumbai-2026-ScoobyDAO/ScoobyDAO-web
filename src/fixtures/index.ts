import { manifestHash } from '@/lib/canonical';
import type { Approval, ClaimView, Deployments, Manifest, Report } from '@/lib/types';

// Realistic demo data matching INTERFACES.md §4 exactly. Times are relative to a fixed
// anchor so builds are deterministic; live-looking countdowns are computed in api.ts.
export const ANCHOR = 1762480000; // 2025-11-07 ~01:46 UTC, close to the demo weekend

const SEPOLIA = 11155111;
const DAY = 86400;

const addr = (seed: string) => `0x${seed.padEnd(40, seed).slice(0, 40)}` as const;
const h32 = (seed: string) => `0x${seed.padEnd(64, seed).slice(0, 64)}` as const;

export const TOKENS = {
  honeypot: '0x7a3f9c21e4b85d06a1c3e9f2b47d8065c1e2a9f3',
  shellfish: '0x4c19be07d3a26f81e5904c7ab2d6e3f8019a7c52',
  moonbag: '0xb2e8d4106f9a3c57e0d81b2a4c6f9e3d7a05b18e',
  pawprint: '0x91d0a6e3c4b7f2850e1a9d3c6b4f7e2a8d5c0b39',
  ferret: '0x3e7b5a9d1c0f4e86b2a7d9c3e5f1a0b8c6d4e2f7',
  lantern: '0xd5a1c8e04b7f3926a0e5d8c1b4f7a2e9c3d6b0f1',
  honest: '0x2f6c9e1a4d8b3075f2c6e9a1d4b8c3f7e0a5d9b2',
  gravel: '0x8b4e1d7a0c3f6952e8b1d4a7c0f3e6b9a2d5c8f1',
  crumb: '0x60c3f9b2e5a8d1074c7f0a3e6b9d2c5f8a1e4b07',
} as const;

const DEPLOYER = '0xdead1d0a5c2e7b94f3a1c6e8d2b5f9a0c4e7d3b1';
const FUNDER = '0xf00d5e2b8a1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e';

function manifest(token: string, claims: Manifest['claims'], evidence: Manifest['evidence'], summary: string, excluded: string[], createdAt: number): Manifest {
  return { version: 1, chainId: SEPOLIA, token, claims, evidence, summary, excludedWallets: excluded, windowSeconds: 3 * DAY, createdAt };
}

const sellReverts = manifest(
  TOKENS.honeypot,
  [
    { id: 0, type: 'SELL_REVERTS', params: { minSellTaxBps: 9000 } },
    { id: 1, type: 'OWNER_CAN_PAUSE_OR_BLACKLIST', params: { function: 'setTrap(bool)' } },
  ],
  [
    { kind: 'simulation', result: 'revert', detail: 'Fresh wallet bought 1,000 tokens, then a sell of 1,000 to the pool reverted with "TRANSFER_FAILED".' },
    { kind: 'simulation', result: 'pass', detail: 'The deployer wallet sold 50,000 tokens to the same pool in the same block without a revert.' },
    { kind: 'bytecode', result: 'match', detail: 'Owner-only setTrap(bool) gates transfers from non-owner addresses to the pool.' },
    { kind: 'funding', result: 'linked', detail: `Deployer ${DEPLOYER.slice(0, 10)}… was funded 0.8 ETH by ${FUNDER.slice(0, 10)}… 40 minutes before deploy.` },
  ],
  'Normal wallets can buy this token but cannot sell it. Only the owner can sell, and the owner can switch the trap on and off. The deployer was funded by a wallet that did the same thing on an earlier token.',
  [DEPLOYER, FUNDER],
  ANCHOR - 2 * 3600,
);

const highTax = manifest(
  TOKENS.shellfish,
  [{ id: 0, type: 'SELL_TAX_ABOVE', params: { thresholdBps: 2500, observedBps: 4900 } }],
  [
    { kind: 'simulation', result: 'tax', detail: 'Selling 1,000 tokens returned 510 worth of ETH: a 49% sell tax.' },
    { kind: 'source', result: 'match', detail: 'sellFee is owner-settable with no upper bound.' },
  ],
  'Sells lose about half their value to a hidden tax, and the owner can raise it at any time.',
  [addr('5ee1'), addr('c0ffee')],
  ANCHOR - 3 * DAY,
);

const pausable = manifest(
  TOKENS.moonbag,
  [{ id: 0, type: 'OWNER_CAN_PAUSE_OR_BLACKLIST', params: { function: 'blacklist(address,bool)' } }],
  [
    { kind: 'bytecode', result: 'match', detail: 'blacklist(address,bool) callable by owner; blocked addresses cannot transfer.' },
    { kind: 'simulation', result: 'revert', detail: 'After the owner blacklisted a test wallet, its transfer reverted.' },
  ],
  'The owner can stop any wallet from moving its tokens.',
  [addr('ba9e1')],
  ANCHOR - 5 * DAY,
);

const cleared = manifest(
  TOKENS.pawprint,
  [{ id: 0, type: 'SELL_REVERTS', params: { minSellTaxBps: 9000 } }],
  [{ kind: 'simulation', result: 'revert', detail: 'A sell reverted once during a liquidity migration; later sells went through.' }],
  'One failed sell looked like a trap, but it happened during a liquidity move. Later sells worked.',
  [addr('aa77')],
  ANCHOR - 6 * DAY,
);

const oneSided = manifest(
  TOKENS.ferret,
  [{ id: 0, type: 'SELL_TAX_ABOVE', params: { thresholdBps: 2000, observedBps: 2300 } }],
  [{ kind: 'simulation', result: 'tax', detail: 'Selling 1,000 tokens returned 770 worth of ETH: a 23% sell tax.' }],
  'Sell tax measured just above the 20% threshold.',
  [],
  ANCHOR - 7 * DAY,
);

const draft = manifest(
  TOKENS.lantern,
  [{ id: 0, type: 'SELL_REVERTS', params: { minSellTaxBps: 9000 } }],
  [{ kind: 'simulation', result: 'revert', detail: 'Sell of 500 tokens from a fresh wallet reverted with "Pausable: paused".' }],
  'Sells are failing for fresh wallets. Waiting on a second simulation before asking for sign-off.',
  [addr('1a7e')],
  ANCHOR - 20 * 60,
);

const awaiting = manifest(
  TOKENS.honest,
  [{ id: 0, type: 'SELL_TAX_ABOVE', params: { thresholdBps: 3000, observedBps: 9900 } }],
  [
    { kind: 'simulation', result: 'tax', detail: 'Selling 1,000 tokens returned 10 worth of ETH: a 99% sell tax.' },
    { kind: 'funding', result: 'linked', detail: 'Deployer funded through a fresh wallet that received ETH from a mixer withdrawal.' },
  ],
  'A 99% sell tax means a seller keeps almost nothing. Waiting for a human reviewer to sign off.',
  [addr('d00d'), addr('beef')],
  ANCHOR - 15 * 60,
);

const denied = manifest(
  TOKENS.gravel,
  [{ id: 0, type: 'OWNER_CAN_PAUSE_OR_BLACKLIST', params: { function: 'pause()' } }],
  [{ kind: 'bytecode', result: 'match', detail: 'pause() exists and is owner-only, but ownership is renounced to 0x0.' }],
  'Has a pause function, but nobody owns the contract any more, so it cannot be used.',
  [],
  ANCHOR - DAY,
);

const expired = manifest(
  TOKENS.crumb,
  [{ id: 0, type: 'SELL_REVERTS', params: { minSellTaxBps: 9000 } }],
  [{ kind: 'simulation', result: 'revert', detail: 'Sell reverted for a fresh wallet.' }],
  'Sells revert for a fresh wallet. The sign-off window ran out before a reviewer approved.',
  [addr('e0e0')],
  ANCHOR - 2 * DAY,
);

function report(id: string, m: Manifest, rest: Omit<Report, 'id' | 'token' | 'chainId' | 'manifest' | 'manifestHash' | 'createdAt'>): Report {
  return { id, token: m.token, chainId: SEPOLIA, manifest: m, manifestHash: manifestHash(m), createdAt: m.createdAt, ...rest };
}

export const reports: Report[] = [
  report('rpt-honeypot', sellReverts, { status: 'published', approvalId: 'apr-approved', claimId: '1', txHash: h32('a11ce') }),
  report('rpt-shellfish', highTax, { status: 'published', approvalId: 'apr-spent', claimId: '2', txHash: h32('b0b') }),
  report('rpt-moonbag', pausable, { status: 'published', approvalId: 'apr-moonbag', claimId: '3', txHash: h32('ca5e') }),
  report('rpt-pawprint', cleared, { status: 'published', approvalId: 'apr-pawprint', claimId: '4', txHash: h32('d1ce') }),
  report('rpt-ferret', oneSided, { status: 'published', approvalId: 'apr-ferret', claimId: '5', txHash: h32('e66') }),
  report('rpt-lantern', draft, { status: 'draft' }),
  report('rpt-honest', awaiting, { status: 'awaiting_approval', approvalId: 'apr-pending' }),
  report('rpt-gravel', denied, { status: 'denied', approvalId: 'apr-denied' }),
  report('rpt-crumb', expired, { status: 'expired', approvalId: 'apr-expired' }),
];

const reportById = (id: string) => reports.find((r) => r.id === id)!;

/** expiresAt is filled in at request time for "live" approvals (see api.ts). */
export const approvals: Approval[] = [
  { id: 'apr-pending', reportId: 'rpt-honest', manifestHash: reportById('rpt-honest').manifestHash, status: 'pending', userCode: 'HWKD-7QXP', verificationUri: 'https://world.org/verify?code=HWKD-7QXP', expiresAt: 0 },
  { id: 'apr-approved', reportId: 'rpt-honeypot', manifestHash: reportById('rpt-honeypot').manifestHash, status: 'approved', userCode: 'SNFF-42MZ', verificationUri: 'https://world.org/verify?code=SNFF-42MZ', expiresAt: ANCHOR - 2 * 3600 + 600, publishTxHash: h32('a11ce') },
  { id: 'apr-spent', reportId: 'rpt-shellfish', manifestHash: reportById('rpt-shellfish').manifestHash, status: 'spent', userCode: 'TRAP-9KLC', verificationUri: 'https://world.org/verify?code=TRAP-9KLC', expiresAt: ANCHOR - 3 * DAY + 600, publishTxHash: h32('b0b') },
  { id: 'apr-denied', reportId: 'rpt-gravel', manifestHash: reportById('rpt-gravel').manifestHash, status: 'denied', userCode: 'MASK-3RTV', verificationUri: 'https://world.org/verify?code=MASK-3RTV', expiresAt: ANCHOR - DAY + 600 },
  { id: 'apr-expired', reportId: 'rpt-crumb', manifestHash: reportById('rpt-crumb').manifestHash, status: 'expired', userCode: 'FOGG-8WEN', verificationUri: 'https://world.org/verify?code=FOGG-8WEN', expiresAt: ANCHOR - 2 * DAY + 600 },
  { id: 'apr-not-reviewer', reportId: 'rpt-honest', manifestHash: reportById('rpt-honest').manifestHash, status: 'rejected_not_reviewer', userCode: 'CLUE-5HAB', verificationUri: 'https://world.org/verify?code=CLUE-5HAB', expiresAt: ANCHOR + 600 },
  // Demo helper: starts pending, flips to approved ~12s after first poll (see api.ts).
  { id: 'apr-live', reportId: 'rpt-honest', manifestHash: reportById('rpt-honest').manifestHash, status: 'pending', userCode: 'LIVE-2DMO', verificationUri: 'https://world.org/verify?code=LIVE-2DMO', expiresAt: 0 },
];

const usdc = (n: number) => String(Math.round(n * 1_000_000));

export const claims: ClaimView[] = [
  {
    claimId: '1', token: TOKENS.honeypot, status: 'Open', windowEnd: 0,
    totals: { committed: usdc(4200), forRevealed: usdc(1800), againstRevealed: usdc(950) },
    shareTokens: { for: addr('f0a1'), against: addr('a9a1') }, pools: { for: h32('9001'), against: h32('9002') },
    impliedForProbability: 0.68,
  },
  {
    claimId: '2', token: TOKENS.shellfish, status: 'Frozen', windowEnd: ANCHOR + 3600, frozenAt: ANCHOR - 1800,
    totals: { committed: usdc(9150), forRevealed: usdc(5400), againstRevealed: usdc(3600) },
    shareTokens: { for: addr('f0b2'), against: addr('a9b2') }, pools: { for: h32('9003'), against: h32('9004') },
    impliedForProbability: 0.91, evidenceHash: h32('e1d3'), triggerTxHash: h32('7a1c'),
  },
  {
    claimId: '3', token: TOKENS.moonbag, status: 'ResolvedPass', windowEnd: ANCHOR - DAY, frozenAt: ANCHOR - 3 * DAY,
    totals: { committed: usdc(6000), forRevealed: usdc(3600), againstRevealed: usdc(2400) },
    shareTokens: { for: addr('f0c3'), against: addr('a9c3') }, pools: { for: h32('9005'), against: h32('9006') },
    impliedForProbability: 1, evidenceHash: h32('e2d4'), triggerTxHash: h32('7b2d'),
  },
  {
    claimId: '4', token: TOKENS.pawprint, status: 'ResolvedFail', windowEnd: ANCHOR - 3 * DAY,
    totals: { committed: usdc(2500), forRevealed: usdc(700), againstRevealed: usdc(1800) },
    shareTokens: { for: addr('f0d4'), against: addr('a9d4') }, pools: { for: h32('9007'), against: h32('9008') },
    impliedForProbability: 0.12,
  },
  {
    claimId: '5', token: TOKENS.ferret, status: 'Refunded', windowEnd: ANCHOR - 4 * DAY,
    totals: { committed: usdc(800), forRevealed: usdc(800), againstRevealed: '0' },
    shareTokens: { for: addr('f0e5'), against: addr('a9e5') }, pools: {},
  },
];

export const fixtureDeployments: Deployments = {
  chainId: SEPOLIA,
  deployedAt: '2026-11-07T10:00:00Z',
  commit: 'fixture',
  contracts: {
    ClaimRegistry: addr('c1a1'), VerdictMarket: addr('7e2d'), FreezeHook: addr('f2ee'), Treasury: addr('7ea5'),
    USDC: addr('05dc'), HoneypotToken: TOKENS.honeypot, HonestToken: TOKENS.honest, PoolManager: addr('9001'), SwapRouter: addr('5a9e'),
  },
  roles: { publisher: addr('9b11'), resolver: addr('9e50') },
  demo: { deployer: DEPLOYER, funder: FUNDER },
};

/** Fixture-only extra: block numbers for frozen claims (ClaimView has no block field; see NOTES.md). */
export const frozenBlocks: Record<string, number> = { '2': 7_412_388, '3': 7_390_112 };
