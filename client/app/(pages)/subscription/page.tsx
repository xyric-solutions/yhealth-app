import { SEO } from '@/lib/seo';
import SubscriptionPageContent from './SubscriptionPageContent';

export const metadata = SEO.subscription;

export default function SubscriptionPage() {
  return <SubscriptionPageContent />;
}
