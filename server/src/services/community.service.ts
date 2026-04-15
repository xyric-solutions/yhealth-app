/**
 * Community Service
 * Handles community post CRUD, replies, likes, and moderation
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';

// ============================================
// TYPES
// ============================================

export type CommunityPostStatus = 'draft' | 'published' | 'flagged' | 'archived';
export type PostType = 'discussion' | 'question' | 'tip' | 'success_story' | 'challenge' | 'announcement';

export interface CommunityPostRow {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  post_type: PostType;
  status: CommunityPostStatus;
  author_id: string | null;
  views: number;
  likes: number;
  replies_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CommunityPostWithAuthor extends CommunityPostRow {
  author_first_name: string | null;
  author_last_name: string | null;
}

export interface CommunityReplyRow {
  id: string;
  post_id: string;
  author_id: string | null;
  content: string;
  likes: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CommunityReplyWithAuthor extends CommunityReplyRow {
  author_first_name: string | null;
  author_last_name: string | null;
}

export interface CreateCommunityPostInput {
  title: string;
  content: string;
  category?: string;
  post_type?: PostType;
  status?: CommunityPostStatus;
  author_id: string;
}

export interface UpdateCommunityPostInput {
  title?: string;
  content?: string;
  category?: string;
  post_type?: PostType;
  status?: CommunityPostStatus;
  is_pinned?: boolean;
  is_featured?: boolean;
}

// ============================================
// UTILITY
// ============================================

function generateSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const result = await query<{ id: string }>(
      'SELECT id FROM community_posts WHERE slug = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [slug, excludeId] : [slug]
    );
    if (result.rows.length === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================
// POST CRUD
// ============================================

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPostRow> {
  const slug = await ensureUniqueSlug(generateSlug(input.title));
  const status = input.status || 'published';
  const result = await query<CommunityPostRow>(
    `INSERT INTO community_posts (title, slug, content, category, post_type, status, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.title, slug, input.content, input.category || 'general', input.post_type || 'discussion', status, input.author_id]
  );
  logger.info('[Community] Post created', { id: result.rows[0].id, slug });
  return result.rows[0];
}

export async function getCommunityPostById(id: string): Promise<CommunityPostWithAuthor | null> {
  const result = await query<CommunityPostWithAuthor>(
    `SELECT p.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM community_posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getCommunityPostBySlug(slug: string): Promise<CommunityPostWithAuthor | null> {
  const result = await query<CommunityPostWithAuthor>(
    `SELECT p.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM community_posts p LEFT JOIN users u ON p.author_id = u.id
     WHERE p.slug = $1 AND p.status = 'published'`,
    [slug]
  );
  return result.rows[0] || null;
}

export async function updateCommunityPost(id: string, input: UpdateCommunityPostInput): Promise<CommunityPostRow> {
  const existing = await getCommunityPostById(id);
  if (!existing) throw ApiError.notFound('Community post not found');

  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: (string | number | boolean | null)[] = [];
  let idx = 1;

  if (input.title !== undefined) { updates.push(`title = $${idx}`); params.push(input.title); idx++; }
  if (input.content !== undefined) { updates.push(`content = $${idx}`); params.push(input.content); idx++; }
  if (input.category !== undefined) { updates.push(`category = $${idx}`); params.push(input.category); idx++; }
  if (input.post_type !== undefined) { updates.push(`post_type = $${idx}`); params.push(input.post_type); idx++; }
  if (input.status !== undefined) { updates.push(`status = $${idx}`); params.push(input.status); idx++; }
  if (input.is_pinned !== undefined) { updates.push(`is_pinned = $${idx}`); params.push(input.is_pinned); idx++; }
  if (input.is_featured !== undefined) { updates.push(`is_featured = $${idx}`); params.push(input.is_featured); idx++; }

  params.push(id);
  const result = await query<CommunityPostRow>(
    `UPDATE community_posts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  logger.info('[Community] Post updated', { id });
  return result.rows[0];
}

export async function deleteCommunityPost(id: string): Promise<void> {
  const result = await query('DELETE FROM community_posts WHERE id = $1', [id]);
  if (result.rowCount === 0) throw ApiError.notFound('Community post not found');
  logger.info('[Community] Post deleted', { id });
}

export async function listCommunityPosts(options: {
  page?: number; limit?: number; status?: string; category?: string; post_type?: string; search?: string; publicOnly?: boolean;
} = {}): Promise<{ posts: CommunityPostWithAuthor[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 20, status, category, post_type, search, publicOnly = false } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  if (publicOnly) {
    conditions.push(`p.status = 'published'`);
  } else if (status) {
    conditions.push(`p.status = $${idx}`); params.push(status); idx++;
  }
  if (category) { conditions.push(`p.category = $${idx}`); params.push(category); idx++; }
  if (post_type) { conditions.push(`p.post_type = $${idx}`); params.push(post_type); idx++; }
  if (search) {
    conditions.push(`(p.title ILIKE $${idx} OR p.content ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM community_posts p ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const postsResult = await query<CommunityPostWithAuthor>(
    `SELECT p.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM community_posts p LEFT JOIN users u ON p.author_id = u.id
     ${where} ORDER BY p.is_pinned DESC, p.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { posts: postsResult.rows, total, page, limit };
}

// ============================================
// REPLIES
// ============================================

export async function getPostReplies(postId: string, page = 1, limit = 20): Promise<{ replies: CommunityReplyWithAuthor[]; total: number }> {
  const offset = (page - 1) * limit;
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM community_replies WHERE post_id = $1 AND status = 'published'`, [postId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<CommunityReplyWithAuthor>(
    `SELECT r.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM community_replies r LEFT JOIN users u ON r.author_id = u.id
     WHERE r.post_id = $1 AND r.status = 'published'
     ORDER BY r.created_at ASC LIMIT $2 OFFSET $3`,
    [postId, limit, offset]
  );

  return { replies: result.rows, total };
}

export async function createReply(postId: string, authorId: string, content: string): Promise<CommunityReplyRow> {
  const result = await query<CommunityReplyRow>(
    `INSERT INTO community_replies (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [postId, authorId, content]
  );
  // Increment replies_count
  await query('UPDATE community_posts SET replies_count = replies_count + 1 WHERE id = $1', [postId]);
  logger.info('[Community] Reply created', { postId, replyId: result.rows[0].id });
  return result.rows[0];
}

export async function deleteReply(id: string): Promise<void> {
  const reply = await query<{ post_id: string }>('SELECT post_id FROM community_replies WHERE id = $1', [id]);
  if (reply.rows.length === 0) throw ApiError.notFound('Reply not found');

  await query('DELETE FROM community_replies WHERE id = $1', [id]);
  await query('UPDATE community_posts SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = $1', [reply.rows[0].post_id]);
  logger.info('[Community] Reply deleted', { id });
}

// ============================================
// ENGAGEMENT
// ============================================

export async function likeCommunityPost(postId: string): Promise<void> {
  await query('UPDATE community_posts SET likes = likes + 1 WHERE id = $1', [postId]);
}

export async function incrementCommunityPostViews(postId: string): Promise<void> {
  await query('UPDATE community_posts SET views = views + 1 WHERE id = $1', [postId]);
}

// ============================================
// CATEGORIES & STATS
// ============================================

export async function getCommunityCategories(): Promise<{ category: string; count: number }[]> {
  const result = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*) as count FROM community_posts WHERE status = 'published' GROUP BY category ORDER BY count DESC`
  );
  return result.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }));
}

export async function getCommunityStats(): Promise<{
  total: number; published: number; flagged: number; totalReplies: number; totalViews: number;
}> {
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM community_posts GROUP BY status`
  );
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    counts[row.status] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  const aggsResult = await query<{ total_replies: string; total_views: string }>(
    `SELECT COALESCE(SUM(replies_count), 0)::int as total_replies, COALESCE(SUM(views), 0)::int as total_views FROM community_posts`
  );

  return {
    total,
    published: counts['published'] || 0,
    flagged: counts['flagged'] || 0,
    totalReplies: parseInt(aggsResult.rows[0].total_replies, 10),
    totalViews: parseInt(aggsResult.rows[0].total_views, 10),
  };
}

// ============================================
// AI COMMUNITY POST GENERATION
// ============================================

export interface GenerateCommunityInput {
  topic: string;
  post_type?: PostType;
  requirements?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'conversational';
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeSEO?: boolean;
}

export interface GeneratedCommunityContent {
  title: string;
  slug: string;
  content: string;
  category: string;
  post_type: string;
}

/**
 * Generate community post content using AI
 */
