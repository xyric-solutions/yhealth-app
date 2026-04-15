/**
 * @file Exercises API Service
 * @description Client-side API calls for the public exercise library.
 * Talks to GET /api/v1/exercises/* endpoints (no auth required).
 */

import { api, type ApiResponse } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export interface ExerciseListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  primary_muscle_group: string | null;
  secondary_muscle_groups: string[];
  equipment_required: string[];
  difficulty_level: string;
  instructions: string[] | null;
  tips: string[] | null;
  common_mistakes: string[] | null;
  video_url: string | null;
  thumbnail_url: string | null;
  animation_url: string | null;
  default_sets: number;
  default_reps: number;
  default_duration_seconds: number | null;
  default_rest_seconds: number;
  is_system: boolean;
  is_active: boolean;
  calories_per_minute: number | null;
  met_value: number | null;
  tags: string[];
  source: string;
  source_id: string | null;
  body_part: string | null;
  target_muscles: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ExerciseMedia {
  id: string;
  exercise_id: string;
  type: string;
  url: string;
  r2_key: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  is_primary: boolean;
  source: string | null;
}

export interface ExerciseDetail extends ExerciseListItem {
  media: ExerciseMedia[];
}

export interface ExerciseFilterOptions {
  categories: string[];
  muscles: string[];
  equipment: string[];
  difficulties: string[];
  bodyParts: string[];
  sources: string[];
}

export interface ExerciseStats {
  totalExercises: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byDifficulty: Record<string, number>;
}

export interface ExerciseListParams {
  page?: number;
  limit?: number;
  category?: string;
  muscle?: string;
  equipment?: string;
  difficulty?: string;
  bodyPart?: string;
  source?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ExerciseSearchParams {
  q: string;
  page?: number;
  limit?: number;
  category?: string;
  muscle?: string;
  difficulty?: string;
}

// ============================================
// SERVICE
// ============================================

const BASE = '/v1/exercises';

export const exercisesService = {
  /**
   * List exercises with pagination and filtering
   */
  async list(params: ExerciseListParams = {}): Promise<ApiResponse<ExerciseListItem[]>> {
    const cleanParams: Record<string, string | number | boolean | undefined> = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.category) cleanParams.category = params.category;
    if (params.muscle) cleanParams.muscle = params.muscle;
    if (params.equipment) cleanParams.equipment = params.equipment;
    if (params.difficulty) cleanParams.difficulty = params.difficulty;
    if (params.bodyPart) cleanParams.bodyPart = params.bodyPart;
    if (params.source) cleanParams.source = params.source;
    if (params.sort) cleanParams.sort = params.sort;
    if (params.order) cleanParams.order = params.order;

    return api.get<ExerciseListItem[]>(BASE, { params: cleanParams });
  },

  /**
   * Full-text search exercises
   */
  async search(params: ExerciseSearchParams): Promise<ApiResponse<ExerciseListItem[]>> {
    const cleanParams: Record<string, string | number | boolean | undefined> = {
      q: params.q,
    };
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.category) cleanParams.category = params.category;
    if (params.muscle) cleanParams.muscle = params.muscle;
    if (params.difficulty) cleanParams.difficulty = params.difficulty;

    return api.get<ExerciseListItem[]>(`${BASE}/search`, { params: cleanParams });
  },

  /**
   * Get a single exercise by ID with media
   */
  async getById(id: string): Promise<ApiResponse<ExerciseDetail>> {
    return api.get<ExerciseDetail>(`${BASE}/${id}`);
  },

  /**
   * Get available filter options for dropdowns
   */
  async getFilters(): Promise<ApiResponse<ExerciseFilterOptions>> {
    return api.get<ExerciseFilterOptions>(`${BASE}/filters`);
  },

  /**
   * Get exercise statistics
   */
  async getStats(): Promise<ApiResponse<ExerciseStats>> {
    return api.get<ExerciseStats>(`${BASE}/stats`);
  },
};
