/**
 * Fastify CAPTCHA Plugin Tests
 * Tests for plugin registration, decorators, and hooks
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  FastifyCaptchaPlugin,
  FastifyCaptchaOptions,
  createFastifyCaptcha,
} from '../../src/plugins/fastify-captcha';

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

describe('FastifyCaptchaPlugin', () => {
  let plugin: FastifyCaptchaPlugin;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
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
      method: 'POST',
      url: '/api/captcha/generate',
      id: 'test-request-id',
      routeOptions: {
        method: 'POST',
        url: '/api/captcha/generate',
        bodyLimit: 1048576,
        attachValidation: false,
        schema: {},
        validatorCompiler: undefined,
        serializerCompiler: undefined,
        logLevel: 'info',
        config: {},
      } as any,
    };

    // Create mock reply
    mockReply = {
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    // Create plugin instance with explicit options to avoid calling services during construction
    plugin = new FastifyCaptchaPlugin({
      types: ['text', 'math', 'logic', 'image'],
      sessionTimeout: 300000,
    });

    // Replace the captcha service with our mock
    (plugin as any).captchaService = mockCaptchaService;
  });

  describe('Constructor', () => {
    it('should create plugin with default options', () => {
      const plugin = new FastifyCaptchaPlugin({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(plugin).toBeInstanceOf(FastifyCaptchaPlugin);
    });

    it('should create plugin with custom options', () => {
      const options: FastifyCaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
        sessionTimeout: 300000,
        errorMessages: {
          generateFailed: 'Custom error message',
        },
      };

      const plugin = new FastifyCaptchaPlugin(options);
      expect(plugin).toBeInstanceOf(FastifyCaptchaPlugin);
    });

    it('should create plugin using factory function', () => {
      const plugin = createFastifyCaptcha({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
      });
      expect(plugin).toBeInstanceOf(FastifyCaptchaPlugin);
    });
  });

  describe('generate() method', () => {
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = { type: 'math', difficulty: 'medium' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockService.generateCaptcha).toHaveBeenCalledWith(
        'math',
        'medium',
        expect.any(Object)
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCaptchaResponse,
      });
    });

    it('should skip plugin when skip function returns true', async () => {
      const plugin = new FastifyCaptchaPlugin({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        skip: req => req.url === '/health',
      });

      (mockRequest as any).url = '/health';

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should return error for unsupported CAPTCHA type', async () => {
      (mockRequest as any).body = { type: 'unsupported' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CAPTCHA_TYPE',
          message: 'Unsupported CAPTCHA type: unsupported',
          supportedTypes: expect.any(Array),
        },
      });
    });

    it('should return error for invalid difficulty level', async () => {
      (mockRequest as any).body = { type: 'text', difficulty: 'invalid' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = { type: 'text' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate CAPTCHA',
          requestId: 'test-request-id',
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = { type: 'text' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).captcha).toEqual({
        sessionId: 'test-session-id',
        challenge: 'Test challenge',
        type: 'text',
        difficulty: 'easy',
        expiresIn: 300000,
      });
    });
  });

  describe('validate() method', () => {
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        sessionId: 'test-session-id',
        response: '4',
        type: 'math',
      };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockService.validateResponse).toHaveBeenCalledWith('test-session-id', '4', 'math');
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockValidationResponse,
      });
    });

    it('should return error for missing required fields', async () => {
      (mockRequest as any).body = { sessionId: 'test-session-id' };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        sessionId: 'invalid-session',
        response: 'test',
        type: 'text',
      };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        sessionId: 'expired-session',
        response: 'test',
        type: 'text',
      };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(410);
      expect(mockReply.send).toHaveBeenCalledWith({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        sessionId: 'test-session',
        response: 'test',
        type: 'text',
      };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        sessionId: 'test-session',
        response: 'test',
        type: 'text',
      };

      await plugin.validate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).captchaValidation).toEqual(mockValidationResponse);
    });
  });

  describe('protect() method', () => {
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'test-response',
        'x-captcha-type': 'text',
      };

      await plugin.protect(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).captchaValidation).toEqual(mockValidationResponse);
    });

    it('should return 400 when CAPTCHA headers are missing', async () => {
      (mockRequest as any).headers = {};

      await plugin.protect(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CAPTCHA_REQUIRED',
          message: 'CAPTCHA validation required',
          hint: 'Provide sessionId, response, and type in headers or body',
        },
      });
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).headers = {
        'x-captcha-session': 'test-session',
        'x-captcha-response': 'wrong-answer',
        'x-captcha-type': 'text',
      };

      await plugin.protect(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CAPTCHA_VALIDATION_FAILED',
          message: 'Incorrect answer',
          securityScore: 50,
        },
      });
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = {
        captchaSessionId: 'test-session',
        captchaResponse: 'test-response',
        captchaType: 'text',
      };

      await plugin.protect(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).captchaValidation).toEqual(mockValidationResponse);
    });

    it('should skip plugin when skip function returns true', async () => {
      const plugin = new FastifyCaptchaPlugin({
        types: ['text', 'math', 'logic', 'image'],
        sessionTimeout: 300000,
        skip: req => req.url === '/health',
      });

      (mockRequest as any).url = '/health';

      await plugin.protect(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });

  describe('getTypes() method', () => {
    it('should return available CAPTCHA types', () => {
      const mockService = {
        getAvailableTypes: jest.fn().mockReturnValue(['text', 'math', 'logic', 'image']),
      };

      (plugin as any).captchaService = mockService;

      const types = plugin.getTypes();

      expect(types).toEqual([
        { type: 'text', name: 'Text Captcha', difficulties: ['easy', 'medium', 'hard'] },
        { type: 'math', name: 'Math Captcha', difficulties: ['easy', 'medium', 'hard'] },
        { type: 'logic', name: 'Logic Captcha', difficulties: ['easy', 'medium', 'hard'] },
        { type: 'image', name: 'Image Captcha', difficulties: ['easy', 'medium', 'hard'] },
      ]);
    });
  });

  describe('getService() method', () => {
    it('should return CAPTCHA service instance', () => {
      const service = plugin.getService();
      expect(service).toBeDefined();
    });
  });

  describe('Custom response formatter', () => {
    it('should use custom response formatter when provided', async () => {
      const customFormatter = jest.fn().mockReturnValue({ formatted: true });

      const plugin = new FastifyCaptchaPlugin({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = { type: 'text' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(customFormatter).toHaveBeenCalledWith(mockCaptchaResponse);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: { formatted: true },
      });
    });
  });

  describe('Custom error messages', () => {
    it('should use custom error messages when provided', async () => {
      const plugin = new FastifyCaptchaPlugin({
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

      (plugin as any).captchaService = mockService;

      (mockRequest as any).body = { type: 'text' };

      await plugin.generate(
        mockRequest as FastifyRequest<{ Body: any }>,
        mockReply as FastifyReply
      );

      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Custom generate failed message',
          requestId: 'test-request-id',
          timestamp: expect.any(String),
        },
      });
    });
  });
});
