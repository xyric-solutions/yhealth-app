/**
 * @file Cross-Pillar Intelligence Service
 * @description Detects contradictions across ALL health pillars (exercise, nutrition,
 * sleep, hydration, mental health, recovery) using 22 deterministic rules.
 * Each rule is a pure function: (context, snapshot) => { triggered, severity, evidence }.
 * AI correction generation is batched for high/critical severity only.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import type { ComprehensiveUserContext } from './comprehensive-user-context.service.js';
import type { DailySnapshot } from './daily-analysis.service.js';

// ============================================
// TYPES
// ============================================

export type ContradictionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ContradictionStatus = 'detected' | 'notified' | 'resolved' | 'dismissed';

export interface ContradictionEvidence {
  pillar_a_data: Record<string, unknown>;
  pillar_b_data: Record<string, unknown>;
  threshold_violated: string;
}

export interface DetectedContradiction {
  ruleId: string;
  pillarA: string;
  pillarB: string;
  severity: ContradictionSeverity;
  evidence: ContradictionEvidence;
  description: string;
}

export interface StoredContradiction extends DetectedContradiction {
  id: string;
  userId: string;
  aiCorrection: string | null;
  status: ContradictionStatus;
  detectedAt: string;
  resolvedAt: string | null;
}

interface ContradictionRule {
  id: string;
  pillarA: string;
  pillarB: string;
  evaluate(snapshot: DailySnapshot, context: ComprehensiveUserContext): {
    triggered: boolean;
    severity: ContradictionSeverity;
    evidence: ContradictionEvidence;
    description: string;
  } | null;
}

// ============================================
// 22 CONTRADICTION RULES
// ============================================

const contradictionRules: ContradictionRule[] = [
  // ---- Existing rules (enhanced with severity scoring) ----

  {
    id: 'HIGH_EXERCISE_LOW_SLEEP',
    pillarA: 'exercise',
    pillarB: 'sleep',
    evaluate(snapshot) {
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 6) return null;
      if (snapshot.workoutsCompleted < 1) return null;
      const severity: ContradictionSeverity = snapshot.sleepHours < 5 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { workoutsCompleted: snapshot.workoutsCompleted },
          pillar_b_data: { sleepHours: snapshot.sleepHours },
          threshold_violated: 'sleep < 6h with active training',
        },
        description: `Training with only ${snapshot.sleepHours.toFixed(1)}h sleep — recovery and injury risk elevated`,
      };
    },
  },

  {
    id: 'HIGH_EXERCISE_LOW_NUTRITION',
    pillarA: 'exercise',
    pillarB: 'nutrition',
    evaluate(snapshot) {
      if (snapshot.calorieAdherence === null || snapshot.calorieAdherence >= 70) return null;
      if (snapshot.workoutsCompleted < 1) return null;
      const severity: ContradictionSeverity = snapshot.calorieAdherence < 40 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { workoutsCompleted: snapshot.workoutsCompleted },
          pillar_b_data: { calorieAdherence: snapshot.calorieAdherence },
          threshold_violated: 'calorie adherence < 70% on training day',
        },
        description: `Training with ${snapshot.calorieAdherence}% nutrition adherence — performance and recovery compromised`,
      };
    },
  },

  {
    id: 'HIGH_STRESS_HIGH_EXERCISE',
    pillarA: 'mental_health',
    pillarB: 'exercise',
    evaluate(snapshot) {
      if (snapshot.stressLevel <= 7) return null;
      if (snapshot.strainScore === null || snapshot.strainScore <= 14) return null;
      const severity: ContradictionSeverity = snapshot.stressLevel >= 9 && snapshot.strainScore > 17 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { stressLevel: snapshot.stressLevel },
          pillar_b_data: { strainScore: snapshot.strainScore },
          threshold_violated: 'stress > 7/10 AND strain > 14/21',
        },
        description: `High stress (${snapshot.stressLevel}/10) combined with high training strain (${snapshot.strainScore}/21) — cortisol risk`,
      };
    },
  },

  {
    id: 'LOW_WATER_HIGH_EXERCISE',
    pillarA: 'hydration',
    pillarB: 'exercise',
    evaluate(snapshot) {
      if (snapshot.waterIntakePercentage === null || snapshot.waterIntakePercentage >= 50) return null;
      if (snapshot.workoutsCompleted < 1) return null;
      const severity: ContradictionSeverity = snapshot.waterIntakePercentage < 30 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { waterIntakePercentage: snapshot.waterIntakePercentage },
          pillar_b_data: { workoutsCompleted: snapshot.workoutsCompleted },
          threshold_violated: 'water < 50% target on training day',
        },
        description: `Only ${snapshot.waterIntakePercentage}% hydrated while training — performance drops up to 25%`,
      };
    },
  },

  {
    id: 'HIGH_EXERCISE_LOW_RECOVERY',
    pillarA: 'exercise',
    pillarB: 'recovery',
    evaluate(snapshot) {
      if (snapshot.recoveryScore === null || snapshot.recoveryScore >= 40) return null;
      if (snapshot.workoutsCompleted < 1 && (snapshot.strainScore === null || snapshot.strainScore <= 10)) return null;
      const severity: ContradictionSeverity = snapshot.recoveryScore < 25 ? 'critical' : 'high';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { workoutsCompleted: snapshot.workoutsCompleted, strainScore: snapshot.strainScore },
          pillar_b_data: { recoveryScore: snapshot.recoveryScore },
          threshold_violated: 'recovery < 40% with active training',
        },
        description: `Training through ${snapshot.recoveryScore}% recovery — injury risk significantly elevated`,
      };
    },
  },

  {
    id: 'POOR_SLEEP_HIGH_STRESS',
    pillarA: 'sleep',
    pillarB: 'mental_health',
    evaluate(snapshot) {
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 6) return null;
      if (snapshot.stressLevel <= 6) return null;
      const severity: ContradictionSeverity = snapshot.sleepHours < 5 && snapshot.stressLevel >= 8 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { sleepHours: snapshot.sleepHours },
          pillar_b_data: { stressLevel: snapshot.stressLevel },
          threshold_violated: 'sleep < 6h AND stress > 6/10',
        },
        description: `Sleep-stress cycle: ${snapshot.sleepHours.toFixed(1)}h sleep + ${snapshot.stressLevel}/10 stress — cognitive and recovery impact`,
      };
    },
  },

  {
    id: 'NUTRITION_TIMING_EXERCISE',
    pillarA: 'nutrition',
    pillarB: 'exercise',
    evaluate(_snapshot, context) {
      // Check if recent meal was very close to workout
      const recentMeals = context.nutrition?.recentMeals ?? [];
      const recentWorkouts = context.workouts?.recentWorkouts ?? [];
      if (recentMeals.length === 0 || recentWorkouts.length === 0) return null;

      const closeMeal = recentMeals.find(m => m.hoursAgo < 1);
      const closeWorkout = recentWorkouts.find(w => w.hoursAgo < 1);
      if (!closeMeal || !closeWorkout) return null;

      return {
        triggered: true,
        severity: 'low' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { mealHoursAgo: closeMeal.hoursAgo, mealName: closeMeal.name },
          pillar_b_data: { workoutHoursAgo: closeWorkout.hoursAgo, workoutName: closeWorkout.name },
          threshold_violated: 'heavy meal within 1h of workout',
        },
        description: `Heavy meal within 1 hour of workout — potential GI discomfort and reduced performance`,
      };
    },
  },

  {
    id: 'INCONSISTENT_SCHEDULE',
    pillarA: 'sleep',
    pillarB: 'consistency',
    evaluate(snapshot) {
      // Use habits completion as a proxy for schedule consistency
      if (snapshot.habitsTotal === 0) return null;
      const completionRate = snapshot.habitsTotal > 0 ? (snapshot.habitsCompleted / snapshot.habitsTotal) * 100 : 100;
      if (completionRate >= 50) return null;
      if (snapshot.streakDays > 3) return null; // Still maintaining streak

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { habitsCompleted: snapshot.habitsCompleted, habitsTotal: snapshot.habitsTotal },
          pillar_b_data: { streakDays: snapshot.streakDays, completionRate },
          threshold_violated: 'habit completion < 50% AND streak < 4 days',
        },
        description: `Schedule adherence at ${completionRate.toFixed(0)}% — erratic patterns disrupting consistency`,
      };
    },
  },

  // ---- 14 New Rules ----

  {
    id: 'CAFFEINE_SLEEP_CONFLICT',
    pillarA: 'nutrition',
    pillarB: 'sleep',
    evaluate(snapshot, context) {
      // Detect caffeine logging near sleep - use nutrition meals as proxy
      // If sleep quality is poor and nutrition adherence is off
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 6.5) return null;
      const recentMeals = context.nutrition?.recentMeals ?? [];
      // Look for afternoon meals (proxy for late caffeine)
      const afternoonMeals = recentMeals.filter(m => {
        const mealName = (m.name || '').toLowerCase();
        return mealName.includes('coffee') || mealName.includes('caffeine') ||
               mealName.includes('energy') || mealName.includes('pre-workout');
      });
      if (afternoonMeals.length === 0) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { caffeineMeals: afternoonMeals.map(m => m.name) },
          pillar_b_data: { sleepHours: snapshot.sleepHours },
          threshold_violated: 'caffeine intake detected AND sleep < 6.5h',
        },
        description: `Caffeine intake detected with ${snapshot.sleepHours.toFixed(1)}h sleep — caffeine half-life is 5-6h`,
      };
    },
  },

  {
    id: 'PROTEIN_MUSCLE_GOAL_GAP',
    pillarA: 'nutrition',
    pillarB: 'exercise',
    evaluate(snapshot, context) {
      // Check if user has muscle/strength goals but low nutrition adherence
      const goals = context.goals?.activeGoals ?? [];
      const muscleGoal = goals.find(g =>
        g.category?.toLowerCase().includes('muscle') ||
        g.category?.toLowerCase().includes('strength') ||
        g.title?.toLowerCase().includes('muscle') ||
        g.title?.toLowerCase().includes('strength')
      );
      if (!muscleGoal) return null;
      if (snapshot.calorieAdherence === null || snapshot.calorieAdherence >= 80) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { calorieAdherence: snapshot.calorieAdherence },
          pillar_b_data: { goal: muscleGoal.title, goalProgress: muscleGoal.progress },
          threshold_violated: 'muscle/strength goal with nutrition adherence < 80%',
        },
        description: `Muscle/strength goal active but nutrition adherence only ${snapshot.calorieAdherence}% — protein intake likely insufficient`,
      };
    },
  },

  {
    id: 'OVERTRAINING_SYNDROME',
    pillarA: 'exercise',
    pillarB: 'recovery',
    evaluate(snapshot, context) {
      // 3+ consecutive days high strain + declining HRV/recovery
      if (snapshot.strainScore === null || snapshot.strainScore <= 14) return null;
      if (snapshot.recoveryScore === null) return null;

      // Check if recovery is declining (use score trend as proxy)
      const scoreTrend = context.dailyScore?.scoreTrend;
      const recoveryLow = snapshot.recoveryScore < 50;
      if (!recoveryLow && scoreTrend !== 'declining') return null;

      // Use workout completion as proxy for consecutive high-strain days
      const recentWorkouts = context.workouts?.recentWorkouts ?? [];
      const last3DaysWorkouts = recentWorkouts.filter(w => w.hoursAgo <= 72 && w.status === 'completed');
      if (last3DaysWorkouts.length < 3) return null;

      return {
        triggered: true,
        severity: 'critical' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { strainScore: snapshot.strainScore, consecutiveWorkoutDays: last3DaysWorkouts.length },
          pillar_b_data: { recoveryScore: snapshot.recoveryScore, scoreTrend },
          threshold_violated: '3+ consecutive workout days + high strain + declining recovery',
        },
        description: `Overtraining risk: ${last3DaysWorkouts.length} consecutive training days, strain at ${snapshot.strainScore}/21, recovery declining to ${snapshot.recoveryScore}%`,
      };
    },
  },

  {
    id: 'DELOAD_AVOIDANCE',
    pillarA: 'exercise',
    pillarB: 'recovery',
    evaluate(snapshot, context) {
      // 4+ weeks high training load without a rest period
      if (snapshot.streakDays < 21) return null; // Need at least 3 weeks of data
      const completionRate = context.workouts?.completionRate ?? 0;
      if (completionRate < 80) return null; // They're already taking breaks

      const missedWorkouts = context.workouts?.missedWorkouts ?? 0;
      if (missedWorkouts > 2) return null; // They've had rest days

      // High consistency for 3+ weeks without a break
      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { streakDays: snapshot.streakDays, completionRate },
          pillar_b_data: { missedWorkouts, recoveryScore: snapshot.recoveryScore },
          threshold_violated: '21+ day streak with 80%+ completion and no deload',
        },
        description: `${snapshot.streakDays}-day streak with ${completionRate}% completion — deload week recommended to prevent overtraining`,
      };
    },
  },

  {
    id: 'WEEKEND_WARRIOR',
    pillarA: 'exercise',
    pillarB: 'consistency',
    evaluate(_snapshot, context) {
      // Hard to detect from single-day snapshot — use workout distribution
      const recentWorkouts = context.workouts?.recentWorkouts ?? [];
      if (recentWorkouts.length < 3) return null;

      const weekdayWorkouts = recentWorkouts.filter(w => {
        if (!w.date) return false;
        const day = new Date(w.date).getDay();
        return day >= 1 && day <= 5 && w.status === 'completed';
      });
      const weekendWorkouts = recentWorkouts.filter(w => {
        if (!w.date) return false;
        const day = new Date(w.date).getDay();
        return (day === 0 || day === 6) && w.status === 'completed';
      });

      if (weekdayWorkouts.length >= 2 || weekendWorkouts.length < 2) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { weekdayWorkouts: weekdayWorkouts.length },
          pillar_b_data: { weekendWorkouts: weekendWorkouts.length },
          threshold_violated: '< 2 weekday sessions AND 2+ weekend sessions',
        },
        description: `Weekend warrior pattern: ${weekdayWorkouts.length} weekday vs ${weekendWorkouts.length} weekend sessions — increased injury risk`,
      };
    },
  },

  {
    id: 'HYDRATION_PERFORMANCE_DROP',
    pillarA: 'hydration',
    pillarB: 'exercise',
    evaluate(snapshot, context) {
      if (snapshot.waterIntakePercentage === null || snapshot.waterIntakePercentage >= 50) return null;
      const scoreTrend = context.dailyScore?.scoreTrend;
      const workoutScore = snapshot.componentScores.workout ?? 100;
      if (workoutScore >= 60 && scoreTrend !== 'declining') return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { waterIntakePercentage: snapshot.waterIntakePercentage },
          pillar_b_data: { workoutScore, scoreTrend },
          threshold_violated: 'water < 50% AND declining workout performance',
        },
        description: `Hydration at ${snapshot.waterIntakePercentage}% with declining workout scores — dehydration reducing performance`,
      };
    },
  },

  {
    id: 'SLEEP_DEBT_ACCUMULATION',
    pillarA: 'sleep',
    pillarB: 'recovery',
    evaluate(snapshot) {
      // Single-day check — sleep < 6h is a red flag
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 6) return null;
      if (snapshot.recoveryScore === null) return null;

      // Severe sleep debt indicator
      const severity: ContradictionSeverity = snapshot.sleepHours < 5 ? 'high' : 'medium';
      return {
        triggered: true,
        severity,
        evidence: {
          pillar_a_data: { sleepHours: snapshot.sleepHours },
          pillar_b_data: { recoveryScore: snapshot.recoveryScore },
          threshold_violated: 'sleep < 6h accumulating sleep debt',
        },
        description: `Only ${snapshot.sleepHours.toFixed(1)}h sleep — cumulative sleep debt impacts recovery (${snapshot.recoveryScore}%), cognition, and hormone balance`,
      };
    },
  },

  {
    id: 'NUTRITION_MOOD_CORRELATION',
    pillarA: 'nutrition',
    pillarB: 'mental_health',
    evaluate(snapshot) {
      if (snapshot.calorieAdherence === null || snapshot.calorieAdherence >= 60) return null;
      if (snapshot.moodLevel >= 5) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { calorieAdherence: snapshot.calorieAdherence },
          pillar_b_data: { moodLevel: snapshot.moodLevel },
          threshold_violated: 'nutrition adherence < 60% AND mood < 5/10',
        },
        description: `Low nutrition adherence (${snapshot.calorieAdherence}%) correlating with low mood (${snapshot.moodLevel}/10) — blood sugar and nutrient deficiency may be contributing`,
      };
    },
  },

  {
    id: 'RECOVERY_IGNORE_PATTERN',
    pillarA: 'recovery',
    pillarB: 'exercise',
    evaluate(snapshot) {
      if (snapshot.recoveryScore === null || snapshot.recoveryScore >= 33) return null;
      if (snapshot.workoutsCompleted < 1) return null;

      return {
        triggered: true,
        severity: 'critical' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { recoveryScore: snapshot.recoveryScore },
          pillar_b_data: { workoutsCompleted: snapshot.workoutsCompleted, strainScore: snapshot.strainScore },
          threshold_violated: 'recovery < 33% (red zone) AND still training',
        },
        description: `Recovery at ${snapshot.recoveryScore}% (red zone) but completed ${snapshot.workoutsCompleted} workout(s) — high injury and burnout risk`,
      };
    },
  },

  {
    id: 'SOCIAL_ISOLATION_DECLINE',
    pillarA: 'social',
    pillarB: 'engagement',
    evaluate(snapshot, context) {
      const engagement = snapshot.componentScores.engagement ?? 100;
      if (engagement >= 50) return null;

      // Check competition participation as social proxy
      const competitions = context.competitions?.activeCompetitions ?? [];
      if (competitions.length > 0) return null;

      const moodLevel = snapshot.moodLevel;
      if (moodLevel >= 5) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { activeCompetitions: 0 },
          pillar_b_data: { engagement, moodLevel },
          threshold_violated: 'no social/team activity AND engagement < 50% AND mood < 5',
        },
        description: `No team/social activity with declining engagement (${engagement}/100) and mood (${moodLevel}/10) — social support may help`,
      };
    },
  },

  {
    id: 'GOAL_BEHAVIOR_MISMATCH',
    pillarA: 'goals',
    pillarB: 'nutrition',
    evaluate(snapshot, context) {
      const goals = context.goals?.activeGoals ?? [];
      const weightLossGoal = goals.find(g =>
        g.category?.toLowerCase().includes('weight') ||
        g.title?.toLowerCase().includes('weight loss') ||
        g.title?.toLowerCase().includes('lose weight') ||
        g.title?.toLowerCase().includes('fat loss')
      );
      if (!weightLossGoal) return null;

      // Check if nutrition adherence is very low (indicating surplus)
      if (snapshot.calorieAdherence === null || snapshot.calorieAdherence >= 70) return null;

      const progressTrend = context.progressTrend?.weightTrend;
      if (progressTrend === 'losing') return null; // Actually losing, so OK

      return {
        triggered: true,
        severity: 'high' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { goal: weightLossGoal.title, goalProgress: weightLossGoal.progress },
          pillar_b_data: { calorieAdherence: snapshot.calorieAdherence, weightTrend: progressTrend },
          threshold_violated: 'weight loss goal with calorie adherence < 70% and not losing weight',
        },
        description: `Weight loss goal active but nutrition adherence at ${snapshot.calorieAdherence}% — weight trend: ${progressTrend || 'unknown'}. Goal and behavior are misaligned`,
      };
    },
  },

  {
    id: 'SUPPLEMENT_TIMING_CONFLICT',
    pillarA: 'nutrition',
    pillarB: 'sleep',
    evaluate(snapshot, context) {
      // Detect pre-workout supplement near bedtime
      const recentMeals = context.nutrition?.recentMeals ?? [];
      const supplementMeal = recentMeals.find(m => {
        const name = (m.name || '').toLowerCase();
        return (name.includes('pre-workout') || name.includes('supplement') || name.includes('bcaa'))
          && m.hoursAgo < 4;
      });
      if (!supplementMeal) return null;
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 7) return null;

      return {
        triggered: true,
        severity: 'low' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { supplement: supplementMeal.name, hoursAgo: supplementMeal.hoursAgo },
          pillar_b_data: { sleepHours: snapshot.sleepHours },
          threshold_violated: 'stimulant supplement within 4h AND sleep < 7h',
        },
        description: `Pre-workout/supplement taken recently with only ${snapshot.sleepHours.toFixed(1)}h sleep — stimulants may impair sleep quality`,
      };
    },
  },

  {
    id: 'PROGRESSIVE_OVERLOAD_STALL',
    pillarA: 'exercise',
    pillarB: 'consistency',
    evaluate(snapshot, context) {
      // Detect plateau — high consistency but no progression
      const completionRate = context.workouts?.completionRate ?? 0;
      if (completionRate < 70) return null; // Not consistent enough to plateau

      const scoreTrend = context.dailyScore?.scoreTrend;
      const scoreDelta = context.dailyScore?.scoreDelta ?? 0;
      const weekDelta = context.dailyScore?.weekOverWeekDelta ?? 0;

      // Stall = consistent training but no score improvement
      if (scoreTrend !== 'stable' && scoreTrend !== 'declining') return null;
      if (Math.abs(weekDelta) > 5) return null; // Some movement

      if (snapshot.streakDays < 14) return null; // Need enough data

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { completionRate, streakDays: snapshot.streakDays },
          pillar_b_data: { scoreTrend, scoreDelta, weekOverWeekDelta: weekDelta },
          threshold_violated: 'high consistency (70%+) with stagnant scores for 2+ weeks',
        },
        description: `Training plateau: ${completionRate}% completion rate with stagnant scores — progressive overload or programming change needed`,
      };
    },
  },

  {
    id: 'MENTAL_PHYSICAL_DISCONNECT',
    pillarA: 'mental_health',
    pillarB: 'exercise',
    evaluate(snapshot) {
      const workoutScore = snapshot.componentScores.workout ?? 0;
      if (workoutScore < 60) return null; // Physical isn't high

      if (snapshot.moodLevel >= 5 && snapshot.stressLevel <= 6) return null; // Mental is fine

      const mentalBad = snapshot.moodLevel < 4 || snapshot.stressLevel > 7;
      if (!mentalBad) return null;

      return {
        triggered: true,
        severity: 'medium' as ContradictionSeverity,
        evidence: {
          pillar_a_data: { moodLevel: snapshot.moodLevel, stressLevel: snapshot.stressLevel },
          pillar_b_data: { workoutScore },
          threshold_violated: 'high physical scores but declining wellbeing (mood < 4 OR stress > 7)',
        },
        description: `Physical performance strong (${workoutScore}/100) but mental health declining (mood: ${snapshot.moodLevel}/10, stress: ${snapshot.stressLevel}/10) — risk of burnout`,
      };
    },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class CrossPillarIntelligenceService {
  private llm: BaseChatModel;
  private tableEnsured = false;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      temperature: 0.3,
      maxTokens: 400,
    });
  }

  // ---- Table management ----

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS cross_pillar_contradictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          rule_id VARCHAR(50) NOT NULL,
          pillar_a VARCHAR(30) NOT NULL,
          pillar_b VARCHAR(30) NOT NULL,
          severity VARCHAR(10) NOT NULL,
          evidence JSONB NOT NULL,
          ai_correction TEXT,
          status VARCHAR(20) DEFAULT 'detected',
          detected_at TIMESTAMPTZ DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_cpc_user_date
          ON cross_pillar_contradictions(user_id, detected_at DESC)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_cpc_status
          ON cross_pillar_contradictions(user_id, status)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ---- Public API ----

  /**
   * Analyze a user's data for cross-pillar contradictions.
   * Runs all 22 rules, deduplicates against recent detections,
   * generates AI corrections for high/critical, and persists results.
   */
  async analyzeUser(
    userId: string,
    snapshot: DailySnapshot,
    context: ComprehensiveUserContext
  ): Promise<DetectedContradiction[]> {
    await this.ensureTable();
    const startTime = Date.now();

    try {
      // Run all rules
      const detected: DetectedContradiction[] = [];
      for (const rule of contradictionRules) {
        try {
          const result = rule.evaluate(snapshot, context);
          if (result && result.triggered) {
            detected.push({
              ruleId: rule.id,
              pillarA: rule.pillarA,
              pillarB: rule.pillarB,
              severity: result.severity,
              evidence: result.evidence,
              description: result.description,
            });
          }
        } catch (ruleError) {
          logger.warn('[CrossPillarIntelligence] Rule evaluation error', {
            ruleId: rule.id,
            error: ruleError instanceof Error ? ruleError.message : 'Unknown',
          });
        }
      }

      if (detected.length === 0) {
        logger.debug('[CrossPillarIntelligence] No contradictions detected', { userId });
        return [];
      }

      // Deduplicate: skip rules that fired in the last 24h for this user
      const recentResult = await query<{ rule_id: string }>(
        `SELECT DISTINCT rule_id FROM cross_pillar_contradictions
         WHERE user_id = $1 AND detected_at >= NOW() - INTERVAL '24 hours'
           AND status NOT IN ('resolved', 'dismissed')`,
        [userId]
      );
      const recentRuleIds = new Set(recentResult.rows.map(r => r.rule_id));
      const newDetections = detected.filter(d => !recentRuleIds.has(d.ruleId));

      if (newDetections.length === 0) {
        logger.debug('[CrossPillarIntelligence] All contradictions already detected in last 24h', {
          userId,
          totalDetected: detected.length,
        });
        return detected; // Return all detected for context, even if already stored
      }

      // Generate AI corrections for high/critical severity
      const highSeverity = newDetections.filter(d => d.severity === 'high' || d.severity === 'critical');
      const corrections = highSeverity.length > 0
        ? await this.generateAICorrections(userId, highSeverity, snapshot)
        : new Map<string, string>();

      // Persist new detections
      for (const detection of newDetections) {
        try {
          await query(
            `INSERT INTO cross_pillar_contradictions
             (user_id, rule_id, pillar_a, pillar_b, severity, evidence, ai_correction, status, detected_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'detected', NOW())`,
            [
              userId,
              detection.ruleId,
              detection.pillarA,
              detection.pillarB,
              detection.severity,
              JSON.stringify(detection.evidence),
              corrections.get(detection.ruleId) || null,
            ]
          );
        } catch (insertError) {
          logger.warn('[CrossPillarIntelligence] Error persisting contradiction', {
            userId,
            ruleId: detection.ruleId,
            error: insertError instanceof Error ? insertError.message : 'Unknown',
          });
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info('[CrossPillarIntelligence] Analysis complete', {
        userId,
        totalDetected: detected.length,
        newDetections: newDetections.length,
        aiCorrections: corrections.size,
        elapsed: `${elapsed}ms`,
      });

      return detected;
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Analysis error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get active (unresolved) contradictions for a user.
   */
  async getActiveContradictions(userId: string): Promise<StoredContradiction[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string;
        user_id: string;
        rule_id: string;
        pillar_a: string;
        pillar_b: string;
        severity: ContradictionSeverity;
        evidence: ContradictionEvidence;
        ai_correction: string | null;
        status: ContradictionStatus;
        detected_at: string;
        resolved_at: string | null;
      }>(
        `SELECT id, user_id, rule_id, pillar_a, pillar_b, severity,
                evidence, ai_correction, status, detected_at, resolved_at
         FROM cross_pillar_contradictions
         WHERE user_id = $1 AND status IN ('detected', 'notified')
         ORDER BY
           CASE severity
             WHEN 'critical' THEN 0
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END,
           detected_at DESC
         LIMIT 10`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        ruleId: row.rule_id,
        pillarA: row.pillar_a,
        pillarB: row.pillar_b,
        severity: row.severity,
        evidence: row.evidence,
        aiCorrection: row.ai_correction,
        status: row.status,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at,
        description: '', // Not stored in DB, reconstruct from evidence if needed
      }));
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Error fetching active contradictions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Resolve a contradiction (user acted on it or it's no longer relevant).
   */
  async resolveContradiction(contradictionId: string, status: 'resolved' | 'dismissed' = 'resolved'): Promise<void> {
    await this.ensureTable();
    try {
      await query(
        `UPDATE cross_pillar_contradictions
         SET status = $1, resolved_at = NOW()
         WHERE id = $2`,
        [status, contradictionId]
      );
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Error resolving contradiction', {
        contradictionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark contradictions as notified (user has been informed).
   */
  async markNotified(contradictionIds: string[]): Promise<void> {
    if (contradictionIds.length === 0) return;
    await this.ensureTable();
    try {
      await query(
        `UPDATE cross_pillar_contradictions
         SET status = 'notified'
         WHERE id = ANY($1) AND status = 'detected'`,
        [contradictionIds]
      );
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Error marking notified', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get contradiction summary for a user (counts by severity).
   */
  async getContradictionSummary(userId: string): Promise<Record<ContradictionSeverity, number>> {
    await this.ensureTable();
    const summary: Record<ContradictionSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    try {
      const result = await query<{ severity: ContradictionSeverity; count: string }>(
        `SELECT severity, COUNT(*) as count
         FROM cross_pillar_contradictions
         WHERE user_id = $1 AND status IN ('detected', 'notified')
           AND detected_at >= NOW() - INTERVAL '7 days'
         GROUP BY severity`,
        [userId]
      );
      for (const row of result.rows) {
        summary[row.severity] = parseInt(row.count, 10);
      }
    } catch (error) {
      logger.error('[CrossPillarIntelligence] Error fetching summary', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return summary;
  }

  // ---- AI Correction Generation ----

  private async generateAICorrections(
    userId: string,
    contradictions: DetectedContradiction[],
    snapshot: DailySnapshot
  ): Promise<Map<string, string>> {
    const corrections = new Map<string, string>();

    try {
      const contradictionDescriptions = contradictions
        .map((c, i) => `${i + 1}. [${c.severity.toUpperCase()}] ${c.ruleId}: ${c.description}`)
        .join('\n');

      const systemPrompt = `You are a health coaching AI. Generate specific, actionable corrections for detected health contradictions. Each correction should:
1. Acknowledge the specific data points
2. Explain WHY this is a problem physiologically
3. Give ONE specific action the user can take TODAY
4. Be 2-3 sentences max

Return a JSON object: { "RULE_ID": "correction text", ... }`;

      const humanMessage = `User state: Recovery ${snapshot.recoveryScore ?? 'unknown'}%, Sleep ${snapshot.sleepHours?.toFixed(1) ?? 'unknown'}h, Strain ${snapshot.strainScore ?? 'unknown'}/21, Mood ${snapshot.moodLevel}/10, Hydration ${snapshot.waterIntakePercentage ?? 'unknown'}%, Streak ${snapshot.streakDays}d

Contradictions detected:
${contradictionDescriptions}`;

      const response = await Promise.race([
        this.llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(humanMessage),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM timeout')), 8000)
        ),
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
        for (const [ruleId, correction] of Object.entries(parsed)) {
          corrections.set(ruleId, correction);
        }
      }
    } catch (error) {
      // Refresh model on provider error so next call uses working provider
      if (modelFactory.handleProviderError(error)) {
        try { this.llm = modelFactory.getModel({ tier: 'default', maxTokens: 1000 }); } catch { /* no providers */ }
      }
      logger.warn('[CrossPillarIntelligence] AI correction generation failed, using descriptions as fallback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      for (const c of contradictions) {
        corrections.set(c.ruleId, c.description);
      }
    }

    return corrections;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const crossPillarIntelligenceService = new CrossPillarIntelligenceService();
export default crossPillarIntelligenceService;
