import { SEO } from "@/lib/seo";
import FAQPageContent from "./FAQPageContent";

export const metadata = SEO.faq;

export default function FAQPage() {
  return <FAQPageContent />;
}
