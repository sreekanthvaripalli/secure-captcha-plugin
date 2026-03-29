/**
 * JWT Token System Tests
 * Comprehensive test suite for JWT token generation, validation, refresh, and revocation
 */

import { JWTService } from '../../src/security/jwt';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock SecurityLogger
jest.mock('../../src/security/security-logger');

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  beforeEach(() => {
    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
    } as unknown as jest.Mocked<SecurityLogger>;

    jwtService = new JWTService(
      {
        issuer: 'https://test.example.com',
        audience: 'https://test.example.com',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400 * 30,
        idTokenLifetime: 3600,
        apiTokenLifetime: 86400 * 365,
        algorithm: 'HS256',
        secret: 'test-secret-key-for-testing-purposes-only',
        enableTokenRotation: true,
        enableTokenBlacklisting: true,
        enableTokenIntrospection: true,
        maxRefreshTokenGenerations: 10,
        enableRateLimiting: true,
        tokenGenerationRateLimit: 100,
        tokenRefreshRateLimit: 50,
        enableLogging: true,
        logLevel: 'info',
      },
      mockSecurityLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    describe('generateAccessToken', () => {
      it('should generate a valid access token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['read', 'write'],
          roles: ['user'],
          permissions: ['captcha:generate'],
        };

        const result = jwtService.generateAccessToken(params);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('payload');
        expect(result.payload.type).toBe('access');
        expect(result.payload.userId).toBe(params.userId);
        expect(result.payload.clientId).toBe(params.clientId);
        expect(result.payload.sessionId).toBe(params.sessionId);
        expect(result.payload.scope).toEqual(params.scope);
        expect(result.payload.roles).toEqual(params.roles);
        expect(result.payload.permissions).toEqual(params.permissions);
        expect(result.payload.iss).toBe('https://test.example.com');
        expect(result.payload.aud).toBe('https://test.example.com');
        expect(result.payload.jti).toBeDefined();
        expect(result.payload.iat).toBeDefined();
        expect(result.payload.exp).toBeDefined();
      });

      it('should generate token with default empty arrays for optional fields', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const result = jwtService.generateAccessToken(params);

        expect(result.payload.scope).toEqual([]);
        expect(result.payload.roles).toEqual([]);
        expect(result.payload.permissions).toEqual([]);
      });

      it('should generate token with metadata', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          metadata: { key: 'value', number: 42 },
        };

        const result = jwtService.generateAccessToken(params);

        expect(result.payload.metadata).toEqual(params.metadata);
      });

      it('should log token generation event', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        jwtService.generateAccessToken(params);

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'access_token_generated',
            resource: 'jwt',
          })
        );
      });

      it('should update statistics after generation', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        jwtService.generateAccessToken(params);
        const stats = jwtService.getStats();

        expect(stats.totalAccessTokens).toBe(1);
        expect(stats.tokenGenerations).toBe(1);
        expect(stats.activeTokens).toBe(1);
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate a valid refresh token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
        };

        const result = jwtService.generateRefreshToken(params);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('payload');
        expect(result.payload.type).toBe('refresh');
        expect(result.payload.userId).toBe(params.userId);
        expect(result.payload.clientId).toBe(params.clientId);
        expect(result.payload.sessionId).toBe(params.sessionId);
        expect(result.payload.accessTokenId).toBe(params.accessTokenId);
        expect(result.payload.family).toBeDefined();
        expect(result.payload.generation).toBe(0);
      });

      it('should generate token with custom family and generation', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
          family: 'custom_family',
          generation: 5,
        };

        const result = jwtService.generateRefreshToken(params);

        expect(result.payload.family).toBe(params.family);
        expect(result.payload.generation).toBe(params.generation);
      });

      it('should throw error when max generations exceeded', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
          generation: 10,
        };

        expect(() => jwtService.generateRefreshToken(params)).toThrow(
          'Maximum refresh token generations exceeded'
        );
      });
    });

    describe('generateIdToken', () => {
      it('should generate a valid ID token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          email: 'user@example.com',
          emailVerified: true,
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
          locale: 'en-US',
          nonce: 'random_nonce',
        };

        const result = jwtService.generateIdToken(params);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('payload');
        expect(result.payload.type).toBe('id');
        expect(result.payload.userId).toBe(params.userId);
        expect(result.payload.clientId).toBe(params.clientId);
        expect(result.payload.email).toBe(params.email);
        expect(result.payload.emailVerified).toBe(params.emailVerified);
        expect(result.payload.name).toBe(params.name);
        expect(result.payload.picture).toBe(params.picture);
        expect(result.payload.locale).toBe(params.locale);
        expect(result.payload.nonce).toBe(params.nonce);
      });
    });

    describe('generateApiToken', () => {
      it('should generate a valid API token', () => {
        const params = {
          apiKeyId: 'api_key_123',
          clientId: 'client456',
          scope: ['read'],
          rateLimit: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
          },
        };

        const result = jwtService.generateApiToken(params);

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('payload');
        expect(result.payload.type).toBe('api');
        expect(result.payload.apiKeyId).toBe(params.apiKeyId);
        expect(result.payload.clientId).toBe(params.clientId);
        expect(result.payload.scope).toEqual(params.scope);
        expect(result.payload.rateLimit).toEqual(params.rateLimit);
      });

      it('should generate token with default rate limit', () => {
        const params = {
          apiKeyId: 'api_key_123',
          clientId: 'client456',
        };

        const result = jwtService.generateApiToken(params);

        expect(result.payload.rateLimit).toEqual({
          requestsPerMinute: 60,
          requestsPerHour: 1000,
        });
      });
    });

    describe('generateTokenPair', () => {
      it('should generate access and refresh token pair', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['read', 'write'],
          roles: ['user'],
          permissions: ['captcha:generate'],
        };

        const result = jwtService.generateTokenPair(params);

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result.tokenType).toBe('Bearer');
        expect(result.expiresIn).toBe(3600);
        expect(result.scope).toBe('read write');
        expect(result.idToken).toBeUndefined();
      });

      it('should generate ID token when openid scope is present', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['openid', 'profile', 'email'],
        };

        const result = jwtService.generateTokenPair(params);

        expect(result.idToken).toBeDefined();
      });
    });
  });

  describe('Token Validation', () => {
    describe('validateToken', () => {
      it('should validate a valid access token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);
        const result = jwtService.validateToken(token);

        expect(result.valid).toBe(true);
        expect(result.payload).toBeDefined();
        expect(result.payload?.type).toBe('access');
        expect(result.payload?.sub).toBe(params.userId);
      });

      it('should validate a valid refresh token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
        };

        const { token } = jwtService.generateRefreshToken(params);
        const result = jwtService.validateToken(token);

        expect(result.valid).toBe(true);
        expect(result.payload).toBeDefined();
        expect(result.payload?.type).toBe('refresh');
      });

      it('should reject an invalid token', () => {
        const result = jwtService.validateToken('invalid.token.here');

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.errorCode).toBe('TOKEN_MALFORMED');
      });

      it('should reject a token with wrong secret', () => {
        const otherService = new JWTService(
          { secret: 'different-secret' },
          mockSecurityLogger
        );

        const { token } = otherService.generateAccessToken({
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        });

        const result = jwtService.validateToken(token);

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject a blacklisted token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token, payload } = jwtService.generateAccessToken(params);
        jwtService.revokeToken(payload.jti!, 'access', 'Test revocation');

        const result = jwtService.validateToken(token);

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TOKEN_REVOKED');
      });

      it('should update statistics on validation', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);
        jwtService.validateToken(token);

        const stats = jwtService.getStats();
        expect(stats.tokenValidations).toBe(1);
      });

      it('should update statistics on failed validation', () => {
        jwtService.validateToken('invalid.token');

        const stats = jwtService.getStats();
        expect(stats.failedValidations).toBe(1);
      });
    });
  });

  describe('Token Refresh', () => {
    describe('refreshAccessToken', () => {
      it('should refresh access token with valid refresh token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const tokenPair = jwtService.generateTokenPair(params);
        const result = jwtService.refreshAccessToken(tokenPair.refreshToken);

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result.tokenType).toBe('Bearer');
        expect(result.expiresIn).toBe(3600);
      });

      it('should rotate refresh token when enabled', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const tokenPair = jwtService.generateTokenPair(params);
        const originalRefreshToken = tokenPair.refreshToken;

        const result = jwtService.refreshAccessToken(tokenPair.refreshToken);

        expect(result.refreshToken).not.toBe(originalRefreshToken);
      });

      it('should throw error with invalid refresh token', () => {
        expect(() => jwtService.refreshAccessToken('invalid.token')).toThrow(
          'Invalid refresh token'
        );
      });

      it('should throw error when refresh token is not a refresh type', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);

        expect(() => jwtService.refreshAccessToken(token)).toThrow(
          'Token is not a refresh token'
        );
      });

      it('should throw error when max generations exceeded', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
          family: 'test_family',
          generation: 9,
        };

        const { token } = jwtService.generateRefreshToken(params);

        expect(() => jwtService.refreshAccessToken(token)).toThrow(
          'Maximum refresh token generations exceeded. Token family revoked.'
        );
      });

      it('should validate scope downgrade', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['read', 'write'],
        };

        const tokenPair = jwtService.generateTokenPair(params);

        expect(() =>
          jwtService.refreshAccessToken(tokenPair.refreshToken, {
            scope: ['read', 'write', 'admin'],
          })
        ).toThrow('Cannot grant scopes not in original token');
      });

      it('should allow scope downgrade', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['read', 'write'],
        };

        const tokenPair = jwtService.generateTokenPair(params);
        const result = jwtService.refreshAccessToken(tokenPair.refreshToken, {
          scope: ['read'],
        });

        expect(result.scope).toBe('read');
      });

      it('should update statistics on refresh', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const tokenPair = jwtService.generateTokenPair(params);
        jwtService.refreshAccessToken(tokenPair.refreshToken);

        const stats = jwtService.getStats();
        expect(stats.tokenRefreshes).toBe(1);
      });
    });
  });

  describe('Token Introspection', () => {
    describe('introspectToken', () => {
      it('should introspect a valid access token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          scope: ['read', 'write'],
        };

        const { token } = jwtService.generateAccessToken(params);
        const result = jwtService.introspectToken(token);

        expect(result.active).toBe(true);
        expect(result.scope).toBe('read write');
        expect(result.clientId).toBe(params.clientId);
        expect(result.sub).toBe(params.userId);
        expect(result.tokenType).toBe('access');
      });

      it('should return inactive for invalid token', () => {
        const result = jwtService.introspectToken('invalid.token');

        expect(result.active).toBe(false);
      });

      it('should return inactive for blacklisted token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token, payload } = jwtService.generateAccessToken(params);
        jwtService.revokeToken(payload.jti!, 'access', 'Test');

        const result = jwtService.introspectToken(token);

        expect(result.active).toBe(false);
      });

      it('should return inactive when introspection is disabled', () => {
        const disabledService = new JWTService(
          { enableTokenIntrospection: false },
          mockSecurityLogger
        );

        const { token } = disabledService.generateAccessToken({
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        });

        const result = disabledService.introspectToken(token);

        expect(result.active).toBe(false);
      });
    });
  });

  describe('Token Revocation', () => {
    describe('revokeToken', () => {
      it('should revoke an access token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token, payload } = jwtService.generateAccessToken(params);
        const result = jwtService.revokeToken(payload.jti!, 'access', 'Test revocation');

        expect(result).toBe(true);

        const validation = jwtService.validateToken(token);
        expect(validation.valid).toBe(false);
        expect(validation.errorCode).toBe('TOKEN_REVOKED');
      });

      it('should revoke a refresh token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
          accessTokenId: 'access_token_jti',
        };

        const { token, payload } = jwtService.generateRefreshToken(params);
        const result = jwtService.revokeToken(payload.jti!, 'refresh', 'Test revocation');

        expect(result).toBe(true);

        const validation = jwtService.validateToken(token);
        expect(validation.valid).toBe(false);
      });

      it('should return false for non-existent token', () => {
        const result = jwtService.revokeToken('non_existent_jti', 'access', 'Test');

        expect(result).toBe(false);
      });

      it('should add token to blacklist', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { payload } = jwtService.generateAccessToken(params);
        jwtService.revokeToken(payload.jti!, 'access', 'Test');

        expect(jwtService.isTokenBlacklisted(payload.jti!)).toBe(true);
      });

      it('should update statistics on revocation', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { payload } = jwtService.generateAccessToken(params);
        jwtService.revokeToken(payload.jti!, 'access', 'Test');

        const stats = jwtService.getStats();
        expect(stats.tokenRevocations).toBe(1);
        expect(stats.blacklistedTokens).toBe(1);
      });
    });

    describe('revokeAllUserTokens', () => {
      it('should revoke all tokens for a user', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        // Generate multiple tokens
        jwtService.generateAccessToken(params);
        jwtService.generateAccessToken(params);
        jwtService.generateTokenPair(params);

        const revokedCount = jwtService.revokeAllUserTokens(params.userId, 'User logout');

        expect(revokedCount).toBeGreaterThan(0);

        const stats = jwtService.getStats();
        expect(stats.blacklistedTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('Token Utilities', () => {
    describe('decodeToken', () => {
      it('should decode a valid token without verification', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);
        const decoded = jwtService.decodeToken(token);

        expect(decoded).toBeDefined();
        expect(decoded?.type).toBe('access');
        expect(decoded?.sub).toBe(params.userId);
      });

      it('should return null for invalid token', () => {
        const decoded = jwtService.decodeToken('invalid.token');

        expect(decoded).toBeNull();
      });
    });

    describe('getTokenExpiration', () => {
      it('should get token expiration time', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);
        const expiration = jwtService.getTokenExpiration(token);

        expect(expiration).toBeInstanceOf(Date);
        expect(expiration!.getTime()).toBeGreaterThan(Date.now());
      });

      it('should return null for invalid token', () => {
        const expiration = jwtService.getTokenExpiration('invalid.token');

        expect(expiration).toBeNull();
      });
    });

    describe('isTokenExpired', () => {
      it('should return false for valid token', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        const { token } = jwtService.generateAccessToken(params);
        const isExpired = jwtService.isTokenExpired(token);

        expect(isExpired).toBe(false);
      });

      it('should return true for invalid token', () => {
        const isExpired = jwtService.isTokenExpired('invalid.token');

        expect(isExpired).toBe(true);
      });
    });

    describe('getUserTokens', () => {
      it('should get all tokens for a user', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        jwtService.generateAccessToken(params);
        jwtService.generateTokenPair(params);

        const userTokens = jwtService.getUserTokens(params.userId);

        expect(userTokens.accessTokens.length).toBeGreaterThan(0);
        expect(userTokens.refreshTokens.length).toBeGreaterThan(0);
      });

      it('should return empty arrays for non-existent user', () => {
        const userTokens = jwtService.getUserTokens('non_existent_user');

        expect(userTokens.accessTokens).toEqual([]);
        expect(userTokens.refreshTokens).toEqual([]);
        expect(userTokens.idTokens).toEqual([]);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit for token generation', () => {
      const service = new JWTService(
        {
          enableRateLimiting: true,
          tokenGenerationRateLimit: 2,
        },
        mockSecurityLogger
      );

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      // Generate tokens up to the limit
      service.generateAccessToken(params);
      service.generateAccessToken(params);

      // Third generation should fail
      expect(() => service.generateAccessToken(params)).toThrow(
        'Rate limit exceeded for token generation'
      );
    });

    it('should enforce rate limit for token refresh', () => {
      const service = new JWTService(
        {
          enableRateLimiting: true,
          tokenRefreshRateLimit: 2, // Allow 2 refresh token operations per minute
          enableTokenRotation: false, // Disable rotation to test rate limiting
        },
        mockSecurityLogger
      );

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      // Generate first token pair (1 refresh token generated)
      const tokenPair1 = service.generateTokenPair(params);

      // First refresh should succeed (2nd refresh token operation)
      service.refreshAccessToken(tokenPair1.refreshToken);

      // Second refresh should fail (exceeds limit of 2)
      expect(() => service.refreshAccessToken(tokenPair1.refreshToken)).toThrow(
        'Rate limit exceeded for token refresh'
      );
    });

    it('should not enforce rate limit when disabled', () => {
      const service = new JWTService(
        {
          enableRateLimiting: false,
          tokenGenerationRateLimit: 1,
        },
        mockSecurityLogger
      );

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      // Should not throw even after exceeding limit
      service.generateAccessToken(params);
      service.generateAccessToken(params);
      service.generateAccessToken(params);

      const stats = service.getStats();
      expect(stats.rateLimitHits).toBe(0);
    });
  });

  describe('Token Cleanup', () => {
    describe('cleanupExpiredTokens', () => {
      it('should clean up expired tokens', () => {
        const service = new JWTService(
          {
            accessTokenLifetime: 1, // 1 second
          },
          mockSecurityLogger
        );

        const params = {
          userId: 'user123',
          clientId: 'client456',
          sessionId: 'session789',
        };

        service.generateAccessToken(params);

        // Wait for token to expire
        jest.useFakeTimers();
        jest.advanceTimersByTime(2000);

        service.cleanupExpiredTokens();

        const stats = service.getStats();
        expect(stats.activeTokens).toBe(0);

        jest.useRealTimers();
      });
    });
  });

  describe('Statistics', () => {
    it('should track token statistics correctly', () => {
      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      // Generate tokens
      jwtService.generateAccessToken(params);
      jwtService.generateRefreshToken({
        ...params,
        accessTokenId: 'access_jti',
      });

      // Validate token
      const { token } = jwtService.generateAccessToken(params);
      jwtService.validateToken(token);

      // Revoke token
      const { payload } = jwtService.generateAccessToken(params);
      jwtService.revokeToken(payload.jti!, 'access', 'Test');

      const stats = jwtService.getStats();

      expect(stats.totalAccessTokens).toBe(3);
      expect(stats.totalRefreshTokens).toBe(1);
      expect(stats.tokenGenerations).toBe(4);
      expect(stats.tokenValidations).toBe(1);
      expect(stats.tokenRevocations).toBe(1);
      expect(stats.blacklistedTokens).toBe(1);
    });
  });

  describe('Blacklist', () => {
    it('should expire blacklist entries', () => {
      const service = new JWTService(
        {
          refreshTokenLifetime: 1, // 1 second
        },
        mockSecurityLogger
      );

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      const { payload } = service.generateAccessToken(params);
      service.revokeToken(payload.jti!, 'access', 'Test');

      expect(service.isTokenBlacklisted(payload.jti!)).toBe(true);

      // Wait for blacklist entry to expire
      jest.useFakeTimers();
      jest.advanceTimersByTime(2000);

      expect(service.isTokenBlacklisted(payload.jti!)).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const service = new JWTService({}, mockSecurityLogger);

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      const { payload } = service.generateAccessToken(params);

      expect(payload.iss).toBe('https://secure-captcha.example.com');
      expect(payload.aud).toBe('https://secure-captcha.example.com');
    });

    it('should override default configuration', () => {
      const service = new JWTService(
        {
          issuer: 'https://custom.example.com',
          audience: 'https://custom.example.com',
          accessTokenLifetime: 7200,
        },
        mockSecurityLogger
      );

      const params = {
        userId: 'user123',
        clientId: 'client456',
        sessionId: 'session789',
      };

      const { payload } = service.generateAccessToken(params);

      expect(payload.iss).toBe('https://custom.example.com');
      expect(payload.aud).toBe('https://custom.example.com');
    });
  });
});