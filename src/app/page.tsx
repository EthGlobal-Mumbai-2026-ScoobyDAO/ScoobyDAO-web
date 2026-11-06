import { Footer } from '@/components/Footer';
import { Hero } from '@/components/landing/Hero';
import { HeroParallaxFallback } from '@/components/landing/HeroParallaxFallback';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { TrustSection } from '@/components/landing/TrustSection';

export default function Home() {
  return (
    <>
      <Hero scene={<HeroParallaxFallback />} />
      <StatsStrip />
      <HowItWorks />
      <TrustSection />
      <Footer />
    </>
  );
}
