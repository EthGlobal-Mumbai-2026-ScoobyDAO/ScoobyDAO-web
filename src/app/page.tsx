import { Hero } from '@/components/landing/Hero';
import { HeroSceneGate } from '@/components/landing/HeroSceneGate';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LiveNow } from '@/components/landing/LiveNow';
import { TrustSection } from '@/components/landing/TrustSection';
import { Page } from '@/components/ui';
import { listReportChoices } from '@/protocol/reportDiscovery';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const reports = await listReportChoices();
  return (
    <main>
      <Hero scene={<HeroSceneGate />} />
      <Page as="div" className="space-y-16 sm:space-y-24">
        <LiveNow reports={reports} />
        <HowItWorks />
        <TrustSection />
      </Page>
    </main>
  );
}
