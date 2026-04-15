/**
 * @file Breathing Service
 * @description Handles breathing test tracking and lung health analytics
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';

// ============================================
// TYPES
// ============================================

export type BreathingTestType = 'breath_hold' | 'box_breathing' | '4-7-8' | 'relaxation' | 'custom';
export type LungCapacityEstimate = 'poor' | 'fair' | 'good' | 'excellent';

export interface BreathingTest {
  id: string;
  userId: string;
  testType: BreathingTestType;
  patternName?: string;
  breathHoldDurationSeconds?: number;
  totalCyclesCompleted: number;
  totalDurationSeconds: number;
  averageInhaleDuration?: number;
  averageExhaleDuration?: number;
  averageHoldDuration?: number;
  consistencyScore?: number;
  difficultyRating?: number;
  notes?: string;
  lungCapacityEstimate?: LungCapacityEstimate;
  improvementFromBaseline?: number;
  startedAt: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreathingTestInput {
  testType: BreathingTestType;
  patternName?: string;
  breathHoldDurationSeconds?: number;
  totalCyclesCompleted?: number;
  totalDurationSeconds: number;
  averageInhaleDuration?: number;
  averageExhaleDuration?: number;
  averageHoldDuration?: number;
  consistencyScore?: number;
  difficultyRating?: number;
  notes?: string;
  startedAt: string;
}

export interface BreathingTimelineData {
  id: string;
  timestamp: string;
  breathHoldDurationSeconds?: number;
  totalDurationSeconds: number;
  testType: BreathingTestType;
  consistencyScore?: number;
  lungCapacityEstimate?: LungCapacityEstimate;
}

export interface BreathingStats {
  totalTests: number;
  averageBreathHoldSeconds: number;
  bestBreathHoldSeconds: number;
  averageConsistencyScore: number;
  improvementPercentage: number;
  mostUsedTestType: string;
  testsByType: Array<{ testType: string; count: number }>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

interface BreathingTestRow {
  id: string;
  user_id: string;
  test_type: string;
  pattern_name: string | null;
  breath_hold_duration_seconds: string | null;
  total_cycles_completed: number;
  total_duration_seconds: number;
  average_inhale_duration: string | null;
  average_exhale_duration: string | null;
  average_hold_duration: string | null;
  consistency_score: number | null;
  difficulty_rating: number | null;
  notes: string | null;
  lung_capacity_estimate: string | null;
  improvement_from_baseline: string | null;
  started_at: Date;
  completed_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate lung capacity estimate based on breath hold duration
 */
function calculateLungCapacity(breathHoldSeconds: number): LungCapacityEstimate {
  if (breathHoldSeconds < 20) return 'poor';
  if (breathHoldSeconds < 40) return 'fair';
  if (breathHoldSeconds < 60) return 'good';
  return 'excellent';
}

// ============================================
// SERVICE CLASS
// ============================================

