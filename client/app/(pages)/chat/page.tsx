import { SEO } from '@/lib/seo';
import { ChatPageContent } from './ChatPageContent';

export const metadata = SEO.chat;

export default function ChatPage() {
  return <ChatPageContent />;
}
