/**
 * Help Center Controller
 * Handles HTTP requests for help article operations
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  createHelpArticle,
  getHelpArticleById,
  getHelpArticleBySlug,
  updateHelpArticle,
  deleteHelpArticle,
  listHelpArticles,
  getHelpCategories,
  incrementHelpViews,
  submitHelpFeedback,
  bulkDeleteHelpArticles,
  getHelpStats,
  generateHelpArticleWithAI,
} from '../services/help.service.js';
import { generateHelpArticleSchema } from '../validators/help.validator.js';

// ============================================
// PUBLIC ROUTES
// ============================================

export const getCategories = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const categories = await getHelpCategories();
    ApiResponse.success(res, categories, 'Categories retrieved');
  }
);

export const getPublicHelpArticles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, category, search } = req.query;
    const result = await listHelpArticles({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      category: category as string,
      search: search as string,
      publicOnly: true,
    });
    ApiResponse.paginated(res, result.articles, { page: result.page, limit: result.limit, total: result.total }, 'Help articles retrieved');
  }
);

export const getPublicHelpArticle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.params;
    const article = await getHelpArticleBySlug(slug);
    if (!article) throw ApiError.notFound('Help article not found');
    ApiResponse.success(res, article, 'Help article retrieved');
  }
);

export const incrementViews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await incrementHelpViews(req.params.id);
    ApiResponse.success(res, null, 'View count incremented');
  }
);

export const submitFeedback = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { helpful } = req.body;
    await submitHelpFeedback(req.params.id, helpful);
    ApiResponse.success(res, null, 'Feedback submitted');
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

export const getHelpStatsHandler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getHelpStats();
    ApiResponse.success(res, stats, 'Stats retrieved');
  }
);

export const getAdminHelpArticles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, category, search } = req.query;
    const result = await listHelpArticles({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      status: status as string,
      category: category as string,
      search: search as string,
    });
    ApiResponse.paginated(res, result.articles, { page: result.page, limit: result.limit, total: result.total }, 'Help articles retrieved');
  }
);

export const getAdminHelpArticle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const article = await getHelpArticleById(req.params.id);
    if (!article) throw ApiError.notFound('Help article not found');
    ApiResponse.success(res, article, 'Help article retrieved');
  }
);

export const createHelpArticleHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    const article = await createHelpArticle({ ...req.body, author_id: userId });
    ApiResponse.created(res, article, 'Help article created');
  }
);

export const updateHelpArticleHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const article = await updateHelpArticle(req.params.id, req.body);
    ApiResponse.success(res, article, 'Help article updated');
  }
);

export const deleteHelpArticleHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await deleteHelpArticle(req.params.id);
    ApiResponse.success(res, null, 'Help article deleted');
  }
);

export const bulkDeleteHelpArticlesHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    const count = await bulkDeleteHelpArticles(ids);
    ApiResponse.success(res, { deletedCount: count }, `${count} article(s) deleted`);
  }
);

export const generateHelpArticle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const validatedInput = generateHelpArticleSchema.parse(req.body);

    const generatedContent = await generateHelpArticleWithAI({
      topic: validatedInput.topic.trim(),
      requirements: validatedInput.requirements?.trim() || undefined,
      tone: validatedInput.tone || 'professional',
      targetAudience: validatedInput.targetAudience?.trim() || undefined,
      length: validatedInput.length || 'medium',
      includeSEO: validatedInput.includeSEO !== false,
    });

    ApiResponse.success(
      res,
      generatedContent,
      'Help article content generated successfully'
    );
  }
);
