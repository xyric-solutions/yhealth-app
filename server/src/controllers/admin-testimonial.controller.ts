/**
 * Admin Testimonial Controller
 * Handles HTTP requests for admin testimonial management
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  adminListTestimonials,
  adminGetTestimonialById,
  adminGetTestimonialStats,
  adminCreateTestimonial,
  adminUpdateTestimonial,
  adminDeleteTestimonial,
  adminBulkDelete,
  adminBulkToggleActive,
  adminToggleActive,
  adminToggleFeatured,
  getPublicTestimonials,
} from '../services/testimonial.service.js';
import {
  adminListTestimonialsQuerySchema,
} from '../validators/admin-testimonial.validator.js';

/**
 * List testimonials (admin — includes inactive)
 * GET /api/admin/testimonials
 */
export const getAdminTestimonials = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const filters = adminListTestimonialsQuerySchema.parse(req.query);
    const result = await adminListTestimonials(filters);

    ApiResponse.paginated(
      res,
      result.data,
      { page: result.meta.page, limit: result.meta.limit, total: result.meta.total },
      'Testimonials retrieved successfully'
    );
  }
);

/**
 * Get testimonial stats
 * GET /api/admin/testimonials/stats
 */
export const getAdminTestimonialStats = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await adminGetTestimonialStats();
    ApiResponse.success(res, stats, 'Testimonial stats retrieved successfully');
  }
);

/**
 * Get single testimonial by ID
 * GET /api/admin/testimonials/:id
 */
export const getAdminTestimonialById_handler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const testimonial = await adminGetTestimonialById(id);

    if (!testimonial) {
      throw ApiError.notFound('Testimonial not found');
    }

    ApiResponse.success(res, testimonial, 'Testimonial retrieved successfully');
  }
);

/**
 * Create testimonial
 * POST /api/admin/testimonials
 */
export const createTestimonial = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const testimonial = await adminCreateTestimonial(req.body);
    ApiResponse.created(res, testimonial, 'Testimonial created successfully');
  }
);

/**
 * Update testimonial
 * PUT /api/admin/testimonials/:id
 */
export const updateTestimonial = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const testimonial = await adminUpdateTestimonial(id, req.body);

    if (!testimonial) {
      throw ApiError.notFound('Testimonial not found');
    }

    ApiResponse.success(res, testimonial, 'Testimonial updated successfully');
  }
);

/**
 * Delete testimonial
 * DELETE /api/admin/testimonials/:id
 */
export const deleteTestimonial = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const deleted = await adminDeleteTestimonial(id);

    if (!deleted) {
      throw ApiError.notFound('Testimonial not found');
    }

    ApiResponse.success(res, null, 'Testimonial deleted successfully');
  }
);

/**
 * Bulk delete testimonials
 * POST /api/admin/testimonials/bulk-delete
 */
export const bulkDeleteTestimonials = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    const deletedCount = await adminBulkDelete(ids);
    ApiResponse.success(res, { deletedCount }, `${deletedCount} testimonials deleted`);
  }
);

/**
 * Bulk toggle active status
 * POST /api/admin/testimonials/bulk-toggle-active
 */
export const bulkToggleActiveTestimonials = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids, is_active } = req.body;
    const updatedCount = await adminBulkToggleActive(ids, is_active);
    ApiResponse.success(res, { updatedCount }, `${updatedCount} testimonials updated`);
  }
);

/**
 * Toggle active status for single testimonial
 * POST /api/admin/testimonials/:id/toggle-active
 */
export const toggleTestimonialActive = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const testimonial = await adminToggleActive(id);

    if (!testimonial) {
      throw ApiError.notFound('Testimonial not found');
    }

    ApiResponse.success(res, testimonial, `Testimonial ${testimonial.is_active ? 'activated' : 'deactivated'}`);
  }
);

/**
 * Toggle featured status for single testimonial
 * POST /api/admin/testimonials/:id/toggle-featured
 */
export const toggleTestimonialFeatured = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const testimonial = await adminToggleFeatured(id);

    if (!testimonial) {
      throw ApiError.notFound('Testimonial not found');
    }

    ApiResponse.success(res, testimonial, `Testimonial ${testimonial.is_featured ? 'featured' : 'unfeatured'}`);
  }
);

/**
 * Get public testimonials (no auth required)
 * GET /api/testimonials
 */
export const getPublicTestimonials_handler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const testimonials = await getPublicTestimonials();
    ApiResponse.success(res, testimonials, 'Testimonials retrieved successfully');
  }
);
