import { Footer } from '@/components/Footer';
import { Hero } from '@/components/landing/Hero';
import { HeroSceneGate } from '@/components/landing/HeroSceneGate';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { BuiltWith, TrustSection } from '@/components/landing/TrustSection';
import { listReportChoices } from '@/protocol/reportDiscovery';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const reports = await listReportChoices();
  return (
    <>
      <main>
        <Hero scene={<HeroSceneGate />} />
        <StatsStrip reports={reports} />
        <HowItWorks />
        <BuiltWith />
        <TrustSection />
      </main>
      <Footer />
    </>
  );
}
