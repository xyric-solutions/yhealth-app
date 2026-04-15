import { SEO } from '@/lib/seo';
import TermsPageContent from './TermsPageContent';

export const metadata = SEO.terms;

export default function TermsPage() {
  return <TermsPageContent />;
}
