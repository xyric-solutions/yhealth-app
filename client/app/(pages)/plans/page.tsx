import { SEO } from '@/lib/seo';
import PlansPageContent from './PlansPageContent';

export const metadata = SEO.plans;

export default function PlansPage() {
  return <PlansPageContent />;
}
