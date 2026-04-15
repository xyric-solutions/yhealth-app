import { SEO } from '@/lib/seo';
import GoalsPageContent from './GoalsPageContent';

export const metadata = SEO.goals;

export default function GoalsPage() {
  return <GoalsPageContent />;
}
