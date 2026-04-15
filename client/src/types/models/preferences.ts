/**
 * @file Preferences domain models
 */

export type CoachingStyle = 'supportive' | 'direct' | 'analytical' | 'motivational';
export type CoachingIntensity = 'light' | 'moderate' | 'intensive';
export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms';
export type CheckInFrequency = 'daily' | 'every_other_day' | 'weekly';
export type FormalityLevel = 'casual' | 'balanced' | 'formal';
export type EncouragementLevel = 'low' | 'medium' | 'high';

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AIPersonality {
  useEmojis: boolean;
  formalityLevel: FormalityLevel;
  encouragementLevel: EncouragementLevel;
}

export interface Preferences {
  coachingStyle: CoachingStyle;
  coachingIntensity: CoachingIntensity;
  preferredChannel: NotificationChannel;
  checkInFrequency: CheckInFrequency;
  preferredCheckInTime: string;
  timezone: string;
  quietHours: QuietHours;
  aiPersonality: AIPersonality;
}

export const DEFAULT_PREFERENCES: Preferences = {
  coachingStyle: 'supportive',
  coachingIntensity: 'moderate',
  preferredChannel: 'push',
  checkInFrequency: 'daily',
  preferredCheckInTime: '09:00',
  timezone: typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC',
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00',
  },
  aiPersonality: {
    useEmojis: true,
    formalityLevel: 'balanced',
    encouragementLevel: 'medium',
  },
};
