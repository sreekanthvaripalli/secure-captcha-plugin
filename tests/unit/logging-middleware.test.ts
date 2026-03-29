import { Request, Response, NextFunction } from 'express';
import {
  loggingMiddleware,
  errorLoggingMiddleware,
  rateLimitLoggingMiddleware,
  securityLoggingMiddleware,
  LoggingRequest,
} from '../../src/middleware/logging-middleware';
import { resetELKLogger } from '../../src/services/elk-logger';

describe('Logging Middleware', () => {
  let mockRequest: Partial<LoggingRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockLogger: any;

  beforeEach(() => {
    resetELKLogger();

    mockRequest = {
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-request-id': 'test-req-123',
      },
      path: '/api/captcha/generate',
      method: 'POST',
      query: { type: 'text' },
      body: { difficulty: 'medium' },
    };

    mockResponse = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      statusCode: 200,
      send: jest.fn(),
      on: jest.fn(),
    };

    nextFunction = jest.fn();

    mockLogger = {
      logRequest: jest.fn(),
      logResponse: jest.fn(),
      logError: jest.fn(),
      logPerformance: jest.fn(),
      logRateLimit: jest.fn(),
      logSecurityEvent: jest.fn(),
    };

    jest
      .spyOn(require('../../src/services/elk-logger'), 'getELKLogger')
      .mockReturnValue(mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetELKLogger();
  });

  describe('loggingMiddleware', () => {
    test('should generate request ID if not provided', () => {
      delete mockRequest.headers!['x-request-id'];

      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.requestId).toBeDefined();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    });

    test('should use existing request ID from headers', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.requestId).toBe('test-req-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-req-123');
    });

    test('should set request start time', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.requestStartTime).toBeDefined();
      expect(typeof mockRequest.requestStartTime).toBe('number');
    });

    test('should log request with context', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-req-123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/captcha/generate',
          method: 'POST',
        })
      );
    });

    test('should call next function', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should capture response and log it', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Simulate response send
      (mockResponse.send as jest.Mock)('response body');

      expect(mockLogger.logResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-req-123',
          statusCode: 200,
          responseTime: expect.any(Number),
        })
      );
    });

    test('should log performance metric on response', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Simulate response send
      (mockResponse.send as jest.Mock)('response body');

      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'http_response_time',
        expect.any(Number),
        expect.objectContaining({
          requestId: 'test-req-123',
          statusCode: 200,
        })
      );
    });

    test('should handle errors on response', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Get the error handler
      const errorHandler = (mockResponse.on as jest.Mock).mock.calls[0][1];
      const testError = new Error('Test error');

      errorHandler(testError);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          requestId: 'test-req-123',
          statusCode: 200,
        })
      );
    });

    test('should sanitize sensitive body fields', () => {
      mockRequest.body = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
      };

      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            username: 'testuser',
            password: '***REDACTED***',
            token: '***REDACTED***',
          },
        })
      );
    });

    test('should sanitize sensitive headers', () => {
      mockRequest.headers!['authorization'] = 'Bearer token123';
      mockRequest.headers!['cookie'] = 'session=abc';

      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '***REDACTED***',
            cookie: '***REDACTED***',
          }),
        })
      );
    });
  });

  describe('errorLoggingMiddleware', () => {
    test('should log error with context', () => {
      const testError = new Error('Test error');

      errorLoggingMiddleware(
        testError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          requestId: 'test-req-123',
          ip: '192.168.1.1',
          endpoint: '/api/captcha/generate',
          method: 'POST',
          statusCode: 200,
        })
      );
    });

    test('should log security event for security-related errors', () => {
      const securityError = new Error('Unauthorized access');
      securityError.name = 'UnauthorizedError';

      errorLoggingMiddleware(
        securityError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'error_occurred',
          resource: '/api/captcha/generate',
          reason: 'Unauthorized access',
        }),
        expect.any(Object)
      );
    });

    test('should not log security event for non-security errors', () => {
      const regularError = new Error('Regular error');

      errorLoggingMiddleware(
        regularError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logSecurityEvent).not.toHaveBeenCalled();
    });

    test('should call next with error', () => {
      const testError = new Error('Test error');

      errorLoggingMiddleware(
        testError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(testError);
    });

    test('should detect forbidden errors', () => {
      const forbiddenError = new Error('Forbidden');

      errorLoggingMiddleware(
        forbiddenError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should detect authentication errors', () => {
      const authError = new Error('Authentication failed');

      errorLoggingMiddleware(
        authError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should detect rate limit errors', () => {
      const rateLimitError = new Error('Rate limit exceeded');

      errorLoggingMiddleware(
        rateLimitError,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });
  });

  describe('rateLimitLoggingMiddleware', () => {
    test('should log rate limit violation when remaining is 0', () => {
      (mockResponse.getHeader as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-RateLimit-Remaining') return '0';
        if (header === 'X-RateLimit-Limit') return '100';
        return undefined;
      });

      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRateLimit).toHaveBeenCalledWith(
        '192.168.1.1',
        '/api/captcha/generate',
        100,
        0,
        expect.objectContaining({
          requestId: 'test-req-123',
          ip: '192.168.1.1',
          endpoint: '/api/captcha/generate',
          method: 'POST',
        })
      );
    });

    test('should not log when rate limit not exceeded', () => {
      (mockResponse.getHeader as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-RateLimit-Remaining') return '50';
        return undefined;
      });

      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRateLimit).not.toHaveBeenCalled();
    });

    test('should call next function', () => {
      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should handle missing rate limit headers', () => {
      (mockResponse.getHeader as jest.Mock).mockReturnValue(undefined);

      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logRateLimit).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('securityLoggingMiddleware', () => {
    test('should detect SQL injection patterns', () => {
      mockRequest.body = { input: "'; DROP TABLE users; --" };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'suspicious_pattern_detected',
          resource: '/api/captcha/generate',
          reason: expect.stringContaining('Suspicious pattern detected'),
        }),
        expect.any(Object)
      );
    });

    test('should detect XSS patterns in body', () => {
      mockRequest.body = { input: '<script>alert("xss")</script>' };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should detect XSS patterns in query', () => {
      mockRequest.query = { input: 'javascript:alert(1)' };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should detect path traversal patterns', () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/../../../etc/passwd',
        writable: true,
      });

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should detect sensitive file access attempts', () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/read?file=/etc/passwd',
        writable: true,
      });

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    test('should not log for clean requests', () => {
      mockRequest.body = { input: 'normal text' };
      mockRequest.query = { type: 'text' };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).not.toHaveBeenCalled();
    });

    test('should call next function', () => {
      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should log only once per request even with multiple patterns', () => {
      mockRequest.body = {
        input1: "'; DROP TABLE users; --",
        input2: '<script>alert("xss")</script>',
      };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalledTimes(1);
    });

    test('should truncate large body in security logs', () => {
      const largeInput = 'a'.repeat(1000);
      mockRequest.body = { input: `'; DROP TABLE users; -- ${largeInput}` };

      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            body: expect.stringMatching(/.+\.\.\.$/),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Integration', () => {
    test('should work with all middleware together', () => {
      // Setup
      (mockResponse.getHeader as jest.Mock).mockImplementation((header: string) => {
        if (header === 'X-RateLimit-Remaining') return '0';
        if (header === 'X-RateLimit-Limit') return '100';
        return undefined;
      });

      // Run all middleware
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify all logged
      expect(mockLogger.logRequest).toHaveBeenCalled();
      expect(mockLogger.logRateLimit).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledTimes(3);
    });

    test('should preserve request ID across middleware', () => {
      loggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const requestId = mockRequest.requestId;

      rateLimitLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      securityLoggingMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.requestId).toBe(requestId);
    });
  });
});
