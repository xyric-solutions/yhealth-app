/**
 * Help Service
 * Handles help article CRUD operations, search, categories, and feedback
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';

// ============================================
// TYPES
// ============================================

export type HelpStatus = 'draft' | 'published' | 'archived';

export interface HelpArticleRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  status: HelpStatus;
  author_id: string | null;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface HelpArticleWithAuthor extends HelpArticleRow {
  author_first_name: string | null;
  author_last_name: string | null;
}

export interface CreateHelpArticleInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  category?: string;
  status?: HelpStatus;
  author_id: string;
  sort_order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface UpdateHelpArticleInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  category?: string;
  status?: HelpStatus;
  sort_order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
}

// ============================================
// UTILITY
// ============================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const result = await query<{ id: string }>(
      'SELECT id FROM help_articles WHERE slug = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [slug, excludeId] : [slug]
    );
    if (result.rows.length === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================
// CRUD OPERATIONS
// ============================================

export async function createHelpArticle(input: CreateHelpArticleInput): Promise<HelpArticleRow> {
  const baseSlug = input.slug || generateSlug(input.title);
  const slug = await ensureUniqueSlug(baseSlug);
  const status = input.status || 'draft';
  const publishedAt = status === 'published' ? new Date() : null;

  const result = await query<HelpArticleRow>(
    `INSERT INTO help_articles (title, slug, excerpt, content, category, status, author_id, sort_order, meta_title, meta_description, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [input.title, slug, input.excerpt || null, input.content, input.category || 'general', status, input.author_id, input.sort_order || 0, input.meta_title || null, input.meta_description || null, publishedAt]
  );

  logger.info('[Help] Article created', { id: result.rows[0].id, slug });
  return result.rows[0];
}

export async function getHelpArticleById(id: string): Promise<HelpArticleWithAuthor | null> {
  const result = await query<HelpArticleWithAuthor>(
    `SELECT h.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM help_articles h
     LEFT JOIN users u ON h.author_id = u.id
     WHERE h.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getHelpArticleBySlug(slug: string): Promise<HelpArticleWithAuthor | null> {
  const result = await query<HelpArticleWithAuthor>(
    `SELECT h.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM help_articles h
     LEFT JOIN users u ON h.author_id = u.id
     WHERE h.slug = $1 AND h.status = 'published'`,
    [slug]
  );
  return result.rows[0] || null;
}

export async function updateHelpArticle(id: string, input: UpdateHelpArticleInput): Promise<HelpArticleRow> {
  const existing = await getHelpArticleById(id);
  if (!existing) throw ApiError.notFound('Help article not found');

  let finalSlug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    finalSlug = await ensureUniqueSlug(input.slug, id);
  } else if (input.title && input.title !== existing.title && !input.slug) {
    finalSlug = await ensureUniqueSlug(generateSlug(input.title), id);
  }

  let publishedAt = existing.published_at;
  if (input.status === 'published' && !publishedAt) publishedAt = new Date();

  const result = await query<HelpArticleRow>(
    `UPDATE help_articles SET
      title = COALESCE($1, title), slug = $2, excerpt = COALESCE($3, excerpt),
      content = COALESCE($4, content), category = COALESCE($5, category),
      status = COALESCE($6, status), sort_order = COALESCE($7, sort_order),
      meta_title = COALESCE($8, meta_title), meta_description = COALESCE($9, meta_description),
      published_at = $10, updated_at = CURRENT_TIMESTAMP
     WHERE id = $11 RETURNING *`,
    [input.title || null, finalSlug, input.excerpt !== undefined ? input.excerpt : null, input.content || null, input.category || null, input.status || null, input.sort_order ?? null, input.meta_title !== undefined ? input.meta_title : null, input.meta_description !== undefined ? input.meta_description : null, publishedAt, id]
  );

  logger.info('[Help] Article updated', { id });
  return result.rows[0];
}

export async function deleteHelpArticle(id: string): Promise<void> {
  const result = await query('DELETE FROM help_articles WHERE id = $1', [id]);
  if (result.rowCount === 0) throw ApiError.notFound('Help article not found');
  logger.info('[Help] Article deleted', { id });
}

export async function listHelpArticles(options: {
  page?: number; limit?: number; status?: string; category?: string; search?: string; publicOnly?: boolean;
} = {}): Promise<{ articles: HelpArticleWithAuthor[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 20, status, category, search, publicOnly = false } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  if (publicOnly) {
    conditions.push(`h.status = 'published'`);
  } else if (status) {
    conditions.push(`h.status = $${idx}`); params.push(status); idx++;
  }
  if (category) { conditions.push(`h.category = $${idx}`); params.push(category); idx++; }
  if (search) {
    conditions.push(`(h.title ILIKE $${idx} OR h.excerpt ILIKE $${idx} OR h.content ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM help_articles h ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const articlesResult = await query<HelpArticleWithAuthor>(
    `SELECT h.*, u.first_name as author_first_name, u.last_name as author_last_name
     FROM help_articles h LEFT JOIN users u ON h.author_id = u.id
     ${where} ORDER BY h.sort_order ASC, h.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { articles: articlesResult.rows, total, page, limit };
}

export async function getHelpCategories(): Promise<{ category: string; count: number }[]> {
  const result = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*) as count FROM help_articles WHERE status = 'published' GROUP BY category ORDER BY count DESC`
  );
  return result.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }));
}

export async function incrementHelpViews(id: string): Promise<void> {
  await query('UPDATE help_articles SET views = views + 1 WHERE id = $1', [id]);
}

export async function submitHelpFeedback(id: string, helpful: boolean): Promise<void> {
  const field = helpful ? 'helpful_yes' : 'helpful_no';
  await query(`UPDATE help_articles SET ${field} = ${field} + 1 WHERE id = $1`, [id]);
}

export async function bulkDeleteHelpArticles(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(`DELETE FROM help_articles WHERE id IN (${placeholders})`, ids);
  logger.info('[Help] Bulk delete', { count: result.rowCount });
  return result.rowCount || 0;
}

// ============================================
// AI HELP ARTICLE GENERATION
// ============================================

export interface GenerateHelpInput {
  topic: string;
  requirements?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'conversational';
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeSEO?: boolean;
}

export interface GeneratedHelpContent {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  meta_title: string;
  meta_description: string;
}

/**
 * Generate help article content using AI
 */
