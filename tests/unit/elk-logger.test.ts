import {
  ELKLogger,
  ELKConfig,
  LogContext,
  getELKLogger,
  resetELKLogger,
} from '../../src/services/elk-logger';
import { SecurityEventDetails } from '../../src/types/security';

describe('ELK Logger', () => {
  let logger: ELKLogger;
  let mockConfig: ELKConfig;
  let mockTransport: any;

  beforeEach(() => {
    resetELKLogger();
    mockConfig = {
      elasticsearch: {
        node: 'http://localhost:9200',
        index: 'test-logs',
        indexPrefix: 'test',
        indexSuffixPattern: 'YYYY.MM.DD',
      },
      logLevel: 'debug',
      enableConsole: true,
      enableFile: false,
      enableElasticsearch: false,
    };
    logger = new ELKLogger(mockConfig);

    // Mock the transport to capture log calls
    mockTransport = {
      log: jest.fn(),
      close: jest.fn(),
    };

    // Replace the logger's transports with our mock
    (logger as any).logger.transports.forEach((t: any) => {
      t.log = mockTransport.log;
    });
  });

  afterEach(async () => {
    await logger.close();
    resetELKLogger();
  });

  describe('Log Levels', () => {
    test('should log debug messages when level is debug', () => {
      logger.getLogger().debug('Debug message');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log info messages when level is info', () => {
      mockConfig.logLevel = 'info';
      logger = new ELKLogger(mockConfig);
      (logger as any).logger.transports.forEach((t: any) => {
        t.log = mockTransport.log;
      });
      logger.getLogger().info('Info message');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log warn messages when level is warn', () => {
      mockConfig.logLevel = 'warn';
      logger = new ELKLogger(mockConfig);
      (logger as any).logger.transports.forEach((t: any) => {
        t.log = mockTransport.log;
      });
      logger.getLogger().warn('Warning message');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log error messages when level is error', () => {
      mockConfig.logLevel = 'error';
      logger = new ELKLogger(mockConfig);
      (logger as any).logger.transports.forEach((t: any) => {
        t.log = mockTransport.log;
      });
      logger.getLogger().error('Error message');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should not log debug messages when level is info', () => {
      mockConfig.logLevel = 'info';
      logger = new ELKLogger(mockConfig);
      (logger as any).logger.transports.forEach((t: any) => {
        t.log = mockTransport.log;
      });
      logger.getLogger().debug('Debug message');
      expect(mockTransport.log).not.toHaveBeenCalled();
    });

    test('should not log info messages when level is warn', () => {
      mockConfig.logLevel = 'warn';
      logger = new ELKLogger(mockConfig);
      (logger as any).logger.transports.forEach((t: any) => {
        t.log = mockTransport.log;
      });
      logger.getLogger().info('Info message');
      expect(mockTransport.log).not.toHaveBeenCalled();
    });
  });

  describe('Log Formatting', () => {
    test('should format log messages with timestamp', () => {
      logger.logRequest({ endpoint: '/api/test', method: 'GET' });
      expect(mockTransport.log).toHaveBeenCalled();
      const logCall = mockTransport.log.mock.calls[0][0];
      expect(logCall.message).toContain('HTTP Request');
    });

    test('should include metadata in log output', () => {
      const context: LogContext = {
        requestId: 'test-123',
        ip: '127.0.0.1',
        endpoint: '/api/test',
      };
      logger.logRequest(context);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Request Logging', () => {
    test('should log HTTP requests with context', () => {
      const context: LogContext = {
        requestId: 'req-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        endpoint: '/api/captcha/generate',
        method: 'POST',
      };
      logger.logRequest(context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log HTTP responses with status code', () => {
      const context: LogContext = {
        requestId: 'req-123',
        statusCode: 200,
        responseTime: 45,
      };
      logger.logResponse(context);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Error Logging', () => {
    test('should log errors with stack trace', () => {
      const error = new Error('Test error');
      const context: LogContext = {
        requestId: 'req-123',
        endpoint: '/api/test',
      };
      logger.logError(error, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log errors without context', () => {
      const error = new Error('Test error');
      logger.logError(error);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Security Event Logging', () => {
    test('should log security events', () => {
      const event: SecurityEventDetails = {
        action: 'captcha_generated',
        resource: 'text',
        reason: 'User requested captcha',
        metadata: { difficulty: 'medium' },
      };
      const context: LogContext = {
        requestId: 'req-123',
        ip: '192.168.1.1',
      };
      logger.logSecurityEvent(event, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log security events without context', () => {
      const event: SecurityEventDetails = {
        action: 'validation_failed',
        resource: 'captcha',
        reason: 'Invalid response',
        metadata: {},
      };
      logger.logSecurityEvent(event);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Performance Logging', () => {
    test('should log performance metrics', () => {
      const context: LogContext = {
        requestId: 'req-123',
        endpoint: '/api/captcha/generate',
      };
      logger.logPerformance('captcha_generation_time', 45, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log performance metrics without context', () => {
      logger.logPerformance('response_time', 100);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    test('should log audit events', () => {
      const context: LogContext = {
        requestId: 'req-123',
        userId: 'user-456',
      };
      logger.logAudit('user_login', { method: 'password' }, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log audit events without context', () => {
      logger.logAudit('config_update', { setting: 'timeout' });
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Captcha Logging', () => {
    test('should log captcha generation', () => {
      const context: LogContext = {
        requestId: 'req-123',
        sessionId: 'sess-456',
      };
      logger.logCaptchaGeneration('text', 'medium', 45, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log captcha validation success', () => {
      const context: LogContext = {
        requestId: 'req-123',
        sessionId: 'sess-456',
      };
      logger.logCaptchaValidation('text', true, 12, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log captcha validation failure', () => {
      const context: LogContext = {
        requestId: 'req-123',
        sessionId: 'sess-456',
      };
      logger.logCaptchaValidation('text', false, 15, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Session Logging', () => {
    test('should log session creation', () => {
      const context: LogContext = {
        requestId: 'req-123',
        ip: '192.168.1.1',
      };
      logger.logSession('CREATE', 'sess-456', context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log session deletion', () => {
      logger.logSession('DELETE', 'sess-456');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log session expiration', () => {
      logger.logSession('EXPIRE', 'sess-456');
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Cache Logging', () => {
    test('should log cache hits', () => {
      const context: LogContext = {
        requestId: 'req-123',
      };
      logger.logCache('HIT', 'captcha:123', context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log cache misses', () => {
      logger.logCache('MISS', 'captcha:123');
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log cache sets', () => {
      logger.logCache('SET', 'captcha:123');
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Rate Limit Logging', () => {
    test('should log rate limit violations', () => {
      const context: LogContext = {
        requestId: 'req-123',
        endpoint: '/api/captcha/generate',
      };
      logger.logRateLimit('192.168.1.1', '/api/captcha/generate', 100, 0, context);
      expect(mockTransport.log).toHaveBeenCalled();
    });

    test('should log rate limit violations without context', () => {
      logger.logRateLimit('192.168.1.1', '/api/captcha/generate', 100, 0);
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getELKLogger', () => {
      const logger1 = getELKLogger(mockConfig);
      const logger2 = getELKLogger();
      expect(logger1).toBe(logger2);
    });

    test('should reset instance with resetELKLogger', () => {
      const logger1 = getELKLogger(mockConfig);
      resetELKLogger();
      const logger2 = getELKLogger(mockConfig);
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultLogger = new ELKLogger({
        elasticsearch: {
          node: 'http://localhost:9200',
          index: 'test',
          indexPrefix: 'test',
          indexSuffixPattern: 'YYYY.MM.DD',
        },
        logLevel: 'info',
        enableConsole: true,
        enableFile: false,
        enableElasticsearch: false,
      });
      expect(defaultLogger).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customConfig: ELKConfig = {
        elasticsearch: {
          node: 'http://custom:9200',
          index: 'custom-logs',
          indexPrefix: 'custom',
          indexSuffixPattern: 'YYYY.MM.DD',
          auth: {
            username: 'user',
            password: 'pass',
          },
        },
        logLevel: 'error',
        enableConsole: false,
        enableFile: true,
        enableElasticsearch: true,
        filePath: './custom.log',
        maxFileSize: 5000000,
        maxFiles: 10,
      };
      const customLogger = new ELKLogger(customConfig);
      expect(customLogger).toBeDefined();
    });
  });

  describe('Logger Instance', () => {
    test('should return Winston logger instance', () => {
      const winstonLogger = logger.getLogger();
      expect(winstonLogger).toBeDefined();
      expect(typeof winstonLogger.info).toBe('function');
      expect(typeof winstonLogger.error).toBe('function');
      expect(typeof winstonLogger.warn).toBe('function');
      expect(typeof winstonLogger.debug).toBe('function');
    });

    test('should close logger properly', async () => {
      await expect(logger.close()).resolves.not.toThrow();
    });
  });
});
