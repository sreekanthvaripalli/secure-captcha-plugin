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
  SessionMetadata
} from '../types/captcha';
import { CryptoService } from '../security/crypto';
import { SecurityConfigurationService } from '../security/config';

export class CaptchaService {
  private readonly cryptoService: CryptoService;
  private readonly configService: SecurityConfigurationService;
  private readonly sessions: Map<string, CaptchaSession> = new Map();

  constructor() {
    this.cryptoService = new CryptoService();
    this.configService = new SecurityConfigurationService();
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
      const sessionId = uuidv4();
      const challenge = await this.generateChallenge(type, difficulty, options);
      const answer = await this.generateAnswer(type, difficulty, options);
      
      const metadata: SessionMetadata = {
        ip: options.ip as string || '127.0.0.1',
        userAgent: options.userAgent as string || 'Unknown',
        fingerprint: options.fingerprint as string || '',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: []
        },
        deviceInfo: {
          browser: 'Unknown',
          os: 'Unknown',
          screenResolution: 'Unknown',
          timezone: 'UTC',
          language: 'en'
        }
      };

      const session: CaptchaSession = {
        id: sessionId,
        type,
        difficulty,
        challenge,
        answer: await this.encryptAnswer(answer),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.configService.getConfig().app.sessionTimeout),
        status: 'active',
        metadata,
        securityScore: 100,
        attempts: 0,
        maxAttempts: 3
      };

      this.sessions.set(sessionId, session);

      // Log security event
      await this.cryptoService.logSecurityEvent({
        id: uuidv4(),
        type: 'captcha_generated',
        severity: 'low',
        timestamp: new Date(),
        sessionId,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        details: {
          action: 'generate',
          resource: 'captcha',
          reason: 'User requested captcha',
          metadata: { type, difficulty }
        },
        resolved: false
      });

      return {
        sessionId,
        challenge,
        type,
        difficulty,
        expiresIn: this.configService.getConfig().app.sessionTimeout,
        metadata
      };

    } catch (error) {
      throw new Error(`Failed to generate captcha: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to generate multi-layer captcha: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          message: 'Session not found or expired'
        };
      }

      if (session.status !== 'active') {
        return {
          valid: false,
          securityScore: 0,
          message: 'Session is no longer active'
        };
      }

      if (new Date() > session.expiresAt) {
        session.status = 'expired';
        return {
          valid: false,
          securityScore: 0,
          message: 'Captcha has expired'
        };
      }

      if (session.attempts >= session.maxAttempts) {
        session.status = 'failed';
        return {
          valid: false,
          securityScore: 0,
          message: 'Maximum attempts exceeded'
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
            metadata: { type, attempts: session.attempts }
          },
          resolved: false
        });

        return {
          valid: true,
          securityScore: session.securityScore,
          message: 'Captcha validated successfully'
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
            metadata: { type, attempts: session.attempts }
          },
          resolved: false
        });

        return {
          valid: false,
          securityScore: Math.max(0, session.securityScore - 20),
          message: 'Incorrect answer'
        };
      }

    } catch (error) {
      return {
        valid: false,
        securityScore: 0,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all available captcha types
   */
  getAvailableTypes(): CaptchaType[] {
    return ['text', 'math', 'logic', 'image', 'audio', 'behavioral', 'invisible', 'multi-layer'];
  }

  /**
   * Check if a captcha type is supported
   */
  isSupportedType(type: string): boolean {
    return this.getAvailableTypes().includes(type as CaptchaType);
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
  private async generateChallenge(
    type: CaptchaType,
    difficulty: Difficulty,
    options: Record<string, unknown>
  ): Promise<string> {
    // Placeholder implementation - will be expanded in Phase 2
    switch (type) {
      case 'text':
        return this.generateTextChallenge(difficulty, options);
      case 'math':
        return this.generateMathChallenge(difficulty, options);
      case 'logic':
        return this.generateLogicChallenge(difficulty, options);
      case 'image':
        return this.generateImageChallenge(difficulty, options);
      case 'audio':
        return this.generateAudioChallenge(difficulty, options);
      case 'behavioral':
        return this.generateBehavioralChallenge(difficulty, options);
      case 'invisible':
        return this.generateInvisibleChallenge(difficulty, options);
      case 'multi-layer':
        return this.generateMultiLayerChallenge(difficulty, options);
      default:
        throw new Error(`Unsupported captcha type: ${type}`);
    }
  }

  private async generateAnswer(
    _type: CaptchaType,
    _difficulty: Difficulty,
    _options: Record<string, unknown>
  ): Promise<string> {
    // Placeholder implementation - will be expanded in Phase 2
    return 'placeholder-answer';
  }

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

  private compareAnswers(expected: string, actual: string, _type: CaptchaType): boolean {
    // Normalize answers for comparison
    const normalizedExpected = expected.toLowerCase().trim();
    const normalizedActual = actual.toLowerCase().trim();
    
    return normalizedExpected === normalizedActual;
  }

  // Placeholder methods for different captcha types
  private generateTextChallenge(difficulty: Difficulty, _options: Record<string, unknown>): string {
    const length = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8;
    // Generate random text synchronously for now
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateMathChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    return `${num1} ${operation} ${num2}`;
  }

  private generateLogicChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'What comes next in the sequence: 2, 4, 6, ?';
  }

  private generateImageChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'Select all images containing traffic lights';
  }

  private generateAudioChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'Listen and type the numbers you hear';
  }

  private generateBehavioralChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'Move your mouse in a natural pattern';
  }

  private generateInvisibleChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'Verification in progress...';
  }

  private generateMultiLayerChallenge(_difficulty: Difficulty, _options: Record<string, unknown>): string {
    return 'Complete multiple verification steps';
  }
}