import { createMetadata } from '@/lib/seo';
import SoundscapePageContent from './SoundscapePageContent';

export const metadata = createMetadata({
  title: 'Pulse - Balencia',
  description:
    'AI-curated music for workouts, meditation, sleep, and recovery. Connect your Spotify for personalized playlists.',
  path: '/soundscape',
  noIndex: true,
});

export default function SoundscapePage() {
  return <SoundscapePageContent />;
}
