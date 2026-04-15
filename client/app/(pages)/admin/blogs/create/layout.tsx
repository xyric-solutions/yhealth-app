import { SEO } from "@/lib/seo";

export const metadata = SEO.adminBlogCreate;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
