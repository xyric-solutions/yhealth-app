import { SEO } from '@/lib/seo';
import ActivityStatusPageContent from './ActivityStatusPageContent';

export const metadata = SEO.activityStatus;

export default function ActivityStatusPage() {
  return <ActivityStatusPageContent />;
}
