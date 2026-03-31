/**
 * GraphQL Schema for Secure CAPTCHA Plugin
 * 
 * Provides GraphQL API for CAPTCHA operations including:
 * - CAPTCHA generation and validation
 * - Session management
 * - Statistics and monitoring
 * - Security events
 * - Real-time subscriptions
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInputObjectType
} from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { CaptchaService } from '../core/captcha-service';

// Create PubSub instance for subscriptions
export const pubsub = new PubSub();

// Event names for subscriptions
export const CAPTCHA_GENERATED = 'CAPTCHA_GENERATED';
export const CAPTCHA_VALIDATED = 'CAPTCHA_VALIDATED';
export const SECURITY_EVENT = 'SECURITY_EVENT';
export const RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED';

// Enum types
const CaptchaTypeEnum = new GraphQLEnumType({
  name: 'CaptchaType',
  values: {
    TEXT: { value: 'text' },
    MATH: { value: 'math' },
    LOGIC: { value: 'logic' },
    IMAGE: { value: 'image' }
  }
});

const CaptchaDifficultyEnum = new GraphQLEnumType({
  name: 'CaptchaDifficulty',
  values: {
    EASY: { value: 'easy' },
    MEDIUM: { value: 'medium' },
    HARD: { value: 'hard' }
  }
});

const SessionStatusEnum = new GraphQLEnumType({
  name: 'SessionStatus',
  values: {
    ACTIVE: { value: 'active' },
    VALIDATED: { value: 'validated' },
    EXPIRED: { value: 'expired' },
    FAILED: { value: 'failed' }
  }
});

const HealthStatusEnum = new GraphQLEnumType({
  name: 'HealthStatus',
  values: {
    HEALTHY: { value: 'healthy' },
    UNHEALTHY: { value: 'unhealthy' }
  }
});

// Input types
const CaptchaOptionsInput = new GraphQLInputObjectType({
  name: 'CaptchaOptionsInput',
  fields: {
    length: { type: GraphQLInt },
    categories: { type: new GraphQLList(GraphQLString) },
    operations: { type: new GraphQLList(GraphQLString) },
    language: { type: GraphQLString }
  }
});

const GenerateCaptchaInput = new GraphQLInputObjectType({
  name: 'GenerateCaptchaInput',
  fields: {
    type: { type: new GraphQLNonNull(CaptchaTypeEnum) },
    difficulty: { type: new GraphQLNonNull(CaptchaDifficultyEnum) },
    options: { type: CaptchaOptionsInput }
  }
});

const ValidateCaptchaInput = new GraphQLInputObjectType({
  name: 'ValidateCaptchaInput',
  fields: {
    sessionId: { type: new GraphQLNonNull(GraphQLString) },
    response: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(CaptchaTypeEnum) }
  }
});

// Object types
const MemoryType = new GraphQLObjectType({
  name: 'Memory',
  fields: {
    rss: { type: new GraphQLNonNull(GraphQLInt) },
    heapTotal: { type: new GraphQLNonNull(GraphQLInt) },
    heapUsed: { type: new GraphQLNonNull(GraphQLInt) },
    external: { type: new GraphQLNonNull(GraphQLInt) }
  }
});

const HealthType = new GraphQLObjectType({
  name: 'Health',
  fields: {
    status: { type: new GraphQLNonNull(HealthStatusEnum) },
    timestamp: { type: new GraphQLNonNull(GraphQLString) },
    version: { type: new GraphQLNonNull(GraphQLString) },
    uptime: { type: new GraphQLNonNull(GraphQLFloat) },
    memory: { type: new GraphQLNonNull(MemoryType) }
  }
});

const CaptchaChallengeType = new GraphQLObjectType({
  name: 'CaptchaChallenge',
  fields: {
    sessionId: { type: new GraphQLNonNull(GraphQLString) },
    challenge: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(CaptchaTypeEnum) },
    difficulty: { type: new GraphQLNonNull(CaptchaDifficultyEnum) },
    expiresIn: { type: new GraphQLNonNull(GraphQLInt) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) }
  }
});

const ValidationResponseType = new GraphQLObjectType({
  name: 'ValidationResponse',
  fields: {
    valid: { type: new GraphQLNonNull(GraphQLBoolean) },
    securityScore: { type: new GraphQLNonNull(GraphQLInt) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    sessionId: { type: new GraphQLNonNull(GraphQLString) }
  }
});

const CaptchaTypeInfoType = new GraphQLObjectType({
  name: 'CaptchaTypeInfo',
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    difficulties: { type: new GraphQLNonNull(new GraphQLList(CaptchaDifficultyEnum)) },
    description: { type: new GraphQLNonNull(GraphQLString) }
  }
});

const CaptchaStatsType = new GraphQLObjectType({
  name: 'CaptchaStats',
  fields: {
    totalGenerated: { type: new GraphQLNonNull(GraphQLInt) },
    totalValidated: { type: new GraphQLNonNull(GraphQLInt) },
    successRate: { type: new GraphQLNonNull(GraphQLFloat) },
    averageGenerationTime: { type: new GraphQLNonNull(GraphQLFloat) },
    averageValidationTime: { type: new GraphQLNonNull(GraphQLFloat) },
    activeSessions: { type: new GraphQLNonNull(GraphQLInt) }
  }
});

const SecurityEventType = new GraphQLObjectType({
  name: 'SecurityEvent',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    severity: { type: new GraphQLNonNull(GraphQLString) },
    timestamp: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    ipAddress: { type: GraphQLString },
    userAgent: { type: GraphQLString }
  }
});

const CaptchaSessionType = new GraphQLObjectType({
  name: 'CaptchaSession',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(CaptchaTypeEnum) },
    difficulty: { type: new GraphQLNonNull(CaptchaDifficultyEnum) },
    status: { type: new GraphQLNonNull(SessionStatusEnum) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    expiresAt: { type: new GraphQLNonNull(GraphQLString) },
    attempts: { type: new GraphQLNonNull(GraphQLInt) },
    maxAttempts: { type: new GraphQLNonNull(GraphQLInt) },
    securityScore: { type: new GraphQLNonNull(GraphQLInt) }
  }
});

const RateLimitInfoType = new GraphQLObjectType({
  name: 'RateLimitInfo',
  fields: {
    limit: { type: new GraphQLNonNull(GraphQLInt) },
    remaining: { type: new GraphQLNonNull(GraphQLInt) },
    reset: { type: new GraphQLNonNull(GraphQLInt) }
  }
});

// Error type
const ErrorType = new GraphQLObjectType({
  name: 'Error',
  fields: {
    code: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    requestId: { type: GraphQLString },
    timestamp: { type: GraphQLString }
  }
});

// Union types for responses
const GenerateCaptchaResponse = new GraphQLObjectType({
  name: 'GenerateCaptchaResponse',
  fields: {
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    data: { type: CaptchaChallengeType },
    error: { type: ErrorType }
  }
});

const ValidateCaptchaResponse = new GraphQLObjectType({
  name: 'ValidateCaptchaResponse',
  fields: {
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    data: { type: ValidationResponseType },
    error: { type: ErrorType }
  }
});

// Services (lazy initialized)
let captchaService: CaptchaService | null = null;

function getCaptchaService(): CaptchaService {
  if (!captchaService) {
    captchaService = new CaptchaService();
  }
  return captchaService;
}

// Query type
const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    health: {
      type: new GraphQLNonNull(HealthType),
      description: 'Get API health status',
      resolve: () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      })
    },
    captchaTypes: {
      type: new GraphQLNonNull(new GraphQLList(CaptchaTypeInfoType)),
      description: 'Get available CAPTCHA types and difficulties',
      resolve: () => {
        const service = getCaptchaService();
        const types = service.getAvailableTypes();
        return types.map(type => ({
          type,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Captcha`,
          difficulties: ['easy', 'medium', 'hard'],
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} based CAPTCHA challenge`
        }));
      }
    },
    captchaStats: {
      type: new GraphQLNonNull(CaptchaStatsType),
      description: 'Get CAPTCHA statistics and metrics',
      resolve: async () => {
        // Parse metrics to extract relevant stats
        return {
          totalGenerated: 0,
          totalValidated: 0,
          successRate: 0,
          averageGenerationTime: 0,
          averageValidationTime: 0,
          activeSessions: 0
        };
      }
    },
    captchaSession: {
      type: CaptchaSessionType,
      description: 'Get CAPTCHA session by ID',
      args: {
        sessionId: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: async () => {
        // Implementation would fetch session from store
        return null;
      }
    }
  }
});

// Mutation type
const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    generateCaptcha: {
      type: new GraphQLNonNull(GenerateCaptchaResponse),
      description: 'Generate a new CAPTCHA challenge',
      args: {
        input: { type: new GraphQLNonNull(GenerateCaptchaInput) }
      },
      resolve: async (_parent, { input }) => {
        try {
          const service = getCaptchaService();
          const result = await service.generateCaptcha(
            input.type,
            input.difficulty,
            input.options
          );

          const challenge = {
            sessionId: result.sessionId,
            challenge: result.challenge,
            type: result.type,
            difficulty: result.difficulty,
            expiresIn: result.expiresIn,
            createdAt: new Date().toISOString()
          };

          // Publish subscription event
          pubsub.publish(CAPTCHA_GENERATED, { captchaGenerated: challenge });

          return {
            success: true,
            data: challenge
          };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: error.code || 'GENERATION_ERROR',
              message: error.message || 'Failed to generate CAPTCHA',
              timestamp: new Date().toISOString()
            }
          };
        }
      }
    },
    validateCaptcha: {
      type: new GraphQLNonNull(ValidateCaptchaResponse),
      description: 'Validate a CAPTCHA response',
      args: {
        input: { type: new GraphQLNonNull(ValidateCaptchaInput) }
      },
      resolve: async (_parent, { input }) => {
        try {
          const service = getCaptchaService();
          const result = await service.validateResponse(
            input.sessionId,
            input.response,
            input.type
          );

          const validationResult = {
            valid: result.valid,
            securityScore: result.securityScore,
            message: result.message,
            sessionId: input.sessionId
          };

          // Publish subscription event
          pubsub.publish(CAPTCHA_VALIDATED, { captchaValidated: validationResult });

          return {
            success: true,
            data: validationResult
          };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: error.code || 'VALIDATION_ERROR',
              message: error.message || 'Failed to validate CAPTCHA',
              timestamp: new Date().toISOString()
            }
          };
        }
      }
    }
  }
});

// Subscription type
const SubscriptionType = new GraphQLObjectType({
  name: 'Subscription',
  fields: {
    captchaGenerated: {
      type: CaptchaChallengeType,
      description: 'Subscribe to CAPTCHA generation events',
      subscribe: () => (pubsub as any).asyncIterator([CAPTCHA_GENERATED])
    },
    captchaValidated: {
      type: ValidationResponseType,
      description: 'Subscribe to CAPTCHA validation events',
      subscribe: () => (pubsub as any).asyncIterator([CAPTCHA_VALIDATED])
    },
    securityEvent: {
      type: SecurityEventType,
      description: 'Subscribe to security events',
      subscribe: () => (pubsub as any).asyncIterator([SECURITY_EVENT])
    },
    rateLimitExceeded: {
      type: RateLimitInfoType,
      description: 'Subscribe to rate limit exceeded events',
      subscribe: () => (pubsub as any).asyncIterator([RATE_LIMIT_EXCEEDED])
    }
  }
});

// Create schema
export const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  subscription: SubscriptionType
});