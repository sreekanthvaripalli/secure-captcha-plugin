/**
 * Performance Profiler Service
 * Comprehensive CPU, memory, and network profiling for CAPTCHA system optimization
 */

export interface ProfileResult {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CPUProfileResult extends ProfileResult {
  cpuTime: number;
  wallTime: number;
  callCount: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MemorySnapshot {
  timestamp: number;
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  heapUsedPercent: number;
}

export interface MemoryLeakReport {
  timestamp: number;
  suspectedLeaks: MemoryLeak[];
  summary: {
    totalSnapshots: number;
    growthRate: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface MemoryLeak {
  metric: string;
  growthRate: number; // bytes per second
  confidence: number; // 0-1
  samples: number;
}

export interface NetworkProfileResult extends ProfileResult {
  requestSize: number;
  responseSize: number;
  compressionRatio: number;
  serializationTime: number;
  deserializationTime: number;
  networkLatency: number;
  throughput: number; // bytes per second
}

export interface ObjectPoolStats {
  poolName: string;
  size: number;
  available: number;
  inUse: number;
  totalCreated: number;
  totalReused: number;
  reuseRate: number;
}

export interface PerformanceReport {
  timestamp: number;
  duration: number; // profiling window in ms
  cpuProfiles: CPUProfileResult[];
  memorySnapshots: MemorySnapshot[];
  memoryLeakReport?: MemoryLeakReport;
  networkProfiles: NetworkProfileResult[];
  poolStats: ObjectPoolStats[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
}

export interface Bottleneck {
  operation: string;
  type: 'cpu' | 'memory' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  description: string;
}

export interface ProfilerConfig {
  // CPU profiling
  cpuProfilingEnabled: boolean;
  cpuSampleRate: number; // percentage of operations to profile (0-100)
  cpuPercentileBuckets: number[];

  // Memory profiling
  memoryProfilingEnabled: boolean;
  memorySnapshotInterval: number; // ms between snapshots
  memoryLeakDetectionEnabled: boolean;
  memoryLeakThreshold: number; // bytes growth to trigger alert
  memorySnapshotRetention: number; // number of snapshots to keep

  // Network profiling
  networkProfilingEnabled: boolean;
  networkPayloadTracking: boolean;
  compressionTracking: boolean;

  // Object pooling
  objectPoolingEnabled: boolean;
  poolMaxSize: number;
  poolMinSize: number;
  poolIdleTimeout: number; // ms

  // Reporting
  reportInterval: number; // ms between automatic reports
  bottleneckThresholds: BottleneckThresholds;
}

export interface BottleneckThresholds {
  cpu: {
    p95: number; // ms
    p99: number; // ms
    avg: number; // ms
  };
  memory: {
    heapUsedPercent: number;
    growthRate: number; // bytes per second
  };
  network: {
    latency: number; // ms
    payloadSize: number; // bytes
    compressionRatio: number;
  };
}

const DEFAULT_CONFIG: ProfilerConfig = {
  cpuProfilingEnabled: true,
  cpuSampleRate: 100,
  cpuPercentileBuckets: [50, 95, 99],

  memoryProfilingEnabled: true,
  memorySnapshotInterval: 1000,
  memoryLeakDetectionEnabled: true,
  memoryLeakThreshold: 1024 * 1024, // 1MB
  memorySnapshotRetention: 1000,

  networkProfilingEnabled: true,
  networkPayloadTracking: true,
  compressionTracking: true,

  objectPoolingEnabled: true,
  poolMaxSize: 100,
  poolMinSize: 10,
  poolIdleTimeout: 60000,

  reportInterval: 60000,
  bottleneckThresholds: {
    cpu: {
      p95: 100,
      p99: 500,
      avg: 50,
    },
    memory: {
      heapUsedPercent: 80,
      growthRate: 1024 * 1024, // 1MB/s
    },
    network: {
      latency: 200,
      payloadSize: 1024 * 1024, // 1MB
      compressionRatio: 0.5,
    },
  },
};

/**
 * Object Pool for reusing expensive objects
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private totalCreated = 0;
  private totalReused = 0;
  private readonly name: string;
  private readonly maxSize: number;
  private readonly minSize: number;
  private readonly idleTimeout: number;
  private readonly factory: () => T;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    name: string,
    factory: () => T,
    maxSize: number = 100,
    minSize: number = 10,
    idleTimeout: number = 60000
  ) {
    this.name = name;
    this.factory = factory;
    this.maxSize = maxSize;
    this.minSize = minSize;
    this.idleTimeout = idleTimeout;

    // Pre-populate pool
    for (let i = 0; i < minSize; i++) {
      this.pool.push(this.factory());
      this.totalCreated++;
    }

    // Start cleanup timer
    this.startCleanupTimer();
  }

  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      this.totalReused++;
    } else {
      obj = this.factory();
      this.totalCreated++;
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      if (this.pool.length < this.maxSize) {
        this.pool.push(obj);
      }
      // If pool is full, let GC handle it
    }
  }

  getStats(): ObjectPoolStats {
    const total = this.totalCreated + this.totalReused;
    return {
      poolName: this.name,
      size: this.pool.length + this.inUse.size,
      available: this.pool.length,
      inUse: this.inUse.size,
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      reuseRate: total > 0 ? this.totalReused / total : 0,
    };
  }

  clear(): void {
    this.pool = [];
    this.inUse.clear();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      // Trim pool to min size if idle
      while (this.pool.length > this.minSize) {
        this.pool.pop();
      }
    }, this.idleTimeout);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

/**
 * Performance Profiler Service
 */
export class PerformanceProfilerService {
  private config: ProfilerConfig;
  private cpuProfiles: Map<string, number[]> = new Map();
  private cpuProfileResults: Map<string, CPUProfileResult> = new Map();
  private memorySnapshots: MemorySnapshot[] = [];
  private networkProfiles: NetworkProfileResult[] = [];
  private objectPools: Map<string, ObjectPool<any>> = new Map();
  private profilingStartTime: number = 0;
  private reportIntervalTimer: NodeJS.Timeout | null = null;
  private memorySnapshotTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProfilerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profilingStartTime = Date.now();

    if (this.config.memoryProfilingEnabled) {
      this.startMemorySnapshotTimer();
    }

    if (this.config.reportInterval > 0) {
      this.startReportInterval();
    }
  }

  // ==================== CPU Profiling ====================

  /**
   * Profile a synchronous operation
   */
  profileSync<T>(operation: string, fn: () => T): T {
    if (!this.config.cpuProfilingEnabled || !this.shouldSample()) {
      return fn();
    }

    const startCpu = process.cpuUsage();
    const startWall = process.hrtime.bigint();
    const startTime = Date.now();

    try {
      return fn();
    } finally {
      const endCpu = process.cpuUsage(startCpu);
      const endWall = process.hrtime.bigint();
      const endTime = Date.now();

      const cpuTime = (endCpu.user + endCpu.system) / 1000; // microseconds to ms
      const wallTime = Number(endWall - startWall) / 1_000_000; // nanoseconds to ms
      const duration = endTime - startTime;

      this.recordCpuProfile(operation, duration, cpuTime, wallTime);
    }
  }

  /**
   * Profile an asynchronous operation
   */
  async profileAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.config.cpuProfilingEnabled || !this.shouldSample()) {
      return fn();
    }

    const startCpu = process.cpuUsage();
    const startWall = process.hrtime.bigint();
    const startTime = Date.now();

    try {
      return await fn();
    } finally {
      const endCpu = process.cpuUsage(startCpu);
      const endWall = process.hrtime.bigint();
      const endTime = Date.now();

      const cpuTime = (endCpu.user + endCpu.system) / 1000;
      const wallTime = Number(endWall - startWall) / 1_000_000;
      const duration = endTime - startTime;

      this.recordCpuProfile(operation, duration, cpuTime, wallTime);
    }
  }

