import { SEO } from '@/lib/seo';
import MessagesPageContent from './MessagesPageContent';

export const metadata = SEO.messages;

export default function MessagesPage() {
  return <MessagesPageContent />;
}
