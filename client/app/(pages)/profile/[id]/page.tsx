import { createMetadata } from '@/lib/seo';
import PublicProfilePageContent from './PublicProfilePageContent';

export const metadata = createMetadata({
  title: 'User Profile - Balencia',
  description: 'View user health profile.',
  path: '/profile',
  noIndex: true,
});

export default function PublicProfilePage() {
  return <PublicProfilePageContent />;
}
