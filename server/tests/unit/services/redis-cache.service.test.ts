/**
 * Redis Cache Service Unit Tests
 */

import { jest } from '@jest/globals';

// Mock ioredis before importing service
const mockRedisInstance = {
  get: jest.fn<() => Promise<string | null>>(),
  set: jest.fn<() => Promise<string>>(),
  setex: jest.fn<() => Promise<string>>(),
  del: jest.fn<() => Promise<number>>(),
  keys: jest.fn<() => Promise<string[]>>(),
  zadd: jest.fn<() => Promise<number>>(),
  zrange: jest.fn<() => Promise<string[]>>(),
  zrevrange: jest.fn<() => Promise<string[]>>(),
  zrank: jest.fn<() => Promise<number | null>>(),
  zrevrank: jest.fn<() => Promise<number | null>>(),
  zscore: jest.fn<() => Promise<string | null>>(),
  zcard: jest.fn<() => Promise<number>>(),
  zrem: jest.fn<() => Promise<number>>(),
  expire: jest.fn<() => Promise<number>>(),
  exists: jest.fn<() => Promise<number>>(),
  ping: jest.fn<() => Promise<string>>(),
  info: jest.fn<() => Promise<string>>(),
  dbsize: jest.fn<() => Promise<number>>(),
  quit: jest.fn<() => Promise<string>>(),
  connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  status: 'ready',
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance),
}));

jest.mock('../../../src/config/env.config.js', () => ({
  env: {
    redis: {
      enabled: true,
      host: 'localhost',
      port: 6379,
      password: undefined,
      url: undefined,
    },
  },
}));

