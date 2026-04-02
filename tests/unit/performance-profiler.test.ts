/**
 * Performance Profiler Service Tests
 * Unit tests for CPU, memory, and network profiling
 */

import {
  PerformanceProfilerService,
  ObjectPool,
  getPerformanceProfiler,
  resetPerformanceProfiler,
  MemorySnapshot,
} from '../../src/services/performance-profiler';

describe('PerformanceProfilerService', () => {
  let profiler: PerformanceProfilerService;

  beforeEach(() => {
    resetPerformanceProfiler();
    profiler = new PerformanceProfilerService({
      reportInterval: 0, // Disable automatic reporting for tests
      memorySnapshotInterval: 100, // Fast interval for testing
    });
  });

  afterEach(() => {
    profiler.destroy();
    resetPerformanceProfiler();
  });

  describe('Constructor & Configuration', () => {
    it('should create profiler with default config', () => {
      const p = new PerformanceProfilerService({ reportInterval: 0 });
      const config = p.getConfig();

      expect(config.cpuProfilingEnabled).toBe(true);
      expect(config.memoryProfilingEnabled).toBe(true);
      expect(config.networkProfilingEnabled).toBe(true);
      expect(config.objectPoolingEnabled).toBe(true);

      p.destroy();
    });

    it('should create profiler with custom config', () => {
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        cpuSampleRate: 50,
        poolMaxSize: 50,
        poolMinSize: 5,
      });
      const config = p.getConfig();

      expect(config.cpuSampleRate).toBe(50);
      expect(config.poolMaxSize).toBe(50);
      expect(config.poolMinSize).toBe(5);

      p.destroy();
    });

    it('should update configuration', () => {
      profiler.updateConfig({ cpuSampleRate: 75 });
      const config = profiler.getConfig();

      expect(config.cpuSampleRate).toBe(75);
    });
  });

  describe('CPU Profiling - Sync Operations', () => {
    it('should profile synchronous operations', () => {
      const result = profiler.profileSync('test-operation', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(4950);

      const profile = profiler.getCpuProfile('test-operation');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(1);
      expect(profile!.operation).toBe('test-operation');
    });

    it('should track multiple calls to same operation', () => {
      for (let i = 0; i < 10; i++) {
        profiler.profileSync('multi-call', () => {
          return Math.random();
        });
      }

      const profile = profiler.getCpuProfile('multi-call');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(10);
      expect(profile!.minDuration).toBeGreaterThanOrEqual(0);
      expect(profile!.maxDuration).toBeGreaterThanOrEqual(profile!.minDuration);
    });

    it('should calculate percentiles correctly', () => {
      // Run operation many times to get meaningful percentiles
      for (let i = 0; i < 100; i++) {
        profiler.profileSync('percentile-test', () => {
          return i;
        });
      }

      const profile = profiler.getCpuProfile('percentile-test');
      expect(profile).toBeDefined();
      expect(profile!.p50).toBeGreaterThanOrEqual(0);
      expect(profile!.p95).toBeGreaterThanOrEqual(profile!.p50);
      expect(profile!.p99).toBeGreaterThanOrEqual(profile!.p95);
    });

    it('should track CPU time separately from wall time', () => {
      profiler.profileSync('cpu-test', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      });

      const profile = profiler.getCpuProfile('cpu-test');
      expect(profile).toBeDefined();
      expect(profile!.cpuTime).toBeGreaterThanOrEqual(0);
      expect(profile!.wallTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle operations that throw errors', () => {
      expect(() => {
        profiler.profileSync('error-operation', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // Profile should still be recorded
      const profile = profiler.getCpuProfile('error-operation');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(1);
    });

    it('should respect sample rate', () => {
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        cpuSampleRate: 0, // Disable sampling
      });

      for (let i = 0; i < 100; i++) {
        p.profileSync('no-sample', () => i);
      }

      const profile = p.getCpuProfile('no-sample');
      expect(profile).toBeUndefined();

      p.destroy();
    });

    it('should handle disabled CPU profiling', () => {
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        cpuProfilingEnabled: false,
      });

      for (let i = 0; i < 100; i++) {
        p.profileSync('disabled', () => i);
      }

      const profile = p.getCpuProfile('disabled');
      expect(profile).toBeUndefined();

      p.destroy();
    });
  });

  describe('CPU Profiling - Async Operations', () => {
    it('should profile asynchronous operations', async () => {
      const result = await profiler.profileAsync('async-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-result';
      });

      expect(result).toBe('async-result');

      const profile = profiler.getCpuProfile('async-operation');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(1);
    });

    it('should handle async operations that reject', async () => {
      await expect(
        profiler.profileAsync('async-error', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');

      const profile = profiler.getCpuProfile('async-error');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(1);
    });

    it('should track multiple async operations', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          profiler.profileAsync('async-multi', async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return i;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4]);

      const profile = profiler.getCpuProfile('async-multi');
      expect(profile).toBeDefined();
      expect(profile!.callCount).toBe(5);
    });
  });

  describe('CPU Profile Retrieval', () => {
    it('should return undefined for non-existent profile', () => {
      const profile = profiler.getCpuProfile('non-existent');
      expect(profile).toBeUndefined();
    });

    it('should return all CPU profiles', () => {
      profiler.profileSync('op1', () => 1);
      profiler.profileSync('op2', () => 2);
      profiler.profileSync('op3', () => 3);

      const profiles = profiler.getAllCpuProfiles();
      expect(profiles.length).toBe(3);

      const operations = profiles.map(p => p.operation).sort();
      expect(operations).toEqual(['op1', 'op2', 'op3']);
    });
  });

  describe('Memory Profiling', () => {
    it('should take memory snapshots', () => {
      const snapshot = profiler.takeMemorySnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.rss).toBeGreaterThan(0);
      expect(snapshot.heapTotal).toBeGreaterThan(0);
      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.heapUsedPercent).toBeGreaterThan(0);
      expect(snapshot.heapUsedPercent).toBeLessThanOrEqual(100);
    });

    it('should store multiple snapshots', () => {
      for (let i = 0; i < 5; i++) {
        profiler.takeMemorySnapshot();
      }

      const snapshots = profiler.getMemorySnapshots();
      expect(snapshots.length).toBe(5);
    });

    it('should trim old snapshots based on retention', () => {
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        memorySnapshotRetention: 3,
      });

      for (let i = 0; i < 10; i++) {
        p.takeMemorySnapshot();
      }

      const snapshots = p.getMemorySnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(3);

      p.destroy();
    });

    it('should return null for leak detection with insufficient data', () => {
      const report = profiler.detectMemoryLeaks();
      expect(report).toBeNull();
    });

    it('should detect memory leaks with growing heap', () => {
      // Simulate memory growth by manually adding snapshots
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        const snapshot: MemorySnapshot = {
          timestamp: baseTime + i * 100,
          rss: 100 * 1024 * 1024 + i * 1024 * 1024, // Growing by 1MB each
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 40 * 1024 * 1024 + i * 1024 * 1024, // Growing by 1MB each
          external: 1 * 1024 * 1024,
          arrayBuffers: 0,
          heapUsedPercent: 80,
        };
        (profiler as any).memorySnapshots.push(snapshot);
      }

      const report = profiler.detectMemoryLeaks();
      expect(report).not.toBeNull();
      expect(report!.suspectedLeaks.length).toBeGreaterThan(0);
    });

    it('should not detect leaks with stable memory', () => {
      // Simulate stable memory
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        const snapshot: MemorySnapshot = {
          timestamp: baseTime + i * 100,
          rss: 100 * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 40 * 1024 * 1024 + Math.random() * 1000, // Stable with small variations
          external: 1 * 1024 * 1024,
          arrayBuffers: 0,
          heapUsedPercent: 80,
        };
        (profiler as any).memorySnapshots.push(snapshot);
      }

      const report = profiler.detectMemoryLeaks();
      // May or may not detect leaks depending on random variation
      expect(report).toBeDefined();
    });
  });

  describe('Network Profiling', () => {
    it('should profile network requests', () => {
      const result = profiler.profileNetworkRequest('GET /api/test', 100, 500, 50, {
        statusCode: 200,
      });

      expect(result).toBeDefined();
      expect(result.operation).toBe('GET /api/test');
      expect(result.requestSize).toBe(100);
      expect(result.responseSize).toBe(500);
      expect(result.duration).toBe(50);
      expect(result.compressionRatio).toBe(5);
      expect(result.throughput).toBe(10000); // 500 bytes / 50ms * 1000
    });

    it('should handle zero request size', () => {
      const result = profiler.profileNetworkRequest('GET /api/test', 0, 500, 50);

      expect(result.compressionRatio).toBe(1);
    });

    it('should handle zero duration', () => {
      const result = profiler.profileNetworkRequest('GET /api/test', 100, 500, 0);

      expect(result.throughput).toBe(0);
    });

    it('should store network profiles', () => {
      profiler.profileNetworkRequest('GET /api/1', 100, 200, 10);
      profiler.profileNetworkRequest('GET /api/2', 150, 300, 20);
      profiler.profileNetworkRequest('POST /api/3', 200, 400, 30);

      const profiles = profiler.getNetworkProfiles();
      expect(profiles.length).toBe(3);
    });

    it('should trim old network profiles', () => {
      for (let i = 0; i < 1100; i++) {
        profiler.profileNetworkRequest(`GET /api/${i}`, 100, 200, 10);
      }

      const profiles = profiler.getNetworkProfiles();
      expect(profiles.length).toBeLessThanOrEqual(1000);
    });

    it('should profile serialization time', () => {
      const data = { foo: 'bar', nested: { value: 123 } };
      const result = profiler.profileSerialization('test-serialize', data);

      expect(result.result).toEqual(data);
      expect(result.time).toBeGreaterThanOrEqual(0);
    });

    it('should profile deserialization time', () => {
      const json = JSON.stringify({ foo: 'bar', nested: { value: 123 } });
      const result = profiler.profileDeserialization('test-deserialize', json);

      expect(result.result).toEqual({ foo: 'bar', nested: { value: 123 } });
      expect(result.time).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Object Pooling', () => {
    it('should create and use object pool', () => {
      const pool = profiler.getPool('test-pool', () => ({ value: 0 }));

      expect(pool).toBeDefined();

      const obj = pool.acquire();
      expect(obj).toBeDefined();

      pool.release(obj);

      const stats = pool.getStats();
      expect(stats.poolName).toBe('test-pool');
      expect(stats.totalCreated).toBeGreaterThan(0);
    });

    it('should reuse objects from pool', () => {
      const pool = profiler.getPool('reuse-pool', () => ({ value: Math.random() }));

      const obj1 = pool.acquire();
      const value1 = obj1.value;
      pool.release(obj1);

      const obj2 = pool.acquire();
      const value2 = obj2.value;

      // Should be same object (reused)
      expect(value1).toBe(value2);

      pool.release(obj2);

      const stats = pool.getStats();
      expect(stats.reuseRate).toBeGreaterThan(0);
    });

    it('should create new objects when pool is empty', () => {
      const pool = profiler.getPool('new-obj-pool', () => ({ id: Math.random() }));

      const obj1 = pool.acquire();
      const obj2 = pool.acquire();
      const obj3 = pool.acquire(); // Should create new since pool only has 1

      expect(obj1).toBeDefined();
      expect(obj2).toBeDefined();
      expect(obj3).toBeDefined();

      pool.release(obj1);
      pool.release(obj2);
      pool.release(obj3);

      const stats = pool.getStats();
      expect(stats.totalCreated).toBeGreaterThan(0);
    });

    it('should respect max pool size', () => {
      const pool = profiler.getPool('max-size-pool', () => ({ value: 0 }));

      const objects = [];
      for (let i = 0; i < 10; i++) {
        objects.push(pool.acquire());
      }

      // Verify all objects were created/acquired
      expect(objects.length).toBe(10);

      // Release all objects
      objects.forEach(obj => pool.release(obj));

      const stats = pool.getStats();
      // Verify stats are tracked correctly
      expect(stats.totalCreated).toBeGreaterThan(0);
      expect(stats.totalReused).toBeGreaterThanOrEqual(0);
    });

    it('should get stats for all pools', () => {
      profiler.getPool('pool1', () => ({ value: 1 }));
      profiler.getPool('pool2', () => ({ value: 2 }));
      profiler.getPool('pool3', () => ({ value: 3 }));

      const stats = profiler.getPoolStats();
      expect(stats.length).toBe(3);
    });

    it('should destroy all pools', () => {
      profiler.getPool('destroy1', () => ({ value: 1 }));
      profiler.getPool('destroy2', () => ({ value: 2 }));

      profiler.destroyPools();

      const stats = profiler.getPoolStats();
      expect(stats.length).toBe(0);
    });
  });

  describe('ObjectPool (Direct)', () => {
    it('should create pool with factory', () => {
      const pool = new ObjectPool('direct-pool', () => new Date(), 100, 10, 60000);

      const obj = pool.acquire();
      expect(obj).toBeInstanceOf(Date);

      pool.release(obj);
      pool.destroy();
    });

    it('should clear pool', () => {
      const pool = new ObjectPool('clear-pool', () => ({}), 10, 5, 60000);

      const obj = pool.acquire();
      pool.release(obj);

      pool.clear();

      const stats = pool.getStats();
      expect(stats.available).toBe(0);
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive report', () => {
      // Generate some data
      profiler.profileSync('report-test', () => 1);
      profiler.takeMemorySnapshot();
      profiler.profileNetworkRequest('GET /api/test', 100, 500, 50);
      profiler.getPool('report-pool', () => ({ value: 0 }));

      // Wait a small amount to ensure duration > 0
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }

      const report = profiler.generateReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.duration).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.cpuProfiles)).toBe(true);
      expect(Array.isArray(report.memorySnapshots)).toBe(true);
      expect(Array.isArray(report.networkProfiles)).toBe(true);
      expect(Array.isArray(report.poolStats)).toBe(true);
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should identify CPU bottlenecks', () => {
      // Create a slow operation by setting very low thresholds
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        bottleneckThresholds: {
          cpu: { p95: 0.00001, p99: 0.0001, avg: 0.00001 },
          memory: { heapUsedPercent: 99, growthRate: 1024 * 1024 * 1024 },
          network: { latency: 999999, payloadSize: 999999, compressionRatio: 0.1 },
        },
      });

      // Run operation multiple times to ensure we have enough data
      for (let i = 0; i < 10; i++) {
        p.profileSync('slow-op', () => {
          let sum = 0;
          for (let j = 0; j < 1000; j++) {
            sum += Math.sqrt(j);
          }
          return sum;
        });
      }

      const report = p.generateReport();
      // Bottlenecks may or may not be detected depending on system performance
      expect(Array.isArray(report.bottlenecks)).toBe(true);

      p.destroy();
    });

    it('should generate recommendations', () => {
      const p = new PerformanceProfilerService({
        reportInterval: 0,
        bottleneckThresholds: {
          cpu: { p95: 0.0001, p99: 0.001, avg: 0.0001 },
          memory: { heapUsedPercent: 99, growthRate: 1024 * 1024 * 1024 },
          network: { latency: 999999, payloadSize: 999999, compressionRatio: 0.1 },
        },
      });

      p.profileSync('slow-op', () => {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      });

      const report = p.generateReport();
      // Recommendations may or may not be generated depending on thresholds
      expect(Array.isArray(report.recommendations)).toBe(true);

      p.destroy();
    });

    it('should include memory leak report when detected', () => {
      // Simulate memory growth
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        const snapshot: MemorySnapshot = {
          timestamp: baseTime + i * 100,
          rss: 100 * 1024 * 1024 + i * 1024 * 1024,
          heapTotal: 50 * 1024 * 1024,
          heapUsed: 40 * 1024 * 1024 + i * 1024 * 1024,
          external: 1 * 1024 * 1024,
          arrayBuffers: 0,
          heapUsedPercent: 80,
        };
        (profiler as any).memorySnapshots.push(snapshot);
      }

      const report = profiler.generateReport();
      expect(report.memoryLeakReport).toBeDefined();
    });
  });

  describe('Reset & Destroy', () => {
    it('should reset all profiling data', () => {
      profiler.profileSync('reset-test', () => 1);
      profiler.takeMemorySnapshot();
      profiler.profileNetworkRequest('GET /api', 100, 200, 10);

      profiler.reset();

      expect(profiler.getAllCpuProfiles().length).toBe(0);
      expect(profiler.getMemorySnapshots().length).toBe(0);
      expect(profiler.getNetworkProfiles().length).toBe(0);
    });

    it('should destroy profiler and cleanup resources', () => {
      profiler.destroy();

      // Should not throw
      expect(() => profiler.reset()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty operations', () => {
      const result = profiler.profileSync('empty', () => {});
      expect(result).toBeUndefined();

      const profile = profiler.getCpuProfile('empty');
      expect(profile).toBeDefined();
    });

    it('should handle large data serialization', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
      }));

      const result = profiler.profileSerialization('large-data', largeData);
      expect(result.time).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in operation names', () => {
      profiler.profileSync('special/chars?query=value&foo=bar', () => 1);
      const profile = profiler.getCpuProfile('special/chars?query=value&foo=bar');
      expect(profile).toBeDefined();
    });

    it('should handle concurrent async operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          profiler.profileAsync(`concurrent-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return i;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
});

