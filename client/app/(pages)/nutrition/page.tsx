import { SEO } from '@/lib/seo';
import NutritionPageContent from './NutritionPageContent';

export const metadata = SEO.nutrition;

export default function NutritionPage() {
  return <NutritionPageContent />;
}