export async function generateCommunityPostWithAI(
  input: GenerateCommunityInput
): Promise<GeneratedCommunityContent> {
  if (!aiProviderService.isAvailable()) {
    throw ApiError.internal('AI generation is not available. No AI providers configured.');
  }

  const {
    topic,
    post_type = 'discussion',
    requirements = '',
    tone = 'friendly',
    targetAudience = 'health-conscious community members',
    length = 'medium',
  } = input;

  const wordCounts = { short: 300, medium: 800, long: 1500 };
  const targetWords = wordCounts[length];

  const postTypeGuide: Record<string, string> = {
    discussion: 'Start an engaging discussion that encourages community participation and diverse perspectives.',
    question: 'Frame as a thoughtful question that invites expert and peer responses.',
    tip: 'Share a practical, actionable health or wellness tip with clear benefits.',
    success_story: 'Tell an inspiring success story that motivates and encourages others.',
    challenge: 'Propose a fun, achievable health challenge that the community can participate in together.',
    announcement: 'Write a clear, informative announcement about a community update or event.',
  };

  const systemPrompt = `You are an expert community content writer for a health and wellness platform. Generate engaging, discussion-starting community posts.

IMPORTANT: You must respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no additional text):

{
  "title": "Engaging post title (60-80 characters)",
  "slug": "url-friendly-slug-based-on-title",
  "content": "Full HTML-formatted community post content with proper formatting.",
  "category": "Appropriate category (e.g., nutrition, fitness, mental-health, lifestyle, general)",
  "post_type": "${post_type}"
}

Post Type: ${post_type}
${postTypeGuide[post_type] || postTypeGuide['discussion']}

Content Guidelines:
- Write in a ${tone} tone
- Target audience: ${targetAudience}
- Target length: approximately ${targetWords} words
- Use proper HTML formatting
- Make it engaging and encourage community interaction
- End with a question or call-to-action to spark discussion
- Be authentic, relatable, and supportive
${requirements ? `- Additional requirements: ${requirements}` : ''}

HTML Formatting Rules:
- Use <h2> for section headings if needed
- Use <p> for paragraphs
- Use <ul> and <li> for lists
- Use <strong> for bold emphasis
- Use <em> for italic emphasis
- Use <blockquote> for quotes or highlights
- Do NOT use <h1> tags
- Ensure all HTML tags are properly closed`;

  const userPrompt = `Create an engaging community ${post_type} post about: "${topic}"

${requirements ? `Specific requirements:\n${requirements}\n` : ''}
Please make it engaging and encourage community discussion.`;

  try {
    const response = await aiProviderService.generateCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: Math.max(1500, targetWords * 1.5),
      temperature: 0.8,
    });

    const aiContent = response.content.trim();
    let parsedContent: GeneratedCommunityContent;

    try {
      let jsonStr = aiContent.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }
      parsedContent = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.error('Failed to parse AI community post generation response', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        response: aiContent.substring(0, 500),
      });
      throw ApiError.internal('Failed to parse AI-generated content. Please try again.');
    }

    if (!parsedContent.title || !parsedContent.content) {
      throw ApiError.internal('AI-generated content is missing required fields.');
    }

    if (!parsedContent.slug) {
      parsedContent.slug = generateSlug(parsedContent.title);
    } else {
      parsedContent.slug = generateSlug(parsedContent.slug);
    }

    if (!parsedContent.category) parsedContent.category = 'general';
    if (!parsedContent.post_type) parsedContent.post_type = post_type;

    logger.info('AI community post generation completed', {
      topic,
      post_type,
      provider: response.provider,
      model: response.model,
    });

    return parsedContent;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('AI community post generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      topic,
    });
    throw ApiError.internal('Failed to generate community post. Please try again.');
  }
}

export async function bulkDeleteCommunityPosts(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(`DELETE FROM community_posts WHERE id IN (${placeholders})`, ids);
  logger.info('[Community] Bulk delete', { count: result.rowCount });
  return result.rowCount || 0;
}
