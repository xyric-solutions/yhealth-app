import { SEO } from "@/lib/seo";

export const metadata = SEO.cookies;

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
