import { SEO } from "@/lib/seo";

export const metadata = SEO.webinars;

export default function WebinarsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
