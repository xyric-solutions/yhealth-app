/**
 * @file Alarm Sync Service
 * Handles automatic alarm creation from user schedule activities
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { workoutAlarmService, type WorkoutAlarm, type CreateAlarmInput } from './workout-alarm.service.js';
import { scheduleService, type DailySchedule } from './schedule.service.js';
import { ApiError } from '../utils/ApiError.js';

// ============================================
// TYPES
// ============================================

export interface AlarmSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  alarms: WorkoutAlarm[];
}

export interface AlarmSyncStatus {
  totalScheduleItems: number;
  itemsWithAlarms: number;
  itemsWithoutAlarms: number;
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
}

interface UserPreferencesRow {
  auto_sync_enabled: boolean;
}

interface AlarmRow {
  id: string;
  alarm_time: string;
  days_of_week: number[];
  metadata: Record<string, unknown> | null;
}

// ============================================
// SERVICE CLASS
// ============================================

class AlarmSyncService {
  /**
   * Get user's auto_sync_enabled preference
   */
  private async getUserAutoSyncPreference(userId: string): Promise<boolean> {
    try {
      const result = await query<UserPreferencesRow>(
        `SELECT auto_sync_enabled FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Default to true if preferences don't exist
        return true;
      }

      return result.rows[0].auto_sync_enabled ?? true;
    } catch (error) {
      logger.error('[AlarmSync] Error getting user auto_sync preference', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Default to true on error
      return true;
    }
  }

  /**
   * Find existing alarm for a schedule item
   */
  private async findAlarmForScheduleItem(
    userId: string,
    scheduleItemId: string,
    alarmTime: string
  ): Promise<WorkoutAlarm | null> {
    try {
      const result = await query<AlarmRow>(
        `SELECT id, alarm_time, days_of_week, metadata FROM workout_alarms
         WHERE user_id = $1 
         AND alarm_time = $2
         AND (metadata->>'schedule_item_id')::text = $3`,
        [userId, alarmTime, scheduleItemId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Get full alarm details
      return await workoutAlarmService.getAlarm(userId, result.rows[0].id);
    } catch (error) {
      logger.error('[AlarmSync] Error finding alarm for schedule item', {
        userId,
        scheduleItemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Find alarm by time and days pattern (for deduplication)
   */
  private async findAlarmByTimeAndDays(
    userId: string,
    alarmTime: string,
    daysOfWeek: number[]
  ): Promise<WorkoutAlarm | null> {
    try {
      // Sort days for consistent comparison
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const daysArray = `{${sortedDays.join(',')}}`;

      const result = await query<AlarmRow>(
        `SELECT id FROM workout_alarms
         WHERE user_id = $1
         AND alarm_time = $2
         AND days_of_week = $3
         AND (metadata->>'auto_created')::boolean = true
         LIMIT 1`,
        [userId, alarmTime, daysArray]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return await workoutAlarmService.getAlarm(userId, result.rows[0].id);
    } catch (error) {
      logger.error('[AlarmSync] Error finding alarm by time and days', {
        userId,
        alarmTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate unique alarm name from schedule item title
   * This ensures consistent naming for deduplication
   */
  private generateAlarmName(title: string): string {
    return `Schedule: ${title.trim()}`;
  }

  /**
   * Find alarm by unique name (primary deduplication method)
   * This is the preferred method - if alarm with same name exists, we update it
   */
  private async findAlarmByName(
    userId: string,
    alarmName: string
  ): Promise<WorkoutAlarm | null> {
    try {
      const result = await query<{ id: string }>(
        `SELECT id FROM workout_alarms
         WHERE user_id = $1
         AND title = $2
         AND (metadata->>'auto_created')::boolean = true
         LIMIT 1`,
        [userId, alarmName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return await workoutAlarmService.getAlarm(userId, result.rows[0].id);
    } catch (error) {
      logger.error('[AlarmSync] Error finding alarm by name', {
        userId,
        alarmName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Determine days of week from schedule date
   * For now, default to all days (0-6) since schedules are daily
   * In future, could analyze recurring patterns
   */
  private getDaysOfWeekFromSchedule(_schedule: DailySchedule): number[] {
    // Default to all days for daily schedules
    // Could be enhanced to detect recurring patterns
    return [0, 1, 2, 3, 4, 5, 6];
  }

  /**
   * Sync alarm from a single schedule item
   */
  async syncAlarmsFromScheduleItem(
    userId: string,
    scheduleItemId: string,
    scheduleId: string
  ): Promise<WorkoutAlarm | null> {
    try {
      // Check if auto_sync is enabled
      const autoSyncEnabled = await this.getUserAutoSyncPreference(userId);
      if (!autoSyncEnabled) {
        logger.debug('[AlarmSync] Auto-sync disabled for user', { userId });
        return null;
      }

      // Get schedule item
      const schedule = await scheduleService.getScheduleById(userId, scheduleId);
      const item = schedule.items.find((i) => i.id === scheduleItemId);

      if (!item) {
        logger.warn('[AlarmSync] Schedule item not found', { userId, scheduleItemId, scheduleId });
        return null;
      }

      // Skip if no start_time
      if (!item.startTime) {
        logger.debug('[AlarmSync] Schedule item has no start_time, skipping', {
          userId,
          scheduleItemId,
        });
        return null;
      }

      // Extract time in HH:MM format
      const alarmTime = item.startTime.substring(0, 5); // Extract HH:MM from HH:MM:SS

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(alarmTime)) {
        logger.warn('[AlarmSync] Invalid time format in schedule item', {
          userId,
          scheduleItemId,
          startTime: item.startTime,
        });
        return null;
      }

      // Determine days of week
      const daysOfWeek = this.getDaysOfWeekFromSchedule(schedule);

      // Generate unique alarm name for deduplication
      const alarmName = this.generateAlarmName(item.title || 'Schedule Reminder');

      // PRIMARY: Check if alarm with same NAME already exists (prevents duplicates)
      let existingAlarm = await this.findAlarmByName(userId, alarmName);

      // FALLBACK 1: Check by schedule_item_id if not found by name
      if (!existingAlarm) {
        existingAlarm = await this.findAlarmForScheduleItem(userId, scheduleItemId, alarmTime);
      }

      // FALLBACK 2: Check by time and days (for backward compatibility)
      if (!existingAlarm) {
        existingAlarm = await this.findAlarmByTimeAndDays(userId, alarmTime, daysOfWeek);
      }

      const alarmInput: CreateAlarmInput = {
        title: alarmName, // Use the generated unique name
        message: item.description || `Reminder for ${item.title}`,
        alarmTime,
        daysOfWeek,
        notificationType: 'push',
        soundEnabled: true,
        soundFile: 'alarm.wav',
        vibrationEnabled: true,
        snoozeMinutes: 10,
      };

      logger.debug('[AlarmSync] Alarm sync check', {
        userId,
        scheduleItemId,
        alarmName,
        existingAlarmId: existingAlarm?.id || null,
        action: existingAlarm ? 'update' : 'create',
      });

      if (existingAlarm) {
        // Update existing alarm
        const updated = await workoutAlarmService.updateAlarm(userId, existingAlarm.id, {
          title: alarmInput.title,
          message: alarmInput.message,
          alarmTime: alarmInput.alarmTime,
          daysOfWeek: alarmInput.daysOfWeek,
        });

        // Update metadata to include schedule_item_id
        if (updated) {
          await query(
            `UPDATE workout_alarms 
             SET metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{schedule_item_id}',
               $1::jsonb
             )
             WHERE id = $2`,
            [JSON.stringify(scheduleItemId), updated.id]
          );

          logger.info('[AlarmSync] Updated alarm from schedule item', {
            userId,
            scheduleItemId,
            alarmId: updated.id,
            alarmTime,
          });
        }

        return updated;
      } else {
        // Create new alarm
        const newAlarm = await workoutAlarmService.createAlarm(userId, alarmInput);

        // Add metadata to track schedule item relationship
        await query(
          `UPDATE workout_alarms 
           SET metadata = jsonb_build_object(
             'schedule_item_id', $1::text,
             'schedule_id', $2::text,
             'auto_created', true
           )
           WHERE id = $3::uuid`,
          [scheduleItemId, scheduleId, newAlarm.id]
        );

        // Reload alarm with metadata
        const alarmWithMetadata = await workoutAlarmService.getAlarm(userId, newAlarm.id);

        logger.info('[AlarmSync] Created alarm from schedule item', {
          userId,
          scheduleItemId,
          alarmId: newAlarm.id,
          alarmTime,
        });

        return alarmWithMetadata;
      }
    } catch (error) {
      logger.error('[AlarmSync] Error syncing alarm from schedule item', {
        userId,
        scheduleItemId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to sync alarm from schedule item');
    }
  }

  /**
   * Sync alarms from all schedule items in a schedule (or all schedules)
   */
  async syncAlarmsFromSchedule(
    userId: string,
    scheduleId?: string
  ): Promise<AlarmSyncResult> {
    const result: AlarmSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      alarms: [],
    };

    try {
      // Check if auto_sync is enabled
      const autoSyncEnabled = await this.getUserAutoSyncPreference(userId);
      if (!autoSyncEnabled) {
        logger.debug('[AlarmSync] Auto-sync disabled for user', { userId });
        return result;
      }

      let schedules: DailySchedule[];

      if (scheduleId) {
        // Sync specific schedule
        const schedule = await scheduleService.getScheduleById(userId, scheduleId);
        schedules = [schedule];
      } else {
        // Get all schedules for user (recent ones, last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const startDate = thirtyDaysAgo.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        const calendarSchedules = await scheduleService.getSchedulesForCalendar(
          userId,
          startDate,
          endDate
        );

        // Fetch full schedule details
        schedules = [];
        for (const calSchedule of calendarSchedules) {
          if (calSchedule.scheduleId) {
            try {
              const schedule = await scheduleService.getScheduleById(userId, calSchedule.scheduleId);
              schedules.push(schedule);
            } catch (error) {
              logger.warn('[AlarmSync] Failed to fetch schedule', {
                userId,
                scheduleId: calSchedule.scheduleId,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }

      // Process each schedule
      for (const schedule of schedules) {
        for (const item of schedule.items) {
          try {
            if (!item.startTime) {
              result.skipped++;
              continue;
            }

            const alarm = await this.syncAlarmsFromScheduleItem(
              userId,
              item.id,
              schedule.id
            );

            if (alarm) {
              // Check if it was created or updated by checking if it's in our result set
              const existing = result.alarms.find((a) => a.id === alarm.id);
              if (existing) {
                result.updated++;
              } else {
                result.created++;
                result.alarms.push(alarm);
              }
            } else {
              result.skipped++;
            }
          } catch (error) {
            result.errors++;
            logger.error('[AlarmSync] Error processing schedule item', {
              userId,
              scheduleId: schedule.id,
              itemId: item.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      logger.info('[AlarmSync] Sync completed', {
        userId,
        scheduleId,
        ...result,
      });

      return result;
    } catch (error) {
      logger.error('[AlarmSync] Error syncing alarms from schedule', {
        userId,
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to sync alarms from schedule');
    }
  }

  /**
   * Remove alarm for a deleted schedule item
   */
  async removeAlarmForScheduleItem(userId: string, scheduleItemId: string): Promise<boolean> {
    try {
      // Find alarm by schedule_item_id in metadata
      const result = await query<{ id: string }>(
        `SELECT id FROM workout_alarms
         WHERE user_id = $1
         AND (metadata->>'schedule_item_id')::text = $2
         AND (metadata->>'auto_created')::boolean = true`,
        [userId, scheduleItemId]
      );

      if (result.rows.length === 0) {
        logger.debug('[AlarmSync] No alarm found for schedule item', {
          userId,
          scheduleItemId,
        });
        return false;
      }

      // Delete the alarm
      for (const row of result.rows) {
        await query(`DELETE FROM workout_alarms WHERE id = $1 AND user_id = $2`, [
          row.id,
          userId,
        ]);

        logger.info('[AlarmSync] Removed alarm for deleted schedule item', {
          userId,
          scheduleItemId,
          alarmId: row.id,
        });
      }

      return true;
    } catch (error) {
      logger.error('[AlarmSync] Error removing alarm for schedule item', {
        userId,
        scheduleItemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string): Promise<AlarmSyncStatus> {
    try {
      const autoSyncEnabled = await this.getUserAutoSyncPreference(userId);

      // Get all schedule items with start_time
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const calendarSchedules = await scheduleService.getSchedulesForCalendar(
        userId,
        startDate,
        endDate
      );

      let totalItems = 0;
      let itemsWithAlarms = 0;

      for (const calSchedule of calendarSchedules) {
        if (calSchedule.scheduleId) {
          try {
            const schedule = await scheduleService.getScheduleById(userId, calSchedule.scheduleId);
            for (const item of schedule.items) {
              if (item.startTime) {
                totalItems++;
                const alarm = await this.findAlarmForScheduleItem(
                  userId,
                  item.id,
                  item.startTime.substring(0, 5)
                );
                if (alarm) {
                  itemsWithAlarms++;
                }
              }
            }
          } catch (_error) {
            logger.warn('[AlarmSync] Error fetching schedule for status', {
              userId,
              scheduleId: calSchedule.scheduleId,
            });
          }
        }
      }

      // Get last sync time (from most recent alarm update)
      const lastSyncResult = await query<{ updated_at: Date }>(
        `SELECT MAX(updated_at) as updated_at FROM workout_alarms
         WHERE user_id = $1
         AND (metadata->>'auto_created')::boolean = true`,
        [userId]
      );

      return {
        totalScheduleItems: totalItems,
        itemsWithAlarms,
        itemsWithoutAlarms: totalItems - itemsWithAlarms,
        autoSyncEnabled,
        lastSyncAt: lastSyncResult.rows[0]?.updated_at
          ? lastSyncResult.rows[0].updated_at.toISOString()
          : null,
      };
    } catch (error) {
      logger.error('[AlarmSync] Error getting sync status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to get sync status');
    }
  }
}

export const alarmSyncService = new AlarmSyncService();
export default alarmSyncService;

