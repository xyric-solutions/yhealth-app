/**
 * @file Goal Decomposition Service
 * @description AI-powered decomposition of life goals into actionable steps.
 * Uses LLM to break down goals into habits, schedules, journal prompts,
 * tracking metrics, milestones, and behavioral tricks calibrated to
 * the user's motivation tier.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';
import { ApiError } from '../utils/ApiError.js';
import type {
  GoalAction,
  GoalActionType,
  GoalActionResponseType,
  GoalDecomposition,
  HealthPillar,
  LifeGoalMilestone,
} from '@shared/types/domain/wellbeing.js';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface GoalActionRow {
  id: string;
  goal_id: string;
  user_id: string;
  action_type: string;
  title: string;
  description: string | null;
  pillar: string | null;
  frequency: string | null;
  is_ai_generated: boolean;
  is_completed: boolean;
  completed_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface LifeGoalRow {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  motivation: string | null;
  status: string;
}

interface MotivationProfileRow {
  active_tier: string;
}

interface LifeGoalMilestoneRow {
  id: string;
  life_goal_id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  target_value: number | null;
  current_value: number;
  completed: boolean;
  completed_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// LLM RESPONSE TYPES
// ============================================

interface LLMAction {
  action_type: GoalActionType;
  title: string;
  description: string;
  pillar: HealthPillar | null;
  frequency: string;
}

interface LLMMilestone {
  title: string;
  description: string;
  sort_order: number;
}

interface LLMDecompositionResponse {
  actions: LLMAction[];
  milestones: LLMMilestone[];
  pillar_mappings: Array<{ pillar: HealthPillar; relevance: string }>;
  motivation_calibration: string;
}

// ============================================
// PROMPTS
// ============================================

const DECOMPOSITION_SYSTEM_PROMPT = `You are a life coaching AI that decomposes personal goals into actionable daily/weekly steps.

Given a user's life goal, break it down into 3-7 concrete actions they can take.

For each action, specify:
- action_type: one of 'habit' (recurring behavior), 'schedule' (time-blocked activity), 'journal_prompt' (reflective writing prompt), 'tracking' (metric to monitor), 'milestone' (achievement marker), 'behavioral_trick' (psychological technique)
- title: short actionable title (max 100 chars)
- description: 1-2 sentence explanation
- pillar: 'fitness', 'nutrition', 'wellbeing', or null if not health-related
- frequency: 'daily', 'weekly', 'monthly', or 'once'

Also generate 2-4 milestones with progressive targets.

MOTIVATION CALIBRATION:
- Low motivation: 2-3 micro-actions only. Use behavioral tricks (2-minute rule, temptation bundling). Keep everything tiny and achievable.
- Medium motivation: 4-5 structured actions. Include scheduling and tracking.
- High motivation: 5-7 ambitious actions. Include detailed tracking and accountability.

Respond with ONLY valid JSON in this format:
{
  "actions": [...],
  "milestones": [{ "title": "...", "description": "...", "sort_order": 1 }],
  "pillar_mappings": [{ "pillar": "wellbeing", "relevance": "..." }],
  "motivation_calibration": "Brief note on how motivation tier affected suggestions"
}`;

// ============================================
// SERVICE CLASS
// ============================================

class GoalDecompositionService {
  /**
   * Decompose a life goal into actionable steps using AI
   */
  async decomposeGoal(userId: string, goalId: string): Promise<GoalDecomposition> {
    // 1. Fetch the goal
    const goalResult = await query<LifeGoalRow>(
      `SELECT id, user_id, category, title, description, motivation, status
       FROM life_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (goalResult.rows.length === 0) {
      throw ApiError.notFound('Life goal not found');
    }

    const goal = goalResult.rows[0];

    // 2. Fetch motivation tier (graceful fallback to 'medium')
    let motivationTier = 'medium';
    try {
      const profileResult = await query<MotivationProfileRow>(
        `SELECT active_tier FROM user_motivation_profiles WHERE user_id = $1`,
        [userId]
      );
      if (profileResult.rows.length > 0) {
        motivationTier = profileResult.rows[0].active_tier;
      }
    } catch (err) {
      logger.warn('Could not fetch motivation tier, defaulting to medium', {
        userId,
        error: (err as Error).message,
      });
    }

    // 3. Fetch existing goal titles to avoid duplication
    const existingGoalsResult = await query<{ title: string }>(
      `SELECT title FROM life_goals WHERE user_id = $1 AND id != $2 AND status = 'active'`,
      [userId, goalId]
    );
    const existingGoalTitles = existingGoalsResult.rows.map((r) => r.title);

    // 4. Build user prompt
    const userPrompt = this.buildUserPrompt(goal, motivationTier, existingGoalTitles);

    // 5. Call AI with jsonMode
    logger.info('Decomposing goal via AI', { userId, goalId, motivationTier });

    const aiResponse = await aiProviderService.generateCompletion({
      systemPrompt: DECOMPOSITION_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      maxTokens: 2000,
      temperature: 0.7,
    });

    // 6. Parse response
    let parsed: LLMDecompositionResponse;
    try {
      parsed = JSON.parse(aiResponse.content) as LLMDecompositionResponse;
    } catch {
      logger.error('Failed to parse AI decomposition response', {
        userId,
        goalId,
        content: aiResponse.content.substring(0, 500),
      });
      throw ApiError.internal('Failed to parse goal decomposition from AI');
    }

    // Validate minimum structure
    if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      throw ApiError.internal('AI returned empty actions for goal decomposition');
    }

    // 7. Insert goal_actions
    const insertedActions: GoalAction[] = [];
    for (let i = 0; i < parsed.actions.length; i++) {
      const action = parsed.actions[i];
      const result = await query<GoalActionRow>(
        `INSERT INTO goal_actions (goal_id, user_id, action_type, title, description, pillar, frequency, is_ai_generated, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING *`,
        [
          goalId,
          userId,
          action.action_type,
          action.title.substring(0, 255),
          action.description ?? null,
          action.pillar ?? null,
          action.frequency ?? null,
          i,
        ]
      );
      insertedActions.push(this.mapRowToAction(result.rows[0]));
    }

    // 8. Insert milestones (into life_goal_milestones)
    const insertedMilestones: LifeGoalMilestone[] = [];
    if (Array.isArray(parsed.milestones)) {
      for (const milestone of parsed.milestones) {
        const result = await query<LifeGoalMilestoneRow>(
          `INSERT INTO life_goal_milestones (life_goal_id, user_id, title, description, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            goalId,
            userId,
            milestone.title.substring(0, 255),
            milestone.description ?? null,
            milestone.sort_order ?? 0,
          ]
        );
        insertedMilestones.push(this.mapRowToMilestone(result.rows[0]));
      }
    }

    logger.info('Goal decomposed successfully', {
      userId,
      goalId,
      actionsCount: insertedActions.length,
      milestonesCount: insertedMilestones.length,
      motivationTier,
    });

    return {
      actions: insertedActions,
      milestones: insertedMilestones,
      pillarMappings: parsed.pillar_mappings ?? [],
      motivationCalibration: parsed.motivation_calibration ?? '',
    };
  }

  /**
   * Re-decompose: delete existing AI-generated actions and regenerate
   */
  async redecomposeGoal(userId: string, goalId: string): Promise<GoalDecomposition> {
    // Delete existing AI-generated actions for this goal
    await query(
      `DELETE FROM goal_actions WHERE goal_id = $1 AND user_id = $2 AND is_ai_generated = true`,
      [goalId, userId]
    );

    // Delete AI-generated milestones (those without target_date or target_value, likely AI-created)
    // We keep user-created milestones intact
    await query(
      `DELETE FROM life_goal_milestones
       WHERE life_goal_id = $1 AND user_id = $2
       AND target_date IS NULL AND target_value IS NULL`,
      [goalId, userId]
    );

    logger.info('Cleared existing AI actions for re-decomposition', { userId, goalId });

    return this.decomposeGoal(userId, goalId);
  }

  /**
   * Get actions for a goal
   */
  async getActions(userId: string, goalId: string): Promise<GoalAction[]> {
    const result = await query<GoalActionRow>(
      `SELECT * FROM goal_actions WHERE goal_id = $1 AND user_id = $2 ORDER BY sort_order ASC`,
      [goalId, userId]
    );
    return result.rows.map((row) => this.mapRowToAction(row));
  }

  /**
   * Record accept/edit/skip response
   */
  async respondToAction(
    userId: string,
    actionId: string,
    responseType: GoalActionResponseType,
    editedData?: { title?: string; description?: string }
  ): Promise<void> {
    // Verify ownership
    const actionResult = await query<GoalActionRow>(
      `SELECT * FROM goal_actions WHERE id = $1 AND user_id = $2`,
      [actionId, userId]
    );
    if (actionResult.rows.length === 0) {
      throw ApiError.notFound('Action not found');
    }

    // Insert response record
    await query(
      `INSERT INTO goal_action_responses (action_id, user_id, response_type, edited_title, edited_description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actionId,
        userId,
        responseType,
        editedData?.title ?? null,
        editedData?.description ?? null,
      ]
    );

    // If 'edit', update the goal_actions row with new title/description
    if (responseType === 'edit' && editedData) {
      const setClauses: string[] = [];
      const values: (string | null)[] = [];
      let paramIndex = 1;

      if (editedData.title) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(editedData.title.substring(0, 255));
      }
      if (editedData.description) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(editedData.description);
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(actionId, userId);
        await query(
          `UPDATE goal_actions SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}`,
          values
        );
      }
    }

    // If 'skip', mark the action as completed (skipped)
    if (responseType === 'skip') {
      await query(
        `UPDATE goal_actions SET is_completed = true, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [actionId, userId]
      );
    }
  }

  /**
   * Complete an action
   */
  async completeAction(userId: string, actionId: string): Promise<void> {
    const result = await query(
      `UPDATE goal_actions SET is_completed = true, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND is_completed = false
       RETURNING id`,
      [actionId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Action not found or already completed');
    }
  }

  /**
   * Update an action
   */
  async updateAction(
    userId: string,
    actionId: string,
    data: { title?: string; description?: string }
  ): Promise<GoalAction> {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(data.title.substring(0, 255));
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No updates provided');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(actionId, userId);

    const result = await query<GoalActionRow>(
      `UPDATE goal_actions SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Action not found');
    }

    return this.mapRowToAction(result.rows[0]);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private buildUserPrompt(
    goal: LifeGoalRow,
    motivationTier: string,
    existingGoalTitles: string[]
  ): string {
    const parts = [
      `GOAL TITLE: ${goal.title}`,
      goal.description ? `DESCRIPTION: ${goal.description}` : '',
      goal.motivation ? `MOTIVATION: ${goal.motivation}` : '',
      `CATEGORY: ${goal.category}`,
      `USER MOTIVATION TIER: ${motivationTier}`,
    ];

    if (existingGoalTitles.length > 0) {
      parts.push(
        `EXISTING GOALS (avoid duplicating actions for these): ${existingGoalTitles.join(', ')}`
      );
    }

    return parts.filter(Boolean).join('\n');
  }

  private mapRowToAction(row: GoalActionRow): GoalAction {
    return {
      id: row.id,
      goalId: row.goal_id,
      userId: row.user_id,
      actionType: row.action_type as GoalActionType,
      title: row.title,
      description: row.description ?? undefined,
      pillar: (row.pillar as HealthPillar) ?? undefined,
      frequency: row.frequency ?? undefined,
      isAiGenerated: row.is_ai_generated,
      isCompleted: row.is_completed,
      completedAt: row.completed_at?.toISOString(),
      sortOrder: row.sort_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  // ============================================
  // USER GOAL (assessment) support
  // ============================================

  /**
   * Get or create actions for an assessment goal (user_goals table)
   */
  async getOrCreateActionsForUserGoal(userId: string, userGoalId: string): Promise<GoalAction[]> {
    // Check for existing actions
    const existing = await query<GoalActionRow>(
      `SELECT * FROM goal_actions WHERE user_goal_id = $1 AND user_id = $2 ORDER BY sort_order ASC`,
      [userGoalId, userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows.map(this.mapRowToAction);
    }

    // No existing actions — generate via AI
    const goalResult = await query<{ id: string; pillar: string; title: string; description: string | null; target_value: number; target_unit: string; motivation: string | null }>(
      `SELECT id, pillar, title, description, target_value, target_unit, motivation FROM user_goals WHERE id = $1 AND user_id = $2`,
      [userGoalId, userId]
    );

    if (goalResult.rows.length === 0) {
      throw ApiError.notFound('Goal not found');
    }

    const goal = goalResult.rows[0];

    const userPrompt = `Goal: "${goal.title}"
Category: ${goal.pillar}
Description: ${goal.description || 'No description'}
Target: ${goal.target_value} ${goal.target_unit}
Motivation: ${goal.motivation || 'General improvement'}

Break this into 3-5 concrete daily/weekly action steps.`;

    const aiResponse = await aiProviderService.generateCompletion({
      systemPrompt: DECOMPOSITION_SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      maxTokens: 2000,
      temperature: 0.7,
    });

    let parsed: LLMDecompositionResponse;
    try {
      parsed = JSON.parse(aiResponse.content) as LLMDecompositionResponse;
    } catch {
      // Fallback: create default actions
      parsed = {
        actions: [
          { action_type: 'tracking', title: `Track ${goal.target_unit} daily`, description: `Monitor your ${goal.target_unit} progress each day`, pillar: goal.pillar as any, frequency: 'daily' },
          { action_type: 'habit', title: `Practice ${goal.title.toLowerCase()}`, description: `Dedicate focused time to this goal`, pillar: goal.pillar as any, frequency: 'daily' },
          { action_type: 'journal_prompt', title: 'Reflect on progress', description: 'Write about what worked and what to improve', pillar: goal.pillar as any, frequency: 'weekly' },
        ],
        milestones: [],
        pillar_mappings: [],
        motivation_calibration: 'medium',
      };
    }

    const actions: GoalAction[] = [];
    for (let i = 0; i < (parsed.actions || []).length; i++) {
      const action = parsed.actions[i];
      const result = await query<GoalActionRow>(
        `INSERT INTO goal_actions (user_goal_id, user_id, action_type, title, description, pillar, frequency, is_ai_generated, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING *`,
        [userGoalId, userId, action.action_type, action.title.substring(0, 255), action.description ?? null, action.pillar ?? goal.pillar, action.frequency ?? 'daily', i]
      );
      actions.push(this.mapRowToAction(result.rows[0]));
    }

    logger.info('[GoalDecomposition] Generated actions for user goal', { userId: userId.slice(0, 8), userGoalId: userGoalId.slice(0, 8), count: actions.length });
    return actions;
  }

  /**
   * Get actions with today's completion status
   */
  async getActionsWithDailyStatus(userId: string, userGoalId: string): Promise<(GoalAction & { completedToday: boolean })[]> {
    const rows = await query<GoalActionRow & { completed_today: boolean }>(
      `SELECT ga.*,
        EXISTS(
          SELECT 1 FROM goal_action_completions gac
          WHERE gac.action_id = ga.id AND gac.completion_date = CURRENT_DATE AND gac.user_id = $1
        ) as completed_today
       FROM goal_actions ga
       WHERE ga.user_goal_id = $2 AND ga.user_id = $1
       ORDER BY ga.sort_order ASC`,
      [userId, userGoalId]
    );

    return rows.rows.map(row => ({
      ...this.mapRowToAction(row),
      completedToday: row.completed_today,
    }));
  }

  /**
   * Toggle daily action completion (insert or delete from goal_action_completions)
   */
  async toggleActionCompletion(userId: string, actionId: string): Promise<boolean> {
    // Check if already completed today
    const existing = await query(
      `SELECT id FROM goal_action_completions WHERE action_id = $1 AND user_id = $2 AND completion_date = CURRENT_DATE`,
      [actionId, userId]
    );

    if (existing.rows.length > 0) {
      // Uncomplete
      await query(`DELETE FROM goal_action_completions WHERE action_id = $1 AND user_id = $2 AND completion_date = CURRENT_DATE`, [actionId, userId]);
      return false; // now uncompleted
    } else {
      // Complete
      await query(
        `INSERT INTO goal_action_completions (action_id, user_id, completion_date) VALUES ($1, $2, CURRENT_DATE) ON CONFLICT DO NOTHING`,
        [actionId, userId]
      );
      return true; // now completed
    }
  }

  private mapRowToMilestone(row: LifeGoalMilestoneRow): LifeGoalMilestone {
    return {
      id: row.id,
      lifeGoalId: row.life_goal_id,
      userId: row.user_id,
      title: row.title,
      description: row.description ?? undefined,
      targetDate: row.target_date ?? undefined,
      targetValue: row.target_value ?? undefined,
      currentValue: row.current_value,
      completed: row.completed,
      completedAt: row.completed_at?.toISOString(),
      sortOrder: row.sort_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const goalDecompositionService = new GoalDecompositionService();
export default goalDecompositionService;
