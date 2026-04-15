/**
 * Leaderboard API Integration Tests
 */

import { jest } from '@jest/globals';
import type { Application } from 'express';

// Mock leaderboard service before any imports that might use it
const mockLeaderboardService = {
  getLeaderboard: jest.fn(),
  getAroundMe: jest.fn(),
  getUserRank: jest.fn(),
  materializeLeaderboard: jest.fn(),
  updateRanks: jest.fn(),
};

jest.unstable_mockModule('../../src/services/leaderboard.service.js', () => ({
  leaderboardService: mockLeaderboardService,
  default: mockLeaderboardService,
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { createAuthenticatedUser } = await import('../helpers/testUtils.js');

describe('Leaderboard API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // GET /api/v1/leaderboards/daily
  // ============================================================

  describe('GET /api/v1/leaderboards/daily', () => {
    const endpoint = '/api/v1/leaderboards/daily';

    const mockLeaderboardResponse = {
      date: '2026-02-16',
      type: 'global',
      segment: null,
      ranks: [
        {
          userId: 'user-001',
          rank: 1,
          totalScore: 95.5,
          componentScores: {
            workout: 30,
            nutrition: 25,
            wellbeing: 20,
            participation: 20.5,
          },
          user: { name: 'Alice Smith', avatar: undefined },
        },
        {
          userId: 'user-002',
          rank: 2,
          totalScore: 88.0,
          componentScores: {
            workout: 25,
            nutrition: 23,
            wellbeing: 22,
            participation: 18,
          },
          user: { name: 'Bob Jones', avatar: undefined },
        },
      ],
      pagination: { total: 2, limit: 100, offset: 0 },
    };

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return leaderboard with default params', async () => {
      const { accessToken } = await createAuthenticatedUser();
      mockLeaderboardService.getLeaderboard.mockResolvedValue(mockLeaderboardResponse);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('date');
      expect(response.body.data).toHaveProperty('type', 'global');
      expect(response.body.data).toHaveProperty('ranks');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.ranks).toHaveLength(2);
      expect(response.body.data.ranks[0]).toHaveProperty('userId', 'user-001');
      expect(response.body.data.ranks[0]).toHaveProperty('rank', 1);
      expect(response.body.data.ranks[0]).toHaveProperty('totalScore', 95.5);
      expect(response.body.data.ranks[0]).toHaveProperty('componentScores');
      expect(response.body.message).toBe('Leaderboard retrieved successfully');

      // Verify service called with default params
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledTimes(1);
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'global',
        expect.any(String),
        {
          segment: undefined,
          limit: undefined,
          offset: undefined,
        }
      );
    });

    it('should pass type query param to service', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const countryResponse = {
        ...mockLeaderboardResponse,
        type: 'country',
      };
      mockLeaderboardService.getLeaderboard.mockResolvedValue(countryResponse);

      const response = await request(app)
        .get(endpoint)
        .query({ type: 'country' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('country');
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'country',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should pass date query param to service', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const specificDate = '2026-01-15';
      const datedResponse = {
        ...mockLeaderboardResponse,
        date: specificDate,
      };
      mockLeaderboardService.getLeaderboard.mockResolvedValue(datedResponse);

      const response = await request(app)
        .get(endpoint)
        .query({ date: specificDate })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.date).toBe(specificDate);
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'global',
        specificDate,
        expect.any(Object)
      );
    });

    it('should pass limit and offset query params', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const paginatedResponse = {
        ...mockLeaderboardResponse,
        ranks: [mockLeaderboardResponse.ranks[0]],
        pagination: { total: 2, limit: 1, offset: 1 },
      };
      mockLeaderboardService.getLeaderboard.mockResolvedValue(paginatedResponse);

      const response = await request(app)
        .get(endpoint)
        .query({ limit: '1', offset: '1' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(1);
      expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
        'global',
        expect.any(String),
        {
          segment: undefined,
          limit: 1,
          offset: 1,
        }
      );
    });
  });

  // ============================================================
  // GET /api/v1/leaderboards/daily/around-me
  // ============================================================

  describe('GET /api/v1/leaderboards/daily/around-me', () => {
    const endpoint = '/api/v1/leaderboards/daily/around-me';

    const mockAroundMeResponse = {
      date: '2026-02-16',
      type: 'global',
      segment: null,
      ranks: [
        {
          userId: 'user-010',
          rank: 48,
          totalScore: 72.0,
          componentScores: {
            workout: 20,
            nutrition: 18,
            wellbeing: 17,
            participation: 17,
          },
          user: { name: 'Nearby User A', avatar: undefined },
        },
        {
          userId: 'user-011',
          rank: 49,
          totalScore: 70.5,
          componentScores: {
            workout: 19,
            nutrition: 18,
            wellbeing: 16,
            participation: 17.5,
          },
          user: { name: 'Current User', avatar: undefined },
        },
        {
          userId: 'user-012',
          rank: 50,
          totalScore: 69.0,
          componentScores: {
            workout: 18,
            nutrition: 17,
            wellbeing: 17,
            participation: 17,
          },
          user: { name: 'Nearby User B', avatar: undefined },
        },
      ],
      pagination: { total: 3, limit: 101, offset: 0 },
    };

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return around-me leaderboard', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      mockLeaderboardService.getAroundMe.mockResolvedValue(mockAroundMeResponse);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('date');
      expect(response.body.data).toHaveProperty('type', 'global');
      expect(response.body.data).toHaveProperty('ranks');
      expect(response.body.data.ranks).toHaveLength(3);
      expect(response.body.message).toBe('Around me leaderboard retrieved successfully');

      // Verify service called with user ID and default range
      expect(mockLeaderboardService.getAroundMe).toHaveBeenCalledTimes(1);
      expect(mockLeaderboardService.getAroundMe).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        50
      );
    });

    it('should pass range query param to service', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      mockLeaderboardService.getAroundMe.mockResolvedValue(mockAroundMeResponse);

      await request(app)
        .get(endpoint)
        .query({ range: '25' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(mockLeaderboardService.getAroundMe).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        25
      );
    });

    it('should return empty ranks when user has no score', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const emptyResponse = {
        date: '2026-02-16',
        type: 'global',
        segment: null,
        ranks: [],
        pagination: { total: 0, limit: 101, offset: 0 },
      };
      mockLeaderboardService.getAroundMe.mockResolvedValue(emptyResponse);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ranks).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  // ============================================================
  // GET /api/v1/leaderboards/daily/my-rank
  // ============================================================

  describe('GET /api/v1/leaderboards/daily/my-rank', () => {
    const endpoint = '/api/v1/leaderboards/daily/my-rank';

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return user rank', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      mockLeaderboardService.getUserRank.mockResolvedValue(42);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rank', 42);
      expect(response.body.message).toBe('User rank retrieved successfully');

      expect(mockLeaderboardService.getUserRank).toHaveBeenCalledTimes(1);
      expect(mockLeaderboardService.getUserRank).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        'global'
      );
    });

    it('should return null rank when user has no score', async () => {
      const { accessToken } = await createAuthenticatedUser();
      mockLeaderboardService.getUserRank.mockResolvedValue(null);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rank', null);
    });

    it('should pass type param to service', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      mockLeaderboardService.getUserRank.mockResolvedValue(7);

      const response = await request(app)
        .get(endpoint)
        .query({ type: 'country' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toBe(7);
      expect(mockLeaderboardService.getUserRank).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        'country'
      );
    });
  });

  // ============================================================
  // 404 Handler
  // ============================================================

  describe('404 Handler', () => {
    it('should return 404 for non-existent endpoint', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/v1/leaderboards/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});
