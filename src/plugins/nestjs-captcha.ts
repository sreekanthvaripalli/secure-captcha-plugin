/**
 * NestJS Module Plugin for Secure CAPTCHA
 * Provides easy integration with NestJS applications
 */

import {
  Injectable,
  Module,
  NestMiddleware,
  NestModule,
  CanActivate,
  ExecutionContext,
  UseGuards,
  SetMetadata,
  mixin,
  DynamicModule,
  Provider,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
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
 * Configuration options for the NestJS CAPTCHA module
 */
export interface NestJsCaptchaOptions {
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
  skip?: (req: Request) => boolean;
  /** Custom session ID generator */
  sessionIdGenerator?: () => string;
  /** Custom response formatter */
  responseFormatter?: (data: CaptchaResponse | ValidationResponse) => unknown;
  /** Is global module (default: false) */
  isGlobal?: boolean;
}

/**
 * Extended Request interface with CAPTCHA data
 */
export interface CaptchaRequest extends Request {
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
 * CAPTCHA options for guard
 */
export interface CaptchaGuardOptions {
  type?: CaptchaType;
  difficulty?: Difficulty;
}

/**
 * Metadata key for CAPTCHA guard options
 */
export const CAPTCHA_GUARD_OPTIONS_KEY = 'captcha_guard_options';

/**
 * Decorator to apply CAPTCHA guard to a route
 */
export const UseCaptchaGuard = (options?: CaptchaGuardOptions): ClassDecorator & MethodDecorator =>
  UseGuards(CaptchaGuard(options));

/**
 * Decorator to set CAPTCHA guard options
 */
export const CaptchaOptions = (options: CaptchaGuardOptions): ClassDecorator & MethodDecorator =>
  SetMetadata(CAPTCHA_GUARD_OPTIONS_KEY, options);

/**
 * NestJS CAPTCHA Service
 * Wraps the core CaptchaService for use in NestJS applications
 */
@Injectable()
export class NestJsCaptchaService {
  private readonly captchaService: CaptchaService;
  private readonly configService: SecurityConfigurationService;
  private readonly options: Required<
    Omit<
      NestJsCaptchaOptions,
      'errorMessages' | 'skip' | 'sessionIdGenerator' | 'responseFormatter'
    >
  > & {
    errorMessages: CaptchaErrorMessages;
    skip: (req: Request) => boolean;
    sessionIdGenerator: () => string;
    responseFormatter: (data: CaptchaResponse | ValidationResponse) => any;
  };

  constructor(
    options: NestJsCaptchaOptions = {},
    captchaService?: CaptchaService,
    configService?: SecurityConfigurationService
  ) {
    this.captchaService = captchaService || new CaptchaService();
    this.configService = configService || new SecurityConfigurationService();

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
      isGlobal: options.isGlobal ?? false,
    };
  }

  /**
   * Generate a CAPTCHA challenge
   */
  async generate(
    type?: CaptchaType,
    difficulty?: Difficulty,
    options: Record<string, unknown> = {}
  ): Promise<CaptchaResponse> {
    const captchaType = type || this.options.types[0];
    const captchaDifficulty = difficulty || this.options.defaultDifficulty;

    // Validate type
    if (!this.options.types.includes(captchaType)) {
      throw new Error(`Unsupported CAPTCHA type: ${captchaType}`);
    }

    // Validate difficulty
    if (!['easy', 'medium', 'hard'].includes(captchaDifficulty)) {
      throw new Error(`Invalid difficulty level: ${captchaDifficulty}`);
    }

    return this.captchaService.generateCaptcha(captchaType, captchaDifficulty, options);
  }

  /**
   * Validate a CAPTCHA response
   */
  async validate(
    sessionId: string,
    response: string,
    type: CaptchaType
  ): Promise<ValidationResponse> {
    // Validate required fields
    if (!sessionId || !response || !type) {
      throw new Error('Missing required fields: sessionId, response, type');
    }

    // Validate type
    if (!this.options.types.includes(type)) {
      throw new Error(`Unsupported CAPTCHA type: ${type}`);
    }

    return this.captchaService.validateResponse(sessionId, response, type);
  }

  /**
   * Get available CAPTCHA types
   */
  getAvailableTypes(): CaptchaType[] {
    return this.captchaService.getAvailableTypes();
  }

  /**
   * Get CAPTCHA service instance
   */
  getService(): CaptchaService {
    return this.captchaService;
  }

  /**
   * Get configuration options
   */
  getOptions(): typeof this.options {
    return this.options;
  }
}

/**
 * NestJS CAPTCHA Middleware
 * Handles CAPTCHA generation and validation requests
 */
@Injectable()
export class CaptchaMiddleware implements NestMiddleware {
  constructor(private readonly captchaService: NestJsCaptchaService) {}

  async use(req: CaptchaRequest, res: Response, next: NextFunction): Promise<void> {
    const options = this.captchaService.getOptions();

    // Check if middleware should be skipped
    if (options.skip(req)) {
      return next();
    }

    // Check if this is a CAPTCHA generation request
    if (req.method === 'POST' && req.path.includes('/generate')) {
      return this.handleGenerate(req, res, next);
    }

    // Check if this is a CAPTCHA validation request
    if (req.method === 'POST' && req.path.includes('/validate')) {
      return this.handleValidate(req, res, next);
    }

    next();
  }

  /**
   * Handle CAPTCHA generation
   */
  private async handleGenerate(
    req: CaptchaRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as GenerateCaptchaBody;
      const options = {
        ...body.options,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      const captchaResponse = await this.captchaService.generate(
        body.type,
        body.difficulty,
        options
      );

      // Attach CAPTCHA data to request
      req.captcha = {
        sessionId: captchaResponse.sessionId,
        challenge: captchaResponse.challenge,
        type: captchaResponse.type,
        difficulty: captchaResponse.difficulty,
        expiresIn: captchaResponse.expiresIn,
      };

      // Format response
      const formatter = this.captchaService.getOptions().responseFormatter;
      const formattedResponse = formatter(captchaResponse);

      res.json({
        success: true,
        data: formattedResponse,
      });
    } catch (error) {
      this.handleError(error, req, res, next, 'generateFailed');
    }
  }

  /**
   * Handle CAPTCHA validation
   */
  private async handleValidate(
    req: CaptchaRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as ValidateCaptchaBody;

      const validationResult = await this.captchaService.validate(
        body.sessionId,
        body.response,
        body.type
      );

      // Attach validation result to request
      req.captchaValidation = validationResult;

      // Format response
      const formatter = this.captchaService.getOptions().responseFormatter;
      const formattedResponse = formatter(validationResult);

      if (validationResult.valid) {
        res.json({
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

        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: validationResult.message,
            securityScore: validationResult.securityScore,
          },
        });
      }
    } catch (error) {
      this.handleError(error, req, res, next, 'validationFailed');
    }
  }

  /**
   * Handle errors
   */
  private handleError(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
    errorType: keyof CaptchaErrorMessages
  ): void {
    const options = this.captchaService.getOptions();
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
          method: req.method,
          url: req.url,
          ip: req.ip,
        },
      })
    );

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: options.errorMessages[errorType],
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * NestJS CAPTCHA Guard
 * Protects routes by requiring valid CAPTCHA validation
 */
