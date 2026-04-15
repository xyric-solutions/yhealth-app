/**
 * Competition Service Unit Tests
 *
 * Tests for competition CRUD, enrollment, eligibility, leaderboard,
 * and competition scoring operations.
 */

import { jest } from '@jest/globals';
import type { Competition, CompetitionRules, CompetitionEligibility } from '../../../src/services/competition.service.js';

// ============================================
// MOCKS (unstable_mockModule for ESM)
// ============================================

const mockQuery = jest.fn<any>();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../../src/database/pg.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: mockLogger,
}));

// ============================================
// IMPORTS (dynamic, after mock setup)
// ============================================

const { ApiError } = await import('../../../src/utils/ApiError.js');
type ApiErrorType = InstanceType<typeof ApiError>;
const { competitionService } = await import('../../../src/services/competition.service.js');
const {
  generateCompetitionData,
  generateCompetitionEntryData,
  mockQueryResult,
} = await import('../../helpers/leaderboard.testUtils.js');
const logger = mockLogger;

// ============================================
// HELPERS
// ============================================

/**
 * Build a camelCase Competition object from a snake_case DB row,
 * matching the mapping logic in the service.
 */
function expectedCompetitionFromRow(row: ReturnType<typeof generateCompetitionData>): Competition {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Competition['type'],
    description: (row.description ?? null) as string | null,
    startDate: row.start_date as Date,
    endDate: row.end_date as Date,
    rules: row.rules as CompetitionRules,
    eligibility: row.eligibility as CompetitionEligibility,
    scoringWeights: row.scoring_weights as Record<string, number>,
    antiCheatPolicy: row.anti_cheat_policy as Record<string, unknown>,
    prizeMetadata: row.prize_metadata as Record<string, unknown>,
    status: row.status as Competition['status'],
    createdBy: (row.created_by ?? null) as string | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

// ============================================
// TESTS
// ============================================

describe('CompetitionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------
  // createCompetition
  // ------------------------------------------
  describe('createCompetition', () => {
    it('should insert a competition and return the mapped Competition object', async () => {
      const dbRow = generateCompetitionData();
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);

      const input = {
        name: dbRow.name,
        type: dbRow.type,
        description: dbRow.description,
        startDate: dbRow.start_date,
        endDate: dbRow.end_date,
        rules: dbRow.rules as CompetitionRules,
        eligibility: dbRow.eligibility as CompetitionEligibility,
        scoringWeights: dbRow.scoring_weights as Record<string, number>,
        antiCheatPolicy: dbRow.anti_cheat_policy as Record<string, unknown>,
        prizeMetadata: dbRow.prize_metadata as Record<string, unknown>,
        status: dbRow.status,
        createdBy: dbRow.created_by,
      };

      const result = await competitionService.createCompetition(input);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0];
      expect((callArgs[0] as string)).toContain('INSERT INTO competitions');
      expect(result).toEqual(expectedCompetitionFromRow(dbRow));
    });

    it('should pass null for description when not provided', async () => {
      const dbRow = generateCompetitionData({ description: null });
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);

      const input = {
        name: dbRow.name,
        type: dbRow.type,
        description: null as string | null,
        startDate: dbRow.start_date as Date,
        endDate: dbRow.end_date as Date,
        rules: dbRow.rules as CompetitionRules,
        eligibility: dbRow.eligibility as CompetitionEligibility,
        scoringWeights: dbRow.scoring_weights as Record<string, number>,
        antiCheatPolicy: dbRow.anti_cheat_policy as Record<string, unknown>,
        prizeMetadata: dbRow.prize_metadata as Record<string, unknown>,
        status: dbRow.status as Competition['status'],
        createdBy: null as string | null,
      };

      await competitionService.createCompetition(input);

      const params = mockQuery.mock.calls[0][1] as unknown[];
      // description is the 3rd param (index 2), createdBy is last (index 11)
      expect(params[2]).toBeNull();
      expect(params[11]).toBeNull();
    });
  });

  // ------------------------------------------
  // getCompetition
  // ------------------------------------------
  describe('getCompetition', () => {
    it('should return null when the competition does not exist', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.getCompetition('non-existent-id');

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM competitions WHERE id'),
        ['non-existent-id'],
      );
    });

    it('should return a mapped Competition when found', async () => {
      const dbRow = generateCompetitionData({ id: 'found-id' });
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);

      const result = await competitionService.getCompetition('found-id');

      expect(result).toEqual(expectedCompetitionFromRow(dbRow));
    });
  });

  // ------------------------------------------
  // getActiveCompetitions
  // ------------------------------------------
  describe('getActiveCompetitions', () => {
    it('should return competitions with participant count', async () => {
      const dbRow1 = generateCompetitionData({ id: 'comp-1', participant_count: '5' });
      const dbRow2 = generateCompetitionData({ id: 'comp-2', participant_count: '12' });
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow1, dbRow2]) as never);

      const result = await competitionService.getActiveCompetitions();

      expect(result).toHaveLength(2);
      expect(result[0].participantCount).toBe(5);
      expect(result[1].participantCount).toBe(12);
      expect(result[0].id).toBe('comp-1');
    });

    it('should return an empty array when no competitions are active', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.getActiveCompetitions();

      expect(result).toEqual([]);
    });

    it('should query with correct WHERE clause for active competitions', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      await competitionService.getActiveCompetitions('active');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("c.status = 'active'");
      expect(sql).toContain('c.start_date <= CURRENT_TIMESTAMP');
      expect(sql).toContain('c.end_date >= CURRENT_TIMESTAMP');
    });
  });

  // ------------------------------------------
  // checkEligibility
  // ------------------------------------------
  describe('checkEligibility', () => {
    it('should return true for any user (MVP default)', async () => {
      const competition = expectedCompetitionFromRow(generateCompetitionData());
      const result = await competitionService.checkEligibility('any-user-id', competition);

      expect(result).toBe(true);
    });

    it('should return true even when eligibility criteria are defined', async () => {
      const competition = expectedCompetitionFromRow(
        generateCompetitionData({
          eligibility: {
            regions: ['US', 'UK'],
            subscription_tiers: ['premium'],
          },
        }),
      );

      const result = await competitionService.checkEligibility('user-123', competition);

      expect(result).toBe(true);
    });
  });

  // ------------------------------------------
  // joinCompetition
  // ------------------------------------------
  describe('joinCompetition', () => {
    it('should throw "Competition not found" when competition does not exist', async () => {
      // getCompetition query returns empty
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      await expect(
        competitionService.joinCompetition('user-1', 'invalid-comp-id'),
      ).rejects.toThrow('Competition not found');
    });

    it('should throw "Competition is not active" for a non-active competition', async () => {
      const dbRow = generateCompetitionData({ status: 'ended' });
      // getCompetition returns a non-active competition
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);

      await expect(
        competitionService.joinCompetition('user-1', dbRow.id as string),
      ).rejects.toThrow('Competition is not active');
    });

    it('should throw "Competition is not active" for a draft competition', async () => {
      const dbRow = generateCompetitionData({ status: 'draft' });
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);

      await expect(
        competitionService.joinCompetition('user-1', dbRow.id as string),
      ).rejects.toThrow('Competition is not active');
    });

    it('should throw ApiError.conflict when user has already joined', async () => {
      const dbRow = generateCompetitionData({ status: 'active' });
      // 1. getCompetition returns active competition
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);
      // 2. existing entry check returns a row (already joined)
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'existing-entry' }]) as never);

      await expect(
        competitionService.joinCompetition('user-1', dbRow.id as string),
      ).rejects.toThrow(ApiError);

      try {
        const activeRow = generateCompetitionData({ status: 'active' });
        mockQuery.mockResolvedValueOnce(mockQueryResult([activeRow]) as never);
        mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'dup' }]) as never);
        await competitionService.joinCompetition('user-1', activeRow.id as string);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiErrorType).statusCode).toBe(409);
        expect((err as ApiErrorType).message).toBe('User already joined this competition');
      }
    });

    it('should create an entry and return the mapped CompetitionEntry for a valid request', async () => {
      const compRow = generateCompetitionData({ status: 'active' });
      const entryRow = generateCompetitionEntryData({
        competition_id: compRow.id,
        user_id: 'user-1',
      });

      // 1. getCompetition
      mockQuery.mockResolvedValueOnce(mockQueryResult([compRow]) as never);
      // 2. existing entry check (none found)
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);
      // 3. INSERT entry
      mockQuery.mockResolvedValueOnce(mockQueryResult([entryRow]) as never);

      const result = await competitionService.joinCompetition('user-1', compRow.id as string);

      expect(result.competitionId).toBe(compRow.id);
      expect(result.userId).toBe('user-1');
      expect(result.status).toBe('active');
      expect(result.id).toBe(entryRow.id);
      expect(logger.info).toHaveBeenCalledWith(
        '[Competition] User joined competition',
        expect.objectContaining({ userId: 'user-1', competitionId: compRow.id }),
      );
    });

    it('should correctly parse a numeric current_score on the returned entry', async () => {
      const compRow = generateCompetitionData({ status: 'active' });
      const entryRow = generateCompetitionEntryData({
        competition_id: compRow.id,
        user_id: 'user-2',
        current_score: 88.5,
      });

      mockQuery.mockResolvedValueOnce(mockQueryResult([compRow]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([entryRow]) as never);

      const result = await competitionService.joinCompetition('user-2', compRow.id as string);

      expect(result.currentScore).toBe(88.5);
    });
  });

  // ------------------------------------------
  // getCompetitionLeaderboard
  // ------------------------------------------
  describe('getCompetitionLeaderboard', () => {
    it('should return entries ordered by score and total count', async () => {
      const entry1 = generateCompetitionEntryData({ id: 'e1', current_score: 95, current_rank: 1 });
      const entry2 = generateCompetitionEntryData({ id: 'e2', current_score: 80, current_rank: 2 });

      // 1. COUNT query
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '2' }]) as never);
      // 2. SELECT entries
      mockQuery.mockResolvedValueOnce(mockQueryResult([entry1, entry2]) as never);

      const result = await competitionService.getCompetitionLeaderboard('comp-test-id');

      expect(result.total).toBe(2);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('e1');
      expect(result.entries[0].currentScore).toBe(95);
      expect(result.entries[1].currentScore).toBe(80);
    });

    it('should return total count from the COUNT query', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '42' }]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.getCompetitionLeaderboard('comp-id');

      expect(result.total).toBe(42);
    });

    it('should return empty entries when no participants exist', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '0' }]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.getCompetitionLeaderboard('empty-comp');

      expect(result.total).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it('should respect limit and offset parameters', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '100' }]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      await competitionService.getCompetitionLeaderboard('comp-id', 10, 20);

      // The second query call is the SELECT with LIMIT and OFFSET
      const selectCallParams = mockQuery.mock.calls[1][1] as unknown[];
      expect(selectCallParams).toEqual(['comp-id', 10, 20]);
    });

    it('should use default limit=100 and offset=0 when not specified', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '0' }]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      await competitionService.getCompetitionLeaderboard('comp-id');

      const selectCallParams = mockQuery.mock.calls[1][1] as unknown[];
      expect(selectCallParams).toEqual(['comp-id', 100, 0]);
    });

    it('should return null for currentScore when the DB value is null', async () => {
      const entry = generateCompetitionEntryData({ current_score: null });

      mockQuery.mockResolvedValueOnce(mockQueryResult([{ count: '1' }]) as never);
      mockQuery.mockResolvedValueOnce(mockQueryResult([entry]) as never);

      const result = await competitionService.getCompetitionLeaderboard('comp-test-id');

      expect(result.entries[0].currentScore).toBeNull();
    });
  });

  // ------------------------------------------
  // getUserCompetitionEntries
  // ------------------------------------------
  describe('getUserCompetitionEntries', () => {
    it('should return an array of competition IDs the user has joined', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          { competition_id: 'comp-a' },
          { competition_id: 'comp-b' },
          { competition_id: 'comp-c' },
        ]) as never,
      );

      const result = await competitionService.getUserCompetitionEntries('user-1');

      expect(result).toEqual(['comp-a', 'comp-b', 'comp-c']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT competition_id FROM competition_entries'),
        ['user-1'],
      );
    });

    it('should return an empty array when the user has no entries', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.getUserCompetitionEntries('user-no-entries');

      expect(result).toEqual([]);
    });
  });

  // ------------------------------------------
  // updateCompetitionScores
  // ------------------------------------------
  describe('updateCompetitionScores', () => {
    it('should update scores and ranks for an active competition', async () => {
      const dbRow = generateCompetitionData();
      // First call: getCompetition SELECT
      mockQuery.mockResolvedValueOnce(mockQueryResult([dbRow]) as never);
      // Second call: UPDATE ... FROM ranked CTE
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 } as never);

      const result = await competitionService.updateCompetitionScores(dbRow.id as string);

      expect(result).toEqual({ updatedCount: 3 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        '[Competition] Updated competition scores',
        { competitionId: dbRow.id, updatedCount: 3 },
      );
    });

    it('should return updatedCount 0 when competition not found', async () => {
      // getCompetition returns no rows
      mockQuery.mockResolvedValueOnce(mockQueryResult([]) as never);

      const result = await competitionService.updateCompetitionScores('comp-missing');

      expect(result).toEqual({ updatedCount: 0 });
      expect(logger.warn).toHaveBeenCalledWith(
        '[Competition] Cannot update scores: competition not found',
        { competitionId: 'comp-missing' },
      );
    });
  });
});
