/**
 * @file Workout Reschedule Workflow Service
 * LangGraph workflow for rescheduling missed workout tasks
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { query, transaction } from '../database/pg.js';
import type { PoolClient } from 'pg';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import { workoutAuditService, type MissedTask } from './workout-audit.service.js';
import { workoutConstraintService, type UserConstraints, type RescheduleProposal, type RescheduleAction } from './workout-constraint.service.js';
import { workoutSlotCalculatorService, type ValidSlot } from './workout-slot-calculator.service.js';

// ============================================
// TYPES
// ============================================

export interface RescheduleContext {
  userId: string;
  planId: string;
  workoutPlanId: string;
  policy: 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS';
  missedTasks: MissedTask[];
  constraints: UserConstraints;
  validSlots: ValidSlot[];
  existingTasks: Array<{ date: Date; intensity: string; muscleGroups: string[] }>;
}

export interface RescheduleResult {
  success: boolean;
  actions: RescheduleAction[];
  summary: string;
  validationErrors?: string[];
  historyId?: string;
}

// ============================================
// SERVICE
// ============================================

class WorkoutRescheduleWorkflowService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      temperature: 0.7,
      maxTokens: 1000,
    });
  }

  /**
   * Main workflow entry point
   */
  async executeRescheduleWorkflow(
    userId: string,
    workoutPlanId: string,
    policy: 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS',
    rescheduleType: 'auto' | 'conversation' | 'manual' = 'auto'
  ): Promise<RescheduleResult> {
    try {
      // Step 1: Load context
      const context = await this.loadContext(userId, workoutPlanId, policy);

      if (context.missedTasks.length === 0) {
        return {
          success: true,
          actions: [],
          summary: 'No missed tasks to reschedule.',
        };
      }

      // Step 2: Compute valid slots (pure code)
      context.validSlots = await workoutSlotCalculatorService.computeValidSlots(
        {
          id: workoutPlanId,
          userId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        context.constraints,
        context.missedTasks,
        14
      );

      // Step 3: Propose reschedule (LLM) - with validation loop
      let proposal: RescheduleProposal | null = null;
      let validationErrors: string[] = [];
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        proposal = await this.proposeReschedule(context, attempt > 1 ? validationErrors : undefined);

      // Step 4: Validate proposal (pure code)
      // Build task data map for validation
      const taskDataMap = new Map<string, { intensity: string; muscleGroups: string[] }>();
      for (const missedTask of context.missedTasks) {
        taskDataMap.set(missedTask.taskId, {
          intensity: missedTask.intensity,
          muscleGroups: missedTask.muscleGroups,
        });
      }

      const errors = await workoutConstraintService.validateConstraints(
        proposal,
        context.constraints,
        context.existingTasks,
        context.validSlots,
        taskDataMap
      );

        if (errors.length === 0) {
          break; // Valid proposal
        }

        validationErrors = errors.map((e) => e.message);
        logger.warn('[WorkoutReschedule] Validation failed, retrying', {
          attempt,
          errors: validationErrors,
        });

        if (attempt === maxAttempts) {
          return {
            success: false,
            actions: proposal.actions,
            summary: 'Failed to generate valid reschedule proposal after multiple attempts.',
            validationErrors,
          };
        }
      }

      if (!proposal) {
        return {
          success: false,
          actions: [],
          summary: 'Failed to generate reschedule proposal.',
        };
      }

      // Step 5: Apply changes (DB transaction)
      const historyId = await this.applyChanges(userId, workoutPlanId, proposal, rescheduleType, policy, context.missedTasks, context.validSlots, validationErrors);

      // Step 6: Summarize to user (LLM)
      const summary = await this.summarizeToUser(context, proposal, historyId);

      return {
        success: true,
        actions: proposal.actions,
        summary,
        historyId,
      };
    } catch (error) {
      logger.error('[WorkoutReschedule] Workflow failed', {
        userId,
        workoutPlanId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Step 1: Load context
   */
  private async loadContext(
    userId: string,
    workoutPlanId: string,
    policy: 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS'
  ): Promise<RescheduleContext> {
    // Get plan info
    const planResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM workout_plans WHERE id = $1`,
      [workoutPlanId]
    );

    if (planResult.rows.length === 0) {
      throw new Error('Workout plan not found');
    }

    const planId = planResult.rows[0].id;

    // Get missed tasks
    const missedTasks = await workoutAuditService.getMissedTasks(userId, workoutPlanId);

    // Get constraints
    const constraints = await workoutConstraintService.getUserConstraints(userId);

    // Get existing tasks
    const existingTasksResult = await query<{
      scheduled_date: Date;
      intensity: string;
      muscle_groups: string[];
    }>(
      `SELECT scheduled_date, intensity, muscle_groups
       FROM workout_schedule_tasks
       WHERE user_id = $1
       AND workout_plan_id = $2
       AND scheduled_date >= CURRENT_DATE
       AND status IN ('pending', 'completed', 'partial')
       ORDER BY scheduled_date ASC`,
      [userId, workoutPlanId]
    );

    const existingTasks = existingTasksResult.rows.map((t) => ({
      date: t.scheduled_date,
      intensity: t.intensity,
      muscleGroups: t.muscle_groups,
    }));

    return {
      userId,
      planId,
      workoutPlanId,
      policy,
      missedTasks,
      constraints,
      validSlots: [],
      existingTasks,
    };
  }

  /**
   * Step 3: Propose reschedule (LLM)
   */
  private async proposeReschedule(
    context: RescheduleContext,
    previousErrors?: string[]
  ): Promise<RescheduleProposal> {
    const availableSlots = context.validSlots
      .filter((s) => s.available)
      .map((s) => ({
        date: s.date.toISOString().split('T')[0],
        reason: s.reason,
      }));

    const missedTasksSummary = context.missedTasks.map((t) => ({
      taskId: t.taskId,
      scheduledDate: typeof t.scheduledDate === 'string'
        ? t.scheduledDate
        : t.scheduledDate.toISOString().split('T')[0],
      intensity: t.intensity,
      muscleGroups: t.muscleGroups,
      daysMissed: t.daysMissed,
    }));

    const prompt = `You are a workout coach scheduler. Reschedule missed workout tasks according to the policy.

Policy: ${context.policy}
- SLIDE_FORWARD: Shift missed tasks forward, pushing the plan forward
- FILL_GAPS: Insert missed tasks into empty future slots, keeping existing tasks
- DROP_OR_COMPRESS: Drop accessories first when too many misses, compress schedule

Missed Tasks:
${JSON.stringify(missedTasksSummary, null, 2)}

Available Slots (you can ONLY choose from these):
${JSON.stringify(availableSlots, null, 2)}

Constraints:
- Max sessions per week: ${context.constraints.maxSessionsPerWeek}
- Max hard sessions per week: ${context.constraints.maxHardSessionsPerWeek}
- Max sessions per day: ${context.constraints.maxSessionsPerDay}
- Available days: ${context.constraints.availableDays.join(', ')}
- Rest days: ${context.constraints.restDays.join(', ')}

${previousErrors ? `Previous validation errors:\n${previousErrors.join('\n')}\n\nPlease fix these issues.` : ''}

Return a JSON object with this exact structure:
{
  "actions": [
    {
      "action": "move" | "drop" | "compress",
      "taskId": "task-id",
      "oldDate": "YYYY-MM-DD",
      "newDate": "YYYY-MM-DD" (only if action is "move"),
      "reason": "brief reason"
    }
  ]
}

Rules:
- You can ONLY use dates from availableSlots
- For SLIDE_FORWARD: Move tasks to earliest available slots
- For FILL_GAPS: Fill empty slots first, then slide if needed
- For DROP_OR_COMPRESS: Drop low-priority tasks or compress schedule
- Respect all constraints
- Return valid JSON only, no markdown`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      // Parse JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
      }

      const parsed = JSON.parse(jsonStr) as { actions: RescheduleAction[] };

      return {
        actions: parsed.actions.map((a) => ({
          ...a,
          oldDate: new Date(a.oldDate),
          newDate: a.newDate ? new Date(a.newDate) : undefined,
        })),
        policy: context.policy,
      };
    } catch (error) {
      logger.error('[WorkoutReschedule] Failed to propose reschedule', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback: simple forward shift
      return this.createFallbackProposal(context);
    }
  }

  /**
   * Fallback proposal (simple forward shift)
   */
  private createFallbackProposal(context: RescheduleContext): RescheduleProposal {
    const availableSlots = context.validSlots.filter((s) => s.available);
    const actions: RescheduleAction[] = [];

    for (let i = 0; i < context.missedTasks.length && i < availableSlots.length; i++) {
      const missedDate = context.missedTasks[i].scheduledDate;
      actions.push({
        action: 'move',
        taskId: context.missedTasks[i].taskId,
        oldDate: typeof missedDate === 'string' ? new Date(missedDate) : missedDate,
        newDate: availableSlots[i].date,
        reason: 'Automatic forward shift to next available slot',
      });
    }

    return {
      actions,
      policy: context.policy,
    };
  }

  /**
   * Step 5: Apply changes (DB transaction)
   */
  private async applyChanges(
    userId: string,
    workoutPlanId: string,
    proposal: RescheduleProposal,
    rescheduleType: string,
    policy: string,
    missedTasks: MissedTask[],
    validSlots: ValidSlot[],
    validationErrors: string[]
  ): Promise<string> {
    return await transaction(async (client: PoolClient) => {
      // Apply each action
      for (const action of proposal.actions) {
        if (action.action === 'move' && action.newDate) {
          await client.query(
            `UPDATE workout_schedule_tasks
             SET scheduled_date = $1,
                 original_scheduled_date = COALESCE(original_scheduled_date, scheduled_date),
                 reschedule_count = reschedule_count + 1,
                 last_rescheduled_at = CURRENT_TIMESTAMP,
                 status = 'pending',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [action.newDate, action.taskId]
          );
        } else if (action.action === 'drop') {
          await client.query(
            `UPDATE workout_schedule_tasks
             SET status = 'skipped',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [action.taskId]
          );
        }
      }

      // Create history record
      const historyResult = await client.query<{ id: string }>(
        `INSERT INTO plan_reschedule_history (
          user_id, workout_plan_id, reschedule_type, policy_used,
          missed_tasks, valid_slots, reschedule_actions, validation_errors,
          applied, applied_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          userId,
          workoutPlanId,
          rescheduleType,
          policy,
          JSON.stringify(missedTasks),
          JSON.stringify(validSlots),
          JSON.stringify(proposal.actions),
          JSON.stringify(validationErrors),
          true,
        ]
      );

      return historyResult.rows[0].id;
    });
  }

  /**
   * Step 6: Summarize to user (LLM)
   */
  private async summarizeToUser(
    context: RescheduleContext,
    proposal: RescheduleProposal,
    historyId: string
  ): Promise<string> {
    const actionsSummary = proposal.actions.map((a) => {
      if (a.action === 'move' && a.newDate) {
        return `Moved workout from ${a.oldDate.toISOString().split('T')[0]} to ${a.newDate.toISOString().split('T')[0]}: ${a.reason}`;
      } else if (a.action === 'drop') {
        return `Dropped workout from ${a.oldDate.toISOString().split('T')[0]}: ${a.reason}`;
      }
      return a.reason;
    }).join('\n');

    const prompt = `You are a supportive workout coach. Summarize the workout reschedule changes for the user.

Missed Tasks: ${context.missedTasks.length}
Actions Taken:
${actionsSummary}

Policy Used: ${context.policy}

Write a brief, encouraging summary (2-3 sentences) explaining what was rescheduled and why. Be positive and supportive.`;

    try {
      const response = await this.llm.invoke(prompt);
      const summary = (response.content as string).trim();

      // Update history with summary
      await query(
        `UPDATE plan_reschedule_history
         SET user_summary = $1
         WHERE id = $2`,
        [summary, historyId]
      );

      return summary;
    } catch (error) {
      logger.error('[WorkoutReschedule] Failed to generate summary', { error });
      return `I've rescheduled ${proposal.actions.length} missed workout(s) according to your plan.`;
    }
  }
}

export const workoutRescheduleWorkflowService = new WorkoutRescheduleWorkflowService();

