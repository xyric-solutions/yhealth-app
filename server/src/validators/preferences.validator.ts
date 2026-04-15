import { z } from 'zod';

// Notification channels
const notificationChannelEnum = z.enum(['push', 'email', 'whatsapp', 'sms', 'both']);

// Coaching styles
const coachingStyleEnum = z.enum(['supportive', 'direct', 'analytical', 'motivational']);

// Coaching intensity
const coachingIntensityEnum = z.enum(['light', 'moderate', 'intensive']);

// S01.5.1: Engagement & Notification Preferences
export const notificationPreferencesSchema = z.object({
  channels: z.object({
    push: z.boolean().default(true),
    email: z.boolean().default(true),
    whatsapp: z.boolean().default(false),
    sms: z.boolean().default(false),
  }).optional(),
  quietHours: z.object({
    enabled: z.boolean().optional(),
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (use HH:mm)').optional(),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (use HH:mm)').optional(),
    timezone: z.string().optional(),
  }).optional(),
  frequency: z.object({
    maxPerDay: z.number().int().min(1).max(50).default(10),
    maxPerWeek: z.number().int().min(1).max(200).default(50),
  }).optional(),
});

// S01.5.2: Coaching Style & Channel Preferences
export const coachingPreferencesSchema = z.object({
  style: coachingStyleEnum.default('supportive'),
  intensity: coachingIntensityEnum.default('moderate'),
  preferredChannel: notificationChannelEnum.default('push'),
  checkInFrequency: z.enum(['daily', 'twice_daily', 'every_other_day', 'weekly']).default('daily'),
  preferredCheckInTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (use HH:mm)')
    .default('09:00'),
  timezone: z.string().default('UTC'),
  aiPersonality: z.object({
    useEmojis: z.boolean().default(true),
    formalityLevel: z.enum(['casual', 'balanced', 'formal']).default('balanced'),
    encouragementLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  }).optional(),
  focusAreas: z.array(z.string()).max(5).optional(),
});

// Display preferences
export const displayPreferencesSchema = z.object({
  units: z.object({
    weight: z.enum(['kg', 'lbs']).default('kg'),
    height: z.enum(['cm', 'ft_in']).default('cm'),
    distance: z.enum(['km', 'miles']).default('km'),
    temperature: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).default('YYYY-MM-DD'),
  timeFormat: z.enum(['12h', '24h']).default('24h'),
  language: z.string().default('en'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

// Privacy preferences
export const privacyPreferencesSchema = z.object({
  shareProgressWithCoach: z.boolean().default(true),
  allowAnonymousDataForResearch: z.boolean().default(false),
  showInLeaderboards: z.boolean().default(false),
  profileVisibility: z.enum(['private', 'friends', 'public']).default('private'),
});

// Integration preferences
export const integrationPreferencesSchema = z.object({
  autoSyncEnabled: z.boolean().default(true),
  syncOnWifiOnly: z.boolean().default(false),
  backgroundSyncEnabled: z.boolean().default(true),
  dataRetentionDays: z.number().int().min(30).max(3650).default(365),
});

// Voice Assistant preferences
export const voiceAssistantPreferencesSchema = z.object({
  avatarUrl: z.string().url().nullable().optional(),
  assistantName: z.string().min(1).max(100).optional(),
});

// Full preferences update
export const updatePreferencesSchema = z.object({
  notifications: notificationPreferencesSchema.optional(),
  coaching: coachingPreferencesSchema.optional(),
  display: displayPreferencesSchema.optional(),
  privacy: privacyPreferencesSchema.optional(),
  integrations: integrationPreferencesSchema.optional(),
  voiceAssistant: voiceAssistantPreferencesSchema.optional(),
});

// Types
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type CoachingPreferencesInput = z.infer<typeof coachingPreferencesSchema>;
export type DisplayPreferencesInput = z.infer<typeof displayPreferencesSchema>;
export type PrivacyPreferencesInput = z.infer<typeof privacyPreferencesSchema>;
export type IntegrationPreferencesInput = z.infer<typeof integrationPreferencesSchema>;
export type VoiceAssistantPreferencesInput = z.infer<typeof voiceAssistantPreferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
