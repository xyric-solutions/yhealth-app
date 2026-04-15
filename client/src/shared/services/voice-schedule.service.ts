/**
 * Voice Schedule Service
 * Client-side service for voice and schedule customization
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type VoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type AICallFrequency = 'off' | 'minimal' | 'moderate' | 'proactive';

export interface VoiceOption {
  id: VoiceId;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  tone: string;
  previewUrl?: string;
}

export interface FrequencyOption {
  label: string;
  description: string;
  callsPerWeek: string;
}

export interface VoiceSettings {
  voiceId: VoiceId;
  speechPace: number;
  voicePreviewPlayed: boolean;
}

export interface ScheduleSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dndDays: number[];
  aiCallFrequency: AICallFrequency;
  preferredCallTimes: string[];
}

export interface VoiceSchedulePreferences extends VoiceSettings, ScheduleSettings {}

// ============================================================================
// Service
// ============================================================================

export const voiceScheduleService = {
  /**
   * Get voice and schedule preferences
   */
  getPreferences: () =>
    api.get<VoiceSchedulePreferences>('/voice-schedule/preferences'),

  /**
   * Update voice settings
   */
  updateVoiceSettings: (settings: Partial<VoiceSettings>) =>
    api.patch<VoiceSettings>('/voice-schedule/voice', settings),

  /**
   * Update schedule settings
   */
  updateScheduleSettings: (settings: Partial<ScheduleSettings>) =>
    api.patch<ScheduleSettings>('/voice-schedule/schedule', settings),

  /**
   * Get available voice options
   */
  getVoiceOptions: () =>
    api.get<{ voices: VoiceOption[] }>('/voice-schedule/voices'),

  /**
   * Get AI call frequency options
   */
  getFrequencyOptions: () =>
    api.get<{ frequencies: Record<AICallFrequency, FrequencyOption> }>('/voice-schedule/frequencies'),

  /**
   * Check if AI can initiate a call now
   */
  canInitiateCall: () =>
    api.get<{ allowed: boolean; reason?: string }>('/voice-schedule/can-call'),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get day name from number
 */
export function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || '';
}

/**
 * Get short day name from number
 */
export function getShortDayName(day: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[day] || '';
}

/**
 * Format time for display
 */
export function formatScheduleTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Get speech pace label
 */
export function getSpeechPaceLabel(pace: number): string {
  if (pace <= 0.7) return 'Slow';
  if (pace <= 0.9) return 'Slightly Slow';
  if (pace <= 1.1) return 'Normal';
  if (pace <= 1.3) return 'Slightly Fast';
  return 'Fast';
}

export default voiceScheduleService;

