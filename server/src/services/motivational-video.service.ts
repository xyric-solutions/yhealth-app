/**
 * @file Motivational Video Service
 * Handles YouTube video recommendations for user goals
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface MotivationalVideo {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  goalCategory: string;
  contentType: 'motivation' | 'workout' | 'nutrition' | 'tips';
  tags: string[];
  isFeatured: boolean;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoInteraction {
  id: string;
  userId: string;
  videoId: string;
  watched: boolean;
  liked: boolean;
  saved: boolean;
  watchCount: number;
  lastWatchedAt: string | null;
}

export interface VideoWithInteraction extends MotivationalVideo {
  interaction?: VideoInteraction;
}

// Curated video collections per goal category
// These are real, high-quality YouTube videos for motivation
const CURATED_VIDEOS: Record<string, Array<{
  youtubeVideoId: string;
  title: string;
  channelName: string;
  contentType: 'motivation' | 'workout' | 'nutrition' | 'tips';
  tags: string[];
}>> = {
  weight_loss: [
    { youtubeVideoId: 'R0mMyV5OtcM', title: 'The Science of Fat Loss', channelName: 'Jeff Nippard', contentType: 'tips', tags: ['science', 'fat loss', 'education'] },
    { youtubeVideoId: 'eXTiiz99p9o', title: 'I Lost 100 Pounds - My Weight Loss Journey', channelName: 'Motivation Hub', contentType: 'motivation', tags: ['transformation', 'motivation', 'story'] },
    { youtubeVideoId: 'YxtwX2NKa6U', title: '30 Minute Fat Burning HIIT Workout', channelName: 'THENX', contentType: 'workout', tags: ['hiit', 'cardio', 'fat burn'] },
    { youtubeVideoId: 'TFFj5BPqAoU', title: 'Full Day of Eating for Weight Loss', channelName: 'Will Tennyson', contentType: 'nutrition', tags: ['meal prep', 'diet', 'recipes'] },
    { youtubeVideoId: 'j1Xr1LPH67c', title: 'Best Fat Burning Exercises', channelName: 'Athlean-X', contentType: 'workout', tags: ['exercises', 'training', 'fitness'] },
  ],
  muscle_building: [
    { youtubeVideoId: 'Fv-sKP17xTw', title: 'The Most Scientific Way to Build Muscle', channelName: 'Jeremy Ethier', contentType: 'tips', tags: ['science', 'hypertrophy', 'training'] },
    { youtubeVideoId: 'g7SzH6VpZkY', title: 'Arnold Schwarzenegger Motivation - 6 Rules of Success', channelName: 'Motivation Archive', contentType: 'motivation', tags: ['arnold', 'motivation', 'mindset'] },
    { youtubeVideoId: 'IODxDxX7oi4', title: 'Full Body Workout - Build Muscle At Home', channelName: 'Buff Dudes', contentType: 'workout', tags: ['full body', 'home workout', 'strength'] },
    { youtubeVideoId: 'YLiAR9LXC8s', title: 'Full Day of Eating to Build Muscle', channelName: 'Greg Doucette', contentType: 'nutrition', tags: ['bulking', 'protein', 'diet'] },
    { youtubeVideoId: 'HvHGxQJdgnM', title: 'Push Pull Legs Routine', channelName: 'Jeff Nippard', contentType: 'workout', tags: ['ppl', 'split', 'program'] },
  ],
  sleep_improvement: [
    { youtubeVideoId: 'nm1TxQj9IsQ', title: 'Sleep is Your Superpower', channelName: 'TED', contentType: 'tips', tags: ['sleep science', 'health', 'ted talk'] },
    { youtubeVideoId: 'gedoSfZvBgE', title: '10 Minute Guided Meditation for Sleep', channelName: 'Great Meditation', contentType: 'motivation', tags: ['meditation', 'relaxation', 'guided'] },
    { youtubeVideoId: 'LGd3VJG_Eg4', title: 'Yoga For Bedtime - 20 Minute Practice', channelName: 'Yoga With Adriene', contentType: 'workout', tags: ['yoga', 'bedtime', 'relaxation'] },
    { youtubeVideoId: 'A5dE25ANU0k', title: 'Foods That Help You Sleep Better', channelName: 'Thomas DeLauer', contentType: 'nutrition', tags: ['sleep foods', 'melatonin', 'diet'] },
    { youtubeVideoId: 'eTcO6puneiQ', title: 'Military Sleep Method - Fall Asleep in 2 Minutes', channelName: 'Justin Agustin', contentType: 'tips', tags: ['sleep hack', 'military', 'technique'] },
  ],
  stress_wellness: [
    { youtubeVideoId: 'WPPPFqsECz0', title: 'How to Make Stress Your Friend', channelName: 'TED', contentType: 'tips', tags: ['stress', 'mindset', 'ted talk'] },
    { youtubeVideoId: 'inpok4MKVLM', title: '5 Minute Guided Meditation', channelName: 'Goodful', contentType: 'motivation', tags: ['meditation', 'quick', 'mindfulness'] },
    { youtubeVideoId: 'hJbRpHZr_d0', title: 'Yoga for Stress Relief', channelName: 'Yoga With Adriene', contentType: 'workout', tags: ['yoga', 'stress relief', 'relaxation'] },
    { youtubeVideoId: 'KQvGRgBgunQ', title: 'Anti-Stress Foods to Add to Your Diet', channelName: 'Dr. Eric Berg', contentType: 'nutrition', tags: ['stress foods', 'cortisol', 'diet'] },
    { youtubeVideoId: 'SEfs5TJZ6Nk', title: 'Navy SEAL Breathing Technique', channelName: 'Mark Divine', contentType: 'tips', tags: ['breathing', 'box breathing', 'technique'] },
  ],
  energy_productivity: [
    { youtubeVideoId: 'iONDebHX9qk', title: 'Hack Your Brain\'s Dopamine System', channelName: 'Veritasium', contentType: 'tips', tags: ['dopamine', 'brain', 'science'] },
    { youtubeVideoId: 'DkS1pkKpILY', title: 'Rise and Grind - Morning Motivation', channelName: 'Motiversity', contentType: 'motivation', tags: ['morning', 'motivation', 'energy'] },
    { youtubeVideoId: 'QH8-wG4YzpE', title: 'Morning Stretch Routine - Wake Up', channelName: 'MadFit', contentType: 'workout', tags: ['morning', 'stretch', 'energy'] },
    { youtubeVideoId: 'iEGP_R12fEc', title: 'Foods for All-Day Energy', channelName: 'Pick Up Limes', contentType: 'nutrition', tags: ['energy foods', 'healthy eating', 'diet'] },
    { youtubeVideoId: 'LAOICItn3MM', title: 'Atomic Habits Summary', channelName: 'Productivity Game', contentType: 'tips', tags: ['habits', 'productivity', 'book summary'] },
  ],
  overall_optimization: [
    { youtubeVideoId: 'LO1mTELoj6o', title: 'The Science of Being in the Zone', channelName: 'Veritasium', contentType: 'tips', tags: ['flow state', 'performance', 'science'] },
    { youtubeVideoId: '75d_29QWELk', title: 'David Goggins - Suffering is the True Test', channelName: 'Motivation Madness', contentType: 'motivation', tags: ['goggins', 'mental toughness', 'motivation'] },
    { youtubeVideoId: 'qX9FSZJu448', title: 'Complete Full Body Workout', channelName: 'Chris Heria', contentType: 'workout', tags: ['full body', 'calisthenics', 'strength'] },
    { youtubeVideoId: 'v7AYKMP6rOE', title: 'What I Eat in a Day - Healthy & Simple', channelName: 'Downshiftology', contentType: 'nutrition', tags: ['healthy eating', 'meal ideas', 'simple'] },
    { youtubeVideoId: 'Wcs2PFz5q6g', title: 'Andrew Huberman\'s Daily Routine', channelName: 'After Skool', contentType: 'tips', tags: ['routine', 'optimization', 'protocols'] },
  ],
};

// ============================================
// SERVICE CLASS
// ============================================

class MotivationalVideoService {
  /**
   * Get recommended videos for a user based on their goal
   */
  async getRecommendedVideos(
    userId: string,
    goalCategory: string,
    limit = 10
  ): Promise<VideoWithInteraction[]> {
    // First, try to get videos from database
    let videos = await this.getVideosFromDB(goalCategory, limit);

    // If no videos in DB, seed from curated list
    if (videos.length === 0) {
      await this.seedVideosForGoal(goalCategory);
      videos = await this.getVideosFromDB(goalCategory, limit);
    }

    // Get user interactions
    const videoIds = videos.map(v => v.id);
    const interactions = await this.getUserInteractions(userId, videoIds);

    // Combine videos with interactions
    return videos.map(video => ({
      ...video,
      interaction: interactions.find(i => i.videoId === video.id),
    }));
  }

  /**
   * Get featured videos across all categories
   */
  async getFeaturedVideos(userId: string, limit = 5): Promise<VideoWithInteraction[]> {
    const result = await pool.query(
      `SELECT * FROM motivational_videos
       WHERE is_featured = true
       ORDER BY relevance_score DESC
       LIMIT $1`,
      [limit]
    );

    const videos = result.rows.map(this.mapVideoRow);
    const videoIds = videos.map(v => v.id);
    const interactions = await this.getUserInteractions(userId, videoIds);

    return videos.map(video => ({
      ...video,
      interaction: interactions.find(i => i.videoId === video.id),
    }));
  }

  /**
   * Get saved videos for a user
   */
  async getSavedVideos(userId: string): Promise<VideoWithInteraction[]> {
    const result = await pool.query(
      `SELECT mv.*, uvi.watched, uvi.liked, uvi.saved, uvi.watch_count, uvi.last_watched_at
       FROM motivational_videos mv
       JOIN user_video_interactions uvi ON mv.id = uvi.video_id
       WHERE uvi.user_id = $1 AND uvi.saved = true
       ORDER BY uvi.created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      ...this.mapVideoRow(row),
      interaction: {
        id: row.id,
        userId: row.user_id,
        videoId: row.video_id,
        watched: row.watched,
        liked: row.liked,
        saved: row.saved,
        watchCount: row.watch_count,
        lastWatchedAt: row.last_watched_at?.toISOString() || null,
      },
    }));
  }

  /**
   * Search videos by query
   */
  async searchVideos(query: string, limit = 20): Promise<MotivationalVideo[]> {
    const result = await pool.query(
      `SELECT * FROM motivational_videos
       WHERE title ILIKE $1 OR channel_name ILIKE $1 OR $2 = ANY(tags)
       ORDER BY relevance_score DESC
       LIMIT $3`,
      [`%${query}%`, query.toLowerCase(), limit]
    );

    return result.rows.map(this.mapVideoRow);
  }

  /**
   * Record video interaction (watch, like, save)
   */
  async recordInteraction(
    userId: string,
    videoId: string,
    interaction: { watched?: boolean; liked?: boolean; saved?: boolean }
  ): Promise<VideoInteraction> {
    const { watched, liked, saved } = interaction;

    const result = await pool.query(
      `INSERT INTO user_video_interactions (user_id, video_id, watched, liked, saved, watch_count, last_watched_at)
       VALUES ($1, $2, COALESCE($3, false), COALESCE($4, false), COALESCE($5, false),
               CASE WHEN $3 = true THEN 1 ELSE 0 END,
               CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT (user_id, video_id) DO UPDATE SET
         watched = COALESCE($3, user_video_interactions.watched),
         liked = COALESCE($4, user_video_interactions.liked),
         saved = COALESCE($5, user_video_interactions.saved),
         watch_count = CASE WHEN $3 = true THEN user_video_interactions.watch_count + 1
                           ELSE user_video_interactions.watch_count END,
         last_watched_at = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP
                               ELSE user_video_interactions.last_watched_at END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, videoId, watched, liked, saved]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      videoId: row.video_id,
      watched: row.watched,
      liked: row.liked,
      saved: row.saved,
      watchCount: row.watch_count,
      lastWatchedAt: row.last_watched_at?.toISOString() || null,
    };
  }

  /**
   * Get video statistics for a user
   */
  async getUserVideoStats(userId: string): Promise<{
    totalWatched: number;
    totalSaved: number;
    totalLiked: number;
    mostWatchedCategory: string | null;
  }> {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE watched = true) as total_watched,
         COUNT(*) FILTER (WHERE saved = true) as total_saved,
         COUNT(*) FILTER (WHERE liked = true) as total_liked
       FROM user_video_interactions
       WHERE user_id = $1`,
      [userId]
    );

    const categoryResult = await pool.query(
      `SELECT mv.goal_category, COUNT(*) as count
       FROM user_video_interactions uvi
       JOIN motivational_videos mv ON uvi.video_id = mv.id
       WHERE uvi.user_id = $1 AND uvi.watched = true
       GROUP BY mv.goal_category
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    );

    return {
      totalWatched: parseInt(result.rows[0]?.total_watched || '0'),
      totalSaved: parseInt(result.rows[0]?.total_saved || '0'),
      totalLiked: parseInt(result.rows[0]?.total_liked || '0'),
      mostWatchedCategory: categoryResult.rows[0]?.goal_category || null,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Get videos from database
   */
  private async getVideosFromDB(goalCategory: string, limit: number): Promise<MotivationalVideo[]> {
    const result = await pool.query(
      `SELECT * FROM motivational_videos
       WHERE goal_category = $1
       ORDER BY is_featured DESC, relevance_score DESC
       LIMIT $2`,
      [goalCategory, limit]
    );

    return result.rows.map(this.mapVideoRow);
  }

  /**
   * Get user interactions for videos
   */
  private async getUserInteractions(userId: string, videoIds: string[]): Promise<VideoInteraction[]> {
    if (videoIds.length === 0) return [];

    const result = await pool.query(
      `SELECT * FROM user_video_interactions
       WHERE user_id = $1 AND video_id = ANY($2)`,
      [userId, videoIds]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      videoId: row.video_id,
      watched: row.watched,
      liked: row.liked,
      saved: row.saved,
      watchCount: row.watch_count,
      lastWatchedAt: row.last_watched_at?.toISOString() || null,
    }));
  }

  /**
   * Seed videos for a goal category
   */
  private async seedVideosForGoal(goalCategory: string): Promise<void> {
    const videos = CURATED_VIDEOS[goalCategory] || CURATED_VIDEOS['overall_optimization'];

    for (const video of videos) {
      try {
        await pool.query(
          `INSERT INTO motivational_videos (
            youtube_video_id, title, channel_name, goal_category, content_type,
            tags, is_featured, relevance_score, thumbnail_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (youtube_video_id) DO NOTHING`,
          [
            video.youtubeVideoId,
            video.title,
            video.channelName,
            goalCategory,
            video.contentType,
            video.tags,
            video.contentType === 'motivation', // Feature motivation videos
            0.8,
            `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`,
          ]
        );
      } catch (error) {
        logger.warn(`Failed to seed video ${video.youtubeVideoId}`, { error });
      }
    }

    logger.info(`Seeded ${videos.length} videos for goal ${goalCategory}`);
  }

  /**
   * Map database row to MotivationalVideo type
   */
  private mapVideoRow(row: Record<string, unknown>): MotivationalVideo {
    return {
      id: row.id as string,
      youtubeVideoId: row.youtube_video_id as string,
      title: row.title as string,
      channelName: row.channel_name as string | null,
      thumbnailUrl: row.thumbnail_url as string | null,
      durationSeconds: row.duration_seconds as number | null,
      viewCount: row.view_count as number | null,
      goalCategory: row.goal_category as string,
      contentType: row.content_type as 'motivation' | 'workout' | 'nutrition' | 'tips',
      tags: (row.tags as string[]) || [],
      isFeatured: row.is_featured as boolean,
      relevanceScore: row.relevance_score as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  // ============================================
  // USER PRIVATE VIDEOS
  // ============================================

  /**
   * Get user's private videos
   */
  async getUserPrivateVideos(userId: string, goalCategory?: string): Promise<UserPrivateVideo[]> {
    let query = `
      SELECT * FROM user_private_videos
      WHERE user_id = $1
    `;
    const params: (string | undefined)[] = [userId];

    if (goalCategory) {
      query += ` AND goal_category = $2`;
      params.push(goalCategory);
    }

    query += ` ORDER BY sort_order ASC, created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows.map(this.mapUserVideoRow);
  }

  /**
   * Add a private video for a user
   */
  async addUserPrivateVideo(
    userId: string,
    data: {
      youtubeVideoId: string;
      title: string;
      channelName?: string;
      goalCategory?: string;
      contentType?: 'motivation' | 'workout' | 'nutrition' | 'tips';
      tags?: string[];
      notes?: string;
    }
  ): Promise<UserPrivateVideo> {
    const thumbnailUrl = `https://img.youtube.com/vi/${data.youtubeVideoId}/mqdefault.jpg`;

    const result = await pool.query(
      `INSERT INTO user_private_videos (
        user_id, youtube_video_id, title, channel_name, thumbnail_url,
        goal_category, content_type, tags, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        data.youtubeVideoId,
        data.title,
        data.channelName || null,
        thumbnailUrl,
        data.goalCategory || 'overall_optimization',
        data.contentType || 'motivation',
        data.tags || [],
        data.notes || null,
      ]
    );

    logger.info(`User ${userId} added private video: ${data.title}`);
    return this.mapUserVideoRow(result.rows[0]);
  }

  /**
   * Update a user's private video
   */
  async updateUserPrivateVideo(
    userId: string,
    videoId: string,
    data: {
      title?: string;
      channelName?: string;
      goalCategory?: string;
      contentType?: 'motivation' | 'workout' | 'nutrition' | 'tips';
      tags?: string[];
      notes?: string;
      isFavorite?: boolean;
      sortOrder?: number;
    }
  ): Promise<UserPrivateVideo | null> {
    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 3;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.channelName !== undefined) {
      updates.push(`channel_name = $${paramIndex++}`);
      values.push(data.channelName);
    }
    if (data.goalCategory !== undefined) {
      updates.push(`goal_category = $${paramIndex++}`);
      values.push(data.goalCategory);
    }
    if (data.contentType !== undefined) {
      updates.push(`content_type = $${paramIndex++}`);
      values.push(data.contentType);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }
    if (data.isFavorite !== undefined) {
      updates.push(`is_favorite = $${paramIndex++}`);
      values.push(data.isFavorite);
    }
    if (data.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(data.sortOrder);
    }

    if (updates.length === 0) {
      return null;
    }

    const result = await pool.query(
      `UPDATE user_private_videos
       SET ${updates.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [videoId, userId, ...values]
    );

    if (result.rows.length === 0) {
      return null;
    }

    logger.info(`User ${userId} updated private video ${videoId}`);
    return this.mapUserVideoRow(result.rows[0]);
  }

  /**
   * Delete a user's private video
   */
  async deleteUserPrivateVideo(userId: string, videoId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM user_private_videos
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [videoId, userId]
    );

    if (result.rows.length > 0) {
      logger.info(`User ${userId} deleted private video ${videoId}`);
      return true;
    }

    return false;
  }

  /**
   * Toggle favorite status for a private video
   */
  async toggleUserVideoFavorite(userId: string, videoId: string): Promise<UserPrivateVideo | null> {
    const result = await pool.query(
      `UPDATE user_private_videos
       SET is_favorite = NOT is_favorite
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [videoId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserVideoRow(result.rows[0]);
  }

  /**
   * Map database row to UserPrivateVideo type
   */
  private mapUserVideoRow(row: Record<string, unknown>): UserPrivateVideo {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      youtubeVideoId: row.youtube_video_id as string,
      title: row.title as string,
      channelName: row.channel_name as string | null,
      thumbnailUrl: row.thumbnail_url as string | null,
      goalCategory: row.goal_category as string,
      contentType: row.content_type as 'motivation' | 'workout' | 'nutrition' | 'tips',
      tags: (row.tags as string[]) || [],
      notes: row.notes as string | null,
      isFavorite: row.is_favorite as boolean,
      sortOrder: row.sort_order as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

// User private video type
export interface UserPrivateVideo {
  id: string;
  userId: string;
  youtubeVideoId: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  goalCategory: string;
  contentType: 'motivation' | 'workout' | 'nutrition' | 'tips';
  tags: string[];
  notes: string | null;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const motivationalVideoService = new MotivationalVideoService();
