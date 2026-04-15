import { SEO } from '@/lib/seo';
import NotificationsPageContent from './NotificationsPageContent';

export const metadata = SEO.notifications;

export default function NotificationsPage() {
  return <NotificationsPageContent />;
}
