import { SEO } from '@/lib/seo';
import AchievementsPageContent from './AchievementsPageContent';

export const metadata = SEO.achievements;

export default function AchievementsPage() {
  return <AchievementsPageContent />;
}
