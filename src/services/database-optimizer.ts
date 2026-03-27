import { Pool, PoolClient, QueryResult } from 'pg';
import { SecurityConfigurationService } from '../security/config';

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
  private pool: Pool;
  private config: SecurityConfigurationService;
  private poolConfig: ConnectionPoolConfig;
  private stats: DatabaseStats;
  private slowQueryThreshold: number;
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
      ...poolConfig
    };

    this.pool = pool || new Pool({
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
        queryTypes: {}
      },
      indexStats: {
        totalIndexes: 0,
        unusedIndexes: [],
        duplicateIndexes: [],
        missingIndexes: []
      },
      cacheStats: {
        hitRate: 0,
        bufferCacheSize: 0,
        sharedBuffers: 0
      }
    };

    this.slowQueryThreshold = 1000; // 1 second
    this.setupPoolEvents();
    this.startMonitoring();
  }

  /**
   * Execute a query with optimization tracking
   */
  async query<T extends Record<string, any> = Record<string, any>>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryType = this.getQueryType(text);
    
    try {
      const result = await this.pool.query(text, params);
      const executionTime = Date.now() - startTime;

      // Update statistics
      this.updateQueryStats(queryType, executionTime, result.rowCount || 0);
      
      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        this.config.securityLogger.logSecurityEvent({
          action: 'SLOW_QUERY_DETECTED',
          resource: 'DATABASE_OPTIMIZER',
          reason: `Query took ${executionTime}ms`,
          metadata: {
            query: text.substring(0, 100),
            executionTime,
            rowsReturned: result.rowCount
          }
        });
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
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
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
        indexSuggestions
      };
    } catch (error) {
      throw new Error(`Query optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          columns
        }
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'INDEX_CREATION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Index creation failed',
        metadata: {
          tableName,
          indexName: idxName,
          columns
        }
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
        metadata: { tableName }
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'TABLE_ANALYSIS_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Table analysis failed',
        metadata: { tableName }
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
        metadata: {}
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
        'ALTER SYSTEM SET shared_buffers = \'256MB\'',
        'ALTER SYSTEM SET effective_cache_size = \'1GB\'',
        'ALTER SYSTEM SET maintenance_work_mem = \'64MB\'',
        'ALTER SYSTEM SET checkpoint_completion_target = 0.9',
        'ALTER SYSTEM SET wal_buffers = \'16MB\'',
        'ALTER SYSTEM SET default_statistics_target = 100',
        'ALTER SYSTEM SET random_page_cost = 1.1',
        'ALTER SYSTEM SET effective_io_concurrency = 200',
        'ALTER SYSTEM SET work_mem = \'4MB\'',
        'ALTER SYSTEM SET min_wal_size = \'1GB\'',
        'ALTER SYSTEM SET max_wal_size = \'4GB\'',
        'ALTER SYSTEM SET max_worker_processes = 8',
        'ALTER SYSTEM SET max_parallel_workers_per_gather = 4',
        'ALTER SYSTEM SET max_parallel_workers = 8'
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
        metadata: { optimizationsApplied: optimizations.length }
      });

    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'DATABASE_OPTIMIZATION_FAILED',
        resource: 'DATABASE_OPTIMIZER',
        reason: error instanceof Error ? error.message : 'Database optimization failed',
        metadata: {}
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
        metadata: { error: err.stack }
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
          metadata: {}
        });
      }
    }, 60000); // Monitor every minute
  }

  private getQueryType(query: string): string {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('CREATE')) return 'DDL';
    if (trimmed.startsWith('ALTER')) return 'DDL';
    if (trimmed.startsWith('DROP')) return 'DDL';
    return 'OTHER';
  }

  private updateQueryStats(queryType: string, executionTime: number, _rowsReturned: number): void {
    this.stats.queryStats.totalQueries++;
    this.stats.queryStats.avgQueryTime = 
      (this.stats.queryStats.avgQueryTime * (this.stats.queryStats.totalQueries - 1) + executionTime) / 
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
    this.stats.connectionUtilization = (this.stats.activeConnections / this.stats.maxConnections) * 100;
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
        this.stats.queryStats.avgQueryTime = result.rows.reduce((sum: number, row: any) => sum + row.mean_time, 0) / result.rows.length;
        this.stats.queryStats.maxQueryTime = Math.max(...result.rows.map((row: any) => row.mean_time));
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
        
        this.stats.cacheStats.hitRate = totalHeap > 0 
          ? (stats.heap_hit / totalHeap) * 100 
          : 0;
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
        recommendations.push('Consider adding an index for better performance');
      }
      
      if (planText.includes('Nested Loop')) {
        recommendations.push('Consider rewriting query to avoid nested loops');
      }
      
      if (planText.includes('Sort')) {
        recommendations.push('Consider adding an index to avoid sorting');
      }
    }
    
    return recommendations;
  }

  private suggestIndexes(query: string): string[] {
    const suggestions: string[] = [];
    
    // Simple pattern matching for index suggestions
    if (query.includes('WHERE')) {
      suggestions.push('Consider adding indexes on WHERE clause columns');
    }
    
    if (query.includes('ORDER BY')) {
      suggestions.push('Consider adding indexes on ORDER BY columns');
    }
    
    if (query.includes('JOIN')) {
      suggestions.push('Consider adding indexes on JOIN columns');
    }
    
    return suggestions;
  }
}