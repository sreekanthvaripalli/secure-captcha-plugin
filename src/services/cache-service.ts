import Redis from 'ioredis';
import { SecurityConfigurationService } from '../security/config';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  misses: number;
}

export interface CacheStats {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  redisConnections: number;
  redisOperations: {
    get: number;
    set: number;
    del: number;
    exists: number;
  };
}

export interface CacheOptions {
  ttl?: number;
  memoryLimit?: number;
  redisUrl?: string;
  enableCompression?: boolean;
  compressionThreshold?: number;
}

export class CacheService {
  private readonly redis: Redis;
  private readonly config: SecurityConfigurationService;
  private readonly options: Required<CacheOptions>;
  private readonly memoryCache: Map<string, CacheEntry>;
  private readonly stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: SecurityConfigurationService, options: CacheOptions = {}) {
    this.config = config;
    this.options = {
      ttl: 300, // 5 minutes default
      memoryLimit: 1000, // 1000 entries
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      ...options,
    };

    this.memoryCache = new Map();
    this.stats = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      memoryUsage: 0,
      redisConnections: 0,
      redisOperations: {
        get: 0,
        set: 0,
        del: 0,
        exists: 0,
      },
    };

    this.redis = new Redis(this.options.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectionName: 'captcha-cache-service',
    });

    this.startCleanupJob();
  }

  /**
   * Get data from cache (L1: Memory, L2: Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    // L1: Check Memory Cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      memoryEntry.hits++;
      this.updateStats();
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_HIT',
        resource: 'CACHE_SERVICE',
        reason: 'Data retrieved from memory cache',
        metadata: {
          key,
          cacheLevel: 'L1',
          hits: memoryEntry.hits,
        },
      });
      return memoryEntry.data;
    }

    // L2: Check Redis Cache
    try {
      const redisData = await this.getFromRedis(key);
      if (redisData) {
        this.stats.redisOperations.get++;

        // Promote to memory cache
        this.setInMemory(key, redisData.data, redisData.ttl);

        this.config.securityLogger.logSecurityEvent({
          action: 'CACHE_HIT',
          resource: 'CACHE_SERVICE',
          reason: 'Data retrieved from Redis cache',
          metadata: {
            key,
            cacheLevel: 'L2',
            ttl: redisData.ttl,
          },
        });

        return redisData.data as T;
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_REDIS_ERROR',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Unknown Redis error',
        metadata: { key },
      });
    }

    // Cache miss
    this.stats.misses++;
    this.updateStats();

    this.config.securityLogger.logSecurityEvent({
      action: 'CACHE_MISS',
      resource: 'CACHE_SERVICE',
      reason: 'Data not found in cache',
      metadata: { key },
    });

    return null;
  }

  /**
   * Set data in cache (L1: Memory, L2: Redis)
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.options.ttl;

    // L1: Set in Memory Cache
    this.setInMemory(key, data, effectiveTTL);

    // L2: Set in Redis
    try {
      await this.setInRedis(key, data, effectiveTTL);
      this.stats.redisOperations.set++;

      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_SET',
        resource: 'CACHE_SERVICE',
        reason: 'Data stored in cache',
        metadata: {
          key,
          ttl: effectiveTTL,
          dataSize: JSON.stringify(data).length,
        },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_SET_FAILED',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to store in Redis',
        metadata: { key },
      });
    }
  }

  /**
   * Delete data from cache (L1: Memory, L2: Redis)
   */
  async delete(key: string): Promise<void> {
    // L1: Delete from Memory Cache
    this.memoryCache.delete(key);

    // L2: Delete from Redis
    try {
      await this.redis.del(`cache:${key}`);
      this.stats.redisOperations.del++;

      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_DELETE',
        resource: 'CACHE_SERVICE',
        reason: 'Data deleted from cache',
        metadata: { key },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_DELETE_FAILED',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to delete from Redis',
        metadata: { key },
      });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    // L1: Check Memory Cache
    if (this.memoryCache.has(key)) {
      return true;
    }

    // L2: Check Redis Cache
    try {
      const exists = await this.redis.exists(`cache:${key}`);
      this.stats.redisOperations.exists++;

      if (exists) {
        this.config.securityLogger.logSecurityEvent({
          action: 'CACHE_EXISTS',
          resource: 'CACHE_SERVICE',
          reason: 'Key exists in Redis cache',
          metadata: { key },
        });
        return true;
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_EXISTS_ERROR',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to check Redis',
        metadata: { key },
      });
    }

    return false;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    // L1: Clear Memory Cache entries matching pattern
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // L2: Clear Redis Cache entries matching pattern
    try {
      const keys = await this.redis.keys(`cache:${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.stats.redisOperations.del += keys.length;

        this.config.securityLogger.logSecurityEvent({
          action: 'CACHE_INVALIDATE',
          resource: 'CACHE_SERVICE',
          reason: 'Cache entries invalidated by pattern',
          metadata: {
            pattern,
            invalidatedKeys: keys.length,
          },
        });
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_INVALIDATE_FAILED',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to invalidate Redis cache',
        metadata: { pattern },
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Warm cache with initial data
   */
  async warmCache(warmupData: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    for (const { key, data, ttl } of warmupData) {
      try {
        await this.set(key, data, ttl);
      } catch (error) {
        this.config.securityLogger.logSecurityEvent({
          action: 'CACHE_WARMUP_FAILED',
          resource: 'CACHE_SERVICE',
          reason: error instanceof Error ? error.message : 'Failed to warm cache entry',
          metadata: { key },
        });
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // L1: Clear Memory Cache
    this.memoryCache.clear();

    // L2: Clear Redis Cache
    try {
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.stats.redisOperations.del += keys.length;

        this.config.securityLogger.logSecurityEvent({
          action: 'CACHE_CLEAR',
          resource: 'CACHE_SERVICE',
          reason: 'All cache entries cleared',
          metadata: { clearedKeys: keys.length },
        });
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_CLEAR_FAILED',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to clear Redis cache',
        metadata: {},
      });
    }
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    await this.redis.disconnect();
  }

  /**
   * Private methods
   */
  private setInMemory<T>(key: string, data: T, ttl: number): void {
    // Check memory limit
    if (this.memoryCache.size >= this.options.memoryLimit) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      misses: 0,
    };

    this.memoryCache.set(key, entry);
    this.updateMemoryUsage();
  }

  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const data = await this.redis.get(`cache:${key}`);
      if (!data) {
        return null;
      }

      const entry = JSON.parse(data) as CacheEntry<T>;
      if (!this.isValid(entry)) {
        await this.redis.del(`cache:${key}`);
        return null;
      }

      return entry;
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_REDIS_GET_FAILED',
        resource: 'CACHE_SERVICE',
        reason: error instanceof Error ? error.message : 'Failed to get from Redis',
        metadata: { key },
      });
      return null;
    }
  }

  private async setInRedis<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      misses: 0,
    };

    const serializedData = JSON.stringify(entry);

    // Check compression
    if (
      this.options.enableCompression &&
      serializedData.length > this.options.compressionThreshold
    ) {
      // For now, store as-is. In production, you'd use a compression library
    }

    await this.redis.setex(`cache:${key}`, ttl, serializedData);
  }

  private isValid<T>(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl * 1000;
  }

  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let minHits = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.memoryCache.delete(leastUsedKey);
      this.updateMemoryUsage();
    }
  }

  private updateStats(): void {
    this.stats.hits = Array.from(this.memoryCache.values()).reduce(
      (sum, entry) => sum + entry.hits,
      0
    );
    this.stats.hitRate =
      this.stats.totalRequests > 0 ? (this.stats.hits / this.stats.totalRequests) * 100 : 0;
  }

  private updateMemoryUsage(): void {
    const totalSize = Array.from(this.memoryCache.values()).reduce((sum, entry) => {
      return sum + JSON.stringify(entry).length;
    }, 0);
    this.stats.memoryUsage = totalSize;
  }

  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  private cleanupExpiredEntries(): void {
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.updateMemoryUsage();
      this.config.securityLogger.logSecurityEvent({
        action: 'CACHE_CLEANUP',
        resource: 'CACHE_SERVICE',
        reason: 'Expired cache entries cleaned up',
        metadata: { cleanedEntries: cleanedCount },
      });
    }
  }
}
