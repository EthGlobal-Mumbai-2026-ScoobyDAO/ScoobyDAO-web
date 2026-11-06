// Public links for the footer. Internal repo names stay out of user-facing text; add URLs here
// once the public repos exist.
export const REPOS: { name: string; what: string; url?: string }[] = [
  { name: 'Web app', what: 'This app' },
  { name: 'Backend', what: 'Research agents, human approval gate, API' },
  { name: 'Contracts', what: 'Report registry, Yes/No market, settlement, YT market, CCIP' },
];

/** Sponsor tech in the demo path. Text labels only, no logos. */
export const BUILT_WITH = [
  { name: 'World', role: 'human approval' },
  { name: 'Chainlink CCIP', role: 'stake from another chain' },
  { name: 'Uniswap v4', role: 'trade the yield' },
];
