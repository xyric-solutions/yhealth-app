/**
 * @file Streak Validator
 * @description Zod schemas for streak system API endpoints
 */

import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

/**
 * Calendar params: month in YYYY-MM format
 * Used for GET /api/streaks/calendar/:month
 */
export const calendarParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
});

/**
 * Leaderboard query parameters
 * Used for GET /api/streaks/leaderboard
 */
export const leaderboardQuerySchema = z.object({
  segment: z.enum(['global', 'friends', 'country']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Freeze apply body
 * Used for POST /api/streaks/freeze/apply
 */
export const freezeApplySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

/**
 * Compare params: friendId must be a UUID
 * Used for GET /api/streaks/compare/:friendId
 */
export const compareParamsSchema = z.object({
  friendId: z.string().uuid('Friend ID must be a valid UUID'),
});

/**
 * History query parameters
 * Used for GET /api/streaks/history
 */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  activityType: z.string().optional(),
});

// ============================================
// TYPES
// ============================================

export type CalendarParamsInput = z.infer<typeof calendarParamsSchema>;
export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
export type FreezeApplyInput = z.infer<typeof freezeApplySchema>;
export type CompareParamsInput = z.infer<typeof compareParamsSchema>;
export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
