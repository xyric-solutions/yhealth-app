import { SEO } from '@/lib/seo';
import AdminDashboardPageContent from './AdminDashboardPageContent';

export const metadata = SEO.admin;

export default function AdminDashboardPage() {
  return <AdminDashboardPageContent />;
}
