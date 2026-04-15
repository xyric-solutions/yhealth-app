import { createMetadata } from '@/lib/seo';
import PreferencesPageContent from './PreferencesPageContent';

export const metadata = createMetadata({
  title: "Preferences - Balencia",
  description: "Customize your coaching experience, notification settings, and display preferences.",
  path: "/preferences",
  noIndex: true,
});

export default function PreferencesPage() {
  return <PreferencesPageContent />;
}
