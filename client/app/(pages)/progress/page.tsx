import { SEO } from '@/lib/seo';
import ProgressPageContent from './ProgressPageContent';

export const metadata = SEO.progress;

export default function ProgressPage() {
  return <ProgressPageContent />;
}
