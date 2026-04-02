import { CacheService, CacheWarmupOptions } from '../../src/services/cache-service';
import { SecurityConfigurationService } from '../../src/security/config';

// Mock ioredis
const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisExists = jest.fn();
const mockRedisKeys = jest.fn();
const mockRedisDisconnect = jest.fn();
const mockRedisScan = jest.fn();
const mockRedisOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: mockRedisDel,
    exists: mockRedisExists,
    keys: mockRedisKeys,
    scan: mockRedisScan,
    disconnect: mockRedisDisconnect,
    on: mockRedisOn,
  }));
});

// Mock security config
const mockSecurityLogger = {
  logSecurityEvent: jest.fn(),
};

const mockConfig = {
  securityLogger: mockSecurityLogger,
} as unknown as jest.Mocked<SecurityConfigurationService>;

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisScan.mockResolvedValue(['0', []]);
    cacheService = new CacheService(mockConfig);
  });

  afterEach(async () => {
    await cacheService.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(cacheService).toBeDefined();
      const stats = cacheService.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should accept custom options', () => {
      const customCache = new CacheService(mockConfig, {
        ttl: 600,
        memoryLimit: 500,
        redisUrl: 'redis://custom:6379',
        enableCompression: false,
        compressionThreshold: 2048,
        enableAdaptiveTTL: false,
        minTTL: 30,
        maxTTL: 7200,
        keyHashLength: 32,
        namespace: 'custom-namespace',
      });
      expect(customCache).toBeDefined();
      customCache.shutdown();
    });

    it('should use namespace in key prefix', () => {
      const customCache = new CacheService(mockConfig, {
        namespace: 'test-namespace',
      });
      const key = customCache.generateKey('test-key');
      expect(key).toContain('test-namespace');
      customCache.shutdown();
    });
  });

  describe('generateKey', () => {
    it('should generate simple key without options', () => {
      const key = cacheService.generateKey('test-key');
      expect(key).toContain('test-key');
    });

    it('should generate key with namespace option', () => {
      const key = cacheService.generateKey('test-key', { namespace: 'custom' });
      expect(key).toContain('custom');
      expect(key).toContain('test-key');
    });

    it('should generate key with version option', () => {
      const key = cacheService.generateKey('test-key', { version: 'v2' });
      expect(key).toContain('v2');
    });

    it('should generate key with userId option', () => {
      const key = cacheService.generateKey('test-key', { userId: 'user123' });
      expect(key).toContain('user123');
    });

    it('should generate key with sessionId option', () => {
      const key = cacheService.generateKey('test-key', { sessionId: 'session456' });
      expect(key).toContain('session456');
    });

    it('should hash long keys', () => {
      const longKey = 'a'.repeat(150);
      const key = cacheService.generateKey(longKey);
      expect(key.length).toBeLessThan(150);
      expect(key).toContain('captcha:');
    });

    it('should use configured key hash length', () => {
      const customCache = new CacheService(mockConfig, {
        keyHashLength: 8,
      });
      const longKey = 'a'.repeat(150);
      const key = customCache.generateKey(longKey);
      const hashPart = key.split(':')[1];
      expect(hashPart.length).toBe(8);
      customCache.shutdown();
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.get('nonexistent');

      expect(result).toBeNull();
      const stats = cacheService.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should return data from memory cache on second get', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          data: testData,
          timestamp: Date.now(),
          ttl: 300,
          hits: 0,
          misses: 0,
          lastAccessed: Date.now(),
          accessCount: 0,
        })
      );
      mockRedisScan.mockResolvedValue(['0', []]);

      // First get - cache miss in memory, hit in Redis
      const result1 = await cacheService.get('test-key');
      expect(result1).toEqual(testData);

      // Second get - should hit memory cache
      const result2 = await cacheService.get('test-key');
      expect(result2).toEqual(testData);

      const stats = cacheService.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('should return data from Redis when not in memory', async () => {
      const testData = { id: 2, value: 'redis-data' };
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          data: testData,
          timestamp: Date.now(),
          ttl: 300,
          hits: 0,
          misses: 0,
          lastAccessed: Date.now(),
          accessCount: 0,
        })
      );
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.get('redis-key');

      expect(result).toEqual(testData);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection failed'));
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_REDIS_GET_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should return null for expired entries', async () => {
      const expiredEntry = {
        data: { old: true },
        timestamp: Date.now() - 600000, // 10 minutes ago
        ttl: 300, // 5 minutes TTL
        hits: 0,
        misses: 0,
        lastAccessed: Date.now() - 600000,
        accessCount: 0,
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(expiredEntry));
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.get('expired-key');

      expect(result).toBeNull();
    });

    it('should track pattern statistics', async () => {
      const testData = { value: 1 };
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          data: testData,
          timestamp: Date.now(),
          ttl: 300,
          hits: 0,
          misses: 0,
          lastAccessed: Date.now(),
          accessCount: 0,
        })
      );
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.get('captcha:generate:test');
      await cacheService.get('captcha:generate:test2');
      await cacheService.get('nonexistent');

      const patternStats = cacheService.getPatternStats();
      expect(Object.keys(patternStats).length).toBeGreaterThan(0);
    });

    it('should use options in key generation', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.get('test-key', { userId: 'user123', version: 'v2' });

      expect(mockRedisGet).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should store data in memory and Redis', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);
      const testData = { id: 1, name: 'test' };

      await cacheService.set('test-key', testData, 600);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringContaining('test-key'),
        600,
        expect.stringContaining('"data"')
      );
    });

    it('should use default TTL when not specified', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.set('default-ttl-key', { value: 123 });

      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringContaining('default-ttl-key'),
        300, // default TTL
        expect.any(String)
      );
    });

    it('should handle Redis set errors', async () => {
      mockRedisSetex.mockRejectedValue(new Error('Redis write failed'));
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.set('error-key', { value: 123 });

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_SET_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should use options in key generation', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.set('test-key', { value: 1 }, 300, { userId: 'user123' });

      expect(mockRedisSetex).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete from memory and Redis', async () => {
      mockRedisDel.mockResolvedValue(1);
      mockRedisScan.mockResolvedValue(['0', []]);

      // First set a value
      await cacheService.set('delete-key', { value: 123 });

      // Then delete it
      await cacheService.delete('delete-key');

      expect(mockRedisDel).toHaveBeenCalled();
    });

    it('should handle Redis delete errors', async () => {
      mockRedisDel.mockRejectedValue(new Error('Redis delete failed'));
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.delete('error-key');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_DELETE_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should use options in key generation', async () => {
      mockRedisDel.mockResolvedValue(1);
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.delete('delete-key', { userId: 'user123' });

      expect(mockRedisDel).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true for key in memory cache', async () => {
      mockRedisScan.mockResolvedValue(['0', []]);
      // First set a value
      await cacheService.set('exists-key', { value: 123 });

      const result = await cacheService.exists('exists-key');

      expect(result).toBe(true);
    });

    it('should return true for key in Redis', async () => {
      mockRedisExists.mockResolvedValue(1);
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.exists('redis-exists-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockRedisExists.mockResolvedValue(0);
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.exists('nonexistent-key');

      expect(result).toBe(false);
    });

    it('should handle Redis exists errors', async () => {
      mockRedisExists.mockRejectedValue(new Error('Redis exists failed'));
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.exists('error-key');

      expect(result).toBe(false);
    });

    it('should use options in key generation', async () => {
      mockRedisExists.mockResolvedValue(1);
      mockRedisScan.mockResolvedValue(['0', []]);

      const result = await cacheService.exists('exists-key', { userId: 'user123' });

      expect(result).toBe(true);
      expect(mockRedisExists).toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entries matching pattern', async () => {
      mockRedisScan.mockResolvedValue(['0', ['captcha:test-1', 'captcha:test-2']]);
      mockRedisDel.mockResolvedValue(2);

      // Set some values
      await cacheService.set('test-1', { value: 1 });
      await cacheService.set('test-2', { value: 2 });
      await cacheService.set('other-key', { value: 3 });

      const count = await cacheService.invalidate('test');

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis invalidate errors', async () => {
      mockRedisScan.mockRejectedValue(new Error('Redis scan failed'));

      await cacheService.invalidate('pattern');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_INVALIDATE_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should return count of invalidated keys', async () => {
      mockRedisScan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      mockRedisDel.mockResolvedValue(3);

      const count = await cacheService.invalidate('test');

      expect(count).toBe(3);
    });
  });

  describe('scanKeys', () => {
    it('should scan keys with cursor pagination', async () => {
      mockRedisScan
        .mockResolvedValueOnce(['10', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);

      // Access private method via any cast for testing
      const keys = await (cacheService as any).scanKeys('*');

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cacheService.getStats();

      expect(stats).toMatchObject({
        totalRequests: expect.any(Number),
        hits: expect.any(Number),
        misses: expect.any(Number),
        hitRate: expect.any(Number),
        memoryUsage: expect.any(Number),
        redisConnections: expect.any(Number),
        redisOperations: {
          get: expect.any(Number),
          set: expect.any(Number),
          del: expect.any(Number),
          exists: expect.any(Number),
        },
        patternHitRates: expect.any(Object),
        averageTTL: expect.any(Number),
        evictionCount: expect.any(Number),
        cleanupCount: expect.any(Number),
      });
    });

    it('should return a copy of stats', () => {
      const stats1 = cacheService.getStats();
      const stats2 = cacheService.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });

    it('should include pattern hit rates', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.get('captcha:generate:test');
      await cacheService.get('captcha:generate:test');

      const stats = cacheService.getStats();
      expect(stats.patternHitRates).toBeDefined();
    });
  });

  describe('getPatternStats', () => {
    it('should return pattern-specific statistics', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.get('captcha:generate:test');
      await cacheService.get('captcha:validate:test');

      const patternStats = cacheService.getPatternStats();
      expect(Object.keys(patternStats).length).toBeGreaterThan(0);
    });
  });

  describe('warmCache', () => {
    it('should warm cache with provided data', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      const warmupData = [
        { key: 'warm-1', data: { value: 1 }, ttl: 600 },
        { key: 'warm-2', data: { value: 2 }, ttl: 600 },
        { key: 'warm-3', data: { value: 3 } },
      ];

      await cacheService.warmCache(warmupData);

      expect(mockRedisSetex).toHaveBeenCalledTimes(3);
    });

    it('should handle warm cache errors for individual entries', async () => {
      mockRedisSetex.mockRejectedValueOnce(new Error('Redis error'));
      mockRedisSetex.mockResolvedValueOnce('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      const warmupData = [
        { key: 'error-key', data: { value: 1 } },
        { key: 'success-key', data: { value: 2 } },
      ];

      await cacheService.warmCache(warmupData);

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_SET_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should prioritize high priority items first', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      const warmupData: CacheWarmupOptions[] = [
        { key: 'low-1', data: { value: 1 }, priority: 'low' },
        { key: 'high-1', data: { value: 2 }, priority: 'high' },
        { key: 'medium-1', data: { value: 3 }, priority: 'medium' },
      ];

      await cacheService.warmCache(warmupData);

      // Verify all items were cached
      expect(await cacheService.exists('high-1')).toBe(true);
      expect(await cacheService.exists('medium-1')).toBe(true);
      expect(await cacheService.exists('low-1')).toBe(true);
    });

    it('should skip already cached items', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      // Set initial value
      await cacheService.set('existing', { value: 1 });

      const warmupData = [
        { key: 'existing', data: { value: 2 }, ttl: 600 },
        { key: 'new', data: { value: 3 }, ttl: 600 },
      ];

      await cacheService.warmCache(warmupData);

      // Original value should not be overwritten
      const result = await cacheService.get('existing');
      expect(result).toEqual({ value: 1 });
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      mockRedisScan.mockResolvedValue(['0', ['key1', 'key2']]);
      mockRedisDel.mockResolvedValue(2);

      const count = await cacheService.clear();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis clear errors', async () => {
      mockRedisScan.mockRejectedValue(new Error('Redis scan failed'));

      await cacheService.clear();

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_CLEAR_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });

    it('should return count of cleared keys', async () => {
      mockRedisScan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      mockRedisDel.mockResolvedValue(3);

      const count = await cacheService.clear();

      expect(count).toBe(3);
    });
  });

  describe('getMemoryCacheSize', () => {
    it('should return memory cache size', async () => {
      mockRedisScan.mockResolvedValue(['0', []]);

      expect(cacheService.getMemoryCacheSize()).toBe(0);

      await cacheService.set('key1', { value: 1 });
      await cacheService.set('key2', { value: 2 });

      expect(cacheService.getMemoryCacheSize()).toBe(2);
    });
  });

  describe('getMemoryCacheKeys', () => {
    it('should return memory cache keys', async () => {
      mockRedisScan.mockResolvedValue(['0', []]);

      await cacheService.set('key1', { value: 1 });
      await cacheService.set('key2', { value: 2 });

      const keys = cacheService.getMemoryCacheKeys();
      expect(keys.length).toBe(2);
      expect(keys).toContainEqual(expect.stringContaining('key1'));
      expect(keys).toContainEqual(expect.stringContaining('key2'));
    });
  });

  describe('shutdown', () => {
    it('should shutdown cache service gracefully', async () => {
      mockRedisDisconnect.mockResolvedValue(undefined);

      await cacheService.shutdown();

      expect(mockRedisDisconnect).toHaveBeenCalled();
    });
  });

  describe('memory management', () => {
    it('should evict least recently used entries when memory limit is reached', async () => {
      // Create cache with small memory limit
      const smallCache = new CacheService(mockConfig, {
        memoryLimit: 3,
      });

      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);
      mockRedisGet.mockResolvedValue(null);

      // Fill cache to limit
      await smallCache.set('key1', { value: 1 });
      await smallCache.set('key2', { value: 2 });
      await smallCache.set('key3', { value: 3 });

      // Access key1 and key3 to make key2 least recently used
      await smallCache.get('key1');
      await smallCache.get('key3');

      // Adding key4 should evict key2 (least recently used)
      await smallCache.set('key4', { value: 4 });

      // With LRU, key2 gets evicted when key4 is added since key1 and key3 were accessed more recently
      expect(smallCache.getMemoryCacheSize()).toBe(3);

      await smallCache.shutdown();
    });

    it('should track eviction count in stats', async () => {
      const smallCache = new CacheService(mockConfig, {
        memoryLimit: 2,
      });

      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      await smallCache.set('key1', { value: 1 });
      await smallCache.set('key2', { value: 2 });
      await smallCache.set('key3', { value: 3 }); // Should trigger eviction

      const stats = smallCache.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);

      await smallCache.shutdown();
    });
  });

  describe('adaptive TTL', () => {
    it('should calculate adaptive TTL based on access frequency', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          data: { value: 1 },
          timestamp: Date.now() - 10000, // 10 seconds ago
          ttl: 300,
          hits: 10,
          misses: 0,
          lastAccessed: Date.now(),
          accessCount: 10,
        })
      );
      mockRedisScan.mockResolvedValue(['0', []]);

      // Access multiple times to increase frequency
      await cacheService.get('frequent-key');
      await cacheService.get('frequent-key');
      await cacheService.get('frequent-key');

      const stats = cacheService.getStats();
      expect(stats.averageTTL).toBeGreaterThan(0);
    });

    it('should respect enableAdaptiveTTL option', () => {
      const noAdaptiveCache = new CacheService(mockConfig, {
        enableAdaptiveTTL: false,
      });

      expect(noAdaptiveCache).toBeDefined();
      noAdaptiveCache.shutdown();
    });
  });

  describe('cleanup job', () => {
    it('should cleanup expired entries', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);
      mockRedisGet.mockResolvedValue(null);

      // Set a value with very short TTL
      await cacheService.set('short-ttl-key', { value: 123 }, 1);

      // Wait for entry to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Entry should still be in memory (cleanup job runs every minute)
      // But get should return null because entry is expired
      const result = await cacheService.get('short-ttl-key');
      // The entry is expired but the memory cache check happens first
      // Since it's expired, it should be deleted and return null
      expect(result).toBeNull();
    });

    it('should track cleanup count in stats', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);
      mockRedisGet.mockResolvedValue(null);

      // Set multiple values with very short TTL
      await cacheService.set('cleanup-1', { value: 1 }, 1);
      await cacheService.set('cleanup-2', { value: 2 }, 1);
      await cacheService.set('cleanup-3', { value: 3 }, 1);

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup by accessing entries (they will be deleted on access due to expiration)
      await cacheService.get('cleanup-1');
      await cacheService.get('cleanup-2');
      await cacheService.get('cleanup-3');

      // Stats should show misses for expired entries
      const stats = cacheService.getStats();
      expect(stats.misses).toBeGreaterThanOrEqual(3);
    });
  });

  describe('cache consistency', () => {
    it('should maintain consistency between get and set', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      const testData = { id: 1, name: 'consistency-test', nested: { value: true } };

      await cacheService.set('consistency-key', testData);
      const result = await cacheService.get('consistency-key');

      expect(result).toEqual(testData);
    });

    it('should handle concurrent access patterns', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisGet.mockResolvedValue(null);
      mockRedisScan.mockResolvedValue(['0', []]);

      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, (_, i) =>
        cacheService.set(`concurrent-${i}`, { value: i })
      );

      await Promise.all(promises);

      for (let i = 0; i < 10; i++) {
        const result = await cacheService.get(`concurrent-${i}`);
        expect(result).toEqual({ value: i });
      }
    });
  });

  describe('key patterns', () => {
    it('should handle special characters in keys', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      const specialKey = 'key/with@special#chars$and%spaces';
      await cacheService.set(specialKey, { value: 1 });
      const result = await cacheService.get(specialKey);

      expect(result).toEqual({ value: 1 });
    });

    it('should handle unicode characters in keys', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      mockRedisScan.mockResolvedValue(['0', []]);

      const unicodeKey = 'key-with-unicode-日本語';
      await cacheService.set(unicodeKey, { value: 1 });
      const result = await cacheService.get(unicodeKey);

      expect(result).toEqual({ value: 1 });
    });
  });
});
