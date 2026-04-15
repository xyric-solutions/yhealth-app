import { SEO } from '@/lib/seo';
import CompetitionsPageContent from './CompetitionsPageContent';

export const metadata = SEO.competitions;

export default function CompetitionsPage() {
  return <CompetitionsPageContent />;
}
