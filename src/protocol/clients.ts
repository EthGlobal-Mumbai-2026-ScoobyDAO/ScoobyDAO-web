import { createPublicClient, http, type PublicClient } from 'viem';
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

/** Most public RPCs cap eth_getLogs ranges; history lookups use a bounded recent window. */
export const LOG_WINDOW = 50_000n;
export async function recentFrom(client: PublicClient, window = LOG_WINDOW): Promise<bigint> {
  const latest = await client.getBlockNumber();
  return latest > window ? latest - window : 0n;
}
