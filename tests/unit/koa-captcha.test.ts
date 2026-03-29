/**
 * Koa CAPTCHA Middleware Tests
 * Tests for middleware integration, configuration, and error handling
 */

import { Context, Next } from 'koa';
import {
  KoaCaptchaMiddleware,
  KoaCaptchaOptions,
  CaptchaContext,
  createKoaCaptcha,
} from '../../src/plugins/koa-captcha';

// Mock dependencies
jest.mock('../../src/core/captcha-service', () => ({
  CaptchaService: jest.fn().mockImplementation(() => ({
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
  })),
}));
jest.mock('../../src/security/config', () => ({
  SecurityConfigurationService: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue({
      app: {
        sessionTimeout: 300000,
        rateLimitRequests: 100,
      },
    }),
    getCorsConfig: jest.fn().mockReturnValue({}),
  })),
}));
jest.mock('../../src/security/input-validation');

describe('KoaCaptchaMiddleware', () => {
  let middleware: KoaCaptchaMiddleware;
  let mockContext: Partial<CaptchaContext>;
  let mockNext: Next;
  let mockCaptchaService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock captcha service
    mockCaptchaService = {
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

    // Create mock context
    mockContext = {
      request: {
        body: {},
      } as any,
      headers: {},
      ip: '127.0.0.1',
      method: 'POST',
      url: '/api/captcha/generate',
      status: 200,
      body: undefined,
      state: {},
    };

    // Create mock next function
    mockNext = jest.fn();

    // Create middleware instance with explicit options to avoid calling services during construction
    middleware = new KoaCaptchaMiddleware({
      types: ['text', 'math', 'logic', 'image'],
      sessionTimeout: 300000,
    });

    // Replace the captcha service with our mock
    (middleware as any).captchaService = mockCaptchaService;
  });

  describe('Constructor', () => {
    it('should create middleware with default options', () => {
      const middleware = new KoaCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(middleware).toBeInstanceOf(KoaCaptchaMiddleware);
    });

    it('should create middleware with custom options', () => {
      const options: KoaCaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
        sessionTimeout: 300000,
        errorMessages: {
          generateFailed: 'Custom error message',
        },
      };

      const middleware = new KoaCaptchaMiddleware(options);
      expect(middleware).toBeInstanceOf(KoaCaptchaMiddleware);
    });

    it('should create middleware using factory function', () => {
      const middleware = createKoaCaptcha({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(middleware).toBeInstanceOf(KoaCaptchaMiddleware);
    });
  });

  describe('generate() middleware', () => {
    it('should generate CAPTCHA successfully', async () => {
      const mockCaptchaResponse = {
        sessionId: 'test-session-id',
        challenge: 'What is 2 + 2?',
        type: 'math' as const,
        difficulty: 'medium' as const,
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
      };

      // Mock the captcha service
      const mockService = {
        generateCaptcha: jest.fn().mockResolvedValue(mockCaptchaResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text', 'math', 'logic', 'image']),
        isSupportedType: jest.fn().mockReturnValue(true),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: { type: 'math', difficulty: 'medium' },
      } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
      expect(mockContext.body).toEqual({
        success: true,
        data: mockCaptchaResponse,
      });
    });

    it('should skip middleware when skip function returns true', async () => {
      const middleware = new KoaCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        skip: ctx => ctx.url === '/health',
      });

      mockContext.url = '/health';

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toBeUndefined();
    });

    it('should return error for unsupported CAPTCHA type', async () => {
      (mockContext as CaptchaContext).request = { body: { type: 'unsupported' } } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_CAPTCHA_TYPE',
          message: 'Unsupported CAPTCHA type: unsupported',
          supportedTypes: expect.any(Array),
        },
      });
    });

    it('should return error for invalid difficulty level', async () => {
      (mockContext as CaptchaContext).request = {
        body: { type: 'text', difficulty: 'invalid' },
      } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Invalid difficulty level: invalid',
          supportedDifficulties: ['easy', 'medium', 'hard'],
        },
      });
    });

    it('should handle service errors gracefully', async () => {
      const mockService = {
        generateCaptcha: jest.fn().mockRejectedValue(new Error('Service error')),
        getAvailableTypes: jest.fn().mockReturnValue(['text', 'math']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = { body: { type: 'text' } } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(500);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate CAPTCHA',
          requestId: undefined,
          timestamp: expect.any(String),
        },
      });
    });

    it('should attach CAPTCHA data to context', async () => {
      const mockCaptchaResponse = {
        sessionId: 'test-session-id',
        challenge: 'Test challenge',
        type: 'text' as const,
        difficulty: 'easy' as const,
        expiresIn: 300000,
        metadata: {} as any,
      };

      const mockService = {
        generateCaptcha: jest.fn().mockResolvedValue(mockCaptchaResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = { body: { type: 'text' } } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect((mockContext as CaptchaContext).captcha).toEqual({
        sessionId: 'test-session-id',
        challenge: 'Test challenge',
        type: 'text',
        difficulty: 'easy',
        expiresIn: 300000,
      });
    });
  });

  describe('validate() middleware', () => {
    it('should validate CAPTCHA successfully', async () => {
      const mockValidationResponse = {
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text', 'math']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          sessionId: 'test-session-id',
          response: '4',
          type: 'math',
        },
      } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockService.validateResponse).toHaveBeenCalledWith('test-session-id', '4', 'math');
      expect(mockContext.body).toEqual({
        success: true,
        data: mockValidationResponse,
      });
    });

    it('should return error for missing required fields', async () => {
      (mockContext as CaptchaContext).request = { body: { sessionId: 'test-session-id' } } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: sessionId, response, type',
        },
      });
    });

    it('should return 404 for session not found', async () => {
      const mockValidationResponse = {
        valid: false,
        securityScore: 0,
        message: 'Session not found or expired',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          sessionId: 'invalid-session',
          response: 'test',
          type: 'text',
        },
      } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(404);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
          securityScore: 0,
        },
      });
    });

    it('should return 410 for expired session', async () => {
      const mockValidationResponse = {
        valid: false,
        securityScore: 0,
        message: 'Captcha has expired',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          sessionId: 'expired-session',
          response: 'test',
          type: 'text',
        },
      } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(410);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Captcha has expired',
          securityScore: 0,
        },
      });
    });

    it('should return 429 for max attempts exceeded', async () => {
      const mockValidationResponse = {
        valid: false,
        securityScore: 0,
        message: 'Maximum attempts exceeded',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          sessionId: 'test-session',
          response: 'test',
          type: 'text',
        },
      } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(429);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum attempts exceeded',
          securityScore: 0,
        },
      });
    });

    it('should attach validation result to context', async () => {
      const mockValidationResponse = {
        valid: true,
        securityScore: 95,
        message: 'Captcha validated successfully',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          sessionId: 'test-session',
          response: 'test',
          type: 'text',
        },
      } as any;

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockContext as CaptchaContext, mockNext);

      expect((mockContext as CaptchaContext).captchaValidation).toEqual(mockValidationResponse);
    });
  });

  describe('protect() middleware', () => {
    it('should allow access when CAPTCHA is valid', async () => {
      const mockValidationResponse = {
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      mockContext.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'text',
      };

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockContext as CaptchaContext).captchaValidation).toEqual(mockValidationResponse);
    });

    it('should return 400 when CAPTCHA headers are missing', async () => {
      mockContext.headers = {};

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'CAPTCHA_REQUIRED',
          message: 'CAPTCHA validation required',
          hint: 'Provide sessionId, response, and type in headers or body',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when CAPTCHA validation fails', async () => {
      const mockValidationResponse = {
        valid: false,
        securityScore: 50,
        message: 'Incorrect answer',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      mockContext.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'wrong-answer',
        'x-captcha-type': 'text',
      };

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.status).toBe(403);
      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'CAPTCHA_VALIDATION_FAILED',
          message: 'Incorrect answer',
          securityScore: 50,
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should read CAPTCHA data from body when headers are not present', async () => {
      const mockValidationResponse = {
        valid: true,
        securityScore: 100,
        message: 'Captcha validated successfully',
      };

      const mockService = {
        validateResponse: jest.fn().mockResolvedValue(mockValidationResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = {
        body: {
          captchaSessionId: 'test-session',
          captchaResponse: 'test-response',
          captchaType: 'text',
        },
      } as any;

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getTypes() endpoint', () => {
    it('should return available CAPTCHA types', () => {
      const mockService = {
        getAvailableTypes: jest.fn().mockReturnValue(['text', 'math', 'logic', 'image']),
      };

      (middleware as any).captchaService = mockService;

      const getTypesHandler = middleware.getTypes();
      getTypesHandler(mockContext as Context);

      expect(mockContext.body).toEqual({
        success: true,
        data: {
          types: [
            { type: 'text', name: 'Text Captcha', difficulties: ['easy', 'medium', 'hard'] },
            { type: 'math', name: 'Math Captcha', difficulties: ['easy', 'medium', 'hard'] },
            { type: 'logic', name: 'Logic Captcha', difficulties: ['easy', 'medium', 'hard'] },
            { type: 'image', name: 'Image Captcha', difficulties: ['easy', 'medium', 'hard'] },
          ],
        },
      });
    });
  });

  describe('getService()', () => {
    it('should return CAPTCHA service instance', () => {
      const service = middleware.getService();
      expect(service).toBeDefined();
    });
  });

  describe('Custom response formatter', () => {
    it('should use custom response formatter when provided', async () => {
      const customFormatter = jest.fn().mockReturnValue({ formatted: true });

      const middleware = new KoaCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        responseFormatter: customFormatter,
      });

      const mockCaptchaResponse = {
        sessionId: 'test-session',
        challenge: 'Test',
        type: 'text' as const,
        difficulty: 'easy' as const,
        expiresIn: 300000,
        metadata: {} as any,
      };

      const mockService = {
        generateCaptcha: jest.fn().mockResolvedValue(mockCaptchaResponse),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = { body: { type: 'text' } } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(customFormatter).toHaveBeenCalledWith(mockCaptchaResponse);
      expect(mockContext.body).toEqual({
        success: true,
        data: { formatted: true },
      });
    });
  });

  describe('Custom error messages', () => {
    it('should use custom error messages when provided', async () => {
      const middleware = new KoaCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        errorMessages: {
          generateFailed: 'Custom generate failed message',
        },
      });

      const mockService = {
        generateCaptcha: jest.fn().mockRejectedValue(new Error('Service error')),
        getAvailableTypes: jest.fn().mockReturnValue(['text']),
      };

      (middleware as any).captchaService = mockService;

      (mockContext as CaptchaContext).request = { body: { type: 'text' } } as any;

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockContext as CaptchaContext, mockNext);

      expect(mockContext.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Custom generate failed message',
          requestId: undefined,
          timestamp: expect.any(String),
        },
      });
    });
  });
});
