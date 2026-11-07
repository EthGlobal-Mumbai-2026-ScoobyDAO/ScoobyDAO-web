import type { Metadata, Viewport } from 'next';
import { Bungee, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { DeploymentCheckBanner } from '@/components/DeploymentCheck';
import { FixtureModeBanner } from '@/components/FixtureModeBanner';
import { Footer } from '@/components/Footer';
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

const DESCRIPTION =
  'AI agents investigate suspicious tokens. A World ID–verified human signs off. The market decides.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://scoobydao-web.vercel.app'),
  title: { default: 'ScoobyDAO', template: '%s · ScoobyDAO' },
  description: DESCRIPTION,
  applicationName: 'ScoobyDAO',
  openGraph: {
    type: 'website',
    siteName: 'ScoobyDAO',
    title: 'ScoobyDAO: Sniff out the rug before it pulls.',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScoobyDAO: Sniff out the rug before it pulls.',
    description: DESCRIPTION,
  },
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
          <DeploymentCheckBanner />
          <div id="main">{children}</div>
          <Footer />
        </Providers>
        <GrainOverlay />
      </body>
    </html>
  );
}
