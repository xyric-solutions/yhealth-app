import type { Response } from 'express';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { notificationService } from '../services/notification.service.js';
import { embeddingQueueService } from '../services/embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';
import type {
  NotificationPreferencesInput,
  CoachingPreferencesInput,
  DisplayPreferencesInput,
  PrivacyPreferencesInput,
  IntegrationPreferencesInput,
  UpdatePreferencesInput,
} from '../validators/preferences.validator.js';

// Type definitions
type CoachingStyle = 'supportive' | 'direct' | 'analytical' | 'motivational';
type CoachingIntensity = 'light' | 'moderate' | 'intensive';
type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms';

interface UserPreferencesRow {
  id: string;
  user_id: string;
  notification_channels: object;
  notification_types: object;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  max_notifications_day: number;
  max_notifications_week: number;
  coaching_style: CoachingStyle;
  coaching_intensity: CoachingIntensity;
  preferred_channel: NotificationChannel;
  check_in_frequency: string;
  preferred_check_in_time: string;
  ai_use_emojis: boolean;
  ai_formality_level: string;
  ai_encouragement_level: string;
  focus_areas: string[];
  weight_unit: string;
  height_unit: string;
  distance_unit: string;
  temperature_unit: string;
  date_format: string;
  time_format: string;
  language: string;
  theme: string;
  share_progress_with_coach: boolean;
  allow_anonymous_data_research: boolean;
  show_in_leaderboards: boolean;
  profile_visibility: string;
  auto_sync_enabled: boolean;
  sync_on_wifi_only: boolean;
  background_sync_enabled: boolean;
  data_retention_days: number;
  voice_assistant_avatar_url: string | null;
  voice_assistant_name: string | null;
  created_at: Date;
  updated_at: Date;
}

// Coaching style descriptions for UI
const COACHING_STYLES: Record<CoachingStyle, { name: string; description: string; icon: string }> = {
  supportive: {
    name: 'Supportive Coach',
    description: 'Empathetic and encouraging. Celebrates wins, offers gentle guidance, and focuses on building confidence.',
    icon: '🤗',
  },
  direct: {
    name: 'Direct Coach',
    description: 'Straightforward and honest. Gives clear feedback, sets firm expectations, and keeps you accountable.',
    icon: '🎯',
  },
  analytical: {
    name: 'Analytical Coach',
    description: 'Data-driven and methodical. Focuses on metrics, trends, and evidence-based recommendations.',
    icon: '📊',
  },
  motivational: {
    name: 'Motivational Coach',
    description: 'Energetic and inspiring. Uses positive reinforcement, challenges you to push harder, and celebrates progress.',
    icon: '🔥',
  },
};

// Coaching intensity descriptions
const COACHING_INTENSITIES: Record<CoachingIntensity, { name: string; description: string; checkInsPerWeek: number }> = {
  light: {
    name: 'Light Touch',
    description: 'Weekly check-ins with occasional reminders. Best for self-motivated individuals.',
    checkInsPerWeek: 2,
  },
  moderate: {
    name: 'Balanced Approach',
    description: 'Regular daily nudges with flexibility. Good balance of support and independence.',
    checkInsPerWeek: 5,
  },
  intensive: {
    name: 'High Engagement',
    description: 'Frequent check-ins, detailed tracking, and proactive coaching. Maximum accountability.',
    checkInsPerWeek: 14,
  },
};

/**
 * Helper function to transform DB UserPreferences to API format
 */
