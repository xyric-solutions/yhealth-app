import { createMetadata } from '@/lib/seo';
import WhoopCallbackPageContent from './WhoopCallbackPageContent';

export const metadata = createMetadata({
  title: 'WHOOP Callback - Balencia',
  description: 'Processing WHOOP authorization.',
  path: '/auth/whoop/callback',
  noIndex: true,
});

export default function WhoopCallbackPage() {
  return <WhoopCallbackPageContent />;
}
