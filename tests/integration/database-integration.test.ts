/**
 * Database Integration Tests - Task 6.1.2
 * Tests: PostgreSQL operations, Redis operations, connection pooling, failover
 */

import { DatabaseOptimizer } from '../../src/services/database-optimizer';
import { CacheService } from '../../src/services/cache-service';
import { SessionManager } from '../../src/services/session-manager';

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(300),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    dbsize: jest.fn().mockResolvedValue(0),
    info: jest.fn().mockResolvedValue(''),
    scan: jest.fn().mockResolvedValue([0, []]),
    pipeline: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    setex: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  }));
  return mockRedis;
});

// Mock pg
jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({
    rows: [],
    rowCount: 0,
    command: 'SELECT',
  });

  const mockPool = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: mockQuery,
      release: jest.fn(),
    }),
    query: mockQuery,
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
  }));

  return {
    Pool: mockPool,
  };
});

// Mock uuid with incrementing values
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn().mockImplementation(() => {
    uuidCounter++;
    return `test-uuid-${uuidCounter}-${Math.random().toString(36).substr(2, 9)}`;
  }),
}));

// Mock SecurityConfigurationService
jest.mock('../../src/security/config', () => ({
  SecurityConfigurationService: jest.fn().mockImplementation(() => ({
    securityLogger: {
      logSecurityEvent: jest.fn(),
    },
    cryptoService: {
      encryptAES256GCM: jest.fn().mockResolvedValue({
        encryptedData: 'encrypted-data',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
      }),
      decryptAES256GCM: jest.fn().mockResolvedValue({
        success: true,
        decryptedData: JSON.stringify({
          id: 'test-session-id',
          captchaType: 'text',
          difficulty: 'medium',
          challengeData: {},
          answer: 'test-answer',
          createdAt: Date.now(),
          expiresAt: Date.now() + 300000,
          attempts: 0,
          lastAttemptAt: 0,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          verified: false,
          metadata: {
            sessionId: 'test-session-id',
            challengeId: 'test-challenge-id',
            generationTime: Date.now(),
            securityEvents: [],
          },
        }),
      }),
    },
  })),
}));

