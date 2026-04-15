/**
 * @file AI Scoring Service
 * @description Calculates daily fitness scores with 6-component breakdowns
 * Components: Workout (30%), Nutrition (20%), Wellbeing (15%), Biometrics (15%), Engagement (10%), Consistency (10%)
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface ComponentScores {
  workout: number;
  nutrition: number;
  wellbeing: number;
  biometrics: number;
  engagement: number;
  consistency: number;
}

export interface DailyScore {
  userId: string;
  date: string; // YYYY-MM-DD (user's local date)
  totalScore: number;
  componentScores: ComponentScores;
  explanation: string;
  flags: {
    anomaly_detected?: boolean;
    low_confidence?: boolean;
    requires_review?: boolean;
  };
}

export interface ScoringWeights {
  workout: number;
  nutrition: number;
  wellbeing: number;
  biometrics: number;
  engagement: number;
  consistency: number;
}

// Default weights (must sum to 1.0)
const DEFAULT_WEIGHTS: ScoringWeights = {
  workout: 0.30,
  nutrition: 0.20,
  wellbeing: 0.15,
  biometrics: 0.15,
  engagement: 0.10,
  consistency: 0.10,
};

/**
 * Normalize old 4-key component_scores to new 6-key format (backward compat)
 */
export function normalizeComponentScores(raw: Record<string, number>): ComponentScores {
  return {
    workout: raw.workout ?? 0,
    nutrition: raw.nutrition ?? 0,
    wellbeing: raw.wellbeing ?? 0,
    biometrics: raw.biometrics ?? 0,
    engagement: raw.engagement ?? raw.participation ?? 0,
    consistency: raw.consistency ?? 0,
  };
}

// ============================================
// SERVICE
// ============================================

