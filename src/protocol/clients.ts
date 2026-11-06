import { createPublicClient, formatLog, http, type Abi, type Address, type Log, type PublicClient } from 'viem';
import { arbitrumSepolia, sepolia } from 'viem/chains';
import { env } from '@/lib/env';

// Read-only clients. Writes go through the connected wallet (src/lib/tx.tsx).
let eth: PublicClient | undefined;
let arb: PublicClient | undefined;

export function sepoliaClient(): PublicClient {
  eth ??= createPublicClient({ chain: sepolia, transport: http(env.sepoliaRpcUrl), batch: { multicall: true } }) as PublicClient;
  return eth;
}

export function arbClient(): PublicClient {
  arb ??= createPublicClient({ chain: arbitrumSepolia, transport: http(env.arbSepoliaRpcUrl), batch: { multicall: true } }) as PublicClient;
  return arb;
}

export const clientFor = (chainId: number): PublicClient => (chainId === arbitrumSepolia.id ? arbClient() : sepoliaClient());

/** One contract read inside a multicall. */
export interface ReadCall {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}
export type ReadResult = { ok: true; result: unknown } | { ok: false; error: string };

/** Multicall with per-call failure (heterogeneous calls, so the result types are checked by the caller). */
export async function multicallLoose(client: PublicClient, calls: ReadCall[], blockNumber?: bigint): Promise<ReadResult[]> {
  const res = (await client.multicall({ contracts: calls as never, allowFailure: true, ...(blockNumber ? { blockNumber } : {}) })) as {
    status: 'success' | 'failure';
    result?: unknown;
    error?: { shortMessage?: string; message: string };
  }[];
  return res.map((r) => (r.status === 'success' ? { ok: true, result: r.result } : { ok: false, error: r.error?.shortMessage ?? r.error?.message ?? 'call failed' }));
}

/**
 * Public RPCs cap eth_getLogs: viem's default Sepolia RPC allows 1,000 blocks per request and
 * publicnode prunes older history. History reads therefore walk bounded windows in 1,000-block chunks.
 */
export const LOG_CHUNK = 1_000n;
export const LOG_WINDOW = 5_000n;

export async function recentFrom(client: PublicClient, window = LOG_WINDOW): Promise<bigint> {
  const latest = await client.getBlockNumber();
  return latest > window ? latest - window : 0n;
}

/**
 * eth_getLogs over [fromBlock, toBlock] in ≤ LOG_CHUNK pieces, oldest first, at most `maxChunks`
 * requests. Stops early once `stop(logs)` returns true. Never scans an unbounded range.
 */
export async function getLogsChunked(
  client: PublicClient,
  filter: { address: Address; topics?: (`0x${string}` | `0x${string}`[] | null)[] },
  range: { fromBlock: bigint; toBlock: bigint; maxChunks?: number; stop?: (logs: Log[]) => boolean },
): Promise<{ logs: Log[]; scannedTo: bigint; complete: boolean }> {
  const logs: Log[] = [];
  const max = range.maxChunks ?? 8;
  let from = range.fromBlock;
  for (let i = 0; i < max && from <= range.toBlock; i++) {
    const to = from + LOG_CHUNK - 1n < range.toBlock ? from + LOG_CHUNK - 1n : range.toBlock;
    // Raw request: viem's getLogs can't OR several event signatures while filtering an indexed topic.
    const chunk = (await client.request({
      method: 'eth_getLogs',
      params: [{ address: filter.address, topics: filter.topics, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    } as never)) as Parameters<typeof formatLog>[0][];
    logs.push(...chunk.map((l) => formatLog(l)));
    from = to + 1n;
    if (range.stop?.(logs)) return { logs, scannedTo: to, complete: true };
  }
  return { logs, scannedTo: from - 1n, complete: from > range.toBlock };
}

/** Rough Sepolia block at a past timestamp (12 s slots; missed slots make this land earlier, which is safe for forward scans). */
export function estimateBlockAt(latest: { number: bigint; timestamp: bigint }, at: number, slotSeconds = 12): bigint {
  const ago = Number(latest.timestamp) - at;
  if (ago <= 0) return latest.number;
  const back = BigInt(Math.ceil(ago / slotSeconds)) + 25n;
  return latest.number > back ? latest.number - back : 0n;
}
