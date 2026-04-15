import { SEO } from "@/lib/seo";
import { MainLayout } from "@/components/layout";
import {
  AboutHeroSection,
  MissionVisionSection,
  WhatWeDoSection,
  OurValuesSection,
  OurJourneySection,
  LeadershipSection,
  WhyChooseUsSection,
  AboutCTASection,
} from "@/components/about";

export const metadata = SEO.about;

export default function AboutPage() {
  return (
    <MainLayout>
      <AboutHeroSection />
      <MissionVisionSection />
      <WhatWeDoSection />
      <OurValuesSection />
      <OurJourneySection />
      <LeadershipSection />
      <WhyChooseUsSection />
      <AboutCTASection />
    </MainLayout>
  );
}

