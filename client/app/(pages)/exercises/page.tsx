import { SEO } from '@/lib/seo';
import ExercisesPageContent from './ExercisesPageContent';

export const metadata = SEO.exercises;

export default function ExercisesPage() {
  return <ExercisesPageContent />;
}
