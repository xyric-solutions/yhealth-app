import { createMetadata } from '@/lib/seo';
import CreateRolePageContent from './CreateRolePageContent';

export const metadata = createMetadata({
  title: 'Create Role - Balencia Admin',
  description: 'Create a new user role.',
  path: '/admin/roles/create',
  noIndex: true,
});

export default function CreateRolePage() {
  return <CreateRolePageContent />;
}
