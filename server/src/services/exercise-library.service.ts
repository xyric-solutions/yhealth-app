/**
 * @file Exercise Library Service
 * Production-grade query service for the exercise catalog.
 * Features: pagination (offset + cursor), full-text search, filtering,
 * two-tier caching (node-cache + Redis), and ETag support.
 */

import { createHash } from 'crypto';
import { query } from '../database/pg.js';
import { cache } from './cache.service.js';
import { redisCacheService } from './redis-cache.service.js';
import type {
  ExerciseFilters,
  PaginationParams,
  PaginatedResult,
  CursorPaginationParams,
  CursorPaginatedResult,
  DecodedCursor,
  ExerciseRow,
  ExerciseDetail,
  ExerciseMediaRow,
  ExerciseFilterOptions,
  ExerciseStats,
} from '../types/exercise-ingestion.types.js';
import type {
  AdminListExercisesQuery,
  CreateExerciseInput,
  UpdateExerciseInput,
} from '../validators/admin-exercise.validator.js';
import { invalidateExerciseCache } from './exercise-ingestion.service.js';

// ============================================
// CONSTANTS
// ============================================

const CACHE_TTL_LIST = 1800;    // 30 minutes for list queries
const CACHE_TTL_DETAIL = 3600;  // 60 minutes for individual exercises
const CACHE_TTL_FILTERS = 3600; // 60 minutes for filter options
const CACHE_TTL_SEARCH = 900;   // 15 minutes for search results (Redis)

const CACHE_PREFIX = 'exercises';

// ============================================
// CACHE HELPERS
// ============================================

function cacheKey(...parts: (string | number | undefined)[]): string {
  return [CACHE_PREFIX, ...parts.filter(Boolean)].join(':');
}

function hashParams(params: Record<string, unknown>): string {
  return createHash('md5').update(JSON.stringify(params)).digest('hex').slice(0, 12);
}

/**
 * Compute ETag from the most recent updated_at timestamp
 */
async function computeETag(filters?: ExerciseFilters): Promise<string> {
  const { conditions, params } = buildWhereClause(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT MAX(updated_at) AS max_updated, COUNT(*) AS cnt FROM exercises ${whereClause}`,
    params
  );

  const maxUpdated = result.rows[0]?.max_updated || '';
  const count = result.rows[0]?.cnt || 0;
  return createHash('md5').update(`${maxUpdated}-${count}`).digest('hex');
}

// ============================================
// QUERY BUILDING
// ============================================

interface WhereClause {
  conditions: string[];
  params: (string | string[])[];
}

function buildWhereClause(filters?: ExerciseFilters): WhereClause {
  const conditions: string[] = ['deleted_at IS NULL', 'is_active = true'];
  const params: (string | string[])[] = [];
  let paramIndex = 1;

  if (!filters) return { conditions, params };

  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filters.category);
  }

  if (filters.muscle) {
    conditions.push(`(
      primary_muscle_group = $${paramIndex} OR
      $${paramIndex} = ANY(secondary_muscle_groups) OR
      $${paramIndex} = ANY(target_muscles)
    )`);
    params.push(filters.muscle);
    paramIndex++;
  }

  if (filters.equipment) {
    conditions.push(`$${paramIndex++} = ANY(equipment_required)`);
    params.push(filters.equipment);
  }

  if (filters.difficulty) {
    conditions.push(`difficulty_level = $${paramIndex++}`);
    params.push(filters.difficulty);
  }

  if (filters.bodyPart) {
    conditions.push(`body_part = $${paramIndex++}`);
    params.push(filters.bodyPart);
  }

  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(filters.source);
  }

  return { conditions, params };
}

function buildOrderClause(filters?: ExerciseFilters): string {
  const sort = filters?.sort || 'name';
  const order = filters?.order || 'asc';

  const validSorts: Record<string, string> = {
    name: 'name',
    category: 'category',
    difficulty: 'difficulty_level',
    created_at: 'created_at',
    updated_at: 'updated_at',
  };

  const sortColumn = validSorts[sort] || 'name';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  return `ORDER BY ${sortColumn} ${sortOrder}, id ASC`;
}

// ============================================
// OFFSET-BASED PAGINATION
// ============================================

/**
 * List exercises with offset-based pagination and filtering
 */
export async function listExercises(
  filters: ExerciseFilters = {},
  pagination: PaginationParams = { page: 1, limit: 20 }
): Promise<PaginatedResult<ExerciseRow>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const paramsHash = hashParams({ ...filters, page, limit });
  const key = cacheKey('list', paramsHash);

  return cache.getOrSet<PaginatedResult<ExerciseRow>>(key, async () => {
    const { conditions, params } = buildWhereClause(filters);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = buildOrderClause(filters);

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM exercises ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch page
    const dataParams = [...params, limit, offset];
    const dataResult = await query<ExerciseRow>(
      `SELECT * FROM exercises ${whereClause} ${orderClause}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }, CACHE_TTL_LIST);
}

