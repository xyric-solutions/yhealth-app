import { SEO } from "@/lib/seo";

export const metadata = SEO.wellbeingJournal;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
