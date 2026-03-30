/**
 * NestJS CAPTCHA Module Tests
 * Tests for module, service, guard, and decorators
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import {
  NestJsCaptchaModule,
  NestJsCaptchaService,
  CaptchaMiddleware,
  CaptchaGuard,
  UseCaptchaGuard,
  CaptchaOptions,
  CAPTCHA_GUARD_OPTIONS_KEY,
  createNestJsCaptchaModule,
  NestJsCaptchaOptions,
  CaptchaRequest,
} from '../../src/plugins/nestjs-captcha';

// Mock dependencies
const mockCaptchaServiceInstance = {
  generateCaptcha: jest.fn().mockResolvedValue({
    sessionId: 'test-session-id',
    challenge: 'What is 2 + 2?',
    type: 'math',
    difficulty: 'medium',
    expiresIn: 300000,
    metadata: {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      fingerprint: '',
      behavioralData: {
        mouseMovements: [],
        keystrokeTimings: [],
        interactionPatterns: [],
      },
      deviceInfo: {
        browser: 'Unknown',
        os: 'Unknown',
        screenResolution: 'Unknown',
        timezone: 'UTC',
        language: 'en',
      },
    },
  }),
  validateResponse: jest.fn().mockResolvedValue({
    valid: true,
    securityScore: 100,
    message: 'Captcha validated successfully',
  }),
  getAvailableTypes: jest.fn().mockReturnValue(['text', 'math', 'logic', 'image']),
  isSupportedType: jest.fn().mockReturnValue(true),
};

const mockConfigServiceInstance = {
  getConfig: jest.fn().mockReturnValue({
    app: {
      sessionTimeout: 300000,
      rateLimitRequests: 100,
    },
  }),
  getCorsConfig: jest.fn().mockReturnValue({}),
};

jest.mock('../../src/core/captcha-service', () => ({
  CaptchaService: jest.fn().mockImplementation(() => mockCaptchaServiceInstance),
}));

jest.mock('../../src/security/config', () => ({
  SecurityConfigurationService: jest.fn().mockImplementation(() => mockConfigServiceInstance),
}));

describe('NestJsCaptchaModule', () => {
  describe('register()', () => {
    it('should create module with default options', () => {
      const module = NestJsCaptchaModule.register();

      expect(module).toBeDefined();
      expect(module.module).toBe(NestJsCaptchaModule);
      expect(module.providers).toHaveLength(1);
      expect(module.exports).toContain(NestJsCaptchaService);
      expect(module.global).toBe(false);
    });

    it('should create module with custom options', () => {
      const options: NestJsCaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
        sessionTimeout: 600000,
        isGlobal: true,
      };

      const module = NestJsCaptchaModule.register(options);

      expect(module).toBeDefined();
      expect(module.global).toBe(true);
    });

    it('should create module using factory function', () => {
      const module = createNestJsCaptchaModule({
        types: ['text', 'math'],
        defaultDifficulty: 'medium',
      });

      expect(module).toBeDefined();
      expect(module.module).toBe(NestJsCaptchaModule);
    });
  });

  describe('registerAsync()', () => {
    it('should create async module with factory', async () => {
      const module = NestJsCaptchaModule.registerAsync({
        useFactory: () => ({
          types: ['text', 'math'],
          defaultDifficulty: 'medium',
        }),
        inject: [],
      });

      expect(module).toBeDefined();
      expect(module.module).toBe(NestJsCaptchaModule);
      expect(module.providers).toHaveLength(1);
    });

    it('should create async module with dependencies', async () => {
      const module = NestJsCaptchaModule.registerAsync({
        useFactory: (config: any) => ({
          types: config.types || ['text', 'math'],
          defaultDifficulty: 'medium',
        }),
        inject: ['CONFIG_SERVICE'],
      });

      expect(module).toBeDefined();
      expect(module.providers).toHaveLength(1);
    });
  });
});

describe('NestJsCaptchaService', () => {
  let service: NestJsCaptchaService;
  let mockCaptchaService: any;
  let mockConfigService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore mock implementations after clearAllMocks
    mockCaptchaServiceInstance.generateCaptcha.mockResolvedValue({
      sessionId: 'test-session-id',
      challenge: 'What is 2 + 2?',
      type: 'math',
      difficulty: 'medium',
      expiresIn: 300000,
      metadata: {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        fingerprint: '',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: [],
        },
        deviceInfo: {
          browser: 'Unknown',
          os: 'Unknown',
          screenResolution: 'Unknown',
          timezone: 'UTC',
          language: 'en',
        },
      },
    });
    mockCaptchaServiceInstance.validateResponse.mockResolvedValue({
      valid: true,
      securityScore: 100,
      message: 'Captcha validated successfully',
    });
    mockCaptchaServiceInstance.getAvailableTypes.mockReturnValue([
      'text',
      'math',
      'logic',
      'image',
    ]);
    mockConfigServiceInstance.getConfig.mockReturnValue({
      app: {
        sessionTimeout: 300000,
        rateLimitRequests: 100,
      },
    });

    // Use the pre-defined mock instances directly
    mockCaptchaService = mockCaptchaServiceInstance;
    mockConfigService = mockConfigServiceInstance;

    // Create service with explicit types and inject mock dependencies
    service = new NestJsCaptchaService(
      {
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      },
      mockCaptchaService,
      mockConfigService
    );
  });

  describe('Constructor', () => {
    it('should create service with default options', () => {
      const service = new NestJsCaptchaService(
        {
          types: ['text', 'math', 'logic', 'image'],
        },
        mockCaptchaServiceInstance as any,
        mockConfigServiceInstance as any
      );
      expect(service).toBeInstanceOf(NestJsCaptchaService);
    });

    it('should create service with custom options', () => {
      const options: NestJsCaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
        sessionTimeout: 600000,
        errorMessages: {
          generateFailed: 'Custom error message',
        },
      };

      const service = new NestJsCaptchaService(
        options,
        mockCaptchaServiceInstance as any,
        mockConfigServiceInstance as any
      );
      expect(service).toBeInstanceOf(NestJsCaptchaService);
    });
  });

  describe('generate()', () => {
    it('should generate CAPTCHA successfully', async () => {
      const result = await service.generate('math', 'medium');

      expect(mockCaptchaService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
      expect(result).toEqual({
        sessionId: 'test-session-id',
        challenge: 'What is 2 + 2?',
        type: 'math',
        difficulty: 'medium',
        expiresIn: 300000,
        metadata: expect.any(Object),
      });
    });

    it('should use default type when not specified', async () => {
      await service.generate();

      expect(mockCaptchaService.generateCaptcha).toHaveBeenCalledWith(
        'text',
        'medium',
        expect.any(Object)
      );
    });

    it('should use default difficulty when not specified', async () => {
      await service.generate('math');

      expect(mockCaptchaService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
    });

    it('should throw error for unsupported CAPTCHA type', async () => {
      await expect(service.generate('unsupported' as any)).rejects.toThrow(
        'Unsupported CAPTCHA type: unsupported'
      );
    });

    it('should throw error for invalid difficulty level', async () => {
      await expect(service.generate('math', 'invalid' as any)).rejects.toThrow(
        'Invalid difficulty level: invalid'
      );
    });

    it('should handle service errors gracefully', async () => {
      mockCaptchaService.generateCaptcha.mockRejectedValue(new Error('Service error'));

      await expect(service.generate('math')).rejects.toThrow('Service error');
    });

    it('should pass options to service', async () => {
      const options = { ip: '192.168.1.1', userAgent: 'Test Agent' };

      await service.generate('math', 'medium', options);

      expect(mockCaptchaService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.objectContaining(options)
      );
    });
  });

  describe('validate()', () => {
    it('should validate CAPTCHA successfully', async () => {
      const result = await service.validate('test-session-id', '4', 'math');

      expect(mockCaptchaService.validateResponse).toHaveBeenCalledWith(
        'test-session-id',
        '4',
        'math'
      );
      expect(result).toEqual({
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      });
    });

    it('should throw error for missing sessionId', async () => {
      await expect(service.validate('', '4', 'math')).rejects.toThrow(
        'Missing required fields: sessionId, response, type'
      );
    });

    it('should throw error for missing response', async () => {
      await expect(service.validate('test-session-id', '', 'math')).rejects.toThrow(
        'Missing required fields: sessionId, response, type'
      );
    });

    it('should throw error for missing type', async () => {
      await expect(service.validate('test-session-id', '4', '' as any)).rejects.toThrow(
        'Missing required fields: sessionId, response, type'
      );
    });

    it('should throw error for unsupported CAPTCHA type', async () => {
      await expect(service.validate('test-session-id', '4', 'unsupported' as any)).rejects.toThrow(
        'Unsupported CAPTCHA type: unsupported'
      );
    });

    it('should handle validation errors gracefully', async () => {
      mockCaptchaService.validateResponse.mockRejectedValue(new Error('Validation error'));

      await expect(service.validate('test-session-id', '4', 'math')).rejects.toThrow(
        'Validation error'
      );
    });
  });

  describe('getAvailableTypes()', () => {
    it('should return available CAPTCHA types', () => {
      const types = service.getAvailableTypes();

      expect(mockCaptchaService.getAvailableTypes).toHaveBeenCalled();
      expect(types).toEqual(['text', 'math', 'logic', 'image']);
    });
  });

  describe('getService()', () => {
    it('should return CAPTCHA service instance', () => {
      const captchaService = service.getService();

      expect(captchaService).toBeDefined();
    });
  });

  describe('getOptions()', () => {
    it('should return configuration options', () => {
      const options = service.getOptions();

      expect(options).toBeDefined();
      expect(options.types).toEqual(['text', 'math', 'logic', 'image']);
      expect(options.defaultDifficulty).toBe('medium');
      expect(options.maxAttempts).toBe(3);
    });
  });
});

describe('CaptchaMiddleware', () => {
  let middleware: CaptchaMiddleware;
  let mockCaptchaService: NestJsCaptchaService;
  let mockRequest: Partial<CaptchaRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCaptchaService = {
      generate: jest.fn().mockResolvedValue({
        sessionId: 'test-session-id',
        challenge: 'What is 2 + 2?',
        type: 'math',
        difficulty: 'medium',
        expiresIn: 300000,
        metadata: {} as any,
      }),
      validate: jest.fn().mockResolvedValue({
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      }),
      getOptions: jest.fn().mockReturnValue({
        types: ['text', 'math', 'logic', 'image'],
        defaultDifficulty: 'medium',
        maxAttempts: 3,
        sessionTimeout: 300000,
        errorMessages: {
          generateFailed: 'Failed to generate CAPTCHA',
          validationFailed: 'CAPTCHA validation failed',
        },
        skip: () => false,
        responseFormatter: (data: any) => data,
      }),
    } as any;

    middleware = new CaptchaMiddleware(mockCaptchaService);

    mockRequest = {
      method: 'POST',
      path: '/api/captcha/generate',
      body: {},
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('use()', () => {
    it('should skip middleware when skip function returns true', async () => {
      (mockCaptchaService.getOptions as jest.Mock).mockReturnValue({
        ...mockCaptchaService.getOptions(),
        skip: () => true,
      });

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should call next for non-captcha routes', async () => {
      Object.defineProperty(mockRequest, 'path', { value: '/api/other', writable: true });

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle generate request', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/generate',
        writable: true,
      });
      mockRequest.body = { type: 'math', difficulty: 'medium' };

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockCaptchaService.generate).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    it('should handle validate request', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/validate',
        writable: true,
      });
      mockRequest.body = {
        sessionId: 'test-session-id',
        response: '4',
        type: 'math',
      };

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockCaptchaService.validate).toHaveBeenCalledWith('test-session-id', '4', 'math');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });

    it('should handle generate errors', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/generate',
        writable: true,
      });
      mockRequest.body = { type: 'math' };
      (mockCaptchaService.generate as jest.Mock).mockRejectedValue(new Error('Generate error'));

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate CAPTCHA',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle validate errors', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/validate',
        writable: true,
      });
      mockRequest.body = {
        sessionId: 'test-session-id',
        response: '4',
        type: 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockRejectedValue(new Error('Validate error'));

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'CAPTCHA validation failed',
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 404 for session not found', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/validate',
        writable: true,
      });
      mockRequest.body = {
        sessionId: 'invalid-session',
        response: '4',
        type: 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockResolvedValue({
        valid: false,
        securityScore: 0,
        message: 'Session not found or expired',
      });

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
          securityScore: 0,
        },
      });
    });

    it('should return 410 for expired session', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/validate',
        writable: true,
      });
      mockRequest.body = {
        sessionId: 'expired-session',
        response: '4',
        type: 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockResolvedValue({
        valid: false,
        securityScore: 0,
        message: 'Captcha has expired',
      });

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(410);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Captcha has expired',
          securityScore: 0,
        },
      });
    });

    it('should return 429 for max attempts exceeded', async () => {
      Object.defineProperty(mockRequest, 'path', {
        value: '/api/captcha/validate',
        writable: true,
      });
      mockRequest.body = {
        sessionId: 'test-session',
        response: '4',
        type: 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockResolvedValue({
        valid: false,
        securityScore: 0,
        message: 'Maximum attempts exceeded',
      });

      await middleware.use(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum attempts exceeded',
          securityScore: 0,
        },
      });
    });
  });
});

describe('CaptchaGuard', () => {
  let guard: any;
  let mockCaptchaService: NestJsCaptchaService;
  let mockReflector: Reflector;
  let mockContext: ExecutionContext;
  let mockRequest: CaptchaRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCaptchaService = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      }),
      getOptions: jest.fn().mockReturnValue({
        types: ['text', 'math', 'logic', 'image'],
        defaultDifficulty: 'medium',
        maxAttempts: 3,
        sessionTimeout: 300000,
        skip: () => false,
      }),
    } as any;

    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;

    mockRequest = {
      headers: {},
      body: {},
    } as CaptchaRequest;

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    const GuardClass = CaptchaGuard();
    guard = new GuardClass(mockCaptchaService, mockReflector);
  });

  describe('canActivate()', () => {
    it('should return true when skip function returns true', async () => {
      (mockCaptchaService.getOptions as jest.Mock).mockReturnValue({
        ...mockCaptchaService.getOptions(),
        skip: () => true,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when CAPTCHA headers are missing', async () => {
      mockRequest.headers = {};

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return true when CAPTCHA is valid', async () => {
      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'math',
      };

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockCaptchaService.validate).toHaveBeenCalledWith(
        'test-session',
        'test-response',
        'math'
      );
    });

    it('should return false when CAPTCHA validation fails', async () => {
      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'wrong-response',
        'x-captcha-type': 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockResolvedValue({
        valid: false,
        securityScore: 50,
        message: 'Incorrect answer',
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when validation throws error', async () => {
      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'math',
      };
      (mockCaptchaService.validate as jest.Mock).mockRejectedValue(new Error('Validation error'));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should read CAPTCHA data from body when headers are not present', async () => {
      mockRequest.body = {
        captchaSessionId: 'test-session',
        captchaResponse: 'test-response',
        captchaType: 'math',
      };

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockCaptchaService.validate).toHaveBeenCalledWith(
        'test-session',
        'test-response',
        'math'
      );
    });

    it('should use guard options when provided', async () => {
      const GuardClass = CaptchaGuard({ type: 'text', difficulty: 'hard' });
      guard = new GuardClass(mockCaptchaService, mockReflector);

      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
      };

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockCaptchaService.validate).toHaveBeenCalledWith(
        'test-session',
        'test-response',
        'text'
      );
    });

    it('should use decorator options when provided', async () => {
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue({
        type: 'logic',
        difficulty: 'hard',
      });

      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
      };

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockCaptchaService.validate).toHaveBeenCalledWith(
        'test-session',
        'test-response',
        'logic'
      );
    });

    it('should attach validation result to request', async () => {
      const mockValidationResult = {
        valid: true,
        securityScore: 95,
        message: 'Captcha validated successfully',
      };
      (mockCaptchaService.validate as jest.Mock).mockResolvedValue(mockValidationResult);

      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'math',
      };

      await guard.canActivate(mockContext);

      expect(mockRequest.captchaValidation).toEqual(mockValidationResult);
    });
  });
});

describe('Decorators', () => {
  describe('UseCaptchaGuard', () => {
    it('should create decorator with options', () => {
      const decorator = UseCaptchaGuard({ type: 'math', difficulty: 'hard' });

      expect(decorator).toBeDefined();
    });

    it('should create decorator without options', () => {
      const decorator = UseCaptchaGuard();

      expect(decorator).toBeDefined();
    });
  });

  describe('CaptchaOptions', () => {
    it('should create decorator with options', () => {
      const decorator = CaptchaOptions({ type: 'text', difficulty: 'medium' });

      expect(decorator).toBeDefined();
    });
  });

  describe('CAPTCHA_GUARD_OPTIONS_KEY', () => {
    it('should export metadata key', () => {
      expect(CAPTCHA_GUARD_OPTIONS_KEY).toBe('captcha_guard_options');
    });
  });
});
