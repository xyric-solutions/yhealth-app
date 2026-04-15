import { SEO } from '@/lib/seo';
import HabitsPageContent from './HabitsPageContent';

export const metadata = SEO.wellbeingHabits;

export default function HabitsPage() {
  return <HabitsPageContent />;
}
