/**
 * @file Exercise Ingestion Service
 * ETL pipeline for fetching, transforming, deduplicating, and storing
 * exercises from external data sources (ExerciseDB, RapidAPI).
 */

import axios from 'axios';
import { query, transaction } from '../database/pg.js';
import { logger } from './logger.service.js';
import { cache } from './cache.service.js';
import { withRetry } from '../utils/asyncHandler.js';
import { env } from '../config/env.config.js';
import type {
  ExerciseDBResponse,
  ExerciseDBExercise,
  RapidAPIExercise,
  MuscleWikiExercise,
  MuscleWikiListResponse,
  TransformedExercise,
  MediaUrl,
  IngestionResult,
  IngestionError,
  IngestionOptions,
} from '../types/exercise-ingestion.types.js';
import type { PoolClient } from 'pg';

// ============================================
// CONSTANTS
// ============================================

const EXERCISEDB_BASE_URL = 'https://exercisedb-api.vercel.app/api/v1';
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_PAGE_LIMIT = 100;
const RATE_LIMIT_DELAY_MS = 500;

// Body region mapping for muscles
const BODY_REGION_MAP: Record<string, string> = {
  chest: 'upper_body',
  back: 'upper_body',
  shoulders: 'upper_body',
  'upper arms': 'upper_body',
  'lower arms': 'upper_body',
  neck: 'upper_body',
  'upper legs': 'lower_body',
  'lower legs': 'lower_body',
  waist: 'core',
  cardio: 'full_body',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Slugify a string for use as URL-friendly identifier
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Infer exercise category from body parts and equipment
 */
function inferCategory(exercise: ExerciseDBExercise): string {
  const bodyParts = exercise.bodyParts.map(b => b.toLowerCase());
  const equipment = exercise.equipments.map(e => e.toLowerCase());

  if (bodyParts.includes('cardio') || equipment.includes('stationary bike') || equipment.includes('elliptical machine')) {
    return 'cardio';
  }
  if (equipment.includes('body weight') && (bodyParts.includes('back') || bodyParts.includes('waist'))) {
    return 'strength';
  }
  if (equipment.includes('stretch') || equipment.includes('foam roller')) {
    return 'flexibility';
  }
  return 'strength';
}

/**
 * Infer difficulty from equipment and exercise name
 */
function inferDifficulty(exercise: ExerciseDBExercise): string {
  const equipment = exercise.equipments.map(e => e.toLowerCase());
  const name = exercise.name.toLowerCase();

  if (equipment.includes('barbell') || name.includes('olympic') || name.includes('snatch') || name.includes('clean and jerk')) {
    return 'advanced';
  }
  if (equipment.includes('body weight') || equipment.includes('resistance band')) {
    return 'beginner';
  }
  return 'intermediate';
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EXERCISEDB OPEN SOURCE INGESTION
// ============================================

/**
 * Fetch all exercises from ExerciseDB open-source API
 */
export async function fetchFromExerciseDB(options: IngestionOptions = {}): Promise<ExerciseDBExercise[]> {
  const { limit, offset = 0 } = options;
  const pageLimit = DEFAULT_PAGE_LIMIT;
  const allExercises: ExerciseDBExercise[] = [];
  let currentOffset = offset;
  let hasMore = true;

  logger.info('[ExerciseIngestion] Starting ExerciseDB fetch', { offset, limit });

  while (hasMore) {
    const fetchLimit = limit ? Math.min(pageLimit, limit - allExercises.length) : pageLimit;

    const response = await withRetry(
      async () => {
        const res = await axios.get<ExerciseDBResponse>(
          `${EXERCISEDB_BASE_URL}/exercises`,
          {
            params: { offset: currentOffset, limit: fetchLimit },
            timeout: 30000,
          }
        );
        return res.data;
      },
      {
        maxRetries: 5,
        initialDelay: 3000,
        onRetry: (error, attempt) => {
          logger.warn('[ExerciseIngestion] Retry fetching ExerciseDB', {
            attempt,
            offset: currentOffset,
            error: error.message,
          });
        },
      }
    );

    if (!response.success || !response.data || response.data.length === 0) {
      hasMore = false;
      break;
    }

    allExercises.push(...response.data);

    logger.debug('[ExerciseIngestion] Fetched page', {
      offset: currentOffset,
      count: response.data.length,
      totalSoFar: allExercises.length,
      totalAvailable: response.metadata.totalExercises,
    });

    currentOffset += fetchLimit;

    // Stop if we've fetched the requested limit
    if (limit && allExercises.length >= limit) {
      hasMore = false;
      break;
    }

    // Stop if there are no more pages
    if (!response.metadata.nextPage) {
      hasMore = false;
      break;
    }

    // Rate limiting
    await delay(RATE_LIMIT_DELAY_MS);
  }

  logger.info('[ExerciseIngestion] ExerciseDB fetch complete', {
    totalFetched: allExercises.length,
  });

  return allExercises;
}

/**
 * Transform an ExerciseDB exercise to internal format
 */
export function transformExerciseDB(raw: ExerciseDBExercise): TransformedExercise {
  const primaryMuscle = raw.targetMuscles[0] || 'other';
  const bodyPart = raw.bodyParts[0] || null;
  const category = inferCategory(raw);
  const difficulty = inferDifficulty(raw);

  // Clean instructions by removing "Step:N " prefix
  const instructions = raw.instructions.map(i =>
    i.replace(/^Step:\d+\s*/i, '').trim()
  );

  const mediaUrls: MediaUrl[] = [];
  if (raw.gifUrl) {
    mediaUrls.push({
      type: 'gif',
      url: raw.gifUrl,
      isPrimary: true,
    });
  }

  return {
    name: raw.name.charAt(0).toUpperCase() + raw.name.slice(1), // Capitalize first letter
    slug: `exercisedb-${slugify(raw.name)}-${raw.exerciseId.toLowerCase().slice(0, 7)}`,
    description: instructions[0] || null,
    category,
    primaryMuscleGroup: primaryMuscle.toLowerCase(),
    secondaryMuscleGroups: raw.secondaryMuscles.map(m => m.toLowerCase()),
    equipmentRequired: raw.equipments.map(e => e.toLowerCase()),
    difficultyLevel: difficulty,
    instructions,
    tips: [],
    bodyPart: bodyPart?.toLowerCase() || null,
    targetMuscles: raw.targetMuscles.map(m => m.toLowerCase()),
    tags: [
      category,
      ...(bodyPart ? [bodyPart.toLowerCase()] : []),
      ...raw.equipments.map(e => e.toLowerCase()),
    ],
    source: 'exercisedb',
    sourceId: raw.exerciseId,
    externalMetadata: {
      originalName: raw.name,
      originalEquipments: raw.equipments,
      originalBodyParts: raw.bodyParts,
    },
    mediaUrls,
    animationUrl: raw.gifUrl || null,
    thumbnailUrl: null,
  };
}

// ============================================
// RAPIDAPI EDB INGESTION (PHASE 2)
// ============================================

/**
 * Fetch exercises from RapidAPI EDB (AscendAPI)
 * Requires EXERCISEDB_RAPIDAPI_KEY env var
 */
export async function fetchFromRapidAPI(options: IngestionOptions = {}): Promise<RapidAPIExercise[]> {
  const apiKey = env.exercisedb.rapidApiKey;
  const apiHost = env.exercisedb.rapidApiHost;

  if (!apiKey) {
    throw new Error('EXERCISEDB_RAPIDAPI_KEY is not configured');
  }

  const { limit = 1000, offset = 0 } = options;
  const allExercises: RapidAPIExercise[] = [];
  let currentOffset = offset;
  const pageSize = 50; // RapidAPI typical page size
  let hasMore = true;

  logger.info('[ExerciseIngestion] Starting RapidAPI fetch', { offset, limit });

  while (hasMore) {
    const fetchLimit = Math.min(pageSize, limit - allExercises.length);

    const response = await withRetry(
      async () => {
        const res = await axios.get<RapidAPIExercise[]>(
          `https://${apiHost}/exercises`,
          {
            params: { offset: currentOffset, limit: fetchLimit },
            headers: {
              'X-RapidAPI-Key': apiKey,
              'X-RapidAPI-Host': apiHost,
            },
            timeout: 30000,
          }
        );
        return res.data;
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (error, attempt) => {
          logger.warn('[ExerciseIngestion] Retry fetching RapidAPI', {
            attempt,
            offset: currentOffset,
            error: error.message,
          });
        },
      }
    );

    if (!response || response.length === 0) {
      hasMore = false;
      break;
    }

    allExercises.push(...response);
    currentOffset += fetchLimit;

    if (allExercises.length >= limit) {
      hasMore = false;
      break;
    }

    // Stricter rate limiting for paid API
    await delay(RATE_LIMIT_DELAY_MS * 2);
  }

  logger.info('[ExerciseIngestion] RapidAPI fetch complete', {
    totalFetched: allExercises.length,
  });

  return allExercises;
}

/**
 * Transform a RapidAPI exercise to internal format
 */
export function transformRapidAPI(raw: RapidAPIExercise): TransformedExercise {
  const instructions = raw.instructions.map(i =>
    i.replace(/^Step:\d+\s*/i, '').trim()
  );

  const mediaUrls: MediaUrl[] = [];
  if (raw.gifUrl) {
    mediaUrls.push({
      type: 'gif',
      url: raw.gifUrl,
      isPrimary: true,
    });
  }

  return {
    name: raw.name.charAt(0).toUpperCase() + raw.name.slice(1),
    slug: `rapidapi-${slugify(raw.name)}-${raw.id.toLowerCase().slice(0, 7)}`,
    description: instructions[0] || null,
    category: 'strength',
    primaryMuscleGroup: raw.target.toLowerCase(),
    secondaryMuscleGroups: raw.secondaryMuscles.map(m => m.toLowerCase()),
    equipmentRequired: [raw.equipment.toLowerCase()],
    difficultyLevel: 'intermediate',
    instructions,
    tips: [],
    bodyPart: raw.bodyPart.toLowerCase(),
    targetMuscles: [raw.target.toLowerCase()],
    tags: [raw.bodyPart.toLowerCase(), raw.equipment.toLowerCase(), raw.target.toLowerCase()],
    source: 'rapidapi',
    sourceId: raw.id,
    externalMetadata: {
      originalName: raw.name,
      originalTarget: raw.target,
      originalEquipment: raw.equipment,
      originalBodyPart: raw.bodyPart,
    },
    mediaUrls,
    animationUrl: raw.gifUrl || null,
    thumbnailUrl: null,
  };
}

// ============================================
// MUSCLEWIKI RAPIDAPI INGESTION
// ============================================

const MUSCLEWIKI_RATE_LIMIT_MS = 300; // 300ms between requests to stay under rate limits

/** MuscleWiki difficulty → our difficulty mapping */
const MUSCLEWIKI_DIFFICULTY_MAP: Record<string, string> = {
  beginner: 'beginner',
  novice: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

/** MuscleWiki category (equipment) → our category mapping */
const MUSCLEWIKI_CATEGORY_MAP: Record<string, string> = {
  barbell: 'strength',
  dumbbells: 'strength',
  machine: 'strength',
  cables: 'strength',
  kettlebells: 'strength',
  band: 'strength',
  bodyweight: 'strength',
  'smith machine': 'strength',
  'ez bar': 'strength',
  vitruvian: 'strength',
  'plate loaded': 'strength',
  stretches: 'flexibility',
  cardio: 'cardio',
};

/**
 * Fetch the total exercise count from MuscleWiki API
 */
async function fetchMuscleWikiTotal(): Promise<number> {
  const apiKey = env.musclewiki.rapidApiKey;
  const apiHost = env.musclewiki.rapidApiHost;

  if (!apiKey) throw new Error('MUSCLEWIKI_RAPIDAPI_KEY is not configured');

  const res = await axios.get<MuscleWikiListResponse>(
    `https://${apiHost}/exercises`,
    {
      params: { limit: 1, offset: 0 },
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
      timeout: 15000,
    }
  );

  return res.data.total;
}

/**
 * Fetch a single exercise by ID from MuscleWiki API
 */
async function fetchMuscleWikiExercise(id: number): Promise<MuscleWikiExercise | null> {
  const apiKey = env.musclewiki.rapidApiKey;
  const apiHost = env.musclewiki.rapidApiHost;

  if (!apiKey) throw new Error('MUSCLEWIKI_RAPIDAPI_KEY is not configured');

  try {
    const res = await axios.get<MuscleWikiExercise>(
      `https://${apiHost}/exercises/${id}`,
      {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
        timeout: 15000,
      }
    );
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null; // Exercise doesn't exist at this ID
    }
    throw err;
  }
}

/**
 * Fetch all exercises from MuscleWiki by iterating through IDs
 * The list endpoint only returns id+name, so we fetch each individually
 */
export async function fetchFromMuscleWiki(options: IngestionOptions = {}): Promise<MuscleWikiExercise[]> {
  const { limit, offset = 0 } = options;

  logger.info('[ExerciseIngestion] Starting MuscleWiki fetch', { offset, limit });

  // Get total count
  const total = await fetchMuscleWikiTotal();
  const maxId = limit ? Math.min(offset + limit, total) : total;
  const allExercises: MuscleWikiExercise[] = [];
  let consecutiveNotFound = 0;

  for (let id = offset; id < maxId + 50; id++) { // +50 buffer for gaps in IDs
    if (limit && allExercises.length >= limit) break;
    if (consecutiveNotFound > 20) break; // Stop if 20 consecutive 404s

    try {
      const exercise = await withRetry(
        () => fetchMuscleWikiExercise(id),
        {
          maxRetries: 2,
          initialDelay: 1000,
          onRetry: (error, attempt) => {
            logger.warn('[ExerciseIngestion] Retry MuscleWiki fetch', { id, attempt, error: error.message });
          },
        }
      );

      if (exercise) {
        allExercises.push(exercise);
        consecutiveNotFound = 0;

        if (allExercises.length % 100 === 0) {
          logger.info('[ExerciseIngestion] MuscleWiki progress', {
            fetched: allExercises.length,
            currentId: id,
            target: limit || total,
          });
        }
      } else {
        consecutiveNotFound++;
      }
    } catch (err) {
      logger.warn('[ExerciseIngestion] Failed to fetch MuscleWiki exercise', {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
      consecutiveNotFound++;
    }

    // Rate limiting
    await delay(MUSCLEWIKI_RATE_LIMIT_MS);
  }

  logger.info('[ExerciseIngestion] MuscleWiki fetch complete', {
    totalFetched: allExercises.length,
  });

  return allExercises;
}

/**
 * Transform a MuscleWiki exercise to internal format
 */
export function transformMuscleWiki(raw: MuscleWikiExercise): TransformedExercise {
  const primaryMuscle = raw.primary_muscles?.[0] || 'other';
  const equipmentCategory = raw.category?.toLowerCase() || 'bodyweight';
  const category = MUSCLEWIKI_CATEGORY_MAP[equipmentCategory] || 'strength';
  const difficulty = MUSCLEWIKI_DIFFICULTY_MAP[raw.difficulty?.toLowerCase()] || 'intermediate';

  // Build media URLs from videos array
  const mediaUrls: MediaUrl[] = [];
  let primaryVideoUrl: string | null = null;
  let primaryThumbnailUrl: string | null = null;

  if (raw.videos && raw.videos.length > 0) {
    // Prefer male front view as primary
    const primaryVideo = raw.videos.find(v => v.gender === 'male' && v.angle === 'front')
      || raw.videos[0];

    primaryVideoUrl = primaryVideo.url;
    primaryThumbnailUrl = primaryVideo.og_image || null;

    for (const video of raw.videos) {
      // Add video
      mediaUrls.push({
        type: 'video',
        url: video.url,
        isPrimary: video === primaryVideo,
      });

      // Add thumbnail from og_image
      if (video.og_image) {
        mediaUrls.push({
          type: 'thumbnail',
          url: video.og_image,
          isPrimary: video === primaryVideo,
        });
      }
    }
  }

  // Build equipment array from category
  const equipmentRequired = equipmentCategory !== 'bodyweight'
    ? [raw.category.toLowerCase()]
    : ['body weight'];

  // Build tags
  const tags: string[] = [
    category,
    ...raw.primary_muscles.map(m => m.toLowerCase()),
    equipmentCategory,
  ];
  if (raw.mechanic) tags.push(raw.mechanic.toLowerCase());
  if (raw.force) tags.push(raw.force.toLowerCase());

  return {
    name: raw.name,
    slug: `musclewiki-${slugify(raw.name)}-${String(raw.id).padStart(4, '0')}`,
    description: raw.steps?.[0] || null,
    category,
    primaryMuscleGroup: primaryMuscle.toLowerCase(),
    secondaryMuscleGroups: [],
    equipmentRequired,
    difficultyLevel: difficulty,
    instructions: raw.steps || [],
    tips: [],
    bodyPart: null, // MuscleWiki doesn't provide body_part separately
    targetMuscles: raw.primary_muscles.map(m => m.toLowerCase()),
    tags,
    source: 'musclewiki',
    sourceId: String(raw.id),
    externalMetadata: {
      originalName: raw.name,
      originalCategory: raw.category,
      force: raw.force,
      grips: raw.grips,
      mechanic: raw.mechanic,
      originalDifficulty: raw.difficulty,
      videoCount: raw.videos?.length || 0,
    },
    mediaUrls,
    animationUrl: primaryVideoUrl, // Use video URL as animation for frontend
    thumbnailUrl: primaryThumbnailUrl,
  };
}

/**
 * Full ingestion from MuscleWiki RapidAPI
 */
export async function ingestFromMuscleWiki(
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const startTime = Date.now();
  const { dryRun = false } = options;

  logger.info('[ExerciseIngestion] Starting MuscleWiki ingestion', { dryRun });

  try {
    const rawExercises = await fetchFromMuscleWiki(options);
    const transformed = rawExercises.map(transformMuscleWiki);
    const result = await batchUpsert(transformed, { dryRun });

    if (!dryRun && result.inserted > 0) {
      await populateLookupTables();
    }

    if (!dryRun) {
      invalidateExerciseCache();
    }

    const ingestionResult: IngestionResult = {
      source: 'musclewiki',
      totalFetched: rawExercises.length,
      inserted: result.inserted,
      updated: result.updated,
      skipped: 0,
      failed: result.failed,
      errors: result.errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('[ExerciseIngestion] MuscleWiki ingestion complete', { ...ingestionResult });
    return ingestionResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[ExerciseIngestion] MuscleWiki ingestion failed', { error: errorMessage });

    return {
      source: 'musclewiki',
      totalFetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [{ exerciseId: 'N/A', exerciseName: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Batch upsert transformed exercises into the database
 * Uses ON CONFLICT (source, source_id) DO UPDATE for idempotency
 */
export async function batchUpsert(
  exercises: TransformedExercise[],
  options: { dryRun?: boolean } = {}
): Promise<{ inserted: number; updated: number; failed: number; errors: IngestionError[] }> {
  if (options.dryRun) {
    logger.info('[ExerciseIngestion] Dry run - would upsert exercises', { count: exercises.length });
    return { inserted: exercises.length, updated: 0, failed: 0, errors: [] };
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const errors: IngestionError[] = [];

  // Process in batches
  for (let i = 0; i < exercises.length; i += DEFAULT_BATCH_SIZE) {
    const batch = exercises.slice(i, i + DEFAULT_BATCH_SIZE);

    try {
      await transaction(async (client: PoolClient) => {
        for (let j = 0; j < batch.length; j++) {
          const exercise = batch[j];
          const spName = `sp_${j}`;
          try {
            await client.query(`SAVEPOINT ${spName}`);

            const result = await client.query(
              `INSERT INTO exercises (
                name, slug, description, category,
                primary_muscle_group, secondary_muscle_groups, equipment_required,
                difficulty_level, instructions, tips,
                body_part, target_muscles, tags,
                source, source_id, external_metadata,
                animation_url, thumbnail_url,
                is_system, is_active, version
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16,
                $17, $18,
                true, true, 1
              )
              ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
              DO UPDATE SET
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                primary_muscle_group = EXCLUDED.primary_muscle_group,
                secondary_muscle_groups = EXCLUDED.secondary_muscle_groups,
                equipment_required = EXCLUDED.equipment_required,
                difficulty_level = EXCLUDED.difficulty_level,
                instructions = EXCLUDED.instructions,
                tips = EXCLUDED.tips,
                body_part = EXCLUDED.body_part,
                target_muscles = EXCLUDED.target_muscles,
                tags = EXCLUDED.tags,
                external_metadata = EXCLUDED.external_metadata,
                animation_url = EXCLUDED.animation_url,
                thumbnail_url = EXCLUDED.thumbnail_url,
                version = exercises.version + 1,
                updated_at = CURRENT_TIMESTAMP
              RETURNING id, (xmax = 0) AS is_insert`,
              [
                exercise.name,
                exercise.slug,
                exercise.description,
                exercise.category,
                exercise.primaryMuscleGroup,
                exercise.secondaryMuscleGroups,
                exercise.equipmentRequired,
                exercise.difficultyLevel,
                JSON.stringify(exercise.instructions),
                JSON.stringify(exercise.tips),
                exercise.bodyPart,
                exercise.targetMuscles,
                exercise.tags,
                exercise.source,
                exercise.sourceId,
                JSON.stringify(exercise.externalMetadata),
                exercise.animationUrl,
                exercise.thumbnailUrl,
              ]
            );

            const row = result.rows[0];
            if (row.is_insert) {
              inserted++;
            } else {
              updated++;
            }

            // Insert media if present
            if (exercise.mediaUrls.length > 0) {
              await insertMedia(client, row.id, exercise.mediaUrls, exercise.source);
            }

            await client.query(`RELEASE SAVEPOINT ${spName}`);
          } catch (err) {
            // Rollback just this exercise, not the entire batch
            await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
            failed++;
            errors.push({
              exerciseId: exercise.sourceId,
              exerciseName: exercise.name,
              error: err instanceof Error ? err.message : String(err),
            });
            logger.warn('[ExerciseIngestion] Failed to upsert exercise', {
              name: exercise.name,
              sourceId: exercise.sourceId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    } catch (err) {
      // Transaction-level failure — count remaining batch items as failed
      const remaining = batch.length - errors.filter(e =>
        batch.some(b => b.sourceId === e.exerciseId)
      ).length;
      failed += remaining;
      logger.error('[ExerciseIngestion] Batch transaction failed', {
        batchStart: i,
        batchSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.debug('[ExerciseIngestion] Batch progress', {
      processed: Math.min(i + DEFAULT_BATCH_SIZE, exercises.length),
      total: exercises.length,
      inserted,
      updated,
      failed,
    });
  }

  return { inserted, updated, failed, errors };
}

/**
 * Insert media records for an exercise
 */
async function insertMedia(
  client: PoolClient,
  exerciseId: string,
  mediaUrls: MediaUrl[],
  source: string
): Promise<void> {
  for (const media of mediaUrls) {
    await client.query(
      `INSERT INTO exercise_media (exercise_id, type, url, is_primary, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [exerciseId, media.type, media.url, media.isPrimary, source]
    );
  }
}

/**
 * Populate lookup tables from exercise data
 */
export async function populateLookupTables(): Promise<{
  muscles: number;
  equipment: number;
  bodyParts: number;
}> {
  logger.info('[ExerciseIngestion] Populating lookup tables');

  // Extract unique muscles
  const musclesResult = await query(`
    SELECT DISTINCT unnest(
      ARRAY[primary_muscle_group] ||
      secondary_muscle_groups ||
      target_muscles
    ) AS name
    FROM exercises
    WHERE deleted_at IS NULL
    ORDER BY name
  `);

  let musclesInserted = 0;
  for (const row of musclesResult.rows) {
    if (!row.name || row.name.trim() === '') continue;
    const name = row.name.toLowerCase().trim();
    const slug = slugify(name);
    const bodyRegion = BODY_REGION_MAP[name] || 'other';

    try {
      await query(
        `INSERT INTO muscles (name, slug, body_region, display_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [name, slug, bodyRegion, musclesInserted]
      );
      musclesInserted++;
    } catch {
      // Ignore duplicate errors
    }
  }

  // Extract unique equipment
  const equipmentResult = await query(`
    SELECT DISTINCT unnest(equipment_required) AS name
    FROM exercises
    WHERE deleted_at IS NULL
    ORDER BY name
  `);

  let equipmentInserted = 0;
  for (const row of equipmentResult.rows) {
    if (!row.name || row.name.trim() === '') continue;
    const name = row.name.toLowerCase().trim();
    const slug = slugify(name);

    try {
      await query(
        `INSERT INTO equipment (name, slug, display_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [name, slug, equipmentInserted]
      );
      equipmentInserted++;
    } catch {
      // Ignore duplicate errors
    }
  }

  // Extract unique body parts
  const bodyPartsResult = await query(`
    SELECT DISTINCT body_part AS name
    FROM exercises
    WHERE body_part IS NOT NULL AND deleted_at IS NULL
    ORDER BY name
  `);

  let bodyPartsInserted = 0;
  for (const row of bodyPartsResult.rows) {
    if (!row.name || row.name.trim() === '') continue;
    const name = row.name.toLowerCase().trim();
    const slug = slugify(name);

    try {
      await query(
        `INSERT INTO body_parts (name, slug, display_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [name, slug, bodyPartsInserted]
      );
      bodyPartsInserted++;
    } catch {
      // Ignore duplicate errors
    }
  }

  logger.info('[ExerciseIngestion] Lookup tables populated', {
    muscles: musclesInserted,
    equipment: equipmentInserted,
    bodyParts: bodyPartsInserted,
  });

  return { muscles: musclesInserted, equipment: equipmentInserted, bodyParts: bodyPartsInserted };
}

// ============================================
// MAIN INGESTION ORCHESTRATORS
// ============================================

/**
 * Full ingestion from ExerciseDB open-source API
 */
export async function ingestFromExerciseDB(
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const startTime = Date.now();
  const { dryRun = false } = options;

  logger.info('[ExerciseIngestion] Starting ExerciseDB ingestion', { dryRun });

  try {
    // Fetch
    const rawExercises = await fetchFromExerciseDB(options);

    // Transform
    const transformed = rawExercises.map(transformExerciseDB);

    // Upsert
    const result = await batchUpsert(transformed, { dryRun });

    // Populate lookup tables
    if (!dryRun && result.inserted > 0) {
      await populateLookupTables();
    }

    // Invalidate exercise cache
    if (!dryRun) {
      invalidateExerciseCache();
    }

    const ingestionResult: IngestionResult = {
      source: 'exercisedb',
      totalFetched: rawExercises.length,
      inserted: result.inserted,
      updated: result.updated,
      skipped: 0,
      failed: result.failed,
      errors: result.errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('[ExerciseIngestion] ExerciseDB ingestion complete', { ...ingestionResult });
    return ingestionResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[ExerciseIngestion] ExerciseDB ingestion failed', { error: errorMessage });

    return {
      source: 'exercisedb',
      totalFetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [{ exerciseId: 'N/A', exerciseName: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Full ingestion from RapidAPI EDB
 */
export async function ingestFromRapidAPI(
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const startTime = Date.now();
  const { dryRun = false } = options;

  logger.info('[ExerciseIngestion] Starting RapidAPI ingestion', { dryRun });

  try {
    const rawExercises = await fetchFromRapidAPI(options);
    const transformed = rawExercises.map(transformRapidAPI);
    const result = await batchUpsert(transformed, { dryRun });

    if (!dryRun && result.inserted > 0) {
      await populateLookupTables();
    }

    if (!dryRun) {
      invalidateExerciseCache();
    }

    const ingestionResult: IngestionResult = {
      source: 'rapidapi',
      totalFetched: rawExercises.length,
      inserted: result.inserted,
      updated: result.updated,
      skipped: 0,
      failed: result.failed,
      errors: result.errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('[ExerciseIngestion] RapidAPI ingestion complete', { ...ingestionResult });
    return ingestionResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[ExerciseIngestion] RapidAPI ingestion failed', { error: errorMessage });

    return {
      source: 'rapidapi',
      totalFetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [{ exerciseId: 'N/A', exerciseName: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Invalidate all exercise-related cache entries
 */
export function invalidateExerciseCache(): void {
  const deleted = cache.deleteByPattern(/^exercises:/);
  logger.info('[ExerciseIngestion] Exercise cache invalidated', { keysDeleted: deleted });
}

// ============================================
// EXPORTS
// ============================================

export const exerciseIngestionService = {
  fetchFromExerciseDB,
  fetchFromRapidAPI,
  fetchFromMuscleWiki,
  transformExerciseDB,
  transformRapidAPI,
  transformMuscleWiki,
  batchUpsert,
  populateLookupTables,
  ingestFromExerciseDB,
  ingestFromRapidAPI,
  ingestFromMuscleWiki,
  invalidateExerciseCache,
};

export default exerciseIngestionService;
