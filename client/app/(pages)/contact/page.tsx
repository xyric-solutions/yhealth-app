import { SEO } from '@/lib/seo';
import ContactPageContent from './ContactPageContent';

export const metadata = SEO.contact;

export default function ContactPage() {
  return <ContactPageContent />;
}
