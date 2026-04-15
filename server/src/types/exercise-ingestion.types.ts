/**
 * @file Exercise Ingestion Types
 * TypeScript interfaces for external exercise API responses,
 * internal transformation, and query types.
 */

// ============================================
// EXERCISEDB OPEN SOURCE API TYPES
// ============================================

/** ExerciseDB API response wrapper */
export interface ExerciseDBResponse {
  success: boolean;
  metadata: {
    totalPages: number;
    totalExercises: number;
    currentPage: number;
    previousPage: string | null;
    nextPage: string | null;
  };
  data: ExerciseDBExercise[];
}

/** Single exercise from ExerciseDB API */
export interface ExerciseDBExercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

// ============================================
// RAPIDAPI EDB (ASCENDAPI) TYPES
// ============================================

/** RapidAPI exercise response shape */
export interface RapidAPIExercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  secondaryMuscles: string[];
  instructions: string[];
}

/** RapidAPI list response */
export interface RapidAPIResponse {
  exercises: RapidAPIExercise[];
  total: number;
  offset: number;
  limit: number;
}

// ============================================
// MUSCLEWIKI RAPIDAPI TYPES
// ============================================

/** MuscleWiki video object */
export interface MuscleWikiVideo {
  url: string;
  angle: string;    // 'front' | 'side'
  gender: string;   // 'male' | 'female'
  og_image: string;  // thumbnail JPG
}

/** MuscleWiki exercise from API */
export interface MuscleWikiExercise {
  id: number;
  name: string;
  primary_muscles: string[];
  category: string;           // Equipment type: 'Barbell', 'Dumbbells', 'Machine', etc.
  force: string;              // 'Push' | 'Pull'
  grips: string[];            // 'Overhand', 'Underhand', etc.
  mechanic: string;           // 'Compound' | 'Isolation'
  difficulty: string;         // 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced'
  steps: string[];
  videos: MuscleWikiVideo[];
}

/** MuscleWiki paginated list response */
export interface MuscleWikiListResponse {
  total: number;
  limit: number;
  offset: number;
  count: number;
  results: { id: number; name: string }[];
}

// ============================================
// INTERNAL / TRANSFORMED TYPES
// ============================================

/** Normalized exercise ready for database insertion */
export interface TransformedExercise {
  name: string;
  slug: string;
  description: string | null;
  category: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipmentRequired: string[];
  difficultyLevel: string;
  instructions: string[];
  tips: string[];
  bodyPart: string | null;
  targetMuscles: string[];
  tags: string[];
  source: 'exercisedb' | 'rapidapi' | 'musclewiki' | 'manual';
  sourceId: string;
  externalMetadata: Record<string, unknown>;
  mediaUrls: MediaUrl[];
  animationUrl: string | null;
  thumbnailUrl: string | null;
}

/** Media URL extracted from external exercise */
export interface MediaUrl {
  type: 'image' | 'gif' | 'video' | 'animation' | 'thumbnail';
  url: string;
  isPrimary: boolean;
}

/** Result of an ingestion run */
export interface IngestionResult {
  source: string;
  totalFetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: IngestionError[];
  durationMs: number;
}

/** Individual ingestion error */
export interface IngestionError {
  exerciseId: string;
  exerciseName: string;
  error: string;
}

/** Options for ingestion */
export interface IngestionOptions {
  batchSize?: number;
  dryRun?: boolean;
  offset?: number;
  limit?: number;
}

// ============================================
// EXERCISE QUERY TYPES
// ============================================

/** Filters for exercise list queries */
export interface ExerciseFilters {
  category?: string;
  muscle?: string;
  equipment?: string;
  difficulty?: string;
  bodyPart?: string;
  source?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Pagination params (offset-based) */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Cursor-based pagination params */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

/** Decoded cursor */
export interface DecodedCursor {
  id: string;
  sortValue: string | number;
}

/** Paginated result (offset-based) */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Cursor-paginated result */
export interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    total?: number;
  };
}

/** Exercise from database (list view) */
export interface ExerciseRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  primary_muscle_group: string | null;
  secondary_muscle_groups: string[];
  equipment_required: string[];
  difficulty_level: string;
  instructions: unknown;
  tips: unknown;
  common_mistakes: unknown;
  video_url: string | null;
  thumbnail_url: string | null;
  animation_url: string | null;
  default_sets: number;
  default_reps: number;
  default_duration_seconds: number | null;
  default_rest_seconds: number;
  is_system: boolean;
  is_active: boolean;
  calories_per_minute: number | null;
  met_value: number | null;
  tags: string[];
  source: string;
  source_id: string | null;
  body_part: string | null;
  target_muscles: string[];
  version: number;
  external_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Exercise detail (with media) */
export interface ExerciseDetail extends ExerciseRow {
  media: ExerciseMediaRow[];
}

/** Media row from database */
export interface ExerciseMediaRow {
  id: string;
  exercise_id: string;
  type: string;
  url: string;
  r2_key: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  is_primary: boolean;
  source: string | null;
}

/** Available filter options (for dropdowns) */
export interface ExerciseFilterOptions {
  categories: string[];
  muscles: string[];
  equipment: string[];
  difficulties: string[];
  bodyParts: string[];
  sources: string[];
}

/** Exercise stats by grouping */
export interface ExerciseStats {
  totalExercises: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byDifficulty: Record<string, number>;
}
