import { SEO } from '@/lib/seo';
import VoiceAssistantPageContent from './VoiceAssistantPageContent';

export const metadata = SEO.voiceAssistant;

export default function VoiceAssistantPage() {
  return <VoiceAssistantPageContent />;
}
