/**
 * Fastify Plugin for Secure CAPTCHA
 * Provides easy integration with Fastify applications
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { CaptchaService } from '../core/captcha-service';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, CaptchaResponse, ValidationResponse } from '../types/captcha';

/**
 * Error messages configuration
 */
export interface CaptchaErrorMessages {
  generateFailed: string;
  validationFailed: string;
  sessionNotFound: string;
  sessionExpired: string;
  maxAttemptsExceeded: string;
  invalidRequest: string;
}

/**
 * Configuration options for the Fastify CAPTCHA plugin
 */
export interface FastifyCaptchaOptions {
  /** CAPTCHA types to support (default: all types) */
  types?: CaptchaType[];
  /** Default difficulty level (default: 'medium') */
  defaultDifficulty?: Difficulty;
  /** Session timeout in milliseconds (default: from config) */
  sessionTimeout?: number;
  /** Maximum validation attempts per session (default: 3) */
  maxAttempts?: number;
  /** Enable behavioral analysis (default: true) */
  enableBehavioralAnalysis?: boolean;
  /** Enable device fingerprinting (default: true) */
  enableDeviceFingerprinting?: boolean;
  /** Custom error messages */
  errorMessages?: Partial<CaptchaErrorMessages>;
  /** Skip plugin for certain requests */
  skip?: (request: FastifyRequest) => boolean;
  /** Custom session ID generator */
  sessionIdGenerator?: () => string;
  /** Custom response formatter */
  responseFormatter?: (data: CaptchaResponse | ValidationResponse) => unknown;
}

/**
 * CAPTCHA generation request body
 */
export interface GenerateCaptchaBody {
  type?: CaptchaType;
  difficulty?: Difficulty;
  options?: Record<string, unknown>;
}

/**
 * CAPTCHA validation request body
 */
export interface ValidateCaptchaBody {
  sessionId: string;
  response: string;
  type: CaptchaType;
}

/**
 * Extended Fastify instance with CAPTCHA decorators
 */
declare module 'fastify' {
  interface FastifyInstance {
    captcha: {
      generate: (
        request: FastifyRequest,
        reply: FastifyReply,
        options?: { type?: CaptchaType; difficulty?: Difficulty }
      ) => Promise<void>;
      validate: (
        request: FastifyRequest,
        reply: FastifyReply,
        options?: { sessionId?: string; response?: string; type?: CaptchaType }
      ) => Promise<void>;
      protect: (
        request: FastifyRequest,
        reply: FastifyReply,
        options?: { type?: CaptchaType; difficulty?: Difficulty }
      ) => Promise<void>;
      getTypes: () => { type: CaptchaType; name: string; difficulties: Difficulty[] }[];
      getService: () => CaptchaService;
    };
  }

  interface FastifyRequest {
    captcha?: {
      sessionId: string;
      challenge: string;
      type: CaptchaType;
      difficulty: Difficulty;
      expiresIn: number;
    };
    captchaValidation?: {
      valid: boolean;
      securityScore: number;
      message: string;
    };
  }
}

/**
 * Fastify CAPTCHA Plugin Class
 */
export class FastifyCaptchaPlugin {
  private captchaService: CaptchaService;
  private configService: SecurityConfigurationService;
  private options: Required<Omit<FastifyCaptchaOptions, 'errorMessages'>> & {
    errorMessages: CaptchaErrorMessages;
  };

  constructor(options: FastifyCaptchaOptions = {}) {
    this.captchaService = new CaptchaService();
    this.configService = new SecurityConfigurationService();

    // Set default options
    this.options = {
      types: options.types || this.captchaService.getAvailableTypes(),
      defaultDifficulty: options.defaultDifficulty || 'medium',
      sessionTimeout: options.sessionTimeout || this.configService.getConfig().app.sessionTimeout,
      maxAttempts: options.maxAttempts || 3,
      enableBehavioralAnalysis: options.enableBehavioralAnalysis ?? true,
      enableDeviceFingerprinting: options.enableDeviceFingerprinting ?? true,
      errorMessages: {
        generateFailed: 'Failed to generate CAPTCHA',
        validationFailed: 'CAPTCHA validation failed',
        sessionNotFound: 'CAPTCHA session not found',
        sessionExpired: 'CAPTCHA session has expired',
        maxAttemptsExceeded: 'Maximum validation attempts exceeded',
        invalidRequest: 'Invalid request',
        ...options.errorMessages,
      },
      skip: options.skip || (() => false),
      sessionIdGenerator: options.sessionIdGenerator || (() => require('uuid').v4()),
      responseFormatter: options.responseFormatter || (data => data),
    };
  }

