import { SEO } from '@/lib/seo';
import ProfilePageContent from './ProfilePageContent';

export const metadata = SEO.profile;

export default function ProfilePage() {
  return <ProfilePageContent />;
}
