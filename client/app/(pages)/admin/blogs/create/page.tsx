import { SEO } from '@/lib/seo';
import AdminBlogCreatePageContent from './AdminBlogCreatePageContent';

export const metadata = SEO.adminBlogCreate;

export default function CreateBlogPage() {
  return <AdminBlogCreatePageContent />;
}
