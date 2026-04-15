/**
 * @file Competitions API Integration Tests
 * @description Tests for competition endpoints including listing, joining,
 * leaderboard retrieval, and admin creation. Uses mocked competition service.
 */

import { jest } from '@jest/globals';
import type { Application } from 'express';

// ============================================
// SERVICE MOCKS
// ============================================

const mockCompetitionService = {
  getActiveCompetitions: jest.fn(),
  getCompetition: jest.fn(),
  joinCompetition: jest.fn(),
  getCompetitionLeaderboard: jest.fn(),
  createCompetition: jest.fn(),
  getUserCompetitionEntries: jest.fn(),
  leaveCompetition: jest.fn(),
  checkEligibility: jest.fn(),
  updateCompetitionScores: jest.fn(),
};

const mockAiScoringService = {
  hasScoresForDate: jest.fn<() => Promise<boolean>>(),
  computeScoresForAllUsers: jest.fn<() => Promise<void>>(),
};

jest.unstable_mockModule('../../src/services/competition.service.js', () => ({
  competitionService: mockCompetitionService,
  default: mockCompetitionService,
}));

jest.unstable_mockModule('../../src/services/ai-scoring.service.js', () => ({
  aiScoringService: mockAiScoringService,
  default: mockAiScoringService,
  normalizeComponentScores: (raw: Record<string, number>) => ({
    workout: raw.workout ?? 0,
    nutrition: raw.nutrition ?? 0,
    sleep: raw.sleep ?? 0,
    mindfulness: raw.mindfulness ?? 0,
    engagement: raw.engagement ?? raw.participation ?? 0,
    consistency: raw.consistency ?? 0,
  }),
}));

jest.unstable_mockModule('../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), stream: { write: jest.fn() } },
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { createAuthenticatedUser } = await import('../helpers/testUtils.js');

// ============================================
// TEST DATA FACTORIES
// ============================================

const MOCK_COMP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MOCK_COMP_ID_2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function buildMockCompetition(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_COMP_ID,
    name: 'January Fitness Challenge',
    type: 'admin_created',
    description: 'Complete 30 workouts in January',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-31T23:59:59.000Z'),
    status: 'active',
    rules: { metric: 'workout', aggregation: 'total', target: 30 },
    eligibility: {},
    scoringWeights: { workout: 1.0 },
    antiCheatPolicy: {},
    prizeMetadata: {},
    createdBy: 'admin-user-id',
    createdAt: new Date('2025-12-15T00:00:00.000Z'),
    updatedAt: new Date('2025-12-15T00:00:00.000Z'),
    participantCount: 42,
    ...overrides,
  };
}

// ============================================
// TEST SUITE
// ============================================

