import { SEO } from '@/lib/seo';
import BlogsPageContent from './BlogsPageContent';

export const metadata = SEO.blogList;

export default function BlogsPage() {
  return <BlogsPageContent />;
}
