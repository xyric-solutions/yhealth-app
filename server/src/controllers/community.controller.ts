/**
 * Community Controller
 * Handles HTTP requests for community post operations
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  createCommunityPost,
  getCommunityPostById,
  getCommunityPostBySlug,
  updateCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
  getCommunityCategories,
  incrementCommunityPostViews,
  likeCommunityPost,
  getPostReplies as getPostRepliesService,
  createReply,
  deleteReply,
  bulkDeleteCommunityPosts,
  getCommunityStats,
  generateCommunityPostWithAI,
} from '../services/community.service.js';
import { generateCommunityPostSchema } from '../validators/community.validator.js';

// ============================================
// PUBLIC ROUTES
// ============================================

export const getCommunityPostCategories = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const categories = await getCommunityCategories();
    ApiResponse.success(res, categories, 'Categories retrieved');
  }
);

export const getPublicCommunityPosts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, category, post_type, search } = req.query;
    const result = await listCommunityPosts({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      category: category as string,
      post_type: post_type as string,
      search: search as string,
      publicOnly: true,
    });
    ApiResponse.paginated(res, result.posts, { page: result.page, limit: result.limit, total: result.total }, 'Community posts retrieved');
  }
);

export const getPublicCommunityPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.params;
    const post = await getCommunityPostBySlug(slug);
    if (!post) throw ApiError.notFound('Community post not found');
    ApiResponse.success(res, post, 'Community post retrieved');
  }
);

export const incrementCommunityViews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await incrementCommunityPostViews(req.params.id);
    ApiResponse.success(res, null, 'View count incremented');
  }
);

export const getPostReplies = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = req.query;
    const result = await getPostRepliesService(
      req.params.id,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 20
    );
    ApiResponse.success(res, result, 'Replies retrieved');
  }
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

export const createCommunityPostHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    const post = await createCommunityPost({ ...req.body, author_id: userId });
    ApiResponse.created(res, post, 'Community post created');
  }
);

export const likePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await likeCommunityPost(req.params.id);
    ApiResponse.success(res, null, 'Post liked');
  }
);

export const createPostReply = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    const reply = await createReply(req.params.id, userId, req.body.content);
    ApiResponse.created(res, reply, 'Reply created');
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

export const createAdminCommunityPostHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    const post = await createCommunityPost({ ...req.body, author_id: userId });
    ApiResponse.created(res, post, 'Community post created');
  }
);

export const getCommunityStatsHandler = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getCommunityStats();
    ApiResponse.success(res, stats, 'Stats retrieved');
  }
);

export const getAdminCommunityPosts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, status, category, search } = req.query;
    const result = await listCommunityPosts({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      status: status as string,
      category: category as string,
      search: search as string,
    });
    ApiResponse.paginated(res, result.posts, { page: result.page, limit: result.limit, total: result.total }, 'Community posts retrieved');
  }
);

export const getAdminCommunityPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const post = await getCommunityPostById(req.params.id);
    if (!post) throw ApiError.notFound('Community post not found');
    ApiResponse.success(res, post, 'Community post retrieved');
  }
);

export const updateCommunityPostHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const post = await updateCommunityPost(req.params.id, req.body);
    ApiResponse.success(res, post, 'Community post updated');
  }
);

export const deleteCommunityPostHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await deleteCommunityPost(req.params.id);
    ApiResponse.success(res, null, 'Community post deleted');
  }
);

export const deleteReplyHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await deleteReply(req.params.id);
    ApiResponse.success(res, null, 'Reply deleted');
  }
);

export const bulkDeleteCommunityPostsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    const count = await bulkDeleteCommunityPosts(ids);
    ApiResponse.success(res, { deletedCount: count }, `${count} post(s) deleted`);
  }
);

export const generateCommunityPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const validatedInput = generateCommunityPostSchema.parse(req.body);

    const generatedContent = await generateCommunityPostWithAI({
      topic: validatedInput.topic.trim(),
      post_type: validatedInput.post_type || 'discussion',
      requirements: validatedInput.requirements?.trim() || undefined,
      tone: validatedInput.tone || 'friendly',
      targetAudience: validatedInput.targetAudience?.trim() || undefined,
      length: validatedInput.length || 'medium',
    });

    ApiResponse.success(
      res,
      generatedContent,
      'Community post content generated successfully'
    );
  }
);