  /**
   * Generate CAPTCHA handler
   */
  async generate(
    request: FastifyRequest<{ Body: GenerateCaptchaBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Check if plugin should be skipped
      if (this.options.skip(request)) {
        return;
      }

      const body = request.body;
      const type = body.type || this.options.types[0];
      const difficulty = body.difficulty || this.options.defaultDifficulty;

      // Validate type
      if (!this.options.types.includes(type)) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_CAPTCHA_TYPE',
            message: `Unsupported CAPTCHA type: ${type}`,
            supportedTypes: this.options.types,
          },
        });
        return;
      }

      // Validate difficulty
      if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_DIFFICULTY',
            message: `Invalid difficulty level: ${difficulty}`,
            supportedDifficulties: ['easy', 'medium', 'hard'],
          },
        });
        return;
      }

      // Generate CAPTCHA
      const captchaOptions = {
        ...body.options,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      const captchaResponse = await this.captchaService.generateCaptcha(
        type,
        difficulty,
        captchaOptions
      );

      // Attach CAPTCHA data to request
      request.captcha = {
        sessionId: captchaResponse.sessionId,
        challenge: captchaResponse.challenge,
        type: captchaResponse.type,
        difficulty: captchaResponse.difficulty,
        expiresIn: captchaResponse.expiresIn,
      };

      // Format response
      const formattedResponse = this.options.responseFormatter(captchaResponse);

      reply.send({
        success: true,
        data: formattedResponse,
      });
    } catch (error) {
      this.handleError(error, request, reply, 'generateFailed');
    }
  }

  /**
   * Validate CAPTCHA handler
   */
  async validate(
    request: FastifyRequest<{ Body: ValidateCaptchaBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Check if plugin should be skipped
      if (this.options.skip(request)) {
        return;
      }

      const body = request.body;

      // Validate required fields
      if (!body.sessionId || !body.response || !body.type) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields: sessionId, response, type',
          },
        });
        return;
      }

      // Validate type
      if (!this.options.types.includes(body.type)) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_CAPTCHA_TYPE',
            message: `Unsupported CAPTCHA type: ${body.type}`,
          },
        });
        return;
      }

      // Validate response
      const validationResult = await this.captchaService.validateResponse(
        body.sessionId,
        body.response,
        body.type
      );

      // Attach validation result to request
      request.captchaValidation = validationResult;

      // Format response
      const formattedResponse = this.options.responseFormatter(validationResult);

      if (validationResult.valid) {
        reply.send({
          success: true,
          data: formattedResponse,
        });
      } else {
        // Determine appropriate status code based on error
        let statusCode = 400;
        let errorCode = 'VALIDATION_FAILED';

        if (validationResult.message.includes('not found')) {
          statusCode = 404;
          errorCode = 'SESSION_NOT_FOUND';
        } else if (validationResult.message.includes('expired')) {
          statusCode = 410;
          errorCode = 'SESSION_EXPIRED';
        } else if (validationResult.message.includes('Maximum attempts')) {
          statusCode = 429;
          errorCode = 'MAX_ATTEMPTS_EXCEEDED';
        }

        reply.status(statusCode).send({
          success: false,
          error: {
            code: errorCode,
            message: validationResult.message,
            securityScore: validationResult.securityScore,
          },
        });
      }
    } catch (error) {
      this.handleError(error, request, reply, 'validationFailed');
    }
  }

  /**
   * Protect route with CAPTCHA validation
   */
  async protect(
    request: FastifyRequest,
    reply: FastifyReply,
    options: { type?: CaptchaType; difficulty?: Difficulty } = {}
  ): Promise<void> {
    try {
      // Check if plugin should be skipped
      if (this.options.skip(request)) {
        return;
      }

      // Check for CAPTCHA validation in headers or body
      const sessionId =
        (request.headers['x-captcha-session'] as string) ||
        ((request.body as Record<string, unknown>)?.captchaSessionId as string);
      const response =
        (request.headers['x-captcha-response'] as string) ||
        ((request.body as Record<string, unknown>)?.captchaResponse as string);
      const type =
        (request.headers['x-captcha-type'] as CaptchaType) ||
        options.type ||
        ((request.body as Record<string, unknown>)?.captchaType as CaptchaType);

      if (!sessionId || !response || !type) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'CAPTCHA_REQUIRED',
            message: 'CAPTCHA validation required',
            hint: 'Provide sessionId, response, and type in headers or body',
          },
        });
        return;
      }

      // Validate CAPTCHA
      const validationResult = await this.captchaService.validateResponse(
        sessionId,
        response,
        type
      );

      if (!validationResult.valid) {
        reply.status(403).send({
          success: false,
          error: {
            code: 'CAPTCHA_VALIDATION_FAILED',
            message: validationResult.message,
            securityScore: validationResult.securityScore,
          },
        });
        return;
      }

      // Attach validation result to request
      request.captchaValidation = validationResult;
    } catch (error) {
      this.handleError(error, request, reply, 'validationFailed');
    }
  }

  /**
   * Get available CAPTCHA types
   */
  getTypes(): { type: CaptchaType; name: string; difficulties: Difficulty[] }[] {
    const types = this.captchaService.getAvailableTypes();
    return types.map(type => ({
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Captcha`,
      difficulties: ['easy', 'medium', 'hard'],
    }));
  }

  /**
   * Get CAPTCHA service instance
   */
  getService(): CaptchaService {
    return this.captchaService;
  }

  /**
   * Handle errors
   */
  private handleError(
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
    errorType: keyof CaptchaErrorMessages
  ): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        error: {
          type: errorType,
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        request: {
          method: request.method,
          url: request.url,
          ip: request.ip,
        },
      })
    );

    reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: this.options.errorMessages[errorType],
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Fastify plugin registration function
 */
const fastifyCaptchaPlugin: FastifyPluginAsync<FastifyCaptchaOptions> = async (
  fastify: FastifyInstance,
  options: FastifyCaptchaOptions
): Promise<void> => {
  const plugin = new FastifyCaptchaPlugin(options);

  // Decorate fastify instance with captcha methods
  fastify.decorate('captcha', {
    generate: async (
      request: FastifyRequest,
      reply: FastifyReply,
      generateOptions?: { type?: CaptchaType; difficulty?: Difficulty }
    ) => {
      const body = (request.body as GenerateCaptchaBody) || {};
      if (generateOptions?.type) {
        body.type = generateOptions.type;
      }
      if (generateOptions?.difficulty) {
        body.difficulty = generateOptions.difficulty;
      }
      await plugin.generate(request as FastifyRequest<{ Body: GenerateCaptchaBody }>, reply);
    },
    validate: async (
      request: FastifyRequest,
      reply: FastifyReply,
      validateOptions?: { sessionId?: string; response?: string; type?: CaptchaType }
    ) => {
      const body = (request.body as ValidateCaptchaBody) || {};
      if (validateOptions?.sessionId) {
        body.sessionId = validateOptions.sessionId;
      }
      if (validateOptions?.response) {
        body.response = validateOptions.response;
      }
      if (validateOptions?.type) {
        body.type = validateOptions.type;
      }
      await plugin.validate(request as FastifyRequest<{ Body: ValidateCaptchaBody }>, reply);
    },
    protect: async (
      request: FastifyRequest,
      reply: FastifyReply,
      protectOptions?: { type?: CaptchaType; difficulty?: Difficulty }
    ) => {
      await plugin.protect(request, reply, protectOptions);
    },
    getTypes: () => plugin.getTypes(),
    getService: () => plugin.getService(),
  });

  // Add preHandler hook for route protection
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if route has captcha protection metadata
    const routeConfig = request.routeOptions?.config as unknown as Record<string, unknown>;
    if (routeConfig?.captchaProtect) {
      await fastify.captcha.protect(
        request,
        reply,
        routeConfig.captchaProtect as { type?: CaptchaType; difficulty?: Difficulty }
      );
    }
  });
};

/**
 * Export wrapped plugin with fastify-plugin
 */
export default fp(fastifyCaptchaPlugin, {
  name: 'fastify-captcha',
  fastify: '4.x',
});

/**
 * Create Fastify CAPTCHA plugin instance
 */
export function createFastifyCaptcha(options?: FastifyCaptchaOptions): FastifyCaptchaPlugin {
  return new FastifyCaptchaPlugin(options);
}
