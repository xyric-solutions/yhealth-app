import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type {
  ActivityStatus,
  PlanStatusOverride,
  WorkoutOverride,
  NutritionOverride,
  GoalOverride,
  RecoveryPlan,
} from '../types/activity-status.types.js';

// Tier 1: Safety-critical → auto-apply
// Tier 2: Lifestyle → suggest, wait for confirmation
// Tier 3: Adjustment → suggest alternatives
const STATUS_OVERRIDE_MAP: Record<string, {
  workoutOverride: WorkoutOverride;
  nutritionOverride: NutritionOverride;
  goalOverride: GoalOverride;
  autoConfirm: boolean;
}> = {
  sick:     { workoutOverride: 'skip_all', nutritionOverride: 'comfort_foods', goalOverride: 'pause_fitness', autoConfirm: true },
  injury:   { workoutOverride: 'skip_all', nutritionOverride: 'anti_inflammatory', goalOverride: 'pause_fitness', autoConfirm: true },
  rest:     { workoutOverride: 'skip_all', nutritionOverride: 'none', goalOverride: 'none', autoConfirm: true },
  travel:   { workoutOverride: 'suggest_alternatives', nutritionOverride: 'flexible', goalOverride: 'extend_deadlines', autoConfirm: false },
  vacation: { workoutOverride: 'optional_only', nutritionOverride: 'flexible', goalOverride: 'extend_deadlines', autoConfirm: false },
  stress:   { workoutOverride: 'suggest_alternatives', nutritionOverride: 'none', goalOverride: 'reduce_intensity', autoConfirm: false },
};

const NO_OVERRIDE: PlanStatusOverride = {
  status: 'working',
  appliedAt: new Date().toISOString(),
  workoutOverride: 'none',
  nutritionOverride: 'none',
  goalOverride: 'none',
  userConfirmed: true,
};

class StatusPlanAdjusterService {
  getOverridesForStatus(status: ActivityStatus, expiresAt?: string): PlanStatusOverride {
    const mapping = STATUS_OVERRIDE_MAP[status];
    if (!mapping) return { ...NO_OVERRIDE, status };

    return {
      status,
      appliedAt: new Date().toISOString(),
      expiresAt,
      workoutOverride: mapping.workoutOverride,
      nutritionOverride: mapping.nutritionOverride,
      goalOverride: mapping.goalOverride,
      userConfirmed: mapping.autoConfirm,
    };
  }

  async applyOverridesToPlan(userId: string, status: ActivityStatus, expiresAt?: string): Promise<void> {
    const override = this.getOverridesForStatus(status, expiresAt);

    const planResult = await query<{ id: string }>(
      `SELECT id FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      logger.info('[StatusPlanAdjuster] No active plan to adjust', { userId, status });
      return;
    }

    const planId = planResult.rows[0]!.id;

    await query(
      `UPDATE user_plans SET status_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(override), planId]
    );

    logger.info('[StatusPlanAdjuster] Applied plan overrides', { userId, status, planId, override: override.workoutOverride });
  }

  async clearOverrides(userId: string): Promise<void> {
    await query(
      `UPDATE user_plans SET status_overrides = NULL, updated_at = NOW() WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    logger.info('[StatusPlanAdjuster] Cleared plan overrides', { userId });
  }

  async getActiveOverrides(userId: string): Promise<PlanStatusOverride | null> {
    const result = await query<{ status_overrides: PlanStatusOverride | null }>(
      `SELECT status_overrides FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    return result.rows[0]?.status_overrides ?? null;
  }

  isAutoConfirmStatus(status: ActivityStatus): boolean {
    return STATUS_OVERRIDE_MAP[status]?.autoConfirm ?? false;
  }

  /**
   * Apply overrides WITH generated alternative content (workouts, meals).
   * Called when status-plan-generator is available.
   */
  async applyEnhancedOverrides(
    userId: string,
    status: ActivityStatus,
    alternatives: {
      alternativeWorkouts?: PlanStatusOverride['alternativeWorkouts'];
      mealSuggestions?: PlanStatusOverride['mealSuggestions'];
    },
    expiresAt?: string,
  ): Promise<void> {
    const override = this.getOverridesForStatus(status, expiresAt);
    override.alternativeWorkouts = alternatives.alternativeWorkouts;
    override.mealSuggestions = alternatives.mealSuggestions;

    const planResult = await query<{ id: string }>(
      `SELECT id FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (planResult.rows.length === 0) return;

    await query(
      `UPDATE user_plans SET status_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(override), planResult.rows[0]!.id]
    );

    logger.info('[StatusPlanAdjuster] Applied enhanced overrides with alternatives', {
      userId, status, workouts: alternatives.alternativeWorkouts?.length ?? 0, meals: alternatives.mealSuggestions?.length ?? 0,
    });
  }

  /**
   * Apply a gradual recovery plan when user returns to 'working' status.
   */
  async applyRecoveryPlan(userId: string, recoveryPlan: RecoveryPlan[]): Promise<void> {
    const planResult = await query<{ id: string; status_overrides: PlanStatusOverride | null }>(
      `SELECT id, status_overrides FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (planResult.rows.length === 0) return;

    const existing = planResult.rows[0]!.status_overrides ?? {
      status: 'working' as ActivityStatus,
      appliedAt: new Date().toISOString(),
      workoutOverride: 'none' as WorkoutOverride,
      nutritionOverride: 'none' as NutritionOverride,
      goalOverride: 'none' as GoalOverride,
      userConfirmed: true,
    };

    const updated = { ...existing, recoveryPlan };

    await query(
      `UPDATE user_plans SET status_overrides = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updated), planResult.rows[0]!.id]
    );

    logger.info('[StatusPlanAdjuster] Applied recovery plan', { userId, days: recoveryPlan.length });
  }

  /**
   * Extend goal deadlines by the number of days spent in a non-working status.
   */
  async extendGoalDeadlines(userId: string, daysToExtend: number): Promise<number> {
    if (daysToExtend <= 0) return 0;

    const result = await query<{ id: string }>(
      `UPDATE user_goals
       SET target_date = target_date + ($2 || ' days')::INTERVAL,
           updated_at = NOW()
       WHERE user_id = $1
         AND status IN ('active', 'in_progress')
         AND target_date IS NOT NULL
       RETURNING id`,
      [userId, daysToExtend]
    );

    const count = result.rows.length;
    if (count > 0) {
      logger.info('[StatusPlanAdjuster] Extended goal deadlines', { userId, daysToExtend, goalsUpdated: count });
    }
    return count;
  }
}

export const statusPlanAdjusterService = new StatusPlanAdjusterService();
