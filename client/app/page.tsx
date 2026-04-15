import { SEO } from "@/lib/seo";
import { MainLayout } from "@/components/layout";
import HeroSection from "@/components/landing/hero-section";
import { TrustBarSection } from "@/components/landing/trust-bar-section";
import { ProblemPainSection } from "@/components/landing/problem-pain-section";
import { LifeDomainsCarouselSection } from "@/components/landing/life-domains-carousel-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { AIChatDemoSection } from "@/components/landing/ai-chat-demo-section";
import { VoiceCoachSection } from "@/components/landing/voice-coach-section";
import { MotivationTiersSection } from "@/components/landing/motivation-tiers-section";
import { LifeGoalsSection } from "@/components/landing/life-goals-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { HealthOrbitSection } from "@/components/landing/health-orbit-section";
import { ComparisonTableSection } from "@/components/landing/comparison-table-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CTASection } from "@/components/landing/cta-section";
// import { CinematicOverlays } from "@/components/landing/CinematicOverlays";

export const metadata = SEO.home;

export default function HomePage() {
  return (
    <MainLayout>
      {/* <CinematicOverlays /> */}
      <HeroSection />
      <TrustBarSection />
      <ProblemPainSection />
      <LifeDomainsCarouselSection />
      <HowItWorksSection />
      <AIChatDemoSection />
      <VoiceCoachSection />
      <MotivationTiersSection />
      <LifeGoalsSection />
      <HealthOrbitSection />
      <IntegrationsSection />
      <ComparisonTableSection />
      <PricingSection />
      <CTASection />
    </MainLayout>
  );
}
