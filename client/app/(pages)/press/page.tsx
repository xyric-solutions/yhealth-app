import { SEO } from '@/lib/seo';
import PressPageContent from './PressPageContent';

export const metadata = SEO.press;

export default function PressPage() {
  return <PressPageContent />;
}
