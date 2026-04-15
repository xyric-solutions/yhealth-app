import { SEO } from "@/lib/seo";

export const metadata = SEO.wellbeingStress;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