class AIScoringService {
  /**
   * Get user's timezone
   */
  private async getUserTimezone(userId: string): Promise<string> {
    const result = await query<{ timezone: string }>(
      'SELECT timezone FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0]?.timezone || 'UTC';
  }

  /**
   * Convert UTC date to user's local date
   */
  private async getLocalDate(userId: string, utcDate: Date): Promise<string> {
    const timezone = await this.getUserTimezone(userId);
    // Use PostgreSQL timezone conversion
    const result = await query<{ local_date: string }>(
      `SELECT (($1::timestamptz AT TIME ZONE $2)::date)::text as local_date`,
      [utcDate.toISOString(), timezone]
    );
    return result.rows[0].local_date;
  }

  /**
   * Calculate workout score (0-100)
   * Components: Consistency (30%), Intensity (30%), Progressive Overload (20%), Quality (20%)
   */
  private async calculateWorkoutScore(
    userId: string,
    localDate: string
  ): Promise<{ score: number; details: Record<string, unknown> }> {
    // Get workout logs
    const logsResult = await query<{
      duration_minutes: number | null;
      total_volume: number | null;
      difficulty_rating: number | null;
      status: string;
    }>(
      `SELECT duration_minutes, total_volume, difficulty_rating, status
       FROM workout_logs
       WHERE user_id = $1 AND scheduled_date = $2::date`,
      [userId, localDate]
    );

    const workouts = logsResult.rows.filter((w) => w.status === 'completed');
    const workoutCount = workouts.length;

    // Consistency (30%): Workout frequency vs. plan (simplified: did they work out?)
    const consistencyScore = workoutCount > 0 ? 100 : 0;

    // Intensity (30%): Duration and heart rate zones
    let intensityScore = 0;
    if (workouts.length > 0) {
      const avgDuration = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / workouts.length;
      // Score based on duration: 30min = 60, 60min = 100, 90min+ = 100
      intensityScore = Math.min(100, (avgDuration / 60) * 100);
    }

    // Progressive Overload (20%): Volume progression (simplified)
    let progressionScore = 50; // Default
    if (workouts.length > 0) {
      const totalVolume = workouts.reduce((sum, w) => sum + (w.total_volume || 0), 0);
      // Compare with previous week (simplified: just check if volume exists)
      progressionScore = totalVolume > 0 ? 75 : 50;
    }

    // Quality (20%): Completion rate, difficulty rating
    let qualityScore = 0;
    if (workouts.length > 0) {
      const completed = workouts.filter((w) => w.status === 'completed').length;
      const completionRate = (completed / workouts.length) * 100;
      qualityScore = completionRate;
    }

    const workoutScore =
      consistencyScore * 0.3 + intensityScore * 0.3 + progressionScore * 0.2 + qualityScore * 0.2;

    return {
      score: Math.round(workoutScore),
      details: {
        consistency: consistencyScore,
        intensity: intensityScore,
        progression: progressionScore,
        quality: qualityScore,
        workoutCount,
      },
    };
  }

  /**
   * Calculate nutrition score (0-100)
   * Components: Calorie Adherence (25%), Macro Targets (35%), Meal Timing (20%), Hydration (20%)
   */
  private async calculateNutritionScore(
    userId: string,
    localDate: string
  ): Promise<{ score: number; details: Record<string, unknown> }> {
    // Get meal logs
    const mealsResult = await query<{
      calories: number | null;
      protein_grams: number | null;
      carbs_grams: number | null;
      fat_grams: number | null;
      eaten_at: Date;
    }>(
      `SELECT calories, protein_grams, carbs_grams, fat_grams, eaten_at
       FROM meal_logs
       WHERE user_id = $1 AND DATE(eaten_at) = $2::date`,
      [userId, localDate]
    );

    // Get water intake
    const waterResult = await query<{ total_ml: number }>(
      `SELECT COALESCE(ml_consumed, 0) as total_ml
       FROM water_intake_logs
       WHERE user_id = $1 AND log_date = $2::date`,
      [userId, localDate]
    );

    const totalCalories = mealsResult.rows.reduce((sum, m) => sum + (m.calories || 0), 0);
    const waterIntake = waterResult.rows[0]?.total_ml || 0;

    // Get user's calorie target from active diet plan (fallback to 2000 if not set)
    const dietPlanResult = await query<{ daily_calories: number | null }>(
      `SELECT daily_calories 
       FROM diet_plans 
       WHERE user_id = $1 
         AND status = 'active'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    const calorieTarget = dietPlanResult.rows[0]?.daily_calories || 2000;

    // Calorie Adherence (25%): Within 10% of target = 100
    const calorieDiff = Math.abs(totalCalories - calorieTarget);
    const calorieAdherence = Math.max(0, 100 - (calorieDiff / calorieTarget) * 100);

    // Macro Targets (35%): Real adherence against user's macro goals
    let macroScore = 50; // Default if no targets set
    const totalProtein = mealsResult.rows.reduce((sum, m) => sum + (m.protein_grams || 0), 0);
    const totalCarbs = mealsResult.rows.reduce((sum, m) => sum + (m.carbs_grams || 0), 0);
    const totalFat = mealsResult.rows.reduce((sum, m) => sum + (m.fat_grams || 0), 0);

    // Get macro targets from diet plan
    try {
      const macroTargetResult = await query<{
        protein_target_grams: number | null;
        carbs_target_grams: number | null;
        fat_target_grams: number | null;
      }>(
        `SELECT
          CASE WHEN daily_calories IS NOT NULL THEN daily_calories * 0.3 / 4 ELSE NULL END as protein_target_grams,
          CASE WHEN daily_calories IS NOT NULL THEN daily_calories * 0.4 / 4 ELSE NULL END as carbs_target_grams,
          CASE WHEN daily_calories IS NOT NULL THEN daily_calories * 0.3 / 9 ELSE NULL END as fat_target_grams
         FROM diet_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      const macroTargets = macroTargetResult.rows[0];
      if (macroTargets?.protein_target_grams && macroTargets?.carbs_target_grams && macroTargets?.fat_target_grams) {
        const proteinAdherence = Math.max(0, 100 - Math.abs(totalProtein - macroTargets.protein_target_grams) / macroTargets.protein_target_grams * 100);
        const carbsAdherence = Math.max(0, 100 - Math.abs(totalCarbs - macroTargets.carbs_target_grams) / macroTargets.carbs_target_grams * 100);
        const fatAdherence = Math.max(0, 100 - Math.abs(totalFat - macroTargets.fat_target_grams) / macroTargets.fat_target_grams * 100);
        macroScore = (proteinAdherence + carbsAdherence + fatAdherence) / 3;
      } else if (mealsResult.rows.length > 0) {
        // No explicit targets: give partial credit for logging macros at all
        macroScore = 60;
      }
    } catch {
      if (mealsResult.rows.length > 0) {
        macroScore = 60;
      }
    }

    // Meal Timing (20%): Regular intervals (simplified: did they eat meals?)
    const mealCount = mealsResult.rows.length;
    const mealTimingScore = mealCount >= 3 ? 100 : (mealCount / 3) * 100;

    // Hydration (20%): 2L = 100
    const hydrationTarget = 2000; // ml
    const hydrationScore = Math.min(100, (waterIntake / hydrationTarget) * 100);

    const nutritionScore =
      calorieAdherence * 0.25 + macroScore * 0.35 + mealTimingScore * 0.2 + hydrationScore * 0.2;

    return {
      score: Math.round(nutritionScore),
      details: {
        calorieAdherence,
        macroScore,
        mealTiming: mealTimingScore,
        hydration: hydrationScore,
        totalCalories,
        waterIntake,
      },
    };
  }

  /**
   * Calculate wellbeing score (0-100)
   * Components: Mood (20%), Stress Management (15%), Energy (10%), Mindfulness (20%),
   *             Journaling (15%), Emotional Check-in (10%), Sleep Quality (10%)
   */
  private async calculateWellbeingScore(
    userId: string,
    localDate: string
  ): Promise<{ score: number; details: Record<string, unknown> }> {
    const startOfDay = `${localDate}T00:00:00`;
    const endOfDay = `${localDate}T23:59:59`;

    // Fetch all wellbeing data sources in parallel
    const [moodResult, stressResult, energyResult, mindfulnessResult, journalResult, checkinResult, healthResult] =
      await Promise.all([
        // Mood logs (both light and deep modes)
        query<{
          happiness_rating: number | null;
          energy_rating: number | null;
          stress_rating: number | null;
          anxiety_rating: number | null;
        }>(
          `SELECT happiness_rating, energy_rating, stress_rating, anxiety_rating
           FROM mood_logs
           WHERE user_id = $1 AND DATE(logged_at) = $2::date`,
          [userId, localDate]
        ),
        // Stress logs
        query<{ stress_rating: number | null }>(
          `SELECT stress_rating
           FROM stress_logs
           WHERE user_id = $1 AND logged_at >= $2::timestamptz AND logged_at <= $3::timestamptz`,
          [userId, startOfDay, endOfDay]
        ),
        // Energy logs
        query<{ energy_rating: number | null }>(
          `SELECT energy_rating
           FROM energy_logs
           WHERE user_id = $1 AND logged_at >= $2::timestamptz AND logged_at <= $3::timestamptz`,
          [userId, startOfDay, endOfDay]
        ),
        // Mindfulness practices (completed only)
        query<{ actual_duration_minutes: number | null; effectiveness_rating: number | null }>(
          `SELECT actual_duration_minutes, effectiveness_rating
           FROM mindfulness_practices
           WHERE user_id = $1 AND completed_at >= $2::timestamptz AND completed_at <= $3::timestamptz`,
          [userId, startOfDay, endOfDay]
        ),
        // Journal entries
        query<{ id: string }>(
          `SELECT id FROM journal_entries
           WHERE user_id = $1 AND logged_at >= $2::timestamptz AND logged_at <= $3::timestamptz`,
          [userId, startOfDay, endOfDay]
        ),
        // Emotional check-in sessions (completed)
        query<{ risk_level: string | null; overall_mood_score: number | null }>(
          `SELECT risk_level, overall_mood_score
           FROM emotional_checkin_sessions
           WHERE user_id = $1 AND started_at >= $2::timestamptz AND started_at <= $3::timestamptz
             AND completed_at IS NOT NULL`,
          [userId, startOfDay, endOfDay]
        ),
        // Basic sleep from daily health metrics
        query<{ sleep_hours: number | null }>(
          `SELECT sleep_hours FROM daily_health_metrics
           WHERE user_id = $1 AND metric_date = $2::date`,
          [userId, localDate]
        ),
      ]);

    // --- Mood Score (20%): Average mood ratings ---
    let moodScore = 0;
    if (moodResult.rows.length > 0) {
      const moodValues = moodResult.rows.map((m) => {
        const happiness = m.happiness_rating || 5;
        const energy = m.energy_rating || 5;
        const stress = m.stress_rating ? (11 - m.stress_rating) : 5;
        const anxiety = m.anxiety_rating ? (11 - m.anxiety_rating) : 5;
        return (happiness + energy + stress + anxiety) / 4;
      });
      const avgMood = moodValues.reduce((sum, v) => sum + v, 0) / moodValues.length;
      moodScore = (avgMood / 10) * 100;
    }

    // --- Stress Management (15%): Inverted stress rating ---
    let stressManagementScore = 0;
    if (stressResult.rows.length > 0) {
      const avgStress =
        stressResult.rows.reduce((sum, s) => sum + (s.stress_rating || 5), 0) / stressResult.rows.length;
      stressManagementScore = ((10 - avgStress) / 9) * 100; // Invert: low stress = high score
    }

    // --- Energy Tracking (10%): Average energy rating ---
    let energyScore = 0;
    if (energyResult.rows.length > 0) {
      const avgEnergy =
        energyResult.rows.reduce((sum, e) => sum + (e.energy_rating || 5), 0) / energyResult.rows.length;
      energyScore = (avgEnergy / 10) * 100;
    }

    // --- Mindfulness (20%): Completed practices ---
    let mindfulnessScore = 0;
    const practiceCount = mindfulnessResult.rows.length;
    if (practiceCount >= 3) {
      mindfulnessScore = 100;
    } else if (practiceCount >= 2) {
      mindfulnessScore = 80;
    } else if (practiceCount >= 1) {
      mindfulnessScore = 50;
      // Bonus for effectiveness rating >= 7
      const avgEffectiveness = mindfulnessResult.rows.reduce(
        (sum, p) => sum + (p.effectiveness_rating || 5), 0
      ) / practiceCount;
      if (avgEffectiveness >= 7) mindfulnessScore = 70;
    }

    // --- Journaling (15%): Entries logged today ---
    let journalingScore = 0;
    const entryCount = journalResult.rows.length;
    if (entryCount >= 2) {
      journalingScore = 100;
    } else if (entryCount >= 1) {
      journalingScore = 80;
    }

    // --- Emotional Check-in (10%): Completed check-ins ---
    let emotionalCheckinScore = 0;
    if (checkinResult.rows.length > 0) {
      emotionalCheckinScore = 100;
      // Bonus/safe indicator: no crisis detected
      const hasCrisis = checkinResult.rows.some(
        (c) => c.risk_level === 'high' || c.risk_level === 'critical'
      );
      if (hasCrisis) emotionalCheckinScore = 60; // Still scored for engaging, but lower
    }

    // --- Sleep Quality (10%): Basic sleep hours ---
    let sleepScore = 0;
    const sleepHours = healthResult.rows[0]?.sleep_hours || 0;
    if (sleepHours >= 7 && sleepHours <= 9) {
      sleepScore = 100;
    } else if (sleepHours >= 6 && sleepHours < 7) {
      sleepScore = 80;
    } else if (sleepHours > 9 && sleepHours <= 10) {
      sleepScore = 80;
    } else if (sleepHours > 0) {
      sleepScore = Math.max(0, 100 - Math.abs(sleepHours - 8) * 20);
    }

    const wellbeingScore =
      moodScore * 0.20 +
      stressManagementScore * 0.15 +
      energyScore * 0.10 +
      mindfulnessScore * 0.20 +
      journalingScore * 0.15 +
      emotionalCheckinScore * 0.10 +
      sleepScore * 0.10;

    return {
      score: Math.round(wellbeingScore),
      details: {
        mood: moodScore,
        stressManagement: stressManagementScore,
        energy: energyScore,
        mindfulness: mindfulnessScore,
        journaling: journalingScore,
        emotionalCheckin: emotionalCheckinScore,
        sleep: sleepScore,
        sleepHours,
        moodLogCount: moodResult.rows.length,
        stressLogCount: stressResult.rows.length,
        mindfulnessCount: practiceCount,
        journalEntryCount: entryCount,
      },
    };
  }

  /**
   * Calculate biometrics score (0-100) - WHOOP and wearable data
   * Components: Recovery (35%), Sleep Quality (30%), Strain (20%), HRV Trend (15%)
   * Non-WHOOP users get a neutral default of 50
   */
  private async calculateBiometricsScore(
    userId: string,
    localDate: string
  ): Promise<{ score: number; details: Record<string, unknown>; hasData: boolean }> {
    // Fetch WHOOP / wearable data
    const [healthResult, sleepResult, hrvResult] = await Promise.all([
      // Daily health metrics (recovery + strain)
      query<{
        sleep_hours: number | null;
        recovery_score: number | null;
        strain_score: number | null;
      }>(
        `SELECT sleep_hours, recovery_score, strain_score
         FROM daily_health_metrics
         WHERE user_id = $1 AND metric_date = $2::date`,
        [userId, localDate]
      ),
      // Detailed sleep data from health_data_records
      query<{ value: Record<string, unknown> }>(
        `SELECT value FROM health_data_records
         WHERE user_id = $1 AND data_type = 'sleep' AND recorded_at::date = $2::date
         AND is_golden_source = true
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, localDate]
      ),
      // HRV data for 7-day trend comparison
      query<{ value: Record<string, unknown>; recorded_at: Date }>(
        `SELECT value, recorded_at FROM health_data_records
         WHERE user_id = $1 AND data_type = 'hrv'
           AND recorded_at::date BETWEEN ($2::date - INTERVAL '7 days') AND $2::date
           AND is_golden_source = true
         ORDER BY recorded_at DESC`,
        [userId, localDate]
      ),
    ]);

    const hasHealthData = healthResult.rows.length > 0;
    if (!hasHealthData) {
      // No WHOOP/wearable data — return neutral score
      return {
        score: 50,
        details: { noWearableData: true },
        hasData: false,
      };
    }

    const recovery = healthResult.rows[0]?.recovery_score ?? 50;
    const strain = healthResult.rows[0]?.strain_score ?? 0;

    // --- Recovery Score (35%): Direct WHOOP recovery (0-100) ---
    const recoveryScore = Math.min(100, Math.max(0, recovery));

    // --- Sleep Quality (30%): From detailed sleep data or basic hours ---
    let sleepQualityScore = 50;
    if (sleepResult.rows.length > 0) {
      const sleepData = sleepResult.rows[0].value as {
        sleep_quality_score?: number;
        sleep_efficiency_percent?: number;
        sleep_consistency_percent?: number;
      };
      // Average of quality, efficiency, and consistency scores
      const components = [
        sleepData.sleep_quality_score,
        sleepData.sleep_efficiency_percent,
        sleepData.sleep_consistency_percent,
      ].filter((v): v is number => v != null);
      if (components.length > 0) {
        sleepQualityScore = components.reduce((sum, v) => sum + v, 0) / components.length;
      }
    } else {
      // Fallback to basic sleep hours
      const sleepHours = healthResult.rows[0]?.sleep_hours || 0;
      if (sleepHours >= 7 && sleepHours <= 9) sleepQualityScore = 90;
      else if (sleepHours >= 6) sleepQualityScore = 70;
      else if (sleepHours > 0) sleepQualityScore = Math.max(20, sleepHours * 10);
    }

    // --- Strain (20%): Optimal strain 8-14 = 100, too low/high = reduced ---
    let strainScore = 50;
    if (strain > 0) {
      if (strain >= 8 && strain <= 14) {
        strainScore = 100;
      } else if (strain >= 5 && strain < 8) {
        strainScore = 70;
      } else if (strain > 14 && strain <= 18) {
        strainScore = 80; // Still good but pushing it
      } else if (strain < 5) {
        strainScore = 60; // Low effort day
      } else {
        strainScore = 70; // Very high strain, risk of overtraining
      }
    }

    // --- HRV Trend (15%): Compare today's HRV to 7-day rolling avg ---
    let hrvTrendScore = 50;
    if (hrvResult.rows.length >= 2) {
      const hrvValues = hrvResult.rows.map((r) => {
        const val = r.value as { hrv_rmssd_ms?: number };
        return val.hrv_rmssd_ms ?? 0;
      }).filter((v) => v > 0);

      if (hrvValues.length >= 2) {
        const todayHrv = hrvValues[0]; // Most recent
        const avgPastHrv = hrvValues.slice(1).reduce((sum, v) => sum + v, 0) / (hrvValues.length - 1);
        if (avgPastHrv > 0) {
          const changePercent = ((todayHrv - avgPastHrv) / avgPastHrv) * 100;
          if (changePercent >= 5) hrvTrendScore = 100; // Improving
          else if (changePercent >= -5) hrvTrendScore = 75; // Stable
          else hrvTrendScore = 50; // Declining
        }
      }
    }

    const biometricsScore =
      recoveryScore * 0.35 +
      sleepQualityScore * 0.30 +
      strainScore * 0.20 +
      hrvTrendScore * 0.15;

    return {
      score: Math.round(biometricsScore),
      details: {
        recovery: recoveryScore,
        sleepQuality: sleepQualityScore,
        strain: strainScore,
        hrvTrend: hrvTrendScore,
        rawRecovery: recovery,
        rawStrain: strain,
      },
      hasData: true,
    };
  }

  /**
   * Calculate engagement score (0-100) - Daily tasks, habits, routines, check-ins, XP
   * Components: Daily Tasks (25%), Habits (25%), Routines (20%), Check-ins (15%), XP (15%)
   */
  private async calculateEngagementScore(
    userId: string,
    localDate: string
  ): Promise<{ score: number; details: Record<string, unknown>; hasData: boolean }> {
    const startOfDay = `${localDate}T00:00:00`;
    const endOfDay = `${localDate}T23:59:59`;

    const [tasksResult, habitsResult, routinesResult, checkinsResult, xpResult] = await Promise.all([
      // Daily tasks completion
      query<{ completed: string; total: string }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) as total
         FROM user_tasks
         WHERE user_id = $1 AND scheduled_at::date = $2::date`,
        [userId, localDate]
      ),
      // Habit completion
      query<{ completed: string; total: string }>(
        `SELECT
          COUNT(*) FILTER (WHERE hl.completed = true) as completed,
          COUNT(*) as total
         FROM habits h
         LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.log_date = $2::date
         WHERE h.user_id = $1 AND h.is_active = true AND h.is_archived = false`,
        [userId, localDate]
      ),
      // Routine completions
      query<{ avg_rate: number | null; count: string }>(
        `SELECT AVG(completion_rate) as avg_rate, COUNT(*) as count
         FROM routine_completions
         WHERE user_id = $1 AND completion_date = $2::date`,
        [userId, localDate]
      ),
      // Check-in events (existing logic)
      query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM activity_events
         WHERE user_id = $1 AND type = 'participation'
           AND timestamp >= $2::timestamptz AND timestamp <= $3::timestamptz`,
        [userId, startOfDay, endOfDay]
      ),
      // XP earned today
      query<{ xp_today: string }>(
        `SELECT COALESCE(SUM(xp_amount), 0) as xp_today
         FROM user_xp_transactions
         WHERE user_id = $1 AND created_at::date = $2::date`,
        [userId, localDate]
      ),
    ]);

    // --- Daily Tasks (25%) ---
    const tasksTotal = parseInt(tasksResult.rows[0]?.total || '0', 10);
    const tasksCompleted = parseInt(tasksResult.rows[0]?.completed || '0', 10);
    const taskScore = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

    // --- Habits (25%) ---
    const habitsTotal = parseInt(habitsResult.rows[0]?.total || '0', 10);
    const habitsCompleted = parseInt(habitsResult.rows[0]?.completed || '0', 10);
    const habitScore = habitsTotal > 0 ? (habitsCompleted / habitsTotal) * 100 : 0;

    // --- Routines (20%) ---
    const routineCount = parseInt(routinesResult.rows[0]?.count || '0', 10);
    const routineAvgRate = routinesResult.rows[0]?.avg_rate ?? 0;
    const routineScore = routineCount > 0 ? Math.min(100, routineAvgRate) : 0;

    // --- Check-ins (15%) ---
    const checkinCount = parseInt(checkinsResult.rows[0]?.count || '0', 10);
    const checkinScore = checkinCount > 0 ? 100 : 0;

    // --- XP Earned (15%) ---
    const xpToday = parseInt(xpResult.rows[0]?.xp_today || '0', 10);
    let xpScore = 0;
    if (xpToday >= 100) xpScore = 100;
    else if (xpToday >= 50) xpScore = 80;
    else if (xpToday >= 25) xpScore = 60;
    else if (xpToday > 0) xpScore = 40;

    const engagementScore =
      taskScore * 0.25 +
      habitScore * 0.25 +
      routineScore * 0.20 +
      checkinScore * 0.15 +
      xpScore * 0.15;

    const hasData = tasksTotal > 0 || habitsTotal > 0 || routineCount > 0 || checkinCount > 0 || xpToday > 0;

    return {
      score: Math.round(engagementScore),
      details: {
        dailyTasks: taskScore,
        habits: habitScore,
        routines: routineScore,
        checkIns: checkinScore,
        xp: xpScore,
        tasksCompleted,
        tasksTotal,
        habitsCompleted,
        habitsTotal,
        routineCount,
        xpToday,
      },
      hasData,
    };
  }

  /**
   * Calculate consistency score (0-100) - Streaks, activity breadth, daily engagement
   * Components: Current Streak (40%), Activity Breadth (30%), Activity Status (15%), App Engagement (15%)
   * NOTE: Must be called AFTER other 5 scores are calculated (needs hasData flags)
   */
  private async calculateConsistencyScore(
    userId: string,
    localDate: string,
    categoryHasData: { workout: boolean; nutrition: boolean; wellbeing: boolean; biometrics: boolean; engagement: boolean }
  ): Promise<{ score: number; details: Record<string, unknown> }> {
    const startOfDay = `${localDate}T00:00:00`;
    const endOfDay = `${localDate}T23:59:59`;

    const [streakResult, statusResult, activityResult] = await Promise.all([
      // Current streak from users table
      query<{ current_streak: number | null }>(
        `SELECT current_streak FROM users WHERE id = $1`,
        [userId]
      ),
      // Activity status for today
      query<{ activity_status: string }>(
        `SELECT activity_status FROM activity_status_history
         WHERE user_id = $1 AND status_date = $2::date LIMIT 1`,
        [userId, localDate]
      ),
      // Any activity event today
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM activity_events
         WHERE user_id = $1 AND timestamp >= $2::timestamptz AND timestamp <= $3::timestamptz`,
        [userId, startOfDay, endOfDay]
      ),
    ]);

    // --- Current Streak (40%) ---
    const streak = streakResult.rows[0]?.current_streak || 0;
    let streakScore = 0;
    if (streak >= 30) streakScore = 100;
    else if (streak >= 14) streakScore = 90;
    else if (streak >= 7) streakScore = 75;
    else if (streak >= 3) streakScore = 50;
    else if (streak >= 1) streakScore = 25;

    // --- Activity Breadth (30%): How many of the 5 categories had data today ---
    const categoriesWithData = [
      categoryHasData.workout,
      categoryHasData.nutrition,
      categoryHasData.wellbeing,
      categoryHasData.biometrics,
      categoryHasData.engagement,
    ].filter(Boolean).length;
    const breadthScore = (categoriesWithData / 5) * 100;

    // --- Activity Status (15%): Did they set their status today ---
    const statusScore = statusResult.rows.length > 0 ? 100 : 0;

    // --- App Engagement (15%): Any activity event ---
    const eventCount = parseInt(activityResult.rows[0]?.count || '0', 10);
    const appEngagementScore = eventCount > 0 ? 100 : 0;

    const consistencyScore =
      streakScore * 0.40 +
      breadthScore * 0.30 +
      statusScore * 0.15 +
      appEngagementScore * 0.15;

    return {
      score: Math.round(consistencyScore),
      details: {
        streak: streakScore,
        breadth: breadthScore,
        activityStatus: statusScore,
        appEngagement: appEngagementScore,
        currentStreak: streak,
        categoriesWithData,
      },
    };
  }

