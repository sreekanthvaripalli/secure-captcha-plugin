import { Pool, PoolClient, QueryResult } from 'pg';
import { SecurityConfigurationService } from '../security/config';
import { createHash } from 'crypto';

export interface DatabaseStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  connectionUtilization: number;
  queryStats: {
    totalQueries: number;
    slowQueries: number;
    avgQueryTime: number;
    maxQueryTime: number;
    queryTypes: Record<string, number>;
  };
  indexStats: {
    totalIndexes: number;
    unusedIndexes: string[];
    duplicateIndexes: string[];
    missingIndexes: string[];
  };
  cacheStats: {
    hitRate: number;
    bufferCacheSize: number;
    sharedBuffers: number;
  };
}

export interface QueryOptimizationResult {
  query: string;
  executionTime: number;
  rowsReturned: number;
  queryPlan: any;
  recommendations: string[];
  indexSuggestions: string[];
}

export interface QueryCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hitCount: number;
}

export interface QueryCacheConfig {
  enabled: boolean;
  maxEntries: number;
  defaultTTL: number;
  maxMemoryMB: number;
}

export interface SlowQueryRecord {
  query: string;
  params: any[];
  executionTime: number;
  timestamp: Date;
  queryPlan: any[];
  recommendations: string[];
  indexSuggestions: string[];
}

export interface JoinAnalysisResult {
  tables: string[];
  joinTypes: string[];
  joinConditions: string[];
  hasIndexOnJoinColumns: boolean;
  recommendations: string[];
  estimatedCost: number;
}

export interface MissingIndexInfo {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: string;
}

export interface ConnectionPoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

