import { SEO } from '@/lib/seo';
import VoiceCallPageContent from './VoiceCallPageContent';

export const metadata = SEO.voiceCall;

export default function VoiceCallPage() {
  return <VoiceCallPageContent />;
}