  /**
   * Generate explanation for the score across all 6 categories
   */
  private generateExplanation(
    componentScores: ComponentScores,
    _details: Record<string, Record<string, unknown>>
  ): string {
    const parts: string[] = [];

    // Workout
    if (componentScores.workout >= 80) parts.push('Excellent workout performance');
    else if (componentScores.workout >= 60) parts.push('Good workout consistency');
    else if (componentScores.workout > 0) parts.push('Consider increasing workout frequency');

    // Nutrition
    if (componentScores.nutrition >= 80) parts.push('Great nutrition adherence');
    else if (componentScores.nutrition >= 60) parts.push('Nutrition on track');
    else if (componentScores.nutrition > 0) parts.push('Focus on meeting nutrition targets');

    // Wellbeing
    if (componentScores.wellbeing >= 80) parts.push('Strong mental wellbeing engagement');
    else if (componentScores.wellbeing >= 60) parts.push('Good wellbeing check-ins');
    else if (componentScores.wellbeing > 0) parts.push('Try mindfulness or journaling today');

    // Biometrics
    if (componentScores.biometrics >= 80) parts.push('Recovery and biometrics look great');
    else if (componentScores.biometrics >= 60) parts.push('Biometrics are in a healthy range');
    else if (componentScores.biometrics > 50) parts.push('Recovery could improve');

    // Engagement
    if (componentScores.engagement >= 80) parts.push('High daily task and habit engagement');
    else if (componentScores.engagement >= 60) parts.push('Good daily engagement');
    else if (componentScores.engagement > 0) parts.push('Complete more daily tasks and habits');

    // Consistency
    if (componentScores.consistency >= 80) parts.push('Amazing consistency streak');
    else if (componentScores.consistency >= 60) parts.push('Building solid consistency');
    else if (componentScores.consistency > 0) parts.push('Keep your streak going');

    return parts.length > 0 ? parts.join('. ') + '.' : 'Start logging activities to build your score.';
  }

