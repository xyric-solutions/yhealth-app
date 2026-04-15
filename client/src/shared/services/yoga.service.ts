/**
 * @file Yoga & Meditation API Service
 * @description Client-side API service for yoga and meditation features
 */

import { api, type ApiResponse } from '@/lib/api-client';
import type {
  YogaPose,
  YogaSession,
  YogaSessionLog,
  YogaStats,
  YogaStreak,
  YouTubeVideo,
  PoseListFilter,
  YogaHistoryFilter,
  StartSessionInput,
  UpdateSessionLogInput,
  CompleteSessionInput,
  StartMeditationInput,
  MeditationTimer,
  CoachAnalyseRequest,
  CoachAnalyseResponse,
} from '@shared/types/domain/yoga';

// ============================================
// POSE SERVICE
// ============================================

export const poseService = {
  async listPoses(filter?: PoseListFilter): Promise<ApiResponse<{ poses: YogaPose[]; total: number }>> {
    return api.get('/v1/wellbeing/yoga/poses', { params: filter as Record<string, string | number | boolean | undefined> });
  },

  async getPoseBySlug(slug: string): Promise<ApiResponse<{ pose: YogaPose }>> {
    return api.get(`/v1/wellbeing/yoga/poses/${slug}`);
  },
};

// ============================================
// SESSION SERVICE
// ============================================

export const sessionService = {
  async getTemplates(): Promise<ApiResponse<{ sessions: YogaSession[] }>> {
    return api.get('/v1/wellbeing/yoga/sessions/templates');
  },

  async getUserSessions(): Promise<ApiResponse<{ sessions: YogaSession[] }>> {
    return api.get('/v1/wellbeing/yoga/sessions');
  },

  async getSessionById(id: string): Promise<ApiResponse<{ session: YogaSession }>> {
    return api.get(`/v1/wellbeing/yoga/sessions/${id}`);
  },

  async startSession(sessionId: string, input: StartSessionInput): Promise<ApiResponse<{ log: YogaSessionLog }>> {
    return api.post(`/v1/wellbeing/yoga/sessions/${sessionId}/start`, input);
  },

  async updateSessionLog(logId: string, input: UpdateSessionLogInput): Promise<ApiResponse<{ log: YogaSessionLog }>> {
    return api.patch(`/v1/wellbeing/yoga/sessions/logs/${logId}`, input);
  },

  async completeSession(logId: string, input: CompleteSessionInput): Promise<ApiResponse<{ log: YogaSessionLog }>> {
    return api.post(`/v1/wellbeing/yoga/sessions/logs/${logId}/complete`, input);
  },
};

// ============================================
// HISTORY & STATS SERVICE
// ============================================

export const yogaHistoryService = {
  async getHistory(filter?: YogaHistoryFilter): Promise<ApiResponse<{ logs: YogaSessionLog[]; total: number }>> {
    return api.get('/v1/wellbeing/yoga/history', { params: filter as Record<string, string | number | boolean | undefined> });
  },

  async getStats(): Promise<ApiResponse<YogaStats>> {
    return api.get('/v1/wellbeing/yoga/stats');
  },

  async getStreak(): Promise<ApiResponse<YogaStreak>> {
    return api.get('/v1/wellbeing/yoga/streak');
  },
};

// ============================================
// MEDITATION SERVICE
// ============================================

export const meditationService = {
  async startMeditation(input: StartMeditationInput): Promise<ApiResponse<{ timer: MeditationTimer }>> {
    return api.post('/v1/wellbeing/yoga/meditation/start', input);
  },

  async completeMeditation(id: string): Promise<ApiResponse<{ timer: MeditationTimer }>> {
    return api.post(`/v1/wellbeing/yoga/meditation/${id}/complete`);
  },
};

// ============================================
// YOUTUBE VIDEO SERVICE
// ============================================

export const youtubeService = {
  async searchPoseVideo(poseName: string): Promise<ApiResponse<{ videos: YouTubeVideo[] }>> {
    return api.get('/youtube/search', { params: { q: `${poseName} yoga tutorial` } });
  },
};

// ============================================
// AI POSE COACH SERVICE
// ============================================

export const coachService = {
  async analysePose(data: CoachAnalyseRequest): Promise<ApiResponse<CoachAnalyseResponse>> {
    return api.post('/v1/wellbeing/yoga/coach', data);
  },

  async startAISession(poseSlug: string, poseName: string): Promise<ApiResponse<{ log: YogaSessionLog }>> {
    return api.post('/v1/wellbeing/yoga/coach/session/start', { poseSlug, poseName });
  },

  async completeAISession(
    logId: string,
    input: { durationSeconds: number; averageScore: number; poseName: string },
  ): Promise<ApiResponse<{ log: YogaSessionLog }>> {
    return api.post(`/v1/wellbeing/yoga/coach/session/${logId}/complete`, input);
  },
};
