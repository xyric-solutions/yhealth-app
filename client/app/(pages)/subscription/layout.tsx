import { SEO } from "@/lib/seo";

export const metadata = SEO.subscription;

export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