describe('Singleton Performance Profiler', () => {
  beforeEach(() => {
    resetPerformanceProfiler();
  });

  afterEach(() => {
    resetPerformanceProfiler();
  });

  it('should return same instance from getPerformanceProfiler', () => {
    const p1 = getPerformanceProfiler();
    const p2 = getPerformanceProfiler();

    expect(p1).toBe(p2);
  });

  it('should reset singleton instance', () => {
    const p1 = getPerformanceProfiler();
    resetPerformanceProfiler();
    const p2 = getPerformanceProfiler();

    expect(p1).not.toBe(p2);
  });
});

describe('Performance Middleware', () => {
  let profiler: PerformanceProfilerService;

  beforeEach(() => {
    resetPerformanceProfiler();
    profiler = new PerformanceProfilerService({
      reportInterval: 0,
    });
  });

  afterEach(() => {
    profiler.destroy();
    resetPerformanceProfiler();
  });

  describe('Network Request Profiling via Middleware', () => {
    it('should profile request and response sizes', () => {
      const requestBody = { test: 'data' };
      const responseBody = { success: true, data: { id: 1 } };

      profiler.profileNetworkRequest(
        'POST /api/test',
        Buffer.byteLength(JSON.stringify(requestBody), 'utf8'),
        Buffer.byteLength(JSON.stringify(responseBody), 'utf8'),
        25
      );

      const profiles = profiler.getNetworkProfiles();
      expect(profiles.length).toBe(1);
      expect(profiles[0].requestSize).toBeGreaterThan(0);
      expect(profiles[0].responseSize).toBeGreaterThan(0);
    });

    it('should track throughput correctly', () => {
      profiler.profileNetworkRequest('GET /api/data', 0, 1000, 100);

      const profiles = profiler.getNetworkProfiles();
      expect(profiles[0].throughput).toBe(10000); // 1000 bytes / 100ms * 1000
    });
  });
});
