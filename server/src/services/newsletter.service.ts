/**
 * Newsletter Service
 * Handles newsletter (email) subscription CRUD for footer/lead magnet signups
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface NewsletterSubscriptionRow {
  id: string;
  email: string;
  interests: string[];
  source: string;
  created_at: Date;
}

export interface CreateNewsletterInput {
  email: string;
  interests?: string[];
  source?: string;
}

export interface NewsletterListFilters {
  search?: string;
  source?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface NewsletterListOptions {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'email';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedNewsletter {
  subscriptions: NewsletterSubscriptionRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const ALLOWED_INTERESTS = ['fitness', 'nutrition', 'wellbeing'];

// ============================================
// CRUD
// ============================================

export async function createSubscription(input: CreateNewsletterInput): Promise<NewsletterSubscriptionRow> {
  const email = input.email.trim().toLowerCase();
  const interests = (input.interests || []).filter((i) => ALLOWED_INTERESTS.includes(i.toLowerCase()));
  const source = (input.source || 'footer').slice(0, 50);

  const result = await query<NewsletterSubscriptionRow>(
    `INSERT INTO newsletter_subscriptions (email, interests, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       interests = COALESCE(EXCLUDED.interests, newsletter_subscriptions.interests),
       source = EXCLUDED.source
     RETURNING *`,
    [email, interests, source]
  );

  logger.info('[Newsletter] Subscription created/updated', { id: result.rows[0].id, email });
  return result.rows[0];
}

export async function getSubscriptionCount(): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM newsletter_subscriptions'
  );
  return parseInt(result.rows[0].count, 10);
}

export async function listSubscriptions(
  filters: NewsletterListFilters = {},
  options: NewsletterListOptions = {}
): Promise<PaginatedNewsletter> {
  const { search, source, created_after, created_before } = filters;
  const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' } = options;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number | Date)[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    conditions.push(`(email ILIKE $${paramCount})`);
    params.push(`%${search}%`);
  }
  if (source) {
    paramCount++;
    conditions.push(`source = $${paramCount}`);
    params.push(source);
  }
  if (created_after) {
    paramCount++;
    conditions.push(`created_at >= $${paramCount}`);
    params.push(created_after);
  }
  if (created_before) {
    paramCount++;
    conditions.push(`created_at <= $${paramCount}`);
    params.push(created_before);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = sort_by === 'email' ? 'email' : 'created_at';
  const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM newsletter_subscriptions ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const limitParam = paramCount + 1;
  const offsetParam = paramCount + 2;
  const listResult = await query<NewsletterSubscriptionRow>(
    `SELECT id, email, interests, source, created_at
     FROM newsletter_subscriptions
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, limit, offset]
  );

  const total_pages = Math.ceil(total / limit) || 1;

  return {
    subscriptions: listResult.rows,
    total,
    page,
    limit,
    total_pages,
  };
}

export async function getSubscriptionById(id: string): Promise<NewsletterSubscriptionRow | null> {
  const result = await query<NewsletterSubscriptionRow>(
    'SELECT id, email, interests, source, created_at FROM newsletter_subscriptions WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    'DELETE FROM newsletter_subscriptions WHERE id = $1 RETURNING id',
    [id]
  );
  if (result.rowCount && result.rowCount > 0) {
    logger.info('[Newsletter] Subscription deleted', { id });
    return true;
  }
  return false;
}

export async function bulkDeleteSubscriptions(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<{ id: string }>(
    `DELETE FROM newsletter_subscriptions WHERE id IN (${placeholders}) RETURNING id`,
    ids
  );
  const deleted = result.rowCount ?? 0;
  logger.info('[Newsletter] Bulk delete', { count: deleted, ids });
  return deleted;
}
