import { SEO } from '@/lib/seo';
import VerifyPageContent from './VerifyPageContent';

export const metadata = SEO.verify;

export default function VerifyPage() {
  return <VerifyPageContent />;
}