  /**
   * Calculate daily score for a user across all 6 categories
   */
  async calculateDailyScore(
    userId: string,
    date: Date,
    weights: ScoringWeights = DEFAULT_WEIGHTS
  ): Promise<DailyScore> {
    // Get user's local date
    const localDate = await this.getLocalDate(userId, date);

    // Step 1: Calculate 5 independent components in parallel
    const [workoutResult, nutritionResult, wellbeingResult, biometricsResult, engagementResult] =
      await Promise.all([
        this.calculateWorkoutScore(userId, localDate),
        this.calculateNutritionScore(userId, localDate),
        this.calculateWellbeingScore(userId, localDate),
        this.calculateBiometricsScore(userId, localDate),
        this.calculateEngagementScore(userId, localDate),
      ]);

    // Step 2: Calculate consistency (depends on which categories had data)
    const categoryHasData = {
      workout: workoutResult.score > 0,
      nutrition: nutritionResult.score > 0,
      wellbeing: wellbeingResult.score > 0,
      biometrics: biometricsResult.hasData,
      engagement: engagementResult.hasData,
    };
    const consistencyResult = await this.calculateConsistencyScore(userId, localDate, categoryHasData);

    const componentScores: ComponentScores = {
      workout: workoutResult.score,
      nutrition: nutritionResult.score,
      wellbeing: wellbeingResult.score,
      biometrics: biometricsResult.score,
      engagement: engagementResult.score,
      consistency: consistencyResult.score,
    };

    // Calculate total score (weighted)
    const totalScore =
      componentScores.workout * (weights.workout ?? DEFAULT_WEIGHTS.workout) +
      componentScores.nutrition * (weights.nutrition ?? DEFAULT_WEIGHTS.nutrition) +
      componentScores.wellbeing * (weights.wellbeing ?? DEFAULT_WEIGHTS.wellbeing) +
      componentScores.biometrics * (weights.biometrics ?? DEFAULT_WEIGHTS.biometrics) +
      componentScores.engagement * (weights.engagement ?? DEFAULT_WEIGHTS.engagement) +
      componentScores.consistency * (weights.consistency ?? DEFAULT_WEIGHTS.consistency);

    // Generate explanation
    const explanation = this.generateExplanation(componentScores, {
      workout: workoutResult.details,
      nutrition: nutritionResult.details,
      wellbeing: wellbeingResult.details,
      biometrics: biometricsResult.details,
      engagement: engagementResult.details,
      consistency: consistencyResult.details,
    });

    // Check for anomalies
    const flags: DailyScore['flags'] = {};
    if (totalScore > 100 || totalScore < 0) {
      flags.anomaly_detected = true;
    }

    return {
      userId,
      date: localDate,
      totalScore: Math.round(totalScore * 100) / 100,
      componentScores,
      explanation,
      flags,
    };
  }

