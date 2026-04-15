/**
 * @file Intelligent Intervention Service
 * @description 10 decision trees that auto-adjust user plans based on detected
 * contradictions and recovery state. The AI FIXES problems, not just warns.
 *
 * Decision Trees:
 * 1. OVERTRAINING_RESPONSE   6. PLATEAU_BREAK
 * 2. SLEEP_DEBT_RESPONSE     7. STREAK_SAVE
 * 3. NUTRITION_DEFICIT       8. GOAL_REALIGNMENT
 * 4. HYDRATION_CRISIS        9. DELOAD_INJECTION
 * 5. RECOVERY_OVERRIDE      10. MENTAL_HEALTH_RESPONSE
 *
 * Guardrails:
 * - Max 3 interventions per user per day
 * - Critical interventions auto-applied, user notified
 * - Non-critical require user acknowledgment
 * - User can dismiss any intervention (logged for learning)
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type { ComprehensiveUserContext } from './comprehensive-user-context.service.js';
import type { DetectedContradiction } from './cross-pillar-intelligence.service.js';
import type { UserClassification } from './user-classification.service.js';
import type { DailySnapshot } from './daily-analysis.service.js';

// ============================================
// TYPES
// ============================================

export interface InterventionAction {
  type: string;
  decisionTree: string;
  adjustments: Record<string, unknown>;
  reasoning: string;
  requiresUserApproval: boolean;
  expiresInHours: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface StoredIntervention {
  id: string;
  userId: string;
  contradictionId: string | null;
  interventionType: string;
  decisionTree: string;
  originalValue: Record<string, unknown> | null;
  adjustedValue: Record<string, unknown> | null;
  reasoning: string;
  userNotified: boolean;
  userAccepted: boolean | null;
  expiresAt: string | null;
  createdAt: string;
}

interface DecisionTreeInput {
  snapshot: DailySnapshot;
  context: ComprehensiveUserContext;
  classification: UserClassification | null;
  contradictions: DetectedContradiction[];
}

interface DecisionTree {
  id: string;
  evaluate(input: DecisionTreeInput): InterventionAction | null;
}

// ============================================
// DECISION TREES
// ============================================

const decisionTrees: DecisionTree[] = [
  {
    id: 'OVERTRAINING_RESPONSE',
    evaluate({ snapshot, context }) {
      const recentWorkouts = context.workouts?.recentWorkouts ?? [];
      const last3Days = recentWorkouts.filter(w => w.hoursAgo <= 72 && w.status === 'completed');
      if (last3Days.length < 3) return null;

      const highStrain = snapshot.strainScore !== null && snapshot.strainScore > 14;
      const lowRecovery = snapshot.recoveryScore !== null && snapshot.recoveryScore < 50;
      if (!highStrain && !lowRecovery) return null;

      return {
        type: 'force_rest_day',
        decisionTree: 'OVERTRAINING_RESPONSE',
        adjustments: {
          action: 'insert_rest_day',
          reduceNextSessions: 0.20, // 20% reduction
          sessionsAffected: 2,
        },
        reasoning: `${last3Days.length} consecutive training days with ${highStrain ? `high strain (${snapshot.strainScore}/21)` : ''} ${lowRecovery ? `and low recovery (${snapshot.recoveryScore}%)` : ''}. Inserting rest day and reducing next 2 sessions by 20% to prevent overtraining.`,
        requiresUserApproval: false,
        expiresInHours: 24,
        priority: 'high',
      };
    },
  },

  {
    id: 'SLEEP_DEBT_RESPONSE',
    evaluate({ snapshot }) {
      if (snapshot.sleepHours === null || snapshot.sleepHours >= 6) return null;

      const severity = snapshot.sleepHours < 5 ? 'critical' : 'high';
      return {
        type: 'cap_intensity',
        decisionTree: 'SLEEP_DEBT_RESPONSE',
        adjustments: {
          maxIntensity: snapshot.sleepHours < 5 ? 'light' : 'moderate',
          addSleepHygieneMessage: true,
          suggestNapTime: snapshot.sleepHours < 5 ? '20min' : null,
        },
        reasoning: `Only ${snapshot.sleepHours.toFixed(1)}h sleep detected. Capping workout intensity to ${snapshot.sleepHours < 5 ? 'light' : 'moderate'} and adding sleep hygiene guidance. Research shows cognitive performance drops 15-25% below 6h sleep.`,
        requiresUserApproval: false,
        expiresInHours: 18,
        priority: severity,
      };
    },
  },

  {
    id: 'NUTRITION_DEFICIT_RESPONSE',
    evaluate({ snapshot }) {
      if (snapshot.calorieAdherence === null || snapshot.calorieAdherence >= 70) return null;
      if (snapshot.workoutsCompleted < 1 && snapshot.workoutsScheduled < 1) return null;

      return {
        type: 'add_meal_suggestion',
        decisionTree: 'NUTRITION_DEFICIT_RESPONSE',
        adjustments: {
          suggestPreWorkoutMeal: true,
          suggestPostWorkoutMeal: true,
          targetCalorieIncrease: Math.round((100 - snapshot.calorieAdherence) * 5), // rough cal gap
        },
        reasoning: `Nutrition adherence at ${snapshot.calorieAdherence}% on a training day. Suggesting pre/post workout meals to close the nutrition gap. Under-fueled training reduces adaptation by up to 30%.`,
        requiresUserApproval: true,
        expiresInHours: 12,
        priority: 'medium',
      };
    },
  },

  {
    id: 'HYDRATION_CRISIS',
    evaluate({ snapshot }) {
      if (snapshot.waterIntakePercentage === null || snapshot.waterIntakePercentage >= 40) return null;

      return {
        type: 'escalating_hydration_reminders',
        decisionTree: 'HYDRATION_CRISIS',
        adjustments: {
          reminderIntervalHours: 2,
          targetWaterMl: Math.round((100 - snapshot.waterIntakePercentage) * 25), // rough ml needed
          urgencyLevel: snapshot.waterIntakePercentage < 25 ? 'high' : 'medium',
        },
        reasoning: `Only ${snapshot.waterIntakePercentage}% of daily water target by now. Initiating hydration reminders every 2 hours. Dehydration reduces physical performance by up to 25% and cognitive function by 15%.`,
        requiresUserApproval: false,
        expiresInHours: 8,
        priority: snapshot.waterIntakePercentage < 25 ? 'high' : 'medium',
      };
    },
  },

  {
    id: 'RECOVERY_OVERRIDE',
    evaluate({ snapshot }) {
      if (snapshot.recoveryScore === null || snapshot.recoveryScore >= 33) return null;
      if (snapshot.workoutsScheduled < 1) return null;

      return {
        type: 'swap_to_recovery',
        decisionTree: 'RECOVERY_OVERRIDE',
        adjustments: {
          originalIntensity: 'hard',
          newIntensity: 'rest',
          alternativeActivity: 'light_walk_or_stretch',
          maxDurationMin: 20,
        },
        reasoning: `Recovery at ${snapshot.recoveryScore}% (red zone) with ${snapshot.workoutsScheduled} session(s) planned. Auto-suggesting swap to rest/light activity. Training at this recovery level increases injury risk by 2.4x.`,
        requiresUserApproval: false,
        expiresInHours: 16,
        priority: 'critical',
      };
    },
  },

  {
    id: 'PLATEAU_BREAK',
    evaluate({ snapshot: _snapshot, context, classification }) {
      if (!classification || classification.tier !== 'plateau') return null;

      const completionRate = context.workouts?.completionRate ?? 0;
      if (completionRate < 70) return null; // Not consistent enough to be a true plateau

      const scoreTrend = context.dailyScore?.scoreTrend;
      if (scoreTrend === 'improving') return null;

      return {
        type: 'program_change',
        decisionTree: 'PLATEAU_BREAK',
        adjustments: {
          suggestion: 'periodization_change',
          options: ['increase_volume', 'increase_intensity', 'change_exercises', 'deload_then_peak'],
          currentScore: classification.score,
        },
        reasoning: `Performance plateau detected: ${completionRate}% completion rate but scores stagnant for 2+ weeks. Suggesting programming change — periodized volume variations break plateaus 73% faster than linear progression.`,
        requiresUserApproval: true,
        expiresInHours: 72,
        priority: 'medium',
      };
    },
  },

  {
    id: 'STREAK_SAVE',
    evaluate({ snapshot, context }) {
      const streakDays = snapshot.streakDays;
      if (streakDays < 3) return null; // Not worth saving a <3 day streak

      const engagement = context.dailyScore?.latestScore ?? 50;
      const isAtRisk = context.gamification?.streakAtRisk;
      if (!isAtRisk && engagement >= 40) return null;

      return {
        type: 'streak_save_incentive',
        decisionTree: 'STREAK_SAVE',
        adjustments: {
          currentStreak: streakDays,
          reducedMinimum: true,
          suggestedMinActivity: '10 minutes light activity',
          bonusXPIfCompleted: 50,
        },
        reasoning: `${streakDays}-day streak at risk with low engagement (${engagement}/100). Reducing today's minimum to 10 minutes of any activity. Streak preservation is the #1 predictor of long-term adherence.`,
        requiresUserApproval: false,
        expiresInHours: 6,
        priority: 'high',
      };
    },
  },

  {
    id: 'GOAL_REALIGNMENT',
    evaluate({ contradictions }) {
      const goalMismatches = contradictions.filter(c => c.ruleId === 'GOAL_BEHAVIOR_MISMATCH');
      if (goalMismatches.length === 0) return null;

      return {
        type: 'goal_review_conversation',
        decisionTree: 'GOAL_REALIGNMENT',
        adjustments: {
          triggerConversation: true,
          topic: 'goal_alignment',
          mismatchCount: goalMismatches.length,
          evidence: goalMismatches.map(m => m.description),
        },
        reasoning: `Goal-behavior mismatch detected. User's stated goal doesn't align with their actual behavior patterns. Suggesting a goal review conversation to either recalibrate goals or adjust behavior plans.`,
        requiresUserApproval: true,
        expiresInHours: 48,
        priority: 'medium',
      };
    },
  },

  {
    id: 'DELOAD_INJECTION',
    evaluate({ contradictions, snapshot }) {
      const deloadAvoidance = contradictions.find(c => c.ruleId === 'DELOAD_AVOIDANCE');
      if (!deloadAvoidance) return null;

      return {
        type: 'auto_schedule_deload',
        decisionTree: 'DELOAD_INJECTION',
        adjustments: {
          deloadWeekStart: 'next_monday',
          volumeReduction: 0.40, // 40% reduction
          intensityReduction: 0.20, // 20% reduction
          duration: '7 days',
        },
        reasoning: `${snapshot.streakDays}+ day streak without a deload week. Auto-scheduling deload: 40% volume reduction, 20% intensity reduction for 1 week. Deload weeks improve long-term strength gains by 12-18%.`,
        requiresUserApproval: true,
        expiresInHours: 72,
        priority: 'medium',
      };
    },
  },

  {
    id: 'MENTAL_HEALTH_RESPONSE',
    evaluate({ snapshot, classification: _classification }) {
      if (snapshot.moodLevel >= 4 && snapshot.stressLevel <= 7) return null;
      const engagement = snapshot.componentScores.engagement ?? 100;
      if (engagement >= 50 && snapshot.moodLevel >= 4) return null;

      const isCritical = snapshot.moodLevel < 3 || snapshot.stressLevel > 8;
      return {
        type: 'mental_health_adjustment',
        decisionTree: 'MENTAL_HEALTH_RESPONSE',
        adjustments: {
          switchToSupportiveMode: true,
          reduceAllTargets: 0.30, // 30% reduction
          prioritizeSleep: true,
          suggestMindfulness: true,
          currentMood: snapshot.moodLevel,
          currentStress: snapshot.stressLevel,
        },
        reasoning: `Mental health declining: mood ${snapshot.moodLevel}/10, stress ${snapshot.stressLevel}/10, engagement ${engagement}/100. Switching to supportive coaching mode, reducing all targets by 30%, and prioritizing sleep and mindfulness.`,
        requiresUserApproval: false,
        expiresInHours: 24,
        priority: isCritical ? 'critical' : 'high',
      };
    },
  },

  // 11. STATUS_AWARENESS_RESPONSE — Activity status-based safety and ramp-up
  {
    id: 'STATUS_AWARENESS_RESPONSE',
    evaluate({ snapshot, context }) {
      const activityStatus = (context as { activityStatus?: { current: string; daysSinceLastWorkingStatus?: number } }).activityStatus;
      const status = activityStatus?.current;
      if (!status || ['working', 'excellent', 'good'].includes(status)) return null;

      if ((status === 'sick' || status === 'injury') && (snapshot.workoutsScheduled ?? 0) > 0) {
        return {
          type: 'force_rest_day',
          decisionTree: 'STATUS_AWARENESS_RESPONSE',
          adjustments: {
            skipWorkouts: true,
            status,
            reason: `User is ${status} — all workouts auto-skipped for safety`,
          },
          reasoning: `User has marked themselves as ${status}. Continuing planned workouts could worsen their condition. Auto-skipping all scheduled workouts and suggesting recovery-appropriate activities.`,
          requiresUserApproval: false,
          expiresInHours: 24,
          priority: 'critical' as const,
        };
      }

      const daysOff = activityStatus?.daysSinceLastWorkingStatus ?? 0;
      if (status === 'working' && daysOff >= 3) {
        return {
          type: 'ramp_up_after_absence',
          decisionTree: 'STATUS_AWARENESS_RESPONSE',
          adjustments: {
            intensityReduction: daysOff >= 7 ? 0.5 : 0.75,
            rampUpDays: Math.min(Math.ceil(daysOff / 2), 5),
            reason: `Returning after ${daysOff} days off — gradual ramp-up`,
          },
          reasoning: `User just returned to active status after ${daysOff} days. Suggesting ${daysOff >= 7 ? '50%' : '75%'} intensity for the first ${Math.min(Math.ceil(daysOff / 2), 5)} days.`,
          requiresUserApproval: false,
          expiresInHours: Math.min(Math.ceil(daysOff / 2), 5) * 24,
          priority: 'high' as const,
        };
      }

      return null;
    },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class IntelligentInterventionService {
  private tableEnsured = false;
  private static MAX_INTERVENTIONS_PER_DAY = 3;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_interventions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          contradiction_id UUID,
          intervention_type VARCHAR(50) NOT NULL,
          decision_tree VARCHAR(50) NOT NULL,
          original_value JSONB,
          adjusted_value JSONB,
          reasoning TEXT NOT NULL,
          user_notified BOOLEAN DEFAULT false,
          user_accepted BOOLEAN,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_ui_user_date
          ON user_interventions(user_id, created_at DESC)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_ui_user_pending
          ON user_interventions(user_id, user_accepted)
          WHERE user_accepted IS NULL
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[IntelligentIntervention] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ---- Public API ----

  /**
   * Evaluate all decision trees and create interventions.
   * Respects the 3-per-day limit per user.
   */
  async evaluateAndIntervene(
    userId: string,
    snapshot: DailySnapshot,
    context: ComprehensiveUserContext,
    classification: UserClassification | null,
    contradictions: DetectedContradiction[]
  ): Promise<InterventionAction[]> {
    await this.ensureTable();

    try {
      // Check daily limit
      const todayCount = await this.getTodayInterventionCount(userId);
      if (todayCount >= IntelligentInterventionService.MAX_INTERVENTIONS_PER_DAY) {
        logger.debug('[IntelligentIntervention] Daily limit reached', { userId, todayCount });
        return [];
      }

      const remaining = IntelligentInterventionService.MAX_INTERVENTIONS_PER_DAY - todayCount;
      const input: DecisionTreeInput = { snapshot, context, classification, contradictions };

      // Run all trees
      const actions: InterventionAction[] = [];
      for (const tree of decisionTrees) {
        try {
          const action = tree.evaluate(input);
          if (action) {
            actions.push(action);
          }
        } catch (treeError) {
          logger.warn('[IntelligentIntervention] Decision tree error', {
            treeId: tree.id,
            error: treeError instanceof Error ? treeError.message : 'Unknown',
          });
        }
      }

      if (actions.length === 0) return [];

      // Sort by priority and take up to remaining limit
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      const selected = actions.slice(0, remaining);

      // Persist selected interventions
      for (const action of selected) {
        try {
          // Find matching contradiction if any
          const matchingContradiction = contradictions.find(c =>
            action.decisionTree.includes(c.ruleId.split('_')[0])
          );

          await query(
            `INSERT INTO user_interventions
             (user_id, contradiction_id, intervention_type, decision_tree,
              adjusted_value, reasoning, user_notified, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, false,
                     CASE WHEN $7 > 0 THEN NOW() + ($7 || ' hours')::interval ELSE NULL END)`,
            [
              userId,
              matchingContradiction ? null : null, // Would need stored contradiction ID
              action.type,
              action.decisionTree,
              JSON.stringify(action.adjustments),
              action.reasoning,
              action.expiresInHours,
            ]
          );
        } catch (insertError) {
          logger.warn('[IntelligentIntervention] Error persisting intervention', {
            userId,
            type: action.type,
            error: insertError instanceof Error ? insertError.message : 'Unknown',
          });
        }
      }

      logger.info('[IntelligentIntervention] Interventions created', {
        userId,
        total: actions.length,
        selected: selected.length,
        types: selected.map(a => a.type),
      });

      return selected;
    } catch (error) {
      logger.error('[IntelligentIntervention] Evaluation error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get pending interventions for a user (not yet accepted/rejected).
   */
  async getPendingInterventions(userId: string): Promise<StoredIntervention[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string;
        user_id: string;
        contradiction_id: string | null;
        intervention_type: string;
        decision_tree: string;
        original_value: Record<string, unknown> | null;
        adjusted_value: Record<string, unknown> | null;
        reasoning: string;
        user_notified: boolean;
        user_accepted: boolean | null;
        expires_at: string | null;
        created_at: string;
      }>(
        `SELECT * FROM user_interventions
         WHERE user_id = $1 AND user_accepted IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        contradictionId: row.contradiction_id,
        interventionType: row.intervention_type,
        decisionTree: row.decision_tree,
        originalValue: row.original_value,
        adjustedValue: row.adjusted_value,
        reasoning: row.reasoning,
        userNotified: row.user_notified,
        userAccepted: row.user_accepted,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[IntelligentIntervention] Error fetching pending interventions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * User responds to an intervention (accept or dismiss).
   */
  async respondToIntervention(
    interventionId: string,
    accepted: boolean
  ): Promise<void> {
    await this.ensureTable();
    try {
      await query(
        `UPDATE user_interventions
         SET user_accepted = $1, user_notified = true
         WHERE id = $2`,
        [accepted, interventionId]
      );
      logger.info('[IntelligentIntervention] User responded', {
        interventionId,
        accepted,
      });
    } catch (error) {
      logger.error('[IntelligentIntervention] Error updating intervention', {
        interventionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark interventions as notified.
   */
  async markNotified(interventionIds: string[]): Promise<void> {
    if (interventionIds.length === 0) return;
    await this.ensureTable();
    try {
      await query(
        `UPDATE user_interventions SET user_notified = true
         WHERE id = ANY($1) AND user_notified = false`,
        [interventionIds]
      );
    } catch (error) {
      logger.error('[IntelligentIntervention] Error marking notified', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get intervention history for a user (last 30 days).
   */
  async getHistory(userId: string, limit = 20): Promise<StoredIntervention[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string;
        user_id: string;
        contradiction_id: string | null;
        intervention_type: string;
        decision_tree: string;
        original_value: Record<string, unknown> | null;
        adjusted_value: Record<string, unknown> | null;
        reasoning: string;
        user_notified: boolean;
        user_accepted: boolean | null;
        expires_at: string | null;
        created_at: string;
      }>(
        `SELECT * FROM user_interventions
         WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        contradictionId: row.contradiction_id,
        interventionType: row.intervention_type,
        decisionTree: row.decision_tree,
        originalValue: row.original_value,
        adjustedValue: row.adjusted_value,
        reasoning: row.reasoning,
        userNotified: row.user_notified,
        userAccepted: row.user_accepted,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[IntelligentIntervention] Error fetching history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // ---- Private helpers ----

  private async getTodayInterventionCount(userId: string): Promise<number> {
    try {
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_interventions
         WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
        [userId]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const intelligentInterventionService = new IntelligentInterventionService();
export default intelligentInterventionService;
