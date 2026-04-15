/**
 * @file Schedule Context Service
 * @description Analyzes daily schedule data to produce a DayContext object
 * used by the AI coach, proactive messaging, and schedule UI.
 *
 * Computes: stress level, free windows, busy hours, back-to-back count.
 * No new DB tables — reads existing schedule_items + workout_schedule_tasks.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface TimeBlock {
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  durationMinutes: number;
  title: string;
  category?: string;
  source: 'manual' | 'workout' | 'google_calendar';
}

export interface FreeWindow {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
}

export type StressLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DayContext {
  date: string;
  totalItems: number;
  timeBlocks: TimeBlock[];
  freeWindows: FreeWindow[];
  busyHours: number;
  freeHours: number;
  stressLevel: StressLevel;
  hasEarlyMorning: boolean;    // item before 06:00
  hasLateNight: boolean;       // item after 22:00
  longestFreeWindow: FreeWindow | null;
  longestBusyStreak: number;   // minutes of consecutive booked time
  backToBackCount: number;     // items with < 15 min gap
  categories: Record<string, number>;
}

// ============================================
// CONSTANTS
// ============================================

const WAKING_START = '06:00';
const WAKING_END = '23:00';
const MIN_FREE_WINDOW_MINUTES = 30;
const BACK_TO_BACK_GAP_MINUTES = 15;

// ============================================
// HELPERS
// ============================================

/** Convert HH:mm to minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert minutes since midnight to HH:mm */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Compute stress level from metrics */
function computeStressLevel(
  totalItems: number,
  backToBackCount: number,
  longestBusyStreak: number,
): StressLevel {
  if (totalItems >= 8 || (backToBackCount >= 4 && longestBusyStreak >= 240)) return 'critical';
  if (totalItems >= 7 || backToBackCount >= 3) return 'high';
  if (totalItems >= 4) return 'medium';
  return 'low';
}

// ============================================
// SERVICE
// ============================================

class ScheduleContextService {
  /**
   * Get the full day context for a user on a given date.
   * Queries schedule_items + workout_schedule_tasks, computes metrics.
   */
  async getDayContext(userId: string, date?: string): Promise<DayContext> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      // ── Fetch schedule items for the date ──
      const itemsResult = await query<{
        title: string;
        start_time: string | null;
        end_time: string | null;
        duration_minutes: number | null;
        category: string | null;
      }>(
        `SELECT si.title, si.start_time, si.end_time, si.duration_minutes, si.category
         FROM schedule_items si
         INNER JOIN daily_schedules ds ON si.schedule_id = ds.id
         WHERE ds.user_id = $1 AND ds.schedule_date = $2
         ORDER BY si.start_time ASC NULLS LAST, si.position ASC`,
        [userId, targetDate],
      );

      // ── Fetch workout tasks for the date ──
      const workoutResult = await query<{
        workout_data: Record<string, unknown>;
        intensity: string | null;
        estimated_duration_minutes: number | null;
      }>(
        `SELECT workout_data, intensity, estimated_duration_minutes
         FROM workout_schedule_tasks
         WHERE user_id = $1 AND scheduled_date = $2 AND status != 'skipped'`,
        [userId, targetDate],
      );

      // ── Fetch Google Calendar events for the date (if any) ──
      let calendarEvents: Array<{ title: string; start_time: Date; end_time: Date }> = [];
      try {
        const calResult = await query<{ title: string; start_time: Date; end_time: Date }>(
          `SELECT title, start_time, end_time FROM calendar_events
           WHERE user_id = $1 AND start_time::date = $2::date
             AND status = 'confirmed' AND busy_status = 'busy' AND all_day = false
           ORDER BY start_time ASC`,
          [userId, targetDate],
        );
        calendarEvents = calResult.rows;
      } catch {
        // calendar_events table may not exist yet — ignore
      }

      // ── Build time blocks ──
      const timeBlocks: TimeBlock[] = [];

      for (const item of itemsResult.rows) {
        if (!item.start_time) continue; // skip items without times
        const start = item.start_time.substring(0, 5); // ensure HH:mm
        const duration = item.duration_minutes || 30; // default 30 min
        const endMins = timeToMinutes(start) + duration;
        const end = item.end_time?.substring(0, 5) || minutesToTime(endMins);

        timeBlocks.push({
          startTime: start,
          endTime: end,
          durationMinutes: duration,
          title: item.title,
          category: item.category || undefined,
          source: 'manual',
        });
      }

      // Add workout tasks (they don't have times — estimate based on plan preferred time)
      for (const wt of workoutResult.rows) {
        const name = (wt.workout_data as { workoutName?: string })?.workoutName || 'Workout';
        const duration = wt.estimated_duration_minutes || 45;
        // Workout tasks don't have specific times in DB — skip adding as time blocks
        // They'll be counted in totalItems but won't affect time-based calculations
        timeBlocks.push({
          startTime: '00:00', // placeholder — no specific time
          endTime: '00:00',
          durationMinutes: duration,
          title: name,
          category: 'workout',
          source: 'workout',
        });
      }

