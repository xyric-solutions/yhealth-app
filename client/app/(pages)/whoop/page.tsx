import { createMetadata } from '@/lib/seo';
import WhoopPageContent from './WhoopPageContent';

export const metadata = createMetadata({
  title: 'WHOOP Integration - Balencia',
  description: 'Connect and manage your WHOOP wearable integration with Balencia.',
  path: '/whoop',
  noIndex: true,
});

export default function WhoopPage() {
  return <WhoopPageContent />;
}
