/**
 * @file Workout Reschedule Routes
 * API endpoints for workout rescheduling functionality
 */

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { workoutAuditService } from '../services/workout-audit.service.js';
import { workoutRescheduleWorkflowService } from '../services/workout-reschedule-workflow.service.js';
import { workoutConstraintService } from '../services/workout-constraint.service.js';
import { query } from '../database/pg.js';
// import { workoutAuditJob } from '../jobs/workout-audit.job.js'; // TODO: Use for manual audit trigger
import { logger } from '../services/logger.service.js';

const router = Router();

/**
 * POST /api/workouts/reschedule/audit
 * Manually trigger workout audit
 */
router.post(
  '/audit',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;

    const result = await workoutAuditService.auditDailyProgress(userId);

    ApiResponse.success(res, {
      tasksChecked: result.tasksChecked,
      tasksMarkedMissed: result.tasksMarkedMissed,
      missedTasks: result.missedTasks,
    }, 'Audit completed successfully');
  })
);

/**
 * POST /api/workouts/reschedule/auto
 * Trigger auto-reschedule for a workout plan
 */
router.post(
  '/auto',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const { workoutPlanId, policy } = req.body as {
      workoutPlanId: string;
      policy?: 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS';
    };

    if (!workoutPlanId) {
      throw ApiError.badRequest('workoutPlanId is required');
    }

    // Verify plan belongs to user
    const planResult = await query<{ id: string }>(
      `SELECT id FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [workoutPlanId, userId]
    );

    if (planResult.rows.length === 0) {
      throw ApiError.notFound('Workout plan not found');
    }

    const result = await workoutRescheduleWorkflowService.executeRescheduleWorkflow(
      userId,
      workoutPlanId,
      policy || 'FILL_GAPS',
      'manual'
    );

    if (result.success) {
      ApiResponse.success(res, {
        actions: result.actions,
        summary: result.summary,
        historyId: result.historyId,
      }, 'Workouts rescheduled successfully');
    } else {
      // Convert validationErrors (string[]) to AppErrorDetails format
      const details = result.validationErrors ? result.validationErrors.map((message: string) => ({
        code: 'VALIDATION_ERROR',
        message,
      })) : undefined;
      throw ApiError.badRequest(result.summary, details);
    }
  })
);

/**
 * GET /api/workouts/reschedule/history
 * Get reschedule history for user
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const { workoutPlanId, limit = 20 } = req.query;

    let queryText = `SELECT * FROM plan_reschedule_history
                     WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (workoutPlanId) {
      queryText += ' AND workout_plan_id = $2';
      params.push(workoutPlanId as string);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(Number(limit));

    const result = await query<{
      id: string;
      user_id: string;
      workout_plan_id: string;
      reschedule_type: string;
      policy_used: string;
      missed_tasks: unknown[];
      reschedule_actions: Array<{ action: string; taskId?: string; task_id?: string; oldDate?: string; old_date?: string; newDate?: string; new_date?: string; reason?: string }>;
      user_summary: string | null;
      applied: boolean;
      created_at: string;
    }>(queryText, params);

    // Transform DB rows to client-expected camelCase format
    const history = result.rows.map((row) => {
      const actions = Array.isArray(row.reschedule_actions) ? row.reschedule_actions : [];
      const moveActions = actions.filter((a) => a.action === 'move');
      const dropActions = actions.filter((a) => a.action === 'drop' || a.action === 'compress');

      return {
        id: row.id,
        userId: row.user_id,
        workoutPlanId: row.workout_plan_id,
        rescheduleDate: row.created_at,
        reason: `${row.reschedule_type} reschedule — ${actions.length} action(s)`,
        policyApplied: row.policy_used,
        changes: {
          tasksRescheduled: moveActions.length,
          tasksDropped: dropActions.length,
          newSchedule: moveActions.map((a) => ({
            taskId: a.taskId || a.task_id || '',
            oldDate: a.oldDate || a.old_date || '',
            newDate: a.newDate || a.new_date || '',
          })),
        },
        aiSummary: row.user_summary || null,
        aiFeedback: null,
        createdAt: row.created_at,
      };
    });

    ApiResponse.success(res, {
      history,
    });
  })
);

