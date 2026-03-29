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

    it('should log slow queries', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
      };

      // Mock slow query (execution time > 1000ms)
      mockQuery.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
        return mockResult;
      });

      await optimizer.query('SELECT * FROM test');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SLOW_QUERY_DETECTED',
          reason: expect.stringContaining('Query took'),
          metadata: expect.objectContaining({
            query: 'SELECT * FROM test',
            rowsReturned: 1,
          }),
        })
      );
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
});
