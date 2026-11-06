const BASE = 'https://sepolia.etherscan.io';

export const explorer = {
  tx: (hash: string) => `${BASE}/tx/${hash}`,
  address: (addr: string) => `${BASE}/address/${addr}`,
  token: (addr: string) => `${BASE}/token/${addr}`,
  block: (n: bigint | number | string) => `${BASE}/block/${n.toString()}`,
};