export class DatabaseOptimizer {
  private readonly pool: Pool;
  private readonly config: SecurityConfigurationService;
  private readonly poolConfig: ConnectionPoolConfig;
  private readonly stats: DatabaseStats;
  private readonly slowQueryThreshold: number;
  private readonly queryCache: Map<string, QueryCacheEntry>;
  private readonly queryCacheConfig: QueryCacheConfig;
  private readonly slowQueryLog: SlowQueryRecord[];
  private readonly maxSlowQueryLogSize: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: SecurityConfigurationService,
    poolConfig: Partial<ConnectionPoolConfig> = {},
    pool?: Pool
  ) {
    this.config = config;
    this.poolConfig = {
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      ...poolConfig,
    };

    this.pool =
      pool ||
      new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'captcha_db',
        max: this.poolConfig.max,
        min: this.poolConfig.min,
        idleTimeoutMillis: this.poolConfig.idleTimeoutMillis,
        connectionTimeoutMillis: this.poolConfig.connectionTimeoutMillis,
      });

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      maxConnections: this.poolConfig.max,
      connectionUtilization: 0,
      queryStats: {
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        queryTypes: {},
      },
      indexStats: {
        totalIndexes: 0,
        unusedIndexes: [],
        duplicateIndexes: [],
        missingIndexes: [],
      },
      cacheStats: {
        hitRate: 0,
        bufferCacheSize: 0,
        sharedBuffers: 0,
      },
    };

    this.slowQueryThreshold = 1000; // 1 second

    // Query cache configuration
    this.queryCache = new Map();
    this.queryCacheConfig = {
      enabled: true,
      maxEntries: 1000,
      defaultTTL: 60000, // 1 minute
      maxMemoryMB: 100,
    };

    // Slow query log
    this.slowQueryLog = [];
    this.maxSlowQueryLogSize = 1000;

    this.setupPoolEvents();
    this.startMonitoring();
  }

  /**
   * Execute a query with optimization tracking
   */
  async query<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryType = this.getQueryType(text);

    // Check query cache for SELECT queries
    if (this.queryCacheConfig.enabled && queryType === 'SELECT') {
      const cacheKey = this.getQueryCacheKey(text, params);
      const cachedResult = this.getCachedQuery(cacheKey);
      if (cachedResult) {
        return cachedResult as QueryResult<T>;
      }
    }

    try {
      const result = await this.pool.query(text, params);
      const executionTime = Date.now() - startTime;

      // Update statistics
      this.updateQueryStats(queryType, executionTime, result.rowCount || 0);

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        await this.logSlowQuery(text, params || [], executionTime, result);
      }

      // Cache SELECT query results
      if (this.queryCacheConfig.enabled && queryType === 'SELECT') {
        const cacheKey = this.getQueryCacheKey(text, params);
        this.setCachedQuery(cacheKey, result);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.config.securityLogger.logSecurityEvent({
        action: 'QUERY_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Query execution failed',
        metadata: {
          query: text.substring(0, 100),
          executionTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Execute a query with result caching
   */
  async queryWithCache<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: any[],
    ttl?: number
  ): Promise<QueryResult<T>> {
    const cacheKey = this.getQueryCacheKey(text, params);
    const cachedResult = this.getCachedQuery(cacheKey);

    if (cachedResult) {
      return cachedResult as QueryResult<T>;
    }

    const result = await this.query<T>(text, params);

    // Cache with custom TTL if provided
    if (ttl) {
      this.setCachedQuery(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Analyze slow queries with detailed query plan
   */
  async analyzeSlowQuery(query: string, params?: any[]): Promise<SlowQueryRecord> {
    const startTime = Date.now();

    try {
      // Get query plan
      const planResult = await this.pool.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        params
      );
      const executionTime = Date.now() - startTime;

      const queryPlan = planResult.rows;
      const recommendations = this.analyzeQueryPlan(queryPlan);
      const indexSuggestions = this.suggestIndexes(query);

      const slowQueryRecord: SlowQueryRecord = {
        query,
        params: params || [],
        executionTime,
        timestamp: new Date(),
        queryPlan,
        recommendations,
        indexSuggestions,
      };

      // Add to slow query log
      this.slowQueryLog.push(slowQueryRecord);
      if (this.slowQueryLog.length > this.maxSlowQueryLogSize) {
        this.slowQueryLog.shift();
      }

      this.config.securityLogger.logSecurityEvent({
        action: 'SLOW_QUERY_ANALYZED',
        resource: 'DATABASE_OPTIMIZER',
        reason: `Query analyzed: ${executionTime}ms`,
        metadata: {
          query: query.substring(0, 100),
          executionTime,
          recommendations: recommendations.length,
          indexSuggestions: indexSuggestions.length,
        },
      });

      return slowQueryRecord;
    } catch (error) {
      throw new Error(
        `Slow query analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get slow query log
   */
  getSlowQueryLog(): SlowQueryRecord[] {
    return [...this.slowQueryLog];
  }

  /**
   * Clear slow query log
   */
  clearSlowQueryLog(): void {
    this.slowQueryLog.length = 0;
  }

  /**
   * Analyze JOIN operations in a query
   */
  async analyzeJoins(query: string): Promise<JoinAnalysisResult> {
    const tables: string[] = [];
    const joinTypes: string[] = [];
    const joinConditions: string[] = [];
    const recommendations: string[] = [];

    // Parse query to extract JOIN information

    // Extract table names from FROM and JOIN clauses
    const fromMatch = query.match(/FROM\s+(\w+)/gi);
    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/FROM\s+/i, '');
        if (!tables.includes(table)) {
          tables.push(table);
        }
      });
    }

    const joinMatch = query.match(/(\w+)\s+(LEFT|RIGHT|INNER|OUTER|FULL|CROSS)?\s*JOIN\s+(\w+)/gi);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const parts = match.match(/(\w+)\s+(LEFT|RIGHT|INNER|OUTER|FULL|CROSS)?\s*JOIN\s+(\w+)/i);
        if (parts) {
          const joinType = parts[2] || 'INNER';
          const table = parts[3];
          joinTypes.push(joinType);
          if (!tables.includes(table)) {
            tables.push(table);
          }
        }
      });
    }

    // Extract ON conditions
    const onMatch = query.match(/ON\s+([\w.]+\s*=\s*[\w.]+)/gi);
    if (onMatch) {
      onMatch.forEach(match => {
        joinConditions.push(match.replace(/ON\s+/i, ''));
      });
    }

    // Check for indexes on join columns
    const joinColumns = this.extractJoinColumns(joinConditions);
    const hasIndexOnJoinColumns = await this.checkIndexesOnColumns(tables, joinColumns);

    // Generate recommendations
    if (!hasIndexOnJoinColumns) {
      recommendations.push('Add indexes on JOIN columns for better performance');
    }

    if (joinTypes.includes('LEFT') || joinTypes.includes('RIGHT')) {
      recommendations.push('Consider if OUTER JOINs are necessary - INNER JOINs are faster');
    }

    if (tables.length > 4) {
      recommendations.push('Consider breaking down complex queries with many JOINs');
    }

    // Estimate cost based on number of tables and join types
    const estimatedCost = this.estimateJoinCost(tables.length, joinTypes);

    return {
      tables,
      joinTypes,
      joinConditions,
      hasIndexOnJoinColumns,
      recommendations,
      estimatedCost,
    };
  }

  /**
   * Detect missing indexes based on query patterns
   */
  async detectMissingIndexes(): Promise<MissingIndexInfo[]> {
    const missingIndexes: MissingIndexInfo[] = [];

    try {
      // Query pg_stat_user_tables for tables with sequential scans
      const seqScanResult = await this.pool.query(`
        SELECT 
          schemaname,
          relname AS table_name,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_live_tup
        FROM pg_stat_user_tables
        WHERE seq_scan > 0
        ORDER BY seq_tup_read DESC
        LIMIT 20
      `);

      for (const row of seqScanResult.rows) {
        // If sequential scans are high and index scans are low, suggest indexes
        if (row.seq_scan > 100 && (row.idx_scan === 0 || row.idx_scan < row.seq_scan / 10)) {
          missingIndexes.push({
            table: row.table_name,
            columns: ['*'],
            reason: `High sequential scan count (${row.seq_scan}) with low index usage`,
            estimatedImprovement: 'Significant - could reduce I/O by 50-90%',
          });
        }
      }

      // Check for missing indexes on frequently filtered columns
      const filterColumnsResult = await this.pool.query(`
        SELECT 
          schemaname,
          relname AS table_name,
          attname AS column_name,
          n_distinct,
          correlation
        FROM pg_stats
        WHERE schemaname = 'public'
        AND n_distinct > 10
        ORDER BY n_distinct DESC
        LIMIT 20
      `);

      for (const row of filterColumnsResult.rows) {
        // Check if column has an index
        const indexCheck = await this.pool.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE tablename = $1 AND indexdef LIKE '%' || $2 || '%'
          ) AS has_index
        `,
          [row.table_name, row.column_name]
        );

        if (!indexCheck.rows[0].has_index && row.n_distinct > 100) {
          missingIndexes.push({
            table: row.table_name,
            columns: [row.column_name],
            reason: `High cardinality column (${row.n_distinct} distinct values) without index`,
            estimatedImprovement: 'Moderate - could improve WHERE clause performance by 30-70%',
          });
        }
      }

      // Check for missing indexes on foreign key columns
      const fkResult = await this.pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      `);

      for (const row of fkResult.rows) {
        const indexCheck = await this.pool.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE tablename = $1 AND indexdef LIKE '%' || $2 || '%'
          ) AS has_index
        `,
          [row.table_name, row.column_name]
        );

        if (!indexCheck.rows[0].has_index) {
          missingIndexes.push({
            table: row.table_name,
            columns: [row.column_name],
            reason: `Foreign key column referencing ${row.foreign_table_name}.${row.foreign_column_name}`,
            estimatedImprovement: 'High - improves JOIN and DELETE performance',
          });
        }
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'MISSING_INDEX_DETECTION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Failed to detect missing indexes',
        metadata: {},
      });
    }

    return missingIndexes;
  }

  /**
   * Get query cache statistics
   */
  getCacheStats(): {
    entries: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    memoryUsage: number;
  } {
    let totalHits = 0;
    let totalMisses = 0;

    this.queryCache.forEach(entry => {
      totalHits += entry.hitCount;
    });

    // Estimate misses based on total queries minus hits
    totalMisses = Math.max(0, this.stats.queryStats.totalQueries - totalHits);

    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    // Estimate memory usage
    let memoryUsage = 0;
    this.queryCache.forEach(entry => {
      memoryUsage += JSON.stringify(entry.data).length;
    });
    memoryUsage = memoryUsage / (1024 * 1024); // Convert to MB

    return {
      entries: this.queryCache.size,
      hitRate,
      totalHits,
      totalMisses,
      memoryUsage,
    };
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Invalidate specific cache entries
   */
  invalidateCache(pattern: string): void {
    const keysToDelete: string[] = [];
    this.queryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  /**
   * Configure query cache
   */
  configureQueryCache(config: Partial<QueryCacheConfig>): void {
    Object.assign(this.queryCacheConfig, config);

    // If cache is disabled, clear it
    if (!this.queryCacheConfig.enabled) {
      this.queryCache.clear();
    }
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute a query with read replica support
   */
  async queryWithReplica<T extends Record<string, any> = Record<string, any>>(
    text: string,
    params?: any[],
    useReplica: boolean = false
  ): Promise<QueryResult<T>> {
    if (useReplica && process.env.DB_REPLICA_URL) {
      // Use read replica for SELECT queries
      const replicaPool = new Pool({
        connectionString: process.env.DB_REPLICA_URL,
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000,
      });

      try {
        const result = await replicaPool.query(text, params);
        await replicaPool.end();
        return result;
      } catch (error) {
        // Fallback to primary database
        await replicaPool.end();
        return this.query(text, params) as Promise<QueryResult<T>>;
      }
    }

    return this.query(text, params) as Promise<QueryResult<T>>;
  }

  /**
   * Optimize a specific query
   */
  async optimizeQuery(query: string): Promise<QueryOptimizationResult> {
    const startTime = Date.now();

    try {
      // Get query plan
      const planResult = await this.query('EXPLAIN (ANALYZE, BUFFERS) ' + query);
      const executionTime = Date.now() - startTime;

      // Analyze query plan
      const recommendations = this.analyzeQueryPlan(planResult.rows);
      const indexSuggestions = this.suggestIndexes(query);

      return {
        query,
        executionTime,
        rowsReturned: planResult.rowCount || 0,
        queryPlan: planResult.rows,
        recommendations,
        indexSuggestions,
      };
    } catch (error) {
      throw new Error(
        `Query optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create database indexes
   */
  async createIndex(tableName: string, columns: string[], indexName?: string): Promise<void> {
    const idxName = indexName || `${tableName}_${columns.join('_')}_idx`;
    const columnsStr = columns.join(', ');

    const query = `CREATE INDEX IF NOT EXISTS ${idxName} ON ${tableName} (${columnsStr})`;

    try {
      await this.query(query);

      this.config.securityLogger.logSecurityEvent({
        action: 'INDEX_CREATED',
        resource: 'DATABASE_OPTIMIZER',
        reason: `Index ${idxName} created on ${tableName}`,
        metadata: {
          tableName,
          indexName: idxName,
          columns,
        },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'INDEX_CREATION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Index creation failed',
        metadata: {
          tableName,
          indexName: idxName,
          columns,
        },
      });

      throw error;
    }
  }

  /**
   * Analyze table and update statistics
   */
  async analyzeTable(tableName: string): Promise<void> {
    try {
      await this.query(`ANALYZE ${tableName}`);

      this.config.securityLogger.logSecurityEvent({
        action: 'TABLE_ANALYZED',
        resource: 'DATABASE_OPTIMIZER',
        reason: `Statistics updated for ${tableName}`,
        metadata: { tableName },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'TABLE_ANALYSIS_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Table analysis failed',
        metadata: { tableName },
      });

      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    try {
      // Update connection stats
      this.updateConnectionStats();

      // Get query statistics
      await this.updateQueryStatistics();

      // Get index statistics
      await this.updateIndexStatistics();

      // Get cache statistics
      await this.updateCacheStatistics();

      return { ...this.stats };
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'STATS_COLLECTION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Failed to collect database statistics',
        metadata: {},
      });

      return this.stats;
    }
  }

  /**
   * Optimize database configuration
   */
  async optimizeConfiguration(): Promise<void> {
    try {
      // Update PostgreSQL configuration for better performance
      const optimizations = [
        "ALTER SYSTEM SET shared_buffers = '256MB'",
        "ALTER SYSTEM SET effective_cache_size = '1GB'",
        "ALTER SYSTEM SET maintenance_work_mem = '64MB'",
        'ALTER SYSTEM SET checkpoint_completion_target = 0.9',
        "ALTER SYSTEM SET wal_buffers = '16MB'",
        'ALTER SYSTEM SET default_statistics_target = 100',
        'ALTER SYSTEM SET random_page_cost = 1.1',
        'ALTER SYSTEM SET effective_io_concurrency = 200',
        "ALTER SYSTEM SET work_mem = '4MB'",
        "ALTER SYSTEM SET min_wal_size = '1GB'",
        "ALTER SYSTEM SET max_wal_size = '4GB'",
        'ALTER SYSTEM SET max_worker_processes = 8',
        'ALTER SYSTEM SET max_parallel_workers_per_gather = 4',
        'ALTER SYSTEM SET max_parallel_workers = 8',
      ];

      for (const optimization of optimizations) {
        try {
          await this.query(optimization);
        } catch (error) {
          // Some settings might not be available in all PostgreSQL versions
          continue;
        }
      }

      this.config.securityLogger.logSecurityEvent({
        action: 'DATABASE_OPTIMIZED',
        resource: 'DATABASE_OPTIMIZER',
        reason: 'Database configuration optimized for performance',
        metadata: { optimizationsApplied: optimizations.length },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'DATABASE_OPTIMIZATION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Database optimization failed',
        metadata: {},
      });
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    await this.pool.end();
  }

  /**
   * Private methods
   */
  private getQueryCacheKey(query: string, params?: any[]): string {
    const hash = createHash('sha256');
    hash.update(query);
    if (params && params.length > 0) {
      hash.update(JSON.stringify(params));
    }
    return hash.digest('hex');
  }

  private getCachedQuery(cacheKey: string): QueryResult | null {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    entry.hitCount++;
    return entry.data;
  }

  private setCachedQuery(cacheKey: string, data: QueryResult, ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.queryCache.size >= this.queryCacheConfig.maxEntries) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.queryCacheConfig.defaultTTL,
      hitCount: 0,
    });
  }

  private async logSlowQuery(
    query: string,
    params: any[],
    executionTime: number,
    result: QueryResult
  ): Promise<void> {
    try {
      // Get query plan for slow query
      const planResult = await this.pool.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        params
      );

      const recommendations = this.analyzeQueryPlan(planResult.rows);
      const indexSuggestions = this.suggestIndexes(query);

      const slowQueryRecord: SlowQueryRecord = {
        query,
        params,
        executionTime,
        timestamp: new Date(),
        queryPlan: planResult.rows,
        recommendations,
        indexSuggestions,
      };

      // Add to slow query log
      this.slowQueryLog.push(slowQueryRecord);
      if (this.slowQueryLog.length > this.maxSlowQueryLogSize) {
        this.slowQueryLog.shift();
      }

      this.config.securityLogger.logSecurityEvent({
        action: 'SLOW_QUERY_DETECTED',
        resource: 'DATABASE_OPTIMIZER',
        reason: `Query took ${executionTime}ms`,
        metadata: {
          query: query.substring(0, 100),
          executionTime,
          rowsReturned: result.rowCount,
          recommendations: recommendations.length,
          indexSuggestions: indexSuggestions.length,
        },
      });
    } catch (error) {
      // If we can't get the query plan, log basic info
      this.config.securityLogger.logSecurityEvent({
        action: 'SLOW_QUERY_DETECTED',
        resource: 'DATABASE_OPTIMIZER',
        reason: `Query took ${executionTime}ms`,
        metadata: {
          query: query.substring(0, 100),
          executionTime,
          rowsReturned: result.rowCount,
        },
      });
    }
  }

  private extractJoinColumns(conditions: string[]): Map<string, string[]> {
    const columns = new Map<string, string[]>();

    for (const condition of conditions) {
      const parts = condition.split('=');
      if (parts.length === 2) {
        const left = parts[0].trim();
        const right = parts[1].trim();

        // Parse table.column format
        const leftParts = left.split('.');
        if (leftParts.length === 2) {
          const table = leftParts[0];
          const column = leftParts[1];
          if (!columns.has(table)) {
            columns.set(table, []);
          }
          columns.get(table)!.push(column);
        }

        const rightParts = right.split('.');
        if (rightParts.length === 2) {
          const table = rightParts[0];
          const column = rightParts[1];
          if (!columns.has(table)) {
            columns.set(table, []);
          }
          columns.get(table)!.push(column);
        }
      }
    }

    return columns;
  }

  private async checkIndexesOnColumns(
    _tables: string[],
    columns: Map<string, string[]>
  ): Promise<boolean> {
    let allHaveIndexes = true;

    for (const [table, cols] of columns) {
      for (const col of cols) {
        try {
          const result = await this.pool.query(
            `SELECT EXISTS (
              SELECT 1
              FROM pg_indexes
              WHERE tablename = $1 AND indexdef LIKE '%' || $2 || '%'
            ) AS has_index`,
            [table, col]
          );

          if (!result.rows[0].has_index) {
            allHaveIndexes = false;
          }
        } catch {
          allHaveIndexes = false;
        }
      }
    }

    return allHaveIndexes;
  }

  private estimateJoinCost(tableCount: number, joinTypes: string[]): number {
    let cost = tableCount * 100; // Base cost per table

    for (const joinType of joinTypes) {
      switch (joinType.toUpperCase()) {
        case 'INNER':
          cost *= 1.5;
          break;
        case 'LEFT':
        case 'RIGHT':
          cost *= 2;
          break;
        case 'FULL':
          cost *= 3;
          break;
        case 'CROSS':
          cost *= 5;
          break;
        default:
          cost *= 1.5;
      }
    }

    return cost;
  }

  private setupPoolEvents(): void {
    this.pool.on('connect', () => {
      this.stats.totalConnections++;
      this.updateConnectionStats();
    });

    this.pool.on('remove', () => {
      this.updateConnectionStats();
    });

    this.pool.on('error', (err: Error) => {
      this.config.securityLogger.logSecurityEvent({
        action: 'DATABASE_CONNECTION_ERROR',
        resource: 'DATABASE_OPTIMIZER',
        reason: err.message,
        metadata: { error: err.stack },
      });
    });
  }

  private startMonitoring(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.getStats();
      } catch (error) {
        // Log error but don't stop monitoring
        this.config.securityLogger.logSecurityEvent({
          action: 'MONITORING_ERROR',
          resource: 'DATABASE_OPTIMIZER',
          reason: error instanceof Error ? error.message : 'Monitoring failed',
          metadata: {},
        });
      }
    }, 60000); // Monitor every minute
  }

  private getQueryType(query: string): string {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) {
      return 'SELECT';
    }
    if (trimmed.startsWith('INSERT')) {
      return 'INSERT';
    }
    if (trimmed.startsWith('UPDATE')) {
      return 'UPDATE';
    }
    if (trimmed.startsWith('DELETE')) {
      return 'DELETE';
    }
    if (trimmed.startsWith('CREATE')) {
      return 'DDL';
    }
    if (trimmed.startsWith('ALTER')) {
      return 'DDL';
    }
    if (trimmed.startsWith('DROP')) {
      return 'DDL';
    }
    return 'OTHER';
  }

  private updateQueryStats(queryType: string, executionTime: number, _rowsReturned: number): void {
    this.stats.queryStats.totalQueries++;
    this.stats.queryStats.avgQueryTime =
      (this.stats.queryStats.avgQueryTime * (this.stats.queryStats.totalQueries - 1) +
        executionTime) /
      this.stats.queryStats.totalQueries;

    if (executionTime > this.stats.queryStats.maxQueryTime) {
      this.stats.queryStats.maxQueryTime = executionTime;
    }

    if (executionTime > this.slowQueryThreshold) {
      this.stats.queryStats.slowQueries++;
    }

    if (!this.stats.queryStats.queryTypes[queryType]) {
      this.stats.queryStats.queryTypes[queryType] = 0;
    }
    this.stats.queryStats.queryTypes[queryType]++;
  }

  private updateConnectionStats(): void {
    this.stats.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.stats.idleConnections = this.pool.idleCount;
    this.stats.waitingConnections = this.pool.waitingCount;
    this.stats.connectionUtilization =
      (this.stats.activeConnections / this.stats.maxConnections) * 100;
  }

  private async updateQueryStatistics(): Promise<void> {
    try {
      const result = await this.query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY total_time DESC 
        LIMIT 10
      `);

      // Update stats based on pg_stat_statements if available
      if (result.rows.length > 0) {
        this.stats.queryStats.avgQueryTime =
          result.rows.reduce((sum: number, row: any) => sum + row.mean_time, 0) /
          result.rows.length;
        this.stats.queryStats.maxQueryTime = Math.max(
          ...result.rows.map((row: any) => row.mean_time)
        );
      }
    } catch (error) {
      // pg_stat_statements might not be installed
    }
  }

  private async updateIndexStatistics(): Promise<void> {
    try {
      // Get index usage statistics
      const result = await this.query(`
        SELECT 
          t.relname AS table_name,
          i.relname AS index_name,
          a.idx_scan,
          a.idx_tup_read,
          a.idx_tup_fetch
        FROM pg_stat_user_indexes a
        JOIN pg_class t ON a.relid = t.oid
        JOIN pg_class i ON a.indexrelid = i.oid
        ORDER BY a.idx_scan DESC
      `);

      this.stats.indexStats.totalIndexes = result.rows.length;
      this.stats.indexStats.unusedIndexes = result.rows
        .filter((row: any) => row.idx_scan === 0)
        .map((row: any) => row.index_name);
    } catch (error) {
      // Handle error
    }
  }

  private async updateCacheStatistics(): Promise<void> {
    try {
      const result = await this.query(`
        SELECT 
          sum(heap_blks_hit) as heap_hit,
          sum(heap_blks_read) as heap_read,
          sum(idx_blks_hit) as idx_hit,
          sum(idx_blks_read) as idx_read
        FROM pg_statio_user_tables
      `);

      if (result.rows.length > 0) {
        const stats = result.rows[0];
        const totalHeap = stats.heap_hit + stats.heap_read;

        this.stats.cacheStats.hitRate = totalHeap > 0 ? (stats.heap_hit / totalHeap) * 100 : 0;
      }
    } catch (error) {
      // Handle error
    }
  }

  private analyzeQueryPlan(planRows: any[]): string[] {
    const recommendations: string[] = [];

    for (const row of planRows) {
      const planText = JSON.stringify(row);

      if (planText.includes('Seq Scan')) {
        recommendations.push('Sequential scan detected - consider adding an index');
      }

      if (planText.includes('Nested Loop')) {
        recommendations.push(
          'Nested loop join detected - consider hash join or merge join for large datasets'
        );
      }

      if (planText.includes('Sort')) {
        recommendations.push('Sort operation detected - consider adding an index to avoid sorting');
      }

      if (planText.includes('Hash')) {
        recommendations.push(
          'Hash operation detected - ensure work_mem is configured appropriately'
        );
      }

      if (planText.includes('Materialize')) {
        recommendations.push('Materialization detected - consider if result can be cached');
      }

      if (planText.includes('Bitmap Heap Scan')) {
        recommendations.push('Bitmap heap scan - index is being used but may need optimization');
      }

      if (planText.includes('Index Only Scan')) {
        // This is good - no recommendation needed
      } else if (planText.includes('Index Scan')) {
        // Index is being used - check if it's efficient
      }

      // Check for high cost operations
      if (planText.includes('cost=')) {
        const costMatch = planText.match(/cost=\d+\.?\d+\.\.(\d+\.?\d+)/);
        if (costMatch) {
          const totalCost = parseFloat(costMatch[1]);
          if (totalCost > 10000) {
            recommendations.push(
              `High query cost detected (${totalCost}) - consider query optimization`
            );
          }
        }
      }

      // Check for large row estimates
      if (planText.includes('rows=')) {
        const rowsMatch = planText.match(/rows=(\d+)/);
        if (rowsMatch) {
          const estimatedRows = parseInt(rowsMatch[1], 10);
          if (estimatedRows > 100000) {
            recommendations.push(
              `Large estimated rows (${estimatedRows}) - consider adding filters or indexes`
            );
          }
        }
      }
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  private suggestIndexes(query: string): string[] {
    const suggestions: string[] = [];

    // Extract table and column names from WHERE clauses
    const whereMatch = query.match(/WHERE\s+([\w.]+\s*[=<>!]+)/gi);
    if (whereMatch) {
      whereMatch.forEach(match => {
        const columnMatch = match.match(/([\w.]+)\s*[=<>!]+/);
        if (columnMatch) {
          suggestions.push(`Consider adding index on: ${columnMatch[1]}`);
        }
      });
    }

    // Extract columns from ORDER BY
    const orderByMatch = query.match(/ORDER\s+BY\s+([\w.,\s]+)/i);
    if (orderByMatch) {
      const columns = orderByMatch[1].split(',').map(c => c.trim());
      columns.forEach(col => {
        suggestions.push(`Consider adding index on ORDER BY column: ${col}`);
      });
    }

    // Extract columns from JOIN conditions
    const joinMatch = query.match(/ON\s+([\w.]+\s*=\s*[\w.]+)/gi);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const columns = match.replace(/ON\s+/i, '').split('=');
        columns.forEach(col => {
          suggestions.push(`Consider adding index on JOIN column: ${col.trim()}`);
        });
      });
    }

    // Extract columns from GROUP BY
    const groupByMatch = query.match(/GROUP\s+BY\s+([\w.,\s]+)/i);
    if (groupByMatch) {
      const columns = groupByMatch[1].split(',').map(c => c.trim());
      columns.forEach(col => {
        suggestions.push(`Consider adding index on GROUP BY column: ${col}`);
      });
    }

    return [...new Set(suggestions)];
  }
}