jest.mock('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// The service is a singleton - import the exported instance
import { redisCacheService } from '../../../src/services/redis-cache.service.js';

describe('RedisCacheService', () => {
  let service: typeof redisCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock return values
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.set.mockResolvedValue('OK');
    mockRedisInstance.setex.mockResolvedValue('OK');
    mockRedisInstance.del.mockResolvedValue(1);
    mockRedisInstance.zadd.mockResolvedValue(1);
    mockRedisInstance.zrevrange.mockResolvedValue([]);
    mockRedisInstance.zrevrank.mockResolvedValue(null);
    mockRedisInstance.zscore.mockResolvedValue(null);
    mockRedisInstance.zcard.mockResolvedValue(0);
    mockRedisInstance.zrem.mockResolvedValue(1);
    mockRedisInstance.expire.mockResolvedValue(1);
    mockRedisInstance.exists.mockResolvedValue(0);
    mockRedisInstance.ping.mockResolvedValue('PONG');
    mockRedisInstance.keys.mockResolvedValue([]);
    mockRedisInstance.connect.mockResolvedValue(undefined);

    // Inject mock Redis client directly into the singleton
    service = redisCacheService;
    (service as any).redis = mockRedisInstance;
    (service as any).isInitialized = true;
  });

  describe('get', () => {
    it('should JSON.parse stored value on get', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ name: 'test' }));

      const result = await service.get<{ name: string }>('test-key');

      expect(result).toEqual({ name: 'test' });
    });

    it('should return null when key not found', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null on get error (graceful degradation)', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should JSON.stringify value on set', async () => {
      await service.set('test-key', { data: 'value' });

      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', '{"data":"value"}');
    });

    it('should use setex when ttlSeconds provided', async () => {
      await service.set('ttl-key', 'value', 300);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('ttl-key', 300, '"value"');
    });

    it('should return false on set error', async () => {
      mockRedisInstance.set.mockRejectedValueOnce(new Error('Write error'));

      const result = await service.set('error-key', 'value');

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should call redis del', async () => {
      await service.delete('test-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false on error', async () => {
      mockRedisInstance.del.mockRejectedValueOnce(new Error('Del error'));

      const result = await service.delete('error-key');

      expect(result).toBe(false);
    });
  });

  describe('sorted set operations (leaderboard)', () => {
    it('should call zadd with score and member', async () => {
      await service.zAdd('lb:global', 95.5, 'user-1');

      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('lb:global', 95.5, 'user-1');
    });

    it('should call zadd with multiple score/member pairs', async () => {
      const members = [
        { score: 95, member: 'u1' },
        { score: 85, member: 'u2' },
      ];

      await service.zAddMultiple('lb:global', members);

      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('lb:global', 95, 'u1', 85, 'u2');
    });

    it('should return false when members array is empty for zAddMultiple', async () => {
      const result = await service.zAddMultiple('lb:global', []);

      expect(result).toBe(false);
      expect(mockRedisInstance.zadd).not.toHaveBeenCalled();
    });

    it('should call zrevrange with WITHSCORES when requested', async () => {
      mockRedisInstance.zrevrange.mockResolvedValueOnce(['u1', '95', 'u2', '85']);

      const result = await service.zRevRange('lb:global', 0, 9, true);

      expect(mockRedisInstance.zrevrange).toHaveBeenCalledWith('lb:global', 0, 9, 'WITHSCORES');
      expect(result).toEqual(['u1', '95', 'u2', '85']);
    });

    it('should call zrevrange without WITHSCORES when not requested', async () => {
      mockRedisInstance.zrevrange.mockResolvedValueOnce(['u1', 'u2']);

      await service.zRevRange('lb:global', 0, 9, false);

      expect(mockRedisInstance.zrevrange).toHaveBeenCalledWith('lb:global', 0, 9);
    });

    it('should return reverse rank from zRevRank', async () => {
      mockRedisInstance.zrevrank.mockResolvedValueOnce(4);

      const rank = await service.zRevRank('lb:global', 'u1');

      expect(rank).toBe(4);
    });

    it('should return null from zRevRank when member not found', async () => {
      mockRedisInstance.zrevrank.mockResolvedValueOnce(null);

      const rank = await service.zRevRank('lb:global', 'missing');

      expect(rank).toBeNull();
    });

    it('should parse float from zScore', async () => {
      mockRedisInstance.zscore.mockResolvedValueOnce('85.5');

      const score = await service.zScore('lb:global', 'u1');

      expect(score).toBe(85.5);
    });

    it('should return null from zScore when member not found', async () => {
      mockRedisInstance.zscore.mockResolvedValueOnce(null);

      const score = await service.zScore('lb:global', 'missing');

      expect(score).toBeNull();
    });

    it('should return count from zCard', async () => {
      mockRedisInstance.zcard.mockResolvedValueOnce(42);

      const count = await service.zCard('lb:global');

      expect(count).toBe(42);
    });
  });

  describe('expire', () => {
    it('should set expiration on key', async () => {
      await service.expire('test-key', 3600);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('test-key', 3600);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisInstance.exists.mockResolvedValueOnce(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisInstance.exists.mockResolvedValueOnce(0);

      const result = await service.exists('missing-key');

      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return up when Redis responds to ping', async () => {
      mockRedisInstance.ping.mockResolvedValueOnce('PONG');

      const health = await service.healthCheck();

      expect(health.status).toBe('up');
      expect(health.message).toBe('Redis is healthy');
    });

    it('should return down when Redis fails to respond', async () => {
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Connection refused'));

      const health = await service.healthCheck();

      expect(health.status).toBe('down');
      expect(health.message).toContain('Connection refused');
    });
  });

  describe('deleteByPattern', () => {
    it('should delete all keys matching pattern', async () => {
      mockRedisInstance.keys.mockResolvedValueOnce(['lb:global:2026-02-15', 'lb:global:2026-02-16']);

      const count = await service.deleteByPattern('lb:global:*');

      expect(count).toBe(2);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('lb:global:2026-02-15', 'lb:global:2026-02-16');
    });

    it('should return 0 when no keys match pattern', async () => {
      mockRedisInstance.keys.mockResolvedValueOnce([]);

      const count = await service.deleteByPattern('nonexistent:*');

      expect(count).toBe(0);
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });
});
