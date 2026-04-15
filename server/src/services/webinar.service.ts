/**
 * Webinar Service
 * Handles webinar CRUD, registration, and stats
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';

// ============================================
// TYPES
// ============================================

export type WebinarStatus = 'draft' | 'published' | 'cancelled' | 'completed' | 'archived';

export interface WebinarRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  category: string;
  status: WebinarStatus;
  host_name: string | null;
  host_title: string | null;
  host_avatar: string | null;
  featured_image: string | null;
  scheduled_at: Date | null;
  duration_minutes: number;
  max_attendees: number | null;
  meeting_url: string | null;
  recording_url: string | null;
  registration_count: number;
  views: number;
  is_featured: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WebinarRegistrationRow {
  id: string;
  webinar_id: string;
  user_id: string | null;
  name: string;
  email: string;
  attended: boolean;
  created_at: Date;
}

export interface CreateWebinarInput {
  title: string;
  slug?: string;
  description?: string | null;
  content?: string | null;
  category?: string;
  status?: WebinarStatus;
  host_name?: string | null;
  host_title?: string | null;
  host_avatar?: string | null;
  featured_image?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number;
  max_attendees?: number | null;
  meeting_url?: string | null;
  recording_url?: string | null;
  is_featured?: boolean;
  created_by: string;
}

export interface UpdateWebinarInput {
  title?: string;
  slug?: string;
  description?: string | null;
  content?: string | null;
  category?: string;
  status?: WebinarStatus;
  host_name?: string | null;
  host_title?: string | null;
  host_avatar?: string | null;
  featured_image?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number;
  max_attendees?: number | null;
  meeting_url?: string | null;
  recording_url?: string | null;
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
      'SELECT id FROM webinars WHERE slug = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [slug, excludeId] : [slug]
    );
    if (result.rows.length === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================
// CRUD
// ============================================

export async function createWebinar(input: CreateWebinarInput): Promise<WebinarRow> {
  const baseSlug = input.slug || generateSlug(input.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await query<WebinarRow>(
    `INSERT INTO webinars (title, slug, description, content, category, status, host_name, host_title, host_avatar, featured_image, scheduled_at, duration_minutes, max_attendees, meeting_url, recording_url, is_featured, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [input.title, slug, input.description || null, input.content || null, input.category || 'general', input.status || 'draft', input.host_name || null, input.host_title || null, input.host_avatar || null, input.featured_image || null, input.scheduled_at || null, input.duration_minutes || 60, input.max_attendees || null, input.meeting_url || null, input.recording_url || null, input.is_featured || false, input.created_by]
  );

  logger.info('[Webinar] Created', { id: result.rows[0].id, slug });
  return result.rows[0];
}

export async function getWebinarById(id: string): Promise<WebinarRow | null> {
  const result = await query<WebinarRow>('SELECT * FROM webinars WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getWebinarBySlug(slug: string): Promise<WebinarRow | null> {
  const result = await query<WebinarRow>(
    `SELECT * FROM webinars WHERE slug = $1 AND status IN ('published', 'completed')`,
    [slug]
  );
  return result.rows[0] || null;
}

export async function updateWebinar(id: string, input: UpdateWebinarInput): Promise<WebinarRow> {
  const existing = await getWebinarById(id);
  if (!existing) throw ApiError.notFound('Webinar not found');

  let finalSlug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    finalSlug = await ensureUniqueSlug(input.slug, id);
  } else if (input.title && input.title !== existing.title && !input.slug) {
    finalSlug = await ensureUniqueSlug(generateSlug(input.title), id);
  }

  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP', `slug = $1`];
  const params: (string | number | boolean | null)[] = [finalSlug];
  let idx = 2;

  if (input.title !== undefined) { updates.push(`title = $${idx}`); params.push(input.title); idx++; }
  if (input.description !== undefined) { updates.push(`description = $${idx}`); params.push(input.description); idx++; }
  if (input.content !== undefined) { updates.push(`content = $${idx}`); params.push(input.content); idx++; }
  if (input.category !== undefined) { updates.push(`category = $${idx}`); params.push(input.category); idx++; }
  if (input.status !== undefined) { updates.push(`status = $${idx}`); params.push(input.status); idx++; }
  if (input.host_name !== undefined) { updates.push(`host_name = $${idx}`); params.push(input.host_name); idx++; }
  if (input.host_title !== undefined) { updates.push(`host_title = $${idx}`); params.push(input.host_title); idx++; }
  if (input.host_avatar !== undefined) { updates.push(`host_avatar = $${idx}`); params.push(input.host_avatar); idx++; }
  if (input.featured_image !== undefined) { updates.push(`featured_image = $${idx}`); params.push(input.featured_image); idx++; }
  if (input.scheduled_at !== undefined) { updates.push(`scheduled_at = $${idx}`); params.push(input.scheduled_at); idx++; }
  if (input.duration_minutes !== undefined) { updates.push(`duration_minutes = $${idx}`); params.push(input.duration_minutes); idx++; }
  if (input.max_attendees !== undefined) { updates.push(`max_attendees = $${idx}`); params.push(input.max_attendees); idx++; }
  if (input.meeting_url !== undefined) { updates.push(`meeting_url = $${idx}`); params.push(input.meeting_url); idx++; }
  if (input.recording_url !== undefined) { updates.push(`recording_url = $${idx}`); params.push(input.recording_url); idx++; }
  if (input.is_featured !== undefined) { updates.push(`is_featured = $${idx}`); params.push(input.is_featured); idx++; }

  params.push(id);
  const result = await query<WebinarRow>(
    `UPDATE webinars SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  logger.info('[Webinar] Updated', { id });
  return result.rows[0];
}

export async function deleteWebinar(id: string): Promise<void> {
  const result = await query('DELETE FROM webinars WHERE id = $1', [id]);
  if (result.rowCount === 0) throw ApiError.notFound('Webinar not found');
  logger.info('[Webinar] Deleted', { id });
}

export async function listWebinars(options: {
  page?: number; limit?: number; status?: string; category?: string; search?: string; publicOnly?: boolean;
} = {}): Promise<{ webinars: WebinarRow[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 20, status, category, search, publicOnly = false } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  if (publicOnly) {
    conditions.push(`w.status IN ('published', 'completed')`);
  } else if (status) {
    conditions.push(`w.status = $${idx}`); params.push(status); idx++;
  }
  if (category) { conditions.push(`w.category = $${idx}`); params.push(category); idx++; }
  if (search) {
    conditions.push(`(w.title ILIKE $${idx} OR w.description ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM webinars w ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const webinarsResult = await query<WebinarRow>(
    `SELECT * FROM webinars w ${where} ORDER BY w.scheduled_at DESC NULLS LAST, w.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { webinars: webinarsResult.rows, total, page, limit };
}

// ============================================
// REGISTRATION
// ============================================

export async function registerForWebinar(webinarId: string, name: string, email: string, userId?: string): Promise<WebinarRegistrationRow> {
  const webinar = await getWebinarById(webinarId);
  if (!webinar) throw ApiError.notFound('Webinar not found');
  if (webinar.status !== 'published') throw ApiError.badRequest('Registration is not open for this webinar');
  if (webinar.max_attendees && webinar.registration_count >= webinar.max_attendees) {
    throw ApiError.badRequest('This webinar is full');
  }

  const result = await query<WebinarRegistrationRow>(
    `INSERT INTO webinar_registrations (webinar_id, user_id, name, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (webinar_id, email) DO NOTHING
     RETURNING *`,
    [webinarId, userId || null, name, email]
  );

  if (result.rows.length === 0) throw ApiError.badRequest('You are already registered for this webinar');

  await query('UPDATE webinars SET registration_count = registration_count + 1 WHERE id = $1', [webinarId]);
  logger.info('[Webinar] Registration', { webinarId, email });
  return result.rows[0];
}

export async function getWebinarRegistrations(webinarId: string, page = 1, limit = 50): Promise<{ registrations: WebinarRegistrationRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = $1', [webinarId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<WebinarRegistrationRow>(
    `SELECT * FROM webinar_registrations WHERE webinar_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [webinarId, limit, offset]
  );

  return { registrations: result.rows, total };
}

// ============================================
// CATEGORIES & STATS
// ============================================

export async function getWebinarCategories(): Promise<{ category: string; count: number }[]> {
  const result = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*) as count FROM webinars WHERE status IN ('published', 'completed') GROUP BY category ORDER BY count DESC`
  );
  return result.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }));
}

export async function getWebinarStats(): Promise<{
  total: number; published: number; completed: number; upcoming: number; totalRegistrations: number;
}> {
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM webinars GROUP BY status`
  );
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    counts[row.status] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  const upcomingResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM webinars WHERE status = 'published' AND scheduled_at > CURRENT_TIMESTAMP`
  );

  const regResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(registration_count), 0)::int as total FROM webinars`
  );

  return {
    total,
    published: counts['published'] || 0,
    completed: counts['completed'] || 0,
    upcoming: parseInt(upcomingResult.rows[0].count, 10),
    totalRegistrations: parseInt(regResult.rows[0].total, 10),
  };
}

// ============================================
// AI WEBINAR CONTENT GENERATION
// ============================================

export interface GenerateWebinarInput {
  topic: string;
  requirements?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'conversational';
  targetAudience?: string;
  length?: 'short' | 'medium' | 'long';
  includeSEO?: boolean;
}

export interface GeneratedWebinarContent {
  title: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  host_name: string;
  host_title: string;
  duration_minutes: number;
}

/**
 * Generate webinar content using AI
 */
