import { Worker, Job, UnrecoverableError } from 'bullmq';
import { redisConnection, QueueNames } from '../config/queue.config.js';
import { vectorEmbeddingService, EmbeddingAuthError } from '../services/vector-embedding.service.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import type { EmbeddingJobData } from '../services/embedding-queue.service.js';

// ============================================================================
// Job Processor
// ============================================================================

async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  try {
    await processEmbeddingJobInner(job);
  } catch (error) {
    if (error instanceof EmbeddingAuthError) {
      // Auth failure — skip BullMQ retries entirely (they'll never succeed)
      logger.warn('[EmbeddingWorker] Skipping job due to auth error (unrecoverable)', {
        jobId: job.id,
        error: (error as Error).message,
      });
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }
}

async function processEmbeddingJobInner(job: Job<EmbeddingJobData>): Promise<void> {
  const { userId, sourceType, sourceId, operation } = job.data;

  logger.debug('[EmbeddingWorker] Processing job', {
    jobId: job.id,
    sourceType,
    sourceId,
    operation,
  });

  // Skip wellbeing source types - they are handled by the wellbeing embedding worker
  if (sourceType === 'wellbeing') {
    logger.debug('[EmbeddingWorker] Skipping wellbeing embedding - handled by wellbeing worker', {
      jobId: job.id,
      sourceId,
    });
    return;
  }

  // Handle delete operation
  if (operation === 'delete') {
    await handleDeleteEmbedding(userId, sourceType, sourceId);
    return;
  }

  // Handle rag_message — backfill embedding for an existing message row
  if (sourceType === 'rag_message') {
    const msgResult = await query<{ content: string }>(
      `SELECT content FROM rag_messages WHERE id = $1`,
      [sourceId]
    );
    if (msgResult.rows.length === 0) {
      logger.debug('[EmbeddingWorker] rag_message not found, skipping', { sourceId });
      return;
    }
    const msgContent = msgResult.rows[0].content;
    // Skip trivial messages (short replies like "ok", "yes", "thanks")
    if (msgContent.length < 20) {
      logger.debug('[EmbeddingWorker] Skipping embedding for short message', { sourceId, length: msgContent.length });
      return;
    }
    await vectorEmbeddingService.updateMessageEmbedding(sourceId, msgContent);
    logger.info('[EmbeddingWorker] Message embedding backfilled', { sourceId });
    return;
  }

  // Fetch record content
  const content = await fetchRecordContent(sourceType, sourceId);

  if (!content) {
    throw new Error(`Record not found: ${sourceType}/${sourceId}`);
  }

  // Handle create/update operations
  if (sourceType === 'user_preferences' || sourceType === 'user_profile') {
    // User preferences and profile go to user_health_embeddings table (versioned)
    const section = sourceType === 'user_preferences' ? 'preferences' : 'profile';
    await vectorEmbeddingService.storeUserHealthProfile({
      userId,
      section,
      content,
      metadata: { source_id: sourceId, embedded_at: new Date().toISOString() },
    });
  } else {
    // All other types go to vector_embeddings table
    // For updates, delete old embedding first
    if (operation === 'update') {
      await query(
        `DELETE FROM vector_embeddings WHERE source_type = $1 AND source_id = $2`,
        [sourceType, sourceId]
      );
    }

    // Store new embedding
    await vectorEmbeddingService.storeEmbedding({
      sourceType,
      sourceId,
      userId,
      content,
      contentType: getContentType(sourceType),
      metadata: { embedded_at: new Date().toISOString() },
    });
  }

  logger.info('[EmbeddingWorker] Embedding processed successfully', {
    sourceType,
    sourceId,
    operation,
  });
}

// ============================================================================
// Content Fetchers
// ============================================================================

