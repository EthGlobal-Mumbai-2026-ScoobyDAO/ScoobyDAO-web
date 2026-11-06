// Public, build-time config. Only NEXT_PUBLIC_* values are allowed in this repo, and each one is read
// with a literal `process.env.NEXT_PUBLIC_…` so Next.js can inline it.
const protocol = (process.env.NEXT_PUBLIC_PROTOCOL === 'v1' ? 'v1' : 'v2') as 'v1' | 'v2';

export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/web/v1').replace(/\/$/, ''),
  sepoliaRpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined,
  arbSepoliaRpcUrl: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL || undefined,
  /** Empty until a real WalletConnect Cloud id is set; WalletConnect is then left out entirely. */
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  /**
   * Chain mode: `live` (default) talks to the real contracts; `fixture` is the in-memory demo chain.
   * This and NEXT_PUBLIC_PROTOCOL are the only inputs that choose the chain protocol.
   */
  chainMode: (process.env.NEXT_PUBLIC_CHAIN_MODE === 'fixture' ? 'fixture' : 'live') as 'live' | 'fixture',
  /** Contract generation for live mode: `v2` (default, the deployed demo) or `v1`. */
  protocol,
  /** Fixture backend data (cases, approvals). Opt-in only; an unreachable backend never selects it. */
  forceFixtures: process.env.NEXT_PUBLIC_USE_FIXTURES === 'true',
  faucetUrl: process.env.NEXT_PUBLIC_FAUCET_URL || '',
  ccipApiUrl: (process.env.NEXT_PUBLIC_CCIP_API || 'https://api.ccip.chain.link').replace(/\/$/, ''),
  /** /operator (role-gated demo actions through the connected wallet). Off by default. */
  operatorView: process.env.NEXT_PUBLIC_OPERATOR_VIEW === 'true',
  /** V1 only: the World ID reputation badge (Reputation.claimWinnerREP). Not the V2 REP receipt. */
  reputationBadgeEnabled:
    process.env.NEXT_PUBLIC_REPUTATION_BADGE_ENABLED === 'true' || process.env.NEXT_PUBLIC_REP_ENABLED === 'true',
  /** LP add/remove/claim panel. Defaults on for V2. */
  lpEnabled: process.env.NEXT_PUBLIC_LP_ENABLED ? process.env.NEXT_PUBLIC_LP_ENABLED === 'true' : protocol === 'v2',
} as const;
