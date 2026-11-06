// Public links for the footer. Repo URLs aren't known yet (no git remotes); add them here.
export const REPOS: { name: string; what: string; url?: string }[] = [
  { name: 'ScoobyDAO-web', what: 'This app' },
  { name: 'ScoobyDAO-backend', what: 'Agents, sign-off gate, API' },
  { name: 'ScoobyDAO-contracts', what: 'Claims, market, v4 freeze hook' },
];

/** Sponsor tech actually used in the demo path (THEME.md §5.1). Names only, no logos. */
export const BUILT_WITH = [
  { name: 'World ID Agent Pass', role: 'human sign-off' },
  { name: 'Uniswap v4', role: 'share pools + freeze hook' },
];
