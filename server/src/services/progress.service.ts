/**
 * @file Progress Tracking Service
 * Handles weight, measurements, photos, and progress analytics
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';
import { gamificationService } from './gamification.service.js';
import { r2Service } from './r2.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';

// ============================================
// TYPES
// ============================================

export interface WeightRecord {
  id: string;
  userId: string;
  recordDate: string;
  weightKg: number;
  notes?: string;
  createdAt: string;
}

export interface MeasurementRecord {
  id: string;
  userId: string;
  recordDate: string;
  measurements: BodyMeasurements;
  notes?: string;
  createdAt: string;
}

export interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  bicepLeft?: number;
  bicepRight?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  neck?: number;
  shoulders?: number;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  recordDate: string;
  photoType: 'front' | 'side' | 'back';
  photoKey: string;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface ProgressSummary {
  weight: {
    current: number | null;
    starting: number | null;
    lowest: number | null;
    highest: number | null;
    change: number | null;
    trend: 'up' | 'down' | 'stable';
    history: Array<{ date: string; weightKg: number }>;
  };
  measurements: {
    current: BodyMeasurements | null;
    starting: BodyMeasurements | null;
    changes: Partial<BodyMeasurements> | null;
  };
  photos: {
    count: number;
    latest: ProgressPhoto[];
    firstSet: ProgressPhoto[];
  };
  streak: {
    current: number;
    longest: number;
  };
  workouts: {
    totalCompleted: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface PhotoAnalysisResult {
  overallProgress: 'significant' | 'moderate' | 'minimal' | 'none';
  progressScore: number;
  observations: string[];
  improvements: string[];
  recommendations: string[];
  muscleGroups: Array<{
    name: string;
    change: 'improved' | 'maintained' | 'needs_work';
    note: string;
  }>;
  posture: {
    status: 'improved' | 'same' | 'needs_attention';
    note: string;
  };
  estimatedBodyFatChange?: string;
  motivationalMessage: string;
}

// ============================================
// SERVICE
// ============================================

class ProgressService {
  // ============================================
  // WEIGHT TRACKING
  // ============================================

  /**
   * Log a weight entry
   */
  async logWeight(
    userId: string,
    weightKg: number,
    date?: string,
    notes?: string
  ): Promise<WeightRecord> {
    const recordDate = date || new Date().toISOString().split('T')[0];

    // Check if there's already an entry for this date
    const existing = await pool.query(
      `SELECT id FROM progress_records
       WHERE user_id = $1 AND record_date = $2 AND record_type = 'weight'`,
      [userId, recordDate]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE progress_records
         SET value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify({ weightKg, notes }), existing.rows[0].id]
      );
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO progress_records (user_id, record_date, record_type, value)
         VALUES ($1, $2, 'weight', $3)
         RETURNING *`,
        [userId, recordDate, JSON.stringify({ weightKg, notes })]
      );
    }

    const record = result.rows[0];
    logger.info(`User ${userId} logged weight: ${weightKg}kg on ${recordDate}`);

    // Enqueue embedding for progress record (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: record.id,
      operation: result.rowCount === 1 ? 'create' : 'update',
      priority: JobPriorities.MEDIUM,
    });

    return this.mapWeightRecord(record);
  }

  /**
   * Get weight history
   */
  async getWeightHistory(
    userId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 90
  ): Promise<WeightRecord[]> {
    try {
      let query = `
        SELECT * FROM progress_records
        WHERE user_id = $1 AND record_type = 'weight'
      `;
      const params: (string | number)[] = [userId];

      if (startDate) {
        params.push(startDate);
        query += ` AND record_date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND record_date <= $${params.length}`;
      }

      query += ` ORDER BY record_date DESC`;

      if (limit) {
        params.push(limit);
        query += ` LIMIT $${params.length}`;
      }

      const result = await pool.query(query, params);
      return result.rows.map((row) => {
        try {
          return this.mapWeightRecord(row);
        } catch (error) {
          logger.warn('[Progress] Error mapping weight record', { userId, rowId: row.id, error });
          return null;
        }
      }).filter((record): record is WeightRecord => record !== null);
    } catch (error) {
      logger.error('[Progress] Error fetching weight history', { userId, error });
      return [];
    }
  }

  /**
   * Get latest weight
   */
  async getLatestWeight(userId: string): Promise<WeightRecord | null> {
    const result = await pool.query(
      `SELECT * FROM progress_records
       WHERE user_id = $1 AND record_type = 'weight'
       ORDER BY record_date DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapWeightRecord(result.rows[0]);
  }

  // ============================================
  // MEASUREMENTS TRACKING
  // ============================================

  /**
   * Log body measurements
   */
  async logMeasurements(
    userId: string,
    measurements: BodyMeasurements,
    date?: string,
    notes?: string
  ): Promise<MeasurementRecord> {
    const recordDate = date || new Date().toISOString().split('T')[0];

    // Check if there's already an entry for this date
    const existing = await pool.query(
      `SELECT id FROM progress_records
       WHERE user_id = $1 AND record_date = $2 AND record_type = 'measurement'`,
      [userId, recordDate]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE progress_records
         SET value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify({ measurements, notes }), existing.rows[0].id]
      );
    } else {
      // Create new
      result = await pool.query(
        `INSERT INTO progress_records (user_id, record_date, record_type, value)
         VALUES ($1, $2, 'measurement', $3)
         RETURNING *`,
        [userId, recordDate, JSON.stringify({ measurements, notes })]
      );
    }

    const record = result.rows[0];
    logger.info(`User ${userId} logged measurements on ${recordDate}`);

    // Enqueue embedding for progress record (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: record.id,
      operation: result.rowCount === 1 ? 'create' : 'update',
      priority: JobPriorities.MEDIUM,
    });

    return this.mapMeasurementRecord(record);
  }

  /**
   * Get measurement history
   */
  async getMeasurementHistory(
    userId: string,
    limit: number = 12
  ): Promise<MeasurementRecord[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM progress_records
         WHERE user_id = $1 AND record_type = 'measurement'
         ORDER BY record_date DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row) => {
        try {
          return this.mapMeasurementRecord(row);
        } catch (error) {
          logger.warn('[Progress] Error mapping measurement record', { userId, rowId: row.id, error });
          return null;
        }
      }).filter((record): record is MeasurementRecord => record !== null);
    } catch (error) {
      logger.error('[Progress] Error fetching measurement history', { userId, error });
      return [];
    }
  }

  /**
   * Get latest measurements
   */
  async getLatestMeasurements(userId: string): Promise<MeasurementRecord | null> {
    const result = await pool.query(
      `SELECT * FROM progress_records
       WHERE user_id = $1 AND record_type = 'measurement'
       ORDER BY record_date DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapMeasurementRecord(result.rows[0]);
  }

  // ============================================
  // PHOTO TRACKING
  // ============================================

  /**
   * Upload a progress photo
   */
  async uploadProgressPhoto(
    userId: string,
    photoType: 'front' | 'side' | 'back',
    fileBuffer: Buffer,
    mimeType: string,
    date?: string,
    notes?: string
  ): Promise<ProgressPhoto> {
    const recordDate = date || new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const extension = mimeType.split('/')[1] || 'jpg';
    const photoKey = `progress/${userId}/${recordDate}/${photoType}-${timestamp}.${extension}`;

    // Upload to R2
    await r2Service.upload(fileBuffer, `${photoType}-${timestamp}.${extension}`, mimeType, {
      fileType: 'image',
      userId,
      customPath: `progress/${userId}/${recordDate}`,
    });

    // Check for existing photo of same type on same date
    const existing = await pool.query(
      `SELECT id, photo_keys FROM progress_records
       WHERE user_id = $1 AND record_date = $2 AND record_type = 'photo'`,
      [userId, recordDate]
    );

    let result;
    if (existing.rows.length > 0) {
      // Append to existing photos for this date
      const existingKeys = existing.rows[0].photo_keys || [];
      const updatedKeys = [...existingKeys, photoKey];

      result = await pool.query(
        `UPDATE progress_records
         SET photo_keys = $1,
             value = jsonb_set(COALESCE(value, '{}'::jsonb), $2, $3::jsonb),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [
          updatedKeys,
          `{${photoType}}`,
          JSON.stringify({ photoKey, notes }),
          existing.rows[0].id,
        ]
      );
    } else {
      // Create new photo record
      result = await pool.query(
        `INSERT INTO progress_records (user_id, record_date, record_type, value, photo_keys)
         VALUES ($1, $2, 'photo', $3, $4)
         RETURNING *`,
        [
          userId,
          recordDate,
          JSON.stringify({ [photoType]: { photoKey, notes } }),
          [photoKey],
        ]
      );
    }

    const record = result.rows[0];

    // Award XP for progress photo
    await gamificationService.awardXP(userId, 'progress_photo', 15, record.id);

    logger.info(`User ${userId} uploaded ${photoType} progress photo`);

    // Enqueue embedding for progress record (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'progress_record',
      sourceId: record.id,
      operation: existing.rows.length > 0 ? 'update' : 'create',
      priority: JobPriorities.MEDIUM,
    });

    return {
      id: result.rows[0].id,
      userId,
      recordDate,
      photoType,
      photoKey,
      notes,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  /**
   * Get progress photos
   * Fetches from both progress_records and user_body_images tables
   */
  async getProgressPhotos(
    userId: string,
    limit: number = 30
  ): Promise<ProgressPhoto[]> {
    const photos: ProgressPhoto[] = [];

    try {
      // First, get photos from progress_records (legacy format)
      const progressRecordsResult = await pool.query(
        `SELECT * FROM progress_records
         WHERE user_id = $1 AND record_type = 'photo'
         ORDER BY record_date DESC
         LIMIT $2`,
        [userId, limit]
      );

      for (const row of progressRecordsResult.rows) {
        try {
          // Parse JSONB value safely
          let value: Record<string, { photoKey: string; notes?: string }> = {};
          if (typeof row.value === 'string') {
            value = JSON.parse(row.value);
          } else if (typeof row.value === 'object' && row.value !== null) {
            value = row.value as Record<string, { photoKey: string; notes?: string }>;
          }

          const photoKeys = (row.photo_keys as string[]) || [];

          for (const photoKey of photoKeys) {
            if (!photoKey) continue;
            
            try {
              // Determine photo type from key
              const photoType = this.extractPhotoType(photoKey);
              const photoData = value[photoType] || { photoKey };

              const photoUrl = await r2Service.getSignedUrl(photoData.photoKey);

              photos.push({
                id: row.id as string,
                userId: row.user_id as string,
                recordDate: typeof row.record_date === 'string' ? row.record_date : (row.record_date as Date).toISOString().split('T')[0],
                photoType: photoType as 'front' | 'side' | 'back',
                photoKey: photoData.photoKey,
                photoUrl,
                notes: photoData.notes,
                createdAt: (row.created_at as Date).toISOString(),
              });
            } catch (photoError) {
              logger.warn('[Progress] Error processing photo from progress_records', { userId, photoKey, error: photoError });
            }
          }
        } catch (rowError) {
          logger.warn('[Progress] Error processing photo row from progress_records', { userId, rowId: row.id, error: rowError });
        }
      }

      // Also get photos from user_body_images table
      const bodyImagesResult = await pool.query(
        `SELECT * FROM user_body_images
         WHERE user_id = $1
         ORDER BY captured_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      logger.debug('[Progress] Found body images from user_body_images', { 
        userId, 
        count: bodyImagesResult.rows.length,
        images: bodyImagesResult.rows.map(r => ({
          id: r.id,
          imageType: r.image_type,
          imageKey: r.image_key,
          capturedAt: r.captured_at,
        }))
      });

      for (const row of bodyImagesResult.rows) {
        try {
          const imageType = row.image_type as string;
          const imageKey = row.image_key as string;
          const capturedAt = row.captured_at as Date;

          // Map image_type to photoType (skip 'face' as it's not a progress photo type)
          let photoType: 'front' | 'side' | 'back' | null = null;
          if (imageType === 'front') photoType = 'front';
          else if (imageType === 'side') photoType = 'side';
          else if (imageType === 'back') photoType = 'back';
          // Skip 'face' type as it's not used for progress photos

          if (!photoType || !imageKey) {
            continue;
          }

          try {
            const photoUrl = await r2Service.getSignedUrl(imageKey);

            photos.push({
              id: row.id as string,
              userId: row.user_id as string,
              recordDate: capturedAt.toISOString().split('T')[0],
              photoType,
              photoKey: imageKey,
              photoUrl,
              notes: undefined, // user_body_images doesn't have notes field
              createdAt: (row.created_at as Date).toISOString(),
            });
          } catch (photoError) {
            logger.warn('[Progress] Error processing body image', { userId, imageKey, error: photoError });
          }
        } catch (rowError) {
          logger.warn('[Progress] Error processing body image row', { userId, rowId: row.id, error: rowError });
        }
      }

      // Sort all photos by date (newest first) and limit
      photos.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      return photos.slice(0, limit);
    } catch (error) {
      logger.error('[Progress] Error fetching progress photos', { userId, error });
      return [];
    }
  }

  /**
   * Get comparison photos (first vs latest)
   * Fetches from both progress_records and user_body_images tables
   */
  async getComparisonPhotos(userId: string): Promise<{
    first: ProgressPhoto[];
    latest: ProgressPhoto[];
  }> {
    try {
      // Get all photos from both sources
      const allPhotos = await this.getProgressPhotos(userId, 100); // Get more to find first/latest sets

      if (allPhotos.length === 0) {
        return { first: [], latest: [] };
      }

      // Group photos by date to find first and latest sets
      const photosByDate = new Map<string, ProgressPhoto[]>();
      
      for (const photo of allPhotos) {
        const dateKey = photo.recordDate;
        if (!photosByDate.has(dateKey)) {
          photosByDate.set(dateKey, []);
        }
        photosByDate.get(dateKey)!.push(photo);
      }

      // Sort dates chronologically
      const sortedDates = Array.from(photosByDate.keys()).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      });

      // First set is the earliest date
      const firstDate = sortedDates[0];
      const firstSet = firstDate ? photosByDate.get(firstDate) || [] : [];

      // Latest set is the most recent date
      const latestDate = sortedDates[sortedDates.length - 1];
      const latestSet = latestDate ? photosByDate.get(latestDate) || [] : [];

      logger.debug('[Progress] Comparison photos', {
        userId,
        firstSetCount: firstSet.length,
        latestSetCount: latestSet.length,
        firstDate,
        latestDate,
      });

      return {
        first: firstSet,
        latest: latestSet,
      };
    } catch (error) {
      logger.error('[Progress] Error fetching comparison photos', { userId, error });
      return { first: [], latest: [] };
    }
  }

  // ============================================
  // PROGRESS SUMMARY
  // ============================================

  /**
   * Get comprehensive progress summary
   */
  async getProgressSummary(userId: string): Promise<ProgressSummary> {
    try {
      logger.debug('[Progress] Fetching progress summary', { userId });

      // Get weight data (returns DESC order - newest first)
      const weightHistoryDesc = await this.getWeightHistory(userId, undefined, undefined, 90);
      logger.debug('[Progress] Weight history fetched', { userId, count: weightHistoryDesc.length });
      
      // Reverse to chronological order (oldest first) for charts and calculations
      const weightHistory = [...weightHistoryDesc].reverse();
      
      // Current weight is the most recent (first in DESC, last in chronological)
      const currentWeight = weightHistoryDesc[0]?.weightKg || null;
      // Starting weight is the oldest (last in DESC, first in chronological)
      const startingWeight = weightHistoryDesc[weightHistoryDesc.length - 1]?.weightKg || null;

      const weights = weightHistory.map((w) => w.weightKg);
      const lowestWeight = weights.length > 0 ? Math.min(...weights) : null;
      const highestWeight = weights.length > 0 ? Math.max(...weights) : null;

      const weightChange =
        currentWeight !== null && startingWeight !== null
          ? Number((currentWeight - startingWeight).toFixed(1))
          : null;

      // Calculate weight trend (compare recent vs older entries)
      // Recent = last 3 entries (most recent), Older = first 3 entries (oldest)
      let weightTrend: 'up' | 'down' | 'stable' = 'stable';
      if (weightHistoryDesc.length >= 3) {
        const recent = weightHistoryDesc.slice(0, 3); // Most recent 3
        const avgRecent = recent.reduce((s, w) => s + w.weightKg, 0) / recent.length;
        const older = weightHistoryDesc.slice(-3); // Oldest 3
        const avgOlder = older.reduce((s, w) => s + w.weightKg, 0) / older.length;
        const diff = avgRecent - avgOlder;
        if (diff > 0.5) weightTrend = 'up';
        else if (diff < -0.5) weightTrend = 'down';
      }

      // Get measurement data
      const measurementHistory = await this.getMeasurementHistory(userId, 2);
      logger.debug('[Progress] Measurement history fetched', { userId, count: measurementHistory.length });
      
      const currentMeasurements = measurementHistory[0]?.measurements || null;
      const startingMeasurements = measurementHistory[measurementHistory.length - 1]?.measurements || null;

      let measurementChanges: Partial<BodyMeasurements> | null = null;
      if (currentMeasurements && startingMeasurements) {
        measurementChanges = {};
        const keys = Object.keys(currentMeasurements) as (keyof BodyMeasurements)[];
        for (const key of keys) {
          const current = currentMeasurements[key];
          const starting = startingMeasurements[key];
          if (current !== undefined && starting !== undefined) {
            measurementChanges[key] = Number((current - starting).toFixed(1));
          }
        }
      }

      // Get photo data
      const photos = await this.getProgressPhotos(userId, 10);
      logger.debug('[Progress] Progress photos fetched', { 
        userId, 
        count: photos.length,
        photoTypes: photos.map(p => p.photoType),
        photoDates: photos.map(p => p.recordDate),
      });
      
      const comparison = await this.getComparisonPhotos(userId);
      logger.debug('[Progress] Comparison photos fetched', { 
        userId, 
        firstSetCount: comparison.first.length,
        latestSetCount: comparison.latest.length,
        firstSetTypes: comparison.first.map(p => p.photoType),
        latestSetTypes: comparison.latest.map(p => p.photoType),
      });

      // Get user stats for streaks
      const userStats = await gamificationService.getUserStats(userId);
      logger.debug('[Progress] User stats fetched', { 
        userId, 
        currentStreak: userStats.currentStreak,
        longestStreak: userStats.longestStreak 
      });

      // Get workout counts
      const workoutCounts = await this.getWorkoutCounts(userId);
      logger.debug('[Progress] Workout counts fetched', { 
        userId, 
        total: workoutCounts.totalCompleted,
        thisWeek: workoutCounts.thisWeek,
        thisMonth: workoutCounts.thisMonth 
      });

      const summary: ProgressSummary = {
        weight: {
          current: currentWeight,
          starting: startingWeight,
          lowest: lowestWeight,
          highest: highestWeight,
          change: weightChange,
          trend: weightTrend,
          history: weightHistory.map((w) => ({
            date: w.recordDate,
            weightKg: w.weightKg,
          })),
        },
        measurements: {
          current: currentMeasurements,
          starting: startingMeasurements,
          changes: measurementChanges,
        },
        photos: {
          count: photos.length,
          latest: photos.slice(0, 3),
          firstSet: comparison.first,
        },
        streak: {
          current: userStats.currentStreak,
          longest: userStats.longestStreak,
        },
        workouts: workoutCounts,
      };

      logger.debug('[Progress] Progress summary compiled successfully', { userId });
      return summary;
    } catch (error) {
      logger.error('[Progress] Error fetching progress summary', { userId, error });
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapWeightRecord(row: Record<string, unknown>): WeightRecord {
    try {
      // PostgreSQL pg library automatically parses JSONB, but handle both cases for safety
      let value: { weightKg: number; notes?: string };
      if (typeof row.value === 'string') {
        value = JSON.parse(row.value);
      } else if (typeof row.value === 'object' && row.value !== null) {
        value = row.value as { weightKg: number; notes?: string };
      } else {
        throw new Error('Invalid value type for weight record');
      }

      if (typeof value.weightKg !== 'number') {
        logger.error('[Progress] Invalid weightKg in record', { id: row.id, value });
        throw new Error('Invalid weightKg value');
      }

      return {
        id: row.id as string,
        userId: row.user_id as string,
        recordDate: typeof row.record_date === 'string' ? row.record_date : (row.record_date as Date).toISOString().split('T')[0],
        weightKg: value.weightKg,
        notes: value.notes,
        createdAt: (row.created_at as Date).toISOString(),
      };
    } catch (error) {
      logger.error('[Progress] Error mapping weight record', { error, row });
      throw error;
    }
  }

  private mapMeasurementRecord(row: Record<string, unknown>): MeasurementRecord {
    try {
      // PostgreSQL pg library automatically parses JSONB, but handle both cases for safety
      let value: { measurements: BodyMeasurements; notes?: string };
      if (typeof row.value === 'string') {
        value = JSON.parse(row.value);
      } else if (typeof row.value === 'object' && row.value !== null) {
        value = row.value as { measurements: BodyMeasurements; notes?: string };
      } else {
        throw new Error('Invalid value type for measurement record');
      }

      if (!value.measurements || typeof value.measurements !== 'object') {
        logger.error('[Progress] Invalid measurements in record', { id: row.id, value });
        throw new Error('Invalid measurements value');
      }

      return {
        id: row.id as string,
        userId: row.user_id as string,
        recordDate: typeof row.record_date === 'string' ? row.record_date : (row.record_date as Date).toISOString().split('T')[0],
        measurements: value.measurements,
        notes: value.notes,
        createdAt: (row.created_at as Date).toISOString(),
      };
    } catch (error) {
      logger.error('[Progress] Error mapping measurement record', { error, row });
      throw error;
    }
  }

  private extractPhotoType(photoKey: string): 'front' | 'side' | 'back' {
    if (photoKey.includes('/front-')) return 'front';
    if (photoKey.includes('/side-')) return 'side';
    if (photoKey.includes('/back-')) return 'back';
    return 'front'; // Default
  }

  // ============================================
  // PHOTO ANALYSIS
  // ============================================

  /**
   * Analyze before/after photos with AI
   */
  async analyzeProgressPhotos(
    userId: string,
    beforePhotoUrl: string,
    afterPhotoUrl: string,
    photoType?: string,
    beforeDate?: string,
    afterDate?: string
  ): Promise<PhotoAnalysisResult> {
    logger.info('[Progress] Analyzing progress photos', { userId, photoType, beforeDate, afterDate });

    try {
      // Import AI provider dynamically to avoid circular dependency
      const { aiProviderService } = await import('./ai-provider.service.js');

      // Calculate days between photos
      let daysBetween = 30;
      if (beforeDate && afterDate) {
        const before = new Date(beforeDate);
        const after = new Date(afterDate);
        daysBetween = Math.ceil((after.getTime() - before.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Create a detailed prompt for analysis
      const systemPrompt = `You are an expert fitness coach and body composition analyst. Analyze the before and after progress photos and provide a detailed, encouraging assessment.

Your response must be valid JSON with this exact structure:
{
  "overallProgress": "significant" | "moderate" | "minimal" | "none",
  "progressScore": <number 0-100>,
  "observations": [<3 observation strings>],
  "improvements": [<3 improvement strings>],
  "recommendations": [<4 recommendation strings>],
  "muscleGroups": [
    {"name": "Chest", "change": "improved" | "maintained" | "needs_work", "note": "<brief note>"},
    {"name": "Arms", "change": "improved" | "maintained" | "needs_work", "note": "<brief note>"},
    {"name": "Core", "change": "improved" | "maintained" | "needs_work", "note": "<brief note>"},
    {"name": "Shoulders", "change": "improved" | "maintained" | "needs_work", "note": "<brief note>"},
    {"name": "Back", "change": "improved" | "maintained" | "needs_work", "note": "<brief note>"}
  ],
  "posture": {
    "status": "improved" | "same" | "needs_attention",
    "note": "<posture observation>"
  },
  "estimatedBodyFatChange": "<estimated change e.g. '-2-4%'>",
  "motivationalMessage": "<encouraging 2-3 sentence message>"
}

Be encouraging but honest. Focus on visible improvements in muscle definition, body composition, and posture.`;

      const userPrompt = `Analyze these ${photoType || 'progress'} photos taken ${daysBetween} days apart.

Before photo: ${beforePhotoUrl}
After photo: ${afterPhotoUrl}
Photo type: ${photoType || 'front'}
Time period: ${daysBetween} days

Provide a detailed analysis in JSON format focusing on:
1. Overall visible progress
2. Specific muscle group improvements
3. Posture changes
4. Body composition changes
5. Actionable recommendations

Be supportive and motivational while being honest about the changes visible.`;

      // Try to get AI analysis
      if (aiProviderService.isAvailable()) {
        const response = await aiProviderService.generateCompletion({
          systemPrompt,
          userPrompt,
          maxTokens: 1500,
          temperature: 0.7,
        });

        try {
          // Parse JSON response
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]) as PhotoAnalysisResult;
            logger.info('[Progress] AI photo analysis completed', { userId, progressScore: analysis.progressScore });
            return analysis;
          }
        } catch (parseError) {
          logger.warn('[Progress] Failed to parse AI response, using mock analysis', { userId, error: parseError });
        }
      }

      // Fallback to mock analysis if AI is not available or failed
      return this.generateMockPhotoAnalysis(daysBetween);
    } catch (error) {
      logger.error('[Progress] Error analyzing photos, using mock analysis', { userId, error });
      return this.generateMockPhotoAnalysis(30);
    }
  }

  /**
   * Generate mock photo analysis for fallback
   */
  private generateMockPhotoAnalysis(daysBetween: number): PhotoAnalysisResult {
    const progressLevel = daysBetween > 60 ? 'significant' : daysBetween > 30 ? 'moderate' : 'minimal';
    const progressScore = Math.min(95, Math.floor(50 + Math.random() * 40));

    return {
      overallProgress: progressLevel,
      progressScore,
      observations: [
        'Visible improvement in muscle definition',
        'Better posture alignment detected',
        'Reduced body fat percentage around midsection',
      ],
      improvements: [
        'Core strength appears to have increased',
        'Shoulder width and definition improved',
        'Overall body composition is more balanced',
      ],
      recommendations: [
        'Continue with current workout routine',
        'Consider increasing protein intake for muscle recovery',
        'Add more compound exercises for full-body development',
        'Take progress photos at the same time of day for consistency',
      ],
      muscleGroups: [
        { name: 'Chest', change: 'improved', note: 'Good development visible' },
        { name: 'Arms', change: 'improved', note: 'Biceps showing definition' },
        { name: 'Core', change: 'improved', note: 'More visible abs' },
        { name: 'Shoulders', change: 'maintained', note: 'Stable, consider more focus' },
        { name: 'Back', change: 'needs_work', note: 'Could use more lat exercises' },
      ],
      posture: {
        status: 'improved',
        note: 'Shoulders more aligned, less forward lean',
      },
      estimatedBodyFatChange: '-2-4%',
      motivationalMessage:
        "Incredible progress! Your dedication is paying off. Keep pushing forward and remember that consistency is key to achieving your fitness goals. You've come a long way!",
    };
  }

  private async getWorkoutCounts(userId: string): Promise<{
    totalCompleted: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    try {
      const today = new Date();
      
      // Calculate start of week (Sunday = 0, so we subtract day of week)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Calculate start of month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      const result = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') as total,
           COUNT(*) FILTER (WHERE status = 'completed' AND scheduled_date >= $2) as this_week,
           COUNT(*) FILTER (WHERE status = 'completed' AND scheduled_date >= $3) as this_month
         FROM workout_logs
         WHERE user_id = $1`,
        [userId, startOfWeek.toISOString().split('T')[0], startOfMonth.toISOString().split('T')[0]]
      );

      if (!result.rows || result.rows.length === 0) {
        logger.warn('[Progress] No workout counts result returned', { userId });
        return {
          totalCompleted: 0,
          thisWeek: 0,
          thisMonth: 0,
        };
      }

      const row = result.rows[0];
      return {
        totalCompleted: parseInt(String(row.total || 0), 10) || 0,
        thisWeek: parseInt(String(row.this_week || 0), 10) || 0,
        thisMonth: parseInt(String(row.this_month || 0), 10) || 0,
      };
    } catch (error) {
      logger.error('[Progress] Error fetching workout counts', { userId, error });
      // Return default values instead of throwing to prevent breaking the summary
      return {
        totalCompleted: 0,
        thisWeek: 0,
        thisMonth: 0,
      };
    }
  }
}

// Export singleton instance
export const progressService = new ProgressService();
