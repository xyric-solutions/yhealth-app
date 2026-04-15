import { createMetadata } from '@/lib/seo';
import SubscriptionSuccessPageContent from './SuccessPageContent';

export const metadata = createMetadata({
  title: 'Subscription Success - Balencia',
  description: 'Your Balencia subscription is confirmed. Welcome to your premium wellness journey.',
  path: '/subscription/success',
  noIndex: true,
});

export default function SubscriptionSuccessPage() {
  return <SubscriptionSuccessPageContent />;
}
