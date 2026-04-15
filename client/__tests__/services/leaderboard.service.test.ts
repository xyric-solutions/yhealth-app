/**
 * Leaderboard Service Tests
 *
 * Comprehensive unit tests for the client-side leaderboard service.
 * Covers all 10 exported async functions, retry logic with exponential backoff,
 * error handling for API failures, and response normalization for wrapped payloads.
 *
 * @module __tests__/services/leaderboard.service.test
 */

// ---------------------------------------------------------------------------
// Mock: @/lib/api-client
// ---------------------------------------------------------------------------
// The leaderboard service imports { api, ApiError } from '@/lib/api-client'.
// We provide both the named `api` export and the `default` export so either
// import style resolves to the same mock object.
// NOTE: ApiError class MUST be defined inside the factory because @swc/jest
// hoists jest.mock() above all other statements (temporal dead zone).
// ---------------------------------------------------------------------------

jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  api: { get: jest.fn(), post: jest.fn() },
  ApiError: class ApiError extends Error {
    statusCode: number;
    code: string;
    details?: unknown;
    constructor(message: string, statusCode: number, code: string, details?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    }
  },
}));

// Import the mocked module and the service functions under test.
import { api } from '@/lib/api-client';
import {
  getDailyLeaderboard,
  getLeaderboardAroundMe,
  getMyRank,
  getDailyScore,
  getActiveCompetitions,
  getCompetition,
  getCompetitionLeaderboard,
  joinCompetition,
  getScoreHistory,
  submitActivityEvents,
} from '@/src/shared/services/leaderboard.service';

// Re-acquire mock references in beforeEach to survive resetMocks
let mockGet: jest.Mock;
let mockPost: jest.Mock;

// Retrieve the ApiError class from the mock for use in test assertions
const { ApiError: ApiErrorMock } = jest.requireMock<{ ApiError: new (message: string, statusCode: number, code: string, details?: unknown) => Error }>('@/lib/api-client');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = '2026-02-16';

const mockComponentScores = {
  workout: 25,
  nutrition: 20,
  wellbeing: 15,
  participation: 10,
};

const mockLeaderboardEntry = {
  user_id: 'user-001',
  rank: 1,
  total_score: 70,
  component_scores: mockComponentScores,
  user: { name: 'Alice', avatar: 'https://example.com/alice.png' },
};

const mockLeaderboardResponse = {
  date: FIXED_DATE,
  type: 'global' as const,
  segment: null,
  ranks: [mockLeaderboardEntry],
  pagination: { total: 1, limit: 100, offset: 0 },
};

const mockDailyScore = {
  date: FIXED_DATE,
  total_score: 70,
  component_scores: mockComponentScores,
  explanation: 'Great workout today',
  rank: { global: 5, country: 2, friends: 1 },
};

const mockCompetition = {
  id: 'comp-001',
  name: 'February Fitness Challenge',
  type: 'admin_created' as const,
  description: 'A month-long fitness challenge',
  start_date: '2026-02-01',
  end_date: '2026-02-28',
  status: 'active' as const,
  rules: { min_daily_score: 10 },
};

