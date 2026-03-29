/**
 * Koa.js Middleware Plugin for Secure CAPTCHA
 * Provides easy integration with Koa.js applications
 */

import { Context, Next, Request } from 'koa';
import { CaptchaService } from '../core/captcha-service';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, CaptchaResponse, ValidationResponse } from '../types/captcha';

/**
 * Extended Koa Request with body property (requires koa-bodyparser middleware)
 */
interface KoaRequest extends Request {
  body?: unknown;
}

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
 * Configuration options for the Koa CAPTCHA middleware
 */
export interface KoaCaptchaOptions {
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
  /** Skip middleware for certain requests */
  skip?: (ctx: Context) => boolean;
  /** Custom session ID generator */
  sessionIdGenerator?: () => string;
  /** Custom response formatter */
  responseFormatter?: (data: CaptchaResponse | ValidationResponse) => unknown;
}

/**
 * Extended Koa Context with CAPTCHA data
 */
export interface CaptchaContext extends Context {
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
 * Koa CAPTCHA Middleware Class
 */
export class KoaCaptchaMiddleware {
  private captchaService: CaptchaService;
  private configService: SecurityConfigurationService;
  private options: Required<Omit<KoaCaptchaOptions, 'errorMessages'>> & {
    errorMessages: CaptchaErrorMessages;
  };

  constructor(options: KoaCaptchaOptions = {}) {
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
      skip: options.skip || ((): boolean => false),
      sessionIdGenerator:
        options.sessionIdGenerator ||
        ((): string => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { v4 } = require('uuid');
          return v4();
        }),
      responseFormatter:
        options.responseFormatter ||
        ((data: CaptchaResponse | ValidationResponse): unknown => data),
    };
  }

  /**
   * Middleware to generate CAPTCHA
   */
  generate() {
    return async (ctx: CaptchaContext, next: Next): Promise<void> => {
      try {
        // Check if middleware should be skipped
        if (this.options.skip(ctx)) {
          return next();
        }

        const body = ((ctx.request as KoaRequest).body || {}) as GenerateCaptchaBody;
        const type = body.type || this.options.types[0];
        const difficulty = body.difficulty || this.options.defaultDifficulty;

        // Validate type
        if (!this.options.types.includes(type)) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: {
              code: 'INVALID_CAPTCHA_TYPE',
              message: `Unsupported CAPTCHA type: ${type}`,
              supportedTypes: this.options.types,
            },
          };
          return;
        }

        // Validate difficulty
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: {
              code: 'INVALID_DIFFICULTY',
              message: `Invalid difficulty level: ${difficulty}`,
              supportedDifficulties: ['easy', 'medium', 'hard'],
            },
          };
          return;
        }

        // Generate CAPTCHA
        const options = {
          ...body.options,
          ip: ctx.ip,
          userAgent: ctx.headers['user-agent'],
        };

        const captchaResponse = await this.captchaService.generateCaptcha(
          type,
          difficulty,
          options
        );

        // Attach CAPTCHA data to context
        ctx.captcha = {
          sessionId: captchaResponse.sessionId,
          challenge: captchaResponse.challenge,
          type: captchaResponse.type,
          difficulty: captchaResponse.difficulty,
          expiresIn: captchaResponse.expiresIn,
        };

        // Format response
        const formattedResponse = this.options.responseFormatter(captchaResponse);

        ctx.body = {
          success: true,
          data: formattedResponse,
        };
      } catch (error) {
        this.handleError(error, ctx, 'generateFailed');
      }
    };
  }

  /**
   * Middleware to validate CAPTCHA
   */
  validate() {
    return async (ctx: CaptchaContext, next: Next): Promise<void> => {
      try {
        // Check if middleware should be skipped
        if (this.options.skip(ctx)) {
          return next();
        }

        const body = ((ctx.request as KoaRequest).body || {}) as ValidateCaptchaBody;

        // Validate required fields
        if (!body.sessionId || !body.response || !body.type) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing required fields: sessionId, response, type',
            },
          };
          return;
        }

        // Validate type
        if (!this.options.types.includes(body.type)) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: {
              code: 'INVALID_CAPTCHA_TYPE',
              message: `Unsupported CAPTCHA type: ${body.type}`,
            },
          };
          return;
        }

        // Validate response
        const validationResult = await this.captchaService.validateResponse(
          body.sessionId,
          body.response,
          body.type
        );

        // Attach validation result to context
        ctx.captchaValidation = validationResult;

        // Format response
        const formattedResponse = this.options.responseFormatter(validationResult);

        if (validationResult.valid) {
          ctx.body = {
            success: true,
            data: formattedResponse,
          };
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

          ctx.status = statusCode;
          ctx.body = {
            success: false,
            error: {
              code: errorCode,
              message: validationResult.message,
              securityScore: validationResult.securityScore,
            },
          };
        }
      } catch (error) {
        this.handleError(error, ctx, 'validationFailed');
      }
    };
  }

  /**
   * Middleware to protect routes with CAPTCHA
   */
  protect(options: { type?: CaptchaType; difficulty?: Difficulty } = {}) {
    return async (ctx: CaptchaContext, next: Next): Promise<void> => {
      try {
        // Check if middleware should be skipped
        if (this.options.skip(ctx)) {
          return next();
        }

        // Check for CAPTCHA validation in headers or body
        const requestBody = (ctx.request as KoaRequest).body as Record<string, unknown> | undefined;
        const sessionId =
          (ctx.headers['x-captcha-session'] as string) || (requestBody?.captchaSessionId as string);
        const response =
          (ctx.headers['x-captcha-response'] as string) || (requestBody?.captchaResponse as string);
        const type =
          (ctx.headers['x-captcha-type'] as CaptchaType) ||
          options.type ||
          (requestBody?.captchaType as CaptchaType);

        if (!sessionId || !response || !type) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            error: {
              code: 'CAPTCHA_REQUIRED',
              message: 'CAPTCHA validation required',
              hint: 'Provide sessionId, response, and type in headers or body',
            },
          };
          return;
        }

        // Validate CAPTCHA
        const validationResult = await this.captchaService.validateResponse(
          sessionId,
          response,
          type
        );

        if (!validationResult.valid) {
          ctx.status = 403;
          ctx.body = {
            success: false,
            error: {
              code: 'CAPTCHA_VALIDATION_FAILED',
              message: validationResult.message,
              securityScore: validationResult.securityScore,
            },
          };
          return;
        }

        // Attach validation result to context
        ctx.captchaValidation = validationResult;

        await next();
      } catch (error) {
        this.handleError(error, ctx, 'validationFailed');
      }
    };
  }

  /**
   * Get available CAPTCHA types
   */
  getTypes() {
    return (_ctx: Context): void => {
      const types = this.captchaService.getAvailableTypes();
      _ctx.body = {
        success: true,
        data: {
          types: types.map(type => ({
            type,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Captcha`,
            difficulties: ['easy', 'medium', 'hard'],
          })),
        },
      };
    };
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
  private handleError(error: unknown, ctx: Context, errorType: keyof CaptchaErrorMessages): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        type: errorType,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      request: {
        method: ctx.method,
        url: ctx.url,
        ip: ctx.ip,
      },
    };
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(errorLog));

    ctx.status = 500;
    ctx.body = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: this.options.errorMessages[errorType],
        requestId: ctx.state?.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Create Koa CAPTCHA middleware instance
 */
export function createKoaCaptcha(options?: KoaCaptchaOptions): KoaCaptchaMiddleware {
  return new KoaCaptchaMiddleware(options);
}

/**
 * Default export for convenience
 */
export default KoaCaptchaMiddleware;