// ============================================
// CURSOR-BASED PAGINATION
// ============================================

/**
 * Encode a cursor value
 */
function encodeCursor(id: string, sortValue: string | number): string {
  return Buffer.from(JSON.stringify({ id, sortValue })).toString('base64url');
}

/**
 * Decode a cursor value
 */
function decodeCursor(cursor: string): DecodedCursor {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    return { id: decoded.id, sortValue: decoded.sortValue };
  } catch {
    throw new Error('Invalid cursor format');
  }
}

/**
 * List exercises with cursor-based pagination
 */
export async function listExercisesCursor(
  filters: ExerciseFilters = {},
  cursorParams: CursorPaginationParams = { limit: 20 }
): Promise<CursorPaginatedResult<ExerciseRow>> {
  const { cursor, limit } = cursorParams;
  const { conditions, params } = buildWhereClause(filters);
  const sort = filters.sort || 'name';
  const order = filters.order || 'asc';

  const validSorts: Record<string, string> = {
    name: 'name',
    category: 'category',
    difficulty: 'difficulty_level',
    created_at: 'created_at',
  };
  const sortColumn = validSorts[sort] || 'name';
  const sortOp = order === 'desc' ? '<' : '>';

  // Add cursor condition
  if (cursor) {
    const decoded = decodeCursor(cursor);
    const cursorParamIdx = params.length + 1;
    const idParamIdx = params.length + 2;
    conditions.push(
      `(${sortColumn}, id) ${sortOp} ($${cursorParamIdx}, $${idParamIdx})`
    );
    params.push(String(decoded.sortValue), decoded.id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
  const orderClause = `ORDER BY ${sortColumn} ${sortOrder}, id ${sortOrder}`;

  // Fetch limit + 1 to detect hasMore
  const dataParams = [...params, limit + 1];
  const result = await query<ExerciseRow>(
    `SELECT * FROM exercises ${whereClause} ${orderClause}
     LIMIT $${params.length + 1}`,
    dataParams
  );

  const hasMore = result.rows.length > limit;
  const data = hasMore ? result.rows.slice(0, limit) : result.rows;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastRow = data[data.length - 1];
    const sortVal = (lastRow as unknown as Record<string, unknown>)[sortColumn === 'difficulty_level' ? 'difficulty_level' : sort];
    nextCursor = encodeCursor(lastRow.id, sortVal as string | number);
  }

  // Get total count for metadata
  const { conditions: countConditions, params: countParams } = buildWhereClause(filters);
  const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
  const countResult = await query(
    `SELECT COUNT(*) AS total FROM exercises ${countWhere}`,
    countParams
  );

  return {
    data,
    meta: {
      limit,
      hasMore,
      nextCursor,
      prevCursor: cursor || null,
      total: parseInt(countResult.rows[0].total, 10),
    },
  };
}

// ============================================
// FULL-TEXT SEARCH
// ============================================

/**
 * Search exercises using PostgreSQL full-text search
 */
export async function searchExercises(
  searchQuery: string,
  filters: ExerciseFilters = {},
  pagination: PaginationParams = { page: 1, limit: 20 }
): Promise<PaginatedResult<ExerciseRow & { relevance: number }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const searchKey = cacheKey('search', hashParams({ q: searchQuery, ...filters, page, limit }));

  // Try Redis for search results first (shared cache across instances)
  const redisResult = await redisCacheService.get<string>(searchKey);
  if (redisResult) {
    try {
      return JSON.parse(redisResult);
    } catch {
      // Corrupted cache, continue to DB query
    }
  }

  const { conditions, params } = buildWhereClause(filters);

  // Add search condition
  const searchParamIdx = params.length + 1;
  conditions.push(`search_vector @@ plainto_tsquery('english', $${searchParamIdx})`);
  params.push(searchQuery);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countResult = await query(
    `SELECT COUNT(*) AS total FROM exercises ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Fetch with relevance ranking
  const dataParams = [...params, limit, offset];
  const dataResult = await query<ExerciseRow & { relevance: number }>(
    `SELECT *,
       ts_rank(search_vector, plainto_tsquery('english', $${searchParamIdx})) AS relevance
     FROM exercises
     ${whereClause}
     ORDER BY relevance DESC, name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  const totalPages = Math.ceil(total / limit);

  const result: PaginatedResult<ExerciseRow & { relevance: number }> = {
    data: dataResult.rows,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };

  // Cache in Redis for cross-instance sharing
  try {
    await redisCacheService.set(searchKey, JSON.stringify(result), CACHE_TTL_SEARCH);
  } catch {
    // Redis unavailable, no-op
  }

  return result;
}

// ============================================
// SINGLE EXERCISE
// ============================================

/**
 * Get an exercise by ID with media assets
 */
export async function getExerciseById(id: string): Promise<ExerciseDetail | null> {
  const key = cacheKey('id', id);

  return cache.getOrSet<ExerciseDetail | null>(key, async () => {
    const exerciseResult = await query<ExerciseRow>(
      `SELECT * FROM exercises WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (exerciseResult.rows.length === 0) return null;

    const mediaResult = await query<ExerciseMediaRow>(
      `SELECT * FROM exercise_media WHERE exercise_id = $1 ORDER BY is_primary DESC, type ASC`,
      [id]
    );

    return {
      ...exerciseResult.rows[0],
      media: mediaResult.rows,
    };
  }, CACHE_TTL_DETAIL);
}

/**
 * Get an exercise by slug with media assets
 */
export async function getExerciseBySlug(slug: string): Promise<ExerciseDetail | null> {
  const key = cacheKey('slug', slug);

  return cache.getOrSet<ExerciseDetail | null>(key, async () => {
    const exerciseResult = await query<ExerciseRow>(
      `SELECT * FROM exercises WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );

    if (exerciseResult.rows.length === 0) return null;

    const exercise = exerciseResult.rows[0];
    const mediaResult = await query<ExerciseMediaRow>(
      `SELECT * FROM exercise_media WHERE exercise_id = $1 ORDER BY is_primary DESC, type ASC`,
      [exercise.id]
    );

    return {
      ...exercise,
      media: mediaResult.rows,
    };
  }, CACHE_TTL_DETAIL);
}

// ============================================
// FILTER OPTIONS & STATS
// ============================================

/**
 * Get available filter options (for dropdowns)
 */
export async function getAvailableFilters(): Promise<ExerciseFilterOptions> {
  const key = cacheKey('filters');

  return cache.getOrSet<ExerciseFilterOptions>(key, async () => {
    const [categories, muscles, equipments, difficulties, bodyParts, sources] =
      await Promise.all([
        query(`SELECT DISTINCT category FROM exercises WHERE deleted_at IS NULL AND is_active = true AND category IS NOT NULL ORDER BY category`),
        query(`SELECT DISTINCT primary_muscle_group AS muscle FROM exercises WHERE deleted_at IS NULL AND is_active = true AND primary_muscle_group IS NOT NULL ORDER BY muscle`),
        query(`SELECT DISTINCT unnest(equipment_required) AS equip FROM exercises WHERE deleted_at IS NULL AND is_active = true ORDER BY equip`),
        query(`SELECT DISTINCT difficulty_level FROM exercises WHERE deleted_at IS NULL AND is_active = true AND difficulty_level IS NOT NULL ORDER BY difficulty_level`),
        query(`SELECT DISTINCT body_part FROM exercises WHERE deleted_at IS NULL AND is_active = true AND body_part IS NOT NULL ORDER BY body_part`),
        query(`SELECT DISTINCT source FROM exercises WHERE deleted_at IS NULL AND is_active = true ORDER BY source`),
      ]);

    return {
      categories: categories.rows.map(r => r.category),
      muscles: muscles.rows.map(r => r.muscle),
      equipment: equipments.rows.map(r => r.equip),
      difficulties: difficulties.rows.map(r => r.difficulty_level),
      bodyParts: bodyParts.rows.map(r => r.body_part),
      sources: sources.rows.map(r => r.source),
    };
  }, CACHE_TTL_FILTERS);
}

/**
 * Get exercise statistics
 */
export async function getExerciseStats(): Promise<ExerciseStats> {
  const key = cacheKey('stats');

  return cache.getOrSet<ExerciseStats>(key, async () => {
    const [totalResult, categoryResult, sourceResult, difficultyResult] =
      await Promise.all([
        query(`SELECT COUNT(*) AS total FROM exercises WHERE deleted_at IS NULL AND is_active = true`),
        query(`SELECT category, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL AND is_active = true GROUP BY category ORDER BY count DESC`),
        query(`SELECT source, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL AND is_active = true GROUP BY source ORDER BY count DESC`),
        query(`SELECT difficulty_level, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL AND is_active = true GROUP BY difficulty_level ORDER BY count DESC`),
      ]);

    const byCategory: Record<string, number> = {};
    categoryResult.rows.forEach(r => { byCategory[r.category] = parseInt(r.count, 10); });

    const bySource: Record<string, number> = {};
    sourceResult.rows.forEach(r => { bySource[r.source] = parseInt(r.count, 10); });

    const byDifficulty: Record<string, number> = {};
    difficultyResult.rows.forEach(r => { byDifficulty[r.difficulty_level] = parseInt(r.count, 10); });

    return {
      totalExercises: parseInt(totalResult.rows[0].total, 10),
      byCategory,
      bySource,
      byDifficulty,
    };
  }, CACHE_TTL_FILTERS);
}

// ============================================
// ADMIN CRUD METHODS
// ============================================

interface AdminWhereClause {
  conditions: string[];
  params: (string | string[])[];
  paramIndex: number;
}

function buildAdminWhereClause(filters: AdminListExercisesQuery): AdminWhereClause {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | string[])[] = [];
  let paramIndex = 1;

  if (filters.search) {
    conditions.push(`name ILIKE $${paramIndex++}`);
    params.push(`%${filters.search}%`);
  }

  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filters.category);
  }

  if (filters.difficulty) {
    conditions.push(`difficulty_level = $${paramIndex++}`);
    params.push(filters.difficulty);
  }

  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(filters.source);
  }

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(filters.is_active);
  }

  return { conditions, params, paramIndex };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 300);
}

