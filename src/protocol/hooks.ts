'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Address, Hex } from 'viem';
import { useAccount } from 'wagmi';
import { fixture, FIXTURE_ACCOUNT, subscribeFixture } from './fixture';
import { ccipPending, subscribeTracked, trackedSnapshot, type TrackedCcip } from './ccip';
import { deploymentQueryFor, writeBlockReason } from './deployment';
import { selectProtocol } from './index';
import type { Protocol } from './types';
import { v2Flexible } from './v2';

// React bindings. All protocol queries share the ['protocol', kind, …] prefix so a finished
// TxPlan can invalidate them in one call; market/position keys include the block number.

/** The chain protocol, from env only (NEXT_PUBLIC_CHAIN_MODE + NEXT_PUBLIC_PROTOCOL). */
const ProtocolOverride = createContext<Protocol | null>(null);
export function ProtocolOverrideProvider({ protocol, children }: { protocol: Protocol; children: ReactNode }) {
  return createElement(ProtocolOverride.Provider, { value: protocol }, children);
}

export function useProtocol(): { protocol: Protocol; fixtureMode: boolean; ready: boolean; deploymentKey: string } {
  const protocol = useContext(ProtocolOverride) ?? selectProtocol();
  return { protocol, fixtureMode: protocol.kind === 'fixture', ready: true, deploymentKey: protocol.kind === 'v2' ? (protocol as typeof v2Flexible).deploymentKey : 'default' };
}

/** Mounted once (Providers): fixture-chain writes refresh every protocol query. */
export function useFixtureSync() {
  const { protocol } = useProtocol();
  const qc = useQueryClient();
  useEffect(() => {
    if (protocol.kind !== 'fixture') return;
    const unsubscribe = subscribeFixture(() => void qc.invalidateQueries({ queryKey: ['protocol'] }));
    return () => {
      unsubscribe();
    };
  }, [protocol.kind, qc]);
}

/** V2 only: the once-per-session check that the chain matches the handoff bundle. */
export function useDeploymentCheck() {
  const { protocol } = useProtocol();
  return useQuery({ ...deploymentQueryFor((protocol as typeof v2Flexible).deploymentBundle), enabled: protocol.kind === 'v2' });
}

/** Whether wallet writes may run. V2 writes wait for a passing deployment check. */
export function useWritesAllowed(): { allowed: boolean; reason?: string } {
  const { protocol } = useProtocol();
  const check = useDeploymentCheck();
  if (protocol.kind !== 'v2') return { allowed: true };
  const reason = writeBlockReason(check.data, check.error);
  return { allowed: !reason, reason };
}

export function useYtVolume() {
  const { protocol, ready, deploymentKey } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'ytVolume'],
    queryFn: async () => (protocol.ytVolume ? ((await protocol.ytVolume()) ?? null) : null),
    enabled: ready,
    refetchInterval: 60_000,
  });
}

/** The connected wallet; in fixture mode without a wallet, the fixture's demo account. */
export function useActiveAccount(): { address?: Address; connected: boolean; isFixtureAccount: boolean; chainId?: number } {
  const { address, chainId } = useAccount();
  const { fixtureMode } = useProtocol();
  const a = address ?? (fixtureMode ? FIXTURE_ACCOUNT : undefined);
  useEffect(() => {
    if (fixtureMode && a) fixture.account = a;
  }, [fixtureMode, a]);
  return { address: a, connected: !!address, isFixtureAccount: fixtureMode && !address, chainId };
}

export function usePublished() {
  const { protocol, ready, deploymentKey } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'published'],
    queryFn: () => protocol.listPublished(),
    enabled: ready,
    refetchInterval: 30_000,
  });
}

export function useMarket(id: bigint | undefined, opts: { poll?: number } = {}) {
  const { protocol, ready, deploymentKey } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'market', id?.toString()],
    queryFn: () => protocol.getMarket(id!),
    enabled: ready && id !== undefined,
    refetchInterval: opts.poll ?? (protocol.kind === 'fixture' ? 2_000 : 12_000),
    retry: 1,
  });
}

export function usePosition(id: bigint | undefined, block?: bigint) {
  const { protocol, ready, deploymentKey } = useProtocol();
  const { address } = useActiveAccount();
  return useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'position', id?.toString(), address, block?.toString()],
    queryFn: () => protocol.getPosition(id!, address!),
    enabled: ready && id !== undefined && !!address,
    placeholderData: (prev) => prev,
  });
}

/** Chain time, refreshed from the latest block and interpolated locally between refreshes. */
export function useChainTime(): number | undefined {
  const { protocol, ready, deploymentKey } = useProtocol();
  const q = useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'chainTime'],
    queryFn: async () => ({ chain: await protocol.chainTime(), at: Date.now() }),
    enabled: ready,
    refetchInterval: protocol.kind === 'fixture' ? 5_000 : 12_000,
  });
  const local = useSyncExternalStore(subscribeSecond, nowSecond, () => 0);
  if (!q.data || local === 0) return q.data?.chain;
  return q.data.chain + Math.max(0, local - Math.floor(q.data.at / 1000));
}

// One shared 1 Hz clock used only to interpolate between chain-time refreshes.
const nowSecond = () => Math.floor(Date.now() / 1000);
function subscribeSecond(cb: () => void) {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
}

/** CCIP messages this browser sent (localStorage), optionally for one report. Chain state stays the source of truth. */
export function useTrackedCcip(reportId?: bigint): TrackedCcip[] {
  const raw = useSyncExternalStore(subscribeTracked, trackedSnapshot, () => '[]');
  let list: TrackedCcip[] = [];
  try {
    const v = JSON.parse(raw) as unknown;
    list = Array.isArray(v) ? (v as TrackedCcip[]) : [];
  } catch {
    list = [];
  }
  return reportId === undefined ? list : list.filter((t) => t.reportId === reportId.toString());
}

/** Polls a CCIP message: every 15 s while it can still change (2 s in fixture mode). */
export function useCcip(messageId: Hex | undefined) {
  const { protocol, ready, deploymentKey } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, deploymentKey, 'ccip', messageId],
    queryFn: async () => (await protocol.trackCcip(messageId!)) ?? null,
    enabled: ready && !!messageId,
    refetchInterval: (q) => (ccipPending(q.state.data ?? undefined) ? (protocol.kind === 'fixture' ? 2_000 : 15_000) : false),
  });
}
