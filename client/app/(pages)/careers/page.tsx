import { SEO } from '@/lib/seo';
import CareersPageContent from './CareersPageContent';

export const metadata = SEO.careers;

export default function CareersPage() {
  return <CareersPageContent />;
}
