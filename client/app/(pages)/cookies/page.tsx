import { SEO } from '@/lib/seo';
import CookiesPageContent from './CookiesPageContent';

export const metadata = SEO.cookies;

export default function CookiesPage() {
  return <CookiesPageContent />;
}
