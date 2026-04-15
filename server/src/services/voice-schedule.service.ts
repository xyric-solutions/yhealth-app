/**
 * @file Voice Schedule Service
 * @description Manages voice customization and AI-initiated call scheduling
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';

// ============================================================================
// Types
// ============================================================================

export type VoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type AICallFrequency = 'off' | 'minimal' | 'moderate' | 'proactive';

export interface VoiceSettings {
  voiceId: VoiceId;
  speechPace: number; // 0.5 to 2.0
  voicePreviewPlayed: boolean;
}

export interface ScheduleSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM format
  quietHoursEnd: string;
  dndDays: number[]; // 0=Sunday, 1=Monday, etc.
  aiCallFrequency: AICallFrequency;
  preferredCallTimes: string[]; // Array of HH:MM times
}

export interface VoiceSchedulePreferences extends VoiceSettings, ScheduleSettings {}

export interface VoiceOption {
  id: VoiceId;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  tone: string;
  previewUrl?: string;
}

// Available voice options
export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Balanced and versatile',
    gender: 'neutral',
    tone: 'Professional, clear',
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Warm and engaging',
    gender: 'male',
    tone: 'Friendly, conversational',
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Expressive and dynamic',
    gender: 'female',
    tone: 'Energetic, motivating',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Deep and authoritative',
    gender: 'male',
    tone: 'Calm, reassuring',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Bright and optimistic',
    gender: 'female',
    tone: 'Upbeat, encouraging',
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Soft and soothing',
    gender: 'female',
    tone: 'Gentle, calming',
  },
];

// AI call frequency descriptions
export const FREQUENCY_OPTIONS: Record<AICallFrequency, { label: string; description: string; callsPerWeek: string }> = {
  off: {
    label: 'Off',
    description: 'AI will never initiate calls',
    callsPerWeek: '0',
  },
  minimal: {
    label: 'Minimal',
    description: 'AI initiates calls only for important check-ins',
    callsPerWeek: '1-2',
  },
  moderate: {
    label: 'Moderate',
    description: 'Regular check-ins based on your schedule',
    callsPerWeek: '3-4',
  },
  proactive: {
    label: 'Proactive',
    description: 'AI actively reaches out for support and motivation',
    callsPerWeek: '5-7',
  },
};

interface PreferencesRow {
  voice_id: string | null;
  speech_pace: number | string | null;
  voice_preview_played: boolean | null;
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  dnd_days: number[] | null;
  ai_call_frequency: string | null;
  preferred_call_times: string[] | null;
}

// ============================================================================
// Service
// ============================================================================

class VoiceScheduleService {
  /**
   * Get voice and schedule preferences for user
   */
  async getPreferences(userId: string): Promise<VoiceSchedulePreferences> {
    try {
      const result = await query<PreferencesRow>(
        `SELECT voice_id, speech_pace, voice_preview_played,
                quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
                dnd_days, ai_call_frequency, preferred_call_times
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return this.getDefaultPreferences();
      }

      const row = result.rows[0];
      return {
        voiceId: (row.voice_id as VoiceId) || 'alloy',
        speechPace: typeof row.speech_pace === 'string' 
          ? parseFloat(row.speech_pace) 
          : row.speech_pace || 1.0,
        voicePreviewPlayed: row.voice_preview_played || false,
        quietHoursEnabled: row.quiet_hours_enabled || false,
        quietHoursStart: row.quiet_hours_start || '22:00',
        quietHoursEnd: row.quiet_hours_end || '07:00',
        dndDays: row.dnd_days || [],
        aiCallFrequency: (row.ai_call_frequency as AICallFrequency) || 'moderate',
        preferredCallTimes: row.preferred_call_times || [],
      };
    } catch (error) {
      logger.error('[VoiceSchedule] Error getting preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update voice settings
   */
  async updateVoiceSettings(
    userId: string,
    settings: Partial<VoiceSettings>
  ): Promise<VoiceSettings> {
    try {
      // Validate voice ID
      if (settings.voiceId && !VOICE_OPTIONS.find(v => v.id === settings.voiceId)) {
        throw new Error('Invalid voice ID');
      }

      // Validate speech pace
      if (settings.speechPace !== undefined) {
        if (settings.speechPace < 0.5 || settings.speechPace > 2.0) {
          throw new Error('Speech pace must be between 0.5 and 2.0');
        }
      }

      const updates: string[] = [];
      const values: (string | number | boolean)[] = [];
      let paramIndex = 1;

      if (settings.voiceId !== undefined) {
        updates.push(`voice_id = $${paramIndex}`);
        values.push(settings.voiceId);
        paramIndex++;
      }

      if (settings.speechPace !== undefined) {
        updates.push(`speech_pace = $${paramIndex}`);
        values.push(settings.speechPace);
        paramIndex++;
      }

      if (settings.voicePreviewPlayed !== undefined) {
        updates.push(`voice_preview_played = $${paramIndex}`);
        values.push(settings.voicePreviewPlayed);
        paramIndex++;
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);

        // Check if preferences exist
        const existsResult = await query<{ id: string }>(
          `SELECT id FROM user_preferences WHERE user_id = $1`,
          [userId]
        );

        if (existsResult.rows.length === 0) {
          // Create preferences
          await query(
            `INSERT INTO user_preferences (user_id, voice_id, speech_pace, voice_preview_played)
             VALUES ($1, $2, $3, $4)`,
            [
              userId,
              settings.voiceId || 'alloy',
              settings.speechPace || 1.0,
              settings.voicePreviewPlayed || false,
            ]
          );
        } else {
          // Update preferences
          await query(
            `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
            values
          );
        }
      }

      // Return updated settings
      const prefs = await this.getPreferences(userId);
      return {
        voiceId: prefs.voiceId,
        speechPace: prefs.speechPace,
        voicePreviewPlayed: prefs.voicePreviewPlayed,
      };
    } catch (error) {
      logger.error('[VoiceSchedule] Error updating voice settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Update schedule settings
   */
  async updateScheduleSettings(
    userId: string,
    settings: Partial<ScheduleSettings>
  ): Promise<ScheduleSettings> {
    try {
      // Validate DND days
      if (settings.dndDays) {
        if (!settings.dndDays.every(d => d >= 0 && d <= 6)) {
          throw new Error('DND days must be between 0 (Sunday) and 6 (Saturday)');
        }
      }

      // Validate AI call frequency
      if (settings.aiCallFrequency && !FREQUENCY_OPTIONS[settings.aiCallFrequency]) {
        throw new Error('Invalid AI call frequency');
      }

      const updates: string[] = [];
      const values: (string | number | boolean | number[] | string[])[] = [];
      let paramIndex = 1;

      if (settings.quietHoursEnabled !== undefined) {
        updates.push(`quiet_hours_enabled = $${paramIndex}`);
        values.push(settings.quietHoursEnabled);
        paramIndex++;
      }

      if (settings.quietHoursStart !== undefined) {
        updates.push(`quiet_hours_start = $${paramIndex}::TIME`);
        values.push(settings.quietHoursStart);
        paramIndex++;
      }

      if (settings.quietHoursEnd !== undefined) {
        updates.push(`quiet_hours_end = $${paramIndex}::TIME`);
        values.push(settings.quietHoursEnd);
        paramIndex++;
      }

      if (settings.dndDays !== undefined) {
        updates.push(`dnd_days = $${paramIndex}`);
        values.push(settings.dndDays);
        paramIndex++;
      }

      if (settings.aiCallFrequency !== undefined) {
        updates.push(`ai_call_frequency = $${paramIndex}`);
        values.push(settings.aiCallFrequency);
        paramIndex++;
      }

      if (settings.preferredCallTimes !== undefined) {
        updates.push(`preferred_call_times = $${paramIndex}`);
        values.push(settings.preferredCallTimes);
        paramIndex++;
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);

        // Check if preferences exist
        const existsResult = await query<{ id: string }>(
          `SELECT id FROM user_preferences WHERE user_id = $1`,
          [userId]
        );

        if (existsResult.rows.length === 0) {
          // Create with defaults
          await query(
            `INSERT INTO user_preferences (user_id) VALUES ($1)`,
            [userId]
          );
        }

        // Update preferences
        await query(
          `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
          values
        );
      }

      // Return updated settings
      const prefs = await this.getPreferences(userId);
      return {
        quietHoursEnabled: prefs.quietHoursEnabled,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
        dndDays: prefs.dndDays,
        aiCallFrequency: prefs.aiCallFrequency,
        preferredCallTimes: prefs.preferredCallTimes,
      };
    } catch (error) {
      logger.error('[VoiceSchedule] Error updating schedule settings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if AI can initiate a call now
   */
  async canInitiateCall(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const prefs = await this.getPreferences(userId);

      // Check if AI calls are disabled
      if (prefs.aiCallFrequency === 'off') {
        return { allowed: false, reason: 'AI-initiated calls are disabled' };
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      // Check DND days
      if (prefs.dndDays.includes(currentDay)) {
        return { allowed: false, reason: 'Today is a do-not-disturb day' };
      }

      // Check quiet hours
      if (prefs.quietHoursEnabled) {
        const isInQuietHours = this.isTimeInRange(
          currentTime,
          prefs.quietHoursStart,
          prefs.quietHoursEnd
        );
        if (isInQuietHours) {
          return { allowed: false, reason: 'Currently in quiet hours' };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('[VoiceSchedule] Error checking call permission', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return { allowed: false, reason: 'Error checking preferences' };
    }
  }

  /**
   * Check if time is within a range (handles overnight ranges)
   */
  private isTimeInRange(time: string, start: string, end: string): boolean {
    if (start <= end) {
      // Normal range (e.g., 09:00 to 17:00)
      return time >= start && time <= end;
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      return time >= start || time <= end;
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): VoiceSchedulePreferences {
    return {
      voiceId: 'alloy',
      speechPace: 1.0,
      voicePreviewPlayed: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      dndDays: [],
      aiCallFrequency: 'moderate',
      preferredCallTimes: [],
    };
  }

  /**
   * Get available voice options
   */
  getVoiceOptions(): VoiceOption[] {
    return VOICE_OPTIONS;
  }

  /**
   * Get frequency options
   */
  getFrequencyOptions(): typeof FREQUENCY_OPTIONS {
    return FREQUENCY_OPTIONS;
  }
}

export const voiceScheduleService = new VoiceScheduleService();