      // Add Google Calendar events as timed blocks
      for (const ce of calendarEvents) {
        const start = new Date(ce.start_time);
        const end = new Date(ce.end_time);
        const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);
        timeBlocks.push({
          startTime: startStr,
          endTime: endStr,
          durationMinutes: Math.max(duration, 15),
          title: ce.title,
          category: 'meeting',
          source: 'google_calendar',
        });
      }

      // ── Separate timed vs untimed blocks ──
      const timedBlocks = timeBlocks
        .filter((b) => b.startTime !== '00:00')
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      const totalItems = timeBlocks.length;

      // ── Compute free windows ──
      const freeWindows: FreeWindow[] = [];
      const wakingStartMins = timeToMinutes(WAKING_START);
      const wakingEndMins = timeToMinutes(WAKING_END);

      if (timedBlocks.length === 0) {
        // Entire waking day is free
        freeWindows.push({
          startTime: WAKING_START,
          endTime: WAKING_END,
          durationMinutes: wakingEndMins - wakingStartMins,
        });
      } else {
        // Gap before first item
        const firstStart = timeToMinutes(timedBlocks[0].startTime);
        if (firstStart - wakingStartMins >= MIN_FREE_WINDOW_MINUTES) {
          freeWindows.push({
            startTime: WAKING_START,
            endTime: timedBlocks[0].startTime,
            durationMinutes: firstStart - wakingStartMins,
          });
        }

        // Gaps between items
        for (let i = 0; i < timedBlocks.length - 1; i++) {
          const currentEnd = timeToMinutes(timedBlocks[i].endTime);
          const nextStart = timeToMinutes(timedBlocks[i + 1].startTime);
          const gap = nextStart - currentEnd;

          if (gap >= MIN_FREE_WINDOW_MINUTES) {
            freeWindows.push({
              startTime: minutesToTime(currentEnd),
              endTime: timedBlocks[i + 1].startTime,
              durationMinutes: gap,
            });
          }
        }

        // Gap after last item
        const lastEnd = timeToMinutes(timedBlocks[timedBlocks.length - 1].endTime);
        if (wakingEndMins - lastEnd >= MIN_FREE_WINDOW_MINUTES) {
          freeWindows.push({
            startTime: minutesToTime(lastEnd),
            endTime: WAKING_END,
            durationMinutes: wakingEndMins - lastEnd,
          });
        }
      }

      // ── Compute busy/free hours ──
      const busyMinutes = timedBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
      const busyHours = Math.round((busyMinutes / 60) * 10) / 10;
      const totalWakingHours = (wakingEndMins - wakingStartMins) / 60;
      const freeHours = Math.round((totalWakingHours - busyHours) * 10) / 10;

      // ── Back-to-back detection ──
      let backToBackCount = 0;
      let longestBusyStreak = 0;
      let currentStreak = 0;

      for (let i = 0; i < timedBlocks.length - 1; i++) {
        const currentEnd = timeToMinutes(timedBlocks[i].endTime);
        const nextStart = timeToMinutes(timedBlocks[i + 1].startTime);
        const gap = nextStart - currentEnd;

        if (gap < BACK_TO_BACK_GAP_MINUTES) {
          backToBackCount++;
          currentStreak += timedBlocks[i].durationMinutes + gap;
        } else {
          currentStreak += timedBlocks[i].durationMinutes;
          longestBusyStreak = Math.max(longestBusyStreak, currentStreak);
          currentStreak = 0;
        }
      }
      // Final block
      if (timedBlocks.length > 0) {
        currentStreak += timedBlocks[timedBlocks.length - 1].durationMinutes;
        longestBusyStreak = Math.max(longestBusyStreak, currentStreak);
      }

      // ── Early morning / late night ──
      const hasEarlyMorning = timedBlocks.some((b) => timeToMinutes(b.startTime) < timeToMinutes('06:00'));
      const hasLateNight = timedBlocks.some((b) => timeToMinutes(b.endTime) > timeToMinutes('22:00'));

      // ── Longest free window ──
      const longestFreeWindow = freeWindows.length > 0
        ? freeWindows.reduce((a, b) => (a.durationMinutes > b.durationMinutes ? a : b))
        : null;

      // ── Categories ──
      const categories: Record<string, number> = {};
      for (const b of timeBlocks) {
        const cat = b.category || 'uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      }

      // ── Stress level ──
      const stressLevel = computeStressLevel(totalItems, backToBackCount, longestBusyStreak);

      return {
        date: targetDate,
        totalItems,
        timeBlocks,
        freeWindows,
        busyHours,
        freeHours: Math.max(0, freeHours),
        stressLevel,
        hasEarlyMorning,
        hasLateNight,
        longestFreeWindow,
        longestBusyStreak,
        backToBackCount,
        categories,
      };
    } catch (error) {
      logger.error('[ScheduleContext] Failed to compute day context', {
        userId,
        date: targetDate,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Return safe default instead of throwing
      return {
        date: targetDate,
        totalItems: 0,
        timeBlocks: [],
        freeWindows: [{
          startTime: WAKING_START,
          endTime: WAKING_END,
          durationMinutes: timeToMinutes(WAKING_END) - timeToMinutes(WAKING_START),
        }],
        busyHours: 0,
        freeHours: 17,
        stressLevel: 'low',
        hasEarlyMorning: false,
        hasLateNight: false,
        longestFreeWindow: null,
        longestBusyStreak: 0,
        backToBackCount: 0,
        categories: {},
      };
    }
  }

  /**
   * Check if the user is currently in a busy block or within 30 min of one.
   * Used by proactive messaging to suppress non-urgent notifications.
   */
  async isUserInBusyBlock(userId: string): Promise<boolean> {
    const ctx = await this.getDayContext(userId);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const block of ctx.timeBlocks) {
      if (block.startTime === '00:00') continue; // skip untimed blocks
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);

      // Within the block OR within 30 min before it
      if (currentMinutes >= blockStart - 30 && currentMinutes <= blockEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the next free window starting from now.
   * Returns null if no free window exists today.
   */
  async getNextFreeWindow(userId: string): Promise<FreeWindow | null> {
    const ctx = await this.getDayContext(userId);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const window of ctx.freeWindows) {
      const windowStart = timeToMinutes(window.startTime);
      // Window starts in the future or is currently ongoing
      if (windowStart >= currentMinutes - 30) {
        return window;
      }
    }

    return null;
  }
}

export const scheduleContextService = new ScheduleContextService();
