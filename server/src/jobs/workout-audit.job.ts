/**
 * @file Workout Audit Job
 * Daily background job that audits workout progress and triggers rescheduling
 */

import { workoutAuditService } from '../services/workout-audit.service.js';
import { workoutRescheduleWorkflowService } from '../services/workout-reschedule-workflow.service.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const AUDIT_HOUR = 6; // Run audit at 6 AM
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process workout audit for all active plans
 */
async function processWorkoutAudit(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const now = new Date();
    const currentHour = now.getHours();

    // Only run audit at specified hour (e.g., 6 AM)
    if (currentHour !== AUDIT_HOUR) {
      return;
    }

    logger.info('[WorkoutAuditJob] Starting daily workout audit', {
      timestamp: now.toISOString(),
    });

    // Get all active workout plans
    const plansResult = await query<{
      id: string;
      user_id: string;
      plan_id: string | null;
      auto_reschedule_enabled: boolean;
    }>(
      `SELECT wp.id, wp.user_id, wp.plan_id, COALESCE(up.auto_reschedule_enabled, true) as auto_reschedule_enabled
       FROM workout_plans wp
       LEFT JOIN user_plans up ON wp.plan_id = up.id
       WHERE wp.status = 'active'
       AND (up.auto_reschedule_enabled IS NULL OR up.auto_reschedule_enabled = true)`,
      []
    );

    const plans = plansResult.rows;
    let totalAudited = 0;
    let totalRescheduled = 0;

    for (const plan of plans) {
      try {
        // Audit daily progress for this user
        const auditResult = await workoutAuditService.auditDailyProgress(plan.user_id, now);

        if (auditResult.tasksMarkedMissed > 0) {
          logger.info('[WorkoutAuditJob] Found missed tasks', {
            userId: plan.user_id,
            workoutPlanId: plan.id,
            missedCount: auditResult.tasksMarkedMissed,
          });

          // Update last audit date
          if (plan.plan_id) {
            await workoutAuditService.updateLastAuditDate(plan.plan_id, now);
          }

          // Trigger reschedule workflow if auto-reschedule is enabled
          if (plan.auto_reschedule_enabled) {
            try {
              // Get plan policy
              const policyResult = await query<{ plan_policy: string }>(
                `SELECT COALESCE(plan_policy, 'FILL_GAPS') as plan_policy
                 FROM user_plans
                 WHERE id = $1`,
                [plan.plan_id || plan.id]
              );

              const policy = (policyResult.rows[0]?.plan_policy || 'FILL_GAPS') as 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS';

              const rescheduleResult = await workoutRescheduleWorkflowService.executeRescheduleWorkflow(
                plan.user_id,
                plan.id,
                policy,
                'auto'
              );

              if (rescheduleResult.success) {
                totalRescheduled++;
                logger.info('[WorkoutAuditJob] Successfully rescheduled workouts', {
                  userId: plan.user_id,
                  workoutPlanId: plan.id,
                  actionsCount: rescheduleResult.actions.length,
                });
              } else {
                logger.warn('[WorkoutAuditJob] Reschedule failed', {
                  userId: plan.user_id,
                  workoutPlanId: plan.id,
                  errors: rescheduleResult.validationErrors,
                });
              }
            } catch (rescheduleError) {
              logger.error('[WorkoutAuditJob] Reschedule workflow error', {
                userId: plan.user_id,
                workoutPlanId: plan.id,
                error: rescheduleError instanceof Error ? rescheduleError.message : 'Unknown error',
              });
            }
          }
        }

        totalAudited++;
      } catch (error) {
        logger.error('[WorkoutAuditJob] Error processing plan', {
          planId: plan.id,
          userId: plan.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other plans
      }
    }

    logger.info('[WorkoutAuditJob] Daily audit completed', {
      plansAudited: totalAudited,
      plansRescheduled: totalRescheduled,
    });
  } catch (error) {
    logger.error('[WorkoutAuditJob] Fatal error in workout audit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB CONTROL
// ============================================

export const workoutAuditJob = {
  /**
   * Start the workout audit job
   */
  start(): void {
    if (intervalId) {
      logger.warn('[WorkoutAuditJob] Job already running');
      return;
    }

    logger.info('[WorkoutAuditJob] Starting workout audit job', {
      intervalMs: JOB_INTERVAL_MS,
      auditHour: AUDIT_HOUR,
    });

    // Run immediately on start (for testing/development)
    processWorkoutAudit().catch((error) => {
      logger.error('[WorkoutAuditJob] Error in initial audit run', { error });
    });

    // Then run on interval
    intervalId = setInterval(() => {
      processWorkoutAudit().catch((error) => {
        logger.error('[WorkoutAuditJob] Error in scheduled audit run', { error });
      });
    }, JOB_INTERVAL_MS);
  },

  /**
   * Stop the workout audit job
   */
  stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info('[WorkoutAuditJob] Stopped workout audit job');
    }
  },

  /**
   * Manually trigger audit (for testing/admin)
   */
  async triggerManual(): Promise<void> {
    logger.info('[WorkoutAuditJob] Manual trigger requested');
    await processWorkoutAudit();
  },
};

