/**
 * Prometheus Metrics Service
 * Comprehensive metrics collection for CAPTCHA system monitoring
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { CaptchaType, CaptchaDifficulty } from '../types/captcha';

export interface MetricsLabels {
  method?: string;
  path?: string;
  status?: string;
  captchaType?: CaptchaType;
  difficulty?: CaptchaDifficulty;
  cacheLevel?: string;
  eventType?: string;
}

export class PrometheusMetricsService {
  private readonly registry: Registry;

  // Request metrics
  private requestCounter!: Counter<string>;
  private requestLatency!: Histogram<string>;
  private errorCounter!: Counter<string>;

  // CAPTCHA-specific metrics
  private captchaGenerationTime!: Histogram<string>;
  private captchaValidationTime!: Histogram<string>;
  private captchaGenerationCounter!: Counter<string>;
  private captchaValidationCounter!: Counter<string>;

  // Session metrics
  private activeSessions!: Gauge<string>;
  private sessionCreationCounter!: Counter<string>;
  private sessionDeletionCounter!: Counter<string>;

  // Cache metrics
  private cacheHitCounter!: Counter<string>;
  private cacheMissCounter!: Counter<string>;
  private cacheOperationDuration!: Histogram<string>;

  // Security metrics
  private securityEventCounter!: Counter<string>;
  private rateLimitCounter!: Counter<string>;

  // System metrics
  private memoryUsage!: Gauge<string>;
  private cpuUsage!: Gauge<string>;
  private uptime!: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry });

    this.initializeMetrics();
  }

  /**
   * Initialize all Prometheus metrics
   */
  private initializeMetrics(): void {
    // Request metrics
    this.requestCounter = new Counter({
      name: 'captcha_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.requestLatency = new Histogram({
      name: 'captcha_http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'captcha_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    // CAPTCHA generation metrics
    this.captchaGenerationTime = new Histogram({
      name: 'captcha_generation_duration_seconds',
      help: 'Time taken to generate captcha in seconds',
      labelNames: ['type', 'difficulty'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    this.captchaGenerationCounter = new Counter({
      name: 'captcha_generation_total',
      help: 'Total number of captcha generations',
      labelNames: ['type', 'difficulty', 'status'],
      registers: [this.registry],
    });

    // CAPTCHA validation metrics
    this.captchaValidationTime = new Histogram({
      name: 'captcha_validation_duration_seconds',
      help: 'Time taken to validate captcha in seconds',
      labelNames: ['type', 'difficulty'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [this.registry],
    });

    this.captchaValidationCounter = new Counter({
      name: 'captcha_validation_total',
      help: 'Total number of captcha validations',
      labelNames: ['type', 'difficulty', 'result'],
      registers: [this.registry],
    });

    // Session metrics
    this.activeSessions = new Gauge({
      name: 'captcha_active_sessions',
      help: 'Number of active captcha sessions',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.sessionCreationCounter = new Counter({
      name: 'captcha_sessions_created_total',
      help: 'Total number of sessions created',
      labelNames: ['type', 'difficulty'],
      registers: [this.registry],
    });

    this.sessionDeletionCounter = new Counter({
      name: 'captcha_sessions_deleted_total',
      help: 'Total number of sessions deleted',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    // Cache metrics
    this.cacheHitCounter = new Counter({
      name: 'captcha_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['level'],
      registers: [this.registry],
    });

    this.cacheMissCounter = new Counter({
      name: 'captcha_cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'captcha_cache_operation_duration_seconds',
      help: 'Cache operation duration in seconds',
      labelNames: ['operation', 'level'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
      registers: [this.registry],
    });

    // Security metrics
    this.securityEventCounter = new Counter({
      name: 'captcha_security_events_total',
      help: 'Total number of security events',
      labelNames: ['action', 'resource'],
      registers: [this.registry],
    });

    this.rateLimitCounter = new Counter({
      name: 'captcha_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint'],
      registers: [this.registry],
    });

    // System metrics
    this.memoryUsage = new Gauge({
      name: 'captcha_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.cpuUsage = new Gauge({
      name: 'captcha_cpu_usage_seconds',
      help: 'CPU usage in seconds',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.uptime = new Gauge({
      name: 'captcha_uptime_seconds',
      help: 'Server uptime in seconds',
      registers: [this.registry],
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(method: string, path: string, status: number, duration: number): void {
    const labels = { method, path, status: status.toString() };

    this.requestCounter.inc(labels);
    this.requestLatency.observe(labels, duration / 1000);

    if (status >= 400) {
      this.errorCounter.inc(labels);
    }
  }

  /**
   * Record captcha generation metrics
   */
  recordCaptchaGeneration(
    type: CaptchaType,
    difficulty: CaptchaDifficulty,
    duration: number,
    success: boolean
  ): void {
    const labels = { type, difficulty };

    this.captchaGenerationTime.observe(labels, duration / 1000);
    this.captchaGenerationCounter.inc({
      ...labels,
      status: success ? 'success' : 'failure',
    });
  }

  /**
   * Record captcha validation metrics
   */
  recordCaptchaValidation(
    type: CaptchaType,
    difficulty: CaptchaDifficulty,
    duration: number,
    isCorrect: boolean
  ): void {
    const labels = { type, difficulty };

    this.captchaValidationTime.observe(labels, duration / 1000);
    this.captchaValidationCounter.inc({
      ...labels,
      result: isCorrect ? 'correct' : 'incorrect',
    });
  }

  /**
   * Update active sessions gauge
   */
  updateActiveSessions(type: CaptchaType, count: number): void {
    this.activeSessions.set({ type }, count);
  }

  /**
   * Record session creation
   */
  recordSessionCreation(type: CaptchaType, difficulty: CaptchaDifficulty): void {
    this.sessionCreationCounter.inc({ type, difficulty });
  }

  /**
   * Record session deletion
   */
  recordSessionDeletion(reason: string): void {
    this.sessionDeletionCounter.inc({ reason });
  }

  /**
   * Record cache hit
   */
  recordCacheHit(level: string): void {
    this.cacheHitCounter.inc({ level });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMissCounter.inc();
  }

  /**
   * Record cache operation duration
   */
  recordCacheOperation(operation: string, level: string, duration: number): void {
    this.cacheOperationDuration.observe({ operation, level }, duration / 1000);
  }

  /**
   * Record security event
   */
  recordSecurityEvent(action: string, resource: string): void {
    this.securityEventCounter.inc({ action, resource });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string): void {
    this.rateLimitCounter.inc({ endpoint });
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.memoryUsage.set({ type: 'rss' }, memoryUsage.rss);
    this.memoryUsage.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
    this.memoryUsage.set({ type: 'external' }, memoryUsage.external);

    this.cpuUsage.set({ type: 'user' }, cpuUsage.user / 1000000);
    this.cpuUsage.set({ type: 'system' }, cpuUsage.system / 1000000);

    this.uptime.set(process.uptime());
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    this.updateSystemMetrics();
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsAsJSON(): Promise<any> {
    this.updateSystemMetrics();
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.registry.resetMetrics();
  }

  /**
   * Get registry instance
   */
  getRegistry(): Registry {
    return this.registry;
  }
}

// Export singleton instance
export const prometheusMetrics = new PrometheusMetricsService();
