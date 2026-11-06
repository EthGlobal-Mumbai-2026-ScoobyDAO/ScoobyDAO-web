'use client';

import { useSyncExternalStore } from 'react';
import { claims, fixtureDeployments, reports } from '@/fixtures';
import type { Hex } from './types';

// In-memory stand-in for the chain, used only in fixtures mode so every stake/market
// state can be exercised without deployed contracts. Mirrors the contract rules that
// matter to the UI (exclusion, commits only while Open, reveal, redeem, freeze).

export const DEMO_WALLETS = {
  honest: '0x5a1f0c3b9e2d4a7186c0e5b3d9f2a4c7e1b8d6f0',
  barred: fixtureDeployments.demo.deployer,
} as const;
export type DemoWallet = keyof typeof DEMO_WALLETS;

interface Position {
  committed: bigint;
  commitment?: Hex;
  forShares: bigint;
  againstShares: bigint;
  redeemed: bigint;
}

const U = 1_000_000n;
const key = (claimId: string, account: string) => `${claimId}:${account.toLowerCase()}`;

const state = {
  usdc: new Map<string, bigint>(),
  allowance: new Map<string, bigint>(),
  positions: new Map<string, Position>([
    [
      key('2', DEMO_WALLETS.honest),
      { committed: 400n * U, forShares: 400n * U, againstShares: 0n, redeemed: 0n },
    ],
    [
      key('3', DEMO_WALLETS.honest),
      { committed: 600n * U, forShares: 600n * U, againstShares: 0n, redeemed: 0n },
    ],
    [
      key('4', DEMO_WALLETS.honest),
      { committed: 250n * U, forShares: 0n, againstShares: 250n * U, redeemed: 0n },
    ],
    [
      key('5', DEMO_WALLETS.honest),
      { committed: 100n * U, forShares: 100n * U, againstShares: 0n, redeemed: 0n },
    ],
  ]),
  totals: new Map(claims.map((c) => [c.claimId, { ...c.totals }])),
  version: 0,
};

const listeners = new Set<() => void>();
function emit() {
  state.version++;
  listeners.forEach((l) => l());
}
export function useFixtureChainVersion() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state.version,
    () => 0,
  );
}

export class FixtureRevert extends Error {
  constructor(public reason: string) {
    super(`Execution reverted: ${reason}`);
  }
}

const statusOf = (claimId: string) => claims.find((c) => c.claimId === claimId)?.status;

export const fixtureChain = {
  usdcBalance: (a: string) => state.usdc.get(a.toLowerCase()) ?? 10_000n * U,
  allowance: (a: string) => state.allowance.get(a.toLowerCase()) ?? 0n,
  position: (claimId: string, a: string): Position =>
    state.positions.get(key(claimId, a)) ?? {
      committed: 0n,
      forShares: 0n,
      againstShares: 0n,
      redeemed: 0n,
    },
  isExcluded: (claimId: string, a: string) => {
    const r = reports.find((x) => x.claimId === claimId);
    return !!r?.manifest.excludedWallets.some((w) => w.toLowerCase() === a.toLowerCase());
  },
  totals: (claimId: string) => state.totals.get(claimId),
  feeBps: () => 300n,

  approve(a: string, amount: bigint) {
    state.allowance.set(a.toLowerCase(), amount);
    emit();
  },
  commit(claimId: string, a: string, commitment: Hex, amount: bigint) {
    if (statusOf(claimId) !== 'Open') throw new FixtureRevert('RiskFi: commits closed');
    if (this.isExcluded(claimId, a)) throw new FixtureRevert('RiskFi: excluded');
    if (amount <= 0n) throw new FixtureRevert('RiskFi: zero amount');
    const p = this.position(claimId, a);
    if (p.committed > 0n) throw new FixtureRevert('RiskFi: already committed');
    if (this.allowance(a) < amount) throw new FixtureRevert('ERC20: insufficient allowance');
    state.allowance.set(a.toLowerCase(), this.allowance(a) - amount);
    state.usdc.set(a.toLowerCase(), this.usdcBalance(a) - amount);
    state.positions.set(key(claimId, a), { ...p, committed: amount, commitment });
    const t = state.totals.get(claimId)!;
    t.committed = String(BigInt(t.committed) + amount);
    emit();
  },
  reveal(claimId: string, a: string, side: 0 | 1, amount: bigint, commitment: Hex) {
    const p = this.position(claimId, a);
    if (p.committed === 0n) throw new FixtureRevert('RiskFi: no commit');
    if (p.forShares + p.againstShares > 0n) throw new FixtureRevert('RiskFi: already revealed');
    if (p.commitment && p.commitment !== commitment) throw new FixtureRevert('RiskFi: bad reveal');
    const next = {
      ...p,
      forShares: side === 0 ? amount : 0n,
      againstShares: side === 1 ? amount : 0n,
    };
    state.positions.set(key(claimId, a), next);
    const t = state.totals.get(claimId)!;
    if (side === 0) t.forRevealed = String(BigInt(t.forRevealed) + amount);
    else t.againstRevealed = String(BigInt(t.againstRevealed) + amount);
    emit();
  },
  redeem(claimId: string, a: string, payout: bigint) {
    const p = this.position(claimId, a);
    if (payout === 0n) throw new FixtureRevert('RiskFi: nothing to redeem');
    state.positions.set(key(claimId, a), {
      ...p,
      forShares: 0n,
      againstShares: 0n,
      redeemed: payout,
    });
    state.usdc.set(a.toLowerCase(), this.usdcBalance(a) + payout);
    emit();
  },
};

export function fakeTxHash(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}
