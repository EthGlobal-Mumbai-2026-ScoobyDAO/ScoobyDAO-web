import type { Metadata, Viewport } from 'next';
import { Bungee, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { FixtureModeBanner } from '@/components/FixtureModeBanner';
import { GrainOverlay } from '@/components/GrainOverlay';
import { NavBar } from '@/components/NavBar';
import { themeInitScript } from '@/components/ThemeToggle';
import './globals.css';
import { Providers } from './providers';

const bungee = Bungee({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee',
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Unmasked', template: '%s · Unmasked' },
  description:
    'Sniff and a pack of AI agents research tokens. A verified human approves each report, then people stake Yes or No and the result settles onchain.',
};

export const viewport: Viewport = { themeColor: '#0B1026' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="focus:bg-beam focus:text-on-beam sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>
          <NavBar />
          <FixtureModeBanner />
          <div id="main">{children}</div>
        </Providers>
        <GrainOverlay />
      </body>
    </html>
  );
}
