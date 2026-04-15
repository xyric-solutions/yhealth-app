/**
 * @file Vision Testing API Service
 * @description Client-side API methods for vision tests and eye exercises
 */

import { api } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';
import type {
  VisionTestSession,
  VisionTestResponse,
  VisionStreak,
  VisionStats,
  StartVisionTestInput,
  CompleteVisionTestInput,
  StartEyeExerciseInput,
  CompleteEyeExerciseInput,
  VisionHistoryFilter,
} from '@shared/types/domain/vision';

// ============================================
// COLOR VISION TEST
// ============================================

export const visionTestService = {
  async startTest(input: StartVisionTestInput): Promise<ApiResponse<{ session: VisionTestSession }>> {
    return api.post('/v1/wellbeing/vision/test/start', input);
  },

  async completeTest(sessionId: string, input: CompleteVisionTestInput): Promise<ApiResponse<{ session: VisionTestSession }>> {
    return api.post(`/v1/wellbeing/vision/test/${sessionId}/complete`, input);
  },
};

// ============================================
// EYE EXERCISES
// ============================================

export const eyeExerciseService = {
  async startExercise(input: StartEyeExerciseInput): Promise<ApiResponse<{ session: VisionTestSession }>> {
    return api.post('/v1/wellbeing/vision/exercise/start', input);
  },

  async completeExercise(sessionId: string, input: CompleteEyeExerciseInput): Promise<ApiResponse<{ session: VisionTestSession }>> {
    return api.post(`/v1/wellbeing/vision/exercise/${sessionId}/complete`, input);
  },
};

// ============================================
// HISTORY & STATS
// ============================================

export const visionHistoryService = {
  async getHistory(filter?: VisionHistoryFilter): Promise<ApiResponse<{ sessions: VisionTestSession[]; total: number }>> {
    return api.get('/v1/wellbeing/vision/history', { params: filter as Record<string, string | number | boolean | undefined> });
  },

  async getStats(): Promise<ApiResponse<{ stats: VisionStats }>> {
    return api.get('/v1/wellbeing/vision/stats');
  },

  async getStreak(): Promise<ApiResponse<{ streak: VisionStreak }>> {
    return api.get('/v1/wellbeing/vision/streak');
  },

  async getSessionById(id: string): Promise<ApiResponse<{ session: VisionTestSession & { responses: VisionTestResponse[] } }>> {
    return api.get(`/v1/wellbeing/vision/sessions/${id}`);
  },
};
