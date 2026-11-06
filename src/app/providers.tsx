'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { ApiError } from '@/lib/api';
import { TxProvider } from '@/lib/tx';
import { wagmiConfig } from '@/lib/wagmi';
import { AdminSessionProvider } from '@/components/AdminSession';
import { useFixtureSync } from '@/protocol/hooks';

function FixtureSync() {
  useFixtureSync();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // A missing record won't appear on retry; transient failures get one more try.
          queries: { retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 1 },
        },
      }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#FFC857',
            accentColorForeground: '#0B1026',
            borderRadius: 'medium',
          })}
        >
          <TxProvider>
            <FixtureSync />
            <AdminSessionProvider>{children}</AdminSessionProvider>
          </TxProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
