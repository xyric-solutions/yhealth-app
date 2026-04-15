/**
 * @file Preferences domain types
 * @description Single source of truth for user preferences types
 */

export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms';

export type CoachingStyle = 'supportive' | 'direct' | 'analytical' | 'motivational';

export type CoachingIntensity = 'light' | 'moderate' | 'intensive';

export type ConsentType = 'terms_of_service' | 'privacy_policy' | 'email_marketing' | 'whatsapp_coaching';

export interface NotificationPreferences {
  channels: NotificationChannel[];
  dailyReminders: boolean;
  weeklyDigest: boolean;
  activityReminders: boolean;
  achievementAlerts: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface CoachingPreferences {
  style: CoachingStyle;
  intensity: CoachingIntensity;
  preferredLanguage: string;
  timezone: string;
}

export interface UserPreferences {
  userId: string;
  notifications: NotificationPreferences;
  coaching: CoachingPreferences;
  measurementUnit: 'metric' | 'imperial';
  createdAt: string;
  updatedAt: string;
}
