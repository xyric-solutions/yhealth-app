import { SEO } from '@/lib/seo';
import HelpPageContent from './HelpPageContent';

export const metadata = SEO.helpCenter;

export default function HelpCenterPage() {
  return <HelpPageContent />;
}