const mockCompetitionEntry = {
  id: 'entry-001',
  competition_id: 'comp-001',
  user_id: 'user-001',
  joined_at: '2026-02-10T08:00:00Z',
  status: 'active' as const,
  current_rank: 3,
  current_score: 250,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful ApiResponse wrapper. */
function successResponse<T>(data: T) {
  return { success: true, data };
}

/** Build a failed ApiResponse wrapper (no data). */
function failureResponse(message: string, code: string) {
  return { success: false, error: { message, code } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Leaderboard Service', () => {
  beforeEach(() => {
    // Re-acquire mock references each test (resetMocks replaces fn instances)
    mockGet = api.get as jest.Mock;
    mockPost = api.post as jest.Mock;
    // Pin Date for deterministic "today" value used by service defaults.
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(`${FIXED_DATE}T12:00:00.000Z`);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // =========================================================================
  // getDailyLeaderboard
  // =========================================================================

  describe('getDailyLeaderboard', () => {
    it('should fetch leaderboard with default parameters', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      const result = await getDailyLeaderboard({});

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith('/leaderboards/daily', {
        params: {
          date: FIXED_DATE,
          type: 'global',
          segment: undefined,
          limit: 100,
          offset: 0,
        },
        signal: undefined,
      });
      expect(result).toEqual(mockLeaderboardResponse);
    });

    it('should pass custom parameters through to the API', async () => {
      const customResponse = {
        ...mockLeaderboardResponse,
        type: 'country',
        segment: 'KE',
        pagination: { total: 50, limit: 25, offset: 10 },
      };
      mockGet.mockResolvedValueOnce(successResponse(customResponse));

      const controller = new AbortController();
      const result = await getDailyLeaderboard({
        date: '2026-01-01',
        type: 'country',
        segment: 'KE',
        limit: 25,
        offset: 10,
        signal: controller.signal,
      });

      expect(mockGet).toHaveBeenCalledWith('/leaderboards/daily', {
        params: {
          date: '2026-01-01',
          type: 'country',
          segment: 'KE',
          limit: 25,
          offset: 10,
        },
        signal: controller.signal,
      });
      expect(result).toEqual(customResponse);
    });

    it('should throw when response.success is false', async () => {
      mockGet.mockResolvedValueOnce(
        failureResponse('Server overloaded', 'OVERLOADED')
      );

      await expect(getDailyLeaderboard({})).rejects.toThrow('Server overloaded');
    });

    it('should throw when response.data is null/undefined', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: null });

      await expect(getDailyLeaderboard({})).rejects.toThrow(
        'Failed to fetch leaderboard'
      );
    });

    it('should retry up to 3 times on 5xx ApiError with exponential backoff', async () => {
      jest.useFakeTimers();

      const serverError = new ApiErrorMock('Internal Server Error', 500, 'INTERNAL');

      // Fail 3 times, succeed on the 4th attempt (initial + 3 retries)
      mockGet
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      const promise = getDailyLeaderboard({});

      // 1st retry delay: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      // 2nd retry delay: 2000ms
      await jest.advanceTimersByTimeAsync(2000);
      // 3rd retry delay: 4000ms
      await jest.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(result).toEqual(mockLeaderboardResponse);
      expect(mockGet).toHaveBeenCalledTimes(4);
    });

    it('should throw immediately on 4xx ApiError without retrying', async () => {
      const clientError = new ApiErrorMock('Not Found', 404, 'NOT_FOUND');
      mockGet.mockRejectedValueOnce(clientError);

      await expect(getDailyLeaderboard({})).rejects.toThrow('Not Found');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should throw immediately on non-ApiError without retrying', async () => {
      mockGet.mockRejectedValueOnce(new TypeError('Network failure'));

      await expect(getDailyLeaderboard({})).rejects.toThrow('Network failure');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw when all attempts fail with 5xx', async () => {
      jest.useFakeTimers();

      const serverError = new ApiErrorMock('Bad Gateway', 502, 'BAD_GATEWAY');

      // 1 initial + 3 retries = 4 calls, all fail
      mockGet
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError);

      // Capture rejection expectation BEFORE advancing timers to avoid
      // unhandled promise rejection race condition
      const promise = getDailyLeaderboard({});
      const expectation = expect(promise).rejects.toThrow('Bad Gateway');

      // Advance through all retry delays
      await jest.runAllTimersAsync();

      await expectation;
      expect(mockGet).toHaveBeenCalledTimes(4);
    });
  });

  // =========================================================================
  // getLeaderboardAroundMe
  // =========================================================================

  describe('getLeaderboardAroundMe', () => {
    it('should fetch with default parameters (range 50, type global)', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      const result = await getLeaderboardAroundMe({});

      expect(mockGet).toHaveBeenCalledWith('/leaderboards/daily/around-me', {
        params: {
          date: FIXED_DATE,
          type: 'global',
          range: 50,
        },
        signal: undefined,
      });
      expect(result).toEqual(mockLeaderboardResponse);
    });

    it('should pass custom range and type', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      await getLeaderboardAroundMe({
        date: '2026-01-15',
        type: 'friends',
        range: 10,
      });

      expect(mockGet).toHaveBeenCalledWith('/leaderboards/daily/around-me', {
        params: {
          date: '2026-01-15',
          type: 'friends',
          range: 10,
        },
        signal: undefined,
      });
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(failureResponse('Unauthorized', 'AUTH_ERROR'));

      await expect(getLeaderboardAroundMe({})).rejects.toThrow('Unauthorized');
    });
  });

  // =========================================================================
  // getMyRank
  // =========================================================================

  describe('getMyRank', () => {
    it('should return rank and total score', async () => {
      const rankData = { rank: 42, total_score: 65 };
      mockGet.mockResolvedValueOnce(successResponse(rankData));

      const result = await getMyRank({});

      expect(mockGet).toHaveBeenCalledWith('/leaderboards/daily/my-rank', {
        params: {
          date: FIXED_DATE,
          type: 'global',
        },
        signal: undefined,
      });
      expect(result).toEqual(rankData);
    });

    it('should handle null rank for unranked users', async () => {
      const unrankedData = { rank: null, total_score: 0 };
      mockGet.mockResolvedValueOnce(successResponse(unrankedData));

      const result = await getMyRank({});

      expect(result.rank).toBeNull();
      expect(result.total_score).toBe(0);
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(failureResponse('Service unavailable', 'UNAVAILABLE'));

      await expect(getMyRank({})).rejects.toThrow();
    });
  });

  // =========================================================================
  // getDailyScore
  // =========================================================================

  describe('getDailyScore', () => {
    it('should fetch score for a specific date', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockDailyScore));

      const result = await getDailyScore('2026-02-10');

      expect(mockGet).toHaveBeenCalledWith('/daily-score', {
        params: { date: '2026-02-10' },
        signal: undefined,
      });
      expect(result).toEqual(mockDailyScore);
    });

    it('should send empty params when no date is provided', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockDailyScore));

      const result = await getDailyScore();

      expect(mockGet).toHaveBeenCalledWith('/daily-score', {
        params: {},
        signal: undefined,
      });
      expect(result).toEqual(mockDailyScore);
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(failureResponse('Score not found', 'NOT_FOUND'));

      await expect(getDailyScore('2026-02-10')).rejects.toThrow('Score not found');
    });
  });

  // =========================================================================
  // getActiveCompetitions
  // =========================================================================

  describe('getActiveCompetitions', () => {
    it('should return competitions when response is a direct array', async () => {
      const competitions = [mockCompetition];
      mockGet.mockResolvedValueOnce(successResponse(competitions));

      const result = await getActiveCompetitions();

      expect(mockGet).toHaveBeenCalledWith('/competitions', {
        params: { status: 'active' },
        signal: undefined,
      });
      expect(result).toEqual(competitions);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should unwrap competitions from a wrapped { competitions: [...] } response', async () => {
      const competitions = [mockCompetition];
      // The API sometimes returns a wrapped object instead of a direct array
      mockGet.mockResolvedValueOnce(
        successResponse({ competitions })
      );

      const result = await getActiveCompetitions();

      expect(result).toEqual(competitions);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when wrapped response has no competitions key', async () => {
      mockGet.mockResolvedValueOnce(successResponse({}));

      const result = await getActiveCompetitions();

      expect(result).toEqual([]);
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(failureResponse('Forbidden', 'FORBIDDEN'));

      await expect(getActiveCompetitions()).rejects.toThrow('Forbidden');
    });
  });

  // =========================================================================
  // getCompetition
  // =========================================================================

  describe('getCompetition', () => {
    it('should fetch a single competition by ID', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockCompetition));

      const result = await getCompetition('comp-001');

      expect(mockGet).toHaveBeenCalledWith('/competitions/comp-001', {
        signal: undefined,
      });
      expect(result).toEqual(mockCompetition);
    });

    it('should throw when competition is not found', async () => {
      mockGet.mockResolvedValueOnce(
        failureResponse('Competition not found', 'NOT_FOUND')
      );

      await expect(getCompetition('comp-999')).rejects.toThrow(
        'Competition not found'
      );
    });
  });

  // =========================================================================
  // getCompetitionLeaderboard
  // =========================================================================

  describe('getCompetitionLeaderboard', () => {
    it('should fetch with default pagination (limit 100, offset 0)', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      const result = await getCompetitionLeaderboard('comp-001');

      expect(mockGet).toHaveBeenCalledWith('/competitions/comp-001/leaderboard', {
        params: { limit: 100, offset: 0 },
        signal: undefined,
      });
      expect(result).toEqual(mockLeaderboardResponse);
    });

    it('should pass custom limit and offset', async () => {
      mockGet.mockResolvedValueOnce(successResponse(mockLeaderboardResponse));

      await getCompetitionLeaderboard('comp-001', { limit: 25, offset: 50 });

      expect(mockGet).toHaveBeenCalledWith('/competitions/comp-001/leaderboard', {
        params: { limit: 25, offset: 50 },
        signal: undefined,
      });
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(
        failureResponse('Leaderboard unavailable', 'UNAVAILABLE')
      );

      await expect(getCompetitionLeaderboard('comp-001')).rejects.toThrow(
        'Leaderboard unavailable'
      );
    });
  });

  // =========================================================================
  // joinCompetition
  // =========================================================================

  describe('joinCompetition', () => {
    it('should POST to join a competition and return the entry', async () => {
      mockPost.mockResolvedValueOnce(successResponse(mockCompetitionEntry));

      const result = await joinCompetition('comp-001');

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('/competitions/comp-001/join');
      expect(result).toEqual(mockCompetitionEntry);
    });

    it('should throw when join fails (e.g. already joined)', async () => {
      mockPost.mockResolvedValueOnce(
        failureResponse('Already joined', 'DUPLICATE_ENTRY')
      );

      await expect(joinCompetition('comp-001')).rejects.toThrow('Already joined');
    });

    it('should throw when response data is missing', async () => {
      mockPost.mockResolvedValueOnce({ success: true, data: null });

      await expect(joinCompetition('comp-001')).rejects.toThrow(
        'Failed to join competition'
      );
    });
  });

  // =========================================================================
  // getScoreHistory
  // =========================================================================

  describe('getScoreHistory', () => {
    const scores = [
      { ...mockDailyScore, date: '2026-02-14' },
      { ...mockDailyScore, date: '2026-02-15' },
    ];

    it('should return scores when response is a direct array', async () => {
      mockGet.mockResolvedValueOnce(successResponse(scores));

      const result = await getScoreHistory({
        startDate: '2026-02-14',
        endDate: '2026-02-15',
        limit: 10,
      });

      expect(mockGet).toHaveBeenCalledWith('/daily-score/history', {
        params: {
          startDate: '2026-02-14',
          endDate: '2026-02-15',
          limit: 10,
        },
        signal: undefined,
      });
      expect(result).toEqual(scores);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should unwrap scores from a wrapped { scores: [...] } response', async () => {
      mockGet.mockResolvedValueOnce(successResponse({ scores }));

      const result = await getScoreHistory();

      expect(result).toEqual(scores);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when wrapped response has no scores key', async () => {
      mockGet.mockResolvedValueOnce(successResponse({}));

      const result = await getScoreHistory();

      expect(result).toEqual([]);
    });

    it('should throw when response indicates failure', async () => {
      mockGet.mockResolvedValueOnce(
        failureResponse('History unavailable', 'UNAVAILABLE')
      );

      await expect(getScoreHistory()).rejects.toThrow('History unavailable');
    });
  });

  // =========================================================================
  // submitActivityEvents
  // =========================================================================

  describe('submitActivityEvents', () => {
    const events = [
      {
        type: 'workout' as const,
        source: 'manual' as const,
        timestamp: '2026-02-16T10:00:00Z',
        payload: { duration_minutes: 45, exercise: 'running' },
      },
      {
        type: 'nutrition' as const,
        source: 'manual' as const,
        timestamp: '2026-02-16T12:00:00Z',
        payload: { meal: 'lunch', calories: 550 },
      },
    ];

    it('should POST events and return success result', async () => {
      const responseData = { success: true, processed: 2 };
      mockPost.mockResolvedValueOnce(successResponse(responseData));

      const result = await submitActivityEvents(events);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('/activity-events', { events });
      expect(result).toEqual(responseData);
    });

    it('should throw when submission fails', async () => {
      mockPost.mockResolvedValueOnce(
        failureResponse('Validation failed', 'VALIDATION_ERROR')
      );

      await expect(submitActivityEvents(events)).rejects.toThrow(
        'Validation failed'
      );
    });

    it('should throw when response data is missing', async () => {
      mockPost.mockResolvedValueOnce({ success: true, data: undefined });

      await expect(submitActivityEvents(events)).rejects.toThrow(
        'Failed to submit activity events'
      );
    });
  });

  // =========================================================================
  // withRetry (tested implicitly via getDailyLeaderboard)
  // =========================================================================

  describe('withRetry (implicit via API calls)', () => {
    it('should use exponential backoff: 1s, 2s, 4s between retries', async () => {
      jest.useFakeTimers();

      const serverError = new ApiErrorMock('Service Unavailable', 503, 'UNAVAILABLE');

      mockGet
        .mockRejectedValueOnce(serverError)  // attempt 1 - fail
        .mockRejectedValueOnce(serverError)  // attempt 2 - fail (after 1s)
        .mockRejectedValueOnce(serverError)  // attempt 3 - fail (after 2s)
        .mockResolvedValueOnce(successResponse(mockLeaderboardResponse)); // attempt 4 - success (after 4s)

      const promise = getDailyLeaderboard({});

      // After 999ms only 1 call should have been made
      await jest.advanceTimersByTimeAsync(999);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // At 1000ms the first retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockGet).toHaveBeenCalledTimes(2);

      // After another 1999ms (total ~3000ms) still only 2 calls
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockGet).toHaveBeenCalledTimes(2);

      // At 2000ms after the 2nd call, the second retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockGet).toHaveBeenCalledTimes(3);

      // After another 3999ms still only 3 calls
      await jest.advanceTimersByTimeAsync(3999);
      expect(mockGet).toHaveBeenCalledTimes(3);

      // At 4000ms after the 3rd call, the third retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockGet).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toEqual(mockLeaderboardResponse);
    });

    it('should not retry on 400 Bad Request', async () => {
      const badRequest = new ApiErrorMock('Bad Request', 400, 'BAD_REQUEST');
      mockGet.mockRejectedValueOnce(badRequest);

      await expect(getDailyLeaderboard({})).rejects.toThrow('Bad Request');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 Unauthorized', async () => {
      const unauthorized = new ApiErrorMock('Unauthorized', 401, 'UNAUTHORIZED');
      mockGet.mockRejectedValueOnce(unauthorized);

      await expect(getDailyLeaderboard({})).rejects.toThrow('Unauthorized');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 Forbidden', async () => {
      const forbidden = new ApiErrorMock('Forbidden', 403, 'FORBIDDEN');
      mockGet.mockRejectedValueOnce(forbidden);

      await expect(getDailyLeaderboard({})).rejects.toThrow('Forbidden');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 422 Unprocessable Entity', async () => {
      const unprocessable = new ApiErrorMock('Validation Error', 422, 'VALIDATION');
      mockGet.mockRejectedValueOnce(unprocessable);

      await expect(getDailyLeaderboard({})).rejects.toThrow('Validation Error');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on generic Error (non-ApiError)', async () => {
      mockGet.mockRejectedValueOnce(new Error('Something unexpected'));

      await expect(getDailyLeaderboard({})).rejects.toThrow('Something unexpected');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on TypeError (non-ApiError)', async () => {
      mockGet.mockRejectedValueOnce(new TypeError('Cannot read properties'));

      await expect(getDailyLeaderboard({})).rejects.toThrow('Cannot read properties');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should retry POST calls on 5xx errors via joinCompetition', async () => {
      jest.useFakeTimers();

      const serverError = new ApiErrorMock('Gateway Timeout', 504, 'GATEWAY_TIMEOUT');

      mockPost
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse(mockCompetitionEntry));

      const promise = joinCompetition('comp-001');

      // Advance past the first retry delay (1000ms)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toEqual(mockCompetitionEntry);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });
});
