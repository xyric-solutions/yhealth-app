/**
 * Blog Controller
 * Handles HTTP requests for blog operations
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  createBlog,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  listBlogs,
  incrementBlogViews,
  bulkDeleteBlogs,
  bulkUpdateBlogStatus,
  togglePublishStatus,
  generateBlogWithAI,
  toggleBlogReaction,
  getBlogReactions,
  type CreateBlogInput,
  type UpdateBlogInput,
  type BlogListFilters,
  type BlogListOptions,
  type ReactionType,
} from '../services/blog.service.js';
import {
  createBlogSchema,
  updateBlogSchema,
  bulkDeleteBlogsSchema,
  bulkUpdateStatusSchema,
  listBlogsQuerySchema,
  generateBlogSchema,
  blogReactionSchema,
} from '../validators/blog.validator.js';

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get published blogs (public)
 * GET /api/blogs
 */
export const getPublicBlogs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const queryParams = listBlogsQuerySchema.parse(req.query);

    const filters: BlogListFilters = {
      status: 'published',
      search: queryParams.search,
      published_after: queryParams.published_after
        ? new Date(queryParams.published_after)
        : undefined,
      published_before: queryParams.published_before
        ? new Date(queryParams.published_before)
        : undefined,
    };

    const options: BlogListOptions = {
      page: queryParams.page,
      limit: queryParams.limit,
      sort_by: queryParams.sort_by,
      sort_order: queryParams.sort_order,
    };

    const result = await listBlogs(filters, options, true);

    ApiResponse.paginated(
      res,
      result.blogs,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      'Blogs retrieved successfully'
    );
  }
);

/**
 * Get single blog by slug (public)
 * GET /api/blogs/:slug
 */
export const getPublicBlogBySlug = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.params;

    const blog = await getBlogBySlug(slug, true);

    if (!blog) {
      throw ApiError.notFound('Blog post not found');
    }

    // Only return published blogs to public
    if (blog.status !== 'published' || !blog.published_at) {
      throw ApiError.notFound('Blog post not found');
    }

    // Check if published_at is in the future
    if (new Date(blog.published_at) > new Date()) {
      throw ApiError.notFound('Blog post not found');
    }

    ApiResponse.success(res, blog, 'Blog retrieved successfully');
  }
);

/**
 * Increment blog view count (public)
 * POST /api/blogs/:id/views
 */
export const incrementViews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await incrementBlogViews(id);

    ApiResponse.success(res, null, 'View count incremented');
  }
);

/**
 * Toggle blog reaction (like/dislike) - requires auth
 * POST /api/blogs/:id/reactions
 */
export const toggleReaction = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('You must be logged in to react to a blog');
    }

    const { type } = blogReactionSchema.parse(req.body);

    const result = await toggleBlogReaction(id, userId, type as ReactionType);
    const reactions = await getBlogReactions(id, userId);

    ApiResponse.success(res, { ...result, reactions }, 'Reaction updated');
  }
);

/**
 * Get blog reactions - optional auth
 * GET /api/blogs/:id/reactions
 */
export const getReactions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const reactions = await getBlogReactions(id, userId);

    ApiResponse.success(res, reactions, 'Reactions retrieved');
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * Get all blogs (admin)
 * GET /api/admin/blogs
 */
export const getAdminBlogs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const queryParams = listBlogsQuerySchema.parse(req.query);

    const filters: BlogListFilters = {
      status: queryParams.status,
      author_id: queryParams.author_id,
      search: queryParams.search,
      published_after: queryParams.published_after
        ? new Date(queryParams.published_after)
        : undefined,
      published_before: queryParams.published_before
        ? new Date(queryParams.published_before)
        : undefined,
    };

    const options: BlogListOptions = {
      page: queryParams.page,
      limit: queryParams.limit,
      sort_by: queryParams.sort_by,
      sort_order: queryParams.sort_order,
    };

    const result = await listBlogs(filters, options, false);

    ApiResponse.paginated(
      res,
      result.blogs,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      'Blogs retrieved successfully'
    );
  }
);

/**
 * Get single blog by ID (admin)
 * GET /api/admin/blogs/:id
 */
export const getAdminBlogById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const blog = await getBlogById(id, true);

    if (!blog) {
      throw ApiError.notFound('Blog post not found');
    }

    ApiResponse.success(res, blog, 'Blog retrieved successfully');
  }
);

/**
 * Create blog (admin)
 * POST /api/admin/blogs
 */
export const createBlogPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const validatedData = createBlogSchema.parse(req.body);

    const input: CreateBlogInput = {
      ...validatedData,
      author_id: userId,
      published_at: validatedData.published_at
        ? new Date(validatedData.published_at)
        : undefined,
      excerpt: validatedData.excerpt ?? undefined, // Convert null to undefined
    };

    const blog = await createBlog(input);

    ApiResponse.created(res, blog, 'Blog created successfully');
  }
);

/**
 * Update blog (admin)
 * PUT /api/admin/blogs/:id
 */
export const updateBlogPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateBlogSchema.parse(req.body);

    const input: UpdateBlogInput = {
      ...validatedData,
      excerpt: validatedData.excerpt ?? undefined, // Convert null to undefined
      published_at: validatedData.published_at
        ? new Date(validatedData.published_at)
        : validatedData.published_at === null
        ? null
        : undefined,
    };

    const blog = await updateBlog(id, input);

    ApiResponse.success(res, blog, 'Blog updated successfully');
  }
);

/**
 * Delete blog (admin)
 * DELETE /api/admin/blogs/:id
 */
export const deleteBlogPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await deleteBlog(id);

    ApiResponse.success(res, null, 'Blog deleted successfully');
  }
);

/**
 * Bulk delete blogs (admin)
 * POST /api/admin/blogs/bulk-delete
 */
export const bulkDeleteBlogPosts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = bulkDeleteBlogsSchema.parse(req.body);

    const deletedCount = await bulkDeleteBlogs(ids);

    ApiResponse.success(
      res,
      { deletedCount },
      `${deletedCount} blog(s) deleted successfully`
    );
  }
);

/**
 * Bulk update blog status (admin)
 * POST /api/admin/blogs/bulk-publish
 */
export const bulkUpdateBlogStatusPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids, status } = bulkUpdateStatusSchema.parse(req.body);

    const updatedCount = await bulkUpdateBlogStatus(ids, status);

    ApiResponse.success(
      res,
      { updatedCount },
      `${updatedCount} blog(s) updated successfully`
    );
  }
);

/**
 * Toggle publish/unpublish status (admin)
 * POST /api/admin/blogs/:id/publish
 */
export const togglePublish = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const blog = await togglePublishStatus(id);

    ApiResponse.success(
      res,
      blog,
      `Blog ${blog.status === 'published' ? 'published' : 'unpublished'} successfully`
    );
  }
);

/**
 * Generate blog content with AI (admin)
 * POST /api/admin/blogs/generate
 */
export const generateBlog = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const validatedInput = generateBlogSchema.parse(req.body);

    const generatedContent = await generateBlogWithAI({
      topic: validatedInput.topic.trim(),
      requirements: validatedInput.requirements?.trim() || undefined,
      tone: validatedInput.tone || 'professional',
      targetAudience: validatedInput.targetAudience?.trim() || undefined,
      length: validatedInput.length || 'medium',
      includeSEO: validatedInput.includeSEO !== false, // Default to true
    });

    ApiResponse.success(
      res,
      generatedContent,
      'Blog content generated successfully'
    );
  }
);

