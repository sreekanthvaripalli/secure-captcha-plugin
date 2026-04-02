/**
 * Performance Profiling Middleware
 * Integrates performance profiling into Express request/response lifecycle
 */

import { Request, Response, NextFunction } from 'express';
import {
  getPerformanceProfiler,
  PerformanceProfilerService,
} from '../services/performance-profiler';

export interface PerformanceRequest extends Request {
  performanceStartTime?: number;
  performanceStartCpu?: NodeJS.CpuUsage;
  performanceStartWall?: bigint;
}

export interface PerformanceMiddlewareConfig {
  enabled: boolean;
  sampleRate: number; // percentage of requests to profile (0-100)
  trackRequestBodySize: boolean;
  trackResponseBodySize: boolean;
  trackSerialization: boolean;
  excludePaths: string[];
  includePaths: string[]; // if specified, only profile these paths
}

const DEFAULT_CONFIG: PerformanceMiddlewareConfig = {
  enabled: true,
  sampleRate: 100,
  trackRequestBodySize: true,
  trackResponseBodySize: true,
  trackSerialization: true,
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  includePaths: [],
};

/**
 * Performance profiling middleware for Express
 * Tracks request/response timing, payload sizes, and serialization overhead
 */
export function performanceMiddleware(
  config?: Partial<PerformanceMiddlewareConfig>
): (req: PerformanceRequest, res: Response, next: NextFunction) => void {
  const mergedConfig: PerformanceMiddlewareConfig = { ...DEFAULT_CONFIG, ...config };
  const profiler = getPerformanceProfiler();

  return (req: PerformanceRequest, res: Response, next: NextFunction): void => {
    // Check if profiling is enabled
    if (!mergedConfig.enabled) {
      next();
      return;
    }

    // Check path exclusions
    if (mergedConfig.excludePaths.some(path => req.path.startsWith(path))) {
      next();
      return;
    }

    // Check path inclusions (if specified)
    if (
      mergedConfig.includePaths.length > 0 &&
      !mergedConfig.includePaths.some(path => req.path.startsWith(path))
    ) {
      next();
      return;
    }

    // Sample rate check
    if (mergedConfig.sampleRate < 100 && Math.random() * 100 >= mergedConfig.sampleRate) {
      next();
      return;
    }

    // Record start time
    req.performanceStartTime = Date.now();
    req.performanceStartCpu = process.cpuUsage();
    req.performanceStartWall = process.hrtime.bigint();

    // Track response
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (body: any): Response {
      const result = originalSend.call(this, body);
      recordPerformance(req, res, profiler, mergedConfig, body);
      return result;
    };

    res.json = function (body: any): Response {
      const result = originalJson.call(this, body);
      recordPerformance(req, res, profiler, mergedConfig, body);
      return result;
    };

    // Add performance headers to response
    res.setHeader('X-Performance-Tracking', 'enabled');

    next();
  };
}

/**
 * Record performance metrics for a request/response
 */
function recordPerformance(
  req: PerformanceRequest,
  res: Response,
  profiler: PerformanceProfilerService,
  config: PerformanceMiddlewareConfig,
  responseBody: any
): void {
  if (!req.performanceStartTime) {
    return;
  }

  const duration = Date.now() - req.performanceStartTime;

  // Calculate request size
  let requestSize = 0;
  if (config.trackRequestBodySize && req.body) {
    try {
      requestSize = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
    } catch {
      requestSize = 0;
    }
  }

  // Calculate response size
  let responseSize = 0;
  if (config.trackResponseBodySize && responseBody) {
    try {
      responseSize = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    } catch {
      responseSize = 0;
    }
  }

  // Track serialization time if enabled
  let serializationTime = 0;
  if (config.trackSerialization && responseBody) {
    const result = profiler.profileSerialization('response', responseBody);
    serializationTime = result.time;
  }

  // Profile the network request
  const operation = `${req.method} ${req.path}`;
  profiler.profileNetworkRequest(operation, requestSize, responseSize, duration, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    query: Object.keys(req.query || {}).length > 0 ? JSON.stringify(req.query) : undefined,
    requestSize,
    responseSize,
    serializationTime,
  });

  // Add performance headers
  if (!res.headersSent) {
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Request-Size', `${requestSize} bytes`);
    res.setHeader('X-Response-Size', `${responseSize} bytes`);
  }
}

/**
 * Performance endpoint middleware
 * Exposes performance report via HTTP endpoint
 */
export function performanceEndpoint(_req: Request, res: Response, _next: NextFunction): void {
  const profiler = getPerformanceProfiler();
  const report = profiler.generateReport();

  res.json({
    success: true,
    data: {
      timestamp: report.timestamp,
      duration: report.duration,
      summary: {
        cpuOperations: report.cpuProfiles.length,
        memorySnapshots: report.memorySnapshots.length,
        networkRequests: report.networkProfiles.length,
        objectPools: report.poolStats.length,
        bottlenecks: report.bottlenecks.length,
        recommendations: report.recommendations.length,
      },
      bottlenecks: report.bottlenecks,
      recommendations: report.recommendations,
      cpuProfiles: report.cpuProfiles,
      memoryLeakReport: report.memoryLeakReport,
      poolStats: report.poolStats,
    },
  });
}

/**
 * Performance health check middleware
 * Returns performance health status
 */
export function performanceHealthCheck(_req: Request, res: Response, _next: NextFunction): void {
  const profiler = getPerformanceProfiler();
  const report = profiler.generateReport();

  const criticalBottlenecks = report.bottlenecks.filter(b => b.severity === 'critical');
  const highBottlenecks = report.bottlenecks.filter(b => b.severity === 'high');

  let status = 'healthy';
  if (criticalBottlenecks.length > 0) {
    status = 'critical';
  } else if (highBottlenecks.length > 2) {
    status = 'degraded';
  } else if (highBottlenecks.length > 0) {
    status = 'warning';
  }

  res.json({
    status,
    bottlenecks: {
      critical: criticalBottlenecks.length,
      high: highBottlenecks.length,
      total: report.bottlenecks.length,
    },
    recommendations: report.recommendations.length,
  });
}

/**
 * Profile a specific route handler
 * Use this to wrap route handlers for detailed profiling
 */
export function profileHandler<T extends (...args: any[]) => any>(
  operation: string,
  handler: T
): T {
  const profiler = getPerformanceProfiler();

  return ((...args: any[]) => {
    const nextIndex = args.findIndex(arg => typeof arg === 'function' && arg.name === 'next');
    const next = args[nextIndex];

    if (next) {
      // Async handler
      if (handler.constructor.name === 'AsyncFunction') {
        return profiler.profileAsync(operation, () => handler(...args)).catch(err => next(err));
      }
      // Sync handler
      return profiler.profileSync(operation, () => handler(...args));
    }

    // No next function (route handler returning response)
    if (handler.constructor.name === 'AsyncFunction') {
      return profiler.profileAsync(operation, () => handler(...args));
    }
    return profiler.profileSync(operation, () => handler(...args));
  }) as T;
}

export default {
  performanceMiddleware,
  performanceEndpoint,
  performanceHealthCheck,
  profileHandler,
};