/**
 * Admin: List exercises (includes inactive, supports search/filters)
 */
export async function adminListExercises(
  filters: AdminListExercisesQuery
): Promise<PaginatedResult<ExerciseRow>> {
  const { page, limit, sort_by, sort_order } = filters;
  const offset = (page - 1) * limit;
  const { conditions, params } = buildAdminWhereClause(filters);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const validSorts: Record<string, string> = {
    name: 'name', category: 'category', difficulty_level: 'difficulty_level',
    source: 'source', created_at: 'created_at', updated_at: 'updated_at',
  };
  const sortCol = validSorts[sort_by] || 'created_at';
  const orderClause = `ORDER BY ${sortCol} ${sort_order === 'asc' ? 'ASC' : 'DESC'}, id ASC`;

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM exercises ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataResult = await query<ExerciseRow>(
    `SELECT * FROM exercises ${whereClause} ${orderClause}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  const totalPages = Math.ceil(total / limit);

  return {
    data: dataResult.rows,
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

/**
 * Admin: Get exercise by ID (includes inactive, with media)
 */
export async function adminGetExerciseById(id: string): Promise<ExerciseDetail | null> {
  const exerciseResult = await query<ExerciseRow>(
    `SELECT * FROM exercises WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (exerciseResult.rows.length === 0) return null;

  const mediaResult = await query<ExerciseMediaRow>(
    `SELECT * FROM exercise_media WHERE exercise_id = $1 ORDER BY is_primary DESC, type ASC`,
    [id]
  );

  return { ...exerciseResult.rows[0], media: mediaResult.rows };
}

/**
 * Admin: Create a new exercise
 */
export async function adminCreateExercise(input: CreateExerciseInput): Promise<ExerciseRow> {
  const slug = input.slug || slugify(input.name);

  const result = await query<ExerciseRow>(
    `INSERT INTO exercises (
      name, slug, description, category, primary_muscle_group,
      secondary_muscle_groups, equipment_required, difficulty_level,
      instructions, tips, common_mistakes,
      video_url, thumbnail_url, animation_url,
      default_sets, default_reps, default_duration_seconds, default_rest_seconds,
      is_active, calories_per_minute, met_value, tags, body_part, target_muscles,
      source, is_system, version
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24,
      'manual', false, 1
    ) RETURNING *`,
    [
      input.name, slug, input.description ?? null, input.category, input.primary_muscle_group ?? null,
      input.secondary_muscle_groups ?? [], input.equipment_required ?? [], input.difficulty_level,
      JSON.stringify(input.instructions ?? []), JSON.stringify(input.tips ?? []), JSON.stringify(input.common_mistakes ?? []),
      input.video_url ?? null, input.thumbnail_url ?? null, input.animation_url ?? null,
      input.default_sets ?? 3, input.default_reps ?? 10, input.default_duration_seconds ?? null, input.default_rest_seconds ?? 60,
      input.is_active ?? true, input.calories_per_minute ?? null, input.met_value ?? null,
      input.tags ?? [], input.body_part ?? null, input.target_muscles ?? [],
    ]
  );

  invalidateExerciseCache();
  return result.rows[0];
}

/**
 * Admin: Update an exercise
 */
export async function adminUpdateExercise(id: string, input: UpdateExerciseInput): Promise<ExerciseRow | null> {
  // Build SET clause dynamically from provided fields
  const setClauses: string[] = [];
  const params: (string | number | boolean | null | Date | object)[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    name: 'name', slug: 'slug', description: 'description', category: 'category',
    primary_muscle_group: 'primary_muscle_group', difficulty_level: 'difficulty_level',
    video_url: 'video_url', thumbnail_url: 'thumbnail_url', animation_url: 'animation_url',
    default_sets: 'default_sets', default_reps: 'default_reps',
    default_duration_seconds: 'default_duration_seconds', default_rest_seconds: 'default_rest_seconds',
    is_active: 'is_active', calories_per_minute: 'calories_per_minute', met_value: 'met_value',
    body_part: 'body_part',
  };

  const arrayFields: Record<string, string> = {
    secondary_muscle_groups: 'secondary_muscle_groups', equipment_required: 'equipment_required',
    tags: 'tags', target_muscles: 'target_muscles',
  };

  const jsonFields: Record<string, string> = {
    instructions: 'instructions', tips: 'tips', common_mistakes: 'common_mistakes',
  };

  const inputRecord = input as Record<string, string | number | boolean | null | object | undefined>;

  for (const [key, column] of Object.entries(fieldMap)) {
    if (inputRecord[key] !== undefined) {
      setClauses.push(`${column} = $${paramIndex++}`);
      params.push(inputRecord[key] as string | number | boolean | null | object);
    }
  }

  for (const [key, column] of Object.entries(arrayFields)) {
    if (inputRecord[key] !== undefined) {
      setClauses.push(`${column} = $${paramIndex++}`);
      params.push(inputRecord[key] as string | number | boolean | null | object);
    }
  }

  for (const [key, column] of Object.entries(jsonFields)) {
    if (inputRecord[key] !== undefined) {
      setClauses.push(`${column} = $${paramIndex++}`);
      params.push(JSON.stringify(inputRecord[key]));
    }
  }

  if (setClauses.length === 0) return adminGetExerciseById(id) as Promise<ExerciseRow | null>;

  setClauses.push(`version = version + 1`);
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const result = await query<ExerciseRow>(
    `UPDATE exercises SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;

  invalidateExerciseCache();
  return result.rows[0];
}

/**
 * Admin: Soft delete an exercise
 */
export async function adminSoftDeleteExercise(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE exercises SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (result.rowCount && result.rowCount > 0) {
    invalidateExerciseCache();
    return true;
  }
  return false;
}

/**
 * Admin: Bulk soft delete exercises
 */
export async function adminBulkSoftDelete(ids: string[]): Promise<number> {
  const result = await query(
    `UPDATE exercises SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($1) AND deleted_at IS NULL`,
    [ids]
  );
  const count = result.rowCount || 0;
  if (count > 0) invalidateExerciseCache();
  return count;
}

/**
 * Admin: Bulk toggle active status
 */
export async function adminBulkToggleActive(ids: string[], isActive: boolean): Promise<number> {
  const result = await query(
    `UPDATE exercises SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($2) AND deleted_at IS NULL`,
    [isActive, ids]
  );
  const count = result.rowCount || 0;
  if (count > 0) invalidateExerciseCache();
  return count;
}

/**
 * Admin: Toggle single exercise active status
 */
export async function adminToggleActive(id: string): Promise<ExerciseRow | null> {
  const result = await query<ExerciseRow>(
    `UPDATE exercises SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) return null;
  invalidateExerciseCache();
  return result.rows[0];
}

/**
 * Admin: Enhanced exercise stats (includes inactive counts)
 */
export async function adminGetExerciseStats(): Promise<ExerciseStats & { activeCount: number; inactiveCount: number }> {
  const [totalResult, activeResult, categoryResult, sourceResult, difficultyResult] =
    await Promise.all([
      query(`SELECT COUNT(*) AS total FROM exercises WHERE deleted_at IS NULL`),
      query(`SELECT
        COUNT(*) FILTER (WHERE is_active = true) AS active,
        COUNT(*) FILTER (WHERE is_active = false) AS inactive
        FROM exercises WHERE deleted_at IS NULL`),
      query(`SELECT category, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL GROUP BY category ORDER BY count DESC`),
      query(`SELECT source, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL GROUP BY source ORDER BY count DESC`),
      query(`SELECT difficulty_level, COUNT(*) AS count FROM exercises WHERE deleted_at IS NULL GROUP BY difficulty_level ORDER BY count DESC`),
    ]);

  const byCategory: Record<string, number> = {};
  categoryResult.rows.forEach(r => { byCategory[r.category] = parseInt(r.count, 10); });

  const bySource: Record<string, number> = {};
  sourceResult.rows.forEach(r => { bySource[r.source] = parseInt(r.count, 10); });

  const byDifficulty: Record<string, number> = {};
  difficultyResult.rows.forEach(r => { byDifficulty[r.difficulty_level] = parseInt(r.count, 10); });

  return {
    totalExercises: parseInt(totalResult.rows[0].total, 10),
    activeCount: parseInt(activeResult.rows[0].active, 10),
    inactiveCount: parseInt(activeResult.rows[0].inactive, 10),
    byCategory,
    bySource,
    byDifficulty,
  };
}

// ============================================
// ETAG SUPPORT
// ============================================

/**
 * Get ETag for the current exercise dataset
 */
export async function getETag(filters?: ExerciseFilters): Promise<string> {
  return computeETag(filters);
}

// ============================================
// EXPORTS
// ============================================

export const exerciseLibraryService = {
  listExercises,
  listExercisesCursor,
  searchExercises,
  getExerciseById,
  getExerciseBySlug,
  getAvailableFilters,
  getExerciseStats,
  getETag,
  // Admin CRUD
  adminListExercises,
  adminGetExerciseById,
  adminCreateExercise,
  adminUpdateExercise,
  adminSoftDeleteExercise,
  adminBulkSoftDelete,
  adminBulkToggleActive,
  adminToggleActive,
  adminGetExerciseStats,
};

export default exerciseLibraryService;
