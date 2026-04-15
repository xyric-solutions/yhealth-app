import { SEO } from '@/lib/seo';
import ChatHistoryPageContent from './ChatHistoryPageContent';

export const metadata = SEO.chatHistory;

export default function ChatHistoryPage() {
  return <ChatHistoryPageContent />;
}