class BreathingService {
  /**
   * Create a breathing test record
   */
  async createBreathingTest(userId: string, input: CreateBreathingTestInput): Promise<BreathingTest> {
    // Validate input
    if (input.totalDurationSeconds <= 0) {
      throw ApiError.badRequest('Total duration must be greater than 0');
    }

    if (input.difficultyRating !== undefined && (input.difficultyRating < 1 || input.difficultyRating > 5)) {
      throw ApiError.badRequest('Difficulty rating must be between 1 and 5');
    }

    if (input.consistencyScore !== undefined && (input.consistencyScore < 0 || input.consistencyScore > 100)) {
      throw ApiError.badRequest('Consistency score must be between 0 and 100');
    }

    // Calculate lung capacity estimate if breath hold test
    let lungCapacityEstimate: LungCapacityEstimate | null = null;
    if (input.testType === 'breath_hold' && input.breathHoldDurationSeconds) {
      lungCapacityEstimate = calculateLungCapacity(input.breathHoldDurationSeconds);
    }

    // Calculate improvement from baseline
    let improvementFromBaseline: number | null = null;
    if (input.testType === 'breath_hold' && input.breathHoldDurationSeconds) {
      const baseline = await this.getBaselineBreathHold(userId);
      if (baseline && baseline > 0) {
        improvementFromBaseline = ((input.breathHoldDurationSeconds - baseline) / baseline) * 100;
      }
    }

    const result = await query<BreathingTestRow>(
      `INSERT INTO breathing_tests (
        user_id, test_type, pattern_name, breath_hold_duration_seconds,
        total_cycles_completed, total_duration_seconds,
        average_inhale_duration, average_exhale_duration, average_hold_duration,
        consistency_score, difficulty_rating, notes,
        lung_capacity_estimate, improvement_from_baseline, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        userId,
        input.testType,
        input.patternName || null,
        input.breathHoldDurationSeconds || null,
        input.totalCyclesCompleted || 0,
        input.totalDurationSeconds,
        input.averageInhaleDuration || null,
        input.averageExhaleDuration || null,
        input.averageHoldDuration || null,
        input.consistencyScore || null,
        input.difficultyRating || null,
        input.notes || null,
        lungCapacityEstimate,
        improvementFromBaseline,
        input.startedAt,
      ]
    );

    return this.mapRowToBreathingTest(result.rows[0]);
  }

  /**
   * Get user's first breath hold test as baseline
   */
  private async getBaselineBreathHold(userId: string): Promise<number | null> {
    const result = await query<{ breath_hold_duration_seconds: string }>(
      `SELECT breath_hold_duration_seconds FROM breathing_tests
       WHERE user_id = $1 AND test_type = 'breath_hold' AND breath_hold_duration_seconds IS NOT NULL
       ORDER BY completed_at ASC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return parseFloat(result.rows[0].breath_hold_duration_seconds);
  }

  /**
   * Get breathing test history
   */
  async getBreathingTests(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      testType?: BreathingTestType;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ tests: BreathingTest[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM breathing_tests WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (options.startDate) {
      queryText += ` AND DATE(completed_at) >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      queryText += ` AND DATE(completed_at) <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    if (options.testType) {
      queryText += ` AND test_type = $${params.length + 1}`;
      params.push(options.testType);
    }

    queryText += ` ORDER BY completed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const testsResult = await query<BreathingTestRow>(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM breathing_tests WHERE user_id = $1`;
    const countParams: (string | number)[] = [userId];

    if (options.startDate) {
      countQuery += ` AND DATE(completed_at) >= $${countParams.length + 1}`;
      countParams.push(options.startDate);
    }

    if (options.endDate) {
      countQuery += ` AND DATE(completed_at) <= $${countParams.length + 1}`;
      countParams.push(options.endDate);
    }

    if (options.testType) {
      countQuery += ` AND test_type = $${countParams.length + 1}`;
      countParams.push(options.testType);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      tests: testsResult.rows.map((row) => this.mapRowToBreathingTest(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single breathing test by ID
   */
  async getBreathingTestById(userId: string, testId: string): Promise<BreathingTest> {
    const result = await query<BreathingTestRow>(
      `SELECT * FROM breathing_tests WHERE id = $1 AND user_id = $2`,
      [testId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Breathing test not found');
    }

    return this.mapRowToBreathingTest(result.rows[0]);
  }

  /**
   * Delete a breathing test
   */
  async deleteBreathingTest(userId: string, testId: string): Promise<void> {
    const result = await query(
      `DELETE FROM breathing_tests WHERE id = $1 AND user_id = $2 RETURNING id`,
      [testId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Breathing test not found');
    }
  }

  /**
   * Get breathing timeline data for charts
   */
  async getBreathingTimeline(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<BreathingTimelineData[]> {
    const result = await query<BreathingTestRow>(
      `SELECT * FROM breathing_tests
       WHERE user_id = $1
       AND DATE(completed_at) >= $2
       AND DATE(completed_at) <= $3
       ORDER BY completed_at ASC`,
      [userId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      timestamp: row.completed_at.toISOString(),
      breathHoldDurationSeconds: row.breath_hold_duration_seconds
        ? parseFloat(row.breath_hold_duration_seconds)
        : undefined,
      totalDurationSeconds: row.total_duration_seconds,
      testType: row.test_type as BreathingTestType,
      consistencyScore: row.consistency_score || undefined,
      lungCapacityEstimate: (row.lung_capacity_estimate as LungCapacityEstimate) || undefined,
    }));
  }

  /**
   * Get breathing statistics
   */
  async getBreathingStats(userId: string, days: number = 30): Promise<BreathingStats> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get all tests in date range
    const result = await query<BreathingTestRow>(
      `SELECT * FROM breathing_tests
       WHERE user_id = $1
       AND completed_at >= $2
       AND completed_at <= $3
       ORDER BY completed_at DESC`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    const tests = result.rows;

    if (tests.length === 0) {
      return {
        totalTests: 0,
        averageBreathHoldSeconds: 0,
        bestBreathHoldSeconds: 0,
        averageConsistencyScore: 0,
        improvementPercentage: 0,
        mostUsedTestType: 'breath_hold',
        testsByType: [],
        recentTrend: 'stable',
      };
    }

    // Calculate stats
    const breathHoldTests = tests.filter(
      (t) => t.test_type === 'breath_hold' && t.breath_hold_duration_seconds
    );

    const breathHoldDurations = breathHoldTests.map((t) =>
      parseFloat(t.breath_hold_duration_seconds!)
    );

    const consistencyScores = tests
      .filter((t) => t.consistency_score !== null)
      .map((t) => t.consistency_score!);

    // Tests by type
    const typeCount = new Map<string, number>();
    for (const test of tests) {
      typeCount.set(test.test_type, (typeCount.get(test.test_type) || 0) + 1);
    }

    const testsByType = Array.from(typeCount.entries())
      .map(([testType, count]) => ({ testType, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate trend (compare first half vs second half)
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (breathHoldTests.length >= 4) {
      const midpoint = Math.floor(breathHoldTests.length / 2);
      const olderAvg =
        breathHoldTests.slice(midpoint).reduce((sum, t) => sum + parseFloat(t.breath_hold_duration_seconds!), 0) /
        (breathHoldTests.length - midpoint);
      const newerAvg =
        breathHoldTests.slice(0, midpoint).reduce((sum, t) => sum + parseFloat(t.breath_hold_duration_seconds!), 0) /
        midpoint;

      const change = ((newerAvg - olderAvg) / olderAvg) * 100;
      if (change > 5) recentTrend = 'improving';
      else if (change < -5) recentTrend = 'declining';
    }

    // Calculate improvement from baseline
    const baseline = await this.getBaselineBreathHold(userId);
    const latestBreathHold =
      breathHoldDurations.length > 0 ? breathHoldDurations[0] : 0;
    const improvementPercentage =
      baseline && baseline > 0 ? ((latestBreathHold - baseline) / baseline) * 100 : 0;

    return {
      totalTests: tests.length,
      averageBreathHoldSeconds:
        breathHoldDurations.length > 0
          ? breathHoldDurations.reduce((a, b) => a + b, 0) / breathHoldDurations.length
          : 0,
      bestBreathHoldSeconds:
        breathHoldDurations.length > 0 ? Math.max(...breathHoldDurations) : 0,
      averageConsistencyScore:
        consistencyScores.length > 0
          ? consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length
          : 0,
      improvementPercentage,
      mostUsedTestType: testsByType[0]?.testType || 'breath_hold',
      testsByType,
      recentTrend,
    };
  }

  /**
   * Map database row to BreathingTest interface
   */
  private mapRowToBreathingTest(row: BreathingTestRow): BreathingTest {
    return {
      id: row.id,
      userId: row.user_id,
      testType: row.test_type as BreathingTestType,
      patternName: row.pattern_name || undefined,
      breathHoldDurationSeconds: row.breath_hold_duration_seconds
        ? parseFloat(row.breath_hold_duration_seconds)
        : undefined,
      totalCyclesCompleted: row.total_cycles_completed,
      totalDurationSeconds: row.total_duration_seconds,
      averageInhaleDuration: row.average_inhale_duration
        ? parseFloat(row.average_inhale_duration)
        : undefined,
      averageExhaleDuration: row.average_exhale_duration
        ? parseFloat(row.average_exhale_duration)
        : undefined,
      averageHoldDuration: row.average_hold_duration
        ? parseFloat(row.average_hold_duration)
        : undefined,
      consistencyScore: row.consistency_score || undefined,
      difficultyRating: row.difficulty_rating || undefined,
      notes: row.notes || undefined,
      lungCapacityEstimate: (row.lung_capacity_estimate as LungCapacityEstimate) || undefined,
      improvementFromBaseline: row.improvement_from_baseline
        ? parseFloat(row.improvement_from_baseline)
        : undefined,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const breathingService = new BreathingService();
export default breathingService;
