import { SEO } from '@/lib/seo';
import { JournalHubPage } from '@/components/journal';

export const metadata = SEO.wellbeingJournal;

export default function JournalPage() {
  return <JournalHubPage />;
}
