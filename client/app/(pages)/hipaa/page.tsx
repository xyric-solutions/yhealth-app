import { SEO } from '@/lib/seo';
import HipaaPageContent from './HipaaPageContent';

export const metadata = SEO.hipaa;

export default function HipaaPage() {
  return <HipaaPageContent />;
}
