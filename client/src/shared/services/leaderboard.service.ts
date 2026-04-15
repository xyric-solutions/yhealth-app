import { api, ApiError } from '@/lib/api-client';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function for retry logic
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (error instanceof ApiError && error.statusCode >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// ============================================
// TYPES
// ============================================

export type BoardType = 'global' | 'country' | 'friends' | 'competition';
export type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'all-time';

export interface ComponentScores {
  workout: number;
  nutrition: number;
  wellbeing: number;
  biometrics: number;
  engagement: number;
  consistency: number;
  /** @deprecated Use `engagement` instead. Kept for backward compat with old API responses. */
  participation?: number;
}

export interface LeaderboardEntry {
  user_id: string;
  rank: number;
  total_score: number;
  component_scores: ComponentScores;
  user?: {
    name: string;
    avatar?: string;
    email?: string;
  };
}

export interface LeaderboardResponse {
  date: string;
  type: BoardType;
  segment: string | null;
  ranks: LeaderboardEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface DailyScore {
  date: string;
  total_score: number;
  component_scores: ComponentScores;
  explanation: string;
  rank: {
    global: number | null;
    country: number | null;
    friends: number | null;
  };
}

export interface Competition {
  id: string;
  name: string;
  type: 'ai_generated' | 'admin_created';
  description: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'ended';
  rules: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  scoring_weights?: Record<string, number>;
  prize_metadata?: {
    badges?: string[];
    rewards?: string[];
  };
}

export interface CompetitionEntry {
  id: string;
  competition_id: string;
  user_id: string;
  joined_at: string;
  status: 'active' | 'disqualified' | 'completed' | 'withdrawn';
  current_rank: number | null;
  current_score: number | null;
  user?: {
    name: string;
    avatar?: string;
  };
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get daily leaderboard
 */
export async function getDailyLeaderboard(params: {
  date?: string;
  type?: BoardType;
  segment?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<LeaderboardResponse> {
  return withRetry(async () => {
    const response = await api.get<LeaderboardResponse>('/leaderboards/daily', {
      params: {
        date: params.date || new Date().toISOString().split('T')[0],
        type: params.type || 'global',
        segment: params.segment,
        limit: params.limit || 100,
        offset: params.offset || 0,
      },
      signal: params.signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch leaderboard',
        0,
        response.error?.code || 'LEADERBOARD_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Get leaderboard around user (ranks above and below)
 */
export async function getLeaderboardAroundMe(params: {
  date?: string;
  type?: BoardType;
  range?: number;
  signal?: AbortSignal;
}): Promise<LeaderboardResponse> {
  return withRetry(async () => {
    const response = await api.get<LeaderboardResponse>('/leaderboards/daily/around-me', {
      params: {
        date: params.date || new Date().toISOString().split('T')[0],
        type: params.type || 'global',
        range: params.range || 50,
      },
      signal: params.signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch leaderboard',
        0,
        response.error?.code || 'LEADERBOARD_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Get user's current rank
 */
export async function getMyRank(params: {
  date?: string;
  type?: BoardType;
  signal?: AbortSignal;
}): Promise<{ rank: number | null; total_score: number }> {
  return withRetry(async () => {
    const response = await api.get<{ rank: number | null; total_score: number }>('/leaderboards/daily/my-rank', {
      params: {
        date: params.date || new Date().toISOString().split('T')[0],
        type: params.type || 'global',
      },
      signal: params.signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch user rank',
        0,
        response.error?.code || 'RANK_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Get user's daily score
 */
export async function getDailyScore(date?: string, signal?: AbortSignal): Promise<DailyScore> {
  return withRetry(async () => {
    const response = await api.get<DailyScore>('/daily-score', {
      params: date ? { date } : {},
      signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch daily score',
        0,
        response.error?.code || 'SCORE_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Get active competitions
 */
export async function getActiveCompetitions(signal?: AbortSignal): Promise<Competition[]> {
  return withRetry(async () => {
    const response = await api.get<Competition[]>('/competitions', {
      params: { status: 'active' },
      signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch competitions',
        0,
        response.error?.code || 'COMPETITIONS_FETCH_ERROR',
        response.error?.details
      );
    }

    // Handle both array and wrapped response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data as unknown as { competitions: Competition[] }).competitions || [];
  });
}

/**
 * Get competition details
 */
export async function getCompetition(competitionId: string, signal?: AbortSignal): Promise<Competition> {
  return withRetry(async () => {
    const response = await api.get<Competition>(`/competitions/${competitionId}`, {
      signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch competition',
        0,
        response.error?.code || 'COMPETITION_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Get competition leaderboard
 */
export async function getCompetitionLeaderboard(
  competitionId: string,
  params?: { limit?: number; offset?: number; signal?: AbortSignal }
): Promise<LeaderboardResponse> {
  return withRetry(async () => {
    const response = await api.get<LeaderboardResponse>(
      `/competitions/${competitionId}/leaderboard`,
      {
        params: {
          limit: params?.limit || 100,
          offset: params?.offset || 0,
        },
        signal: params?.signal,
      }
    );

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch competition leaderboard',
        0,
        response.error?.code || 'COMPETITION_LEADERBOARD_FETCH_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Join a competition
 */
export async function joinCompetition(competitionId: string): Promise<CompetitionEntry> {
  return withRetry(async () => {
    const response = await api.post<CompetitionEntry>(`/competitions/${competitionId}/join`);

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to join competition',
        0,
        response.error?.code || 'COMPETITION_JOIN_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

/**
 * Leave a competition
 */
export async function leaveCompetition(competitionId: string): Promise<void> {
  const response = await api.delete<null>(`/competitions/${competitionId}/leave`);

  if (!response.success) {
    throw new ApiError(
      response.error?.message || 'Failed to leave competition',
      0,
      response.error?.code || 'COMPETITION_LEAVE_ERROR',
      response.error?.details
    );
  }
}

/**
 * Get user's score history
 */
export async function getScoreHistory(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<DailyScore[]> {
  return withRetry(async () => {
    const { signal, ...queryParams } = params || {};
    const response = await api.get<DailyScore[]>('/daily-score/history', {
      params: queryParams,
      signal,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to fetch score history',
        0,
        response.error?.code || 'SCORE_HISTORY_FETCH_ERROR',
        response.error?.details
      );
    }

    // Handle both array and wrapped response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data as unknown as { scores: DailyScore[] }).scores || [];
  });
}

/**
 * Submit activity events
 */
export async function submitActivityEvents(events: Array<{
  type: 'workout' | 'nutrition' | 'wellbeing' | 'participation';
  source: 'manual' | 'whoop' | 'apple_health' | 'camera_session';
  timestamp: string;
  payload: Record<string, unknown>;
}>): Promise<{ success: boolean; processed: number }> {
  return withRetry(async () => {
    const response = await api.post<{ success: boolean; processed: number }>('/activity-events', {
      events,
    });

    if (!response.success || !response.data) {
      throw new ApiError(
        response.error?.message || 'Failed to submit activity events',
        0,
        response.error?.code || 'ACTIVITY_EVENT_SUBMIT_ERROR',
        response.error?.details
      );
    }

    return response.data;
  });
}

