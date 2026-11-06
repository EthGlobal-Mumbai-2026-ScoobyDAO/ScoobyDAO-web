import { Footer } from '@/components/Footer';
import { Hero } from '@/components/landing/Hero';
import { HeroSceneGate } from '@/components/landing/HeroSceneGate';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { BuiltWith, TrustSection } from '@/components/landing/TrustSection';

export default function Home() {
  return (
    <>
      <main>
        <Hero scene={<HeroSceneGate />} />
        <StatsStrip />
        <HowItWorks />
        <BuiltWith />
        <TrustSection />
      </main>
      <Footer />
    </>
  );
}
