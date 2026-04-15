import { createMetadata } from '@/lib/seo';
import CreateUserPageContent from './CreateUserPageContent';

export const metadata = createMetadata({
  title: 'Create User - Balencia Admin',
  description: 'Create a new platform user.',
  path: '/admin/users/create',
  noIndex: true,
});

export default function CreateUserPage() {
  return <CreateUserPageContent />;
}
