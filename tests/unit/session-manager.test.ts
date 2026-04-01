import { SessionManager } from '../../src/services/session-manager';
import { SecurityConfigurationService } from '../../src/security/config';
import type { CaptchaType, CaptchaDifficulty } from '../../src/types/captcha';

// Mock ioredis
const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisKeys = jest.fn();
const mockRedisDisconnect = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    set: mockRedisSet,
    del: mockRedisDel,
    keys: mockRedisKeys,
    disconnect: mockRedisDisconnect,
    on: jest.fn(),
  }));
});

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-12345'),
}));

// Mock crypto service
const mockEncryptAES256GCM = jest.fn().mockResolvedValue({
  ciphertext: 'encrypted-data',
  iv: 'test-iv',
  tag: 'test-tag',
});

const mockDecryptAES256GCM = jest.fn().mockResolvedValue({
  success: true,
  decryptedData: JSON.stringify({
    id: 'test-uuid-12345',
    captchaType: 'text' as CaptchaType,
    difficulty: 'medium' as CaptchaDifficulty,
    challengeData: { text: 'ABC123' },
    answer: 'ABC123',
    createdAt: Date.now(),
    expiresAt: Date.now() + 300000,
    attempts: 0,
    lastAttemptAt: 0,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    verified: false,
    metadata: {
      sessionId: 'test-uuid-12345',
      challengeId: 'test-uuid-12345',
      generationTime: Date.now(),
      securityEvents: [],
    },
  }),
});

// Mock security config
const mockSecurityLogger = {
  logSecurityEvent: jest.fn(),
};

