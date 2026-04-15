import { SEO } from "@/lib/seo";
import InsightsPageContent from "./InsightsPageContent";

export const metadata = SEO.wellbeingInsights;

export default function InsightsPage() {
  return <InsightsPageContent />;
}
