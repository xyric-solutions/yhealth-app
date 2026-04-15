/**
 * @file WHOOP Analytics Service - Unit Tests
 * @description Senior-level unit tests following test pyramid and best practices
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as whoopAnalyticsService from '../../../src/services/whoop-analytics.service.js';
import { createMockQuery, createMockCache, createTestDate, waitForAsync } from '../../helpers/test-utils.js';

// Mock dependencies
jest.mock('../../../src/database/pg.js', () => ({
  query: jest.fn(),
}));

jest.mock('../../../src/services/cache.service.js', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../../../src/services/logger.service.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { query } from '../../../src/database/pg.js';
import { cache } from '../../../src/services/cache.service.js';

describe('WHOOP Analytics Service – Unit', () => {
  const mockQuery = query as jest.MockedFunction<typeof query>;
  const mockCache = cache as { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockReturnValue(null); // No cache by default
  });

  describe('getWhoopOverview', () => {
    const userId = 'test-user-123';

    test('throws error for invalid date range (end before start)', async () => {
      const startDate = createTestDate(2024, 1, 10);
      const endDate = createTestDate(2024, 1, 5);

      await expect(
        whoopAnalyticsService.getWhoopOverview(userId, startDate, endDate)
      ).rejects.toThrow('End date must be after start date');
    });

    test('throws error when date range exceeds 90 days', async () => {
      const startDate = createTestDate(2024, 1, 1);
      const endDate = createTestDate(2024, 5, 1); // 120 days

      await expect(
        whoopAnalyticsService.getWhoopOverview(userId, startDate, endDate)
      ).rejects.toThrow('Date range cannot exceed 90 days');
    });

    test('returns cached data when available', async () => {
      const cachedData = {
        currentRecovery: { score: 85, hrv: 45, rhr: 55, timestamp: '2024-01-10' },
        currentSleep: null,
        todayStrain: null,
        trends: { recovery7d: [80, 85, 90], sleep7d: [7, 8, 7.5], strain7d: [12, 14, 13] },
      };

      mockCache.get.mockReturnValue(cachedData);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      expect(result).toEqual(cachedData);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('returns null for currentRecovery when no data exists', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      expect(result.currentRecovery).toBeNull();
      expect(result.currentSleep).toBeNull();
      expect(result.todayStrain).toBeNull();
    });

    test('extracts recovery data correctly from database', async () => {
      const mockRecoveryData = [
        {
          value: {
            score: { recovery_score: 85, hrv_rmssd_milli: 45000, resting_heart_rate_bpm: 55 },
          },
          recorded_at: new Date('2024-01-10'),
        },
      ];

      mockQuery
        .mockResolvedValueOnce(mockRecoveryData) // Latest recovery
        .mockResolvedValueOnce([]) // Latest sleep
        .mockResolvedValueOnce([]) // Today strain
        .mockResolvedValueOnce([]) // Recovery trends
        .mockResolvedValueOnce([]) // Sleep trends
        .mockResolvedValueOnce([]); // Strain trends

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      expect(result.currentRecovery).not.toBeNull();
      expect(result.currentRecovery?.score).toBe(85);
      expect(result.currentRecovery?.hrv).toBe(45); // Converted from milliseconds
      expect(result.currentRecovery?.rhr).toBe(55);
    });

    test('handles missing optional fields gracefully', async () => {
      const mockRecoveryData = [
        {
          value: {
            score: {
              recovery_score: 85,
              hrv_rmssd_milli: 45000,
              resting_heart_rate_bpm: 55,
              // Missing spo2_percentage and skin_temp_celsius
            },
          },
          recorded_at: new Date('2024-01-10'),
        },
      ];

      mockQuery
        .mockResolvedValueOnce(mockRecoveryData)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      expect(result.currentRecovery).not.toBeNull();
      // Should not throw even with missing optional fields
    });
  });

  describe('getRecoveryTrends', () => {
    const userId = 'test-user-123';

    test('returns empty array when no data exists', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await whoopAnalyticsService.getRecoveryTrends(userId, 7);

      expect(result).toEqual([]);
    });

    test('maps database rows to RecoveryTrend correctly', async () => {
      const mockData = [
        {
          date: '2024-01-10',
          recovery_score: 85,
          hrv_rmssd_ms: 45,
          resting_heart_rate_bpm: 55,
          skin_temp_celsius: 36.5,
          spo2_percent: 98,
        },
      ];

      mockQuery.mockResolvedValue(mockData);

      const result = await whoopAnalyticsService.getRecoveryTrends(userId, 7);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2024-01-10',
        recovery_score: 85,
        hrv_rmssd_ms: 45,
        resting_heart_rate_bpm: 55,
        skin_temp_celsius: 36.5,
        spo2_percent: 98,
      });
    });

    test('handles null optional fields', async () => {
      const mockData = [
        {
          date: '2024-01-10',
          recovery_score: 85,
          hrv_rmssd_ms: 45,
          resting_heart_rate_bpm: 55,
          skin_temp_celsius: null,
          spo2_percent: null,
        },
      ];

      mockQuery.mockResolvedValue(mockData);

      const result = await whoopAnalyticsService.getRecoveryTrends(userId, 7);

      expect(result[0].skin_temp_celsius).toBeUndefined();
      expect(result[0].spo2_percent).toBeUndefined();
    });
  });

  describe('getCycleAnalysis', () => {
    const userId = 'test-user-123';

    test('auto-adjusts date range exceeding 90 days', async () => {
      const startDate = createTestDate(2024, 1, 1);
      const endDate = createTestDate(2024, 5, 1); // 120 days

      // Mock WHOOP API to return empty cycles
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ records: [], next_token: null }),
      } as Response);

      const result = await whoopAnalyticsService.getCycleAnalysis(
        userId,
        7,
        startDate,
        endDate
      );

      // Should not throw, should auto-adjust
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('handles invalid date range (end before start)', async () => {
      const startDate = createTestDate(2024, 1, 10);
      const endDate = createTestDate(2024, 1, 5);

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ records: [], next_token: null }),
      } as Response);

      const result = await whoopAnalyticsService.getCycleAnalysis(
        userId,
        7,
        startDate,
        endDate
      );

      // Should auto-adjust to valid range
      expect(result).toBeDefined();
    });
  });

  describe('Failure Injection Tests', () => {
    const userId = 'test-user-123';

    test('gracefully handles database query failure', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(
        whoopAnalyticsService.getWhoopOverview(userId)
      ).rejects.toThrow('Database connection failed');
    });

    test('gracefully handles cache service failure', async () => {
      mockCache.get.mockImplementation(() => {
        throw new Error('Cache service unavailable');
      });

      // Should fall through to database query
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      // Should still return result (graceful degradation)
      expect(result).toBeDefined();
    });
  });

  describe('Contract Tests', () => {
    const userId = 'test-user-123';

    test('always returns WhoopOverview structure', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      // Contract: Must have these properties
      expect(result).toHaveProperty('currentRecovery');
      expect(result).toHaveProperty('currentSleep');
      expect(result).toHaveProperty('todayStrain');
      expect(result).toHaveProperty('trends');
      expect(result.trends).toHaveProperty('recovery7d');
      expect(result.trends).toHaveProperty('sleep7d');
      expect(result.trends).toHaveProperty('strain7d');
    });

    test('trends arrays are always arrays (never null)', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await whoopAnalyticsService.getWhoopOverview(userId);

      expect(Array.isArray(result.trends.recovery7d)).toBe(true);
      expect(Array.isArray(result.trends.sleep7d)).toBe(true);
      expect(Array.isArray(result.trends.strain7d)).toBe(true);
    });
  });

  describe('Property-Based Tests', () => {
    const userId = 'test-user-123';

    test('getWhoopOverview is deterministic for same input', async () => {
      const mockData = [
        {
          value: {
            score: { recovery_score: 85, hrv_rmssd_milli: 45000, resting_heart_rate_bpm: 55 },
          },
          recorded_at: new Date('2024-01-10'),
        },
      ];

      mockQuery
        .mockResolvedValueOnce(mockData)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result1 = await whoopAnalyticsService.getWhoopOverview(userId);

      // Reset mocks and call again
      jest.clearAllMocks();
      mockQuery
        .mockResolvedValueOnce(mockData)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result2 = await whoopAnalyticsService.getWhoopOverview(userId);

      // Should produce same result for same input
      expect(result1.currentRecovery?.score).toBe(result2.currentRecovery?.score);
    });
  });
});

