import { SEO } from "@/lib/seo";

export const metadata = SEO.privacy;

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
