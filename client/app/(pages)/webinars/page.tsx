import { SEO } from '@/lib/seo';
import WebinarsPageContent from './WebinarsPageContent';

export const metadata = SEO.webinars;

export default function WebinarsPage() {
  return <WebinarsPageContent />;
}