function transformPreferencesToAPI(prefs: UserPreferencesRow) {
  const notificationChannels = prefs.notification_channels as Record<string, boolean>;
  const notificationTypes = prefs.notification_types as Record<string, boolean>;

  return {
    id: prefs.id,
    userId: prefs.user_id,
    notifications: {
      channels: notificationChannels,
      quietHours: {
        enabled: prefs.quiet_hours_enabled,
        start: prefs.quiet_hours_start,
        end: prefs.quiet_hours_end,
      },
      frequency: {
        maxPerDay: prefs.max_notifications_day,
        maxPerWeek: prefs.max_notifications_week,
      },
      types: notificationTypes,
    },
    coaching: {
      style: prefs.coaching_style,
      intensity: prefs.coaching_intensity,
      preferredChannel: prefs.preferred_channel,
      checkInFrequency: prefs.check_in_frequency,
      preferredCheckInTime: prefs.preferred_check_in_time,
      timezone: prefs.timezone,
      aiPersonality: {
        useEmojis: prefs.ai_use_emojis,
        formalityLevel: prefs.ai_formality_level,
        encouragementLevel: prefs.ai_encouragement_level,
      },
      focusAreas: prefs.focus_areas,
    },
    display: {
      units: {
        weight: prefs.weight_unit,
        height: prefs.height_unit,
        distance: prefs.distance_unit,
        temperature: prefs.temperature_unit,
      },
      dateFormat: prefs.date_format,
      timeFormat: prefs.time_format,
      language: prefs.language,
      theme: prefs.theme,
    },
    privacy: {
      shareProgressWithCoach: prefs.share_progress_with_coach,
      allowAnonymousDataForResearch: prefs.allow_anonymous_data_research,
      showInLeaderboards: prefs.show_in_leaderboards,
      profileVisibility: prefs.profile_visibility,
    },
    integrations: {
      autoSyncEnabled: prefs.auto_sync_enabled,
      syncOnWifiOnly: prefs.sync_on_wifi_only,
      backgroundSyncEnabled: prefs.background_sync_enabled,
      dataRetentionDays: prefs.data_retention_days,
    },
    voiceAssistant: {
      avatarUrl: prefs.voice_assistant_avatar_url,
      assistantName: prefs.voice_assistant_name || 'Aurea',
    },
    createdAt: prefs.created_at,
    updatedAt: prefs.updated_at,
  };
}

/**
 * Get User Preferences
 * GET /api/preferences
 */
export const getPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  let prefsResult = await query<UserPreferencesRow>(
    'SELECT * FROM user_preferences WHERE user_id = $1',
    [userId]
  );

  // Create default preferences if not exists
  if (prefsResult.rows.length === 0) {
    const createResult = await query<UserPreferencesRow>(
      'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    prefsResult = createResult;
  }

  const formattedPreferences = transformPreferencesToAPI(prefsResult.rows[0]);

  ApiResponse.success(res, { preferences: formattedPreferences });
});

/**
 * S01.5.1: Update Notification Preferences
 * PATCH /api/preferences/notifications
 */
export const updateNotificationPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as NotificationPreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    const prefs = prefsResult.rows[0];

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean | object)[] = [];
    let paramIndex = 1;

    if (data.channels) {
      const currentChannels = prefs.notification_channels as Record<string, boolean>;
      updates.push(`notification_channels = $${paramIndex++}`);
      values.push(JSON.stringify({ ...currentChannels, ...data.channels }));
    }

    if (data.quietHours) {
      if (data.quietHours.enabled !== undefined) {
        updates.push(`quiet_hours_enabled = $${paramIndex++}`);
        values.push(data.quietHours.enabled);
      }
      if (data.quietHours.start) {
        updates.push(`quiet_hours_start = $${paramIndex++}`);
        values.push(data.quietHours.start);
      }
      if (data.quietHours.end) {
        updates.push(`quiet_hours_end = $${paramIndex++}`);
        values.push(data.quietHours.end);
      }
    }

    if (data.frequency) {
      if (data.frequency.maxPerDay !== undefined) {
        updates.push(`max_notifications_day = $${paramIndex++}`);
        values.push(data.frequency.maxPerDay);
      }
      if (data.frequency.maxPerWeek !== undefined) {
        updates.push(`max_notifications_week = $${paramIndex++}`);
        values.push(data.frequency.maxPerWeek);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Notification preferences updated', { userId });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, {
      notifications: formattedPreferences.notifications,
    }, 'Notification preferences updated');
  }
);

/**
 * S01.5.2: Get Coaching Style Options
 * GET /api/preferences/coaching/styles
 */
