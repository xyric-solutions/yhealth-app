import { SEO } from "@/lib/seo";

export const metadata = SEO.achievements;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
