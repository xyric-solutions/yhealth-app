/**
 * @file Streak API Service
 * @description Client-side API service for streak tracking, leaderboards, and freeze management
 */

import { api, type ApiResponse } from '@/lib/api-client';

// ── Types ──

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastActivityDate: string | null;
  streakStartedAt: string | null;
  totalActiveDays: number;
  tier: { name: string; days: number; badgeIcon: string } | null;
  nextTier: { name: string; days: number } | null;
  tierProgress: number;
  atRisk: boolean;
  todayActivities: string[];
  timezone: string;
}

export interface CalendarDay {
  date: string;
  status: 'active' | 'frozen' | 'broken' | 'none';
  activities: string[];
  streakDay: number;
  freezeSource?: string;
}

export interface CalendarMonth {
  month: string;
  days: CalendarDay[];
  summary: {
    activeDays: number;
    frozenDays: number;
    brokenDays: number;
    currentStreak: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  currentStreak: number;
  longestStreak: number;
  rank: number;
  avatar?: string;
}

export interface StreakReward {
  milestoneDays: number;
  tierName: string;
  rewardType: string;
  xpBonus: number;
  freezesEarned: number;
  titleUnlocked: string | null;
  badgeIcon: string;
  unlocked: boolean;
}

export interface StreakStats {
  totalActiveDays: number;
  averageStreak: number;
  bestMonth: { month: string; activeDays: number };
  activityBreakdown: Record<string, number>;
}

export interface CompareResult {
  you: { currentStreak: number; longestStreak: number; totalActiveDays: number };
  friend: {
    name: string;
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
  };
  delta: { streakDiff: number; suggestion: string };
}

// ── Service ──

class StreakApiService {
  async getStatus(): Promise<ApiResponse<StreakStatus>> {
    return api.get<StreakStatus>('/streaks/status');
  }

  async getHistory(params?: {
    limit?: number;
    offset?: number;
    activityType?: string;
  }): Promise<ApiResponse<{ activities: Array<{ date: string; type: string; details: string }>; total: number }>> {
    return api.get('/streaks/history', { params });
  }

  async getCalendar(month: string): Promise<ApiResponse<CalendarMonth>> {
    return api.get<CalendarMonth>(`/streaks/calendar/${month}`);
  }

  async getLeaderboard(params?: {
    segment?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ entries: LeaderboardEntry[]; total: number }>> {
    return api.get('/streaks/leaderboard', { params });
  }

  async getAroundMe(): Promise<ApiResponse<LeaderboardEntry[]>> {
    return api.get<LeaderboardEntry[]>('/streaks/leaderboard/around-me');
  }

  async getRewards(): Promise<ApiResponse<StreakReward[]>> {
    return api.get<StreakReward[]>('/streaks/rewards');
  }

  async getStats(): Promise<ApiResponse<StreakStats>> {
    return api.get<StreakStats>('/streaks/stats');
  }

  async compareWithFriend(friendId: string): Promise<ApiResponse<CompareResult>> {
    return api.get<CompareResult>(`/streaks/compare/${friendId}`);
  }

  async purchaseFreeze(): Promise<
    ApiResponse<{ success: boolean; freezesAvailable: number; xpDeducted: number }>
  > {
    return api.post('/streaks/freeze/purchase');
  }

  async applyFreeze(date?: string): Promise<
    ApiResponse<{ success: boolean; freezesRemaining: number }>
  > {
    return api.post('/streaks/freeze/apply', { date });
  }
}

export const streakApiService = new StreakApiService();