async function fetchRecordContent(sourceType: string, sourceId: string): Promise<string | null> {
  let result;

  switch (sourceType) {
    case 'user_goal': {
      result = await query(`SELECT * FROM user_goals WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const goal = result.rows[0];
      return `
Goal: ${goal.title}
Description: ${goal.description}
Category: ${goal.category}
Pillar: ${goal.pillar}
Target: ${goal.target_value} ${goal.target_unit}
Motivation: ${goal.motivation}
Timeline: ${goal.start_date} to ${goal.target_date} (${goal.duration_weeks} weeks)
Status: ${goal.status}
Confidence: ${goal.confidence_level}/10
      `.trim();
    }

    case 'user_plan': {
      result = await query(`SELECT * FROM user_plans WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const plan = result.rows[0];
      return `
Plan: ${plan.name}
Description: ${plan.description}
Goal Category: ${plan.goal_category}
Pillar: ${plan.pillar}
Duration: ${plan.duration_weeks} weeks (Week ${plan.current_week})
Status: ${plan.status}
Activities: ${JSON.stringify(plan.activities || []).substring(0, 500)}
Weekly Focuses: ${JSON.stringify(plan.weekly_focuses || []).substring(0, 300)}
Progress: ${plan.overall_progress}%
      `.trim();
    }

    case 'diet_plan': {
      result = await query(`SELECT * FROM diet_plans WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const plan = result.rows[0];
      return `
Diet Plan: ${plan.name}
Description: ${plan.description || 'N/A'}
Goal: ${plan.goal_category}
Daily Calories: ${plan.daily_calories || 0} kcal
Macros: Protein ${plan.protein_grams || 0}g, Carbs ${plan.carbs_grams || 0}g, Fat ${plan.fat_grams || 0}g
Dietary Preferences: ${JSON.stringify(plan.dietary_preferences || [])}
Allergies: ${JSON.stringify(plan.allergies || [])}
Meal Structure: ${plan.meals_per_day || 3} meals + ${plan.snacks_per_day || 2} snacks
Status: ${plan.status}
      `.trim();
    }

    case 'workout_plan': {
      result = await query(`SELECT * FROM workout_plans WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const plan = result.rows[0];
      return `
Workout Plan: ${plan.name}
Description: ${plan.description || 'N/A'}
Goal: ${plan.goal_category}
Difficulty: ${plan.initial_difficulty_level} (multiplier: ${plan.current_difficulty_multiplier})
Schedule: ${plan.workouts_per_week} workouts/week for ${plan.duration_weeks} weeks
Equipment: ${(plan.available_equipment || []).join(', ') || 'None'}
Location: ${plan.workout_location}
Progress: ${plan.total_workouts_completed || 0} workouts completed (${(plan.overall_completion_rate || 0) * 100}% rate)
Status: ${plan.status}
      `.trim();
    }

    case 'user_task': {
      result = await query(`SELECT * FROM user_tasks WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const task = result.rows[0];
      return `
Task: ${task.title}
Description: ${task.description || 'N/A'}
Category: ${task.category}
Priority: ${task.priority}
Scheduled: ${task.scheduled_at}
Status: ${task.status}
Tags: ${(task.tags || []).join(', ') || 'None'}
      `.trim();
    }

    case 'meal_log': {
      result = await query(`SELECT * FROM meal_logs WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const log = result.rows[0];
      return `
Meal Log: ${log.meal_type} - ${log.meal_name || 'Unnamed'}
Description: ${log.description || 'N/A'}
Eaten At: ${log.eaten_at}
Nutrition: ${log.calories || 0} kcal, Protein ${log.protein_grams || 0}g, Carbs ${log.carbs_grams || 0}g, Fat ${log.fat_grams || 0}g
Foods: ${JSON.stringify(log.foods || [])}
Notes: ${log.notes || 'N/A'}
Satisfaction: ${log.satisfaction_after || 0}/5
      `.trim();
    }

    case 'workout_log': {
      result = await query(`SELECT * FROM workout_logs WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const log = result.rows[0];
      return `
Workout Log: ${log.workout_name || 'Unnamed'}
Date: ${log.scheduled_date}
Status: ${log.status}
Duration: ${log.duration_minutes || 0} minutes
Performance: ${log.total_sets || 0} sets, ${log.total_reps || 0} reps, ${log.total_volume || 0} total volume
Difficulty: ${log.difficulty_rating || 0}/5
Energy: ${log.energy_level || 0}/5
Mood After: ${log.mood_after || 0}/5
Notes: ${log.notes || 'N/A'}
      `.trim();
    }

    case 'progress_record': {
      result = await query(`SELECT * FROM progress_records WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const record = result.rows[0];
      return `
Progress Record: ${record.record_type}
Date: ${record.record_date}
Value: ${JSON.stringify(record.value)}
Source: ${record.source}
Notes: ${record.notes || 'N/A'}
      `.trim();
    }

    case 'user_preferences': {
      result = await query(`SELECT * FROM user_preferences WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const prefs = result.rows[0];
      return `
User Preferences:
Coaching Style: ${prefs.coaching_style || 'Not set'}
Coaching Intensity: ${prefs.coaching_intensity || 'Not set'}
Check-in Frequency: ${prefs.check_in_frequency || 'Not set'}
Preferred Check-in Time: ${prefs.preferred_check_in_time || 'Not set'}
Focus Areas: ${(prefs.focus_areas || []).join(', ') || 'None'}
Weight Unit: ${prefs.weight_unit || 'Not set'}
Language: ${prefs.language || 'en'}
Notification Channels: ${JSON.stringify(prefs.notification_channels || {})}
Timezone: ${prefs.timezone || 'UTC'}
      `.trim();
    }

    case 'user_profile': {
      // Fetch comprehensive user profile data
      const userResult = await query(
        `SELECT u.*, up.* FROM users u 
         LEFT JOIN user_preferences up ON u.id = up.user_id 
         WHERE u.id = $1`,
        [sourceId]
      );
      if (userResult.rows.length === 0) return null;
      const user = userResult.rows[0];
      
      // Fetch user goals
      const goalsResult = await query(
        `SELECT title, category, pillar, status FROM user_goals WHERE user_id = $1 AND status != 'completed'`,
        [sourceId]
      );
      const activeGoals = goalsResult.rows.map(g => `${g.title} (${g.category})`).join(', ') || 'None';
      
      return `
User Profile:
Name: ${user.first_name || ''} ${user.last_name || ''}
Email: ${user.email || ''}
Date of Birth: ${user.date_of_birth || 'Not set'}
Gender: ${user.gender || 'Not set'}
Height: ${user.height || 'Not set'} ${user.height_unit || 'cm'}
Weight: ${user.weight || 'Not set'} ${user.weight_unit || 'kg'}
Activity Level: ${user.activity_level || 'Not set'}
Health Conditions: ${(user.health_conditions || []).join(', ') || 'None'}
Medications: ${(user.medications || []).join(', ') || 'None'}
Allergies: ${(user.allergies || []).join(', ') || 'None'}
Active Goals: ${activeGoals}
Coaching Style: ${user.coaching_style || 'Not set'}
Focus Areas: ${(user.focus_areas || []).join(', ') || 'None'}
      `.trim();
    }

    case 'activity_log': {
      result = await query(`SELECT * FROM activity_logs WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const log = result.rows[0];
      return `
Activity Log: ${log.activity_name || 'Unnamed'}
Date: ${log.scheduled_date}
Status: ${log.status}
Completed At: ${log.completed_at || 'Not completed'}
Duration: ${log.duration_minutes || 0} minutes
Notes: ${log.notes || 'N/A'}
      `.trim();
    }

    case 'schedule': {
      // Fetch daily schedule with items and links
      result = await query(`SELECT * FROM daily_schedules WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const schedule = result.rows[0];
      
      // Fetch schedule items
      const itemsResult = await query(
        `SELECT * FROM schedule_items WHERE schedule_id = $1 ORDER BY position ASC, start_time ASC`,
        [sourceId]
      );
      
      // Fetch schedule links
      const linksResult = await query(
        `SELECT * FROM schedule_links WHERE schedule_id = $1`,
        [sourceId]
      );
      
      const items = itemsResult.rows.map((item: any) => {
        let itemText = `${item.title}`;
        if (item.start_time) itemText += ` at ${item.start_time}`;
        if (item.end_time) itemText += ` - ${item.end_time}`;
        if (item.description) itemText += `: ${item.description}`;
        if (item.category) itemText += ` [${item.category}]`;
        return itemText;
      }).join('\n');
      
      const links = linksResult.rows.map((link: any) => {
        return `Link: ${link.link_type} (delay: ${link.delay_minutes || 0} min)`;
      }).join('\n');
      
      return `
Daily Schedule: ${schedule.name || 'Unnamed Schedule'}
Date: ${schedule.schedule_date}
Notes: ${schedule.notes || 'N/A'}
Items:
${items || 'No items'}
${links ? `\nLinks:\n${links}` : ''}
      `.trim();
    }

    case 'schedule_item': {
      result = await query(`SELECT * FROM schedule_items WHERE id = $1`, [sourceId]);
      if (result.rows.length === 0) return null;
      const item = result.rows[0];
      return `
Schedule Item: ${item.title}
Description: ${item.description || 'N/A'}
Time: ${item.start_time || 'N/A'}${item.end_time ? ` - ${item.end_time}` : ''}
Duration: ${item.duration_minutes || 0} minutes
Category: ${item.category || 'N/A'}
Position: ${item.position}
      `.trim();
    }

    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

// ============================================================================
// Delete Handler
// ============================================================================

async function handleDeleteEmbedding(
  userId: string,
  sourceType: string,
  sourceId: string
): Promise<void> {
  if (sourceType === 'user_preferences' || sourceType === 'user_profile') {
    // Delete from user_health_embeddings
    const section = sourceType === 'user_preferences' ? 'preferences' : 'profile';
    await query(
      `DELETE FROM user_health_embeddings WHERE user_id = $1 AND section = $2`,
      [userId, section]
    );
  } else {
    // Delete from vector_embeddings
    await query(
      `DELETE FROM vector_embeddings WHERE source_type = $1 AND source_id = $2 AND user_id = $3`,
      [sourceType, sourceId, userId]
    );
  }

  logger.info('[EmbeddingWorker] Deleted embedding', { sourceType, sourceId, userId });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getContentType(sourceType: string): string {
  const typeMap: Record<string, string> = {
    user_goal: 'goal',
    user_plan: 'plan',
    diet_plan: 'nutrition_plan',
    workout_plan: 'fitness_plan',
    user_task: 'task',
    schedule: 'schedule',
    schedule_item: 'schedule_item',
    meal_log: 'nutrition_history',
    workout_log: 'fitness_history',
    progress_record: 'progress_tracking',
    activity_log: 'activity_history',
  };
  return typeMap[sourceType] || 'document';
}

// ============================================================================
// Worker Instance
// ============================================================================

export const embeddingWorker = new Worker(QueueNames.EMBEDDING_SYNC, processEmbeddingJob, {
  connection: redisConnection,
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // per second (rate limiting)
  },
});

// ============================================================================
// Event Listeners
// ============================================================================

embeddingWorker.on('completed', (job) => {
  logger.info('[EmbeddingWorker] Job completed', { jobId: job.id, name: job.name });
});

embeddingWorker.on('failed', (job, err) => {
  logger.error('[EmbeddingWorker] Job failed', {
    jobId: job?.id,
    name: job?.name,
    error: err.message,
    stack: err.stack,
  });
});

embeddingWorker.on('error', (err) => {
  logger.error('[EmbeddingWorker] Worker error', {
    error: err.message,
    stack: err.stack,
  });
});

embeddingWorker.on('ready', () => {
  logger.info('[EmbeddingWorker] Worker ready and waiting for jobs');
});

logger.info('[EmbeddingWorker] Embedding worker started', {
  queueName: QueueNames.EMBEDDING_SYNC,
  concurrency: 5,
  rateLimit: '10 jobs/second',
});