  /**
   * Record CPU profile data
   */
  private recordCpuProfile(
    operation: string,
    duration: number,
    cpuTime: number,
    wallTime: number
  ): void {
    if (!this.cpuProfiles.has(operation)) {
      this.cpuProfiles.set(operation, []);
    }
    this.cpuProfiles.get(operation)!.push(duration);

    // Update aggregated results
    const durations = this.cpuProfiles.get(operation)!;
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    const result: CPUProfileResult = {
      operation,
      duration,
      timestamp: Date.now(),
      cpuTime,
      wallTime,
      callCount: durations.length,
      avgDuration: sum / durations.length,
      minDuration: sorted[0],
      maxDuration: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };

    this.cpuProfileResults.set(operation, result);
  }

  /**
   * Get CPU profile for an operation
   */
  getCpuProfile(operation: string): CPUProfileResult | undefined {
    return this.cpuProfileResults.get(operation);
  }

  /**
   * Get all CPU profiles
   */
  getAllCpuProfiles(): CPUProfileResult[] {
    return Array.from(this.cpuProfileResults.values());
  }

  // ==================== Memory Profiling ====================

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };

    this.memorySnapshots.push(snapshot);

    // Trim old snapshots
    if (this.memorySnapshots.length > this.config.memorySnapshotRetention) {
      this.memorySnapshots = this.memorySnapshots.slice(-this.config.memorySnapshotRetention);
    }

