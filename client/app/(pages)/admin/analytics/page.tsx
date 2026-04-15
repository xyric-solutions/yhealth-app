import { createMetadata } from '@/lib/seo';
import AdminAnalyticsPageContent from './AdminAnalyticsPageContent';

export const metadata = createMetadata({
  title: 'Analytics - Balencia Admin',
  description: 'View platform analytics and usage statistics.',
  path: '/admin/analytics',
  noIndex: true,
});

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsPageContent />;
}
