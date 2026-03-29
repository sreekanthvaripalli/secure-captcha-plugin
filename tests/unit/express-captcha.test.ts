/**
 * Express CAPTCHA Middleware Tests
 * Tests for middleware integration, configuration, and error handling
 */

import { Request, Response, NextFunction } from 'express';
import {
  ExpressCaptchaMiddleware,
  ExpressCaptchaOptions,
  CaptchaRequest,
  createExpressCaptcha,
} from '../../src/plugins/express-captcha';

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

describe('ExpressCaptchaMiddleware', () => {
  let middleware: ExpressCaptchaMiddleware;
  let mockRequest: Partial<CaptchaRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
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

    // Create mock request
    mockRequest = {
      body: {},
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      method: 'POST',
      url: '/api/captcha/generate',
    };

    // Create mock response
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };

    // Create mock next function
    mockNext = jest.fn();

    // Create middleware instance with explicit options to avoid calling services during construction
    middleware = new ExpressCaptchaMiddleware({
      types: ['text', 'math', 'logic', 'image'],
      sessionTimeout: 300000,
    });

    // Replace the captcha service with our mock
    (middleware as any).captchaService = mockCaptchaService;
  });

  describe('Constructor', () => {
    it('should create middleware with default options', () => {
      const middleware = new ExpressCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(middleware).toBeInstanceOf(ExpressCaptchaMiddleware);
    });

    it('should create middleware with custom options', () => {
      const options: ExpressCaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
        sessionTimeout: 300000,
        errorMessages: {
          generateFailed: 'Custom error message',
        },
      };

      const middleware = new ExpressCaptchaMiddleware(options);
      expect(middleware).toBeInstanceOf(ExpressCaptchaMiddleware);
    });

    it('should create middleware using factory function', () => {
      const middleware = createExpressCaptcha({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(middleware).toBeInstanceOf(ExpressCaptchaMiddleware);
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

      mockRequest.body = { type: 'math', difficulty: 'medium' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCaptchaResponse,
      });
    });

    it('should skip middleware when skip function returns true', async () => {
      const middleware = new ExpressCaptchaMiddleware({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        skip: req => req.url === '/health',
      });

      mockRequest.url = '/health';

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return error for unsupported CAPTCHA type', async () => {
      mockRequest.body = { type: 'unsupported' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CAPTCHA_TYPE',
          message: 'Unsupported CAPTCHA type: unsupported',
          supportedTypes: expect.any(Array),
        },
      });
    });

    it('should return error for invalid difficulty level', async () => {
      mockRequest.body = { type: 'text', difficulty: 'invalid' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
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

      mockRequest.body = { type: 'text' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate CAPTCHA',
          requestId: undefined,
          timestamp: expect.any(String),
        },
      });
    });

    it('should attach CAPTCHA data to request', async () => {
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

      mockRequest.body = { type: 'text' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect((mockRequest as CaptchaRequest).captcha).toEqual({
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

      mockRequest.body = {
        sessionId: 'test-session-id',
        response: '4',
        type: 'math',
      };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockService.validateResponse).toHaveBeenCalledWith('test-session-id', '4', 'math');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockValidationResponse,
      });
    });

    it('should return error for missing required fields', async () => {
      mockRequest.body = { sessionId: 'test-session-id' };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
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

      mockRequest.body = {
        sessionId: 'invalid-session',
        response: 'test',
        type: 'text',
      };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

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

      mockRequest.body = {
        sessionId: 'expired-session',
        response: 'test',
        type: 'text',
      };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

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

      mockRequest.body = {
        sessionId: 'test-session',
        response: 'test',
        type: 'text',
      };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

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

    it('should attach validation result to request', async () => {
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

      mockRequest.body = {
        sessionId: 'test-session',
        response: 'test',
        type: 'text',
      };

      const validateMiddleware = middleware.validate();
      await validateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect((mockRequest as CaptchaRequest).captchaValidation).toEqual(mockValidationResponse);
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

      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'text',
      };

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as CaptchaRequest).captchaValidation).toEqual(mockValidationResponse);
    });

    it('should return 400 when CAPTCHA headers are missing', async () => {
      mockRequest.headers = {};

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
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

      mockRequest.headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'wrong-answer',
        'x-captcha-type': 'text',
      };

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
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

      mockRequest.body = {
        captchaSessionId: 'test-session',
        captchaResponse: 'test-response',
        captchaType: 'text',
      };

      const protectMiddleware = middleware.protect();
      await protectMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

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
      getTypesHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
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

      const middleware = new ExpressCaptchaMiddleware({
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

      mockRequest.body = { type: 'text' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(customFormatter).toHaveBeenCalledWith(mockCaptchaResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { formatted: true },
      });
    });
  });

  describe('Custom error messages', () => {
    it('should use custom error messages when provided', async () => {
      const middleware = new ExpressCaptchaMiddleware({
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

      mockRequest.body = { type: 'text' };

      const generateMiddleware = middleware.generate();
      await generateMiddleware(mockRequest as CaptchaRequest, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
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
