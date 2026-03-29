import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, CaptchaDifficulty } from '../types/captcha';
import { SecurityEventDetails } from '../types/security';

export interface SessionData {
  id: string;
  captchaType: CaptchaType;
  difficulty: CaptchaDifficulty;
  challengeData: any;
  answer: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastAttemptAt: number;
  ipAddress: string;
  userAgent: string;
  verified: boolean;
  verifiedAt?: number;
  metadata: {
    sessionId: string;
    challengeId: string;
    generationTime: number;
    validationTime?: number;
    securityEvents: SecurityEventDetails[];
  };
}

export interface SessionManagerOptions {
  redisUrl?: string;
  defaultTTL?: number;
  maxAttempts?: number;
  attemptWindow?: number;
  cleanupInterval?: number;
}

export class SessionManager {
  private readonly redis: Redis;
  private readonly config: SecurityConfigurationService;
  private readonly options: Required<SessionManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: SecurityConfigurationService, options: SessionManagerOptions = {}) {
    this.config = config;
    this.options = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTTL: 300, // 5 minutes
      maxAttempts: 3,
      attemptWindow: 300, // 5 minutes
      cleanupInterval: 300000, // 5 minutes
      ...options,
    };

    this.redis = new Redis(this.options.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectionName: 'captcha-session-manager',
    });

    this.startCleanupJob();
  }

  /**
   * Create a new session with encrypted data
   */
  async createSession(
    captchaType: CaptchaType,
    difficulty: CaptchaDifficulty,
    challengeData: any,
    answer: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SessionData> {
    const sessionId = uuidv4();
    const challengeId = uuidv4();
    const now = Date.now();
    const expiresAt = now + this.options.defaultTTL * 1000;

    const sessionData: SessionData = {
      id: sessionId,
      captchaType,
      difficulty,
      challengeData,
      answer,
      createdAt: now,
      expiresAt,
      attempts: 0,
      lastAttemptAt: 0,
      ipAddress,
      userAgent,
      verified: false,
      metadata: {
        sessionId,
        challengeId,
        generationTime: now,
        securityEvents: [],
      },
    };

    try {
      // Encrypt session data before storing
      const encryptionResult = await this.config.cryptoService.encryptAES256GCM(
        JSON.stringify(sessionData)
      );
      const encryptedData = JSON.stringify(encryptionResult);

      // Store in Redis with TTL
      await this.redis.setex(`session:${sessionId}`, this.options.defaultTTL, encryptedData);

      // Log security event
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_CREATED',
        resource: 'SESSION_MANAGER',
        reason: 'Session created successfully',
        metadata: {
          sessionId,
          captchaType,
          difficulty,
          ipAddress,
          userAgent,
        },
      });

      return sessionData;
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_CREATION_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          captchaType,
          difficulty,
          ipAddress,
        },
      });

      throw new Error('Failed to create session');
    }
  }

  /**
   * Retrieve and decrypt session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const encryptedData = await this.redis.get(`session:${sessionId}`);

      if (!encryptedData) {
        return null;
      }

      // Decrypt session data
      const decryptionResult = await this.config.cryptoService.decryptAES256GCM(
        JSON.parse(encryptedData)
      );
      if (!decryptionResult.success) {
        throw new Error('Failed to decrypt session data');
      }
      const sessionData = JSON.parse(decryptionResult.decryptedData) as SessionData;

      // Check if session has expired
      if (Date.now() > sessionData.expiresAt) {
        await this.deleteSession(sessionId);
        return null;
      }

      return sessionData;
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_RETRIEVAL_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          sessionId,
        },
      });

      return null;
    }
  }

  /**
   * Update session with validation attempt
   */
  async updateSession(
    sessionId: string,
    _answer: string,
    isCorrect: boolean
  ): Promise<SessionData | null> {
    const sessionData = await this.getSession(sessionId);

    if (!sessionData) {
      return null;
    }

    const now = Date.now();
    sessionData.lastAttemptAt = now;
    sessionData.attempts++;

    if (isCorrect) {
      sessionData.verified = true;
      sessionData.verifiedAt = now;
      sessionData.metadata.validationTime = now;
    }

    try {
      // Encrypt updated session data
      const encryptionResult = await this.config.cryptoService.encryptAES256GCM(
        JSON.stringify(sessionData)
      );
      const encryptedData = JSON.stringify(encryptionResult);

      // Update in Redis with remaining TTL
      const remainingTTL = Math.max(1, Math.floor((sessionData.expiresAt - now) / 1000));
      await this.redis.setex(`session:${sessionId}`, remainingTTL, encryptedData);

      // Log validation attempt
      this.config.securityLogger.logSecurityEvent({
        action: isCorrect ? 'CAPTCHA_VALIDATED' : 'CAPTCHA_INCORRECT',
        resource: 'SESSION_MANAGER',
        reason: isCorrect ? 'Captcha validated successfully' : 'Incorrect captcha answer',
        metadata: {
          sessionId,
          captchaType: sessionData.captchaType,
          difficulty: sessionData.difficulty,
          isCorrect,
          attempts: sessionData.attempts,
          ipAddress: sessionData.ipAddress,
        },
      });

      return sessionData;
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_UPDATE_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          sessionId,
          isCorrect,
        },
      });

      return null;
    }
  }

  /**
   * Delete session from Redis
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`session:${sessionId}`);

      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_DELETED',
        resource: 'SESSION_MANAGER',
        reason: 'Session deleted successfully',
        metadata: {
          sessionId,
        },
      });
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_DELETION_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          sessionId,
        },
      });
    }
  }

  /**
   * Check if session has exceeded max attempts
   */
  async isMaxAttemptsReached(sessionId: string): Promise<boolean> {
    const sessionData = await this.getSession(sessionId);

    if (!sessionData) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastAttempt = now - sessionData.lastAttemptAt;

    // Reset attempts if outside the attempt window
    if (timeSinceLastAttempt > this.options.attemptWindow * 1000) {
      sessionData.attempts = 0;
      sessionData.lastAttemptAt = 0;

      try {
        const encryptionResult = await this.config.cryptoService.encryptAES256GCM(
          JSON.stringify(sessionData)
        );
        const encryptedData = JSON.stringify(encryptionResult);
        await this.redis.set(`session:${sessionId}`, encryptedData);
      } catch (error) {
        // Log error but don't fail the check
        this.config.securityLogger.logSecurityEvent({
          action: 'SESSION_RESET_FAILED',
          resource: 'SESSION_MANAGER',
          reason: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            sessionId,
          },
        });
      }
    }

    return sessionData.attempts >= this.options.maxAttempts;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    verifiedSessions: number;
  }> {
    try {
      // Get all session keys
      const keys = await this.redis.keys('session:*');
      const totalSessions = keys.length;

      let activeSessions = 0;
      let expiredSessions = 0;
      let verifiedSessions = 0;

      for (const key of keys) {
        const encryptedData = await this.redis.get(key);

        if (encryptedData) {
          try {
            const decryptionResult = await this.config.cryptoService.decryptAES256GCM(
              JSON.parse(encryptedData)
            );
            if (!decryptionResult.success) {
              throw new Error('Failed to decrypt session data');
            }
            const sessionData = JSON.parse(decryptionResult.decryptedData) as SessionData;
            const now = Date.now();

            if (now <= sessionData.expiresAt) {
              activeSessions++;
              if (sessionData.verified) {
                verifiedSessions++;
              }
            } else {
              expiredSessions++;
            }
          } catch (error) {
            // Skip invalid sessions
            expiredSessions++;
          }
        }
      }

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        verifiedSessions,
      };
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_STATS_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
      });

      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        verifiedSessions: 0,
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const keys = await this.redis.keys('session:*');
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of keys) {
        const encryptedData = await this.redis.get(key);

        if (encryptedData) {
          try {
            const decryptionResult = await this.config.cryptoService.decryptAES256GCM(
              JSON.parse(encryptedData)
            );
            if (!decryptionResult.success) {
              throw new Error('Failed to decrypt session data');
            }
            const sessionData = JSON.parse(decryptionResult.decryptedData) as SessionData;

            if (now > sessionData.expiresAt) {
              await this.redis.del(key);
              cleanedCount++;
            }
          } catch (error) {
            // Delete invalid sessions
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        this.config.securityLogger.logSecurityEvent({
          action: 'SESSION_CLEANUP',
          resource: 'SESSION_MANAGER',
          reason: 'Session cleanup completed',
          metadata: {
            cleanedSessions: cleanedCount,
          },
        });
      }
    } catch (error) {
      this.config.securityLogger.logSecurityEvent({
        action: 'SESSION_CLEANUP_FAILED',
        resource: 'SESSION_MANAGER',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {},
      });
    }
  }

  /**
   * Start periodic cleanup job
   */
  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop cleanup job and close Redis connection
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    await this.redis.disconnect();
  }
}
