import { createMetadata } from "@/lib/seo";
import AdminNewsletterPageContent from "./AdminNewsletterPageContent";

export const metadata = createMetadata({
  title: "Newsletter - Balencia Admin",
  description: "Manage newsletter (email) subscriptions from footer and lead magnet.",
  path: "/admin/newsletter",
  noIndex: true,
});

export default function AdminNewsletterPage() {
  return <AdminNewsletterPageContent />;
}
