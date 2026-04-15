/**
 * @file Redis Cache Service
 * @description Redis-based caching service for leaderboards and daily scores
 * Provides sorted sets for rankings and standard key-value for scores
 */

import { Redis as IORedis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

interface RedisCacheStats {
  connected: boolean;
  keys: number;
  memory: string;
}

// ============================================
// SERVICE
// ============================================

class RedisCacheService {
  private static instance: RedisCacheService;
  private redis: IORedis | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    // Lazy initialization
  }

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized && this.redis) return;

    if (!env.redis.enabled) {
      logger.warn('[RedisCache] Redis is disabled, cache operations will be no-ops');
      return;
    }

    try {
      const config: RedisOptions = {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5000, // 5 second timeout
        enableOfflineQueue: false, // Don't queue commands when disconnected
      };

      if (env.redis.url) {
        this.redis = new IORedis(env.redis.url, config);
      } else {
        this.redis = new IORedis(config);
      }

      this.redis.on('connect', () => {
        logger.info('[RedisCache] Connected to Redis');
      });

      this.redis.on('ready', () => {
        logger.info('[RedisCache] Redis is ready');
        this.isInitialized = true;
      });

      this.redis.on('error', (error) => {
        logger.error('[RedisCache] Redis error', { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Don't set initialized to true on error
        this.isInitialized = false;
      });

      this.redis.on('close', () => {
        logger.warn('[RedisCache] Redis connection closed');
        this.isInitialized = false;
      });

      this.redis.on('end', () => {
        logger.warn('[RedisCache] Redis connection ended');
        this.isInitialized = false;
        this.redis = null;
      });

      // Connect with timeout
      try {
        await Promise.race([
          this.redis.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
          ),
        ]);
        this.isInitialized = true;
        logger.info('[RedisCache] Redis cache service initialized');
      } catch (connectError) {
        logger.error('[RedisCache] Failed to connect to Redis', { 
          error: connectError instanceof Error ? connectError.message : String(connectError),
        });
        this.redis = null;
        this.isInitialized = false;
      }
    } catch (error) {
      logger.error('[RedisCache] Failed to initialize Redis', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.redis = null;
      this.isInitialized = false;
    }
  }

  /**
   * Ensure Redis is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Get a value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('[RedisCache] Error getting key', { key, error });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error setting key', { key, error });
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  public async delete(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error deleting key', { key, error });
      return false;
    }
  }

  /**
   * Delete keys matching a pattern
   */
  public async deleteByPattern(pattern: string): Promise<number> {
    await this.ensureInitialized();
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('[RedisCache] Error deleting by pattern', { pattern, error });
      return 0;
    }
  }

  /**
   * Add member to sorted set (for leaderboards)
   */
  public async zAdd(key: string, score: number, member: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      await this.redis.zadd(key, score, member);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error adding to sorted set', { key, error });
      return false;
    }
  }

  /**
   * Add multiple members to sorted set
   */
  public async zAddMultiple(
    key: string,
    members: Array<{ score: number; member: string }>
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    // Validate that we have members to add
    if (!members || members.length === 0) {
      logger.warn('[RedisCache] No members provided to addMultipleToSortedSet', { key });
      return false;
    }

    const args: (string | number)[] = [];
    for (const { score, member } of members) {
      args.push(score, member);
    }

    try {
      await this.redis.zadd(key, ...args);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error adding multiple to sorted set', { 
        key, 
        membersCount: members.length,
        error: error instanceof Error ? error.message : String(error),
        command: {
          name: 'zadd',
          args: [key, ...args.slice(0, 4)], // Log first 2 members for debugging
        }
      });
      return false;
    }
  }

  /**
   * Get range from sorted set (for leaderboard queries)
   */
  public async zRange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<string[]> {
    await this.ensureInitialized();
    if (!this.redis) return [];

    try {
      if (withScores) {
        return await this.redis.zrange(key, start, stop, 'WITHSCORES');
      }
      return await this.redis.zrange(key, start, stop);
    } catch (error) {
      logger.error('[RedisCache] Error getting range from sorted set', { key, error });
      return [];
    }
  }

  /**
   * Get reverse range from sorted set (highest scores first)
   */
  public async zRevRange(
    key: string,
    start: number,
    stop: number,
    withScores = false
  ): Promise<string[]> {
    await this.ensureInitialized();
    if (!this.redis) return [];

    try {
      if (withScores) {
        return await this.redis.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await this.redis.zrevrange(key, start, stop);
    } catch (error) {
      logger.error('[RedisCache] Error getting reverse range from sorted set', { key, error });
      return [];
    }
  }

  /**
   * Get rank of member in sorted set (0-based)
   */
  public async zRank(key: string, member: string): Promise<number | null> {
    await this.ensureInitialized();
    if (!this.redis) return null;

    try {
      const rank = await this.redis.zrank(key, member);
      return rank !== null ? rank : null;
    } catch (error) {
      logger.error('[RedisCache] Error getting rank', { key, member, error });
      return null;
    }
  }

  /**
   * Get reverse rank of member (highest score = rank 0)
   */
  public async zRevRank(key: string, member: string): Promise<number | null> {
    await this.ensureInitialized();
    if (!this.redis) return null;

    try {
      const rank = await this.redis.zrevrank(key, member);
      return rank !== null ? rank : null;
    } catch (error) {
      logger.error('[RedisCache] Error getting reverse rank', { key, member, error });
      return null;
    }
  }

  /**
   * Get score of member in sorted set
   */
  public async zScore(key: string, member: string): Promise<number | null> {
    await this.ensureInitialized();
    if (!this.redis) return null;

    try {
      const score = await this.redis.zscore(key, member);
      return score !== null ? parseFloat(score) : null;
    } catch (error) {
      logger.error('[RedisCache] Error getting score', { key, member, error });
      return null;
    }
  }

  /**
   * Get count of members in sorted set
   */
  public async zCard(key: string): Promise<number> {
    await this.ensureInitialized();
    if (!this.redis) return 0;

    try {
      return await this.redis.zcard(key);
    } catch (error) {
      logger.error('[RedisCache] Error getting card count', { key, error });
      return 0;
    }
  }

  /**
   * Remove sorted set
   */
  public async zRem(key: string, ...members: string[]): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      await this.redis.zrem(key, ...members);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error removing from sorted set', { key, error });
      return false;
    }
  }

  /**
   * Delete sorted set entirely
   */
  public async zDelete(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error deleting sorted set', { key, error });
      return false;
    }
  }

  /**
   * Set expiration on key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      await this.redis.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error('[RedisCache] Error setting expiration', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('[RedisCache] Error checking existence', { key, error });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<RedisCacheStats> {
    await this.ensureInitialized();
    if (!this.redis) {
      return {
        connected: false,
        keys: 0,
        memory: 'N/A',
      };
    }

    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      const dbSize = await this.redis.dbsize();

      return {
        connected: this.redis.status === 'ready',
        keys: dbSize,
        memory,
      };
    } catch (error) {
      logger.error('[RedisCache] Error getting stats', { error });
      return {
        connected: false,
        keys: 0,
        memory: 'N/A',
      };
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: 'up' | 'down'; message: string }> {
    await this.ensureInitialized();
    if (!this.redis) {
      return {
        status: 'down',
        message: 'Redis not initialized or disabled',
      };
    }

    try {
      await this.redis.ping();
      return {
        status: 'up',
        message: 'Redis is healthy',
      };
    } catch (error) {
      return {
        status: 'down',
        message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isInitialized = false;
      logger.info('[RedisCache] Redis connection closed');
    }
  }
}

// Export singleton instance
export const redisCacheService = RedisCacheService.getInstance();
export default redisCacheService;

