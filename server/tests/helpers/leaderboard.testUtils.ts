/**
 * Leaderboard Test Utilities
 * Shared data generators for leaderboard, scoring, competitions, and activity events
 */

import { jest } from '@jest/globals';
import type { ComponentScores, DailyScore } from '../../src/services/ai-scoring.service.js';
import type { LeaderboardEntry } from '../../src/services/leaderboard.service.js';
import type { ActivityEventInput, ActivityEventType, ActivityEventSource } from '../../src/services/activity-ingestion.service.js';

/**
 * Generate a deterministic DailyScore
 */
export function generateDailyScoreData(overrides: Partial<DailyScore> = {}): DailyScore {
  return {
    userId: 'test-user-id',
    date: '2026-02-16',
    totalScore: 75.5,
    componentScores: {
      workout: 80,
      nutrition: 70,
      wellbeing: 75,
      biometrics: 50,
      engagement: 55,
      consistency: 40,
    },
    explanation: 'Excellent workout performance. Nutrition on track. Good wellbeing check-ins.',
    flags: {},
    ...overrides,
  };
}

/**
 * Generate deterministic ComponentScores
 */
export function generateComponentScores(overrides: Partial<ComponentScores> = {}): ComponentScores {
  return {
    workout: 80,
    nutrition: 70,
    wellbeing: 75,
    biometrics: 50,
    engagement: 55,
    consistency: 40,
    ...overrides,
  };
}

/**
 * Generate a deterministic LeaderboardEntry
 */
export function generateLeaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    user_id: 'test-user-id',
    rank: 1,
    total_score: 85.5,
    component_scores: {
      workout: 90,
      nutrition: 80,
      wellbeing: 85,
      biometrics: 50,
      engagement: 70,
      consistency: 60,
    },
    user: {
      name: 'Test User',
      avatar: undefined,
    },
    ...overrides,
  };
}

/**
 * Generate a deterministic Competition data object
 */
export function generateCompetitionData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-test-id',
    name: 'Test Competition',
    type: 'admin_created' as const,
    description: 'A test competition',
    start_date: new Date('2026-02-01'),
    end_date: new Date('2026-03-01'),
    rules: { metric: 'total', aggregation: 'total' },
    eligibility: {},
    scoring_weights: {},
    anti_cheat_policy: {},
    prize_metadata: {},
    status: 'active' as const,
    created_by: 'admin-id',
    created_at: new Date('2026-02-01'),
    updated_at: new Date('2026-02-01'),
    ...overrides,
  };
}

/**
 * Generate a deterministic CompetitionEntry data object
 */
export function generateCompetitionEntryData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-test-id',
    competition_id: 'comp-test-id',
    user_id: 'test-user-id',
    joined_at: new Date('2026-02-05'),
    status: 'active' as const,
    current_rank: null,
    current_score: null,
    metadata: {},
    ...overrides,
  };
}

/**
 * Generate a deterministic ActivityEventInput
 */
export function generateActivityEventInput(overrides: Partial<ActivityEventInput> = {}): ActivityEventInput {
  return {
    type: 'workout' as ActivityEventType,
    source: 'manual' as ActivityEventSource,
    timestamp: '2026-02-16T10:00:00.000Z',
    payload: { duration_minutes: 45, calories_burned: 300 },
    ...overrides,
  };
}

/**
 * Generate a mock database row for activity events
 */
export function generateActivityEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-test-id',
    user_id: 'test-user-id',
    type: 'workout',
    source: 'manual',
    timestamp: new Date('2026-02-16T10:00:00.000Z'),
    payload: { duration_minutes: 45, calories_burned: 300 },
    confidence: 0.8,
    flags: {},
    idempotency_key: 'test-key',
    created_at: new Date('2026-02-16T10:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Create a mock Redis cache service with all methods
 */
export function createMockRedisCacheService() {
  return {
    get: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    set: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    delete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    deleteByPattern: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    zAdd: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    zAddMultiple: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    zRange: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    zRevRange: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    zRank: jest.fn<() => Promise<number | null>>().mockResolvedValue(null),
    zRevRank: jest.fn<() => Promise<number | null>>().mockResolvedValue(null),
    zScore: jest.fn<() => Promise<number | null>>().mockResolvedValue(null),
    zCard: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    zRem: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    zDelete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    expire: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    healthCheck: jest.fn<() => Promise<{ status: string; message: string }>>().mockResolvedValue({ status: 'up', message: 'Redis is healthy' }),
    getStats: jest.fn<() => Promise<{ connected: boolean; keys: number; memory: string }>>().mockResolvedValue({ connected: true, keys: 0, memory: '0B' }),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

/**
 * Create a standard mock query result
 */
export function mockQueryResult<T>(rows: T[], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT' as const,
    oid: 0,
    fields: [],
  };
}
