import { Request, Response, NextFunction } from 'express';
import { getELKLogger, LogContext } from '../services/elk-logger';
import { v4 as uuidv4 } from 'uuid';

export interface LoggingRequest extends Request {
  requestId?: string;
  requestStartTime?: number;
}

/**
 * Logging middleware for Express
 * Logs all requests and responses with structured data for ELK Stack
 */
export function loggingMiddleware(req: LoggingRequest, res: Response, next: NextFunction): void {
  const logger = getELKLogger();

  // Generate unique request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestStartTime = Date.now();

  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Create log context
  const context: LogContext = {
    requestId: req.requestId,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method,
  };

  // Log request
  logger.logRequest({
    ...context,
    query: req.query,
    body: sanitizeBody(req.body),
    headers: sanitizeHeaders(req.headers),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body: any): Response {
    const responseTime = Date.now() - (req.requestStartTime || Date.now());

    // Log response
    logger.logResponse({
      ...context,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.getHeader('content-length'),
    });

    // Log performance metric
    logger.logPerformance('http_response_time', responseTime, {
      ...context,
      statusCode: res.statusCode,
    });

    // Call original send
    return originalSend.call(this, body);
  };

  // Handle errors
  res.on('error', (error: Error) => {
    logger.logError(error, {
      ...context,
      statusCode: res.statusCode,
    });
  });

  next();
}

/**
 * Error logging middleware
 * Logs all errors with structured data for ELK Stack
 */
export function errorLoggingMiddleware(
  error: Error,
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): void {
  const logger = getELKLogger();

  const context: LogContext = {
    requestId: req.requestId || (req.headers['x-request-id'] as string) || uuidv4(),
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method,
    statusCode: res.statusCode,
  };

  // Log error
  logger.logError(error, context);

  // Log security event if it's a security-related error
  if (isSecurityError(error)) {
    logger.logSecurityEvent(
      {
        action: 'error_occurred',
        resource: req.path,
        reason: error.message,
        metadata: {
          errorName: error.name,
          stack: error.stack,
        },
      },
      context
    );
  }

  next(error);
}

/**
 * Rate limit logging middleware
 * Logs rate limit violations
 */
export function rateLimitLoggingMiddleware(
  req: LoggingRequest,
  res: Response,
  next: NextFunction
): void {
  const logger = getELKLogger();

  // Check if rate limit was hit
  if (res.getHeader('X-RateLimit-Remaining') === '0') {
    const context: LogContext = {
      requestId: req.requestId || (req.headers['x-request-id'] as string) || uuidv4(),
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      method: req.method,
    };

    logger.logRateLimit(
      context.ip || 'unknown',
      req.path,
      parseInt((res.getHeader('X-RateLimit-Limit') as string) || '0'),
      parseInt((res.getHeader('X-RateLimit-Remaining') as string) || '0'),
      context
    );
  }

  next();
}

/**
 * Security event logging middleware
 * Logs security-related events
 */
export function securityLoggingMiddleware(
  req: LoggingRequest,
  _res: Response,
  next: NextFunction
): void {
  const logger = getELKLogger();

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection
    /<script[^>]*>[\s\S]*?<\/script>/gi, // XSS
    /javascript:/gi, // XSS
    /on\w+\s*=/gi, // XSS
    /(\.\.\/)|(\.\.\\)/gi, // Path traversal
    /\/etc\/passwd/gi, // Sensitive file access
    /\/proc\/self\/environ/gi, // Environment access
  ];

  const requestBody = JSON.stringify(req.body || {});
  const requestQuery = JSON.stringify(req.query || {});
  const requestPath = req.path;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestBody) || pattern.test(requestQuery) || pattern.test(requestPath)) {
      const context: LogContext = {
        requestId: req.requestId,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
      };

      logger.logSecurityEvent(
        {
          action: 'suspicious_pattern_detected',
          resource: req.path,
          reason: `Suspicious pattern detected: ${pattern.source}`,
          metadata: {
            pattern: pattern.source,
            body: requestBody.length > 500 ? requestBody.substring(0, 500) + '...' : requestBody,
            query:
              requestQuery.length > 500 ? requestQuery.substring(0, 500) + '...' : requestQuery,
          },
        },
        context
      );

      break;
    }
  }

  next();
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body: any): any {
  if (!body) {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: any): any {
  if (!headers) {
    return headers;
  }

  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };

  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Check if error is security-related
 */
function isSecurityError(error: Error): boolean {
  const securityErrorNames = [
    'UnauthorizedError',
    'ForbiddenError',
    'AuthenticationError',
    'AuthorizationError',
    'RateLimitError',
    'ValidationError',
  ];

  return (
    securityErrorNames.includes(error.name) ||
    error.message.toLowerCase().includes('unauthorized') ||
    error.message.toLowerCase().includes('forbidden') ||
    error.message.toLowerCase().includes('authentication') ||
    error.message.toLowerCase().includes('rate limit')
  );
}

export default {
  loggingMiddleware,
  errorLoggingMiddleware,
  rateLimitLoggingMiddleware,
  securityLoggingMiddleware,
};
