/**
 * Cache Service Unit Tests
 */

import { cache as cacheService } from '../../../src/services/cache.service.js';

describe('CacheService', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.flush();
  });

  describe('set and get', () => {
    it('should set and retrieve a string value', () => {
      const key = 'test-key';
      const value = 'test-value';

      cacheService.set(key, value);
      const result = cacheService.get<string>(key);

      expect(result).toBe(value);
    });

    it('should set and retrieve an object value', () => {
      const key = 'user-data';
      const value = { id: 1, name: 'John', email: 'john@example.com' };

      cacheService.set(key, value);
      const result = cacheService.get<typeof value>(key);

      expect(result).toEqual(value);
    });

    it('should return undefined for non-existent key', () => {
      const result = cacheService.get<string>('non-existent-key');
      expect(result).toBeUndefined();
    });

    it('should set value with TTL', () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 1; // 1 second

      cacheService.set(key, value, ttl);
      const result = cacheService.get<string>(key);

      expect(result).toBe(value);
    });
  });

  describe('delete', () => {
    it('should delete an existing key', () => {
      const key = 'delete-me';
      cacheService.set(key, 'value');

      expect(cacheService.get<string>(key)).toBe('value');

      const deleted = cacheService.delete(key);
      expect(deleted).toBe(1);
      expect(cacheService.get<string>(key)).toBeUndefined();
    });

    it('should return 0 when deleting non-existent key', () => {
      const deleted = cacheService.delete('non-existent');
      expect(deleted).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cacheService.set('exists', 'value');
      expect(cacheService.has('exists')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cacheService.has('does-not-exist')).toBe(false);
    });
  });

  describe('flush', () => {
    it('should clear all cached values', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      cacheService.flush();

      expect(cacheService.get<string>('key1')).toBeUndefined();
      expect(cacheService.get<string>('key2')).toBeUndefined();
      expect(cacheService.get<string>('key3')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheService.flush();
      cacheService.set('stat-key', 'stat-value');

      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats.keys).toBeGreaterThanOrEqual(1);
    });
  });

  describe('mget and mset', () => {
    it('should set and get multiple values', () => {
      const data: Array<{ key: string; val: string }> = [
        { key: 'multi1', val: 'value1' },
        { key: 'multi2', val: 'value2' },
        { key: 'multi3', val: 'value3' },
      ];

      cacheService.mset(data);

      const result = cacheService.mget<string>(['multi1', 'multi2', 'multi3']);

      expect(result['multi1']).toBe('value1');
      expect(result['multi2']).toBe('value2');
      expect(result['multi3']).toBe('value3');
    });

    it('should return undefined for missing keys in mget', () => {
      cacheService.set('exists', 'value');

      const result = cacheService.mget<string>(['exists', 'missing']);

      expect(result['exists']).toBe('value');
      expect(result['missing']).toBeUndefined();
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      cacheService.flush();
      cacheService.set('key-a', 'value');
      cacheService.set('key-b', 'value');

      const keys = cacheService.keys();

      expect(keys).toContain('key-a');
      expect(keys).toContain('key-b');
      expect(keys.length).toBe(2);
    });
  });
});
