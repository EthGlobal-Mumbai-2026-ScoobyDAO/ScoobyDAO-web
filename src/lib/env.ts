// Public, build-time config. Only NEXT_PUBLIC_* values are allowed in this repo.
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111),
  sepoliaRpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'scoobydao-dev',
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  forceFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
} as const;
