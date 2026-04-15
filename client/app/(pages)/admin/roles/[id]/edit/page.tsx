import { createMetadata } from '@/lib/seo';
import EditRolePageContent from './EditRolePageContent';

export const metadata = createMetadata({
  title: 'Edit Role - Balencia Admin',
  description: 'Edit user role settings.',
  path: '/admin/roles/edit',
  noIndex: true,
});

export default function EditRolePage() {
  return <EditRolePageContent />;
}