export const getCoachingStyles = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const styles = Object.entries(COACHING_STYLES).map(([key, value]) => ({
    id: key,
    ...value,
  }));

  const intensities = Object.entries(COACHING_INTENSITIES).map(([key, value]) => ({
    id: key,
    ...value,
  }));

  ApiResponse.success(res, {
    styles,
    intensities,
    channels: [
      { id: 'push', name: 'Push Notifications', icon: '📱' },
      { id: 'email', name: 'Email', icon: '📧' },
      { id: 'whatsapp', name: 'WhatsApp', icon: '💬' },
      { id: 'sms', name: 'SMS', icon: '📲' },
    ],
    checkInFrequencies: [
      { id: 'daily', name: 'Daily', description: 'Every day at your preferred time' },
      { id: 'every_other_day', name: 'Every Other Day', description: 'Three to four times a week' },
      { id: 'weekly', name: 'Weekly', description: 'Once a week summary' },
    ],
  });
});

/**
 * S01.5.2: Update Coaching Preferences
 * PATCH /api/preferences/coaching
 */
export const updateCoachingPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as CoachingPreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean | string[])[] = [];
    let paramIndex = 1;

    if (data.style) {
      updates.push(`coaching_style = $${paramIndex++}`);
      values.push(data.style);
    }
    if (data.intensity) {
      updates.push(`coaching_intensity = $${paramIndex++}`);
      values.push(data.intensity);
    }
    if (data.preferredChannel) {
      updates.push(`preferred_channel = $${paramIndex++}`);
      values.push(data.preferredChannel);
    }
    if (data.checkInFrequency) {
      updates.push(`check_in_frequency = $${paramIndex++}`);
      values.push(data.checkInFrequency);
    }
    if (data.preferredCheckInTime) {
      updates.push(`preferred_check_in_time = $${paramIndex++}`);
      values.push(data.preferredCheckInTime);
    }
    if (data.timezone) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(data.timezone);
    }

    if (data.aiPersonality) {
      if (data.aiPersonality.useEmojis !== undefined) {
        updates.push(`ai_use_emojis = $${paramIndex++}`);
        values.push(data.aiPersonality.useEmojis);
      }
      if (data.aiPersonality.formalityLevel) {
        updates.push(`ai_formality_level = $${paramIndex++}`);
        values.push(data.aiPersonality.formalityLevel);
      }
      if (data.aiPersonality.encouragementLevel) {
        updates.push(`ai_encouragement_level = $${paramIndex++}`);
        values.push(data.aiPersonality.encouragementLevel);
      }
    }

    if (data.focusAreas) {
      updates.push(`focus_areas = $${paramIndex++}`);
      values.push(data.focusAreas);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Coaching preferences updated', {
      userId,
      style: data.style,
      intensity: data.intensity,
    });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    // Send notification for preference update
    const updatedFields: string[] = [];
    if (data.style) updatedFields.push('coachingStyle');
    if (data.intensity) updatedFields.push('coachingIntensity');
    if (data.preferredChannel) updatedFields.push('notificationChannels');
    if (data.timezone) updatedFields.push('timezone');
    if (updatedFields.length > 0) {
      await notificationService.preferencesUpdated(userId, updatedFields);
    }

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, {
      coaching: formattedPreferences.coaching,
    }, 'Coaching preferences updated');
  }
);

/**
 * Update Display Preferences
 * PATCH /api/preferences/display
 */
export const updateDisplayPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as DisplayPreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    if (data.units) {
      if (data.units.weight) {
        updates.push(`weight_unit = $${paramIndex++}`);
        values.push(data.units.weight);
      }
      if (data.units.height) {
        updates.push(`height_unit = $${paramIndex++}`);
        values.push(data.units.height);
      }
      if (data.units.distance) {
        updates.push(`distance_unit = $${paramIndex++}`);
        values.push(data.units.distance);
      }
      if (data.units.temperature) {
        updates.push(`temperature_unit = $${paramIndex++}`);
        values.push(data.units.temperature);
      }
    }

    if (data.dateFormat) {
      updates.push(`date_format = $${paramIndex++}`);
      values.push(data.dateFormat);
    }
    if (data.timeFormat) {
      updates.push(`time_format = $${paramIndex++}`);
      values.push(data.timeFormat);
    }
    if (data.language) {
      updates.push(`language = $${paramIndex++}`);
      values.push(data.language);
    }
    if (data.theme) {
      updates.push(`theme = $${paramIndex++}`);
      values.push(data.theme);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Display preferences updated', { userId });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, {
      display: formattedPreferences.display,
    }, 'Display preferences updated');
  }
);