    return snapshot;
  }

  /**
   * Get memory snapshots
   */
  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): MemoryLeakReport | null {
    if (!this.config.memoryLeakDetectionEnabled || this.memorySnapshots.length < 10) {
      return null;
    }

    const leaks: MemoryLeak[] = [];
    const recentSnapshots = this.memorySnapshots.slice(-100);

    // Analyze heap growth
    const heapUsedGrowth = this.calculateGrowthRate(recentSnapshots.map(s => s.heapUsed));

    if (heapUsedGrowth > this.config.memoryLeakThreshold / 1000) {
      leaks.push({
        metric: 'heapUsed',
        growthRate: heapUsedGrowth * 1000, // bytes per second
        confidence: Math.min(1, heapUsedGrowth / (this.config.memoryLeakThreshold / 500)),
        samples: recentSnapshots.length,
      });
    }

    // Analyze RSS growth
    const rssGrowth = this.calculateGrowthRate(recentSnapshots.map(s => s.rss));

    if (rssGrowth > this.config.memoryLeakThreshold / 1000) {
      leaks.push({
        metric: 'rss',
        growthRate: rssGrowth * 1000,
        confidence: Math.min(1, rssGrowth / (this.config.memoryLeakThreshold / 500)),
        samples: recentSnapshots.length,
      });
    }

    // Analyze external memory growth
    const externalGrowth = this.calculateGrowthRate(recentSnapshots.map(s => s.external));

    if (externalGrowth > this.config.memoryLeakThreshold / 2000) {
      leaks.push({
        metric: 'external',
        growthRate: externalGrowth * 1000,
        confidence: Math.min(1, externalGrowth / (this.config.memoryLeakThreshold / 1000)),
        samples: recentSnapshots.length,
      });
    }

    // Calculate overall risk level
    const maxConfidence = leaks.length > 0 ? Math.max(...leaks.map(l => l.confidence)) : 0;
    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      maxConfidence > 0.8
        ? 'critical'
        : maxConfidence > 0.6
          ? 'high'
          : maxConfidence > 0.3
            ? 'medium'
            : 'low';

    return {
      timestamp: Date.now(),
      suspectedLeaks: leaks,
      summary: {
        totalSnapshots: this.memorySnapshots.length,
        growthRate: heapUsedGrowth * 1000,
        riskLevel,
      },
    };
  }

  /**
   * Calculate growth rate using linear regression
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    return slope;
  }

  // ==================== Network Profiling ====================

  /**
   * Profile a network request/response
   */
  profileNetworkRequest(
    operation: string,
    requestSize: number,
    responseSize: number,
    duration: number,
    metadata?: Record<string, any>
  ): NetworkProfileResult {
    const result: NetworkProfileResult = {
      operation,
      duration,
      timestamp: Date.now(),
      requestSize,
      responseSize,
      compressionRatio: requestSize > 0 ? responseSize / requestSize : 1,
      serializationTime: 0,
      deserializationTime: 0,
      networkLatency: duration,
      throughput: duration > 0 ? (responseSize / duration) * 1000 : 0, // bytes per second
      metadata,
    };

    this.networkProfiles.push(result);

    // Keep only recent profiles
    if (this.networkProfiles.length > 1000) {
      this.networkProfiles = this.networkProfiles.slice(-1000);
    }

    return result;
  }

  /**
   * Profile serialization time
   */
  profileSerialization<T>(_operation: string, data: T): { result: T; time: number } {
    const start = process.hrtime.bigint();
    JSON.stringify(data);
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1_000_000;

    return {
      result: data,
      time,
    };
  }

  /**
   * Profile deserialization time
   */
  profileDeserialization<T>(_operation: string, json: string): { result: T; time: number } {
    const start = process.hrtime.bigint();
    const parsed = JSON.parse(json);
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1_000_000;

    return {
      result: parsed,
      time,
    };
  }

  /**
   * Get network profiles
   */
  getNetworkProfiles(): NetworkProfileResult[] {
    return [...this.networkProfiles];
  }

  // ==================== Object Pooling ====================

  /**
   * Create or get an object pool
   */
  getPool<T>(name: string, factory: () => T): ObjectPool<T> {
    if (!this.objectPools.has(name)) {
      const pool = new ObjectPool<T>(
        name,
        factory,
        this.config.poolMaxSize,
        this.config.poolMinSize,
        this.config.poolIdleTimeout
      );
      this.objectPools.set(name, pool);
    }
    return this.objectPools.get(name)!;
  }

  /**
   * Get stats for all object pools
   */
  getPoolStats(): ObjectPoolStats[] {
    return Array.from(this.objectPools.values()).map(pool => pool.getStats());
  }

  /**
   * Destroy all object pools
   */
  destroyPools(): void {
    this.objectPools.forEach(pool => pool.destroy());
    this.objectPools.clear();
  }

  // ==================== Performance Reporting ====================

  /**
   * Generate a comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const duration = Date.now() - this.profilingStartTime;
    const bottlenecks: Bottleneck[] = [];
    const recommendations: string[] = [];

    // Analyze CPU bottlenecks
    for (const profile of this.getAllCpuProfiles()) {
      const thresholds = this.config.bottleneckThresholds.cpu;

      if (profile.p95 > thresholds.p95) {
        bottlenecks.push({
          operation: profile.operation,
          type: 'cpu',
          severity: profile.p95 > thresholds.p99 ? 'critical' : 'high',
          metric: 'p95',
          value: profile.p95,
          threshold: thresholds.p95,
          description: `P95 latency (${profile.p95.toFixed(2)}ms) exceeds threshold (${thresholds.p95}ms)`,
        });
      }

      if (profile.p99 > thresholds.p99) {
        bottlenecks.push({
          operation: profile.operation,
          type: 'cpu',
          severity: 'critical',
          metric: 'p99',
          value: profile.p99,
          threshold: thresholds.p99,
          description: `P99 latency (${profile.p99.toFixed(2)}ms) exceeds threshold (${thresholds.p99}ms)`,
        });
      }

      if (profile.avgDuration > thresholds.avg) {
        bottlenecks.push({
          operation: profile.operation,
          type: 'cpu',
          severity: profile.avgDuration > thresholds.avg * 2 ? 'high' : 'medium',
          metric: 'avg',
          value: profile.avgDuration,
          threshold: thresholds.avg,
          description: `Average latency (${profile.avgDuration.toFixed(2)}ms) exceeds threshold (${thresholds.avg}ms)`,
        });
      }
    }

    // Analyze memory bottlenecks
    const leakReport = this.detectMemoryLeaks();
    if (
      (leakReport && leakReport.summary.riskLevel === 'high') ||
      (leakReport && leakReport.summary.riskLevel === 'critical')
    ) {
      bottlenecks.push({
        operation: 'memory',
        type: 'memory',
        severity: leakReport!.summary.riskLevel,
        metric: 'growthRate',
        value: leakReport!.summary.growthRate,
        threshold: this.config.memoryLeakThreshold,
        description: `Potential memory leak detected: ${leakReport!.summary.growthRate.toFixed(2)} bytes/s growth rate`,
      });
    }

    const latestSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    if (
      latestSnapshot &&
      latestSnapshot.heapUsedPercent > this.config.bottleneckThresholds.memory.heapUsedPercent
    ) {
      bottlenecks.push({
        operation: 'memory',
        type: 'memory',
        severity: latestSnapshot.heapUsedPercent > 90 ? 'critical' : 'high',
        metric: 'heapUsedPercent',
        value: latestSnapshot.heapUsedPercent,
        threshold: this.config.bottleneckThresholds.memory.heapUsedPercent,
        description: `Heap usage (${latestSnapshot.heapUsedPercent.toFixed(2)}%) exceeds threshold (${this.config.bottleneckThresholds.memory.heapUsedPercent}%)`,
      });
    }

    // Analyze network bottlenecks
    if (this.networkProfiles.length > 0) {
      const avgLatency =
        this.networkProfiles.reduce((sum, p) => sum + p.duration, 0) / this.networkProfiles.length;
      const avgPayloadSize =
        this.networkProfiles.reduce((sum, p) => sum + p.responseSize, 0) /
        this.networkProfiles.length;

      if (avgLatency > this.config.bottleneckThresholds.network.latency) {
        bottlenecks.push({
          operation: 'network',
          type: 'network',
          severity:
            avgLatency > this.config.bottleneckThresholds.network.latency * 2 ? 'high' : 'medium',
          metric: 'latency',
          value: avgLatency,
          threshold: this.config.bottleneckThresholds.network.latency,
          description: `Average network latency (${avgLatency.toFixed(2)}ms) exceeds threshold (${this.config.bottleneckThresholds.network.latency}ms)`,
        });
      }

      if (avgPayloadSize > this.config.bottleneckThresholds.network.payloadSize) {
        bottlenecks.push({
          operation: 'network',
          type: 'network',
          severity: 'medium',
          metric: 'payloadSize',
          value: avgPayloadSize,
          threshold: this.config.bottleneckThresholds.network.payloadSize,
          description: `Average payload size (${avgPayloadSize.toFixed(0)} bytes) exceeds threshold (${this.config.bottleneckThresholds.network.payloadSize} bytes)`,
        });
      }
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(bottlenecks));

    return {
      timestamp: Date.now(),
      duration,
      cpuProfiles: this.getAllCpuProfiles(),
      memorySnapshots: this.getMemorySnapshots().slice(-100),
      memoryLeakReport: leakReport || undefined,
      networkProfiles: this.getNetworkProfiles().slice(-100),
      poolStats: this.getPoolStats(),
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on bottlenecks
   */
  private generateRecommendations(bottlenecks: Bottleneck[]): string[] {
    const recommendations: string[] = [];

    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case 'cpu':
          if (bottleneck.metric === 'p99') {
            recommendations.push(
              `Optimize ${bottleneck.operation}: P99 latency is ${bottleneck.value.toFixed(2)}ms. Consider caching, algorithm optimization, or async processing.`
            );
          } else if (bottleneck.metric === 'p95') {
            recommendations.push(
              `Review ${bottleneck.operation}: P95 latency is ${bottleneck.value.toFixed(2)}ms. Profile hot paths and optimize critical sections.`
            );
          } else {
            recommendations.push(
              `Optimize ${bottleneck.operation}: Average latency is ${bottleneck.value.toFixed(2)}ms. Consider algorithm improvements or caching.`
            );
          }
          break;

        case 'memory':
          if (bottleneck.metric === 'growthRate') {
            recommendations.push(
              'Investigate potential memory leaks. Check for unclosed connections, event listener leaks, and large object retention.'
            );
          } else if (bottleneck.metric === 'heapUsedPercent') {
            recommendations.push(
              'High heap usage detected. Consider increasing heap size, optimizing data structures, or implementing object pooling.'
            );
          }
          break;

        case 'network':
          if (bottleneck.metric === 'latency') {
            recommendations.push(
              'High network latency. Consider connection pooling, request batching, or moving services closer to users.'
            );
          } else if (bottleneck.metric === 'payloadSize') {
            recommendations.push(
              'Large payload sizes. Implement response compression, pagination, or field selection to reduce data transfer.'
            );
          }
          break;
      }
    }

    // General recommendations
    if (this.getPoolStats().some(p => p.reuseRate < 0.5)) {
      recommendations.push(
        'Object pool reuse rate is low. Consider adjusting pool size or reviewing object lifecycle management.'
      );
    }

    return recommendations;
  }

  // ==================== Utility Methods ====================

  /**
   * Determine if this operation should be sampled
   */
  private shouldSample(): boolean {
    if (this.config.cpuSampleRate >= 100) return true;
    if (this.config.cpuSampleRate <= 0) return false;
    return Math.random() * 100 < this.config.cpuSampleRate;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Start memory snapshot timer
   */
  private startMemorySnapshotTimer(): void {
    this.memorySnapshotTimer = setInterval(() => {
      this.takeMemorySnapshot();
    }, this.config.memorySnapshotInterval);
  }

  /**
   * Start report interval timer (logs to console)
   */
  private startReportInterval(): void {
    this.reportIntervalTimer = setInterval(() => {
      const report = this.generateReport();
      if (report.bottlenecks.length > 0) {
        console.warn(
          `[Performance Profiler] ${report.bottlenecks.length} bottleneck(s) detected:`,
          report.bottlenecks.map(b => b.description).join(', ')
        );
      }
    }, this.config.reportInterval);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart timers if needed
    if (config.memorySnapshotInterval !== undefined && this.memorySnapshotTimer) {
      clearInterval(this.memorySnapshotTimer);
      this.startMemorySnapshotTimer();
    }

    if (config.reportInterval !== undefined && this.reportIntervalTimer) {
      clearInterval(this.reportIntervalTimer);
      if (config.reportInterval > 0) {
        this.startReportInterval();
      } else {
        this.reportIntervalTimer = null;
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ProfilerConfig {
    return { ...this.config };
  }

  /**
   * Reset all profiling data
   */
  reset(): void {
    this.cpuProfiles.clear();
    this.cpuProfileResults.clear();
    this.memorySnapshots = [];
    this.networkProfiles = [];
    this.profilingStartTime = Date.now();
  }

  /**
   * Destroy profiler and cleanup resources
   */
  destroy(): void {
    if (this.memorySnapshotTimer) {
      clearInterval(this.memorySnapshotTimer);
      this.memorySnapshotTimer = null;
    }
    if (this.reportIntervalTimer) {
      clearInterval(this.reportIntervalTimer);
      this.reportIntervalTimer = null;
    }
    this.destroyPools();
    this.reset();
  }
}

// Export singleton instance
let profilerInstance: PerformanceProfilerService | null = null;

export function getPerformanceProfiler(): PerformanceProfilerService {
  if (!profilerInstance) {
    profilerInstance = new PerformanceProfilerService();
  }
  return profilerInstance;
}

export function resetPerformanceProfiler(): void {
  if (profilerInstance) {
    profilerInstance.destroy();
    profilerInstance = null;
  }
}

// Export ObjectPool for direct use
export { ObjectPool };

export default PerformanceProfilerService;