/**
 * GET /api/workouts/constraints
 * Get user workout constraints
 */
router.get(
  '/constraints',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;

    const constraints = await workoutConstraintService.getUserConstraints(userId);

    ApiResponse.success(res, {
      constraints,
    });
  })
);

/**
 * PUT /api/workouts/constraints
 * Update user workout constraints
 */
router.put(
  '/constraints',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const updates = req.body as Partial<{
      maxSessionsPerWeek: number;
      maxHardSessionsPerWeek: number;
      maxSessionsPerDay: number;
      availableDays: string[];
      restDays: string[];
      minRestHoursBetweenSessions: number;
      minRestHoursAfterHeavyLeg: number;
      preferredWorkoutTimes: Record<string, string[]>;
      muscleGroupRecoveryHours: Record<string, number>;
      avoidConsecutiveDays: boolean;
      maxWeeklyVolume: number;
    }>;

    const constraints = await workoutConstraintService.updateUserConstraints(userId, updates);

    ApiResponse.success(res, {
      constraints,
    }, 'Constraints updated successfully');
  })
);

/**
 * GET /api/workouts/reschedule/scheduled-tasks
 * Get all scheduled tasks for user (pending, completed, missed, etc.)
 */
router.get(
  '/scheduled-tasks',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const { workoutPlanId, status, limit = 50 } = req.query;

    // Auto-populate: check if user has active plans with no schedule tasks
    const activePlansWithoutTasks = await query<{ id: string }>(
      `SELECT wp.id FROM workout_plans wp
       WHERE wp.user_id = $1 AND wp.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM workout_schedule_tasks wst WHERE wst.workout_plan_id = wp.id
       )`,
      [userId]
    );

    if (activePlansWithoutTasks.rows.length > 0) {
      for (const plan of activePlansWithoutTasks.rows) {
        try {
          await workoutAuditService.populateScheduleTasksFromPlan(plan.id);
          logger.info('[ScheduledTasks] Auto-populated tasks for plan', {
            userId, planId: plan.id,
          });
        } catch (err) {
          logger.warn('[ScheduledTasks] Failed to auto-populate tasks', {
            userId, planId: plan.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      // Run audit to mark past-due tasks as missed
      try {
        await workoutAuditService.auditDailyProgress(userId);
      } catch (err) {
        logger.warn('[ScheduledTasks] Audit after auto-populate failed', {
          userId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    let queryText = `SELECT wst.*, wp.name as plan_name
                     FROM workout_schedule_tasks wst
                     LEFT JOIN workout_plans wp ON wst.workout_plan_id = wp.id
                     WHERE wst.user_id = $1`;
    const params: (string | number)[] = [userId];

    if (workoutPlanId) {
      queryText += ` AND wst.workout_plan_id = $${params.length + 1}`;
      params.push(workoutPlanId as string);
    }

    if (status) {
      queryText += ` AND wst.status = $${params.length + 1}`;
      params.push(status as string);
    }

    queryText += ` ORDER BY wst.scheduled_date ASC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const result = await query<{
      id: string;
      user_id: string;
      workout_plan_id: string;
      scheduled_date: string;
      workout_data: Record<string, unknown>;
      status: string;
      intensity: string;
      muscle_groups: string[];
      estimated_duration_minutes: number | null;
      original_scheduled_date: string | null;
      reschedule_count: number;
      workout_log_id: string | null;
      plan_name: string | null;
    }>(queryText, params);

    const tasks = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      workoutPlanId: row.workout_plan_id,
      taskId: row.id,
      name: row.plan_name || (row.workout_data as Record<string, unknown>)?.name as string || 'Workout',
      scheduledDate: row.scheduled_date,
      originalScheduledDate: row.original_scheduled_date,
      intensity: row.intensity || 'medium',
      muscleGroups: row.muscle_groups || [],
      status: row.status,
      rescheduleCount: row.reschedule_count || 0,
      workoutLogId: row.workout_log_id,
      estimatedDurationMinutes: row.estimated_duration_minutes,
    }));

    ApiResponse.success(res, {
      tasks,
      count: tasks.length,
    });
  })
);

/**
 * GET /api/workouts/reschedule/missed-tasks
 * Get current missed tasks for user
 */
router.get(
  '/missed-tasks',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const { workoutPlanId } = req.query;

    const missedTasks = await workoutAuditService.getMissedTasks(
      userId,
      workoutPlanId as string | undefined
    );

    ApiResponse.success(res, {
      missedTasks,
      count: missedTasks.length,
    });
  })
);

/**
 * POST /api/workouts/reschedule/auto-check
 * Automatically audit and reschedule missed workouts on app open
 * This runs silently in the background when user opens the app
 */
router.post(
  '/auto-check',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.userId;
    const startTime = Date.now();

    logger.info('[WorkoutReschedule] Auto-check triggered', {
      userId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 0: Ensure schedule tasks are populated for all active plans
      const activePlansResult = await query<{ id: string }>(
        `SELECT id FROM workout_plans
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      logger.debug('[WorkoutReschedule] Found active plans', {
        userId,
        planCount: activePlansResult.rows.length,
      });

      let _tasksPopulated = 0;
      for (const plan of activePlansResult.rows) {
        try {
          // Check if tasks exist for this plan
          const tasksCheck = await query<{ count: string }>(
            `SELECT COUNT(*) as count FROM workout_schedule_tasks
             WHERE workout_plan_id = $1`,
            [plan.id]
          );

          const taskCount = parseInt(tasksCheck.rows[0]?.count || '0', 10);
          
          // If no tasks exist, populate them
          if (taskCount === 0) {
            const populated = await workoutAuditService.populateScheduleTasksFromPlan(plan.id);
            _tasksPopulated += populated;
            logger.info('[WorkoutReschedule] Populated schedule tasks for plan', {
              userId,
              workoutPlanId: plan.id,
              tasksCreated: populated,
            });
          }
        } catch (populateError) {
          // Log but continue - don't fail the whole request
          logger.warn('[WorkoutReschedule] Failed to populate tasks for plan', {
            userId,
            workoutPlanId: plan.id,
            error: populateError instanceof Error ? populateError.message : 'Unknown error',
          });
        }
      }

      // Step 1: Audit all previous days for missed workouts
      logger.debug('[WorkoutReschedule] Starting daily progress audit', { userId });
      const auditResult = await workoutAuditService.auditDailyProgress(userId);
      
      logger.info('[WorkoutReschedule] Audit completed', {
        userId,
        tasksChecked: auditResult.tasksChecked,
        tasksMarkedMissed: auditResult.tasksMarkedMissed,
      });

      if (auditResult.tasksMarkedMissed === 0) {
        // No missed tasks, return early
        const duration = Date.now() - startTime;
        logger.info('[WorkoutReschedule] Auto-check completed - no missed tasks', {
          userId,
          durationMs: duration,
        });
        
        ApiResponse.success(res, {
          audited: true,
          missedTasks: 0,
          rescheduled: false,
          message: 'No missed workouts found',
        });
        return;
      }

      // Step 2: Get all active workout plans for this user
      const plansResult = await query<{
        id: string;
        plan_id: string | null;
        auto_reschedule_enabled: boolean;
      }>(
        `SELECT wp.id, wp.plan_id, COALESCE(up.auto_reschedule_enabled, true) as auto_reschedule_enabled
         FROM workout_plans wp
         LEFT JOIN user_plans up ON wp.plan_id = up.id
         WHERE wp.user_id = $1
         AND wp.status = 'active'
         AND (up.auto_reschedule_enabled IS NULL OR up.auto_reschedule_enabled = true)`,
        [userId]
      );

      const plans = plansResult.rows;
      logger.debug('[WorkoutReschedule] Processing plans for rescheduling', {
        userId,
        planCount: plans.length,
        missedTasksCount: auditResult.tasksMarkedMissed,
      });

      const rescheduleResults: Array<{
        workoutPlanId: string;
        success: boolean;
        actionsCount: number;
        summary?: string;
      }> = [];

      // Step 3: Auto-reschedule for each active plan with missed tasks
      for (const plan of plans) {
        // Check if this plan has missed tasks
        const planMissedTasks = auditResult.missedTasks.filter(
          (task) => task.workoutPlanId === plan.id
        );

        if (planMissedTasks.length === 0) {
          continue; // Skip plans with no missed tasks
        }

        logger.info('[WorkoutReschedule] Rescheduling plan with missed tasks', {
          userId,
          workoutPlanId: plan.id,
          missedTasksCount: planMissedTasks.length,
        });

        try {
          // Get plan policy
          const policyResult = await query<{ plan_policy: string }>(
            `SELECT COALESCE(plan_policy, 'FILL_GAPS') as plan_policy
             FROM user_plans
             WHERE id = $1`,
            [plan.plan_id || plan.id]
          );

          const policy = (policyResult.rows[0]?.plan_policy || 'FILL_GAPS') as
            | 'SLIDE_FORWARD'
            | 'FILL_GAPS'
            | 'DROP_OR_COMPRESS';

          logger.debug('[WorkoutReschedule] Executing reschedule workflow', {
            userId,
            workoutPlanId: plan.id,
            policy,
          });

          // Execute reschedule workflow
          const rescheduleResult = await workoutRescheduleWorkflowService.executeRescheduleWorkflow(
            userId,
            plan.id,
            policy,
            'auto'
          );

          rescheduleResults.push({
            workoutPlanId: plan.id,
            success: rescheduleResult.success,
            actionsCount: rescheduleResult.actions.length,
            summary: rescheduleResult.summary,
          });

          logger.info('[WorkoutReschedule] Reschedule workflow completed', {
            userId,
            workoutPlanId: plan.id,
            success: rescheduleResult.success,
            actionsCount: rescheduleResult.actions.length,
          });

          // Update last audit date
          if (plan.plan_id) {
            await workoutAuditService.updateLastAuditDate(plan.plan_id, new Date());
          }
        } catch (error) {
          logger.error('[WorkoutReschedule] Auto-check reschedule error', {
            userId,
            workoutPlanId: plan.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });

          rescheduleResults.push({
            workoutPlanId: plan.id,
            success: false,
            actionsCount: 0,
          });
        }
      }

      const totalRescheduled = rescheduleResults.filter((r) => r.success).length;
      const totalActions = rescheduleResults.reduce((sum, r) => sum + r.actionsCount, 0);
      const duration = Date.now() - startTime;

      logger.info('[WorkoutReschedule] Auto-check completed', {
        userId,
        durationMs: duration,
        tasksChecked: auditResult.tasksChecked,
        tasksMarkedMissed: auditResult.tasksMarkedMissed,
        plansProcessed: plans.length,
        plansRescheduled: totalRescheduled,
        totalActions,
      });

      ApiResponse.success(res, {
        audited: true,
        missedTasks: auditResult.tasksMarkedMissed,
        rescheduled: totalRescheduled > 0,
        plansProcessed: plans.length,
        plansRescheduled: totalRescheduled,
        totalActions,
        results: rescheduleResults,
        message:
          totalRescheduled > 0
            ? `Automatically rescheduled ${totalActions} workout(s) across ${totalRescheduled} plan(s)`
            : `Found ${auditResult.tasksMarkedMissed} missed workout(s) but rescheduling was not needed or failed`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[WorkoutReschedule] Auto-check error', {
        userId,
        durationMs: duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Don't fail the request - just return that audit completed but reschedule may have failed
      // Only send response if headers haven't been sent yet
      if (!res.headersSent) {
        ApiResponse.success(res, {
          audited: true,
          missedTasks: 0,
          rescheduled: false,
          message: 'Audit completed but rescheduling encountered an error',
        });
      }
    }
  })
);

export default router;