  /**
   * Save daily score to database
   */
  async saveDailyScore(score: DailyScore): Promise<void> {
    await query(
      `INSERT INTO daily_user_scores 
       (user_id, date, total_score, component_scores, explanation, flags)
       VALUES ($1, $2::date, $3, $4, $5, $6)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         total_score = EXCLUDED.total_score,
         component_scores = EXCLUDED.component_scores,
         explanation = EXCLUDED.explanation,
         flags = EXCLUDED.flags,
         updated_at = CURRENT_TIMESTAMP`,
      [
        score.userId,
        score.date,
        score.totalScore,
        JSON.stringify(score.componentScores),
        score.explanation,
        JSON.stringify(score.flags),
      ]
    );
  }

  /**
   * Get daily score for a user
   */
  async getDailyScore(userId: string, date: string): Promise<DailyScore | null> {
    const result = await query<{
      user_id: string;
      date: string;
      total_score: number;
      component_scores: ComponentScores;
      explanation: string | null;
      flags: Record<string, unknown>;
    }>(
      `SELECT user_id, date, total_score, component_scores, explanation, flags
       FROM daily_user_scores
       WHERE user_id = $1 AND date = $2::date`,
      [userId, date]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      date: row.date,
      totalScore: parseFloat(row.total_score.toString()),
      componentScores: normalizeComponentScores(row.component_scores as unknown as Record<string, number>),
      explanation: row.explanation || '',
      flags: (row.flags as DailyScore['flags']) || {},
    };
  }
  /**
   * Check if scores exist for a given date
   */
  async hasScoresForDate(date: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM daily_user_scores WHERE date = $1::date`,
      [date]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Compute and save scores for all active users for a given date.
   * Used to lazily populate daily_user_scores when the leaderboard is first requested.
   */
  async computeScoresForAllUsers(date: Date): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];

    // Skip if scores already exist for this date
    if (await this.hasScoresForDate(dateStr)) {
      return 0;
    }

    // Get all active users who have completed onboarding (skip test/dummy users)
    const usersResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE is_active = true AND onboarding_status = 'completed'`
    );

