import { SEO } from '@/lib/seo';
import MoodPageContent from './MoodPageContent';

export const metadata = SEO.wellbeingMood;

export default function MoodPage() {
  return <MoodPageContent />;
}
