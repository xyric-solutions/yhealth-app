/**
 * @file Workout Alarm Service
 * Handles workout reminders and alarm scheduling
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface WorkoutAlarm {
  id: string;
  userId: string;
  workoutPlanId: string | null;
  title: string;
  message: string | null;
  alarmTime: string; // HH:MM format
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  isEnabled: boolean;
  lastTriggeredAt: string | null;
  nextTriggerAt: string | null;
  notificationType: 'push' | 'email' | 'sms' | 'all';
  soundEnabled: boolean;
  soundFile: string;
  vibrationEnabled: boolean;
  snoozeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlarmInput {
  workoutPlanId?: string;
  title?: string;
  message?: string;
  alarmTime: string; // HH:MM format
  daysOfWeek?: number[];
  notificationType?: 'push' | 'email' | 'sms' | 'all';
  soundEnabled?: boolean;
  soundFile?: string;
  vibrationEnabled?: boolean;
  snoozeMinutes?: number;
}

export interface UpdateAlarmInput {
  title?: string;
  message?: string;
  alarmTime?: string;
  daysOfWeek?: number[];
  isEnabled?: boolean;
  notificationType?: 'push' | 'email' | 'sms' | 'all';
  soundEnabled?: boolean;
  soundFile?: string;
  vibrationEnabled?: boolean;
  snoozeMinutes?: number;
}

// Day names for display
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================
// SERVICE CLASS
// ============================================

class WorkoutAlarmService {
  /**
   * Get all alarms for a user
   */
  async getAlarms(userId: string): Promise<WorkoutAlarm[]> {
    const result = await pool.query(
      `SELECT * FROM workout_alarms
       WHERE user_id = $1
       ORDER BY alarm_time ASC`,
      [userId]
    );

    return result.rows.map(this.mapAlarmRow);
  }

  /**
   * Get enabled alarms for a user
   */
  async getEnabledAlarms(userId: string): Promise<WorkoutAlarm[]> {
    const result = await pool.query(
      `SELECT * FROM workout_alarms
       WHERE user_id = $1 AND is_enabled = true
       ORDER BY alarm_time ASC`,
      [userId]
    );

    return result.rows.map(this.mapAlarmRow);
  }

  /**
   * Get a single alarm by ID
   */
  async getAlarm(userId: string, alarmId: string): Promise<WorkoutAlarm | null> {
    const result = await pool.query(
      `SELECT * FROM workout_alarms WHERE id = $1 AND user_id = $2`,
      [alarmId, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapAlarmRow(result.rows[0]);
  }

  /**
   * Create a new workout alarm
   */
  async createAlarm(userId: string, input: CreateAlarmInput): Promise<WorkoutAlarm> {
    const {
      workoutPlanId,
      title = 'Workout Reminder',
      message,
      alarmTime,
      daysOfWeek = [1, 2, 3, 4, 5], // Default: Mon-Fri
      notificationType = 'push',
      soundEnabled = true,
      soundFile = 'alarm.wav',
      vibrationEnabled = true,
      snoozeMinutes = 10,
    } = input;

    // Get user's timezone
    const timezone = await this.getUserTimezone(userId);
    
    // Calculate next trigger time using user's timezone
    const nextTriggerAt = this.calculateNextTrigger(alarmTime, daysOfWeek, timezone);
    
    // Verify the calculation by converting back to local time
    const verifyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const nextTriggerDate = new Date(nextTriggerAt);
    const verifyParts = verifyFormatter.formatToParts(nextTriggerDate);
    const verifyHour = parseInt(verifyParts.find(p => p.type === 'hour')?.value || '0');
    const verifyMinute = parseInt(verifyParts.find(p => p.type === 'minute')?.value || '0');
    const [alarmHour, alarmMinute] = alarmTime.split(':').map(Number);
    const timeMatches = verifyHour === alarmHour && verifyMinute === alarmMinute;
    
    logger.info('[WorkoutAlarm] Creating alarm with timezone', {
      userId,
      alarmTime,
      timezone,
      nextTriggerAt,
      daysOfWeek,
      verification: {
        expectedLocalTime: alarmTime,
        actualLocalTime: `${String(verifyHour).padStart(2, '0')}:${String(verifyMinute).padStart(2, '0')}`,
        matches: timeMatches,
      },
    });
    
    if (!timeMatches) {
      logger.error('[WorkoutAlarm] TIMEZONE CALCULATION MISMATCH!', {
        userId,
        alarmTime,
        timezone,
        nextTriggerAt,
        expectedLocalTime: alarmTime,
        actualLocalTime: `${String(verifyHour).padStart(2, '0')}:${String(verifyMinute).padStart(2, '0')}`,
      });
    }

    const result = await pool.query(
      `INSERT INTO workout_alarms (
        user_id, workout_plan_id, title, message, alarm_time,
        days_of_week, notification_type, sound_enabled, sound_file, vibration_enabled,
        snooze_minutes, next_trigger_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        workoutPlanId || null,
        title,
        message || null,
        alarmTime,
        daysOfWeek,
        notificationType,
        soundEnabled,
        soundFile,
        vibrationEnabled,
        snoozeMinutes,
        nextTriggerAt,
      ]
    );

    logger.info(`Workout alarm created for user ${userId}`, { alarmTime, daysOfWeek });
    return this.mapAlarmRow(result.rows[0]);
  }

  /**
   * Update an existing alarm
   */
  async updateAlarm(
    userId: string,
    alarmId: string,
    input: UpdateAlarmInput
  ): Promise<WorkoutAlarm | null> {
    // First check if alarm exists and belongs to user
    const existing = await this.getAlarm(userId, alarmId);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.message !== undefined) {
      updates.push(`message = $${paramIndex++}`);
      values.push(input.message);
    }
    if (input.alarmTime !== undefined) {
      updates.push(`alarm_time = $${paramIndex++}`);
      values.push(input.alarmTime);
    }
    if (input.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(input.daysOfWeek);
    }
    if (input.isEnabled !== undefined) {
      updates.push(`is_enabled = $${paramIndex++}`);
      values.push(input.isEnabled);
    }
    if (input.notificationType !== undefined) {
      updates.push(`notification_type = $${paramIndex++}`);
      values.push(input.notificationType);
    }
    if (input.soundEnabled !== undefined) {
      updates.push(`sound_enabled = $${paramIndex++}`);
      values.push(input.soundEnabled);
    }
    if (input.soundFile !== undefined) {
      updates.push(`sound_file = $${paramIndex++}`);
      values.push(input.soundFile);
    }
    if (input.vibrationEnabled !== undefined) {
      updates.push(`vibration_enabled = $${paramIndex++}`);
      values.push(input.vibrationEnabled);
    }
    if (input.snoozeMinutes !== undefined) {
      updates.push(`snooze_minutes = $${paramIndex++}`);
      values.push(input.snoozeMinutes);
    }

    // Recalculate next trigger if time or days changed
    if (input.alarmTime !== undefined || input.daysOfWeek !== undefined) {
      const newTime = input.alarmTime || existing.alarmTime;
      const newDays = input.daysOfWeek || existing.daysOfWeek;
      const timezone = await this.getUserTimezone(userId);
      const nextTriggerAt = this.calculateNextTrigger(newTime, newDays, timezone);
      updates.push(`next_trigger_at = $${paramIndex++}`);
      values.push(nextTriggerAt);
      
      logger.info('[WorkoutAlarm] Recalculating next trigger with timezone', {
        alarmId,
        userId,
        alarmTime: newTime,
        timezone,
        nextTriggerAt,
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      // Only updated_at, nothing else changed
      return existing;
    }

    values.push(alarmId, userId);

    const result = await pool.query(
      `UPDATE workout_alarms
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    logger.info(`Workout alarm updated for user ${userId}`, { alarmId });
    return this.mapAlarmRow(result.rows[0]);
  }

  /**
   * Toggle alarm enabled state
   */
  async toggleAlarm(userId: string, alarmId: string): Promise<WorkoutAlarm | null> {
    const result = await pool.query(
      `UPDATE workout_alarms
       SET is_enabled = NOT is_enabled, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [alarmId, userId]
    );

    if (result.rows.length === 0) return null;

    const alarm = this.mapAlarmRow(result.rows[0]);
    logger.info(`Workout alarm toggled for user ${userId}`, { alarmId, isEnabled: alarm.isEnabled });
    return alarm;
  }

  /**
   * Snooze alarm for specified minutes
   */
  async snoozeAlarm(userId: string, alarmId: string, minutes: number): Promise<WorkoutAlarm | null> {
    // Verify alarm exists and belongs to user
    const existing = await this.getAlarm(userId, alarmId);
    if (!existing) return null;

    // Calculate next trigger time (current time + snooze minutes)
    const nextTrigger = new Date();
    nextTrigger.setMinutes(nextTrigger.getMinutes() + minutes);

    const result = await pool.query(
      `UPDATE workout_alarms
       SET next_trigger_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [nextTrigger.toISOString(), alarmId, userId]
    );

    if (result.rows.length === 0) return null;

    const alarm = this.mapAlarmRow(result.rows[0]);
    logger.info(`Workout alarm snoozed for user ${userId}`, { alarmId, minutes, nextTriggerAt: alarm.nextTriggerAt });
    return alarm;
  }

  /**
   * Delete an alarm
   */
  async deleteAlarm(userId: string, alarmId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM workout_alarms WHERE id = $1 AND user_id = $2`,
      [alarmId, userId]
    );

    if (result.rowCount === 0) return false;

    logger.info(`Workout alarm deleted for user ${userId}`, { alarmId });
    return true;
  }

  /**
   * Get alarms that should trigger now (for background job)
   */
  async getAlarmsToTrigger(): Promise<WorkoutAlarm[]> {
    const jsNow = new Date();
    
    try {
      // Get current database time for comparison
      let dbNow: Date | null = null;
      try {
        const dbTimeResult = await pool.query(`SELECT NOW() as db_now`);
        dbNow = dbTimeResult.rows[0]?.db_now;
      } catch (error) {
        logger.error('[WorkoutAlarm] Failed to get database time', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      
      // Get all enabled alarms for debugging
      let allAlarmsCount = 0;
      try {
        const allAlarmsResult = await pool.query(
          `SELECT id, user_id, title, alarm_time, days_of_week, next_trigger_at, last_triggered_at, is_enabled 
           FROM workout_alarms 
           WHERE is_enabled = true`
        );
        allAlarmsCount = allAlarmsResult.rows.length;
      } catch (error) {
        logger.error('[WorkoutAlarm] Failed to fetch all enabled alarms', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    
      // First, auto-recalculate alarms with next_trigger_at way in the past (more than 1 hour)
      // These are likely incorrectly calculated or missed triggers
      let _staleAlarmsRecalculated = 0;
      try {
    const staleAlarmsResult = await pool.query(
          `SELECT id, alarm_time, days_of_week, next_trigger_at, user_id FROM workout_alarms
       WHERE is_enabled = true
       AND next_trigger_at IS NOT NULL
           AND next_trigger_at < NOW() - INTERVAL '1 hour'
       AND (last_triggered_at IS NULL OR last_triggered_at < next_trigger_at)`
    );
        
        for (const staleAlarm of staleAlarmsResult.rows) {
          try {
            const timezone = await this.getUserTimezone(staleAlarm.user_id);
            const recalculated = this.calculateNextTrigger(staleAlarm.alarm_time, staleAlarm.days_of_week, timezone);
            await pool.query(
              `UPDATE workout_alarms SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2`,
              [recalculated, staleAlarm.id]
            );
            _staleAlarmsRecalculated++;
      logger.info('[WorkoutAlarm] Auto-recalculated stale alarm', {
        alarmId: staleAlarm.id,
              userId: staleAlarm.user_id,
              timezone,
              oldNextTrigger: staleAlarm.next_trigger_at?.toISOString(),
        newNextTrigger: recalculated,
            });
          } catch (error) {
            logger.error('[WorkoutAlarm] Failed to recalculate stale alarm', {
              alarmId: staleAlarm.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      } catch (error) {
        logger.error('[WorkoutAlarm] Failed to query stale alarms', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    
      // Before querying, recalculate any alarms that might have incorrect next_trigger_at
      // This handles alarms created before timezone support was added or with calculation errors
      let recalculatedCount = 0;
      try {
        const allEnabledAlarmsResult = await pool.query(
          `SELECT id, user_id, alarm_time, days_of_week, next_trigger_at, last_triggered_at
           FROM workout_alarms 
           WHERE is_enabled = true`
        );
        
        const nowTime = dbNow?.getTime() || jsNow.getTime();
        
        for (const alarm of allEnabledAlarmsResult.rows) {
          try {
            let timezone = await this.getUserTimezone(alarm.user_id);
            
            // If user timezone is UTC but alarm times suggest a different timezone,
            // try to infer the timezone by comparing alarm time with current UTC time
            if (timezone === 'UTC') {
              const [alarmHours, alarmMinutes] = alarm.alarm_time.split(':').map(Number);
              const alarmTimeMinutes = alarmHours * 60 + alarmMinutes;
              
              // Get current UTC time
              const currentUtcHours = jsNow.getUTCHours();
              const currentUtcMinutes = jsNow.getUTCMinutes();
              const currentUtcTimeMinutes = currentUtcHours * 60 + currentUtcMinutes;
              
              // Calculate what timezone offset would make the alarm time match current time
              // If alarm is 13:22 (802 minutes) and current UTC is 08:23 (503 minutes),
              // then offset = 802 - 503 = 299 minutes = ~5 hours (UTC+5)
              let offsetMinutes = alarmTimeMinutes - currentUtcTimeMinutes;
              
              // Normalize to -12 to +14 hour range
              if (offsetMinutes > 12 * 60) offsetMinutes -= 24 * 60;
              if (offsetMinutes < -12 * 60) offsetMinutes += 24 * 60;
              
              const offsetHours = Math.round(offsetMinutes / 60);
              
              // If there's a significant offset (>= 1 hour and <= 14 hours), try to infer timezone
              // Only infer if the offset makes sense (alarm time is close to current time in that timezone)
              if (Math.abs(offsetHours) >= 1 && Math.abs(offsetHours) <= 14) {
                // Common timezone offsets to IANA timezones
                const offsetToTimezone: Record<string, string[]> = {
                  '5': ['Asia/Karachi', 'Asia/Tashkent'],
                  '4': ['Asia/Dubai', 'Asia/Muscat'],
                  '3': ['Asia/Riyadh', 'Africa/Nairobi'],
                  '2': ['Africa/Cairo', 'Europe/Athens'],
                  '1': ['Europe/Paris', 'Africa/Lagos'],
                  '-5': ['America/New_York', 'America/Toronto'],
                  '-6': ['America/Chicago', 'America/Mexico_City'],
                  '-7': ['America/Denver', 'America/Phoenix'],
                  '-8': ['America/Los_Angeles', 'America/Vancouver'],
                };
                
                const possibleTimezones = offsetToTimezone[String(offsetHours)];
                if (possibleTimezones && possibleTimezones.length > 0) {
                  // Test if this timezone gives a reasonable next trigger time
                  const testNextTrigger = this.calculateNextTrigger(alarm.alarm_time, alarm.days_of_week, possibleTimezones[0]);
                  const testDate = new Date(testNextTrigger);
                  const timeDiff = testDate.getTime() - nowTime;
                  
                  // Only use inferred timezone if it gives a reasonable result:
                  // - Not more than 7 days in the future
                  // - Not more than 1 day in the past
                  if (timeDiff > -24 * 60 * 60 * 1000 && timeDiff < 7 * 24 * 60 * 60 * 1000) {
                    const inferredTimezone = possibleTimezones[0]; // Use first match
                    
                    // Update user's timezone preference to persist the inference
                    // This prevents repeated recalculations on every job run
                    try {
                      // First verify the user exists to avoid foreign key constraint violation
                      const userCheck = await pool.query(
                        `SELECT id FROM users WHERE id = $1`,
                        [alarm.user_id]
                      );
                      
                      if (userCheck.rows.length === 0) {
                        logger.warn('[WorkoutAlarm] User not found, skipping timezone update', {
                          userId: alarm.user_id,
                          alarmId: alarm.id,
                        });
                      } else {
                        await pool.query(
                          `INSERT INTO user_preferences (user_id, timezone, updated_at)
                           VALUES ($1, $2, NOW())
                           ON CONFLICT (user_id) 
                           DO UPDATE SET timezone = $2, updated_at = NOW()`,
                          [alarm.user_id, inferredTimezone]
                        );
                        logger.info('[WorkoutAlarm] Updated user timezone from inferred alarm pattern', {
                          alarmId: alarm.id,
                          userId: alarm.user_id,
                          alarmTime: alarm.alarm_time,
                          inferredTimezone,
                          offsetHours,
                        });
                      }
                    } catch (error) {
                      logger.warn('[WorkoutAlarm] Failed to update user timezone preference', {
                        userId: alarm.user_id,
                        error: error instanceof Error ? error.message : 'Unknown error',
                      });
                    }
                    
                    timezone = inferredTimezone;
                  }
                }
              }
            }
            
            const correctNextTrigger = this.calculateNextTrigger(alarm.alarm_time, alarm.days_of_week, timezone);
            
            // If no next_trigger_at exists, calculate it
            if (!alarm.next_trigger_at) {
              await pool.query(
                `UPDATE workout_alarms SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2`,
                [correctNextTrigger, alarm.id]
              );
              recalculatedCount++;
              logger.info('[WorkoutAlarm] Calculated missing next_trigger_at', {
                alarmId: alarm.id,
                alarmTime: alarm.alarm_time,
                timezone,
                nextTriggerAt: correctNextTrigger,
              });
              continue;
            }
            
            const currentDate = new Date(alarm.next_trigger_at);
            const correctDate = new Date(correctNextTrigger);
            const diffMs = Math.abs(correctDate.getTime() - currentDate.getTime());
            const currentTimeDiff = currentDate.getTime() - nowTime;
            
            // Recalculate if:
            // 1. Difference is more than 15 minutes (calculation error or timezone issue)
            // 2. Alarm is stale (more than 1 hour past) and hasn't been triggered for this occurrence
            // 3. Alarm is more than 24 hours in the future (definitely wrong)
            const isSignificantlyDifferent = diffMs > 15 * 60 * 1000; // More than 15 minutes difference
            const isStale = currentTimeDiff < -60 * 60 * 1000; // More than 1 hour in the past
            const isWayInFuture = currentTimeDiff > 24 * 60 * 60 * 1000; // More than 24 hours in the future
            
            // Check if alarm was already triggered for this specific next_trigger_at
            const lastTriggered = alarm.last_triggered_at ? new Date(alarm.last_triggered_at) : null;
            const wasTriggeredForThisOccurrence = lastTriggered && lastTriggered >= currentDate;
            
            const shouldRecalculate = 
              isSignificantlyDifferent || // Calculation is wrong
              (isStale && !wasTriggeredForThisOccurrence) || // Stale and not triggered
              isWayInFuture; // Way in the future (definitely wrong)
            
            if (shouldRecalculate) {
              // Log at DEBUG level for timezone-related recalculations (expected behavior)
              // Log at INFO level for significant issues (stale or way in future)
              const logLevel = (isStale || isWayInFuture) ? 'info' : 'debug';
              const logData = {
                alarmId: alarm.id,
                userId: alarm.user_id,
                alarmTime: alarm.alarm_time,
                timezone,
                currentNextTrigger: currentDate.toISOString(),
                correctNextTrigger,
                diffMinutes: Math.round(diffMs / 60000),
                currentTimeDiffMinutes: Math.round(currentTimeDiff / 60000),
                reason: isWayInFuture ? 'way_in_future' : 
                        isStale ? 'stale' : 
                        'significantly_different',
              };
              
              if (logLevel === 'info') {
                logger.info('[WorkoutAlarm] Recalculating alarm with incorrect next_trigger_at', logData);
              } else {
                logger.debug('[WorkoutAlarm] Recalculating alarm with incorrect next_trigger_at', logData);
              }
              
              await pool.query(
                `UPDATE workout_alarms SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2`,
                [correctNextTrigger, alarm.id]
              );
              recalculatedCount++;
            }
          } catch (error) {
            logger.error('[WorkoutAlarm] Failed to verify/recalculate alarm', {
              alarmId: alarm.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        if (recalculatedCount > 0) {
          logger.info('[WorkoutAlarm] Recalculated alarms before query', {
            count: recalculatedCount,
            totalChecked: allEnabledAlarmsResult.rows.length,
          });
        }
      } catch (error) {
        logger.error('[WorkoutAlarm] Failed to verify alarms before query', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    
      // Now query for alarms that should trigger
      // Use NOW() which is timezone-aware (UTC after our timezone fix)
      // Check for alarms where next_trigger_at has passed or is within the next 5 minutes
      // This ensures we catch alarms that should trigger now, accounting for:
      // - 60-second job interval
      // - Potential delays in job execution
      // - Timezone conversion issues
      // We check for alarms that are due (<= NOW() + 5 minutes) and haven't been triggered yet
      // Also check for alarms that are up to 10 minutes in the past to catch any missed triggers
      // First, let's check what alarms match the time window without the last_triggered_at condition
      // Use explicit timestamp comparison to avoid timezone issues
      const timeWindowStart = new Date((dbNow?.getTime() || jsNow.getTime()) - 10 * 60 * 1000).toISOString();
      const timeWindowEnd = new Date((dbNow?.getTime() || jsNow.getTime()) + 5 * 60 * 1000).toISOString();
      
      const timeWindowCheck = await pool.query(
        `SELECT id, title, alarm_time, next_trigger_at, last_triggered_at, user_id
         FROM workout_alarms
         WHERE is_enabled = true
         AND next_trigger_at IS NOT NULL
         AND next_trigger_at <= $1::timestamp
         AND next_trigger_at >= $2::timestamp
         ORDER BY next_trigger_at ASC`,
        [timeWindowEnd, timeWindowStart]
      );
      
      // Query for alarms that should trigger now
      // An alarm should trigger if:
      // 1. It's enabled
      // 2. next_trigger_at is within the trigger window (2 minutes past to 2 minutes future - narrower window)
      // 3. It hasn't been triggered for this specific occurrence (last_triggered_at < next_trigger_at OR NULL)
      // 4. Additional check: last_triggered_at must be NULL or more than 1 minute ago (prevents immediate retrigger)
      const result = await pool.query(
        `SELECT * FROM workout_alarms
         WHERE is_enabled = true
         AND next_trigger_at IS NOT NULL
         AND next_trigger_at <= NOW() + INTERVAL '5 minutes'
         AND next_trigger_at >= NOW() - INTERVAL '10 minutes'
         AND (last_triggered_at IS NULL OR last_triggered_at < next_trigger_at)
         AND (last_triggered_at IS NULL OR last_triggered_at < NOW() - INTERVAL '2 minutes')
         ORDER BY next_trigger_at ASC`
      );
      
      // Log detailed information about why alarms might not be matching
      if (result.rows.length === 0 && timeWindowCheck.rows.length > 0) {
        // Alarms are in time window but being filtered - check why
        const filteredAlarms = timeWindowCheck.rows.map((r: any) => {
          const nextTrigger = r.next_trigger_at ? new Date(r.next_trigger_at) : null;
          const lastTriggered = r.last_triggered_at ? new Date(r.last_triggered_at) : null;
          const passesLastTriggeredCheck = !lastTriggered || (nextTrigger && lastTriggered < nextTrigger);
          
          return {
            id: r.id,
            title: r.title,
            alarmTime: r.alarm_time,
            nextTriggerAt: r.next_trigger_at?.toISOString(),
            lastTriggeredAt: r.last_triggered_at?.toISOString(),
            passesLastTriggeredCheck,
            reason: !passesLastTriggeredCheck 
              ? `last_triggered_at (${r.last_triggered_at?.toISOString()}) >= next_trigger_at (${r.next_trigger_at?.toISOString()})`
              : 'should trigger',
          };
        });
        
        logger.warn('[WorkoutAlarm] Alarms in time window but filtered out', {
          alarmsInTimeWindow: timeWindowCheck.rows.length,
          alarmsPassingAllChecks: result.rows.length,
          filteredAlarms,
        });
      } else if (result.rows.length === 0 && allAlarmsCount > 0) {
        try {
          await pool.query(
            `SELECT id, title, alarm_time, next_trigger_at, last_triggered_at, user_id
             FROM workout_alarms 
             WHERE is_enabled = true 
             AND next_trigger_at IS NOT NULL
             ORDER BY next_trigger_at ASC
             LIMIT 10`
          );
          
        } catch (error) {
          logger.error('[WorkoutAlarm] Failed to get diagnostic alarm info', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
    if (result.rows.length > 0) {
      logger.info('[WorkoutAlarm] Found alarms to trigger', {
        count: result.rows.length,
        alarms: result.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          userId: r.user_id,
            nextTriggerAt: r.next_trigger_at?.toISOString(),
          alarmTime: r.alarm_time,
            lastTriggeredAt: r.last_triggered_at?.toISOString(),
            timeUntilTrigger: r.next_trigger_at 
              ? Math.round((new Date(r.next_trigger_at).getTime() - jsNow.getTime()) / 1000)
              : null,
        })),
      });
      }

    return result.rows.map(this.mapAlarmRow);
    } catch (error) {
      logger.error('[WorkoutAlarm] Error in getAlarmsToTrigger', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return empty array on error to prevent job crash
      return [];
    }
  }

  /**
   * Mark alarm as triggered and calculate next trigger
   */
  async markTriggered(alarmId: string): Promise<void> {
    // Get current alarm with user_id for timezone lookup
    const alarmResult = await pool.query(
      `SELECT alarm_time, days_of_week, user_id FROM workout_alarms WHERE id = $1`,
      [alarmId]
    );

    if (alarmResult.rows.length === 0) {
      logger.warn(`[WorkoutAlarm] Alarm not found when marking triggered`, { alarmId });
      return;
    }

    const { alarm_time, days_of_week, user_id } = alarmResult.rows[0];
    const timezone = await this.getUserTimezone(user_id);
    const nextTriggerAt = this.calculateNextTrigger(alarm_time, days_of_week, timezone);

    await pool.query(
      `UPDATE workout_alarms
       SET last_triggered_at = NOW(),
           next_trigger_at = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [nextTriggerAt, alarmId]
    );
    
    logger.info(`[WorkoutAlarm] Marked alarm as triggered`, {
      alarmId,
      nextTriggerAt,
      alarmTime: alarm_time,
    });

    logger.info(`[WorkoutAlarm] Alarm triggered and rescheduled`, {
      alarmId,
      alarmTime: alarm_time,
      nextTriggerAt,
      now: new Date().toISOString(),
    });
  }

  /**
   * Dismiss alarm - mark as triggered and calculate next trigger time
   * This prevents the alarm from retriggering immediately
   */
  async dismissAlarm(userId: string, alarmId: string): Promise<WorkoutAlarm | null> {
    // Verify alarm exists and belongs to user
    const existing = await this.getAlarm(userId, alarmId);
    if (!existing) {
      logger.warn(`[WorkoutAlarm] Alarm not found when dismissing`, { userId, alarmId });
      return null;
    }

    // Mark as triggered and calculate next trigger (same logic as markTriggered)
    // This ensures the alarm won't retrigger immediately
    const alarmResult = await pool.query(
      `SELECT alarm_time, days_of_week, user_id FROM workout_alarms WHERE id = $1 AND user_id = $2`,
      [alarmId, userId]
    );

    if (alarmResult.rows.length === 0) {
      logger.warn(`[WorkoutAlarm] Alarm not found or doesn't belong to user when dismissing`, { userId, alarmId });
      return null;
    }

    const { alarm_time, days_of_week, user_id } = alarmResult.rows[0];
    const timezone = await this.getUserTimezone(user_id);
    const nextTriggerAt = this.calculateNextTrigger(alarm_time, days_of_week, timezone);

    // Update alarm: set last_triggered_at to NOW() and calculate next trigger
    // This ensures the alarm won't match the trigger query again
    const result = await pool.query(
      `UPDATE workout_alarms
       SET last_triggered_at = NOW(),
           next_trigger_at = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [nextTriggerAt, alarmId, userId]
    );

    if (result.rows.length === 0) {
      logger.warn(`[WorkoutAlarm] Failed to dismiss alarm`, { userId, alarmId });
      return null;
    }

    const alarm = this.mapAlarmRow(result.rows[0]);
    logger.info(`[WorkoutAlarm] Alarm dismissed and rescheduled`, {
      userId,
      alarmId,
      alarmTime: alarm_time,
      nextTriggerAt,
      now: new Date().toISOString(),
    });

    return alarm;
  }

  /**
   * Get upcoming alarms for today
   */
  async getTodayAlarms(userId: string): Promise<WorkoutAlarm[]> {
    const today = new Date().getDay(); // 0-6

    const result = await pool.query(
      `SELECT * FROM workout_alarms
       WHERE user_id = $1
       AND is_enabled = true
       AND $2 = ANY(days_of_week)
       ORDER BY alarm_time ASC`,
      [userId, today]
    );

    return result.rows.map(this.mapAlarmRow);
  }

  /**
   * Get alarm schedule summary
   */
  async getScheduleSummary(userId: string): Promise<{
    totalAlarms: number;
    enabledAlarms: number;
    nextAlarm: WorkoutAlarm | null;
    todayAlarms: WorkoutAlarm[];
  }> {
    const [allAlarms, enabledAlarms, todayAlarms] = await Promise.all([
      this.getAlarms(userId),
      this.getEnabledAlarms(userId),
      this.getTodayAlarms(userId),
    ]);

    // Find next upcoming alarm
    const now = new Date();
    let nextAlarm: WorkoutAlarm | null = null;

    for (const alarm of enabledAlarms) {
      if (alarm.nextTriggerAt) {
        const triggerTime = new Date(alarm.nextTriggerAt);
        if (triggerTime > now) {
          if (!nextAlarm || triggerTime < new Date(nextAlarm.nextTriggerAt!)) {
            nextAlarm = alarm;
          }
        }
      }
    }

    return {
      totalAlarms: allAlarms.length,
      enabledAlarms: enabledAlarms.length,
      nextAlarm,
      todayAlarms,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get user's timezone from preferences, defaulting to UTC
   */
  async getUserTimezone(userId: string): Promise<string> {
    try {
      const result = await pool.query(
        `SELECT timezone FROM user_preferences WHERE user_id = $1`,
        [userId]
      );
      
      if (result.rows.length > 0 && result.rows[0].timezone) {
        return result.rows[0].timezone;
      }
      
      return 'UTC';
    } catch (error) {
      logger.warn('[WorkoutAlarm] Failed to fetch user timezone, defaulting to UTC', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'UTC';
    }
  }

  /**
   * Calculate the next trigger time based on alarm time and days
   * Converts user's local alarm time to UTC for storage
   * @param alarmTime - Time in HH:MM format (user's local time)
   * @param daysOfWeek - Array of day numbers (0=Sun, 1=Mon, ..., 6=Sat)
   * @param timezone - User's timezone (e.g., 'America/New_York', 'UTC')
   */
  private calculateNextTrigger(alarmTime: string, daysOfWeek: number[], timezone: string = 'UTC'): string {
    const [hours, minutes] = alarmTime.split(':').map(Number);
    const now = new Date();
    
    try {
      // For UTC timezone, use simple calculation
      if (timezone === 'UTC' || timezone === 'Etc/UTC') {
        const utcYear = now.getUTCFullYear();
        const utcMonth = now.getUTCMonth();
        const utcDate = now.getUTCDate();
        const today = now.getUTCDay();
        const todayAtAlarmTime = new Date(Date.UTC(utcYear, utcMonth, utcDate, hours, minutes, 0, 0));
        
        if (daysOfWeek.includes(today)) {
          const timeDiff = todayAtAlarmTime.getTime() - now.getTime();
          if (timeDiff > -120000) { // Allow up to 2 minutes past
            return todayAtAlarmTime.toISOString();
          }
        }
        
        // Find next day
        for (let i = 1; i <= 7; i++) {
          const checkDay = (today + i) % 7;
          if (daysOfWeek.includes(checkDay)) {
            const nextTrigger = new Date(Date.UTC(utcYear, utcMonth, utcDate + i, hours, minutes, 0, 0));
            return nextTrigger.toISOString();
          }
        }
        
        // Fallback: tomorrow
        const tomorrow = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, hours, minutes, 0, 0));
        return tomorrow.toISOString();
      }
      
      // For non-UTC timezones, use a more reliable method
      // Get current date components in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        hour12: false,
      });
      
      const userNowParts = formatter.formatToParts(now);
      const userYear = parseInt(userNowParts.find(p => p.type === 'year')?.value || '0');
      const userMonth = parseInt(userNowParts.find(p => p.type === 'month')?.value || '0') - 1;
      const userDate = parseInt(userNowParts.find(p => p.type === 'day')?.value || '0');
      const userDayName = userNowParts.find(p => p.type === 'weekday')?.value || '';
      
      const dayMap: Record<string, number> = { 
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
        'Thursday': 4, 'Friday': 5, 'Saturday': 6 
      };
      const today = dayMap[userDayName] ?? now.getUTCDay();
      
      // Use a more reliable method: find the UTC equivalent by checking what UTC time gives us that local time
      const targetUtc = this.findUtcForLocalTime(userYear, userMonth, userDate, hours, minutes, timezone);
      
      // Check if alarm should trigger today
      if (daysOfWeek.includes(today)) {
        const timeDiff = targetUtc.getTime() - now.getTime();
        if (timeDiff > -120000) { // Allow up to 2 minutes past
          return targetUtc.toISOString();
        }
      }

      // Find next day in the schedule
      // Use proper date arithmetic to handle month/year boundaries
      for (let i = 1; i <= 7; i++) {
        const checkDay = (today + i) % 7;
        if (daysOfWeek.includes(checkDay)) {
          // Calculate the date for the next scheduled day using proper date arithmetic
          const nextDate = new Date(userYear, userMonth, userDate);
          nextDate.setDate(nextDate.getDate() + i); // This properly handles month/year boundaries
          const nextUtc = this.findUtcForLocalTime(
            nextDate.getFullYear(),
            nextDate.getMonth(),
            nextDate.getDate(),
            hours,
            minutes,
            timezone
          );
          
          return nextUtc.toISOString();
        }
      }

      // Fallback: tomorrow at alarm time
      const tomorrowDate = new Date(userYear, userMonth, userDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1); // Proper date arithmetic
      const tomorrowUtc = this.findUtcForLocalTime(
        tomorrowDate.getFullYear(),
        tomorrowDate.getMonth(),
        tomorrowDate.getDate(),
        hours,
        minutes,
        timezone
      );
      
      return tomorrowUtc.toISOString();
    } catch (error) {
      logger.error('[WorkoutAlarm] Error in timezone conversion, falling back to UTC', {
        timezone,
        alarmTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Fallback to UTC calculation
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();
      const todayAtAlarmTime = new Date(Date.UTC(utcYear, utcMonth, utcDate, hours, minutes, 0, 0));
      const today = now.getUTCDay();
      
      if (daysOfWeek.includes(today)) {
        const timeDiff = todayAtAlarmTime.getTime() - now.getTime();
        if (timeDiff > -120000) {
          return todayAtAlarmTime.toISOString();
        }
      }
      
      for (let i = 1; i <= 7; i++) {
        const checkDay = (today + i) % 7;
        if (daysOfWeek.includes(checkDay)) {
          return new Date(Date.UTC(utcYear, utcMonth, utcDate + i, hours, minutes, 0, 0)).toISOString();
        }
      }
      
      return new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, hours, minutes, 0, 0)).toISOString();
    }
  }

  /**
   * Find the UTC time that corresponds to a given local time in a specific timezone
   * 
   * Uses a more reliable method: construct the date in the timezone and find the UTC equivalent.
   * This handles DST correctly and is more accurate than offset-based calculations.
   */
  private findUtcForLocalTime(year: number, month: number, date: number, hours: number, minutes: number, timezone: string): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Use a more efficient approach: start with a reasonable estimate
    // First, get the current offset for a date near our target date
    const testDate = new Date(Date.UTC(year, month, date, 12, 0, 0, 0)); // Use noon UTC to avoid DST edge cases
    const testUtcParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(testDate);
    const testTzParts = formatter.formatToParts(testDate);
    const testUtcHour = parseInt(testUtcParts.find(p => p.type === 'hour')?.value || '0');
    const testTzHour = parseInt(testTzParts.find(p => p.type === 'hour')?.value || '0');
    const estimatedOffset = testTzHour - testUtcHour;
    
    // Search around the estimated offset (±3 hours to handle DST changes)
    const searchStart = Math.max(-12, estimatedOffset - 3);
    const searchEnd = Math.min(14, estimatedOffset + 3);
    
    // First, try the estimated offset and nearby values (most likely to succeed)
    // Try in order: estimated, then ±1, ±2, ±3
    const offsetsToTry = [estimatedOffset];
    for (let i = 1; i <= 3; i++) {
      if (estimatedOffset + i <= searchEnd) offsetsToTry.push(estimatedOffset + i);
      if (estimatedOffset - i >= searchStart) offsetsToTry.push(estimatedOffset - i);
    }
    
    for (const offsetHours of offsetsToTry) {
      // Calculate candidate UTC hour: if local time is L and offset is O,
      // then UTC time = L - O
      // Example: local 16:15, offset +5, then UTC = 16 - 5 = 11:15
      let candidateUtcHour = hours - offsetHours;
      let candidateDate = date;
      let candidateMonth = month;
      let candidateYear = year;
      
      // Handle hour overflow/underflow (crossing midnight)
      if (candidateUtcHour < 0) {
        candidateUtcHour += 24;
        candidateDate--;
        if (candidateDate < 1) {
          candidateMonth--;
          if (candidateMonth < 0) {
            candidateMonth = 11;
            candidateYear--;
          }
          const daysInMonth = new Date(candidateYear, candidateMonth + 1, 0).getDate();
          candidateDate = daysInMonth;
        }
      } else if (candidateUtcHour >= 24) {
        candidateUtcHour -= 24;
        candidateDate++;
        const daysInMonth = new Date(candidateYear, candidateMonth + 1, 0).getDate();
        if (candidateDate > daysInMonth) {
          candidateDate = 1;
          candidateMonth++;
          if (candidateMonth > 11) {
            candidateMonth = 0;
            candidateYear++;
          }
        }
      }
      
      // Create the candidate UTC time
      const candidateUtc = new Date(Date.UTC(candidateYear, candidateMonth, candidateDate, candidateUtcHour, minutes, 0, 0));
      
      // Format this UTC time in the user's timezone to see what local time it produces
      const parts = formatter.formatToParts(candidateUtc);
      const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
      const tzDate = parseInt(parts.find(p => p.type === 'day')?.value || '0');
      const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      
      // Check if this UTC time produces the exact local time we want
      if (tzYear === year && tzMonth === month && tzDate === date && tzHour === hours && tzMinute === minutes) {
        return candidateUtc;
      }
    }
    
    // If the optimized search didn't work, fall back to exhaustive search
    for (let offsetHours = -12; offsetHours <= 14; offsetHours++) {
      if (offsetHours >= searchStart && offsetHours <= searchEnd) continue; // Already checked
      
      let candidateUtcHour = hours - offsetHours;
      let candidateDate = date;
      let candidateMonth = month;
      let candidateYear = year;
      
      if (candidateUtcHour < 0) {
        candidateUtcHour += 24;
        candidateDate--;
        if (candidateDate < 1) {
          candidateMonth--;
          if (candidateMonth < 0) {
            candidateMonth = 11;
            candidateYear--;
          }
          const daysInMonth = new Date(candidateYear, candidateMonth + 1, 0).getDate();
          candidateDate = daysInMonth;
        }
      } else if (candidateUtcHour >= 24) {
        candidateUtcHour -= 24;
        candidateDate++;
        const daysInMonth = new Date(candidateYear, candidateMonth + 1, 0).getDate();
        if (candidateDate > daysInMonth) {
          candidateDate = 1;
          candidateMonth++;
          if (candidateMonth > 11) {
            candidateMonth = 0;
            candidateYear++;
          }
        }
      }
      
      const candidateUtc = new Date(Date.UTC(candidateYear, candidateMonth, candidateDate, candidateUtcHour, minutes, 0, 0));
      const parts = formatter.formatToParts(candidateUtc);
      const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
      const tzDate = parseInt(parts.find(p => p.type === 'day')?.value || '0');
      const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      
      if (tzYear === year && tzMonth === month && tzDate === date && tzHour === hours && tzMinute === minutes) {
        return candidateUtc;
      }
    }
    
    // Final fallback: use a more direct method with proper timezone handling
    // Try to find the UTC time by testing a range of UTC times
    // We know the timezone offset is roughly between -12 and +14 hours
    // So we test UTC times from (local - 14 hours) to (local + 12 hours)
    const baseUtc = new Date(Date.UTC(year, month, date, hours - 14, minutes, 0, 0));
    
    for (let hourOffset = 0; hourOffset <= 26; hourOffset++) {
      const testUtc = new Date(baseUtc);
      testUtc.setUTCHours(testUtc.getUTCHours() + hourOffset);
      
      const parts = formatter.formatToParts(testUtc);
      const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
      const tzDate = parseInt(parts.find(p => p.type === 'day')?.value || '0');
      const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      
      if (tzYear === year && tzMonth === month && tzDate === date && tzHour === hours && tzMinute === minutes) {
        logger.warn('[WorkoutAlarm] findUtcForLocalTime used fallback method', {
          timezone,
          localTime: `${year}-${month + 1}-${date} ${hours}:${minutes}`,
          utcTime: testUtc.toISOString(),
        });
        return testUtc;
      }
    }
    
    // Last resort: log error and return a best-guess UTC time
    logger.error('[WorkoutAlarm] Failed to find UTC time for local time', {
      timezone,
      year,
      month,
      date,
      hours,
      minutes,
    });
    
    // Return a best-guess using the estimated offset
    const fallbackUtcHour = hours - estimatedOffset;
    const fallbackUtc = new Date(Date.UTC(year, month, date, fallbackUtcHour < 0 ? fallbackUtcHour + 24 : fallbackUtcHour >= 24 ? fallbackUtcHour - 24 : fallbackUtcHour, minutes, 0, 0));
    
    logger.error('[WorkoutAlarm] Exhaustive search failed, using fallback', {
      localTime: `${year}-${month + 1}-${date} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      timezone,
      utcTime: fallbackUtc.toISOString(),
      estimatedOffset,
    });
    
    return fallbackUtc;
  }


  /**
   * Recalculate next_trigger_at for a specific alarm
   */
  async recalculateAlarmTrigger(alarmId: string, userId: string): Promise<string | null> {
    const alarm = await this.getAlarm(userId, alarmId);
    if (!alarm || !alarm.isEnabled) {
      logger.warn('[WorkoutAlarm] Alarm not found or disabled for recalculation', { alarmId, userId });
      return null;
    }

    const timezone = await this.getUserTimezone(userId);
    const nextTriggerAt = this.calculateNextTrigger(alarm.alarmTime, alarm.daysOfWeek, timezone);
    
    await pool.query(
      `UPDATE workout_alarms SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2`,
      [nextTriggerAt, alarmId]
    );

    logger.info('[WorkoutAlarm] Recalculated alarm trigger', {
      alarmId,
      userId,
      alarmTime: alarm.alarmTime,
      timezone,
      nextTriggerAt,
    });

    return nextTriggerAt;
  }

  /**
   * Recalculate next_trigger_at for all enabled alarms
   * Useful for fixing alarms with incorrect trigger times
   */
  async recalculateAllAlarms(): Promise<number> {
    logger.info('[WorkoutAlarm] Starting recalculation of all alarms');
    
    const result = await pool.query(
      `SELECT id, alarm_time, days_of_week, user_id FROM workout_alarms WHERE is_enabled = true`
    );

    let updated = 0;
    let errors = 0;
    
    for (const row of result.rows) {
      try {
        const timezone = await this.getUserTimezone(row.user_id);
        const nextTriggerAt = this.calculateNextTrigger(row.alarm_time, row.days_of_week, timezone);
      await pool.query(
          `UPDATE workout_alarms SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2`,
        [nextTriggerAt, row.id]
      );
      updated++;
      } catch (error) {
        errors++;
        logger.error('[WorkoutAlarm] Failed to recalculate alarm', {
          alarmId: row.id,
          userId: row.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('[WorkoutAlarm] Completed recalculation of all alarms', {
      total: result.rows.length,
      updated,
      errors,
    });
    
    return updated;
  }

  /**
   * Format days of week for display
   */
  formatDaysOfWeek(days: number[], short = false): string {
    const names = short ? DAY_SHORT : DAY_NAMES;

    // Check for common patterns
    if (days.length === 7) return 'Every day';
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays';
    if (JSON.stringify(days.sort()) === JSON.stringify([0, 6])) return 'Weekends';

    return days.map(d => names[d]).join(', ');
  }

  /**
   * Map database row to WorkoutAlarm type
   */
  private mapAlarmRow(row: Record<string, unknown>): WorkoutAlarm {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      workoutPlanId: row.workout_plan_id as string | null,
      title: row.title as string,
      message: row.message as string | null,
      alarmTime: row.alarm_time as string,
      daysOfWeek: row.days_of_week as number[],
      isEnabled: row.is_enabled as boolean,
      lastTriggeredAt: row.last_triggered_at
        ? (row.last_triggered_at as Date).toISOString()
        : null,
      nextTriggerAt: row.next_trigger_at
        ? (row.next_trigger_at as Date).toISOString()
        : null,
      notificationType: row.notification_type as 'push' | 'email' | 'sms' | 'all',
      soundEnabled: row.sound_enabled as boolean,
      soundFile: (row.sound_file as string) || 'alarm.wav',
      vibrationEnabled: row.vibration_enabled as boolean,
      snoozeMinutes: row.snooze_minutes as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export const workoutAlarmService = new WorkoutAlarmService();
