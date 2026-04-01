import { CacheService } from '../../src/services/cache-service';
import { SecurityConfigurationService } from '../../src/security/config';

// Mock ioredis
const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisExists = jest.fn();
const mockRedisKeys = jest.fn();
const mockRedisDisconnect = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    del: mockRedisDel,
    exists: mockRedisExists,
    keys: mockRedisKeys,
    disconnect: mockRedisDisconnect,
    on: jest.fn(),
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
      });
      expect(customCache).toBeDefined();
      customCache.shutdown();
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      mockRedisGet.mockResolvedValue(null);

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
        })
      );

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
        })
      );

      const result = await cacheService.get('redis-key');

      expect(result).toEqual(testData);
      expect(mockRedisGet).toHaveBeenCalledWith('cache:redis-key');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection failed'));

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
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(expiredEntry));

      const result = await cacheService.get('expired-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store data in memory and Redis', async () => {
      mockRedisSetex.mockResolvedValue('OK');
      const testData = { id: 1, name: 'test' };

      await cacheService.set('test-key', testData, 600);

      expect(mockRedisSetex).toHaveBeenCalledWith(
        'cache:test-key',
        600,
        expect.stringContaining('"data"')
      );
    });

    it('should use default TTL when not specified', async () => {
      mockRedisSetex.mockResolvedValue('OK');

      await cacheService.set('default-ttl-key', { value: 123 });

      expect(mockRedisSetex).toHaveBeenCalledWith(
        'cache:default-ttl-key',
        300, // default TTL
        expect.any(String)
      );
    });

    it('should handle Redis set errors', async () => {
      mockRedisSetex.mockRejectedValue(new Error('Redis write failed'));

      await cacheService.set('error-key', { value: 123 });

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_SET_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete from memory and Redis', async () => {
      mockRedisDel.mockResolvedValue(1);

      // First set a value
      await cacheService.set('delete-key', { value: 123 });

      // Then delete it
      await cacheService.delete('delete-key');

      expect(mockRedisDel).toHaveBeenCalledWith('cache:delete-key');
    });

    it('should handle Redis delete errors', async () => {
      mockRedisDel.mockRejectedValue(new Error('Redis delete failed'));

      await cacheService.delete('error-key');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_DELETE_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
    });
  });

  describe('exists', () => {
    it('should return true for key in memory cache', async () => {
      // First set a value
      await cacheService.set('exists-key', { value: 123 });

      const result = await cacheService.exists('exists-key');

      expect(result).toBe(true);
    });

    it('should return true for key in Redis', async () => {
      mockRedisExists.mockResolvedValue(1);

      const result = await cacheService.exists('redis-exists-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockRedisExists.mockResolvedValue(0);

      const result = await cacheService.exists('nonexistent-key');

      expect(result).toBe(false);
    });

    it('should handle Redis exists errors', async () => {
      mockRedisExists.mockRejectedValue(new Error('Redis exists failed'));

      const result = await cacheService.exists('error-key');

      expect(result).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entries matching pattern', async () => {
      mockRedisKeys.mockResolvedValue(['cache:test-1', 'cache:test-2']);
      mockRedisDel.mockResolvedValue(2);

      // Set some values
      await cacheService.set('test-1', { value: 1 });
      await cacheService.set('test-2', { value: 2 });
      await cacheService.set('other-key', { value: 3 });

      await cacheService.invalidate('test');

      expect(mockRedisKeys).toHaveBeenCalledWith('cache:test*');
    });

    it('should handle Redis invalidate errors', async () => {
      mockRedisKeys.mockRejectedValue(new Error('Redis keys failed'));

      await cacheService.invalidate('pattern');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_INVALIDATE_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
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
      });
    });

    it('should return a copy of stats', () => {
      const stats1 = cacheService.getStats();
      const stats2 = cacheService.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('warmCache', () => {
    it('should warm cache with provided data', async () => {
      mockRedisSetex.mockResolvedValue('OK');

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
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      mockRedisKeys.mockResolvedValue(['cache:key1', 'cache:key2']);
      mockRedisDel.mockResolvedValue(2);

      await cacheService.clear();

      expect(mockRedisKeys).toHaveBeenCalledWith('cache:*');
    });

    it('should handle Redis clear errors', async () => {
      mockRedisKeys.mockRejectedValue(new Error('Redis keys failed'));

      await cacheService.clear();

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CACHE_CLEAR_FAILED',
          resource: 'CACHE_SERVICE',
        })
      );
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
    it('should evict least used entries when memory limit is reached', async () => {
      // Create cache with small memory limit
      const smallCache = new CacheService(mockConfig, {
        memoryLimit: 3,
      });

      mockRedisSetex.mockResolvedValue('OK');

      // Fill cache to limit
      await smallCache.set('key1', { value: 1 });
      await smallCache.set('key2', { value: 2 });
      await smallCache.set('key3', { value: 3 });

      // Access key1 and key3 to make key2 least used
      await smallCache.get('key1');
      await smallCache.get('key3');

      // Adding key4 should evict key2
      await smallCache.set('key4', { value: 4 });

      const result = await smallCache.get('key2');
      expect(result).toBeNull();

      await smallCache.shutdown();
    });
  });

  describe('cleanup job', () => {
    it('should cleanup expired entries', async () => {
      mockRedisSetex.mockResolvedValue('OK');

      // Set a value with very short TTL
      await cacheService.set('short-ttl-key', { value: 123 }, 1);

      // Wait for entry to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup by calling get (which checks validity)
      const result = await cacheService.get('short-ttl-key');
      expect(result).toBeNull();
    });
  });
});