const mockConfig = {
  securityLogger: mockSecurityLogger,
  cryptoService: {
    encryptAES256GCM: mockEncryptAES256GCM,
    decryptAES256GCM: mockDecryptAES256GCM,
  },
} as unknown as jest.Mocked<SecurityConfigurationService>;

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager(mockConfig);
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(sessionManager).toBeDefined();
    });

    it('should accept custom options', () => {
      const customSessionManager = new SessionManager(mockConfig, {
        redisUrl: 'redis://custom:6379',
        defaultTTL: 600,
        maxAttempts: 5,
        attemptWindow: 600,
        cleanupInterval: 600000,
      });
      expect(customSessionManager).toBeDefined();
      customSessionManager.shutdown();
    });
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      mockRedisSetex.mockResolvedValue('OK');

      const session = await sessionManager.createSession(
        'text' as CaptchaType,
        'medium' as CaptchaDifficulty,
        { text: 'ABC123' },
        'ABC123',
        '127.0.0.1',
        'test-agent'
      );

      expect(session).toBeDefined();
      expect(session.id).toBe('test-uuid-12345');
      expect(session.captchaType).toBe('text');
      expect(session.difficulty).toBe('medium');
      expect(session.verified).toBe(false);
      expect(session.attempts).toBe(0);

      expect(mockEncryptAES256GCM).toHaveBeenCalled();
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'session:test-uuid-12345',
        300,
        expect.any(String)
      );
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_CREATED',
          resource: 'SESSION_MANAGER',
        })
      );
    });

    it('should handle session creation errors', async () => {
      mockEncryptAES256GCM.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(
        sessionManager.createSession(
          'text' as CaptchaType,
          'medium' as CaptchaDifficulty,
          { text: 'ABC123' },
          'ABC123',
          '127.0.0.1',
          'test-agent'
        )
      ).rejects.toThrow('Failed to create session');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_CREATION_FAILED',
          resource: 'SESSION_MANAGER',
        })
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve session successfully', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );

      const session = await sessionManager.getSession('test-session-id');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-uuid-12345');
      expect(mockDecryptAES256GCM).toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      mockRedisGet.mockResolvedValue(null);

      const session = await sessionManager.getSession('nonexistent-session');

      expect(session).toBeNull();
    });

    it('should return null and delete expired session', async () => {
      const expiredSession = {
        id: 'test-uuid-12345',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: { text: 'ABC123' },
        answer: 'ABC123',
        createdAt: Date.now() - 600000,
        expiresAt: Date.now() - 300000, // Expired 5 minutes ago
        attempts: 0,
        lastAttemptAt: 0,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        verified: false,
        metadata: {
          sessionId: 'test-uuid-12345',
          challengeId: 'test-uuid-12345',
          generationTime: Date.now() - 600000,
          securityEvents: [],
        },
      };

      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockDecryptAES256GCM.mockResolvedValueOnce({
        success: true,
        decryptedData: JSON.stringify(expiredSession),
      });
      mockRedisDel.mockResolvedValue(1);

      const session = await sessionManager.getSession('expired-session');

      expect(session).toBeNull();
      expect(mockRedisDel).toHaveBeenCalledWith('session:expired-session');
    });

    it('should return null on decryption failure', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'invalid-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockDecryptAES256GCM.mockResolvedValueOnce({
        success: false,
        decryptedData: null,
      });

      const session = await sessionManager.getSession('invalid-session');

      expect(session).toBeNull();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_RETRIEVAL_FAILED',
          resource: 'SESSION_MANAGER',
        })
      );
    });

    it('should return null on Redis error', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection failed'));

      const session = await sessionManager.getSession('error-session');

      expect(session).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should update session with correct answer', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockRedisSetex.mockResolvedValue('OK');

      const result = await sessionManager.updateSession('test-session', 'ABC123', true);

      expect(result).toBeDefined();
      expect(result?.verified).toBe(true);
      expect(result?.verifiedAt).toBeDefined();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CAPTCHA_VALIDATED',
          resource: 'SESSION_MANAGER',
        })
      );
    });

    it('should update session with incorrect answer', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockRedisSetex.mockResolvedValue('OK');

      const result = await sessionManager.updateSession('test-session', 'wrong', false);

      expect(result).toBeDefined();
      expect(result?.verified).toBe(false);
      expect(result?.attempts).toBe(1);
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CAPTCHA_INCORRECT',
          resource: 'SESSION_MANAGER',
        })
      );
    });

    it('should return null for non-existent session', async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await sessionManager.updateSession('nonexistent', 'ABC123', true);

      expect(result).toBeNull();
    });

    it('should return null on update failure', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockEncryptAES256GCM.mockRejectedValueOnce(new Error('Encryption failed'));

      const result = await sessionManager.updateSession('test-session', 'ABC123', true);

      expect(result).toBeNull();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_UPDATE_FAILED',
          resource: 'SESSION_MANAGER',
        })
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      mockRedisDel.mockResolvedValue(1);

      await sessionManager.deleteSession('test-session');

      expect(mockRedisDel).toHaveBeenCalledWith('session:test-session');
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_DELETED',
          resource: 'SESSION_MANAGER',
        })
      );
    });

    it('should handle delete errors gracefully', async () => {
      mockRedisDel.mockRejectedValue(new Error('Redis delete failed'));

      await sessionManager.deleteSession('test-session');

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_DELETION_FAILED',
          resource: 'SESSION_MANAGER',
        })
      );
    });
  });

  describe('isMaxAttemptsReached', () => {
    it('should return false when attempts below max', async () => {
      const sessionWithAttempts = {
        id: 'test-uuid-12345',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: { text: 'ABC123' },
        answer: 'ABC123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        attempts: 2,
        lastAttemptAt: Date.now() - 60000,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        verified: false,
        metadata: {
          sessionId: 'test-uuid-12345',
          challengeId: 'test-uuid-12345',
          generationTime: Date.now(),
          securityEvents: [],
        },
      };

      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockDecryptAES256GCM.mockResolvedValueOnce({
        success: true,
        decryptedData: JSON.stringify(sessionWithAttempts),
      });

      const result = await sessionManager.isMaxAttemptsReached('test-session');

      expect(result).toBe(false);
    });

    it('should return true when attempts at max', async () => {
      const sessionWithMaxAttempts = {
        id: 'test-uuid-12345',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: { text: 'ABC123' },
        answer: 'ABC123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        attempts: 3,
        lastAttemptAt: Date.now() - 60000,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        verified: false,
        metadata: {
          sessionId: 'test-uuid-12345',
          challengeId: 'test-uuid-12345',
          generationTime: Date.now(),
          securityEvents: [],
        },
      };

      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockDecryptAES256GCM.mockResolvedValueOnce({
        success: true,
        decryptedData: JSON.stringify(sessionWithMaxAttempts),
      });

      const result = await sessionManager.isMaxAttemptsReached('test-session');

      expect(result).toBe(true);
    });

    it('should reset attempts when outside attempt window', async () => {
      const sessionWithOldAttempt = {
        id: 'test-uuid-12345',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: { text: 'ABC123' },
        answer: 'ABC123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        attempts: 3,
        lastAttemptAt: Date.now() - 600000, // 10 minutes ago (outside 5 min window)
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        verified: false,
        metadata: {
          sessionId: 'test-uuid-12345',
          challengeId: 'test-uuid-12345',
          generationTime: Date.now(),
          securityEvents: [],
        },
      };

      mockRedisGet.mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted-data',
          iv: 'test-iv',
          tag: 'test-tag',
        })
      );
      mockDecryptAES256GCM.mockResolvedValueOnce({
        success: true,
        decryptedData: JSON.stringify(sessionWithOldAttempt),
      });
      mockRedisSet.mockResolvedValue('OK');

      const result = await sessionManager.isMaxAttemptsReached('test-session');

      expect(result).toBe(false);
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it('should return false for non-existent session', async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await sessionManager.isMaxAttemptsReached('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      mockRedisKeys.mockResolvedValue(['session:1', 'session:2', 'session:3']);
      mockRedisGet
        .mockResolvedValueOnce(JSON.stringify({ ciphertext: 'data1', iv: 'iv', tag: 'tag' }))
        .mockResolvedValueOnce(JSON.stringify({ ciphertext: 'data2', iv: 'iv', tag: 'tag' }))
        .mockResolvedValueOnce(JSON.stringify({ ciphertext: 'data3', iv: 'iv', tag: 'tag' }));

      const activeSession = {
        id: '1',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: {},
        answer: 'ABC',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        attempts: 0,
        lastAttemptAt: 0,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        verified: true,
        metadata: {
          sessionId: '1',
          challengeId: '1',
          generationTime: Date.now(),
          securityEvents: [],
        },
      };

      const expiredSession = {
        id: '2',
        captchaType: 'text' as CaptchaType,
        difficulty: 'medium' as CaptchaDifficulty,
        challengeData: {},
        answer: 'ABC',
        createdAt: Date.now() - 600000,
        expiresAt: Date.now() - 300000,
        attempts: 0,
        lastAttemptAt: 0,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        verified: false,
        metadata: {
          sessionId: '2',
          challengeId: '2',
          generationTime: Date.now() - 600000,
          securityEvents: [],
        },
      };

      mockDecryptAES256GCM
        .mockResolvedValueOnce({ success: true, decryptedData: JSON.stringify(activeSession) })
        .mockResolvedValueOnce({ success: true, decryptedData: JSON.stringify(expiredSession) })
        .mockResolvedValueOnce({ success: true, decryptedData: JSON.stringify(activeSession) });

      const stats = await sessionManager.getSessionStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(stats.expiredSessions).toBeGreaterThanOrEqual(0);
      expect(stats.verifiedSessions).toBeGreaterThanOrEqual(0);
    });

    it('should return zeros on error', async () => {
      mockRedisKeys.mockRejectedValue(new Error('Redis keys failed'));

      const stats = await sessionManager.getSessionStats();

      expect(stats).toEqual({
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        verifiedSessions: 0,
      });
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      mockRedisDisconnect.mockResolvedValue(undefined);

      await sessionManager.shutdown();

      expect(mockRedisDisconnect).toHaveBeenCalled();
    });
  });
});
