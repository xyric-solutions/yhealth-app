/**
 * Exercise Library Service Unit Tests
 *
 * Tests for exercise catalog queries: pagination (offset + cursor),
 * full-text search, filtering, caching, and ETag computation.
 */

import { jest } from '@jest/globals';
import type { ExerciseRow, ExerciseMediaRow } from '../../../src/types/exercise-ingestion.types.js';

// ============================================
// MOCKS
// ============================================

const mockQuery = jest.fn<any>();

const mockTransaction = jest.fn<any>();

jest.unstable_mockModule('../../../src/database/pg.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockCacheGetOrSet = jest.fn<any>().mockImplementation(
  async (_key: string, factory: () => Promise<unknown>) => factory()
);
jest.unstable_mockModule('../../../src/services/cache.service.js', () => ({
  cache: {
    getOrSet: mockCacheGetOrSet,
    deleteByPattern: jest.fn().mockReturnValue(0),
  },
}));

const mockRedisGet = jest.fn<any>().mockResolvedValue(null);
const mockRedisSet = jest.fn<any>().mockResolvedValue(true);
jest.unstable_mockModule('../../../src/services/redis-cache.service.js', () => ({
  redisCacheService: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}));

// Dynamic imports after mocks
const {
  listExercises,
  listExercisesCursor,
  searchExercises,
  getExerciseById,
  getExerciseBySlug,
  getAvailableFilters,
  getExerciseStats,
  getETag,
} = await import('../../../src/services/exercise-library.service.js');

// ============================================
// FIXTURES
// ============================================

function makeExerciseRow(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: 'uuid-001',
    name: 'Bench Press',
    slug: 'exercisedb-bench-press',
    description: 'Lie on a flat bench.',
    category: 'strength',
    primary_muscle_group: 'chest',
    secondary_muscle_groups: ['triceps'],
    equipment_required: ['barbell'],
    difficulty_level: 'intermediate',
    instructions: ['Lie on bench', 'Press up'],
    tips: [],
    common_mistakes: null,
    video_url: null,
    thumbnail_url: null,
    animation_url: null,
    default_sets: 3,
    default_reps: 10,
    default_duration_seconds: null,
    default_rest_seconds: 60,
    is_system: true,
    is_active: true,
    calories_per_minute: null,
    met_value: null,
    tags: ['strength', 'chest', 'barbell'],
    source: 'exercisedb',
    source_id: 'edb-001',
    body_part: 'chest',
    target_muscles: ['pectorals'],
    version: 1,
    external_metadata: {},
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
    ...overrides,
  };
}

function makeMediaRow(overrides: Partial<ExerciseMediaRow> = {}): ExerciseMediaRow {
  return {
    id: 'media-001',
    exercise_id: 'uuid-001',
    type: 'gif',
    url: 'https://example.com/bench.gif',
    r2_key: null,
    width: null,
    height: null,
    file_size: null,
    mime_type: 'image/gif',
    is_primary: true,
    source: 'exercisedb',
    ...overrides,
  };
}

function qr<T>(rows: T[] = []) {
  return { rows, rowCount: rows.length, command: 'SELECT' as const, oid: 0, fields: [] };
}

// ============================================
// TESTS
// ============================================

