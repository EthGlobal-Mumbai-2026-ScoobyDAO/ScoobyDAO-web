import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // See src/stubs/cdp-sdk.ts and NOTES.md.
    resolveAlias: { '@coinbase/cdp-sdk': './src/stubs/cdp-sdk.ts' },
  },
};

export default nextConfig;
