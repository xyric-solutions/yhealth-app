/**
 * @file Testimonial Service
 * Database query service for testimonials CRUD and public listing.
 */

import { query } from '../database/pg.js';
import type {
  AdminListTestimonialsQuery,
  CreateTestimonialInput,
} from '../validators/admin-testimonial.validator.js';

// ============================================
// TYPES
// ============================================

export interface TestimonialRow {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  rating: number;
  content: string;
  verified: boolean;
  pillar: 'fitness' | 'nutrition' | 'wellbeing' | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TestimonialStats {
  totalTestimonials: number;
  activeCount: number;
  inactiveCount: number;
  featuredCount: number;
  averageRating: number;
  byPillar: Record<string, number>;
  byRating: Record<string, number>;
}

// ============================================
// ADMIN QUERIES
// ============================================

/**
 * List testimonials with pagination, search, and filters (admin).
 */
export async function adminListTestimonials(filters: AdminListTestimonialsQuery) {
  const { page, limit, search, pillar, rating, is_active, is_featured, sort_by, sort_order } = filters;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(name ILIKE $${paramIdx} OR role ILIKE $${paramIdx} OR content ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (pillar) {
    conditions.push(`pillar = $${paramIdx}`);
    params.push(pillar);
    paramIdx++;
  }

  if (rating) {
    conditions.push(`rating = $${paramIdx}`);
    params.push(rating);
    paramIdx++;
  }

  if (is_active !== undefined) {
    conditions.push(`is_active = $${paramIdx}`);
    params.push(is_active === 'true');
    paramIdx++;
  }

  if (is_featured !== undefined) {
    conditions.push(`is_featured = $${paramIdx}`);
    params.push(is_featured === 'true');
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSortColumns: Record<string, string> = {
    name: 'name',
    rating: 'rating',
    pillar: 'pillar',
    display_order: 'display_order',
    created_at: 'created_at',
    updated_at: 'updated_at',
  };
  const sortColumn = allowedSortColumns[sort_by] || 'display_order';
  const sortDir = sort_order === 'desc' ? 'DESC' : 'ASC';

  // Count query
  const countResult = await query<{ total: string }>(`SELECT COUNT(*) as total FROM testimonials ${whereClause}`, params as (string | number | boolean)[]);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query
  const dataResult = await query<TestimonialRow>(
    `SELECT * FROM testimonials ${whereClause} ORDER BY ${sortColumn} ${sortDir} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset] as (string | number | boolean)[]
  );

  return {
    data: dataResult.rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a single testimonial by ID.
 */
export async function adminGetTestimonialById(id: string): Promise<TestimonialRow | null> {
  const result = await query<TestimonialRow>('SELECT * FROM testimonials WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get testimonial stats for admin dashboard.
 */
export async function adminGetTestimonialStats(): Promise<TestimonialStats> {
  const result = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active_count,
      COUNT(*) FILTER (WHERE is_active = false) as inactive_count,
      COUNT(*) FILTER (WHERE is_featured = true) as featured_count,
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0) as avg_rating
    FROM testimonials
  `);

  const { total, active_count, inactive_count, featured_count, avg_rating } = result.rows[0];

  // By pillar
  const pillarResult = await query(`
    SELECT pillar, COUNT(*) as count FROM testimonials
    WHERE pillar IS NOT NULL GROUP BY pillar
  `);
  const byPillar: Record<string, number> = {};
  for (const row of pillarResult.rows) {
    byPillar[row.pillar] = parseInt(row.count, 10);
  }

  // By rating
  const ratingResult = await query(`
    SELECT rating, COUNT(*) as count FROM testimonials GROUP BY rating ORDER BY rating
  `);
  const byRating: Record<string, number> = {};
  for (const row of ratingResult.rows) {
    byRating[row.rating] = parseInt(row.count, 10);
  }

  return {
    totalTestimonials: parseInt(total, 10),
    activeCount: parseInt(active_count, 10),
    inactiveCount: parseInt(inactive_count, 10),
    featuredCount: parseInt(featured_count, 10),
    averageRating: parseFloat(avg_rating),
    byPillar,
    byRating,
  };
}

/**
 * Create a new testimonial.
 */
export async function adminCreateTestimonial(data: CreateTestimonialInput): Promise<TestimonialRow> {
  const result = await query<TestimonialRow>(
    `INSERT INTO testimonials (name, role, avatar_url, rating, content, verified, pillar, is_active, is_featured, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.role,
      data.avatar_url || null,
      data.rating,
      data.content,
      data.verified ?? false,
      data.pillar || null,
      data.is_active ?? true,
      data.is_featured ?? false,
      data.display_order ?? 0,
    ]
  );
  return result.rows[0];
}

/**
 * Update an existing testimonial.
 */
export async function adminUpdateTestimonial(id: string, data: Partial<CreateTestimonialInput>): Promise<TestimonialRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    role: 'role',
    avatar_url: 'avatar_url',
    rating: 'rating',
    content: 'content',
    verified: 'verified',
    pillar: 'pillar',
    is_active: 'is_active',
    is_featured: 'is_featured',
    display_order: 'display_order',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in data) {
      fields.push(`${column} = $${paramIdx}`);
      values.push((data as Record<string, unknown>)[key]);
      paramIdx++;
    }
  }

  if (fields.length === 0) return adminGetTestimonialById(id);

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query<TestimonialRow>(
    `UPDATE testimonials SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values as (string | number | boolean | null)[]
  );
  return result.rows[0] || null;
}

/**
 * Delete a testimonial (hard delete).
 */
export async function adminDeleteTestimonial(id: string): Promise<boolean> {
  const result = await query('DELETE FROM testimonials WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Bulk delete testimonials.
 */
export async function adminBulkDelete(ids: string[]): Promise<number> {
  const result = await query('DELETE FROM testimonials WHERE id = ANY($1::uuid[])', [ids]);
  return result.rowCount ?? 0;
}

/**
 * Bulk toggle active status.
 */
export async function adminBulkToggleActive(ids: string[], is_active: boolean): Promise<number> {
  const result = await query(
    'UPDATE testimonials SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[])',
    [is_active, ids]
  );
  return result.rowCount ?? 0;
}

/**
 * Toggle active status for a single testimonial.
 */
export async function adminToggleActive(id: string): Promise<TestimonialRow | null> {
  const result = await query<TestimonialRow>(
    `UPDATE testimonials SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Toggle featured status for a single testimonial.
 */
export async function adminToggleFeatured(id: string): Promise<TestimonialRow | null> {
  const result = await query<TestimonialRow>(
    `UPDATE testimonials SET is_featured = NOT is_featured, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

// ============================================
// PUBLIC QUERIES
// ============================================

/**
 * Get active testimonials for public landing page display.
 */
export async function getPublicTestimonials(): Promise<TestimonialRow[]> {
  const result = await query<TestimonialRow>(
    `SELECT * FROM testimonials WHERE is_active = true ORDER BY is_featured DESC, display_order ASC, created_at DESC`
  );
  return result.rows;
}
