import { SEO } from '@/lib/seo';
import SchedulePageContent from './SchedulePageContent';

export const metadata = SEO.wellbeingSchedule;

export default function SchedulePage() {
  return <SchedulePageContent />;
}
