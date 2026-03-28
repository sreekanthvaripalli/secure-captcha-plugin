import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { SecurityEventDetails } from '../types/security';

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  captchaType?: string;
  difficulty?: string;
  [key: string]: any;
}

export interface ELKConfig {
  elasticsearch: {
    node: string;
    index: string;
    indexPrefix: string;
    indexSuffixPattern: string;
    auth?: {
      username: string;
      password: string;
    };
    ssl?: {
      rejectUnauthorized: boolean;
    };
  };
  logLevel: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableElasticsearch: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export class ELKLogger {
  private logger: winston.Logger;
  private config: ELKConfig;

  constructor(config: ELKConfig) {
    this.config = config;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.config.logLevel,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
            })
          )
        })
      );
    }

    // File transport
    if (this.config.enableFile && this.config.filePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          level: this.config.logLevel,
          maxsize: this.config.maxFileSize || 10 * 1024 * 1024, // 10MB
          maxFiles: this.config.maxFiles || 5,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );
    }

    // Elasticsearch transport
    if (this.config.enableElasticsearch) {
      const esTransport = new ElasticsearchTransport({
        level: this.config.logLevel,
        index: this.config.elasticsearch.index,
        indexPrefix: this.config.elasticsearch.indexPrefix,
        indexSuffixPattern: this.config.elasticsearch.indexSuffixPattern,
        clientOpts: {
          node: this.config.elasticsearch.node,
          auth: this.config.elasticsearch.auth
        },
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      });
      transports.push(esTransport);
    }

    return winston.createLogger({
      level: this.config.logLevel,
      defaultMeta: { service: 'secure-captcha-plugin' },
      transports,
      exceptionHandlers: transports,
      rejectionHandlers: transports
    });
  }

  /**
   * Log request/response
   */
  logRequest(context: LogContext): void {
    this.logger.info('HTTP Request', {
      type: 'REQUEST',
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  logResponse(context: LogContext): void {
    this.logger.info('HTTP Response', {
      type: 'RESPONSE',
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error
   */
  logError(error: Error, context?: LogContext): void {
    this.logger.error('Error occurred', {
      type: 'ERROR',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: SecurityEventDetails, context?: LogContext): void {
    this.logger.warn('Security Event', {
      type: 'SECURITY_EVENT',
      severity: 'INFO',
      eventType: event.action,
      details: event,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(metric: string, value: number, context?: LogContext): void {
    this.logger.info('Performance Metric', {
      type: 'PERFORMANCE',
      metric,
      value,
      unit: 'ms',
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log audit event
   */
  logAudit(action: string, details: any, context?: LogContext): void {
    this.logger.info('Audit Event', {
      type: 'AUDIT',
      action,
      details,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log captcha generation
   */
  logCaptchaGeneration(
    captchaType: string,
    difficulty: string,
    responseTime: number,
    context?: LogContext
  ): void {
    this.logger.info('Captcha Generated', {
      type: 'CAPTCHA_GENERATION',
      captchaType,
      difficulty,
      responseTime,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log captcha validation
   */
  logCaptchaValidation(
    captchaType: string,
    isValid: boolean,
    responseTime: number,
    context?: LogContext
  ): void {
    this.logger.info('Captcha Validated', {
      type: 'CAPTCHA_VALIDATION',
      captchaType,
      isValid,
      responseTime,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log session event
   */
  logSession(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPIRE',
    sessionId: string,
    context?: LogContext
  ): void {
    this.logger.info('Session Event', {
      type: 'SESSION',
      action,
      sessionId,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log cache event
   */
  logCache(
    action: 'HIT' | 'MISS' | 'SET' | 'DELETE',
    key: string,
    context?: LogContext
  ): void {
    this.logger.debug('Cache Event', {
      type: 'CACHE',
      action,
      key,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log rate limit event
   */
  logRateLimit(
    ip: string,
    endpoint: string,
    limit: number,
    current: number,
    context?: LogContext
  ): void {
    this.logger.warn('Rate Limit', {
      type: 'RATE_LIMIT',
      ip,
      endpoint,
      limit,
      current,
      remaining: limit - current,
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get underlying Winston logger
   */
  getLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Close logger and all transports
   */
  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 1000);
      
      this.logger.on('finish', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.logger.end();
    });
  }
}

// Default configuration
export const defaultELKConfig: ELKConfig = {
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    index: 'secure-captcha-logs',
    indexPrefix: 'secure-captcha',
    indexSuffixPattern: 'YYYY.MM.DD',
    auth: process.env.ELASTICSEARCH_USERNAME
      ? {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD || ''
        }
      : undefined,
    ssl: {
      rejectUnauthorized: process.env.ELASTICSEARCH_SSL_VERIFY !== 'false'
    }
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableFile: process.env.LOG_FILE === 'true',
  enableElasticsearch: process.env.LOG_ELASTICSEARCH === 'true',
  filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
};

// Singleton instance
let elkLoggerInstance: ELKLogger | null = null;

export function getELKLogger(config?: ELKConfig): ELKLogger {
  if (!elkLoggerInstance) {
    elkLoggerInstance = new ELKLogger(config || defaultELKConfig);
  }
  return elkLoggerInstance;
}

export function resetELKLogger(): void {
  if (elkLoggerInstance) {
    elkLoggerInstance.close();
    elkLoggerInstance = null;
  }
}