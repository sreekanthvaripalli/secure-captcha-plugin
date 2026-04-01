/**
 * GraphQL Middleware for Secure CAPTCHA Plugin
 *
 * Provides:
 * - Express middleware integration
 * - JWT/API Key authentication
 * - Rate limiting per client
 * - Request validation
 * - Security logging
 *
 * Uses graphql-http for GraphQL v16 compatibility
 */

import { Request, Response } from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
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

// Create GraphQL middleware
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createGraphQLMiddleware(options?: {
  requireAuth?: boolean;
  requiredScope?: string;
  enablePlayground?: boolean;
  enableTracing?: boolean;
}) {
  const { requireAuth = false, requiredScope } = options || {};

  return [
    graphqlRateLimiter,
    createHandler({
      schema: schema,
      context: async req => {
        const auth = await authenticateRequest(req as unknown as Request);

        if (requireAuth && !auth) {
          throw new Error('Authentication required');
        }

        // Build a plain object context compatible with graphql-http
        const context: Record<string, unknown> = {
          req: req as unknown as Request,
          res: (req as any).res,
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

        if (requiredScope && auth) {
          const hasScope =
            ('scope' in auth && (auth as { scope: string[] }).scope.includes('*')) ||
            ('scope' in auth && (auth as { scope: string[] }).scope.includes(requiredScope)) ||
            ('scopes' in auth && (auth as { scopes: string[] }).scopes.includes('*')) ||
            ('scopes' in auth && (auth as { scopes: string[] }).scopes.includes(requiredScope));
          if (!hasScope) {
            throw new Error('Insufficient permissions');
          }
        }

        return context;
      },
    }),
  ];
}

// Export rate limiter for custom configuration
export { graphqlRateLimiter };
