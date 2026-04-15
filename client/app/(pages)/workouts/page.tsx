import { SEO } from '@/lib/seo';
import WorkoutsPageContent from './WorkoutsPageContent';

export const metadata = SEO.workouts;

export default function WorkoutsPage() {
  return <WorkoutsPageContent />;
}
