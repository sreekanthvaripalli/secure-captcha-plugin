/**
 * GraphQL Module Exports
 * 
 * Provides GraphQL API for Secure CAPTCHA Plugin including:
 * - Schema definition
 * - Query and mutation resolvers
 * - Subscription support
 * - Authentication middleware
 * - Rate limiting
 */

export { schema, pubsub } from './schema';
export { createGraphQLMiddleware, graphqlRateLimiter } from './middleware';
export type { GraphQLContext } from './middleware';
export type {
  CaptchaChallenge,
  CaptchaValidationResult,
  CaptchaTypeInfo,
  CaptchaStats,
  SecurityEvent,
  HealthStatus,
  CaptchaSession,
  RateLimitInfo
} from './types';

// Event names for subscriptions
export {
  CAPTCHA_GENERATED,
  CAPTCHA_VALIDATED,
  SECURITY_EVENT,
  RATE_LIMIT_EXCEEDED
} from './schema';