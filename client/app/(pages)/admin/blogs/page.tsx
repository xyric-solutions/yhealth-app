import { SEO } from '@/lib/seo';
import AdminBlogsPageContent from './AdminBlogsPageContent';

export const metadata = SEO.adminBlogs;

export default function AdminBlogsPage() {
  return <AdminBlogsPageContent />;
}
