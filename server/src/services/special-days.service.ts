/**
 * @file Special Days Service
 * @description Detects Ramadan, holidays, weekends, and user-defined special days.
 * Injects context into AI coach for culturally-aware coaching.
 */

import { query } from '../database/pg.js';

// ============================================
// TYPES
// ============================================

export interface SpecialDay {
  type: 'ramadan' | 'eid' | 'holiday' | 'weekend' | 'user_defined';
  name: string;
  adjustments: {
    reduceWorkoutIntensity: boolean;
    adjustMealTiming: boolean;
    reduceNotifications: boolean;
    customMessage?: string;
  };
}

export interface SpecialDayPreferences {
  observesRamadan: boolean;
  countryCode: string;
  customDays: Array<{ date: string; name: string }>;
}

// ============================================
// RAMADAN DATES (Hijri → Gregorian approximation)
// ============================================
// Ramadan dates for 2024-2030 (approximate — actual dates depend on moon sighting)
// Format: [startMonth, startDay, endMonth, endDay] (Gregorian)

const RAMADAN_DATES: Record<number, [number, number, number, number]> = {
  2024: [3, 11, 4, 9],    // Mar 11 - Apr 9, 2024
  2025: [2, 28, 3, 30],   // Feb 28 - Mar 30, 2025
  2026: [2, 17, 3, 19],   // Feb 17 - Mar 19, 2026
  2027: [2, 7, 3, 8],     // Feb 7 - Mar 8, 2027
  2028: [1, 27, 2, 25],   // Jan 27 - Feb 25, 2028
  2029: [1, 15, 2, 13],   // Jan 15 - Feb 13, 2029
  2030: [1, 5, 2, 3],     // Jan 5 - Feb 3, 2030
};

// ============================================
// REGIONAL HOLIDAYS (static, major holidays only)
// ============================================

interface Holiday { month: number; day: number; name: string }

const HOLIDAYS: Record<string, Holiday[]> = {
  US: [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 7, day: 4, name: 'Independence Day' },
    { month: 12, day: 25, name: 'Christmas Day' },
    { month: 11, day: 28, name: 'Thanksgiving' },
  ],
  UK: [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 12, day: 25, name: 'Christmas Day' },
    { month: 12, day: 26, name: 'Boxing Day' },
  ],
  PK: [
    { month: 3, day: 23, name: 'Pakistan Day' },
    { month: 8, day: 14, name: 'Independence Day' },
    { month: 12, day: 25, name: 'Quaid-e-Azam Day' },
  ],
  SA: [
    { month: 9, day: 23, name: 'Saudi National Day' },
  ],
  AE: [
    { month: 12, day: 2, name: 'UAE National Day' },
  ],
  TR: [
    { month: 4, day: 23, name: "National Sovereignty and Children's Day" },
    { month: 10, day: 29, name: 'Republic Day' },
  ],
  EG: [
    { month: 7, day: 23, name: 'Revolution Day' },
    { month: 10, day: 6, name: 'Armed Forces Day' },
  ],
};

// ============================================
// SERVICE
// ============================================

class SpecialDaysService {
  /**
   * Check if a date falls during Ramadan
   */
  isRamadan(date: Date): boolean {
    const year = date.getFullYear();
    const ramadan = RAMADAN_DATES[year];
    if (!ramadan) return false;

    const [startMonth, startDay, endMonth, endDay] = ramadan;
    const start = new Date(year, startMonth - 1, startDay);
    const end = new Date(year, endMonth - 1, endDay);

    return date >= start && date <= end;
  }