export async function generateHelpArticleWithAI(
  input: GenerateHelpInput
): Promise<GeneratedHelpContent> {
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

  const wordCounts = { short: 500, medium: 1200, long: 2500 };
  const targetWords = wordCounts[length];

  const systemPrompt = `You are an expert help center content writer specializing in health, wellness, and technology topics. Generate clear, informative, and user-friendly help articles.

IMPORTANT: You must respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no additional text):

{
  "title": "Clear help article title (60-70 characters)",
  "slug": "url-friendly-slug-based-on-title",
  "excerpt": "Brief summary of what this article covers (150-200 characters)",
  "content": "Full HTML-formatted help article with proper headings (h2, h3), paragraphs, step-by-step instructions, and formatting.",
  "category": "Appropriate category (e.g., getting-started, account, features, troubleshooting, billing)",
  "meta_title": "SEO-optimized meta title (50-60 characters)",
  "meta_description": "SEO meta description (150-160 characters)"
}

Content Guidelines:
- Write in a ${tone} tone
- Target audience: ${targetAudience}
- Target length: approximately ${targetWords} words
- Use proper HTML formatting with semantic tags
- Structure as a help article with clear steps and instructions
- Include an introduction explaining what the article covers
- Use numbered steps for procedures, bullet points for lists
- Include tips, warnings, or notes where helpful
- Make content scannable with clear headings
${requirements ? `- Additional requirements: ${requirements}` : ''}
${includeSEO ? '- Optimize for SEO with relevant keywords naturally integrated' : ''}

HTML Formatting Rules:
- Use <h2> for main section headings
- Use <h3> for subsection headings
- Use <p> for paragraphs
- Use <ul> and <li> for unordered lists
- Use <ol> and <li> for numbered steps
- Use <strong> for bold emphasis
- Use <em> for italic emphasis
- Use <blockquote> for tips or important notes
- Do NOT use <h1> tags (title is separate)
- Ensure all HTML tags are properly closed`;

  const userPrompt = `Create a comprehensive help article about: "${topic}"

${requirements ? `Specific requirements:\n${requirements}\n` : ''}
Please ensure the article is clear, easy to follow, and helps users accomplish their goals.`;

  try {
    const response = await aiProviderService.generateCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: Math.max(2000, targetWords * 1.5),
      temperature: 0.7,
    });

    const aiContent = response.content.trim();
    let parsedContent: GeneratedHelpContent;

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
      logger.error('Failed to parse AI help article generation response', {
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

    if (!parsedContent.excerpt) {
      const textContent = parsedContent.content.replace(/<[^>]*>/g, ' ').trim();
      parsedContent.excerpt = textContent.substring(0, 200).trim() + '...';
    }

    if (includeSEO) {
      if (!parsedContent.meta_title) parsedContent.meta_title = parsedContent.title;
      if (!parsedContent.meta_description) parsedContent.meta_description = parsedContent.excerpt.substring(0, 160);
    }

    if (!parsedContent.category) parsedContent.category = 'general';

    logger.info('AI help article generation completed', {
      topic,
      provider: response.provider,
      model: response.model,
    });

    return parsedContent;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('AI help article generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      topic,
    });
    throw ApiError.internal('Failed to generate help article. Please try again.');
  }
}

export async function getHelpStats(): Promise<{
  total: number; published: number; draft: number; totalViews: number; categories: number;
}> {
  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM help_articles GROUP BY status`
  );
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of result.rows) {
    counts[row.status] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  const viewsResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(views), 0)::int as total FROM help_articles`
  );

  const catsResult = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT category)::int as count FROM help_articles`
  );

  return {
    total,
    published: counts['published'] || 0,
    draft: counts['draft'] || 0,
    totalViews: parseInt(viewsResult.rows[0].total, 10),
    categories: parseInt(catsResult.rows[0].count, 10),
  };
}
