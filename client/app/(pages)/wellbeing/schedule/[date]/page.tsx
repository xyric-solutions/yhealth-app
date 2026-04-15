import { createMetadata } from '@/lib/seo';
import ScheduleDetailPageContent from './ScheduleDetailPageContent';

export const metadata = createMetadata({
  title: 'Schedule Details - Balencia',
  description: 'View your wellness schedule details for this day.',
  path: '/wellbeing/schedule',
  noIndex: true,
});

export default function ScheduleDetailPage() {
  return <ScheduleDetailPageContent />;
}
