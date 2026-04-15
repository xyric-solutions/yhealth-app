import { SEO } from '@/lib/seo';
import LeaderboardPageContent from './LeaderboardPageContent';

export const metadata = SEO.leaderboard;

export default function LeaderboardPage() {
  return <LeaderboardPageContent />;
}
