import { SEO } from '@/lib/seo';
import WellbeingPageContent from './WellbeingPageContent';

export const metadata = SEO.wellbeing;

export default function WellbeingPage() {
  return <WellbeingPageContent />;
}