describe('Competitions API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------
  // GET /api/v1/competitions/active
  // ------------------------------------------
  describe('GET /api/v1/competitions/active', () => {
    const endpoint = '/api/v1/competitions/active';

    it('should return active competitions', async () => {
      const { accessToken, user: _user } = await createAuthenticatedUser();
      const mockComp = buildMockCompetition();

      mockCompetitionService.getActiveCompetitions.mockResolvedValue([mockComp]);
      mockCompetitionService.getUserCompetitionEntries.mockResolvedValue([MOCK_COMP_ID]);

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('competitions');
      expect(response.body.data.competitions).toHaveLength(1);

      const competition = response.body.data.competitions[0];
      expect(competition.id).toBe(MOCK_COMP_ID);
      expect(competition.name).toBe('January Fitness Challenge');
    });

    it('should handle getUserCompetitionEntries failure gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const mockComp = buildMockCompetition();

      mockCompetitionService.getActiveCompetitions.mockResolvedValue([mockComp]);
      mockCompetitionService.getUserCompetitionEntries.mockRejectedValue(
        new Error('Database connection lost')
      );

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.competitions).toHaveLength(1);
    });
  });

  // ------------------------------------------
  // GET /api/v1/competitions/:id
  // ------------------------------------------
  describe('GET /api/v1/competitions/:id', () => {
    it('should return competition details', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const mockComp = buildMockCompetition();

      mockCompetitionService.getCompetition.mockResolvedValue(mockComp);

      const response = await request(app)
        .get(`/api/v1/competitions/${MOCK_COMP_ID}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('competition');
      expect(response.body.data.competition.id).toBe(MOCK_COMP_ID);
      expect(response.body.data.competition.name).toBe('January Fitness Challenge');
    });

    it('should return 404 for non-existent competition', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      mockCompetitionService.getCompetition.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/competitions/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid UUID', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/v1/competitions/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ------------------------------------------
  // POST /api/v1/competitions/:id/join
  // ------------------------------------------
  describe('POST /api/v1/competitions/:id/join', () => {
    it('should return 401 without auth token', async () => {
      await request(app)
        .post(`/api/v1/competitions/${MOCK_COMP_ID}/join`)
        .expect(401);
    });

    it('should join competition successfully', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      const mockEntry = {
        id: MOCK_COMP_ID_2,
        competitionId: MOCK_COMP_ID,
        userId: user.id,
        status: 'active',
        joinedAt: new Date().toISOString(),
      };

      mockCompetitionService.joinCompetition.mockResolvedValue(mockEntry);

      const response = await request(app)
        .post(`/api/v1/competitions/${MOCK_COMP_ID}/join`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('entry');
    });
  });

  // ------------------------------------------
  // GET /api/v1/competitions/:id/leaderboard
  // ------------------------------------------
  describe('GET /api/v1/competitions/:id/leaderboard', () => {
    it('should return competition leaderboard', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const mockComp = buildMockCompetition();
      const mockLeaderboard = {
        entries: [
          { rank: 1, userId: 'user-a', currentRank: 1, currentScore: 950, displayName: 'Alice' },
          { rank: 2, userId: 'user-b', currentRank: 2, currentScore: 870, displayName: 'Bob' },
          { rank: 3, userId: 'user-c', currentRank: 3, currentScore: 810, displayName: 'Charlie' },
        ],
        total: 3,
      };

      // Controller calls getCompetition first for date range
      mockCompetitionService.getCompetition.mockResolvedValue(mockComp);
      mockAiScoringService.hasScoresForDate.mockResolvedValue(true);
      mockCompetitionService.updateCompetitionScores.mockResolvedValue(undefined);
      mockCompetitionService.getCompetitionLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get(`/api/v1/competitions/${MOCK_COMP_ID}/leaderboard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  // ------------------------------------------
  // POST /api/v1/competitions (admin create)
  // ------------------------------------------
  describe('POST /api/v1/competitions', () => {
    const endpoint = '/api/v1/competitions';

    it('should return 401 without auth token', async () => {
      await request(app)
        .post(endpoint)
        .send({ name: 'Test Competition' })
        .expect(401);
    });

    it('should create competition successfully', async () => {
      const { accessToken, user } = await createAuthenticatedUser();
      const competitionPayload = {
        name: 'February Step Challenge',
        type: 'admin_created',
        description: 'Walk 10,000 steps daily for the entire month',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T23:59:59.000Z',
        rules: { metric: 'participation', aggregation: 'streak', target: 28 },
        eligibility: {},
        scoringWeights: { participation: 1.0 },
        antiCheatPolicy: {},
        prizeMetadata: { badge: 'february-walker' },
      };

      const createdCompetition = {
        id: MOCK_COMP_ID_2,
        ...competitionPayload,
        startDate: new Date(competitionPayload.startDate),
        endDate: new Date(competitionPayload.endDate),
        status: 'draft',
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCompetitionService.createCompetition.mockResolvedValue(createdCompetition);

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(competitionPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('competition');
      expect(response.body.data.competition.name).toBe('February Step Challenge');
    });
  });
});