/**
 * Update Privacy Preferences
 * PATCH /api/preferences/privacy
 */
export const updatePrivacyPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as PrivacyPreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | boolean)[] = [];
    let paramIndex = 1;

    if (data.shareProgressWithCoach !== undefined) {
      updates.push(`share_progress_with_coach = $${paramIndex++}`);
      values.push(data.shareProgressWithCoach);
    }
    if (data.allowAnonymousDataForResearch !== undefined) {
      updates.push(`allow_anonymous_data_research = $${paramIndex++}`);
      values.push(data.allowAnonymousDataForResearch);
    }
    if (data.showInLeaderboards !== undefined) {
      updates.push(`show_in_leaderboards = $${paramIndex++}`);
      values.push(data.showInLeaderboards);
    }
    if (data.profileVisibility) {
      updates.push(`profile_visibility = $${paramIndex++}`);
      values.push(data.profileVisibility);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Privacy preferences updated', { userId });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, {
      privacy: formattedPreferences.privacy,
    }, 'Privacy preferences updated');
  }
);

/**
 * Update Integration Preferences
 * PATCH /api/preferences/integrations
 */
export const updateIntegrationPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as IntegrationPreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (data.autoSyncEnabled !== undefined) {
      updates.push(`auto_sync_enabled = $${paramIndex++}`);
      values.push(data.autoSyncEnabled);
    }
    if (data.syncOnWifiOnly !== undefined) {
      updates.push(`sync_on_wifi_only = $${paramIndex++}`);
      values.push(data.syncOnWifiOnly);
    }
    if (data.backgroundSyncEnabled !== undefined) {
      updates.push(`background_sync_enabled = $${paramIndex++}`);
      values.push(data.backgroundSyncEnabled);
    }
    if (data.dataRetentionDays) {
      updates.push(`data_retention_days = $${paramIndex++}`);
      values.push(data.dataRetentionDays);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Integration preferences updated', { userId });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, {
      integrations: formattedPreferences.integrations,
    }, 'Integration preferences updated');
  }
);

/**
 * Update All Preferences (Bulk)
 * PUT /api/preferences
 */
