// Public, build-time config. Only NEXT_PUBLIC_* values are allowed in this repo.
export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/web/v1').replace(/\/$/, ''),
  sepoliaRpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined,
  arbSepoliaRpcUrl: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL || undefined,
  /** Empty until a real WalletConnect Cloud id is set; WalletConnect is then left out entirely. */
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  forceFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
  protocol: (process.env.NEXT_PUBLIC_PROTOCOL === 'v2' ? 'v2' : 'v1') as 'v1' | 'v2',
  faucetUrl: process.env.NEXT_PUBLIC_FAUCET_URL || '',
  repEnabled: process.env.NEXT_PUBLIC_REP_ENABLED === 'true',
  lpEnabled: process.env.NEXT_PUBLIC_LP_ENABLED === 'true',
} as const;
