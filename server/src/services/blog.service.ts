/**
 * Blog Service
 * Handles blog CRUD operations, slug generation, reading time calculation, and search
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';

// ============================================
// TYPES
// ============================================

export type BlogStatus = 'draft' | 'published' | 'archived';

export interface BlogRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  markdown_content: string | null;
  featured_image: string | null;
  author_id: string;
  status: BlogStatus;
  published_at: Date | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  reading_time: number;
  views: number;
  created_at: Date;
  updated_at: Date;
}

export interface BlogWithAuthor extends BlogRow {
  author_first_name: string;
  author_last_name: string;
  author_email: string;
  author_avatar: string | null;
}

export interface CreateBlogInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  markdown_content?: string | null;
  featured_image?: string | null;
  author_id: string;
  status?: BlogStatus;
  published_at?: Date | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
}

export interface UpdateBlogInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  markdown_content?: string | null;
  featured_image?: string | null;
  status?: BlogStatus;
  published_at?: Date | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
}

export interface BlogListFilters {
  status?: BlogStatus;
  author_id?: string;
  search?: string;
  published_after?: Date;
  published_before?: Date;
}

export interface BlogListOptions {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'published_at' | 'title' | 'views';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedBlogs {
  blogs: BlogWithAuthor[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Calculate reading time in minutes based on content
 */
