import { SEO } from "@/lib/seo";
import OnboardingLayoutClient from "./OnboardingLayoutClient";

export const metadata = SEO.onboarding;

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingLayoutClient>{children}</OnboardingLayoutClient>;
}
