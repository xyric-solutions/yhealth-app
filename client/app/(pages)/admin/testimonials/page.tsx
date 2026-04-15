import { createMetadata } from '@/lib/seo';
import AdminTestimonialsPageContent from './AdminTestimonialsPageContent';

export const metadata = createMetadata({
  title: 'Testimonials - Balencia Admin',
  description: 'Manage user testimonials.',
  path: '/admin/testimonials',
  noIndex: true,
});

export default function AdminTestimonialsPage() {
  return <AdminTestimonialsPageContent />;
}
