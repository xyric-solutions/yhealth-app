import { SEO } from '@/lib/seo';
import DashboardPageContent from './DashboardPageContent';

export const metadata = SEO.dashboard;

export default function DashboardPage() {
  return <DashboardPageContent />;
}