export const updateAllPreferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as UpdatePreferencesInput;

    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    const prefs = prefsResult.rows[0];

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean | object | string[])[] = [];
    let paramIndex = 1;

    // Notifications
    if (data.notifications) {
      if (data.notifications.channels) {
        const currentChannels = prefs.notification_channels as Record<string, boolean>;
        updates.push(`notification_channels = $${paramIndex++}`);
        values.push(JSON.stringify({ ...currentChannels, ...data.notifications.channels }));
      }
      if (data.notifications.quietHours) {
        if (data.notifications.quietHours.enabled !== undefined) {
          updates.push(`quiet_hours_enabled = $${paramIndex++}`);
          values.push(data.notifications.quietHours.enabled);
        }
        if (data.notifications.quietHours.start) {
          updates.push(`quiet_hours_start = $${paramIndex++}`);
          values.push(data.notifications.quietHours.start);
        }
        if (data.notifications.quietHours.end) {
          updates.push(`quiet_hours_end = $${paramIndex++}`);
          values.push(data.notifications.quietHours.end);
        }
      }
      if (data.notifications.frequency) {
        if (data.notifications.frequency.maxPerDay !== undefined) {
          updates.push(`max_notifications_day = $${paramIndex++}`);
          values.push(data.notifications.frequency.maxPerDay);
        }
        if (data.notifications.frequency.maxPerWeek !== undefined) {
          updates.push(`max_notifications_week = $${paramIndex++}`);
          values.push(data.notifications.frequency.maxPerWeek);
        }
      }
    }

    // Coaching
    if (data.coaching) {
      if (data.coaching.style) {
        updates.push(`coaching_style = $${paramIndex++}`);
        values.push(data.coaching.style);
      }
      if (data.coaching.intensity) {
        updates.push(`coaching_intensity = $${paramIndex++}`);
        values.push(data.coaching.intensity);
      }
      if (data.coaching.preferredChannel) {
        updates.push(`preferred_channel = $${paramIndex++}`);
        values.push(data.coaching.preferredChannel);
      }
      if (data.coaching.checkInFrequency) {
        updates.push(`check_in_frequency = $${paramIndex++}`);
        values.push(data.coaching.checkInFrequency);
      }
      if (data.coaching.preferredCheckInTime) {
        updates.push(`preferred_check_in_time = $${paramIndex++}`);
        values.push(data.coaching.preferredCheckInTime);
      }
      if (data.coaching.timezone) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(data.coaching.timezone);
      }
      if (data.coaching.aiPersonality) {
        if (data.coaching.aiPersonality.useEmojis !== undefined) {
          updates.push(`ai_use_emojis = $${paramIndex++}`);
          values.push(data.coaching.aiPersonality.useEmojis);
        }
        if (data.coaching.aiPersonality.formalityLevel) {
          updates.push(`ai_formality_level = $${paramIndex++}`);
          values.push(data.coaching.aiPersonality.formalityLevel);
        }
        if (data.coaching.aiPersonality.encouragementLevel) {
          updates.push(`ai_encouragement_level = $${paramIndex++}`);
          values.push(data.coaching.aiPersonality.encouragementLevel);
        }
      }
      if (data.coaching.focusAreas) {
        updates.push(`focus_areas = $${paramIndex++}`);
        values.push(data.coaching.focusAreas);
      }
    }

    // Display
    if (data.display) {
      if (data.display.units) {
        if (data.display.units.weight) {
          updates.push(`weight_unit = $${paramIndex++}`);
          values.push(data.display.units.weight);
        }
        if (data.display.units.height) {
          updates.push(`height_unit = $${paramIndex++}`);
          values.push(data.display.units.height);
        }
        if (data.display.units.distance) {
          updates.push(`distance_unit = $${paramIndex++}`);
          values.push(data.display.units.distance);
        }
        if (data.display.units.temperature) {
          updates.push(`temperature_unit = $${paramIndex++}`);
          values.push(data.display.units.temperature);
        }
      }
      if (data.display.dateFormat) {
        updates.push(`date_format = $${paramIndex++}`);
        values.push(data.display.dateFormat);
      }
      if (data.display.timeFormat) {
        updates.push(`time_format = $${paramIndex++}`);
        values.push(data.display.timeFormat);
      }
      if (data.display.language) {
        updates.push(`language = $${paramIndex++}`);
        values.push(data.display.language);
      }
      if (data.display.theme) {
        updates.push(`theme = $${paramIndex++}`);
        values.push(data.display.theme);
      }
    }

    // Privacy
    if (data.privacy) {
      if (data.privacy.shareProgressWithCoach !== undefined) {
        updates.push(`share_progress_with_coach = $${paramIndex++}`);
        values.push(data.privacy.shareProgressWithCoach);
      }
      if (data.privacy.allowAnonymousDataForResearch !== undefined) {
        updates.push(`allow_anonymous_data_research = $${paramIndex++}`);
        values.push(data.privacy.allowAnonymousDataForResearch);
      }
      if (data.privacy.showInLeaderboards !== undefined) {
        updates.push(`show_in_leaderboards = $${paramIndex++}`);
        values.push(data.privacy.showInLeaderboards);
      }
      if (data.privacy.profileVisibility) {
        updates.push(`profile_visibility = $${paramIndex++}`);
        values.push(data.privacy.profileVisibility);
      }
    }

    // Integrations
    if (data.integrations) {
      if (data.integrations.autoSyncEnabled !== undefined) {
        updates.push(`auto_sync_enabled = $${paramIndex++}`);
        values.push(data.integrations.autoSyncEnabled);
      }
      if (data.integrations.syncOnWifiOnly !== undefined) {
        updates.push(`sync_on_wifi_only = $${paramIndex++}`);
        values.push(data.integrations.syncOnWifiOnly);
      }
      if (data.integrations.backgroundSyncEnabled !== undefined) {
        updates.push(`background_sync_enabled = $${paramIndex++}`);
        values.push(data.integrations.backgroundSyncEnabled);
      }
      if (data.integrations.dataRetentionDays) {
        updates.push(`data_retention_days = $${paramIndex++}`);
        values.push(data.integrations.dataRetentionDays);
      }
    }

    // Voice Assistant
    if (data.voiceAssistant) {
      if (data.voiceAssistant.avatarUrl !== undefined) {
        updates.push(`voice_assistant_avatar_url = $${paramIndex++}`);
        const avatarUrl = data.voiceAssistant.avatarUrl;
        if (avatarUrl !== null && avatarUrl !== undefined) {
          values.push(avatarUrl);
        } else {
          values.push(null as any);
        }
      }
      if (data.voiceAssistant.assistantName !== undefined) {
        updates.push(`voice_assistant_name = $${paramIndex++}`);
        const assistantName = (data.voiceAssistant.assistantName || '').trim() || 'Aurea';
        values.push(assistantName);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const updateResult = await query<UserPreferencesRow>(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('All preferences updated', { userId });

    // Enqueue embedding update for preferences (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_preferences',
      sourceId: updateResult.rows[0].id,
      operation: 'update',
      priority: JobPriorities.LOW,
    });

    const formattedPreferences = transformPreferencesToAPI(updateResult.rows[0]);

    ApiResponse.success(res, { preferences: formattedPreferences }, 'Preferences updated');
  }
);

