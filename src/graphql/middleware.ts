/**
 * GraphQL Middleware for Secure CAPTCHA Plugin
 *
 * Provides:
 * - Express middleware integration
 * - JWT/API Key authentication
 * - Rate limiting per client
 * - Request validation
 * - Security logging
 */

import { Request, Response } from 'express';
import { graphqlHTTP } from 'express-graphql';
import { schema } from './schema';
import { JWTService } from '../security/jwt';
import { APIKeyService } from '../security/api-key';
import { SecurityLogger } from '../security/security-logger';
import rateLimit from 'express-rate-limit';

// GraphQL context interface
export interface GraphQLContext {
  req: Request;
  res: Response;
  user?: {
    userId: string;
    clientId: string;
    scope: string[];
    roles: string[];
  };
  apiKey?: {
    keyId: string;
    userId: string;
    permissions: string[];
    scopes: string[];
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

// Rate limiter configuration
const graphqlRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    errors: [
      {
        message: 'Too many requests, please try again later',
        extensions: { code: 'RATE_LIMITED' },
      },
    ],
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  },
});

// Create security logger instance
function createSecurityLogger(): SecurityLogger {
  return new SecurityLogger({
    level: 'info',
    enableFileLogging: false,
    logFilePath: './logs/security.log',
    maxLogFileSize: 10485760,
    maxLogFiles: 5,
  });
}

// Authentication middleware
async function authenticateRequest(
  req: Request
): Promise<GraphQLContext['user'] | GraphQLContext['apiKey'] | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  // Try JWT first
  try {
    const jwtService = new JWTService(
      {
        secret: process.env.JWT_SECRET || 'default-secret',
        issuer: process.env.JWT_ISSUER || 'secure-captcha',
        audience: process.env.JWT_AUDIENCE || 'secure-captcha-api',
      },
      createSecurityLogger()
    );

    const decoded = jwtService.validateToken(token);
    if (decoded.valid && decoded.payload) {
      return {
        userId: decoded.payload.sub || '',
        clientId: (decoded.payload as any).clientId || '',
        scope: ((decoded.payload as any).scope as string[]) || [],
        roles: ((decoded.payload as any).roles as string[]) || [],
      };
    }
  } catch {
    // JWT validation failed, try API key
  }

  // Try API key
  try {
    const apiKeyService = new APIKeyService(
      {
        enableKeyHashing: true,
        enableRateLimiting: true,
      },
      createSecurityLogger()
    );

    const validation = apiKeyService.validateAPIKey(token, {
      endpoint: '/graphql',
      method: 'POST',
    });

    if (validation.valid) {
      return {
        keyId: validation.keyId || '',
        userId: validation.userId || '',
        permissions: validation.permissions || [],
        scopes: validation.scopes || [],
      };
    }
  } catch {
    // API key validation failed
  }

  return null;
}

// Check authorization
function checkAuthorization(context: GraphQLContext, requiredScope?: string): boolean {
  if (!requiredScope) {
    return true;
  }

  if (context.user) {
    if (context.user.scope.includes('*') || context.user.scope.includes(requiredScope)) {
      return true;
    }
  }

  if (context.apiKey) {
    if (context.apiKey.scopes.includes('*') || context.apiKey.scopes.includes(requiredScope)) {
      return true;
    }
  }

  return false;
}

// Create GraphQL middleware
export function createGraphQLMiddleware(options?: {
  requireAuth?: boolean;
  requiredScope?: string;
  enablePlayground?: boolean;
  enableTracing?: boolean;
}): any {
  const {
    requireAuth = false,
    requiredScope,
    enablePlayground = process.env.NODE_ENV !== 'production',
  } = options || {};

  return [
    graphqlRateLimiter,
    graphqlHTTP({
      schema: schema,
      graphiql: enablePlayground,
      context: async (req: Request, res: Response) => {
        const auth = await authenticateRequest(req);

        if (requireAuth && !auth) {
          throw new Error('Authentication required');
        }

        const context: GraphQLContext = {
          req,
          res,
          rateLimit: {
            limit: 100,
            remaining: 100,
            reset: Math.floor(Date.now() / 1000) + 60,
          },
        };

        if (auth && 'userId' in auth && 'scope' in auth) {
          context.user = auth;
        } else if (auth && 'keyId' in auth && 'permissions' in auth) {
          context.apiKey = auth;
        }

        if (requiredScope && !checkAuthorization(context, requiredScope)) {
          throw new Error('Insufficient permissions');
        }

        return context;
      },
      customFormatErrorFn: (error: any) => {
        const securityLogger = createSecurityLogger();
        securityLogger.logSecurityEvent({
          action: 'graphql_error',
          resource: error.path?.join('.') || 'unknown',
          reason: error.message,
          metadata: {
            extensions: error.extensions,
          },
        });

        if (
          process.env.NODE_ENV === 'production' &&
          error.extensions?.code === 'INTERNAL_SERVER_ERROR'
        ) {
          return {
            message: 'Internal server error',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          };
        }

        return {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: error.extensions,
        };
      },
    }),
  ];
}

// Export rate limiter for custom configuration
export { graphqlRateLimiter };
