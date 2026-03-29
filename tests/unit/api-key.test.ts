/**
 * API Key Management Tests
 * Comprehensive test suite for API key generation, validation, rotation, usage tracking, and revocation
 */

import { APIKeyService } from '../../src/security/api-key';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock SecurityLogger
jest.mock('../../src/security/security-logger');

describe('APIKeyService', () => {
  let apiKeyService: APIKeyService;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  beforeEach(() => {
    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
    } as unknown as jest.Mocked<SecurityLogger>;

    apiKeyService = new APIKeyService(
      {
        keyLength: 32,
        keyPrefix: 'sk_test_',
        secretLength: 48,
        defaultLifetime: 86400 * 365, // 1 year
        maxLifetime: 86400 * 365 * 5, // 5 years
        enableExpiration: true,
        defaultRateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          burstLimit: 10,
        },
        enableRateLimiting: true,
        enableKeyHashing: true,
        enableKeyRotation: true,
        rotationGracePeriod: 86400, // 24 hours
        maxKeysPerUser: 10,
        enableUsageTracking: true,
        trackIpAddresses: true,
        trackUserAgents: true,
        enableLogging: true,
        logLevel: 'info',
      },
      mockSecurityLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Key Generation', () => {
    describe('generateAPIKey', () => {
      it('should generate a valid API key with all required fields', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read', 'write'],
          scopes: ['captcha:generate', 'captcha:validate'],
        };

        const result = apiKeyService.generateAPIKey(params);

        expect(result).toHaveProperty('apiKey');
        expect(result).toHaveProperty('apiSecret');
        expect(result).toHaveProperty('keyId');
        expect(result).toHaveProperty('metadata');

        expect(result.apiKey).toMatch(/^sk_test_/);
        expect(result.apiSecret).toBeDefined();
        expect(result.keyId).toBeDefined();

        expect(result.metadata.name).toBe(params.name);
        expect(result.metadata.userId).toBe(params.userId);
        expect(result.metadata.clientId).toBe(params.clientId);
        expect(result.metadata.permissions).toEqual(params.permissions);
        expect(result.metadata.scopes).toEqual(params.scopes);
        expect(result.metadata.status).toBe('active');
        expect(result.metadata.rotationCount).toBe(0);
      });

      it('should generate API key with default empty arrays for optional fields', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const result = apiKeyService.generateAPIKey(params);

        expect(result.metadata.permissions).toEqual([]);
        expect(result.metadata.scopes).toEqual([]);
      });

      it('should generate API key with custom lifetime', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          lifetime: 86400 * 30, // 30 days
        };

        const result = apiKeyService.generateAPIKey(params);

        const expectedExpiresAt = Math.floor(Date.now() / 1000) + params.lifetime;
        expect(result.metadata.expiresAt).toBeGreaterThanOrEqual(expectedExpiresAt - 1);
        expect(result.metadata.expiresAt).toBeLessThanOrEqual(expectedExpiresAt + 1);
      });

      it('should generate API key with custom rate limit', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          rateLimit: {
            requestsPerMinute: 120,
            requestsPerHour: 2000,
          },
        };

        const result = apiKeyService.generateAPIKey(params);

        expect(result.metadata).toBeDefined();
      });

      it('should generate API key with metadata', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          metadata: { environment: 'production', region: 'us-east-1' },
        };

        const result = apiKeyService.generateAPIKey(params);

        expect(result.metadata.metadata).toEqual(params.metadata);
      });

      it('should throw error when max keys per user exceeded', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        // Generate keys up to the limit
        for (let i = 0; i < 10; i++) {
          apiKeyService.generateAPIKey({ ...params, name: `Key ${i}` });
        }

        // 11th key should fail
        expect(() => apiKeyService.generateAPIKey(params)).toThrow(
          'Maximum number of API keys (10) reached for user'
        );
      });

      it('should log key generation event', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        apiKeyService.generateAPIKey(params);

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'api_key_generated',
            resource: 'api_key',
          })
        );
      });

      it('should update statistics after generation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        apiKeyService.generateAPIKey(params);
        const stats = apiKeyService.getStats();

        expect(stats.totalKeysGenerated).toBe(1);
        expect(stats.activeKeys).toBe(1);
      });
    });
  });

  describe('Key Validation', () => {
    describe('validateAPIKey', () => {
      it('should validate a valid API key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read', 'write'],
          scopes: ['captcha:generate'],
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.validateAPIKey(apiKey);

        expect(result.valid).toBe(true);
        expect(result.keyId).toBeDefined();
        expect(result.userId).toBe(params.userId);
        expect(result.clientId).toBe(params.clientId);
        expect(result.permissions).toEqual(params.permissions);
        expect(result.scopes).toEqual(params.scopes);
      });

      it('should reject an invalid API key', () => {
        const result = apiKeyService.validateAPIKey('sk_test_invalid_key');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid API key');
        expect(result.errorCode).toBe('KEY_NOT_FOUND');
      });

      it('should reject a revoked API key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.revokeAPIKey(keyId, 'Test revocation');

        const result = apiKeyService.validateAPIKey(apiKey);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key is revoked');
        expect(result.errorCode).toBe('KEY_INACTIVE');
      });

      it('should reject an expired API key', () => {
        const service = new APIKeyService(
          {
            defaultLifetime: 1, // 1 second
            enableExpiration: true,
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = service.generateAPIKey(params);

        // Wait for key to expire
        jest.useFakeTimers();
        jest.advanceTimersByTime(2000);

        const result = service.validateAPIKey(apiKey);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key has expired');
        expect(result.errorCode).toBe('KEY_EXPIRED');

        jest.useRealTimers();
      });

      it('should validate required permissions', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read'],
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);

        const result = apiKeyService.validateAPIKey(apiKey, {
          requiredPermissions: ['read', 'write'],
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Insufficient permissions');
        expect(result.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('should validate with wildcard permission', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['*'],
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);

        const result = apiKeyService.validateAPIKey(apiKey, {
          requiredPermissions: ['read', 'write', 'admin'],
        });

        expect(result.valid).toBe(true);
      });

      it('should validate required scopes', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          scopes: ['captcha:generate'],
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);

        const result = apiKeyService.validateAPIKey(apiKey, {
          requiredScopes: ['captcha:generate', 'captcha:validate'],
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Insufficient scopes');
        expect(result.errorCode).toBe('INSUFFICIENT_SCOPES');
      });

      it('should validate with wildcard scope', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          scopes: ['*'],
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);

        const result = apiKeyService.validateAPIKey(apiKey, {
          requiredScopes: ['captcha:generate', 'captcha:validate'],
        });

        expect(result.valid).toBe(true);
      });

      it('should track usage when endpoint is provided', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        apiKeyService.validateAPIKey(apiKey, {
          endpoint: '/api/v1/captcha/generate',
          method: 'POST',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });

        const usageHistory = apiKeyService.getUsageHistory(keyId);
        expect(usageHistory.length).toBe(1);
        expect(usageHistory[0].endpoint).toBe('/api/v1/captcha/generate');
        expect(usageHistory[0].method).toBe('POST');
      });

      it('should update last used timestamp on validation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        apiKeyService.validateAPIKey(apiKey);

        const metadata = apiKeyService.getAPIKey(keyId);
        expect(metadata?.lastUsedAt).toBeDefined();
      });

      it('should update statistics on validation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);
        apiKeyService.validateAPIKey(apiKey);

        const stats = apiKeyService.getStats();
        expect(stats.totalValidations).toBe(1);
        expect(stats.successfulValidations).toBe(1);
      });

      it('should update statistics on failed validation', () => {
        apiKeyService.validateAPIKey('sk_test_invalid_key');

        const stats = apiKeyService.getStats();
        expect(stats.totalValidations).toBe(1);
        expect(stats.failedValidations).toBe(1);
      });
    });
  });

  describe('Rate Limiting', () => {
    describe('validateAPIKey with rate limiting', () => {
      it('should enforce minute rate limit', () => {
        const service = new APIKeyService(
          {
            enableRateLimiting: true,
            defaultRateLimit: {
              requestsPerMinute: 2,
              requestsPerHour: 100,
              requestsPerDay: 1000,
              burstLimit: 10,
            },
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = service.generateAPIKey(params);

        // First two requests should succeed
        expect(service.validateAPIKey(apiKey).valid).toBe(true);
        expect(service.validateAPIKey(apiKey).valid).toBe(true);

        // Third request should fail
        const result = service.validateAPIKey(apiKey);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      });

      it('should enforce hour rate limit', () => {
        const service = new APIKeyService(
          {
            enableRateLimiting: true,
            defaultRateLimit: {
              requestsPerMinute: 100,
              requestsPerHour: 2,
              requestsPerDay: 1000,
              burstLimit: 10,
            },
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = service.generateAPIKey(params);

        // First two requests should succeed
        expect(service.validateAPIKey(apiKey).valid).toBe(true);
        expect(service.validateAPIKey(apiKey).valid).toBe(true);

        // Third request should fail
        const result = service.validateAPIKey(apiKey);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      });

      it('should enforce burst rate limit', () => {
        const service = new APIKeyService(
          {
            enableRateLimiting: true,
            defaultRateLimit: {
              requestsPerMinute: 100,
              requestsPerHour: 1000,
              requestsPerDay: 10000,
              burstLimit: 2,
            },
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = service.generateAPIKey(params);

        // First two requests should succeed
        expect(service.validateAPIKey(apiKey).valid).toBe(true);
        expect(service.validateAPIKey(apiKey).valid).toBe(true);

        // Third request should fail
        const result = service.validateAPIKey(apiKey);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      });

      it('should not enforce rate limit when disabled', () => {
        const service = new APIKeyService(
          {
            enableRateLimiting: false,
            defaultRateLimit: {
              requestsPerMinute: 1,
              requestsPerHour: 1,
              requestsPerDay: 1,
              burstLimit: 1,
            },
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = service.generateAPIKey(params);

        // Should not throw even after exceeding limit
        service.validateAPIKey(apiKey);
        service.validateAPIKey(apiKey);
        service.validateAPIKey(apiKey);

        const stats = service.getStats();
        expect(stats.rateLimitHits).toBe(0);
      });

      it('should return rate limit state on validation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.validateAPIKey(apiKey);

        expect(result.rateLimitState).toBeDefined();
        expect(result.rateLimitState?.minuteCount).toBe(1);
      });
    });
  });

  describe('Key Rotation', () => {
    describe('rotateAPIKey', () => {
      it('should rotate an active API key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read', 'write'],
          scopes: ['captcha:generate'],
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.rotateAPIKey(keyId);

        expect(result).toHaveProperty('newApiKey');
        expect(result).toHaveProperty('newApiSecret');
        expect(result).toHaveProperty('oldKeyId');
        expect(result).toHaveProperty('newKeyId');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('gracePeriodEnds');

        expect(result.oldKeyId).toBe(keyId);
        expect(result.newKeyId).not.toBe(keyId);
        expect(result.newApiKey).toMatch(/^sk_test_/);
        expect(result.metadata.rotationCount).toBe(1);
        expect(result.metadata.permissions).toEqual(params.permissions);
        expect(result.metadata.scopes).toEqual(params.scopes);
      });

      it('should rotate key with new name', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.rotateAPIKey(keyId, { name: 'Rotated Key' });

        expect(result.metadata.name).toBe('Rotated Key');
      });

      it('should throw error when rotating non-existent key', () => {
        expect(() => apiKeyService.rotateAPIKey('non_existent_key')).toThrow(
          'API key not found'
        );
      });

      it('should throw error when rotating revoked key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.revokeAPIKey(keyId, 'Test');

        expect(() => apiKeyService.rotateAPIKey(keyId)).toThrow(
          'Cannot rotate revoked API key'
        );
      });

      it('should log key rotation event', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.rotateAPIKey(keyId);

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'api_key_rotated',
            resource: 'api_key',
          })
        );
      });

      it('should update statistics on rotation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.rotateAPIKey(keyId);

        const stats = apiKeyService.getStats();
        expect(stats.totalRotations).toBe(1);
        expect(stats.activeKeys).toBe(2); // Old key still active during grace period
      });
    });
  });

  describe('Key Revocation', () => {
    describe('revokeAPIKey', () => {
      it('should revoke an active API key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.revokeAPIKey(keyId, 'Test revocation');

        expect(result).toBe(true);

        const validation = apiKeyService.validateAPIKey(apiKey);
        expect(validation.valid).toBe(false);
        expect(validation.errorCode).toBe('KEY_INACTIVE');
      });

      it('should return true for already revoked key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.revokeAPIKey(keyId, 'First revocation');

        const result = apiKeyService.revokeAPIKey(keyId, 'Second revocation');
        expect(result).toBe(true);
      });

      it('should return false for non-existent key', () => {
        const result = apiKeyService.revokeAPIKey('non_existent_key', 'Test');
        expect(result).toBe(false);
      });

      it('should log key revocation event', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.revokeAPIKey(keyId, 'Test revocation');

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'api_key_revoked',
            resource: 'api_key',
          })
        );
      });

      it('should update statistics on revocation', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.revokeAPIKey(keyId, 'Test');

        const stats = apiKeyService.getStats();
        expect(stats.totalRevocations).toBe(1);
        expect(stats.revokedKeys).toBe(1);
        expect(stats.activeKeys).toBe(0);
      });
    });

    describe('revokeAllUserKeys', () => {
      it('should revoke all keys for a user', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
        };

        // Generate multiple keys
        apiKeyService.generateAPIKey({ ...params, name: 'Key 1' });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 2' });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 3' });

        const revokedCount = apiKeyService.revokeAllUserKeys(params.userId, 'User request');

        expect(revokedCount).toBe(3);

        const stats = apiKeyService.getStats();
        expect(stats.revokedKeys).toBe(3);
        expect(stats.activeKeys).toBe(0);
      });

      it('should return 0 for user with no keys', () => {
        const revokedCount = apiKeyService.revokeAllUserKeys('non_existent_user', 'Test');
        expect(revokedCount).toBe(0);
      });

      it('should log all user keys revoked event', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
        };

        apiKeyService.generateAPIKey({ ...params, name: 'Key 1' });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 2' });

        apiKeyService.revokeAllUserKeys(params.userId, 'User request');

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'all_user_keys_revoked',
            resource: 'api_key',
          })
        );
      });
    });
  });

  describe('Key Update', () => {
    describe('updateAPIKey', () => {
      it('should update API key name', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.updateAPIKey(keyId, { name: 'Updated Name' });

        expect(result?.name).toBe('Updated Name');
      });

      it('should update API key permissions', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read'],
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.updateAPIKey(keyId, {
          permissions: ['read', 'write', 'admin'],
        });

        expect(result?.permissions).toEqual(['read', 'write', 'admin']);
      });

      it('should update API key scopes', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          scopes: ['captcha:generate'],
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.updateAPIKey(keyId, {
          scopes: ['captcha:generate', 'captcha:validate'],
        });

        expect(result?.scopes).toEqual(['captcha:generate', 'captcha:validate']);
      });

      it('should update API key status', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.updateAPIKey(keyId, { status: 'suspended' });

        expect(result?.status).toBe('suspended');
      });

      it('should update API key metadata', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          metadata: { key: 'value' },
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const result = apiKeyService.updateAPIKey(keyId, {
          metadata: { newKey: 'newValue' },
        });

        expect(result?.metadata).toEqual({ key: 'value', newKey: 'newValue' });
      });

      it('should return null for non-existent key', () => {
        const result = apiKeyService.updateAPIKey('non_existent_key', { name: 'Test' });
        expect(result).toBeNull();
      });

      it('should log key update event', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        apiKeyService.updateAPIKey(keyId, { name: 'Updated' });

        expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'api_key_updated',
            resource: 'api_key',
          })
        );
      });
    });
  });

  describe('Key Retrieval', () => {
    describe('getAPIKey', () => {
      it('should get API key metadata', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
          permissions: ['read'],
          scopes: ['captcha:generate'],
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const metadata = apiKeyService.getAPIKey(keyId);

        expect(metadata).toBeDefined();
        expect(metadata?.id).toBe(keyId);
        expect(metadata?.name).toBe(params.name);
        expect(metadata?.userId).toBe(params.userId);
        expect(metadata?.clientId).toBe(params.clientId);
        expect(metadata?.permissions).toEqual(params.permissions);
        expect(metadata?.scopes).toEqual(params.scopes);
      });

      it('should return null for non-existent key', () => {
        const metadata = apiKeyService.getAPIKey('non_existent_key');
        expect(metadata).toBeNull();
      });
    });

    describe('getUserAPIKeys', () => {
      it('should get all API keys for a user', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
        };

        apiKeyService.generateAPIKey({ ...params, name: 'Key 1' });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 2' });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 3' });

        const keys = apiKeyService.getUserAPIKeys(params.userId);

        expect(keys.length).toBe(3);
        expect(keys.every((k) => k.userId === params.userId)).toBe(true);
      });

      it('should return empty array for user with no keys', () => {
        const keys = apiKeyService.getUserAPIKeys('non_existent_user');
        expect(keys).toEqual([]);
      });
    });
  });

  describe('Usage Tracking', () => {
    describe('getUsageHistory', () => {
      it('should get usage history for a key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        // Track some usage
        apiKeyService.validateAPIKey(apiKey, {
          endpoint: '/api/v1/captcha/generate',
          method: 'POST',
        });
        apiKeyService.validateAPIKey(apiKey, {
          endpoint: '/api/v1/captcha/validate',
          method: 'POST',
        });

        const history = apiKeyService.getUsageHistory(keyId);

        expect(history.length).toBe(2);
        // History is sorted by timestamp descending, so most recent should be first
        // Since timestamps are very close, we just check both endpoints are present
        const endpoints = history.map((h) => h.endpoint);
        expect(endpoints).toContain('/api/v1/captcha/validate');
        expect(endpoints).toContain('/api/v1/captcha/generate');
      });

      it('should filter usage history by time range', () => {
        jest.useFakeTimers();
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        // First validation at time T
        apiKeyService.validateAPIKey(apiKey, { endpoint: '/api/v1/endpoint1' });
        
        // Get the actual timestamp of the first usage from history
        const firstHistory = apiKeyService.getUsageHistory(keyId);
        const firstUsageTimestamp = firstHistory[0].timestamp;
        
        // Advance time by 1 second to ensure different timestamp
        jest.advanceTimersByTime(1000);
        
        // Second validation at time T+1000
        apiKeyService.validateAPIKey(apiKey, { endpoint: '/api/v1/endpoint2' });

        // Filter to only get usages after the first one (should only get the second)
        // Use the first usage timestamp + 1 as the start time to exclude the first usage
        const history = apiKeyService.getUsageHistory(keyId, {
          startTime: firstUsageTimestamp + 1,
          endTime: Date.now() + 1000, // Include second usage
        });

        expect(history.length).toBe(1);
        expect(history[0].endpoint).toBe('/api/v1/endpoint2');
        
        jest.useRealTimers();
      });

      it('should limit usage history results', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        // Track multiple usages
        for (let i = 0; i < 10; i++) {
          apiKeyService.validateAPIKey(apiKey, { endpoint: `/api/v1/endpoint${i}` });
        }

        const history = apiKeyService.getUsageHistory(keyId, { limit: 5 });

        expect(history.length).toBe(5);
      });

      it('should return empty array for key with no usage', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { keyId } = apiKeyService.generateAPIKey(params);
        const history = apiKeyService.getUsageHistory(keyId);

        expect(history).toEqual([]);
      });
    });
  });

  describe('Rate Limit State', () => {
    describe('getRateLimitState', () => {
      it('should get rate limit state for a key', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        const { apiKey, keyId } = apiKeyService.generateAPIKey(params);

        // Make some requests
        apiKeyService.validateAPIKey(apiKey);
        apiKeyService.validateAPIKey(apiKey);

        const state = apiKeyService.getRateLimitState(keyId);

        expect(state).toBeDefined();
        expect(state?.minuteCount).toBe(2);
        expect(state?.hourCount).toBe(2);
        expect(state?.dayCount).toBe(2);
      });

      it('should return null for non-existent key', () => {
        const state = apiKeyService.getRateLimitState('non_existent_key');
        expect(state).toBeNull();
      });
    });
  });

  describe('Cleanup', () => {
    describe('cleanupExpiredKeys', () => {
      it('should clean up expired keys', () => {
        const service = new APIKeyService(
          {
            defaultLifetime: 1, // 1 second
            enableExpiration: true,
          },
          mockSecurityLogger
        );

        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        service.generateAPIKey(params);

        // Wait for key to expire
        jest.useFakeTimers();
        jest.advanceTimersByTime(2000);

        const cleanedCount = service.cleanupExpiredKeys();

        expect(cleanedCount).toBe(1);

        const stats = service.getStats();
        expect(stats.activeKeys).toBe(0);
        expect(stats.expiredKeys).toBe(1);

        jest.useRealTimers();
      });

      it('should not clean up active keys', () => {
        const params = {
          name: 'Test API Key',
          userId: 'user123',
          clientId: 'client456',
        };

        apiKeyService.generateAPIKey(params);

        const cleanedCount = apiKeyService.cleanupExpiredKeys();

        expect(cleanedCount).toBe(0);

        const stats = apiKeyService.getStats();
        expect(stats.activeKeys).toBe(1);
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should track statistics correctly', () => {
        const params = {
          userId: 'user123',
          clientId: 'client456',
        };

        // Generate keys
        const { apiKey, keyId } = apiKeyService.generateAPIKey({
          ...params,
          name: 'Key 1',
        });
        apiKeyService.generateAPIKey({ ...params, name: 'Key 2' });

        // Validate key
        apiKeyService.validateAPIKey(apiKey);
        apiKeyService.validateAPIKey('invalid_key');

        // Rotate key
        apiKeyService.rotateAPIKey(keyId);

        // Revoke key
        apiKeyService.revokeAPIKey(keyId, 'Test');

        const stats = apiKeyService.getStats();

        // totalKeysGenerated counts original keys generated, not rotated keys
        expect(stats.totalKeysGenerated).toBe(2); // 2 original keys
        expect(stats.activeKeys).toBe(2); // Key 2 + rotated key (old key still active during grace period)
        expect(stats.revokedKeys).toBe(1);
        expect(stats.totalValidations).toBe(2);
        expect(stats.successfulValidations).toBe(1);
        expect(stats.failedValidations).toBe(1);
        expect(stats.totalRotations).toBe(1);
        expect(stats.totalRevocations).toBe(1);
      });
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const service = new APIKeyService({}, mockSecurityLogger);

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      const result = service.generateAPIKey(params);

      expect(result.apiKey).toMatch(/^sk_/);
      expect(result.metadata.expiresAt).toBeDefined();
    });

    it('should override default configuration', () => {
      const service = new APIKeyService(
        {
          keyPrefix: 'custom_',
          keyLength: 64,
          defaultLifetime: 86400 * 30,
          maxKeysPerUser: 5,
        },
        mockSecurityLogger
      );

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      const result = service.generateAPIKey(params);

      expect(result.apiKey).toMatch(/^custom_/);
    });

    it('should disable expiration when configured', () => {
      const service = new APIKeyService(
        {
          enableExpiration: false,
        },
        mockSecurityLogger
      );

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      const result = service.generateAPIKey(params);

      // Should have max lifetime instead of default lifetime
      const expectedExpiresAt =
        Math.floor(Date.now() / 1000) + 86400 * 365 * 5; // maxLifetime
      expect(result.metadata.expiresAt).toBeGreaterThanOrEqual(expectedExpiresAt - 1);
    });

    it('should disable key hashing when configured', () => {
      const service = new APIKeyService(
        {
          enableKeyHashing: false,
        },
        mockSecurityLogger
      );

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      const { apiKey } = service.generateAPIKey(params);

      // Validation should still work
      const result = service.validateAPIKey(apiKey);
      expect(result.valid).toBe(true);
    });

    it('should disable usage tracking when configured', () => {
      const service = new APIKeyService(
        {
          enableUsageTracking: false,
        },
        mockSecurityLogger
      );

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      const { apiKey, keyId } = service.generateAPIKey(params);

      service.validateAPIKey(apiKey, {
        endpoint: '/api/v1/test',
      });

      const history = service.getUsageHistory(keyId);
      expect(history.length).toBe(0);
    });

    it('should disable logging when configured', () => {
      const service = new APIKeyService(
        {
          enableLogging: false,
        },
        mockSecurityLogger
      );

      const params = {
        name: 'Test API Key',
        userId: 'user123',
        clientId: 'client456',
      };

      service.generateAPIKey(params);

      expect(mockSecurityLogger.logSecurityEvent).not.toHaveBeenCalled();
    });
  });
});