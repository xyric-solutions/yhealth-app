import { SEO } from '@/lib/seo';
import OnboardingPageContent from './OnboardingPageContent';

export const metadata = SEO.onboarding;

export default function OnboardingPage() {
  return <OnboardingPageContent />;
}
