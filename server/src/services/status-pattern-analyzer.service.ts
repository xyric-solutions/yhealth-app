/**
 * @file Status Pattern Analyzer Service
 * Analyzes historical activity status data to detect recurring patterns
 * that the AI coach can use for proactive plan adjustments.
 *
 * Three pattern detectors:
 *  1. Day-of-week patterns (e.g., stress on Mondays)
 *  2. Post-event recovery patterns (slow ramp-up after illness/travel)
 *  3. Streak disruption patterns (status changes that break streaks)
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type { ActivityStatus, StatusPattern, StatusPatternType } from '../types/activity-status.types.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class StatusPatternAnalyzerService {
  /**
   * Run all three detectors and return combined results.
   */
  async analyzePatterns(userId: string): Promise<StatusPattern[]> {
    const [dayOfWeek, postEvent, streakDisruption] = await Promise.all([
      this.detectDayOfWeekPatterns(userId),
      this.detectPostEventRecoveryPatterns(userId),
      this.detectStreakDisruptionPatterns(userId),
    ]);

    const patterns = [...dayOfWeek, ...postEvent, ...streakDisruption];

    logger.info('[StatusPatternAnalyzer] Analysis complete', {
      userId: userId.slice(0, 8),
      dayOfWeekPatterns: dayOfWeek.length,
      postEventPatterns: postEvent.length,
      streakDisruptionPatterns: streakDisruption.length,
      totalPatterns: patterns.length,
    });

    return patterns;
  }

  /**
   * Detect recurring status patterns by day of week.
   * E.g., user tends to report "stress" on Mondays.
   */
  private async detectDayOfWeekPatterns(userId: string): Promise<StatusPattern[]> {
    const result = await query<{
      dow: number;
      activity_status: ActivityStatus;
      cnt: string;
    }>(
      `SELECT EXTRACT(DOW FROM status_date)::int as dow, activity_status, COUNT(*) as cnt
       FROM activity_status_history
       WHERE user_id = $1
         AND status_date >= CURRENT_DATE - INTERVAL '90 days'
         AND activity_status NOT IN ('working', 'excellent', 'good')
       GROUP BY dow, activity_status
       HAVING COUNT(*) >= 3`,
      [userId]
    );

    const patterns: StatusPattern[] = [];
    const weeksInWindow = 90 / 7; // ~12.86 weeks

    for (const row of result.rows) {
      const count = parseInt(row.cnt, 10);
      const confidence = count / weeksInWindow;

      if (confidence >= 0.4) {
        const dayName = DAY_NAMES[row.dow];
        const status = row.activity_status;

        patterns.push({
          type: 'day_of_week' as StatusPatternType,
          pattern: `${status}_on_${dayName.toLowerCase()}`,
          confidence: Math.round(confidence * 100) / 100,
          frequency: count,
          firstObserved: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          lastConfirmed: new Date().toISOString().split('T')[0],
          suggestion: this.getDayOfWeekSuggestion(status, dayName),
        });
      }
    }

    return patterns;
  }

  /**
   * Generate contextual suggestion for day-of-week patterns.
   */
  private getDayOfWeekSuggestion(status: ActivityStatus, dayName: string): string {
    switch (status) {
      case 'stress':
        return `You tend to feel stressed on ${dayName}s. Consider scheduling lighter activities or mindfulness sessions on those days.`;
      case 'rest':
        return `You often rest on ${dayName}s. I'll plan recovery-friendly activities for that day.`;
      case 'sick':
        return `You've reported feeling unwell on ${dayName}s more than usual. Keep an eye on patterns that might be contributing.`;
      case 'injury':
        return `${dayName}s seem to be when injuries flare up. Consider extra warm-up or preventive exercises earlier in the week.`;
      case 'fair':
        return `You tend to feel just okay on ${dayName}s. I'll keep workouts moderate to match your energy.`;
      case 'poor':
        return `${dayName}s seem to be tough days for you. I'll plan lighter sessions and check in more often.`;
      default:
        return `You tend to feel ${status} on ${dayName}s. Consider scheduling lighter activities on those days.`;
    }
  }

  /**
   * Detect slow recovery patterns after non-working status periods.
   * Looks at workout skip rates in the 3 days after returning to working status.
   */
  private async detectPostEventRecoveryPatterns(userId: string): Promise<StatusPattern[]> {
    const result = await query<{
      prev_status: ActivityStatus;
      event_count: string;
      avg_skip_rate: string;
    }>(
      `WITH resets AS (
        SELECT user_id, status_date as reset_date,
          LAG(activity_status) OVER (PARTITION BY user_id ORDER BY status_date) as prev_status
        FROM activity_status_history
        WHERE user_id = $1 AND status_date >= CURRENT_DATE - INTERVAL '180 days'
      ),
      reset_events AS (
        SELECT reset_date, prev_status FROM resets
        WHERE prev_status IN ('sick', 'injury', 'travel', 'vacation')
          AND prev_status IS DISTINCT FROM 'working'
      )
      SELECT prev_status, COUNT(*) as event_count,
        AVG(skip_rate) as avg_skip_rate
      FROM reset_events re
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          SUM(CASE WHEN al.status IN ('skipped', 'missed') THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0
        ) as skip_rate
        FROM activity_logs al
        WHERE al.user_id = $1
          AND al.scheduled_date BETWEEN re.reset_date AND re.reset_date + INTERVAL '3 days'
      ) skip_data ON true
      GROUP BY prev_status
      HAVING COUNT(*) >= 2`,
      [userId]
    );

    const patterns: StatusPattern[] = [];

    for (const row of result.rows) {
      const avgSkipRate = parseFloat(row.avg_skip_rate || '0');
      const eventCount = parseInt(row.event_count, 10);

      if (avgSkipRate > 0.5) {
        const status = row.prev_status;

        patterns.push({
          type: 'post_event' as StatusPatternType,
          pattern: `slow_recovery_after_${status}`,
          confidence: Math.round(Math.min(avgSkipRate, 1.0) * 100) / 100,
          frequency: eventCount,
          firstObserved: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          lastConfirmed: new Date().toISOString().split('T')[0],
          suggestion: `After being ${status}, you usually take a few days to get back to full activity. I'll plan a gradual ramp-up next time.`,
        });
      }
    }

    return patterns;
  }

  /**
   * Detect correlation between non-working statuses and streak breaks.
   * If status changes frequently coincide with streak breaks, flag it.
   */
  private async detectStreakDisruptionPatterns(userId: string): Promise<StatusPattern[]> {
    const result = await query<{
      activity_status: ActivityStatus;
      disruption_count: string;
    }>(
      `SELECT ash.activity_status, COUNT(*) as disruption_count
       FROM activity_status_history ash
       JOIN streak_activity_log sal
         ON sal.user_id = ash.user_id
         AND sal.activity_date = ash.status_date
         AND sal.action = 'break'
       WHERE ash.user_id = $1
         AND ash.status_date >= CURRENT_DATE - INTERVAL '180 days'
         AND ash.activity_status NOT IN ('working', 'excellent', 'good')
       GROUP BY ash.activity_status
       HAVING COUNT(*) >= 3`,
      [userId]
    );

    const patterns: StatusPattern[] = [];

    for (const row of result.rows) {
      const count = parseInt(row.disruption_count, 10);
      const status = row.activity_status;

      patterns.push({
        type: 'streak_disruption' as StatusPatternType,
        pattern: `streak_break_during_${status}`,
        confidence: Math.round(Math.min(count / 10, 1.0) * 100) / 100,
        frequency: count,
        firstObserved: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lastConfirmed: new Date().toISOString().split('T')[0],
        suggestion: `Your streaks tend to break when you're ${status}. Consider using streak freezes or adjusted goals during those periods to protect your progress.`,
      });
    }

    return patterns;
  }

  /**
   * Persist detected patterns to the user's coaching profile.
   * Upserts into user_coaching_profiles.
   */
  async persistPatterns(userId: string, patterns: StatusPattern[]): Promise<void> {
    const patternsJson = JSON.stringify(patterns);

    const result = await query(
      `UPDATE user_coaching_profiles SET status_patterns = $1, updated_at = NOW() WHERE user_id = $2`,
      [patternsJson, userId]
    );

    // If no row was updated, insert one
    if (result.rowCount === 0) {
      await query(
        `INSERT INTO user_coaching_profiles (user_id, status_patterns, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET status_patterns = $2, updated_at = NOW()`,
        [userId, patternsJson]
      );
    }

    logger.info('[StatusPatternAnalyzer] Persisted patterns', {
      userId: userId.slice(0, 8),
      patternCount: patterns.length,
    });
  }
}

export const statusPatternAnalyzerService = new StatusPatternAnalyzerService();
