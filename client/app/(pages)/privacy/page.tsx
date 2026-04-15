import { SEO } from '@/lib/seo';
import PrivacyPageContent from './PrivacyPageContent';

export const metadata = SEO.privacy;

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