export const CaptchaGuard = (guardOptions?: CaptchaGuardOptions): ReturnType<typeof mixin> => {
  @Injectable()
  class CaptchaGuardMixin implements CanActivate {
    constructor(
      public readonly captchaService: NestJsCaptchaService,
      public readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<CaptchaRequest>();
      const options = this.captchaService.getOptions();

      // Check if middleware should be skipped
      if (options.skip(request)) {
        return true;
      }

      // Get guard options from decorator or parameter
      const decoratorOptions = this.reflector.getAllAndOverride<CaptchaGuardOptions>(
        CAPTCHA_GUARD_OPTIONS_KEY,
        [context.getHandler(), context.getClass()]
      );

      const mergedOptions: CaptchaGuardOptions = {
        ...guardOptions,
        ...decoratorOptions,
      };

      // Check for CAPTCHA validation in headers or body
      const sessionId =
        (request.headers['x-captcha-session'] as string) || request.body?.captchaSessionId;
      const response =
        (request.headers['x-captcha-response'] as string) || request.body?.captchaResponse;
      const type =
        (request.headers['x-captcha-type'] as CaptchaType) ||
        mergedOptions.type ||
        request.body?.captchaType;

      if (!sessionId || !response || !type) {
        return false;
      }

      try {
        // Validate CAPTCHA
        const validationResult = await this.captchaService.validate(sessionId, response, type);

        if (!validationResult.valid) {
          return false;
        }

        // Attach validation result to request
        request.captchaValidation = validationResult;

        return true;
      } catch {
        return false;
      }
    }
  }

  return mixin(CaptchaGuardMixin);
};

/**
 * NestJS CAPTCHA Module
 */
@Module({})
export class NestJsCaptchaModule implements NestModule {
  /**
   * Register the CAPTCHA module with options
   */
  static register(options: NestJsCaptchaOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: NestJsCaptchaService,
        useFactory: () => new NestJsCaptchaService(options),
      },
    ];

    return {
      module: NestJsCaptchaModule,
      providers,
      exports: [NestJsCaptchaService],
      global: options.isGlobal ?? false,
    };
  }

  /**
   * Register the CAPTCHA module asynchronously
   */
  static registerAsync(options: {
    useFactory: (...args: unknown[]) => Promise<NestJsCaptchaOptions> | NestJsCaptchaOptions;
    inject?: Array<
      import('@nestjs/common').InjectionToken | import('@nestjs/common').OptionalFactoryDependency
    >;
    isGlobal?: boolean;
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: NestJsCaptchaService,
        useFactory: async (...args: unknown[]): Promise<NestJsCaptchaService> => {
          const captchaOptions = await options.useFactory(...args);
          return new NestJsCaptchaService(captchaOptions);
        },
        inject: options.inject || [],
      },
    ];

    return {
      module: NestJsCaptchaModule,
      providers,
      exports: [NestJsCaptchaService],
      global: options.isGlobal ?? false,
    };
  }

  configure(consumer: import('@nestjs/common').MiddlewareConsumer): void {
    consumer.apply(CaptchaMiddleware).forRoutes('*');
  }
}

/**
 * Create NestJS CAPTCHA module instance
 */
export function createNestJsCaptchaModule(options?: NestJsCaptchaOptions): DynamicModule {
  return NestJsCaptchaModule.register(options);
}

/**
 * Default export for convenience
 */
export default NestJsCaptchaModule;
