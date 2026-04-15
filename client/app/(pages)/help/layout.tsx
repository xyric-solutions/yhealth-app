import { SEO } from "@/lib/seo";

export const metadata = SEO.helpCenter;

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
