import { ARB_SEPOLIA_ID } from '@/contracts/addresses';

const BASES: Record<number, { url: string; name: string }> = {
  11155111: { url: 'https://sepolia.etherscan.io', name: 'Etherscan' },
  [ARB_SEPOLIA_ID]: { url: 'https://sepolia.arbiscan.io', name: 'Arbiscan' },
};
const base = (chainId = 11155111) => BASES[chainId] ?? BASES[11155111];

export const explorerName = (chainId?: number) => base(chainId).name;

export const explorer = {
  tx: (hash: string, chainId?: number) => `${base(chainId).url}/tx/${hash}`,
  address: (addr: string, chainId?: number) => `${base(chainId).url}/address/${addr}`,
  token: (addr: string, chainId?: number) => `${base(chainId).url}/token/${addr}`,
  block: (n: bigint | number | string, chainId?: number) => `${base(chainId).url}/block/${n.toString()}`,
  /** CCIP Explorer per-message link, format from the Chainlink CCIP tutorials (Nov 2026). */
  ccip: (messageId: string) => `https://ccip.chain.link/#/side-drawer/msg/${messageId}`,
};

/** Explorer for the token's own chain (reports can be about mainnet tokens). */
const TOKEN_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  [ARB_SEPOLIA_ID]: 'https://sepolia.arbiscan.io',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
};
export const tokenExplorer = (chainId: number, addr: string) =>
  TOKEN_EXPLORERS[chainId] ? `${TOKEN_EXPLORERS[chainId]}/token/${addr}` : undefined;
export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Ethereum Sepolia',
  [ARB_SEPOLIA_ID]: 'Arbitrum Sepolia',
  42161: 'Arbitrum One',
  8453: 'Base',
};
export const chainName = (id: number | null | undefined) =>
  id == null ? 'Unknown chain' : (CHAIN_NAMES[id] ?? `Chain ${id}`);
