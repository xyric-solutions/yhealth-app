import { SEO } from "@/lib/seo";

export const metadata = SEO.activityStatus;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