describe('ExerciseLibraryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: cache passes through to factory
    mockCacheGetOrSet.mockImplementation(
      async (_key: string, factory: () => Promise<unknown>) => factory()
    );
  });

  // ------------------------------------------
  // listExercises (offset-based pagination)
  // ------------------------------------------
  describe('listExercises', () => {
    it('should return paginated exercises with metadata', async () => {
      const exercises = [makeExerciseRow(), makeExerciseRow({ id: 'uuid-002', name: 'Squat' })];
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '2' }])) // COUNT
        .mockResolvedValueOnce(qr(exercises)); // SELECT

      const result = await listExercises({}, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPrevPage).toBe(false);
    });

    it('should apply category filter', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '5' }]))
        .mockResolvedValueOnce(qr([makeExerciseRow()]));

      await listExercises({ category: 'strength' }, { page: 1, limit: 10 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('category = $');
      expect(mockQuery.mock.calls[0][1]).toContain('strength');
    });

    it('should apply muscle filter across muscle columns', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '3' }]))
        .mockResolvedValueOnce(qr([makeExerciseRow()]));

      await listExercises({ muscle: 'chest' }, { page: 1, limit: 10 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('primary_muscle_group');
      expect(countSql).toContain('secondary_muscle_groups');
      expect(countSql).toContain('target_muscles');
    });

    it('should apply equipment filter', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '1' }]))
        .mockResolvedValueOnce(qr([makeExerciseRow()]));

      await listExercises({ equipment: 'barbell' }, { page: 1, limit: 10 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('ANY(equipment_required)');
    });

    it('should calculate correct pagination metadata', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '50' }]))
        .mockResolvedValueOnce(qr([]));

      const result = await listExercises({}, { page: 3, limit: 10 });

      expect(result.meta.total).toBe(50);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPrevPage).toBe(true);
    });

    it('should use cache for repeat queries', async () => {
      const cachedResult = {
        data: [makeExerciseRow()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      };
      mockCacheGetOrSet.mockResolvedValueOnce(cachedResult);

      const result = await listExercises({}, { page: 1, limit: 20 });

      expect(result).toEqual(cachedResult);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should include WHERE conditions for active and non-deleted', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '0' }]))
        .mockResolvedValueOnce(qr([]));

      await listExercises({}, { page: 1, limit: 20 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('deleted_at IS NULL');
      expect(countSql).toContain('is_active = true');
    });
  });

  // ------------------------------------------
  // listExercisesCursor (cursor-based pagination)
  // ------------------------------------------
  describe('listExercisesCursor', () => {
    it('should return exercises with cursor metadata', async () => {
      const exercises = [
        makeExerciseRow({ id: 'uuid-001', name: 'Alpha' }),
        makeExerciseRow({ id: 'uuid-002', name: 'Beta' }),
      ];
      mockQuery
        .mockResolvedValueOnce(qr(exercises)) // data (limit+1 but only 2 returned)
        .mockResolvedValueOnce(qr([{ total: '2' }])); // count

      const result = await listExercisesCursor({}, { limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('should set hasMore=true when more results exist', async () => {
      // Return limit+1 items to indicate more exist
      const exercises = Array.from({ length: 3 }, (_, i) =>
        makeExerciseRow({ id: `uuid-${i}`, name: `Exercise ${i}` })
      );
      mockQuery
        .mockResolvedValueOnce(qr(exercises)) // 3 items for limit=2
        .mockResolvedValueOnce(qr([{ total: '10' }]));

      const result = await listExercisesCursor({}, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.nextCursor).toBeTruthy();
    });

    it('should apply cursor condition when cursor provided', async () => {
      // Encode a cursor
      const cursorData = Buffer.from(JSON.stringify({ id: 'uuid-001', sortValue: 'Alpha' })).toString('base64url');

      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([{ total: '0' }]));

      await listExercisesCursor({}, { cursor: cursorData, limit: 20 });

      const dataSql = mockQuery.mock.calls[0][0] as string;
      // Should contain tuple comparison for keyset pagination
      expect(dataSql).toContain('(name, id)');
    });

    it('should return total count in metadata', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([{ total: '42' }]));

      const result = await listExercisesCursor({}, { limit: 20 });
      expect(result.meta.total).toBe(42);
    });
  });

  // ------------------------------------------
  // searchExercises
  // ------------------------------------------
  describe('searchExercises', () => {
    it('should use plainto_tsquery for full-text search', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '1' }]))
        .mockResolvedValueOnce(qr([{ ...makeExerciseRow(), relevance: 0.85 }]));

      await searchExercises('bench press', {}, { page: 1, limit: 20 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('search_vector @@ plainto_tsquery');
      expect(mockQuery.mock.calls[0][1]).toContain('bench press');
    });

    it('should order results by relevance descending', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '2' }]))
        .mockResolvedValueOnce(qr([
          { ...makeExerciseRow({ id: 'uuid-001' }), relevance: 0.95 },
          { ...makeExerciseRow({ id: 'uuid-002' }), relevance: 0.60 },
        ]));

      const result = await searchExercises('bench', {}, { page: 1, limit: 20 });

      const dataSql = mockQuery.mock.calls[1][0] as string;
      expect(dataSql).toContain('ORDER BY relevance DESC');
      expect(result.data).toHaveLength(2);
    });

    it('should combine search with filters', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '1' }]))
        .mockResolvedValueOnce(qr([{ ...makeExerciseRow(), relevance: 0.8 }]));

      await searchExercises('bench', { category: 'strength' }, { page: 1, limit: 10 });

      const countSql = mockQuery.mock.calls[0][0] as string;
      expect(countSql).toContain('category = $');
      expect(countSql).toContain('search_vector @@ plainto_tsquery');
    });

    it('should use Redis cache for search results', async () => {
      const cachedResult = JSON.stringify({
        data: [{ ...makeExerciseRow(), relevance: 0.9 }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
      mockRedisGet.mockResolvedValueOnce(cachedResult);

      const result = await searchExercises('bench', {}, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should cache new search results in Redis', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '1' }]))
        .mockResolvedValueOnce(qr([{ ...makeExerciseRow(), relevance: 0.9 }]));

      await searchExercises('deadlift', {}, { page: 1, limit: 20 });

      expect(mockRedisSet).toHaveBeenCalledTimes(1);
      const cacheKey = mockRedisSet.mock.calls[0][0] as string;
      expect(cacheKey).toContain('exercises:search:');
    });
  });

  // ------------------------------------------
  // getExerciseById
  // ------------------------------------------
  describe('getExerciseById', () => {
    it('should return exercise with media', async () => {
      const exercise = makeExerciseRow();
      const media = [makeMediaRow()];

      mockQuery
        .mockResolvedValueOnce(qr([exercise]))
        .mockResolvedValueOnce(qr(media));

      const result = await getExerciseById('uuid-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('uuid-001');
      expect(result!.media).toHaveLength(1);
      expect(result!.media[0].type).toBe('gif');
    });

    it('should return null for non-existent exercise', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      const result = await getExerciseById('non-existent');
      expect(result).toBeNull();
    });

    it('should exclude soft-deleted exercises', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      await getExerciseById('uuid-deleted');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('deleted_at IS NULL');
    });
  });

  // ------------------------------------------
  // getExerciseBySlug
  // ------------------------------------------
  describe('getExerciseBySlug', () => {
    it('should return exercise by slug with media', async () => {
      const exercise = makeExerciseRow();
      const media = [makeMediaRow()];

      mockQuery
        .mockResolvedValueOnce(qr([exercise]))
        .mockResolvedValueOnce(qr(media));

      const result = await getExerciseBySlug('exercisedb-bench-press');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('exercisedb-bench-press');
      expect(result!.media).toHaveLength(1);
    });

    it('should return null for non-existent slug', async () => {
      mockQuery.mockResolvedValueOnce(qr([]));

      const result = await getExerciseBySlug('does-not-exist');
      expect(result).toBeNull();
    });
  });

  // ------------------------------------------
  // getAvailableFilters
  // ------------------------------------------
  describe('getAvailableFilters', () => {
    it('should return distinct filter values', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ category: 'strength' }, { category: 'cardio' }]))
        .mockResolvedValueOnce(qr([{ muscle: 'chest' }, { muscle: 'back' }]))
        .mockResolvedValueOnce(qr([{ equip: 'barbell' }, { equip: 'dumbbell' }]))
        .mockResolvedValueOnce(qr([{ difficulty_level: 'beginner' }, { difficulty_level: 'intermediate' }]))
        .mockResolvedValueOnce(qr([{ body_part: 'chest' }]))
        .mockResolvedValueOnce(qr([{ source: 'exercisedb' }]));

      const result = await getAvailableFilters();

      expect(result.categories).toEqual(['strength', 'cardio']);
      expect(result.muscles).toEqual(['chest', 'back']);
      expect(result.equipment).toEqual(['barbell', 'dumbbell']);
      expect(result.difficulties).toEqual(['beginner', 'intermediate']);
      expect(result.bodyParts).toEqual(['chest']);
      expect(result.sources).toEqual(['exercisedb']);
    });

    it('should execute 6 parallel queries', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]));

      await getAvailableFilters();

      expect(mockQuery).toHaveBeenCalledTimes(6);
    });
  });

  // ------------------------------------------
  // getExerciseStats
  // ------------------------------------------
  describe('getExerciseStats', () => {
    it('should return exercise counts grouped by category, source, difficulty', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ total: '1500' }]))
        .mockResolvedValueOnce(qr([{ category: 'strength', count: '1200' }, { category: 'cardio', count: '300' }]))
        .mockResolvedValueOnce(qr([{ source: 'exercisedb', count: '1300' }, { source: 'manual', count: '200' }]))
        .mockResolvedValueOnce(qr([{ difficulty_level: 'intermediate', count: '800' }, { difficulty_level: 'beginner', count: '700' }]));

      const result = await getExerciseStats();

      expect(result.totalExercises).toBe(1500);
      expect(result.byCategory).toEqual({ strength: 1200, cardio: 300 });
      expect(result.bySource).toEqual({ exercisedb: 1300, manual: 200 });
      expect(result.byDifficulty).toEqual({ intermediate: 800, beginner: 700 });
    });
  });

  // ------------------------------------------
  // getETag
  // ------------------------------------------
  describe('getETag', () => {
    it('should compute ETag from max updated_at and count', async () => {
      mockQuery.mockResolvedValueOnce(qr([{ max_updated: '2026-02-15T00:00:00Z', cnt: 1500 }]));

      const etag = await getETag();

      expect(typeof etag).toBe('string');
      expect(etag.length).toBeGreaterThan(0);
    });

    it('should return different ETags for different datasets', async () => {
      mockQuery.mockResolvedValueOnce(qr([{ max_updated: '2026-02-15T00:00:00Z', cnt: 1500 }]));
      const etag1 = await getETag();

      mockQuery.mockResolvedValueOnce(qr([{ max_updated: '2026-02-16T00:00:00Z', cnt: 1501 }]));
      const etag2 = await getETag();

      expect(etag1).not.toBe(etag2);
    });

    it('should apply filters to ETag computation', async () => {
      mockQuery.mockResolvedValueOnce(qr([{ max_updated: '2026-02-15T00:00:00Z', cnt: 500 }]));

      await getETag({ category: 'strength' });

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('category = $');
    });
  });
});