export function calculateReadingTime(content: string): number {
  // Average reading speed: 200-250 words per minute
  // We'll use 225 as a middle ground
  const wordsPerMinute = 225;
  
  // Remove HTML tags for accurate word count
  const textContent = content.replace(/<[^>]*>/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate minutes (minimum 1 minute)
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  
  return minutes;
}

/**
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const result = await query<{ id: string }>(
      'SELECT id FROM blogs WHERE slug = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [slug, excludeId] : [slug]
    );
    
    if (result.rows.length === 0) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new blog post
 */
export async function createBlog(input: CreateBlogInput): Promise<BlogRow> {
  const {
    title,
    slug: providedSlug,
    excerpt,
    content,
    markdown_content,
    featured_image,
    author_id,
    status = 'draft',
    published_at,
    meta_title,
    meta_description,
    meta_keywords,
  } = input;

  // Generate slug if not provided
  const baseSlug = providedSlug || generateSlug(title);
  const slug = await ensureUniqueSlug(baseSlug);

  // Calculate reading time
  const readingTime = calculateReadingTime(content);

  // Set published_at if status is published and published_at is not provided
  const finalPublishedAt = status === 'published' && !published_at 
    ? new Date() 
    : published_at || null;

  const result = await query<BlogRow>(
    `INSERT INTO blogs (
      title, slug, excerpt, content, markdown_content, featured_image,
      author_id, status, published_at, meta_title, meta_description,
      meta_keywords, reading_time
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      title,
      slug,
      excerpt || null,
      content,
      markdown_content || null,
      featured_image || null,
      author_id,
      status,
      finalPublishedAt,
      meta_title || null,
      meta_description || null,
      meta_keywords || null,
      readingTime,
    ]
  );

  if (result.rows.length === 0) {
    throw ApiError.internal('Failed to create blog post');
  }

  logger.info('Blog created', { blogId: result.rows[0].id, slug, title });
  return result.rows[0];
}

/**
 * Get blog by ID
 */
export async function getBlogById(id: string, includeAuthor = true): Promise<BlogWithAuthor | BlogRow | null> {
  if (includeAuthor) {
    const result = await query<BlogWithAuthor>(
      `SELECT 
        b.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar as author_avatar
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      WHERE b.id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  const result = await query<BlogRow>(
    'SELECT * FROM blogs WHERE id = $1',
    [id]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get blog by slug
 */
export async function getBlogBySlug(slug: string, includeAuthor = true): Promise<BlogWithAuthor | BlogRow | null> {
  if (includeAuthor) {
    const result = await query<BlogWithAuthor>(
      `SELECT 
        b.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar as author_avatar
      FROM blogs b
      JOIN users u ON b.author_id = u.id
      WHERE b.slug = $1`,
      [slug]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  const result = await query<BlogRow>(
    'SELECT * FROM blogs WHERE slug = $1',
    [slug]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update blog post
 */
export async function updateBlog(id: string, input: UpdateBlogInput): Promise<BlogRow> {
  const existingBlog = await getBlogById(id, false);
  if (!existingBlog) {
    throw ApiError.notFound('Blog post not found');
  }

  const {
    title,
    slug: providedSlug,
    excerpt,
    content,
    markdown_content,
    featured_image,
    status,
    published_at,
    meta_title,
    meta_description,
    meta_keywords,
  } = input;

  // Handle slug update
  let finalSlug = existingBlog.slug;
  if (providedSlug && providedSlug !== existingBlog.slug) {
    finalSlug = await ensureUniqueSlug(providedSlug, id);
  } else if (title && title !== existingBlog.title && !providedSlug) {
    // Auto-generate slug from new title if title changed
    finalSlug = await ensureUniqueSlug(generateSlug(title), id);
  }

  // Calculate reading time if content changed
  const finalContent = content || existingBlog.content;
  const readingTime = content ? calculateReadingTime(finalContent) : existingBlog.reading_time;

  // Handle published_at based on status
  let finalPublishedAt = published_at !== undefined ? published_at : existingBlog.published_at;
  if (status === 'published' && !finalPublishedAt) {
    finalPublishedAt = new Date();
  } else if (status === 'draft' && finalPublishedAt) {
    finalPublishedAt = null;
  }

  const result = await query<BlogRow>(
    `UPDATE blogs SET
      title = COALESCE($1, title),
      slug = $2,
      excerpt = COALESCE($3, excerpt),
      content = COALESCE($4, content),
      markdown_content = COALESCE($5, markdown_content),
      featured_image = COALESCE($6, featured_image),
      status = COALESCE($7, status),
      published_at = $8,
      meta_title = COALESCE($9, meta_title),
      meta_description = COALESCE($10, meta_description),
      meta_keywords = COALESCE($11, meta_keywords),
      reading_time = $12,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $13
    RETURNING *`,
    [
      title || null,
      finalSlug,
      excerpt !== undefined ? excerpt : null,
      content || null,
      markdown_content !== undefined ? markdown_content : null,
      featured_image !== undefined ? featured_image : null,
      status || null,
      finalPublishedAt,
      meta_title !== undefined ? meta_title : null,
      meta_description !== undefined ? meta_description : null,
      meta_keywords !== undefined ? meta_keywords : null,
      readingTime,
      id,
    ]
  );

  if (result.rows.length === 0) {
    throw ApiError.internal('Failed to update blog post');
  }

  logger.info('Blog updated', { blogId: id });
  return result.rows[0];
}

/**
 * Delete blog post
 */
export async function deleteBlog(id: string): Promise<void> {
  const result = await query('DELETE FROM blogs WHERE id = $1', [id]);
  
  if (result.rowCount === 0) {
    throw ApiError.notFound('Blog post not found');
  }

  logger.info('Blog deleted', { blogId: id });
}

/**
 * List blogs with filters and pagination
 */
export async function listBlogs(
  filters: BlogListFilters = {},
  options: BlogListOptions = {},
  publicOnly = false
): Promise<PaginatedBlogs> {
  const {
    status,
    author_id,
    search,
    published_after,
    published_before,
  } = filters;

  const {
    page = 1,
    limit = 10,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = options;

  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number | Date)[] = [];
  let paramIndex = 1;

  // Public only filter (only published blogs)
  if (publicOnly) {
    conditions.push(`b.status = 'published'`);
    conditions.push(`b.published_at IS NOT NULL`);
    conditions.push(`b.published_at <= CURRENT_TIMESTAMP`);
  }

  if (status) {
    conditions.push(`b.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (author_id) {
    conditions.push(`b.author_id = $${paramIndex}`);
    params.push(author_id);
    paramIndex++;
  }

  if (published_after) {
    conditions.push(`b.published_at >= $${paramIndex}`);
    params.push(published_after);
    paramIndex++;
  }

  if (published_before) {
    conditions.push(`b.published_at <= $${paramIndex}`);
    params.push(published_before);
    paramIndex++;
  }

  if (search) {
    conditions.push(
      `(
        b.title ILIKE $${paramIndex} OR
        b.excerpt ILIKE $${paramIndex} OR
        b.content ILIKE $${paramIndex} OR
        to_tsvector('english', coalesce(b.title, '') || ' ' || coalesce(b.excerpt, '') || ' ' || coalesce(b.content, '')) @@ plainto_tsquery('english', $${paramIndex})
      )`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort_by
  const validSortColumns = ['created_at', 'updated_at', 'published_at', 'title', 'views'];
  const finalSortBy = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const finalSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
    FROM blogs b
    ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get blogs
  const blogsResult = await query<BlogWithAuthor>(
    `SELECT 
      b.*,
      u.first_name as author_first_name,
      u.last_name as author_last_name,
      u.email as author_email,
      u.avatar as author_avatar
    FROM blogs b
    JOIN users u ON b.author_id = u.id
    ${whereClause}
    ORDER BY b.${finalSortBy} ${finalSortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    blogs: blogsResult.rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

/**
 * Increment blog view count
 */
export async function incrementBlogViews(id: string): Promise<void> {
  await query('UPDATE blogs SET views = views + 1 WHERE id = $1', [id]);
}

/**
 * Bulk delete blogs
 */
export async function bulkDeleteBlogs(ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `DELETE FROM blogs WHERE id IN (${placeholders})`,
    ids
  );

  logger.info('Bulk delete blogs', { count: result.rowCount, ids });
  return result.rowCount || 0;
}

/**
 * Bulk update blog status
 */
export async function bulkUpdateBlogStatus(ids: string[], status: BlogStatus): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const params = [...ids, status];

  // Set published_at if publishing
  let updateQuery = `UPDATE blogs SET status = $${ids.length + 1}`;
  if (status === 'published') {
    updateQuery += `, published_at = COALESCE(published_at, CURRENT_TIMESTAMP)`;
  } else if (status === 'draft') {
    updateQuery += `, published_at = NULL`;
  }
  updateQuery += ` WHERE id IN (${placeholders})`;

  const result = await query(updateQuery, params);

  logger.info('Bulk update blog status', { count: result.rowCount, status, ids });
  return result.rowCount || 0;
}

/**
 * Toggle publish/unpublish status
 */
export async function togglePublishStatus(id: string): Promise<BlogRow> {
  const blog = await getBlogById(id, false);
  if (!blog) {
    throw ApiError.notFound('Blog post not found');
  }

  const newStatus: BlogStatus = blog.status === 'published' ? 'draft' : 'published';
  const publishedAt = newStatus === 'published' && !blog.published_at ? new Date() : blog.published_at;

  return updateBlog(id, {
    status: newStatus,
    published_at: publishedAt,
  });
}

// ============================================
// AI BLOG GENERATION
// ============================================

export interface GenerateBlogInput {
  topic: string;
  requirements?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'conversational';
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeSEO?: boolean;
}

export interface GeneratedBlogContent {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  category: string;
  tags: string[];
}

/**
 * Generate blog content using AI
 */
export async function generateBlogWithAI(
  input: GenerateBlogInput
): Promise<GeneratedBlogContent> {
  if (!aiProviderService.isAvailable()) {
    throw ApiError.internal('AI generation is not available. No AI providers configured.');
  }

  const {
    topic,
    requirements = '',
    tone = 'professional',
    targetAudience = 'general audience',
    length = 'medium',
    includeSEO = true,
  } = input;

  // Calculate target word count based on length
  const wordCounts = {
    short: 500,
    medium: 1200,
    long: 2500,
  };
  const targetWords = wordCounts[length];

  const systemPrompt = `You are an expert blog content writer specializing in health, wellness, and technology topics. Generate comprehensive, engaging, and well-structured blog content.

IMPORTANT: You must respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no additional text):

{
  "title": "Engaging blog post title (60-70 characters)",
  "slug": "url-friendly-slug-based-on-title",
  "excerpt": "Compelling excerpt/summary (150-200 characters)",
  "content": "Full HTML-formatted blog content with proper headings (h2, h3), paragraphs, lists, and formatting. Use <h2> for main sections and <h3> for subsections. Include <p> tags for paragraphs, <ul>/<ol> for lists, and <strong>/<em> for emphasis.",
  "meta_title": "SEO-optimized meta title (50-60 characters)",
  "meta_description": "SEO meta description (150-160 characters)",
  "meta_keywords": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "category": "Appropriate category (e.g., Health, Technology, Wellness, Features)",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}

Content Guidelines:
- Write in a ${tone} tone
- Target audience: ${targetAudience}
- Target length: approximately ${targetWords} words
- Use proper HTML formatting with semantic tags
- Include an introduction, main body with 3-5 sections, and a conclusion
- Make content engaging, informative, and valuable
- Use subheadings to break up content
- Include relevant examples and actionable insights
${requirements ? `- Additional requirements: ${requirements}` : ''}
${includeSEO ? '- Optimize for SEO with relevant keywords naturally integrated' : ''}

HTML Formatting Rules:
- Use <h2> for main section headings
- Use <h3> for subsection headings
- Use <p> for paragraphs
- Use <ul> and <li> for unordered lists
- Use <ol> and <li> for ordered lists
- Use <strong> for bold emphasis
- Use <em> for italic emphasis
- Use <blockquote> for quotes if needed
- Do NOT use <h1> tags (title is separate)
- Ensure all HTML tags are properly closed`;

  const userPrompt = `Create a comprehensive blog post about: "${topic}"

${requirements ? `Specific requirements:\n${requirements}\n` : ''}
Please ensure the content is well-researched, engaging, and provides value to readers.`;

  try {
    const response = await aiProviderService.generateCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: Math.max(2000, targetWords * 1.5), // Allow enough tokens for the content
      temperature: 0.7,
    });

    const aiContent = response.content.trim();

    // Parse AI response
    let parsedContent: GeneratedBlogContent;

    try {
      // Extract JSON from response (handle markdown code blocks if any)
      let jsonStr = aiContent.trim();
      
      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Remove any leading/trailing text that's not JSON
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      parsedContent = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.error('Failed to parse AI blog generation response', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        response: aiContent.substring(0, 500),
      });
      throw ApiError.internal('Failed to parse AI-generated content. Please try again.');
    }

    // Validate required fields
    if (!parsedContent.title || !parsedContent.content) {
      throw ApiError.internal('AI-generated content is missing required fields.');
    }

    // Ensure slug is generated if missing or normalize existing slug
    if (!parsedContent.slug) {
      parsedContent.slug = generateSlug(parsedContent.title);
    } else {
      // Normalize slug to ensure it's URL-friendly
      parsedContent.slug = generateSlug(parsedContent.slug);
    }

    // Ensure excerpt is generated if missing
    if (!parsedContent.excerpt) {
      // Generate excerpt from first paragraph of content
      const textContent = parsedContent.content.replace(/<[^>]*>/g, ' ').trim();
      parsedContent.excerpt = textContent.substring(0, 200).trim() + '...';
    }

    // Ensure SEO fields are generated if missing
    if (includeSEO) {
      if (!parsedContent.meta_title) {
        parsedContent.meta_title = parsedContent.title;
      }
      if (!parsedContent.meta_description) {
        parsedContent.meta_description = parsedContent.excerpt.substring(0, 160);
      }
      if (!parsedContent.meta_keywords) {
        parsedContent.meta_keywords = parsedContent.tags?.join(', ') || '';
      }
    }

    // Ensure category and tags are set
    if (!parsedContent.category) {
      parsedContent.category = 'General';
    }
    if (!parsedContent.tags || parsedContent.tags.length === 0) {
      parsedContent.tags = [topic.split(' ')[0]]; // Use first word of topic as tag
    }

    logger.info('AI blog generation completed', {
      topic,
      provider: response.provider,
      model: response.model,
    });

    return parsedContent;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('AI blog generation failed', {
      error: errorMessage,
      topic,
    });
    throw ApiError.internal(`Failed to generate blog content: ${errorMessage}`);
  }
}

// ============================================
// BLOG REACTIONS
// ============================================

export type ReactionType = 'like' | 'dislike';

export interface BlogReactionsResult {
  likes: number;
  dislikes: number;
  userReaction: ReactionType | null;
}

/**
 * Toggle a blog reaction (like/dislike)
 * - If no reaction exists: create it
 * - If same reaction exists: remove it (toggle off)
 * - If different reaction exists: switch it
 */
export async function toggleBlogReaction(
  blogId: string,
  userId: string,
  type: ReactionType
): Promise<{ action: 'added' | 'removed' | 'switched'; type: ReactionType }> {
  // Check for existing reaction
  const existing = await query(
    'SELECT id, reaction_type FROM blog_reactions WHERE blog_id = $1 AND user_id = $2',
    [blogId, userId]
  );

  if (existing.rows.length > 0) {
    const currentType = existing.rows[0].reaction_type as ReactionType;

    if (currentType === type) {
      // Same reaction: remove it (toggle off)
      await query(
        'DELETE FROM blog_reactions WHERE blog_id = $1 AND user_id = $2',
        [blogId, userId]
      );
      return { action: 'removed', type };
    } else {
      // Different reaction: switch it
      await query(
        'UPDATE blog_reactions SET reaction_type = $1, updated_at = CURRENT_TIMESTAMP WHERE blog_id = $2 AND user_id = $3',
        [type, blogId, userId]
      );
      return { action: 'switched', type };
    }
  }

  // No existing reaction: create it
  await query(
    'INSERT INTO blog_reactions (blog_id, user_id, reaction_type) VALUES ($1, $2, $3)',
    [blogId, userId, type]
  );
  return { action: 'added', type };
}

/**
 * Get reaction counts and optional user's reaction for a blog
 */
export async function getBlogReactions(
  blogId: string,
  userId?: string
): Promise<BlogReactionsResult> {
  const countsResult = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END), 0)::int AS likes,
      COALESCE(SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END), 0)::int AS dislikes
    FROM blog_reactions
    WHERE blog_id = $1`,
    [blogId]
  );

  let userReaction: ReactionType | null = null;

  if (userId) {
    const userResult = await query(
      'SELECT reaction_type FROM blog_reactions WHERE blog_id = $1 AND user_id = $2',
      [blogId, userId]
    );
    if (userResult.rows.length > 0) {
      userReaction = userResult.rows[0].reaction_type as ReactionType;
    }
  }

  return {
    likes: countsResult.rows[0]?.likes ?? 0,
    dislikes: countsResult.rows[0]?.dislikes ?? 0,
    userReaction,
  };
}
