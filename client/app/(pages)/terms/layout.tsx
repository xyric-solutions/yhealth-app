import { SEO } from "@/lib/seo";

export const metadata = SEO.terms;

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