export async function generateWebinarWithAI(
  input: GenerateWebinarInput
): Promise<GeneratedWebinarContent> {
  if (!aiProviderService.isAvailable()) {
    throw ApiError.internal('AI generation is not available. No AI providers configured.');
  }

  const {
    topic,
    requirements = '',
    tone = 'professional',
    targetAudience = 'health-conscious professionals',
    length = 'medium',
  } = input;

  const wordCounts = { short: 500, medium: 1200, long: 2500 };
  const targetWords = wordCounts[length];

  const systemPrompt = `You are an expert webinar content creator specializing in health, wellness, and technology topics. Generate compelling webinar descriptions and content.

IMPORTANT: You must respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no additional text):

{
  "title": "Compelling webinar title (60-80 characters)",
  "slug": "url-friendly-slug-based-on-title",
  "description": "Brief webinar description for listings (200-300 characters)",
  "content": "Full HTML-formatted webinar content with agenda, key topics, learning outcomes, and speaker info.",
  "category": "Appropriate category (e.g., nutrition, fitness, mental-health, technology, wellness, general)",
  "host_name": "Suggested host name (e.g., Dr. Sarah Johnson)",
  "host_title": "Suggested host title (e.g., Certified Nutritionist & Wellness Coach)",
  "duration_minutes": 60
}

Content Guidelines:
- Write in a ${tone} tone
- Target audience: ${targetAudience}
- Target length: approximately ${targetWords} words for the content field
- Use proper HTML formatting for the content
- Include a webinar overview, agenda/outline, key learning outcomes
- Make the description promotional and compelling
- Include what attendees will learn and take away
- Suggest an appropriate duration (30, 45, 60, or 90 minutes)
${requirements ? `- Additional requirements: ${requirements}` : ''}

HTML Formatting Rules for content:
- Use <h2> for main section headings (e.g., "Overview", "Agenda", "What You'll Learn")
- Use <h3> for subsection headings
- Use <p> for paragraphs
- Use <ul> and <li> for bullet points
- Use <ol> and <li> for numbered items
- Use <strong> for bold emphasis
- Use <em> for italic emphasis
- Do NOT use <h1> tags
- Ensure all HTML tags are properly closed`;

  const userPrompt = `Create compelling webinar content about: "${topic}"

${requirements ? `Specific requirements:\n${requirements}\n` : ''}
Please make the content informative, engaging, and create a clear agenda.`;

  try {
    const response = await aiProviderService.generateCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: Math.max(2000, targetWords * 1.5),
      temperature: 0.7,
    });

    const aiContent = response.content.trim();
    let parsedContent: GeneratedWebinarContent;

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
      logger.error('Failed to parse AI webinar generation response', {
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

    if (!parsedContent.description) {
      const textContent = parsedContent.content.replace(/<[^>]*>/g, ' ').trim();
      parsedContent.description = textContent.substring(0, 300).trim() + '...';
    }

    if (!parsedContent.category) parsedContent.category = 'general';
    if (!parsedContent.host_name) parsedContent.host_name = 'TBA';
    if (!parsedContent.host_title) parsedContent.host_title = 'Health & Wellness Expert';
    if (!parsedContent.duration_minutes) parsedContent.duration_minutes = 60;

    logger.info('AI webinar generation completed', {
      topic,
      provider: response.provider,
      model: response.model,
    });

    return parsedContent;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('AI webinar generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      topic,
    });
    throw ApiError.internal('Failed to generate webinar content. Please try again.');
  }
}

export async function bulkDeleteWebinars(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(`DELETE FROM webinars WHERE id IN (${placeholders})`, ids);
  logger.info('[Webinar] Bulk delete', { count: result.rowCount });
  return result.rowCount || 0;
}
