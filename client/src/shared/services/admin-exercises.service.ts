/**
 * @file Admin Exercises API Service
 * @description Client-side API calls for admin exercise management.
 * Talks to /api/admin/exercises/* endpoints (requires admin auth).
 */

import { api, type ApiResponse } from '@/lib/api-client';
import type { ExerciseListItem, ExerciseDetail } from './exercises.service';

// ============================================
// TYPES
// ============================================

export interface AdminExerciseStats {
  totalExercises: number;
  activeCount: number;
  inactiveCount: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byDifficulty: Record<string, number>;
}

export interface AdminExerciseListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  difficulty?: string;
  source?: string;
  is_active?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CreateExercisePayload {
  name: string;
  description?: string | null;
  category: string;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[];
  equipment_required?: string[];
  difficulty_level: string;
  instructions?: string[];
  tips?: string[];
  common_mistakes?: string[];
  video_url?: string | null;
  thumbnail_url?: string | null;
  animation_url?: string | null;
  default_sets?: number;
  default_reps?: number;
  default_duration_seconds?: number | null;
  default_rest_seconds?: number;
  is_active?: boolean;
  calories_per_minute?: number | null;
  met_value?: number | null;
  tags?: string[];
  body_part?: string | null;
  target_muscles?: string[];
}

export type UpdateExercisePayload = Partial<CreateExercisePayload>;

export interface SyncResult {
  source: string;
  totalFetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { exerciseId: string; exerciseName: string; error: string }[];
  durationMs: number;
}

// ============================================
// SERVICE
// ============================================

const BASE = '/admin/exercises';

export const adminExercisesService = {
  async list(params: AdminExerciseListParams = {}): Promise<ApiResponse<ExerciseListItem[]>> {
    const cleanParams: Record<string, string | number> = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.search) cleanParams.search = params.search;
    if (params.category) cleanParams.category = params.category;
    if (params.difficulty) cleanParams.difficulty = params.difficulty;
    if (params.source) cleanParams.source = params.source;
    if (params.is_active) cleanParams.is_active = params.is_active;
    if (params.sort_by) cleanParams.sort_by = params.sort_by;
    if (params.sort_order) cleanParams.sort_order = params.sort_order;
    return api.get<ExerciseListItem[]>(BASE, { params: cleanParams });
  },

  async getById(id: string): Promise<ApiResponse<ExerciseDetail>> {
    return api.get<ExerciseDetail>(`${BASE}/${id}`);
  },

  async getStats(): Promise<ApiResponse<AdminExerciseStats>> {
    return api.get<AdminExerciseStats>(`${BASE}/stats`);
  },

  async create(data: CreateExercisePayload): Promise<ApiResponse<ExerciseListItem>> {
    return api.post<ExerciseListItem>(BASE, data);
  },

  async update(id: string, data: UpdateExercisePayload): Promise<ApiResponse<ExerciseListItem>> {
    return api.put<ExerciseListItem>(`${BASE}/${id}`, data);
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`${BASE}/${id}`);
  },

  async bulkDelete(ids: string[]): Promise<ApiResponse<{ deletedCount: number }>> {
    return api.post<{ deletedCount: number }>(`${BASE}/bulk-delete`, { ids });
  },

  async bulkToggleActive(ids: string[], is_active: boolean): Promise<ApiResponse<{ updatedCount: number }>> {
    return api.post<{ updatedCount: number }>(`${BASE}/bulk-toggle-active`, { ids, is_active });
  },

  async toggleActive(id: string): Promise<ApiResponse<ExerciseListItem>> {
    return api.post<ExerciseListItem>(`${BASE}/${id}/toggle-active`);
  },

  async sync(source: 'exercisedb' | 'musclewiki', options?: { dryRun?: boolean; limit?: number }): Promise<ApiResponse<SyncResult>> {
    return api.post<SyncResult>(`${BASE}/sync`, { source, ...options });
  },
};
