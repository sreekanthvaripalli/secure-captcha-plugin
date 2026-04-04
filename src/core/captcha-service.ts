/**
 * Main Captcha Service
 * Provides unified interface for all captcha types with multi-layer generation
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CaptchaType,
  Difficulty,
  CaptchaSession,
  CaptchaResponse,
  ValidationResponse,
  SessionMetadata,
  GenerateCaptchaInput,
} from '../types/captcha';
import { CryptoService } from '../security/crypto';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaGeneratorFactory } from './captcha-generator';
import { TextCaptchaGenerator } from './text-captcha-generator';
import { MathCaptchaGenerator } from './math-captcha-generator';
import { LogicCaptchaGenerator } from './logic-captcha-generator';
import { ImageCaptchaGenerator } from './image-captcha-generator';

export class CaptchaService {
  private readonly cryptoService: CryptoService;
  private readonly configService: SecurityConfigurationService;
  private readonly factory: CaptchaGeneratorFactory;
  private readonly sessions: Map<string, CaptchaSession> = new Map();

  constructor() {
    this.cryptoService = new CryptoService();
    this.configService = new SecurityConfigurationService();
    this.factory = new CaptchaGeneratorFactory(this.configService);

    // Register all available generators
    this.registerGenerators();
  }

  /**
   * Register all available captcha generators
   */
  private registerGenerators(): void {
    this.factory.registerGenerator(new TextCaptchaGenerator(this.configService));
    this.factory.registerGenerator(new MathCaptchaGenerator(this.configService));
    this.factory.registerGenerator(new LogicCaptchaGenerator(this.configService));
    this.factory.registerGenerator(new ImageCaptchaGenerator(this.configService));
  }

  /**
   * Generate a single captcha of specified type
   */
  async generateCaptcha(
    type: CaptchaType,
    difficulty: Difficulty = 'medium',
    options: Record<string, unknown> = {}
  ): Promise<CaptchaResponse> {
    try {
      // Check if type is supported
      if (!this.factory.isSupported(type)) {
        throw new Error(`Unsupported captcha type: ${type}`);
      }

      const generator = this.factory.getGenerator(type);
      const input: GenerateCaptchaInput = { type, difficulty };

      // Generate captcha using the appropriate generator
      const response = await generator.generate(input);

      // Calculate actual answer based on captcha type
      let actualAnswer: string;
      if (type === 'math') {
        const mathGenerator = generator as MathCaptchaGenerator;
        const answerValue = mathGenerator.getAnswerForExpression(response.challenge);
        actualAnswer = answerValue.toString();
      } else if (type === 'image' || type === 'logic') {
        // Get correct answer directly from generator response
        // The generator now returns correctAnswer field with 0-based index (0=A, 1=B, 2=C, 3=D)
        const correctAnswerIndex = (response as any).correctAnswer ?? 0;
        actualAnswer = String.fromCharCode(65 + correctAnswerIndex);
      } else if (type === 'text') {
        // For text captchas: use text property that is now returned in response
        actualAnswer = (response as any).text || response.challenge;
      } else {
        // Fallback for unknown captcha types
        actualAnswer = response.challenge;
      }

      const metadata: SessionMetadata = {
        ip: (options.ip as string) || '127.0.0.1',
        userAgent: (options.userAgent as string) || 'Unknown',
        fingerprint: (options.fingerprint as string) || '',
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
      };

      const session: CaptchaSession = {
        id: response.sessionId,
        type,
        difficulty,
        challenge: response.challenge,
        answer: await this.encryptAnswer(actualAnswer),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.configService.getConfig().app.sessionTimeout),
        status: 'active',
        metadata,
        securityScore: 100,
        attempts: 0,
        maxAttempts: 3,
      };

      this.sessions.set(response.sessionId, session);

      // Log security event
      await this.cryptoService.logSecurityEvent({
        id: uuidv4(),
        type: 'captcha_generated',
        severity: 'low',
        timestamp: new Date(),
        sessionId: response.sessionId,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        details: {
          action: 'generate',
          resource: 'captcha',
          reason: 'User requested captcha',
          metadata: { type, difficulty },
        },
        resolved: false,
      });

      return {
        sessionId: response.sessionId,
        challenge: response.challenge,
        type,
        difficulty,
        expiresIn: this.configService.getConfig().app.sessionTimeout,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate captcha: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate multi-layer captcha with multiple types
   */
  async generateMultiLayerCaptcha(
    layers: CaptchaType[],
    difficulty: Difficulty = 'medium',
    options: Record<string, unknown> = {}
  ): Promise<CaptchaResponse[]> {
    try {
      const captchas: CaptchaResponse[] = [];

      for (const layerType of layers) {
        const captcha = await this.generateCaptcha(layerType, difficulty, options);
        captchas.push(captcha);
      }

      return captchas;
    } catch (error) {
      throw new Error(
        `Failed to generate multi-layer captcha: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate user response against stored captcha
   */
  async validateResponse(
    sessionId: string,
    response: string,
    type: CaptchaType
  ): Promise<ValidationResponse> {
    try {
      const session = this.sessions.get(sessionId);

      if (!session) {
        return {
          valid: false,
          securityScore: 0,
          message: 'Session not found or expired',
        };
      }

      if (session.status !== 'active') {
        return {
          valid: false,
          securityScore: 0,
          message: 'Session is no longer active',
        };
      }

      if (new Date() > session.expiresAt) {
        session.status = 'expired';
        return {
          valid: false,
          securityScore: 0,
          message: 'Captcha has expired',
        };
      }

      if (session.attempts >= session.maxAttempts) {
        session.status = 'failed';
        return {
          valid: false,
          securityScore: 0,
          message: 'Maximum attempts exceeded',
        };
      }

      session.attempts++;

      const decryptedAnswer = await this.decryptAnswer(session.answer);
      const isValid = this.compareAnswers(decryptedAnswer, response, type);

      if (isValid) {
        session.status = 'validated';

        // Log successful validation
        await this.cryptoService.logSecurityEvent({
          id: uuidv4(),
          type: 'captcha_validated',
          severity: 'low',
          timestamp: new Date(),
          sessionId,
          ip: session.metadata.ip,
          userAgent: session.metadata.userAgent,
          details: {
            action: 'validate',
            resource: 'captcha',
            reason: 'User validated captcha successfully',
            metadata: { type, attempts: session.attempts },
          },
          resolved: false,
        });

        return {
          valid: true,
          securityScore: session.securityScore,
          message: 'Captcha validated successfully',
        };
      } else {
        // Log failed validation
        await this.cryptoService.logSecurityEvent({
          id: uuidv4(),
          type: 'validation_failed',
          severity: 'medium',
          timestamp: new Date(),
          sessionId,
          ip: session.metadata.ip,
          userAgent: session.metadata.userAgent,
          details: {
            action: 'validate',
            resource: 'captcha',
            reason: 'User failed captcha validation',
            metadata: { type, attempts: session.attempts },
          },
          resolved: false,
        });

        return {
          valid: false,
          securityScore: Math.max(0, session.securityScore - 20),
          message: 'Incorrect answer',
        };
      }
    } catch (error) {
      return {
        valid: false,
        securityScore: 0,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get all available captcha types
   */
  getAvailableTypes(): CaptchaType[] {
    return this.factory.getRegisteredTypes();
  }

  /**
   * Check if a captcha type is supported
   */
  isSupportedType(type: string): boolean {
    return this.factory.isSupported(type as CaptchaType);
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfigurationService {
    return this.configService;
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clearSessions(): void {
    this.sessions.clear();
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CaptchaSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Private helper methods
   */
  private async encryptAnswer(answer: string): Promise<string> {
    const encrypted = await this.cryptoService.encryptAES256GCM(answer);
    return JSON.stringify(encrypted);
  }

  private async decryptAnswer(encryptedAnswer: string): Promise<string> {
    const encryptedData = JSON.parse(encryptedAnswer);
    const result = await this.cryptoService.decryptAES256GCM(encryptedData);
    if (!result.success) {
      throw new Error('Failed to decrypt answer');
    }
    return result.decryptedData;
  }

  private compareAnswers(expected: string, actual: string, type: CaptchaType): boolean {
    // Normalize answers for comparison
    const normalizedActual = actual.toLowerCase().trim();
    const normalizedExpected = expected.toLowerCase().trim();

    if (type === 'math') {
      // For math, compare numeric values
      const expectedNum = parseFloat(expected);
      const actualNum = parseFloat(actual);
      return !isNaN(expectedNum) && !isNaN(actualNum) && Math.abs(expectedNum - actualNum) < 0.01;
    }

    // ✅ First check: Direct exact match
    if (normalizedExpected === normalizedActual) {
      return true;
    }

    // ✅ Check 2: Letter options (A/B/C/D) case insensitive
    if (/^[a-d]$/i.test(normalizedActual)) {
      return normalizedExpected === normalizedActual;
    }

    // ✅ Check 3: Numeric option selection - standard human behavior (1=A, 2=B, 3=C, 4=D)
    if (/^[1-4]$/.test(normalizedActual)) {
      const userSelection = parseInt(normalizedActual);
      const expectedLetter = String.fromCharCode(96 + userSelection); // 1 -> 'a', 2 -> 'b', etc
      return normalizedExpected === expectedLetter;
    }

    // ✅ Check 4: Direct actual count values (for "how many X?" questions)
    if (/^\d+$/.test(normalizedActual)) {
      // Convert expected answer letter back to option index
      const expectedIndex = normalizedExpected.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, ...
      const userNumber = parseInt(normalizedActual);

      // For count questions, the option value matches the actual number
      // Option A value = 0 index number, Option B = 1, etc
      return userNumber === expectedIndex;
    }

    // No matches
    return false;
  }
}
