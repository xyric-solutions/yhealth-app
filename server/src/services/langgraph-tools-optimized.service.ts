/**
 * @file LangGraph Optimized Tools Service
 * @description Optimized tool creation with intent-based routing
 *
 * BEFORE: 163 tools, 3.6s TTFT
 * AFTER: ~40 tools total, 15-25 tools per request, <1s TTFT
 *
 * Architecture:
 * 1. Semantic managers (13 tools) replace ~100 CRUD tools
 * 2. Essential read-only tools retained for common queries
 * 3. Intent-based routing limits tools per request
 * 4. Tool caching prevents rebuilding on each request
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { createSemanticTools } from './langgraph-semantic-tools.service.js';
import { toolRouterService } from './tool-router.service.js';

// ============================================
// ESSENTIAL READ-ONLY TOOLS
// These are frequently used and benefit from dedicated tools
// ============================================

function createEssentialReadTools(userId: string): DynamicStructuredTool[] {
  return [
    // OVERVIEW TOOLS - Critical for context
    new DynamicStructuredTool({
      name: 'getUserActivePlans',
      description: 'Get all active plans (workout, diet, goals). Use for overview queries.',
      schema: z.object({}),
      func: async () => {
        try {
          const [workouts, diets, goals] = await Promise.all([
            query(`SELECT id, name, status, initial_difficulty_level, start_date FROM workout_plans WHERE user_id = $1 AND status = 'active'`, [userId]),
            query(`SELECT id, name, status, daily_calories FROM diet_plans WHERE user_id = $1 AND status = 'active'`, [userId]),
            query(`SELECT id, title, status, category, target_value, current_value FROM user_goals WHERE user_id = $1 AND status = 'active'`, [userId]),
          ]);
          return JSON.stringify({
            workoutPlans: workouts.rows,
            dietPlans: diets.rows,
            goals: goals.rows,
          });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserProfile',
      description: 'Get user profile and preferences.',
      schema: z.object({}),
      func: async () => {
        try {
          const result = await query(
            `SELECT id, email, first_name, last_name, date_of_birth, gender, height_cm, weight_kg,
                    activity_level, fitness_goal, dietary_restrictions, timezone
             FROM users WHERE id = $1`,
            [userId]
          );
          return JSON.stringify({ profile: result.rows[0] || null });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // TODAY/QUICK ACCESS TOOLS
    new DynamicStructuredTool({
      name: 'getScheduleByDate',
      description: 'Get schedule for a date. Defaults to today if no date provided.',
      schema: z.object({
        date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
      }),
      func: async ({ date }) => {
        try {
          const targetDate = date || new Date().toISOString().split('T')[0];
          const result = await query(
            `SELECT ds.*,
                    COALESCE(json_agg(si.*) FILTER (WHERE si.id IS NOT NULL), '[]') as items
             FROM daily_schedules ds
             LEFT JOIN schedule_items si ON ds.id = si.schedule_id
             WHERE ds.user_id = $1 AND ds.schedule_date = $2
             GROUP BY ds.id`,
            [userId, targetDate]
          );
          return JSON.stringify({ schedule: result.rows[0] || null, date: targetDate });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserTasks',
      description: 'Get user tasks. Filter by status and category.',
      schema: z.object({
        status: z.string().optional().describe('Filter: pending, in_progress, completed, cancelled'),
        category: z.string().optional().describe('Filter: health, fitness, nutrition, work, personal'),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      func: async ({ status, category, fromDate, toDate }) => {
        try {
          let sql = 'SELECT * FROM tasks WHERE user_id = $1';
          const values: any[] = [userId];
          if (status) { sql += ` AND status = $${values.length + 1}`; values.push(status); }
          if (category) { sql += ` AND category = $${values.length + 1}`; values.push(category); }
          if (fromDate) { sql += ` AND due_date >= $${values.length + 1}`; values.push(fromDate); }
          if (toDate) { sql += ` AND due_date <= $${values.length + 1}`; values.push(toDate); }
          sql += ' ORDER BY due_date ASC LIMIT 50';
          const result = await query(sql, values);
          return JSON.stringify({ tasks: result.rows, count: result.rowCount });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // WORKOUT SPECIFIC
    new DynamicStructuredTool({
      name: 'getUserWorkoutPlans',
      description: 'Get workout plans. Filter by status.',
      schema: z.object({
        status: z.string().optional().describe('Filter: active, completed, paused, archived'),
      }),
      func: async ({ status }) => {
        try {
          let sql = 'SELECT * FROM workout_plans WHERE user_id = $1';
          const values: any[] = [userId];
          if (status) { sql += ` AND status = $${values.length + 1}`; values.push(status); }
          sql += ' ORDER BY created_at DESC';
          const result = await query(sql, values);
          return JSON.stringify({ workoutPlans: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserWorkoutLogs',
      description: 'Get workout history. Filter by date range.',
      schema: z.object({
        planId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional().default(20),
      }),
      func: async ({ planId, startDate, endDate, limit }) => {
        try {
          let sql = 'SELECT * FROM workout_logs WHERE user_id = $1';
          const values: any[] = [userId];
          if (planId) { sql += ` AND workout_plan_id = $${values.length + 1}`; values.push(planId); }
          if (startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(endDate); }
          sql += ` ORDER BY logged_at DESC LIMIT ${limit || 20}`;
          const result = await query(sql, values);
          return JSON.stringify({ workoutLogs: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'checkWorkoutProgress',
      description: 'Check workout progress and completion status.',
      schema: z.object({
        workoutPlanId: z.string().optional(),
      }),
      func: async ({ workoutPlanId }) => {
        try {
          let sql = `
            SELECT wp.id, wp.name, wp.status,
                   COUNT(wl.id) as completed_workouts,
                   (wp.duration_weeks * wp.workouts_per_week) as total_workouts,
                   ROUND(COUNT(wl.id)::numeric / NULLIF(wp.duration_weeks * wp.workouts_per_week, 0) * 100, 1) as completion_pct
            FROM workout_plans wp
            LEFT JOIN workout_logs wl ON wp.id = wl.workout_plan_id
            WHERE wp.user_id = $1`;
          const values: any[] = [userId];
          if (workoutPlanId) { sql += ` AND wp.id = $${values.length + 1}`; values.push(workoutPlanId); }
          sql += ' GROUP BY wp.id';
          const result = await query(sql, values);
          return JSON.stringify({ progress: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // MEAL/NUTRITION SPECIFIC
    new DynamicStructuredTool({
      name: 'getUserMealLogs',
      description: 'Get meal history. Filter by date.',
      schema: z.object({
        date: z.string().optional().describe('Specific date (YYYY-MM-DD)'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      func: async ({ date, startDate, endDate }) => {
        try {
          let sql = 'SELECT * FROM meal_logs WHERE user_id = $1';
          const values: any[] = [userId];
          if (date) { sql += ` AND DATE(eaten_at) = $${values.length + 1}`; values.push(date); }
          else {
            if (startDate) { sql += ` AND eaten_at >= $${values.length + 1}`; values.push(startDate); }
            if (endDate) { sql += ` AND eaten_at <= $${values.length + 1}`; values.push(endDate); }
          }
          sql += ' ORDER BY eaten_at DESC LIMIT 20';
          const result = await query(sql, values);
          return JSON.stringify({ mealLogs: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserRecipes',
      description: 'Get user recipes. Filter by cuisine or meal type.',
      schema: z.object({
        cuisine: z.string().optional(),
        mealType: z.string().optional(),
        limit: z.number().optional().default(20),
      }),
      func: async ({ cuisine, mealType, limit }) => {
        try {
          let sql = 'SELECT * FROM user_recipes WHERE user_id = $1';
          const values: any[] = [userId];
          if (cuisine) { sql += ` AND cuisine = $${values.length + 1}`; values.push(cuisine); }
          if (mealType) { sql += ` AND category = $${values.length + 1}`; values.push(mealType); }
          sql += ` ORDER BY created_at DESC LIMIT ${limit || 20}`;
          const result = await query(sql, values);
          return JSON.stringify({ recipes: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserDietPlans',
      description: 'Get diet plans. Filter by status.',
      schema: z.object({
        status: z.string().optional().describe('Filter: active, completed, paused, archived'),
      }),
      func: async ({ status }) => {
        try {
          let sql = 'SELECT * FROM diet_plans WHERE user_id = $1';
          const values: any[] = [userId];
          if (status) { sql += ` AND status = $${values.length + 1}`; values.push(status); }
          sql += ' ORDER BY created_at DESC';
          const result = await query(sql, values);
          return JSON.stringify({ dietPlans: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // GOALS
    new DynamicStructuredTool({
      name: 'getUserGoals',
      description: 'Get goals. Filter by status.',
      schema: z.object({
        status: z.string().optional().describe('Filter: active, completed, paused, archived'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      func: async ({ status, startDate, endDate }) => {
        try {
          let sql = 'SELECT * FROM user_goals WHERE user_id = $1';
          const values: any[] = [userId];
          if (status) { sql += ` AND status = $${values.length + 1}`; values.push(status); }
          if (startDate) { sql += ` AND created_at >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND target_date <= $${values.length + 1}`; values.push(endDate); }
          sql += ' ORDER BY created_at DESC LIMIT 20';
          const result = await query(sql, values);
          return JSON.stringify({ goals: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // PROGRESS
    new DynamicStructuredTool({
      name: 'getUserProgress',
      description: 'Get progress records (weight, measurements).',
      schema: z.object({
        type: z.string().optional().describe('Record type: weight, measurements, body_fat'),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      func: async ({ type, startDate, endDate }) => {
        try {
          let sql = 'SELECT * FROM progress_records WHERE user_id = $1';
          const values: any[] = [userId];
          if (type) { sql += ` AND record_type = $${values.length + 1}`; values.push(type); }
          if (startDate) { sql += ` AND record_date >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND record_date <= $${values.length + 1}`; values.push(endDate); }
          sql += ' ORDER BY record_date DESC LIMIT 50';
          const result = await query(sql, values);
          return JSON.stringify({ progressRecords: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // WELLBEING - Read only
    new DynamicStructuredTool({
      name: 'getUserMoodTrends',
      description: 'Get mood trends analysis.',
      schema: z.object({
        days: z.number().optional().default(14).describe('Days to analyze'),
      }),
      func: async ({ days }) => {
        try {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - (days || 14));
          const result = await query(
            `SELECT
               AVG(happiness_rating) as avg_happiness,
               AVG(energy_rating) as avg_energy,
               AVG(stress_rating) as avg_stress,
               COUNT(*) as total_logs,
               MIN(logged_at) as period_start,
               MAX(logged_at) as period_end
             FROM mood_logs
             WHERE user_id = $1 AND logged_at >= $2`,
            [userId, startDate.toISOString()]
          );
          return JSON.stringify({ trends: result.rows[0] });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'getUserActivityLogsWithMood',
      description: 'Get activity logs with mood data for correlation analysis.',
      schema: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional().default(20),
      }),
      func: async ({ startDate, endDate, limit }) => {
        try {
          let sql = `
            SELECT al.*, ml.happiness_rating, ml.energy_rating, ml.stress_rating
            FROM activity_logs al
            LEFT JOIN mood_logs ml ON DATE(al.logged_at) = DATE(ml.logged_at) AND al.user_id = ml.user_id
            WHERE al.user_id = $1`;
          const values: any[] = [userId];
          if (startDate) { sql += ` AND al.logged_at >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND al.logged_at <= $${values.length + 1}`; values.push(endDate); }
          sql += ` ORDER BY al.logged_at DESC LIMIT ${limit || 20}`;
          const result = await query(sql, values);
          return JSON.stringify({ activityLogs: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // WATER
    new DynamicStructuredTool({
      name: 'getWaterIntakeLogs',
      description: 'Get water intake logs.',
      schema: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      func: async ({ startDate, endDate }) => {
        try {
          let sql = 'SELECT * FROM water_intake_logs WHERE user_id = $1';
          const values: any[] = [userId];
          if (startDate) { sql += ` AND log_date >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND log_date <= $${values.length + 1}`; values.push(endDate); }
          sql += ' ORDER BY log_date DESC LIMIT 30';
          const result = await query(sql, values);
          return JSON.stringify({ waterLogs: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // Quick water add (common action)
    new DynamicStructuredTool({
      name: 'addWaterEntry',
      description: 'Quick add water intake. Defaults to 250ml.',
      schema: z.object({
        amountMl: z.number().optional().default(250).describe('Amount in ml'),
        date: z.string().optional().describe('Date, defaults to today'),
      }),
      func: async ({ amountMl, date }) => {
        try {
          const targetDate = date || new Date().toISOString().split('T')[0];
          const amount = amountMl || 250;
          const result = await query(
            `INSERT INTO water_intake_logs (user_id, log_date, ml_consumed, target_ml, entries)
             VALUES ($1, $2, $3, 2000, $4)
             ON CONFLICT (user_id, log_date)
             DO UPDATE SET ml_consumed = water_intake_logs.ml_consumed + $3,
                           entries = water_intake_logs.entries || $4,
                           updated_at = NOW()
             RETURNING *`,
            [userId, targetDate, amount, JSON.stringify([{ amountMl: amount, time: new Date().toISOString() }])]
          );
          return JSON.stringify({ success: true, waterLog: result.rows[0], message: `Added ${amount}ml` });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // INTEGRATIONS
    new DynamicStructuredTool({
      name: 'getUserIntegrations',
      description: 'Get connected integrations (Whoop, Fitbit, etc).',
      schema: z.object({}),
      func: async () => {
        try {
          const result = await query(
            `SELECT id, provider, status, last_sync_at FROM user_integrations WHERE user_id = $1`,
            [userId]
          );
          return JSON.stringify({ integrations: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // SCHEDULES
    new DynamicStructuredTool({
      name: 'getUserSchedules',
      description: 'Get daily schedules. Filter by date range.',
      schema: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      func: async ({ startDate, endDate }) => {
        try {
          let sql = 'SELECT * FROM daily_schedules WHERE user_id = $1';
          const values: any[] = [userId];
          if (startDate) { sql += ` AND schedule_date >= $${values.length + 1}`; values.push(startDate); }
          if (endDate) { sql += ` AND schedule_date <= $${values.length + 1}`; values.push(endDate); }
          sql += ' ORDER BY schedule_date DESC LIMIT 30';
          const result = await query(sql, values);
          return JSON.stringify({ schedules: result.rows });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),

    // PREFERENCES
    new DynamicStructuredTool({
      name: 'getUserPreferences',
      description: 'Get user preferences and settings.',
      schema: z.object({}),
      func: async () => {
        try {
          const result = await query(
            `SELECT * FROM user_preferences WHERE user_id = $1`,
            [userId]
          );
          return JSON.stringify({ preferences: result.rows[0] || null });
        } catch (error) {
          return JSON.stringify({ error: String(error) });
        }
      },
    }),
  ];
}

// ============================================
// COMBINED OPTIMIZED TOOL CREATION
// ============================================

/**
 * Creates optimized tool set combining:
 * - Semantic managers (13 tools)
 * - Essential read tools (20 tools)
 * Total: ~33 tools instead of 163
 */
export function createOptimizedTools(userId: string): DynamicStructuredTool[] {
  const semanticTools = createSemanticTools(userId);
  const essentialReadTools = createEssentialReadTools(userId);

  const allTools = [...semanticTools, ...essentialReadTools];

  logger.info('[OptimizedTools] Tools created', {
    userId,
    semanticCount: semanticTools.length,
    essentialCount: essentialReadTools.length,
    totalCount: allTools.length,
  });

  return allTools;
}

/**
 * Get tools for a specific message using intent routing
 * Returns 15-25 tools based on detected intent
 */
export function getToolsForMessage(
  userId: string,
  message: string
): DynamicStructuredTool[] {
  // Use cached tools with intent-based filtering
  return toolRouterService.getToolsForMessage(
    userId,
    message,
    () => createOptimizedTools(userId)
  );
}

// ============================================
// SERVICE EXPORT
// ============================================

export const optimizedToolsService = {
  createOptimizedTools,
  getToolsForMessage,
};
