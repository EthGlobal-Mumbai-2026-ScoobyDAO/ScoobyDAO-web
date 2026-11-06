'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import type { Address, Hex } from 'viem';
import { useAccount } from 'wagmi';
import { useFixturesMode } from '@/lib/queries';
import { fixture, FIXTURE_ACCOUNT, subscribeFixture } from './fixture';
import { ccipPending } from './ccip';
import { selectProtocol } from './index';
import type { Protocol } from './types';

// React bindings. All protocol queries share the ['protocol', kind, …] prefix so a finished
// TxPlan can invalidate them in one call; market/position keys include the block number.

export function useProtocol(): { protocol: Protocol; fixtureMode: boolean; ready: boolean } {
  const mode = useFixturesMode();
  const protocol = selectProtocol(mode.data ?? false);
  return { protocol, fixtureMode: protocol.kind === 'fixture', ready: !mode.isLoading };
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

export function useYtVolume() {
  const { protocol, ready } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, 'ytVolume'],
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
  const { protocol, ready } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, 'published'],
    queryFn: () => protocol.listPublished(),
    enabled: ready,
    refetchInterval: 30_000,
  });
}

export function useMarket(id: bigint | undefined, opts: { poll?: number } = {}) {
  const { protocol, ready } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, 'market', id?.toString()],
    queryFn: () => protocol.getMarket(id!),
    enabled: ready && id !== undefined,
    refetchInterval: opts.poll ?? (protocol.kind === 'fixture' ? 2_000 : 12_000),
    retry: 1,
  });
}

export function usePosition(id: bigint | undefined, block?: bigint) {
  const { protocol, ready } = useProtocol();
  const { address } = useActiveAccount();
  return useQuery({
    queryKey: ['protocol', protocol.kind, 'position', id?.toString(), address, block?.toString()],
    queryFn: () => protocol.getPosition(id!, address!),
    enabled: ready && id !== undefined && !!address,
    placeholderData: (prev) => prev,
  });
}

/** Chain time, refreshed from the latest block and interpolated locally between refreshes. */
export function useChainTime(): number | undefined {
  const { protocol, ready } = useProtocol();
  const q = useQuery({
    queryKey: ['protocol', protocol.kind, 'chainTime'],
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

/** Polls a CCIP message: every 15 s live while pending (2 s in fixture mode). */
export function useCcip(messageId: Hex | undefined) {
  const { protocol, ready } = useProtocol();
  return useQuery({
    queryKey: ['protocol', protocol.kind, 'ccip', messageId],
    queryFn: async () => (await protocol.trackCcip(messageId!)) ?? null,
    enabled: ready && !!messageId,
    refetchInterval: (q) => (ccipPending(q.state.data ?? undefined) ? (protocol.kind === 'fixture' ? 2_000 : 15_000) : false),
  });
}
