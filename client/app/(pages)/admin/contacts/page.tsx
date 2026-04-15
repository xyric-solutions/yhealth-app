import { createMetadata } from '@/lib/seo';
import AdminContactsPageContent from './AdminContactsPageContent';

export const metadata = createMetadata({
  title: 'Contacts - Balencia Admin',
  description: 'Manage contact form submissions.',
  path: '/admin/contacts',
  noIndex: true,
});

export default function AdminContactsPage() {
  return <AdminContactsPageContent />;
}
