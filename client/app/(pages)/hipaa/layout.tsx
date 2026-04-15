import { SEO } from "@/lib/seo";

export const metadata = SEO.hipaa;

export default function HipaaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
