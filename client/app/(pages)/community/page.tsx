import { SEO } from '@/lib/seo';
import CommunityPageContent from './CommunityPageContent';

export const metadata = SEO.community;

export default function CommunityPage() {
  return <CommunityPageContent />;
}
