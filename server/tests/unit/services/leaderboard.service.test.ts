/**
 * Leaderboard Service Unit Tests
 */

import { jest } from '@jest/globals';

// Use unstable_mockModule for ESM compatibility
const mockQuery = jest.fn<any>();
const mockRedis = {
  get: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  set: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  delete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
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
};

jest.unstable_mockModule('../../../src/database/pg.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../../src/services/redis-cache.service.js', () => ({
  redisCacheService: mockRedis,
}));

const { leaderboardService } = await import('../../../src/services/leaderboard.service.js');

function qr<T>(rows: T[]) {
  return { rows, rowCount: rows.length, command: 'SELECT' as const, oid: 0, fields: [] };
}

describe('LeaderboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('materializeLeaderboard', () => {
    it('should query daily_user_scores joined with users', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([
          { user_id: 'u1', total_score: 90, component_scores: { workout: 90, nutrition: 80, wellbeing: 85, biometrics: 70, engagement: 65, consistency: 60 }, name: 'User One', avatar: null },
          { user_id: 'u2', total_score: 80, component_scores: { workout: 80, nutrition: 70, wellbeing: 75, biometrics: 60, engagement: 55, consistency: 50 }, name: 'User Two', avatar: 'http://avatar.jpg' },
        ]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([])); // snapshot insert

      await leaderboardService.materializeLeaderboard('global', '2026-02-16');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery.mock.calls[0][0]).toContain('daily_user_scores');
      expect(mockQuery.mock.calls[0][0]).toContain('JOIN users');
    });

    it('should store snapshot in database', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([
          { user_id: 'u1', total_score: 90, component_scores: {}, name: 'User One', avatar: null },
        ]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([])); // snapshot insert

      await leaderboardService.materializeLeaderboard('global', '2026-02-16');

      const snapshotCall = mockQuery.mock.calls[2];
      expect(snapshotCall[0]).toContain('leaderboard_snapshots');
      expect(snapshotCall[0]).toContain('ON CONFLICT');
    });

    it('should update Redis sorted set with scores', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([
          { user_id: 'u1', total_score: 90, component_scores: {}, name: 'User One', avatar: null },
        ]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.materializeLeaderboard('global', '2026-02-16');

      expect(mockRedis.zDelete).toHaveBeenCalledWith('leaderboard:global:2026-02-16');
      expect(mockRedis.zAddMultiple).toHaveBeenCalledWith(
        'leaderboard:global:2026-02-16',
        [{ score: 90, member: 'u1' }]
      );
    });

    it('should set 7-day TTL on Redis key', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([
          { user_id: 'u1', total_score: 90, component_scores: {}, name: 'User', avatar: null },
        ]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.materializeLeaderboard('global', '2026-02-16');

      expect(mockRedis.expire).toHaveBeenCalledWith('leaderboard:global:2026-02-16', 86400 * 7);
    });

    it('should not add to Redis when no members exist', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.materializeLeaderboard('global', '2026-02-16');

      expect(mockRedis.zAddMultiple).not.toHaveBeenCalled();
    });

    it('should include segment in Redis key when provided', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([
          { user_id: 'u1', total_score: 90, component_scores: {}, name: 'User', avatar: null },
        ]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.materializeLeaderboard('competition', '2026-02-16', 100, 'comp-123');

      expect(mockRedis.zDelete).toHaveBeenCalledWith('leaderboard:competition:2026-02-16:comp-123');
    });

    it('should filter by competition entries for competition type', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([])) // self-healing constraint check
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.materializeLeaderboard('competition', '2026-02-16', 100, 'comp-123');

      const sqlQuery = mockQuery.mock.calls[0][0] as string;
      expect(sqlQuery).toContain('competition_entries');
    });
  });

  describe('getLeaderboard', () => {
    it('should return from Redis cache when available', async () => {
      (mockRedis.zRevRange as jest.Mock<any>).mockResolvedValueOnce(['u1', '90', 'u2', '80']);

      // User details queries
      mockQuery
        .mockResolvedValueOnce(qr([{ first_name: 'User', last_name: 'One', avatar: null }]))
        .mockResolvedValueOnce(qr([{ component_scores: { workout: 90, nutrition: 80, wellbeing: 85, biometrics: 70, engagement: 65, consistency: 60 } }]))
        .mockResolvedValueOnce(qr([{ first_name: 'User', last_name: 'Two', avatar: null }]))
        .mockResolvedValueOnce(qr([{ component_scores: { workout: 80, nutrition: 70, wellbeing: 75, biometrics: 60, engagement: 55, consistency: 50 } }]))
        .mockResolvedValueOnce(qr([{ count: '2' }])); // total count

      const result = await leaderboardService.getLeaderboard('global', '2026-02-16');

      expect(result.ranks).toHaveLength(2);
      expect(result.ranks[0].total_score).toBe(90);
      expect(result.ranks[0].rank).toBe(1);
    });

    it('should fall back to database snapshot when Redis empty', async () => {
      (mockRedis.zRevRange as jest.Mock<any>).mockResolvedValueOnce([]);

      const snapshotRanks = [
        { user_id: 'u1', rank: 1, total_score: 90, component_scores: { workout: 90, nutrition: 80, wellbeing: 85, biometrics: 70, engagement: 65, consistency: 60 }, user: { name: 'User One' } },
      ];

      mockQuery
        .mockResolvedValueOnce(qr([{ ranks: snapshotRanks, metadata: {} }])) // snapshot
        .mockResolvedValueOnce(qr([{ count: '1' }])); // total count

      const result = await leaderboardService.getLeaderboard('global', '2026-02-16');

      expect(result.ranks).toHaveLength(1);
    });

    it('should return empty ranks when neither cache nor snapshot exists', async () => {
      (mockRedis.zRevRange as jest.Mock<any>).mockResolvedValueOnce([]);

      mockQuery
        .mockResolvedValueOnce(qr([])) // empty snapshot
        .mockResolvedValueOnce(qr([{ count: '0' }])); // total count

      const result = await leaderboardService.getLeaderboard('global', '2026-02-16');

      expect(result.ranks).toHaveLength(0);
    });

    it('should include pagination metadata', async () => {
      (mockRedis.zRevRange as jest.Mock<any>).mockResolvedValueOnce([]);
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([{ count: '50' }]));

      const result = await leaderboardService.getLeaderboard('global', '2026-02-16', { limit: 10, offset: 5 });

      expect(result.pagination).toEqual({ total: 50, limit: 10, offset: 5 });
    });

    it('should use default limit=100 and offset=0', async () => {
      (mockRedis.zRevRange as jest.Mock<any>).mockResolvedValueOnce([]);
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([{ count: '0' }]));

      const result = await leaderboardService.getLeaderboard('global', '2026-02-16');

      expect(result.pagination.limit).toBe(100);
      expect(result.pagination.offset).toBe(0);
    });
  });

  describe('getAroundMe', () => {
    it('should return empty ranks when user has no score', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      const result = await leaderboardService.getAroundMe('u1', '2026-02-16');

      expect(result.ranks).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return ranks around user position', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ rank_global: 50 }])) // user rank
        .mockResolvedValueOnce(qr([
          { user_id: 'u49', total_score: 81, component_scores: {}, rank_global: 49, first_name: 'User', last_name: '49', avatar: null },
          { user_id: 'u1', total_score: 80, component_scores: {}, rank_global: 50, first_name: 'Test', last_name: 'User', avatar: null },
          { user_id: 'u51', total_score: 79, component_scores: {}, rank_global: 51, first_name: 'User', last_name: '51', avatar: null },
        ]));

      const result = await leaderboardService.getAroundMe('u1', '2026-02-16', 5);

      expect(result.ranks).toHaveLength(3);
      expect(result.type).toBe('global');
    });

    it('should clamp startRank at minimum of 1', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ rank_global: 2 }]))
        .mockResolvedValueOnce(qr([]));

      await leaderboardService.getAroundMe('u1', '2026-02-16', 50);

      const rangeQuery = mockQuery.mock.calls[1];
      // startRank = Math.max(1, 2-50) = 1
      expect(rangeQuery[1]).toContain(1);
    });
  });

  describe('getUserRank', () => {
    it('should return global rank for global type', async () => {
      mockQuery.mockResolvedValueOnce(qr([{ rank: 5 }]));

      const rank = await leaderboardService.getUserRank('u1', '2026-02-16', 'global');

      expect(rank).toBe(5);
      expect((mockQuery.mock.calls[0][0] as string)).toContain('rank_global');
    });

    it('should return country rank for country type', async () => {
      mockQuery.mockResolvedValueOnce(qr([{ rank: 3 }]));

      const rank = await leaderboardService.getUserRank('u1', '2026-02-16', 'country');

      expect(rank).toBe(3);
      expect((mockQuery.mock.calls[0][0] as string)).toContain('rank_country');
    });

    it('should return null when user has no score for date', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      const rank = await leaderboardService.getUserRank('u1', '2026-02-16');

      expect(rank).toBeNull();
    });
  });

  describe('updateRanks', () => {
    it('should execute UPDATE with ROW_NUMBER window function', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      await leaderboardService.updateRanks('2026-02-16');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ROW_NUMBER');
      expect(sql).toContain('ORDER BY dus2.total_score DESC');
    });
  });
});
