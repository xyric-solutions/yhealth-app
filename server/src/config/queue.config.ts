import { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import { env } from './env.config.js';

// ============================================================================
// Redis Connection Configuration for BullMQ
// ============================================================================

function buildRedisConnection(): ConnectionOptions {
  // Prefer REDIS_URL (parses host/port/password from URL)
  if (env.redis.url) {
    const parsed = new URL(env.redis.url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username && parsed.username !== 'default' ? parsed.username : undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Required for BullMQ
    };
  }
  return {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false, // Required for BullMQ
  };
}

export const redisConnection: ConnectionOptions = buildRedisConnection();

// ============================================================================
// Queue Configuration
// ============================================================================

export const queueConfig = {
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // Start with 2s delay, then 4s, 8s
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days (for debugging)
      count: 5000, // Keep max 5000 failed jobs
    },
  } as DefaultJobOptions,
};

// ============================================================================
// Queue Names
// ============================================================================

export const QueueNames = {
  EMBEDDING_SYNC: 'embedding-sync',
  EMBEDDING_MIGRATION: 'embedding-migration',
  ACTIVITY_EVENT_PROCESSING: 'activity-event-processing',
  EXERCISE_INGESTION: 'exercise-ingestion',
  EMAIL: 'email-delivery',
  STREAK_EVENTS: 'streak-events',
} as const;

// ============================================================================
// Job Types
// ============================================================================

export const JobTypes = {
  EMBED_USER_GOAL: 'embed-user-goal',
  EMBED_USER_PLAN: 'embed-user-plan',
  EMBED_DIET_PLAN: 'embed-diet-plan',
  EMBED_WORKOUT_PLAN: 'embed-workout-plan',
  EMBED_USER_TASK: 'embed-user-task',
  EMBED_MEAL_LOG: 'embed-meal-log',
  EMBED_WORKOUT_LOG: 'embed-workout-log',
  EMBED_PROGRESS_RECORD: 'embed-progress-record',
  EMBED_USER_PREFERENCES: 'embed-user-preferences',
  EMBED_BATCH_MIGRATION: 'embed-batch-migration',
  INGEST_EXERCISE_BATCH: 'ingest-exercise-batch',
  SYNC_EXERCISES: 'sync-exercises',
  // Email engine
  SEND_EMAIL: 'send-email',
  SEND_DIGEST: 'send-digest',
  SEND_AI_EMAIL: 'send-ai-email',
  // Streak engine
  STREAK_ACTIVITY: 'streak-activity',
  STREAK_MILESTONE: 'streak-milestone',
} as const;

// ============================================================================
// Job Priorities
// ============================================================================

export const JobPriorities = {
  CRITICAL: 5, // Goals, Plans
  HIGH: 4, // Tasks, Activity Events
  MEDIUM: 3, // Logs
  LOW: 2, // Preferences
  BACKGROUND: 1, // Batch migrations
} as const;
