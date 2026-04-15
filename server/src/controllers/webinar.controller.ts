/**
 * Webinar Controller
 * Handles HTTP requests for webinar operations
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  createWebinar,
  getWebinarById,
  getWebinarBySlug,
  updateWebinar,
  deleteWebinar,
  listWebinars,
  getWebinarCategories,
  registerForWebinar,
  getWebinarRegistrations,
  bulkDeleteWebinars,
  getWebinarStats,
  generateWebinarWithAI,
} from '../services/webinar.service.js';
import { generateWebinarSchema } from '../validators/webinar.validator.js';

// ============================================
// PUBLIC ROUTES
// ============================================

export const getWebinarCategoriesHandler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const categories = await getWebinarCategories();
    ApiResponse.success(res, categories, 'Categories retrieved');
  }
);

export const getPublicWebinars = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, category, search } = req.query;
    const result = await listWebinars({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      category: category as string,
      search: search as string,
      publicOnly: true,
    });
    ApiResponse.paginated(res, result.webinars, { page: result.page, limit: result.limit, total: result.total }, 'Webinars retrieved');
  }
);

export const getPublicWebinar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.params;
    const webinar = await getWebinarBySlug(slug);
    if (!webinar) throw ApiError.notFound('Webinar not found');
    ApiResponse.success(res, webinar, 'Webinar retrieved');
  }
);

export const registerForWebinarHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, email } = req.body;
    const userId = req.user?.userId;
    const registration = await registerForWebinar(req.params.id, name, email, userId);
    ApiResponse.created(res, registration, 'Successfully registered for webinar');
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

export const getWebinarStatsHandler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getWebinarStats();
    ApiResponse.success(res, stats, 'Stats retrieved');
  }
);

export const getAdminWebinars = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, category, search } = req.query;
    const result = await listWebinars({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      status: status as string,
      category: category as string,
      search: search as string,
    });
    ApiResponse.paginated(res, result.webinars, { page: result.page, limit: result.limit, total: result.total }, 'Webinars retrieved');
  }
);

export const getAdminWebinar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const webinar = await getWebinarById(req.params.id);
    if (!webinar) throw ApiError.notFound('Webinar not found');
    ApiResponse.success(res, webinar, 'Webinar retrieved');
  }
);

export const getWebinarRegistrationsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = req.query;
    const result = await getWebinarRegistrations(
      req.params.id,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 50
    );
    ApiResponse.success(res, result, 'Registrations retrieved');
  }
);

export const createWebinarHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    const webinar = await createWebinar({ ...req.body, created_by: userId });
    ApiResponse.created(res, webinar, 'Webinar created');
  }
);

export const updateWebinarHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const webinar = await updateWebinar(req.params.id, req.body);
    ApiResponse.success(res, webinar, 'Webinar updated');
  }
);

export const deleteWebinarHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await deleteWebinar(req.params.id);
    ApiResponse.success(res, null, 'Webinar deleted');
  }
);

export const bulkDeleteWebinarsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    const count = await bulkDeleteWebinars(ids);
    ApiResponse.success(res, { deletedCount: count }, `${count} webinar(s) deleted`);
  }
);

export const generateWebinar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const validatedInput = generateWebinarSchema.parse(req.body);

    const generatedContent = await generateWebinarWithAI({
      topic: validatedInput.topic.trim(),
      requirements: validatedInput.requirements?.trim() || undefined,
      tone: validatedInput.tone || 'professional',
      targetAudience: validatedInput.targetAudience?.trim() || undefined,
      length: validatedInput.length || 'medium',
    });

    ApiResponse.success(
      res,
      generatedContent,
      'Webinar content generated successfully'
    );
  }
);
