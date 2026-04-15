import { SEO } from "@/lib/seo";

export const metadata = SEO.community;

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
