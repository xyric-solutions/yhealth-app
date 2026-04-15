import { SEO } from "@/lib/seo";
import AdminLayoutClient from "./AdminLayoutClient";

export const metadata = SEO.admin;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
