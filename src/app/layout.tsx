import type { Metadata, Viewport } from 'next';
import { Bungee, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { GrainOverlay } from '@/components/GrainOverlay';
import { NavBar } from '@/components/NavBar';
import { themeInitScript } from '@/components/ThemeToggle';
import './globals.css';
import { Providers } from './providers';

const bungee = Bungee({ weight: '400', subsets: ['latin'], variable: '--font-bungee', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Unmasked', template: '%s · Unmasked' },
  description:
    'Sniff and a pack of AI agents follow the evidence on scam tokens. A verified human signs off, then the market decides.',
};

export const viewport: Viewport = { themeColor: '#0B1026' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bungee.variable} ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-beam focus:px-3 focus:py-2 focus:text-on-beam">
          Skip to content
        </a>
        <Providers>
          <NavBar />
          <div id="main">{children}</div>
        </Providers>
        <GrainOverlay />
      </body>
    </html>
  );
}