  /**
   * Get Ramadan day number (1-30) if in Ramadan
   */
  getRamadanDay(date: Date): number | null {
    const year = date.getFullYear();
    const ramadan = RAMADAN_DATES[year];
    if (!ramadan) return null;

    const [startMonth, startDay] = ramadan;
    const start = new Date(year, startMonth - 1, startDay);

    if (!this.isRamadan(date)) return null;
    return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Get holidays for a country on a specific date
   */
  getHolidays(countryCode: string, date: Date): Holiday[] {
    const holidays = HOLIDAYS[countryCode.toUpperCase()] || [];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return holidays.filter((h) => h.month === month && h.day === day);
  }

  /**
   * Check if date is a weekend (Friday-Saturday for Islamic countries, Saturday-Sunday for others)
   */
  isWeekend(date: Date, countryCode?: string): boolean {
    const dayOfWeek = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const islamicCountries = new Set(['SA', 'AE', 'PK', 'EG', 'TR', 'MY', 'ID']);
    if (countryCode && islamicCountries.has(countryCode.toUpperCase())) {
      return dayOfWeek === 5 || dayOfWeek === 6; // Friday-Saturday
    }
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday-Saturday
  }

  /**
   * Get user's special day preferences from DB
   */
  async getUserPreferences(userId: string): Promise<SpecialDayPreferences> {
    try {
      const result = await query<{
        observes_ramadan: boolean | null;
        country_code: string | null;
      }>(
        `SELECT
          (metadata->>'observes_ramadan')::boolean as observes_ramadan,
          (metadata->>'country_code') as country_code
         FROM user_preferences WHERE user_id = $1`,
        [userId],
      );

      if (result.rows.length === 0) {
        return { observesRamadan: false, countryCode: 'US', customDays: [] };
      }

      return {
        observesRamadan: result.rows[0].observes_ramadan || false,
        countryCode: result.rows[0].country_code || 'US',
        customDays: [],
      };
    } catch {
      return { observesRamadan: false, countryCode: 'US', customDays: [] };
    }
  }

  /**
   * Get all special days for a user on a given date
   */
  async getSpecialDays(userId: string, date?: string): Promise<SpecialDay[]> {
    const targetDate = date ? new Date(date) : new Date();
    const prefs = await this.getUserPreferences(userId);
    const specialDays: SpecialDay[] = [];

    // Check Ramadan
    if (prefs.observesRamadan && this.isRamadan(targetDate)) {
      const day = this.getRamadanDay(targetDate);
      specialDays.push({
        type: 'ramadan',
        name: `Ramadan Day ${day || '?'}`,
        adjustments: {
          reduceWorkoutIntensity: true,
          adjustMealTiming: true,
          reduceNotifications: true,
          customMessage: `Day ${day} of Ramadan. User is fasting during daylight hours. Suggest lighter workouts, hydration reminders at iftar, suhoor meal planning. Never suggest eating during fasting hours.`,
        },
      });
    }

    // Check holidays
    const holidays = this.getHolidays(prefs.countryCode, targetDate);
    for (const holiday of holidays) {
      specialDays.push({
        type: 'holiday',
        name: holiday.name,
        adjustments: {
          reduceWorkoutIntensity: false,
          adjustMealTiming: false,
          reduceNotifications: true,
          customMessage: `Today is ${holiday.name}. Reduce coaching intensity, more casual tone, celebrate the occasion.`,
        },
      });
    }

    // Check weekend
    if (this.isWeekend(targetDate, prefs.countryCode)) {
      specialDays.push({
        type: 'weekend',
        name: 'Weekend',
        adjustments: {
          reduceWorkoutIntensity: false,
          adjustMealTiming: false,
          reduceNotifications: true,
        },
      });
    }

    return specialDays;
  }

  /**
   * Format special days for AI prompt injection
   */
  formatForPrompt(specialDays: SpecialDay[]): string {
    if (specialDays.length === 0) return '';

    const parts: string[] = ['Special Day Context:'];
    for (const day of specialDays) {
      parts.push(`- ${day.name} (${day.type})`);
      if (day.adjustments.customMessage) {
        parts.push(`  ${day.adjustments.customMessage}`);
      }
      if (day.adjustments.reduceWorkoutIntensity) {
        parts.push('  → Reduce workout intensity');
      }
      if (day.adjustments.adjustMealTiming) {
        parts.push('  → Adjust meal timing');
      }
    }
    return parts.join('\n');
  }
}

export const specialDaysService = new SpecialDaysService();