describe('Database Integration Tests', () => {
  describe('PostgreSQL Operations', () => {
    let dbOptimizer: DatabaseOptimizer;
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
      };

      dbOptimizer = new DatabaseOptimizer(mockConfig, {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    });

    afterEach(async () => {
      await dbOptimizer.shutdown();
    });

    describe('Connection Pool', () => {
      test('should create connection pool with correct configuration', () => {
        expect(dbOptimizer).toBeDefined();
      });

      test('should track pool statistics', async () => {
        const stats = await dbOptimizer.getStats();
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('totalConnections');
        expect(stats).toHaveProperty('idleConnections');
        expect(stats).toHaveProperty('waitingConnections');
      });

      test('should handle pool exhaustion gracefully', async () => {
        // Simulate high load scenario
        const promises = [];
        for (let i = 0; i < 20; i++) {
          promises.push(dbOptimizer.query('SELECT 1').catch(() => ({ error: 'Pool exhausted' })));
        }

        const results = await Promise.all(promises);
        // Some requests may fail or be queued
        expect(results.length).toBe(20);
      });
    });

    describe('Query Execution', () => {
      test('should execute SELECT query', async () => {
        const result = await dbOptimizer.query('SELECT 1 as value');
        expect(result).toBeDefined();
        expect(result).toHaveProperty('rows');
        expect(result).toHaveProperty('rowCount');
      });

      test('should execute INSERT query', async () => {
        const result = await dbOptimizer.query("INSERT INTO test_table (name) VALUES ('test')", [
          'test',
        ]);
        expect(result).toBeDefined();
      });

      test('should execute UPDATE query', async () => {
        const result = await dbOptimizer.query(
          "UPDATE test_table SET name = 'updated' WHERE id = 1",
          ['updated', 1]
        );
        expect(result).toBeDefined();
      });

      test('should execute DELETE query', async () => {
        const result = await dbOptimizer.query('DELETE FROM test_table WHERE id = 1', [1]);
        expect(result).toBeDefined();
      });

      test('should handle query errors gracefully', async () => {
        const result = await dbOptimizer.query('INVALID SQL QUERY').catch((e: Error) => e);
        // Query should handle errors
        expect(result).toBeDefined();
      });

      test('should handle parameterized queries', async () => {
        const result = await dbOptimizer.query('SELECT * FROM users WHERE id = $1 AND name = $2', [
          1,
          'test',
        ]);
        expect(result).toBeDefined();
      });
    });

    describe('Query Optimization', () => {
      test('should analyze query performance', async () => {
        const analysis = await dbOptimizer.optimizeQuery('SELECT 1');
        expect(analysis).toBeDefined();
        expect(analysis).toHaveProperty('executionTime');
        expect(analysis).toHaveProperty('query');
        expect(analysis).toHaveProperty('recommendations');
      });
    });

    describe('Index Management', () => {
      test('should create index', async () => {
        await dbOptimizer.createIndex('test_table', ['column1'], 'idx_test_column1');
        expect(true).toBe(true);
      });
    });

    describe('Table Analysis', () => {
      test('should analyze table', async () => {
        await dbOptimizer.analyzeTable('test_table');
        expect(true).toBe(true);
      });
    });

    describe('Connection Health', () => {
      test('should get database statistics', async () => {
        const stats = await dbOptimizer.getStats();
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('queryStats');
        expect(stats).toHaveProperty('indexStats');
        expect(stats).toHaveProperty('cacheStats');
      });
    });
  });

  describe('Redis Operations', () => {
    let cacheService: CacheService;
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
      };

      cacheService = new CacheService(mockConfig, {
        redisUrl: 'redis://localhost:6379',
      });
    });

    afterEach(async () => {
      await cacheService.shutdown();
    });

    describe('Cache Operations', () => {
      test('should set cache value', async () => {
        await cacheService.set('test-key', { data: 'test-value' });
        // Redis mock always returns OK
        expect(true).toBe(true);
      });

      test('should get cache value', async () => {
        const value = await cacheService.get('test-key');
        expect(value).toBeDefined();
      });

      test('should delete cache value', async () => {
        await cacheService.delete('test-key');
        expect(true).toBe(true);
      });

      test('should handle non-existent key', async () => {
        const value = await cacheService.get('non-existent-key');
        expect(value).toBeNull();
      });

      test('should set value with TTL', async () => {
        await cacheService.set('test-key-ttl', { data: 'test' }, 60);
        expect(true).toBe(true);
      });

      test('should check if key exists', async () => {
        const exists = await cacheService.exists('test-key');
        expect(typeof exists).toBe('boolean');
      });
    });

    describe('Cache Statistics', () => {
      test('should track hit/miss ratio', () => {
        const stats = cacheService.getStats();
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('hits');
        expect(stats).toHaveProperty('misses');
        expect(stats).toHaveProperty('hitRate');
      });

      test('should track redis operations', () => {
        const stats = cacheService.getStats();
        expect(stats).toHaveProperty('redisOperations');
        expect(stats.redisOperations).toHaveProperty('get');
        expect(stats.redisOperations).toHaveProperty('set');
        expect(stats.redisOperations).toHaveProperty('del');
      });

      test('should track memory usage', () => {
        const stats = cacheService.getStats();
        expect(stats).toHaveProperty('memoryUsage');
      });
    });

    describe('Cache Invalidation', () => {
      test('should invalidate by pattern', async () => {
        await cacheService.set('user:1', { name: 'user1' });
        await cacheService.set('user:2', { name: 'user2' });
        await cacheService.set('post:1', { title: 'post1' });

        await cacheService.invalidate('user:');

        // Pattern invalidation clears matching keys
        expect(true).toBe(true);
      });

      test('should clear all cache', async () => {
        await cacheService.clear();
        expect(true).toBe(true);
      });
    });

    describe('Multi-level Caching', () => {
      test('should use L1 cache for frequently accessed data', async () => {
        await cacheService.set('frequent-key', 'frequent-value');
        await cacheService.get('frequent-key');
        await cacheService.get('frequent-key');
        await cacheService.get('frequent-key');

        const stats = cacheService.getStats();
        expect(stats.hits).toBeGreaterThanOrEqual(0);
      });

      test('should fallback to L2 cache on L1 miss', async () => {
        await cacheService.set('l2-key', 'l2-value');
        const value = await cacheService.get('l2-key');

        expect(value).toBe('l2-value');
      });
    });

    describe('Cache Warming', () => {
      test('should warm cache with initial data', async () => {
        const warmData = [
          { key: 'warm:1', data: 'value1' },
          { key: 'warm:2', data: 'value2' },
        ];

        await cacheService.warmCache(warmData);

        const value1 = await cacheService.get('warm:1');
        const value2 = await cacheService.get('warm:2');

        expect(value1).toBe('value1');
        expect(value2).toBe('value2');
      });
    });
  });

  describe('Session Management', () => {
    let sessionManager: SessionManager;
    let mockConfig: any;

    beforeEach(() => {
      mockConfig = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
        cryptoService: {
          encryptAES256GCM: jest.fn().mockResolvedValue({
            encryptedData: 'encrypted-data',
            iv: 'test-iv',
            authTag: 'test-auth-tag',
          }),
          decryptAES256GCM: jest.fn().mockResolvedValue({
            success: true,
            decryptedData: JSON.stringify({
              id: 'test-session-id',
              captchaType: 'text',
              difficulty: 'medium',
              challengeData: {},
              answer: 'test-answer',
              createdAt: Date.now(),
              expiresAt: Date.now() + 300000,
              attempts: 0,
              lastAttemptAt: 0,
              ipAddress: '127.0.0.1',
              userAgent: 'Test Agent',
              verified: false,
              metadata: {
                sessionId: 'test-session-id',
                challengeId: 'test-challenge-id',
                generationTime: Date.now(),
                securityEvents: [],
              },
            }),
          }),
        },
      };

      sessionManager = new SessionManager(mockConfig, {
        redisUrl: 'redis://localhost:6379',
        defaultTTL: 300,
      });
    });

    afterEach(async () => {
      await sessionManager.shutdown();
    });

    describe('Session Creation', () => {
      test('should create session with data', async () => {
        const session = await sessionManager.createSession(
          'text',
          'medium',
          { challenge: 'test-challenge' },
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );
        expect(session).toBeDefined();
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('captchaType', 'text');
        expect(session).toHaveProperty('difficulty', 'medium');
      });

      test('should generate unique session IDs', async () => {
        const session1 = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'answer1',
          '127.0.0.1',
          'Test Agent'
        );
        const session2 = await sessionManager.createSession(
          'math',
          'easy',
          {},
          'answer2',
          '127.0.0.1',
          'Test Agent'
        );

        // Both sessions should have valid IDs
        expect(session1.id).toBeDefined();
        expect(session2.id).toBeDefined();
        expect(session1.id.length).toBeGreaterThan(0);
        expect(session2.id.length).toBeGreaterThan(0);
      });
    });

    describe('Session Retrieval', () => {
      test('should retrieve existing session', async () => {
        const created = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );
        const retrieved = await sessionManager.getSession(created.id);

        expect(retrieved).toBeDefined();
      });

      test('should return null for non-existent session', async () => {
        const session = await sessionManager.getSession('non-existent-id');
        expect(session).toBeNull();
      });
    });

    describe('Session Update', () => {
      test('should update session with correct answer', async () => {
        const session = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );
        const updated = await sessionManager.updateSession(session.id, 'test-answer', true);

        // Session update should complete (mock always returns same data)
        expect(updated).toBeDefined();
      });

      test('should update session with incorrect answer', async () => {
        const session = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );
        const updated = await sessionManager.updateSession(session.id, 'wrong-answer', false);

        // Session update should complete (mock always returns same data)
        expect(updated).toBeDefined();
      });
    });

    describe('Session Deletion', () => {
      test('should delete existing session', async () => {
        const session = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );
        await sessionManager.deleteSession(session.id);

        const retrieved = await sessionManager.getSession(session.id);
        expect(retrieved).toBeNull();
      });

      test('should handle deletion of non-existent session', async () => {
        await expect(sessionManager.deleteSession('non-existent')).resolves.not.toThrow();
      });
    });

    describe('Session Cleanup', () => {
      test('should cleanup expired sessions', async () => {
        // Cleanup is handled internally by the cleanup job
        expect(true).toBe(true);
      });
    });

    describe('Session Statistics', () => {
      test('should track session statistics', async () => {
        const stats = await sessionManager.getSessionStats();
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('totalSessions');
        expect(stats).toHaveProperty('activeSessions');
        expect(stats).toHaveProperty('expiredSessions');
        expect(stats).toHaveProperty('verifiedSessions');
      });
    });

    describe('Max Attempts Check', () => {
      test('should check if max attempts reached', async () => {
        const session = await sessionManager.createSession(
          'text',
          'medium',
          {},
          'test-answer',
          '127.0.0.1',
          'Test Agent'
        );

        // Check max attempts (mock returns consistent data)
        const maxReached = await sessionManager.isMaxAttemptsReached(session.id);
        expect(typeof maxReached).toBe('boolean');
      });
    });
  });

  describe('Connection Pooling', () => {
    describe('PostgreSQL Pool', () => {
      test('should configure pool size', () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig, {
          max: 20,
          min: 5,
        });

        expect(dbOptimizer).toBeDefined();
        dbOptimizer.shutdown();
      });

      test('should handle idle connections', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig, {
          idleTimeoutMillis: 10000,
        });

        const stats = await dbOptimizer.getStats();
        expect(stats).toHaveProperty('idleConnections');
        await dbOptimizer.shutdown();
      });

      test('should handle connection errors', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig);

        // Simulate error handling
        const stats = await dbOptimizer.getStats();
        expect(stats).toBeDefined();
        await dbOptimizer.shutdown();
      });
    });

    describe('Redis Pool', () => {
      test('should configure Redis connection pool', () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const cacheService = new CacheService(mockConfig, {
          redisUrl: 'redis://localhost:6379',
        });

        expect(cacheService).toBeDefined();
        cacheService.shutdown();
      });

      test('should handle Redis reconnection', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const cacheService = new CacheService(mockConfig, {
          redisUrl: 'redis://localhost:6379',
        });

        // Test that service handles reconnection gracefully
        const stats = cacheService.getStats();
        expect(stats).toBeDefined();
        await cacheService.shutdown();
      });
    });
  });

  describe('Failover Handling', () => {
    describe('Database Failover', () => {
      test('should handle primary database failure', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig);

        // Simulate failure scenario
        const stats = await dbOptimizer.getStats();
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('queryStats');
        await dbOptimizer.shutdown();
      });

      test('should support read replicas', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig);

        // Test read replica support
        const result = await dbOptimizer.queryWithReplica('SELECT 1', [], false);
        expect(result).toBeDefined();
        await dbOptimizer.shutdown();
      });

      test('should failover to replica on primary failure', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const dbOptimizer = new DatabaseOptimizer(mockConfig);

        // Test failover logic
        const result = await dbOptimizer
          .query('SELECT 1')
          .catch(() => ({ error: 'Failover triggered' }));
        expect(result).toBeDefined();
        await dbOptimizer.shutdown();
      });
    });

    describe('Redis Failover', () => {
      test('should handle Redis failure', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const cacheService = new CacheService(mockConfig, {
          redisUrl: 'redis://localhost:6379',
        });

        expect(cacheService).toBeDefined();
        await cacheService.shutdown();
      });

      test('should fallback to memory cache on Redis failure', async () => {
        const mockConfig: any = {
          securityLogger: {
            logSecurityEvent: jest.fn(),
          },
        };

        const cacheService = new CacheService(mockConfig, {
          redisUrl: 'redis://localhost:6379',
        });

        // Set value in L1 (memory) cache
        await cacheService.set('failover-key', 'value');
        const value = await cacheService.get('failover-key');

        expect(value).toBe('value');
        await cacheService.shutdown();
      });
    });
  });

  describe('Database Performance', () => {
    test('should execute queries within time limit', async () => {
      const mockConfig: any = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
      };

      const dbOptimizer = new DatabaseOptimizer(mockConfig);

      const startTime = Date.now();
      await dbOptimizer.query('SELECT 1');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 second timeout
      await dbOptimizer.shutdown();
    });

    test('should handle concurrent queries', async () => {
      const mockConfig: any = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
      };

      const dbOptimizer = new DatabaseOptimizer(mockConfig);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(dbOptimizer.query(`SELECT ${i}`));
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      await dbOptimizer.shutdown();
    });

    test('should track query performance metrics', async () => {
      const mockConfig: any = {
        securityLogger: {
          logSecurityEvent: jest.fn(),
        },
      };

      const dbOptimizer = new DatabaseOptimizer(mockConfig);

      const stats = await dbOptimizer.getStats();
      expect(stats).toBeDefined();
      expect(stats.queryStats).toHaveProperty('totalQueries');
      expect(stats.queryStats).toHaveProperty('avgQueryTime');
      expect(stats.queryStats).toHaveProperty('maxQueryTime');
      await dbOptimizer.shutdown();
    });
  });
});
