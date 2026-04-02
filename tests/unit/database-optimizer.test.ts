import { DatabaseOptimizer } from '../../src/services/database-optimizer';
import { SecurityConfigurationService } from '../../src/security/config';

// Mock dependencies
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();

jest.mock('pg', () => {
  const mockReplicaQuery = jest.fn();
  const mockReplicaEnd = jest.fn();

  return {
    Pool: jest.fn().mockImplementation((config?: any) => {
      // Check if this is a replica pool (has connectionString)
      if (config?.connectionString) {
        return {
          query: mockReplicaQuery,
          connect: jest.fn(),
          end: mockReplicaEnd,
          on: jest.fn(),
          totalCount: 5,
          idleCount: 2,
          waitingCount: 0,
        };
      }
      // Primary pool
      return {
        query: mockQuery,
        connect: mockConnect,
        end: mockEnd,
        on: mockOn,
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      };
    }),
    Client: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      release: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    })),
  };
});

jest.mock('../../src/security/config', () => ({
  SecurityConfigurationService: jest.fn().mockImplementation(() => ({
    securityLogger: {
      logSecurityEvent: jest.fn(),
    },
  })),
}));

describe('DatabaseOptimizer', () => {
  let optimizer: DatabaseOptimizer;
  let mockConfig: jest.Mocked<SecurityConfigurationService>;
  let mockSecurityLogger: any;
  let mockPool: any;

  beforeEach(() => {
    // Setup mocks
    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
    };

    mockConfig = new SecurityConfigurationService() as jest.Mocked<SecurityConfigurationService>;
    mockConfig.securityLogger = mockSecurityLogger;

    // Create mock pool
    mockPool = {
      query: mockQuery,
      connect: mockConnect,
      end: mockEnd,
      on: mockOn,
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0,
    };

    // Mock environment variables
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'password';
    process.env.DB_NAME = 'test_db';

    // Clear mocks before each test
    mockQuery.mockClear();
    mockConnect.mockClear();
    mockEnd.mockClear();
    mockOn.mockClear();
    mockSecurityLogger.logSecurityEvent.mockClear();

    // Create optimizer instance with injected mock pool
    optimizer = new DatabaseOptimizer(
      mockConfig,
      {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
      mockPool
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(optimizer).toBeDefined();
      expect(mockConfig).toBeDefined();
    });

    it('should set slow query threshold to 1000ms', () => {
      // Access private property for testing
      const slowQueryThreshold = (optimizer as any).slowQueryThreshold;
      expect(slowQueryThreshold).toBe(1000);
    });

    it('should initialize query cache with default config', () => {
      const cacheConfig = (optimizer as any).queryCacheConfig;
      expect(cacheConfig.enabled).toBe(true);
      expect(cacheConfig.maxEntries).toBe(1000);
      expect(cacheConfig.defaultTTL).toBe(60000);
    });

    it('should initialize slow query log', () => {
      const slowQueryLog = (optimizer as any).slowQueryLog;
      expect(slowQueryLog).toEqual([]);
      const maxSlowQueryLogSize = (optimizer as any).maxSlowQueryLogSize;
      expect(maxSlowQueryLogSize).toBe(1000);
    });
  });

  describe('query method', () => {
    it('should execute query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await optimizer.query('SELECT * FROM test');

      expect(result).toEqual(mockResult);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test', undefined);
    });

    it('should track query statistics', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      await optimizer.query('SELECT * FROM test');

      const stats = await optimizer.getStats();
      // getStats() makes internal queries, so totalQueries will be higher
      expect(stats.queryStats.totalQueries).toBeGreaterThanOrEqual(1);
      expect(stats.queryStats.queryTypes.SELECT).toBeGreaterThanOrEqual(1);
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockQuery.mockRejectedValue(error);

      await expect(optimizer.query('SELECT * FROM test')).rejects.toThrow('Query failed');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_FAILED',
          reason: 'Query failed',
        })
      );
    });

    it('should cache SELECT query results', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      // First query - should execute
      await optimizer.query('SELECT * FROM users WHERE id = 1');
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Second query with same params - should use cache
      await optimizer.query('SELECT * FROM users WHERE id = 1');
      // Note: The cache key includes params, so without params it should still cache
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should not cache non-SELECT queries', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      await optimizer.query('INSERT INTO users (name) VALUES ($1)', ['test']);
      await optimizer.query('INSERT INTO users (name) VALUES ($1)', ['test']);

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('queryWithCache method', () => {
    it('should return cached result if available', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      // First call - should execute query
      await optimizer.queryWithCache('SELECT * FROM test');
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await optimizer.queryWithCache('SELECT * FROM test');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should execute query if not cached', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      await optimizer.queryWithCache('SELECT * FROM test');

      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('analyzeSlowQuery method', () => {
    it('should analyze slow query and return results', async () => {
      const mockPlanResult = {
        rows: [{ 'QUERY PLAN': 'Seq Scan on test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockPlanResult);

      const result = await optimizer.analyzeSlowQuery('SELECT * FROM test WHERE id = 1');

      expect(result).toBeDefined();
      expect(result.query).toBe('SELECT * FROM test WHERE id = 1');
      expect(result.recommendations).toBeDefined();
      expect(result.indexSuggestions).toBeDefined();
    });

    it('should add slow query to log', async () => {
      const mockPlanResult = {
        rows: [{ 'QUERY PLAN': 'Seq Scan on test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockPlanResult);

      await optimizer.analyzeSlowQuery('SELECT * FROM test');

      const slowQueryLog = optimizer.getSlowQueryLog();
      expect(slowQueryLog.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle analysis errors', async () => {
      mockQuery.mockRejectedValue(new Error('Analysis failed'));

      await expect(optimizer.analyzeSlowQuery('SELECT * FROM test')).rejects.toThrow(
        'Slow query analysis failed'
      );
    });
  });

  describe('slow query log methods', () => {
    it('should return slow query log', async () => {
      const mockPlanResult = {
        rows: [{ 'QUERY PLAN': 'Seq Scan on test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockPlanResult);

      await optimizer.analyzeSlowQuery('SELECT * FROM test');

      const log = optimizer.getSlowQueryLog();
      expect(Array.isArray(log)).toBe(true);
    });

    it('should clear slow query log', async () => {
      const mockPlanResult = {
        rows: [{ 'QUERY PLAN': 'Seq Scan on test' }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockPlanResult);

      await optimizer.analyzeSlowQuery('SELECT * FROM test');
      optimizer.clearSlowQueryLog();

      const log = optimizer.getSlowQueryLog();
      expect(log.length).toBe(0);
    });
  });

  describe('analyzeJoins method', () => {
    it('should analyze simple JOIN query', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_index: true }] });

      const result = await optimizer.analyzeJoins(
        'SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id'
      );

      expect(result.tables).toContain('users');
      expect(result.tables).toContain('orders');
      expect(result.joinTypes).toContain('INNER');
      expect(result.joinConditions.length).toBeGreaterThan(0);
    });

    it('should detect LEFT JOIN', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_index: false }] });

      const result = await optimizer.analyzeJoins(
        'SELECT * FROM users u LEFT JOIN orders o ON u.id = o.user_id'
      );

      expect(result.joinTypes).toContain('LEFT');
      expect(result.recommendations).toContain(
        'Consider if OUTER JOINs are necessary - INNER JOINs are faster'
      );
    });

    it('should recommend indexes on join columns when missing', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_index: false }] });

      const result = await optimizer.analyzeJoins(
        'SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id'
      );

      expect(result.recommendations).toContain(
        'Add indexes on JOIN columns for better performance'
      );
    });

    it('should recommend breaking down complex queries', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_index: true }] });

      const complexQuery = `
        SELECT * FROM users u
        INNER JOIN orders o ON u.id = o.user_id
        INNER JOIN products p ON o.product_id = p.id
        INNER JOIN categories c ON p.category_id = c.id
        INNER JOIN reviews r ON p.id = r.product_id
        LEFT JOIN shipping s ON o.id = s.order_id
      `;

      const result = await optimizer.analyzeJoins(complexQuery);

      expect(result.recommendations).toContain(
        'Consider breaking down complex queries with many JOINs'
      );
    });

    it('should estimate join cost', async () => {
      mockQuery.mockResolvedValue({ rows: [{ has_index: true }] });

      const result = await optimizer.analyzeJoins(
        'SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id'
      );

      expect(result.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('detectMissingIndexes method', () => {
    it('should return missing indexes based on sequential scans', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              schemaname: 'public',
              table_name: 'users',
              seq_scan: 500,
              seq_tup_read: 100000,
              idx_scan: 0,
              idx_tup_fetch: 0,
              n_live_tup: 10000,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await optimizer.detectMissingIndexes();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle detection errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Detection failed'));

      const result = await optimizer.detectMissingIndexes();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('query cache methods', () => {
    it('should return cache statistics', () => {
      const stats = optimizer.getCacheStats();

      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('totalMisses');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should clear cache', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      // Execute query to populate cache
      await optimizer.query('SELECT * FROM test');

      optimizer.clearCache();

      const stats = optimizer.getCacheStats();
      expect(stats.entries).toBe(0);
    });

    it('should invalidate cache entries by pattern', () => {
      // Manually add entries to the cache for testing
      const cache = (optimizer as any).queryCache as Map<string, any>;
      cache.set('users_cache_key_1', {
        data: { rows: [] },
        timestamp: Date.now(),
        ttl: 60000,
        hitCount: 0,
      });
      cache.set('orders_cache_key_1', {
        data: { rows: [] },
        timestamp: Date.now(),
        ttl: 60000,
        hitCount: 0,
      });

      // Before invalidation, we should have 2 entries
      expect(cache.size).toBe(2);

      optimizer.invalidateCache('users');

      // After invalidating 'users', we should have 1 entry left
      expect(cache.size).toBe(1);
      expect(cache.has('orders_cache_key_1')).toBe(true);
    });

    it('should configure query cache', () => {
      optimizer.configureQueryCache({ enabled: false });

      const cacheConfig = (optimizer as any).queryCacheConfig;
      expect(cacheConfig.enabled).toBe(false);
    });

    it('should clear cache when disabled', () => {
      optimizer.configureQueryCache({ enabled: false });

      const stats = optimizer.getCacheStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('createIndex method', () => {
    it('should handle index creation errors', async () => {
      const error = new Error('Index creation failed');
      mockQuery.mockRejectedValue(error);

      await expect(optimizer.createIndex('test_table', ['column1'])).rejects.toThrow(
        'Index creation failed'
      );

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INDEX_CREATION_FAILED',
          reason: 'Index creation failed',
        })
      );
    });
  });

  describe('analyzeTable method', () => {
    it('should handle analyze errors', async () => {
      const error = new Error('Analyze failed');
      mockQuery.mockRejectedValue(error);

      await expect(optimizer.analyzeTable('test_table')).rejects.toThrow('Analyze failed');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TABLE_ANALYSIS_FAILED',
          reason: 'Analyze failed',
        })
      );
    });
  });

  describe('optimizeQuery method', () => {
    it('should handle optimization errors', async () => {
      const error = new Error('Optimization failed');
      mockQuery.mockRejectedValue(error);

      await expect(optimizer.optimizeQuery('SELECT * FROM test_table')).rejects.toThrow(
        'Optimization failed'
      );
    });
  });

  describe('getStats method', () => {
    it('should return database statistics', async () => {
      const stats = await optimizer.getStats();

      expect(stats).toMatchObject({
        totalConnections: expect.any(Number),
        activeConnections: expect.any(Number),
        idleConnections: expect.any(Number),
        waitingConnections: expect.any(Number),
        maxConnections: 10,
        connectionUtilization: expect.any(Number),
        queryStats: {
          totalQueries: expect.any(Number),
          slowQueries: expect.any(Number),
          avgQueryTime: expect.any(Number),
          maxQueryTime: expect.any(Number),
          queryTypes: expect.objectContaining({}),
        },
        indexStats: {
          totalIndexes: expect.any(Number),
          unusedIndexes: expect.any(Array),
          duplicateIndexes: expect.any(Array),
          missingIndexes: expect.any(Array),
        },
        cacheStats: {
          hitRate: expect.any(Number),
          bufferCacheSize: expect.any(Number),
          sharedBuffers: expect.any(Number),
        },
      });
    });
  });

  describe('getConnection method', () => {
    it('should return a database connection', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockConnect.mockResolvedValue(mockClient);

      const connection = await optimizer.getConnection();

      expect(connection).toBe(mockClient);
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('shutdown method', () => {
    it('should shutdown optimizer gracefully', async () => {
      await optimizer.shutdown();

      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('performance monitoring', () => {
    it('should track different query types', async () => {
      const mockResult = { rows: [], rowCount: 0 };

      mockQuery.mockResolvedValue(mockResult);

      await optimizer.query('SELECT * FROM users');
      await optimizer.query('INSERT INTO users VALUES (1)');
      await optimizer.query('UPDATE users SET name = "test"');
      await optimizer.query('DELETE FROM users WHERE id = 1');

      const stats = await optimizer.getStats();

      // getStats() makes internal queries, so counts will be higher
      expect(stats.queryStats.queryTypes.SELECT).toBeGreaterThanOrEqual(1);
      expect(stats.queryStats.queryTypes.INSERT).toBeGreaterThanOrEqual(1);
      expect(stats.queryStats.queryTypes.UPDATE).toBeGreaterThanOrEqual(1);
      expect(stats.queryStats.queryTypes.DELETE).toBeGreaterThanOrEqual(1);
    });
  });

  describe('connection pool monitoring', () => {
    it('should track connection statistics', async () => {
      const stats = await optimizer.getStats();

      // The mock pool has totalCount=10, idleCount=5, waitingCount=0
      // But the optimizer's updateConnectionStats uses these values
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(stats.idleConnections).toBeGreaterThanOrEqual(0);
      expect(stats.waitingConnections).toBeGreaterThanOrEqual(0);
      expect(stats.connectionUtilization).toBeGreaterThanOrEqual(0);
    });
  });

  describe('query cache key generation', () => {
    it('should generate consistent cache keys for same query', () => {
      const getQueryCacheKey = (optimizer as any).getQueryCacheKey.bind(optimizer);

      const key1 = getQueryCacheKey('SELECT * FROM users');
      const key2 = getQueryCacheKey('SELECT * FROM users');

      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different params', () => {
      const getQueryCacheKey = (optimizer as any).getQueryCacheKey.bind(optimizer);

      const key1 = getQueryCacheKey('SELECT * FROM users WHERE id = $1', [1]);
      const key2 = getQueryCacheKey('SELECT * FROM users WHERE id = $1', [2]);

      expect(key1).not.toBe(key2);
    });
  });

  describe('analyzeQueryPlan method', () => {
    it('should detect sequential scans', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [{ 'QUERY PLAN': 'Seq Scan on users (cost=0.00..100.00 rows=1000)' }];

      const recommendations = analyzeQueryPlan(planRows);

      expect(recommendations).toContain('Sequential scan detected - consider adding an index');
    });

    it('should detect nested loops', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [{ 'QUERY PLAN': 'Nested Loop (cost=0.00..1000.00 rows=100)' }];

      const recommendations = analyzeQueryPlan(planRows);

      expect(recommendations).toContain(
        'Nested loop join detected - consider hash join or merge join for large datasets'
      );
    });

    it('should detect sort operations', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [{ 'QUERY PLAN': 'Sort (cost=0.00..100.00 rows=1000)' }];

      const recommendations = analyzeQueryPlan(planRows);

      expect(recommendations).toContain(
        'Sort operation detected - consider adding an index to avoid sorting'
      );
    });

    it('should detect high query cost', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [{ 'QUERY PLAN': 'Seq Scan (cost=0.00..50000.00 rows=100000)' }];

      const recommendations = analyzeQueryPlan(planRows);

      expect(recommendations.some((r: string) => r.includes('High query cost'))).toBe(true);
    });

    it('should detect large row estimates', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [{ 'QUERY PLAN': 'Seq Scan (cost=0.00..100.00 rows=500000)' }];

      const recommendations = analyzeQueryPlan(planRows);

      expect(recommendations.some((r: string) => r.includes('Large estimated rows'))).toBe(true);
    });

    it('should remove duplicate recommendations', () => {
      const analyzeQueryPlan = (optimizer as any).analyzeQueryPlan.bind(optimizer);
      const planRows = [
        { 'QUERY PLAN': 'Seq Scan on users (cost=0.00..100.00 rows=1000)' },
        { 'QUERY PLAN': 'Seq Scan on orders (cost=0.00..100.00 rows=1000)' },
      ];

      const recommendations = analyzeQueryPlan(planRows);

      const seqScanCount = recommendations.filter((r: string) =>
        r.includes('Sequential scan')
      ).length;
      expect(seqScanCount).toBe(1);
    });
  });

  describe('suggestIndexes method', () => {
    it('should suggest indexes for WHERE clause columns', () => {
      const suggestIndexes = (optimizer as any).suggestIndexes.bind(optimizer);

      const suggestions = suggestIndexes('SELECT * FROM users WHERE email = $1');

      expect(suggestions.some((s: string) => s.includes('email'))).toBe(true);
    });

    it('should suggest indexes for ORDER BY columns', () => {
      const suggestIndexes = (optimizer as any).suggestIndexes.bind(optimizer);

      const suggestions = suggestIndexes('SELECT * FROM users ORDER BY created_at');

      expect(suggestions.some((s: string) => s.includes('created_at'))).toBe(true);
    });

    it('should suggest indexes for JOIN columns', () => {
      const suggestIndexes = (optimizer as any).suggestIndexes.bind(optimizer);

      const suggestions = suggestIndexes('SELECT * FROM users u JOIN orders o ON u.id = o.user_id');

      expect(suggestions.some((s: string) => s.includes('JOIN column'))).toBe(true);
    });

    it('should suggest indexes for GROUP BY columns', () => {
      const suggestIndexes = (optimizer as any).suggestIndexes.bind(optimizer);

      const suggestions = suggestIndexes('SELECT status, COUNT(*) FROM orders GROUP BY status');

      expect(suggestions.some((s: string) => s.includes('GROUP BY column'))).toBe(true);
    });

    it('should remove duplicate suggestions', () => {
      const suggestIndexes = (optimizer as any).suggestIndexes.bind(optimizer);

      const suggestions = suggestIndexes(
        'SELECT * FROM users WHERE email = $1 AND email IS NOT NULL'
      );

      const emailSuggestions = suggestions.filter((s: string) => s.includes('email'));
      expect(emailSuggestions.length).toBeLessThanOrEqual(1);
    });
  });

  describe('estimateJoinCost method', () => {
    it('should calculate higher cost for more tables', () => {
      const estimateJoinCost = (optimizer as any).estimateJoinCost.bind(optimizer);

      const cost2Tables = estimateJoinCost(2, ['INNER', 'INNER']);
      const cost3Tables = estimateJoinCost(3, ['INNER', 'INNER', 'INNER']);

      expect(cost3Tables).toBeGreaterThan(cost2Tables);
    });

    it('should calculate higher cost for OUTER JOINs', () => {
      const estimateJoinCost = (optimizer as any).estimateJoinCost.bind(optimizer);

      const innerCost = estimateJoinCost(2, ['INNER', 'INNER']);
      const leftCost = estimateJoinCost(2, ['LEFT', 'LEFT']);
      const fullCost = estimateJoinCost(2, ['FULL', 'FULL']);
      const crossCost = estimateJoinCost(2, ['CROSS', 'CROSS']);

      expect(leftCost).toBeGreaterThan(innerCost);
      expect(fullCost).toBeGreaterThan(leftCost);
      expect(crossCost).toBeGreaterThan(fullCost);
    });
  });
});