    let computed = 0;
    for (const user of usersResult.rows) {
      try {
        const score = await this.calculateDailyScore(user.id, date);
        await this.saveDailyScore(score);
        computed++;
      } catch {
        // Skip users that fail (e.g., missing data) - don't block leaderboard
      }
    }

    return computed;
  }

  /**
   * Get score trend over N days (used by intelligence controller).
   */
  async getScoreTrend(
    userId: string,
    days: number
  ): Promise<Array<{ date: string; totalScore: number; componentScores: ComponentScores }>> {
    const result = await query<{
      date: string;
      total_score: number;
      component_scores: Record<string, number>;
    }>(
      `SELECT date, total_score, component_scores
       FROM daily_user_scores
       WHERE user_id = $1
         AND date >= CURRENT_DATE - $2::integer * INTERVAL '1 day'
       ORDER BY date ASC`,
      [userId, days]
    );

    return result.rows.map((r) => ({
      date: r.date,
      totalScore: parseFloat(r.total_score as unknown as string),
      componentScores: normalizeComponentScores(
        typeof r.component_scores === 'string'
          ? JSON.parse(r.component_scores)
          : r.component_scores
      ),
    }));
  }

  /**
   * Calculate Life Score - a holistic metric measuring overall life improvement.
   *
   * Weight distribution:
   *   - Health Score (daily score):     40%
   *   - Life Goal Progress:            25%
   *   - Intention Fulfillment (30d):   15%
   *   - Consistency (14d check-ins):   10%
   *   - Engagement (7d journal+mood):  10%
   */
  async calculateLifeScore(userId: string): Promise<{
    totalScore: number;
    components: {
      healthScore: { score: number; weight: number };
      lifeGoalProgress: { score: number; weight: number; activeGoalCount: number };
      intentionFulfillment: { score: number; weight: number; rate: number };
      consistency: { score: number; weight: number; checkinsLast14d: number };
      engagement: { score: number; weight: number };
    };
  }> {
    logger.info(`[LifeScore] Calculating life score for user ${userId}`);

    // -------------------------------------------------------
    // 1. Health Score (40%) — today's daily health score
    // -------------------------------------------------------
    let healthScore = 0;
    try {
      const todayResult = await query<{ total_score: number }>(
        `SELECT total_score
         FROM daily_user_scores
         WHERE user_id = $1
         ORDER BY date DESC
         LIMIT 1`,
        [userId]
      );

      if (todayResult.rows.length > 0) {
        healthScore = parseFloat(todayResult.rows[0].total_score.toString());
      } else {
        // No cached score — compute live
        const liveScore = await this.calculateDailyScore(userId, new Date());
        healthScore = liveScore.totalScore;
      }
    } catch (err) {
      logger.warn(`[LifeScore] Failed to get health score for user ${userId}`, { error: err instanceof Error ? err.message : String(err) });
      healthScore = 0;
    }

    // -------------------------------------------------------
    // 2. Life Goal Progress (25%) — average progress of active goals
    // -------------------------------------------------------
    let lifeGoalProgressScore = 0;
    let activeGoalCount = 0;
    try {
      const goalsResult = await query<{ avg_progress: number | null; goal_count: string }>(
        `SELECT
           AVG(progress) as avg_progress,
           COUNT(*) as goal_count
         FROM life_goals
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      activeGoalCount = parseInt(goalsResult.rows[0]?.goal_count || '0', 10);
      if (activeGoalCount > 0 && goalsResult.rows[0]?.avg_progress != null) {
        // progress is stored as 0-100
        lifeGoalProgressScore = Math.min(100, Math.max(0, goalsResult.rows[0].avg_progress));
      }
    } catch (err) {
      logger.warn(`[LifeScore] Failed to get life goal progress for user ${userId}`, { error: err instanceof Error ? err.message : String(err) });
    }

    // -------------------------------------------------------
    // 3. Intention Fulfillment (15%) — 30-day completion rate
    // -------------------------------------------------------
    let intentionFulfillmentScore = 0;
    let intentionRate = 0;
    try {
      const intentionsResult = await query<{ total: string; fulfilled: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_fulfilled = true) as fulfilled
         FROM daily_intentions
         WHERE user_id = $1
           AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );

      const total = parseInt(intentionsResult.rows[0]?.total || '0', 10);
      const fulfilled = parseInt(intentionsResult.rows[0]?.fulfilled || '0', 10);
      if (total > 0) {
        intentionRate = fulfilled / total;
        intentionFulfillmentScore = intentionRate * 100;
      }
    } catch (err) {
      logger.warn(`[LifeScore] Failed to get intention fulfillment for user ${userId}`, { error: err instanceof Error ? err.message : String(err) });
    }

    // -------------------------------------------------------
    // 4. Consistency (10%) — life goal check-in frequency over 14 days
    //    14 check-ins (1/day) = 100%
    // -------------------------------------------------------
    let consistencyScore = 0;
    let checkinsLast14d = 0;
    try {
      const checkinsResult = await query<{ checkin_count: string }>(
        `SELECT COUNT(*) as checkin_count
         FROM life_goal_checkins
         WHERE user_id = $1
           AND created_at >= CURRENT_DATE - INTERVAL '14 days'`,
        [userId]
      );

      checkinsLast14d = parseInt(checkinsResult.rows[0]?.checkin_count || '0', 10);
      consistencyScore = Math.min(100, (checkinsLast14d / 14) * 100);
    } catch (err) {
      logger.warn(`[LifeScore] Failed to get consistency data for user ${userId}`, { error: err instanceof Error ? err.message : String(err) });
    }

    // -------------------------------------------------------
    // 5. Engagement (10%) — journaling + mood tracking over 7 days
    //    7+ total entries = 100%
    // -------------------------------------------------------
    let engagementScore = 0;
    try {
      const [journalResult, moodResult] = await Promise.all([
        query<{ entry_count: string }>(
          `SELECT COUNT(*) as entry_count
           FROM journal_entries
           WHERE user_id = $1
             AND logged_at >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ),
        query<{ mood_count: string }>(
          `SELECT COUNT(*) as mood_count
           FROM mood_logs
           WHERE user_id = $1
             AND logged_at >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ),
      ]);

      const journalCount = parseInt(journalResult.rows[0]?.entry_count || '0', 10);
      const moodCount = parseInt(moodResult.rows[0]?.mood_count || '0', 10);
      const totalEngagement = journalCount + moodCount;
      engagementScore = Math.min(100, (totalEngagement / 7) * 100);
    } catch (err) {
      logger.warn(`[LifeScore] Failed to get engagement data for user ${userId}`, { error: err instanceof Error ? err.message : String(err) });
    }

    // -------------------------------------------------------
    // Weighted total
    // -------------------------------------------------------
    const LIFE_SCORE_WEIGHTS = {
      healthScore: 0.40,
      lifeGoalProgress: 0.25,
      intentionFulfillment: 0.15,
      consistency: 0.10,
      engagement: 0.10,
    };

    const totalScore =
      healthScore * LIFE_SCORE_WEIGHTS.healthScore +
      lifeGoalProgressScore * LIFE_SCORE_WEIGHTS.lifeGoalProgress +
      intentionFulfillmentScore * LIFE_SCORE_WEIGHTS.intentionFulfillment +
      consistencyScore * LIFE_SCORE_WEIGHTS.consistency +
      engagementScore * LIFE_SCORE_WEIGHTS.engagement;

    const result = {
      totalScore: Math.round(totalScore * 100) / 100,
      components: {
        healthScore: { score: Math.round(healthScore * 100) / 100, weight: LIFE_SCORE_WEIGHTS.healthScore },
        lifeGoalProgress: { score: Math.round(lifeGoalProgressScore * 100) / 100, weight: LIFE_SCORE_WEIGHTS.lifeGoalProgress, activeGoalCount },
        intentionFulfillment: { score: Math.round(intentionFulfillmentScore * 100) / 100, weight: LIFE_SCORE_WEIGHTS.intentionFulfillment, rate: Math.round(intentionRate * 10000) / 10000 },
        consistency: { score: Math.round(consistencyScore * 100) / 100, weight: LIFE_SCORE_WEIGHTS.consistency, checkinsLast14d },
        engagement: { score: Math.round(engagementScore * 100) / 100, weight: LIFE_SCORE_WEIGHTS.engagement },
      },
    };

    logger.info(`[LifeScore] User ${userId} life score: ${result.totalScore}`);

    return result;
  }
}

// Export singleton instance
export const aiScoringService = new AIScoringService();
export default aiScoringService;

