import { SEO } from '@/lib/seo';
import SettingsPageContent from './SettingsPageContent';

export const metadata = SEO.settings;

export default function SettingsPage() {
  return <SettingsPageContent />;
}