/**
 * Complete Preferences Step in Onboarding
 * POST /api/preferences/complete
 */
export const completePreferencesStep = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Ensure preferences exist
    let prefsResult = await query<UserPreferencesRow>(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    if (prefsResult.rows.length === 0) {
      const createResult = await query<UserPreferencesRow>(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      prefsResult = createResult;
    }

    // Update user onboarding status
    await query(
      'UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['plan_pending', userId]
    );

    logger.info('Preferences step completed', { userId });

    const formattedPreferences = transformPreferencesToAPI(prefsResult.rows[0]);

    ApiResponse.success(res, {
      preferences: formattedPreferences,
      nextStep: 'plan_generation',
    }, 'Preferences setup complete');
  }
);

/**
 * Reset Preferences to Defaults
 * POST /api/preferences/reset
 */
export const resetPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Delete existing and create new defaults
  await query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);

  const createResult = await query<UserPreferencesRow>(
    'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
    [userId]
  );

  logger.info('Preferences reset to defaults', { userId });

  const formattedPreferences = transformPreferencesToAPI(createResult.rows[0]);

  ApiResponse.success(res, { preferences: formattedPreferences }, 'Preferences reset to defaults');
});

/**
 * Update product tour completion status
 * PATCH /api/preferences/tour-status
 */
export const updateTourStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { completed } = req.body;
  if (typeof completed !== 'boolean') {
    throw ApiError.badRequest('completed must be a boolean');
  }

  await query(
    `UPDATE user_preferences
     SET product_tour_completed = $1,
         product_tour_completed_at = CASE WHEN $1 = true THEN NOW() ELSE product_tour_completed_at END,
         updated_at = NOW()
     WHERE user_id = $2`,
    [completed, userId]
  );

  ApiResponse.success(res, { product_tour_completed: completed }, 'Tour status updated');
});

export default {
  getPreferences,
  updateNotificationPreferences,
  getCoachingStyles,
  updateCoachingPreferences,
  updateDisplayPreferences,
  updatePrivacyPreferences,
  updateIntegrationPreferences,
  updateAllPreferences,
  completePreferencesStep,
  resetPreferences,
  updateTourStatus,
};
