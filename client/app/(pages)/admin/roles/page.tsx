import { createMetadata } from '@/lib/seo';
import AdminRolesPageContent from './AdminRolesPageContent';

export const metadata = createMetadata({
  title: 'Roles Management - Balencia Admin',
  description: 'Manage user roles and permissions.',
  path: '/admin/roles',
  noIndex: true,
});

export default function AdminRolesPage() {
  return <AdminRolesPageContent />;
}
