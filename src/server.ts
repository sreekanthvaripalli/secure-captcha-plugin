/**
 * Express.js API Server
 * Production-ready server with clustering, middleware, and comprehensive error handling
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cluster from 'cluster';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { CaptchaService } from './core/captcha-service';
import { SecurityConfigurationService } from './security/config';
import { InputValidationService } from './security/input-validation';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export class CaptchaServer {
  private app: Application;
  private captchaService: CaptchaService;
  private configService: SecurityConfigurationService;
  private validationService: InputValidationService;
  private port: number;
  private workers: number;

  constructor(port: number = 3000, workers: number = os.cpus().length) {
    this.app = express();
    this.port = port;
    this.workers = workers;
    this.captchaService = new CaptchaService();
    this.configService = new SecurityConfigurationService();
    this.validationService = new InputValidationService();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware chain
   */
  private setupMiddleware(): void {
    // Security headers with Helmet.js
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration
    this.app.use(cors(this.configService.getCorsConfig()));

    // Response compression
    this.app.use(compression());

    // Request ID generation
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      req.id = uuidv4();
      req.startTime = Date.now();
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId: req.id,
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }));
      });

      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: this.configService.getConfig().app.rateLimitRequests,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request validation middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      // Validate request body for SQL injection and XSS
      if (req.body && typeof req.body === 'object') {
        const validation = this.validationService.validateParameterPollution(req.body);
        if (!validation.isValid) {
          const error = new Error(`Request validation failed: ${validation.threat}`);
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }
      }

      // Validate query parameters
      if (req.query && typeof req.query === 'object') {
        const validation = this.validationService.validateParameterPollution(req.query as Record<string, unknown>);
        if (!validation.isValid) {
          const error = new Error(`Query validation failed: ${validation.threat}`);
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }
      }

      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/v1/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/api/v1/metrics', (_req: Request, res: Response) => {
      const metrics = this.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });

    // Captcha generation endpoint
    this.app.post('/api/v1/captcha/generate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { type, difficulty, options } = req.body;

        // Validate required fields
        if (!type) {
          const error = new Error('Captcha type is required');
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }

        if (!difficulty) {
          const error = new Error('Difficulty level is required');
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }

        // Validate type
        if (!this.captchaService.isSupportedType(type)) {
          const error = new Error(`Unsupported captcha type: ${type}`);
          (error as any).status = 400;
          (error as any).code = 'INVALID_CAPTCHA_TYPE';
          return next(error);
        }

        // Generate captcha
        const response = await this.captchaService.generateCaptcha(type, difficulty, {
          ...options,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.json({
          success: true,
          data: response,
        });

      } catch (error) {
        next(error);
      }
    });

    // Captcha validation endpoint
    this.app.post('/api/v1/captcha/validate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sessionId, response, type } = req.body;

        // Validate required fields
        if (!sessionId) {
          const error = new Error('Session ID is required');
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }

        if (!response) {
          const error = new Error('Response is required');
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }

        if (!type) {
          const error = new Error('Captcha type is required');
          (error as any).status = 400;
          (error as any).code = 'INVALID_REQUEST';
          return next(error);
        }

        // Validate captcha
        const result = await this.captchaService.validateResponse(sessionId, response, type);

        res.json({
          success: true,
          data: result,
        });

      } catch (error) {
        next(error);
      }
    });

    // List available captcha types
    this.app.get('/api/v1/captcha/types', (_req: Request, res: Response) => {
      const types = this.captchaService.getAvailableTypes();
      res.json({
        success: true,
        data: {
          types: types.map(type => ({
            type,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Captcha`,
            difficulties: ['easy', 'medium', 'hard'],
          })),
        },
      });
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || 500;
      const code = err.code || 'INTERNAL_ERROR';
      const message = err.message || 'An unexpected error occurred';

      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: req.id,
        error: {
          code,
          message,
          stack: err.stack,
        },
        request: {
          method: req.method,
          url: req.url,
          ip: req.ip,
        },
      }));

      res.status(status).json({
        success: false,
        error: {
          code,
          message,
          requestId: req.id,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      console.error('Unhandled Rejection:', reason);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.shutdown();
    });
  }

  /**
   * Get Prometheus metrics
   */
  private getMetrics(): string {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return `
# HELP captcha_server_uptime_seconds Server uptime in seconds
# TYPE captcha_server_uptime_seconds gauge
captcha_server_uptime_seconds ${process.uptime()}

# HELP captcha_server_memory_bytes Memory usage in bytes
# TYPE captcha_server_memory_bytes gauge
captcha_server_memory_bytes{type="rss"} ${memoryUsage.rss}
captcha_server_memory_bytes{type="heapTotal"} ${memoryUsage.heapTotal}
captcha_server_memory_bytes{type="heapUsed"} ${memoryUsage.heapUsed}
captcha_server_memory_bytes{type="external"} ${memoryUsage.external}

# HELP captcha_server_cpu_microseconds CPU usage in microseconds
# TYPE captcha_server_cpu_microseconds counter
captcha_server_cpu_microseconds{type="user"} ${cpuUsage.user}
captcha_server_cpu_microseconds{type="system"} ${cpuUsage.system}

# HELP captcha_server_active_sessions Number of active captcha sessions
# TYPE captcha_server_active_sessions gauge
captcha_server_active_sessions 0
`.trim();
  }

  /**
   * Start the server with clustering
   */
  public start(): void {
    if (cluster.isPrimary && this.workers > 1) {
      console.log(`Primary process ${process.pid} is running`);
      console.log(`Starting ${this.workers} workers...`);

      // Fork workers
      for (let i = 0; i < this.workers; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
        console.log('Starting a new worker...');
        cluster.fork();
      });

    } else {
      this.app.listen(this.port, () => {
        console.log(`Worker ${process.pid} started on port ${this.port}`);
        console.log(`Health check: http://localhost:${this.port}/api/v1/health`);
        console.log(`Metrics: http://localhost:${this.port}/api/v1/metrics`);
      });
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    console.log('Shutting down server...');
    process.exit(0);
  }

  /**
   * Get Express app instance
   */
  public getApp(): Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const workers = parseInt(process.env.WORKERS || '1', 10);
  
  const server = new CaptchaServer(port, workers);
  server.start();
}

export default CaptchaServer;