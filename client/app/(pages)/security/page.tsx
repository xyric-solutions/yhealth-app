import { SEO } from '@/lib/seo';
import SecurityPageContent from './SecurityPageContent';

export const metadata = SEO.security;

export default function SecurityPage() {
  return <SecurityPageContent />;
}
