import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Old route names → current routes (NOTES.md "Revamp (Nov 2026)").
  async redirects() {
    return [
      { source: '/claim/:id', destination: '/case/:id/stake', permanent: false },
      { source: '/market/:id', destination: '/case/:id/market', permanent: false },
      { source: '/case/:id', destination: '/case/:id/stake', permanent: false },
    ];
  },
  turbopack: {
    // See src/stubs/cdp-sdk.ts and NOTES.md.
    resolveAlias: { '@coinbase/cdp-sdk': './src/stubs/cdp-sdk.ts' },
  },
};

export default nextConfig;
