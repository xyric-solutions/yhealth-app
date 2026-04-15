import { SEO } from "@/lib/seo";

export const metadata = SEO.plans;

export default function PlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
