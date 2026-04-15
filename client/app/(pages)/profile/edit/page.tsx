import { SEO } from '@/lib/seo';
import EditProfilePageContent from './EditProfilePageContent';

export const metadata = SEO.profileEdit;

export default function EditProfilePage() {
  return <EditProfilePageContent />;
}
