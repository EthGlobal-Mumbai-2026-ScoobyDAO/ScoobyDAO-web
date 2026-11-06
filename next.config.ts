import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // CLAUDE.md §2 page paths → THEME.md §5 routes (see NOTES.md).
  async redirects() {
    return [
      { source: '/reports/:id', destination: '/cases/:id', permanent: false },
      { source: '/claim/:claimId', destination: '/case/:claimId/stake', permanent: false },
      { source: '/market/:claimId', destination: '/case/:claimId/market', permanent: false },
      { source: '/case/:claimId', destination: '/case/:claimId/stake', permanent: false },
    ];
  },
  turbopack: {
    // See src/stubs/cdp-sdk.ts and NOTES.md.
    resolveAlias: { '@coinbase/cdp-sdk': './src/stubs/cdp-sdk.ts' },
  },
};

export default nextConfig;
