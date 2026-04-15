import { SEO } from "@/lib/seo";

export const metadata = SEO.security;

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
