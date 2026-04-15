import { SEO } from '@/lib/seo';
import ActivityPageContent from './ActivityPageContent';

export const metadata = SEO.activity;

export default function ActivityPage() {
  return <ActivityPageContent />;
}
