/**
 * @file Admin Testimonials API Service
 * @description Client-side API calls for admin testimonial management.
 * Talks to /api/admin/testimonials/* endpoints (requires admin auth).
 */

import { api, type ApiResponse } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  rating: number;
  content: string;
  verified: boolean;
  pillar: 'fitness' | 'nutrition' | 'wellbeing' | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminTestimonialStats {
  totalTestimonials: number;
  activeCount: number;
  inactiveCount: number;
  featuredCount: number;
  averageRating: number;
  byPillar: Record<string, number>;
  byRating: Record<string, number>;
}

export interface AdminTestimonialListParams {
  page?: number;
  limit?: number;
  search?: string;
  pillar?: string;
  rating?: number;
  is_active?: string;
  is_featured?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CreateTestimonialPayload {
  name: string;
  role: string;
  avatar_url?: string | null;
  rating: number;
  content: string;
  verified?: boolean;
  pillar?: 'fitness' | 'nutrition' | 'wellbeing' | null;
  is_active?: boolean;
  is_featured?: boolean;
  display_order?: number;
}

export type UpdateTestimonialPayload = Partial<CreateTestimonialPayload>;

// ============================================
// SERVICE
// ============================================

const BASE = '/admin/testimonials';

export const adminTestimonialsService = {
  async list(params: AdminTestimonialListParams = {}): Promise<ApiResponse<TestimonialItem[]>> {
    const cleanParams: Record<string, string | number> = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.search) cleanParams.search = params.search;
    if (params.pillar) cleanParams.pillar = params.pillar;
    if (params.rating) cleanParams.rating = params.rating;
    if (params.is_active) cleanParams.is_active = params.is_active;
    if (params.is_featured) cleanParams.is_featured = params.is_featured;
    if (params.sort_by) cleanParams.sort_by = params.sort_by;
    if (params.sort_order) cleanParams.sort_order = params.sort_order;
    return api.get<TestimonialItem[]>(BASE, { params: cleanParams });
  },

  async getById(id: string): Promise<ApiResponse<TestimonialItem>> {
    return api.get<TestimonialItem>(`${BASE}/${id}`);
  },

  async getStats(): Promise<ApiResponse<AdminTestimonialStats>> {
    return api.get<AdminTestimonialStats>(`${BASE}/stats`);
  },

  async create(data: CreateTestimonialPayload): Promise<ApiResponse<TestimonialItem>> {
    return api.post<TestimonialItem>(BASE, data);
  },

  async update(id: string, data: UpdateTestimonialPayload): Promise<ApiResponse<TestimonialItem>> {
    return api.put<TestimonialItem>(`${BASE}/${id}`, data);
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

  async toggleActive(id: string): Promise<ApiResponse<TestimonialItem>> {
    return api.post<TestimonialItem>(`${BASE}/${id}/toggle-active`);
  },

  async toggleFeatured(id: string): Promise<ApiResponse<TestimonialItem>> {
    return api.post<TestimonialItem>(`${BASE}/${id}/toggle-featured`);
  },
};

// ============================================
// PUBLIC SERVICE (no auth)
// ============================================

export const testimonialsPublicService = {
  async getAll(): Promise<ApiResponse<TestimonialItem[]>> {
    return api.get<TestimonialItem[]>('/testimonials');
  },
};
