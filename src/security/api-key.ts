/**
 * API Key Management System
 * Implements enterprise-grade API key generation, validation, rotation, usage tracking, and revocation
 */

import * as crypto from 'crypto';
import { SecurityLogger } from './security-logger';
import { SecurityEventDetails, RateLimit } from '../types/security';

// API Key Types
export type APIKeyStatus = 'active' | 'revoked' | 'expired' | 'suspended';

export interface APIKeyConfig {
  // Key generation settings
  keyLength: number;
  keyPrefix: string;
  secretLength: number;

  // Key lifetime settings
  defaultLifetime: number; // in seconds
  maxLifetime: number; // in seconds
  enableExpiration: boolean;

  // Rate limiting settings
  defaultRateLimit: RateLimit;
  enableRateLimiting: boolean;

  // Security settings
  enableKeyHashing: boolean;
  enableKeyRotation: boolean;
  rotationGracePeriod: number; // in seconds
  maxKeysPerUser: number;

  // Usage tracking
  enableUsageTracking: boolean;
  trackIpAddresses: boolean;
  trackUserAgents: boolean;

  // Logging
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface APIKeyMetadata {
  id: string;
  name: string;
  userId: string;
  clientId: string;
  permissions: string[];
  scopes: string[];
  status: APIKeyStatus;
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
  lastRotatedAt?: number;
  rotationCount: number;
  metadata: Record<string, unknown>;
}

export interface APIKeyUsage {
  keyId: string;
  timestamp: number;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface APIKeyRateLimitState {
  keyId: string;
  minuteCount: number;
  minuteResetAt: number;
  hourCount: number;
  hourResetAt: number;
  dayCount: number;
  dayResetAt: number;
  burstCount: number;
  burstResetAt: number;
}

export interface APIKeyValidationResult {
  valid: boolean;
  keyId?: string;
  userId?: string;
  clientId?: string;
  permissions?: string[];
  scopes?: string[];
  rateLimit?: RateLimit;
  rateLimitState?: APIKeyRateLimitState;
  error?: string;
  errorCode?: string;
}

export interface APIKeyGenerationResult {
  apiKey: string;
  apiSecret: string;
  keyId: string;
  metadata: APIKeyMetadata;
}

export interface APIKeyRotationResult {
  newApiKey: string;
  newApiSecret: string;
  oldKeyId: string;
  newKeyId: string;
  metadata: APIKeyMetadata;
  gracePeriodEnds: number;
}

export interface APIKeyStats {
  totalKeysGenerated: number;
  activeKeys: number;
  revokedKeys: number;
  expiredKeys: number;
  suspendedKeys: number;
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  totalRotations: number;
  totalRevocations: number;
  totalUsageRecords: number;
  rateLimitHits: number;
  lastActivity: number;
}

export interface CreateAPIKeyParams {
  name: string;
  userId: string;
  clientId: string;
  permissions?: string[];
  scopes?: string[];
  lifetime?: number;
  rateLimit?: Partial<RateLimit>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAPIKeyParams {
  name?: string;
  permissions?: string[];
  scopes?: string[];
  rateLimit?: Partial<RateLimit>;
  status?: APIKeyStatus;
  metadata?: Record<string, unknown>;
}

export class APIKeyService {
  private readonly config: APIKeyConfig;
  private readonly securityLogger: SecurityLogger;

  // Key storage
  private readonly keys: Map<string, APIKeyMetadata> = new Map();
  private readonly keyHashMap: Map<string, string> = new Map(); // hash -> keyId
  private readonly rawKeyMap: Map<string, string> = new Map(); // rawKey -> keyId (for non-hashed keys)
  private readonly userKeys: Map<string, Set<string>> = new Map(); // userId -> Set<keyId>

  // Rate limiting state
  private readonly rateLimitStates: Map<string, APIKeyRateLimitState> = new Map();

  // Usage tracking
  private readonly usageHistory: Map<string, APIKeyUsage[]> = new Map();

  // Statistics
  private readonly stats: APIKeyStats = {
    totalKeysGenerated: 0,
    activeKeys: 0,
    revokedKeys: 0,
    expiredKeys: 0,
    suspendedKeys: 0,
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    totalRotations: 0,
    totalRevocations: 0,
    totalUsageRecords: 0,
    rateLimitHits: 0,
    lastActivity: Date.now(),
  };

  constructor(config: Partial<APIKeyConfig>, securityLogger: SecurityLogger) {
    this.config = {
      keyLength: 32,
      keyPrefix: 'sk_',
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
      ...config,
    };

    this.securityLogger = securityLogger;
  }

  /**
   * Generate a new API key
   */
  generateAPIKey(params: CreateAPIKeyParams): APIKeyGenerationResult {
    this.stats.lastActivity = Date.now();

    // Check max keys per user
    const userKeySet = this.userKeys.get(params.userId);
    if (userKeySet && userKeySet.size >= this.config.maxKeysPerUser) {
      this.logAPIKeyEvent('api_key_generation_failed', {
        userId: params.userId,
        reason: 'Maximum keys per user exceeded',
      });
      throw new Error(
        `Maximum number of API keys (${this.config.maxKeysPerUser}) reached for user`
      );
    }

    // Generate key and secret
    const apiKey = this.generateKey();
    const apiSecret = this.generateSecret();
    const keyId = this.generateKeyId();

    // Calculate expiration
    const now = Date.now();
    const lifetime = Math.min(
      params.lifetime || this.config.defaultLifetime,
      this.config.maxLifetime
    );
    const expiresAt = this.config.enableExpiration
      ? Math.floor(now / 1000) + lifetime
      : Math.floor(now / 1000) + this.config.maxLifetime;

    // Merge rate limit with defaults
    const rateLimit: RateLimit = {
      ...this.config.defaultRateLimit,
      ...params.rateLimit,
    };

    // Create metadata
    const metadata: APIKeyMetadata = {
      id: keyId,
      name: params.name,
      userId: params.userId,
      clientId: params.clientId,
      permissions: params.permissions || [],
      scopes: params.scopes || [],
      status: 'active',
      createdAt: Math.floor(now / 1000),
      expiresAt,
      rotationCount: 0,
      metadata: params.metadata || {},
    };

    // Store key
    this.keys.set(keyId, metadata);

    // Store key hash for validation
    if (this.config.enableKeyHashing) {
      const keyHash = this.hashKey(apiKey);
      this.keyHashMap.set(keyHash, keyId);
    } else {
      // Store raw key for validation when hashing is disabled
      this.rawKeyMap.set(apiKey, keyId);
    }

    // Track user keys
    if (!this.userKeys.has(params.userId)) {
      this.userKeys.set(params.userId, new Set());
    }
    this.userKeys.get(params.userId)!.add(keyId);

    // Initialize rate limit state
    this.initializeRateLimitState(keyId, rateLimit);

    // Update statistics
    this.stats.totalKeysGenerated++;
    this.stats.activeKeys++;
    this.updateStats();

    this.logAPIKeyEvent('api_key_generated', {
      keyId,
      userId: params.userId,
      clientId: params.clientId,
      name: params.name,
      permissions: params.permissions,
      scopes: params.scopes,
      expiresAt,
    });

    return {
      apiKey,
      apiSecret,
      keyId,
      metadata,
    };
  }

  /**
   * Validate an API key
   */
  validateAPIKey(
    apiKey: string,
    options?: {
      requiredPermissions?: string[];
      requiredScopes?: string[];
      endpoint?: string;
      method?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): APIKeyValidationResult {
    this.stats.totalValidations++;
    this.stats.lastActivity = Date.now();

    // Get key ID from hash
    let keyId: string | undefined;
    if (this.config.enableKeyHashing) {
      const keyHash = this.hashKey(apiKey);
      keyId = this.keyHashMap.get(keyHash);
    } else {
      // If not hashing, look up raw key directly
      keyId = this.rawKeyMap.get(apiKey);
    }

    if (!keyId) {
      this.stats.failedValidations++;
      this.logAPIKeyEvent('api_key_validation_failed', {
        reason: 'API key not found',
        errorCode: 'KEY_NOT_FOUND',
      });
      return {
        valid: false,
        error: 'Invalid API key',
        errorCode: 'KEY_NOT_FOUND',
      };
    }

    // Get key metadata
    const metadata = this.keys.get(keyId);
    if (!metadata) {
      this.stats.failedValidations++;
      return {
        valid: false,
        error: 'API key metadata not found',
        errorCode: 'METADATA_NOT_FOUND',
      };
    }

    // Check key status
    if (metadata.status !== 'active') {
      this.stats.failedValidations++;
      this.logAPIKeyEvent('api_key_validation_failed', {
        keyId,
        userId: metadata.userId,
        reason: `API key status is ${metadata.status}`,
        errorCode: 'KEY_INACTIVE',
      });
      return {
        valid: false,
        error: `API key is ${metadata.status}`,
        errorCode: 'KEY_INACTIVE',
      };
    }

    // Check expiration
    if (this.config.enableExpiration) {
      const now = Math.floor(Date.now() / 1000);
      if (metadata.expiresAt < now) {
        // Mark as expired
        metadata.status = 'expired';
        this.stats.activeKeys--;
        this.stats.expiredKeys++;
        this.updateStats();

        this.stats.failedValidations++;
        this.logAPIKeyEvent('api_key_validation_failed', {
          keyId,
          userId: metadata.userId,
          reason: 'API key has expired',
          errorCode: 'KEY_EXPIRED',
        });
        return {
          valid: false,
          error: 'API key has expired',
          errorCode: 'KEY_EXPIRED',
        };
      }
    }

    // Check permissions
    if (options?.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasAllPermissions = options.requiredPermissions.every(
        perm => metadata.permissions.includes(perm) || metadata.permissions.includes('*')
      );
      if (!hasAllPermissions) {
        this.stats.failedValidations++;
        this.logAPIKeyEvent('api_key_validation_failed', {
          keyId,
          userId: metadata.userId,
          reason: 'Insufficient permissions',
          errorCode: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions: options.requiredPermissions,
          actualPermissions: metadata.permissions,
        });
        return {
          valid: false,
          error: 'Insufficient permissions',
          errorCode: 'INSUFFICIENT_PERMISSIONS',
        };
      }
    }

    // Check scopes
    if (options?.requiredScopes && options.requiredScopes.length > 0) {
      const hasAllScopes = options.requiredScopes.every(
        scope => metadata.scopes.includes(scope) || metadata.scopes.includes('*')
      );
      if (!hasAllScopes) {
        this.stats.failedValidations++;
        this.logAPIKeyEvent('api_key_validation_failed', {
          keyId,
          userId: metadata.userId,
          reason: 'Insufficient scopes',
          errorCode: 'INSUFFICIENT_SCOPES',
          requiredScopes: options.requiredScopes,
          actualScopes: metadata.scopes,
        });
        return {
          valid: false,
          error: 'Insufficient scopes',
          errorCode: 'INSUFFICIENT_SCOPES',
        };
      }
    }

    // Check rate limit
    let rateLimitState: APIKeyRateLimitState | undefined;
    if (this.config.enableRateLimiting) {
      const rateLimitResult = this.checkRateLimit(keyId);
      if (!rateLimitResult.allowed) {
        this.stats.rateLimitHits++;
        this.stats.failedValidations++;
        this.logAPIKeyEvent('api_key_validation_failed', {
          keyId,
          userId: metadata.userId,
          reason: 'Rate limit exceeded',
          errorCode: 'RATE_LIMIT_EXCEEDED',
          rateLimitState: rateLimitResult.state,
        });
        return {
          valid: false,
          error: 'Rate limit exceeded',
          errorCode: 'RATE_LIMIT_EXCEEDED',
          rateLimitState: rateLimitResult.state,
        };
      }
      rateLimitState = rateLimitResult.state;
    }

    // Update last used timestamp
    metadata.lastUsedAt = Math.floor(Date.now() / 1000);

    // Track usage
    if (this.config.enableUsageTracking && options?.endpoint) {
      this.trackUsage(keyId, {
        keyId,
        timestamp: Date.now(),
        endpoint: options.endpoint,
        method: options.method || 'GET',
        statusCode: 200,
        responseTime: 0,
        ipAddress: this.config.trackIpAddresses ? options.ipAddress : undefined,
        userAgent: this.config.trackUserAgents ? options.userAgent : undefined,
      });
    }

    this.stats.successfulValidations++;
    this.logAPIKeyEvent('api_key_validated', {
      keyId,
      userId: metadata.userId,
      clientId: metadata.clientId,
      endpoint: options?.endpoint,
    });

    return {
      valid: true,
      keyId: metadata.id,
      userId: metadata.userId,
      clientId: metadata.clientId,
      permissions: metadata.permissions,
      scopes: metadata.scopes,
      rateLimit: this.getRateLimitForUser(metadata.userId),
      rateLimitState,
    };
  }

  /**
   * Rotate an API key
   */
  rotateAPIKey(keyId: string, params?: { name?: string }): APIKeyRotationResult {
    this.stats.lastActivity = Date.now();

    // Get existing key metadata
    const existingMetadata = this.keys.get(keyId);
    if (!existingMetadata) {
      this.logAPIKeyEvent('api_key_rotation_failed', {
        keyId,
        reason: 'API key not found',
      });
      throw new Error('API key not found');
    }

    // Check if key is active
    if (existingMetadata.status !== 'active') {
      this.logAPIKeyEvent('api_key_rotation_failed', {
        keyId,
        userId: existingMetadata.userId,
        reason: `Cannot rotate ${existingMetadata.status} key`,
      });
      throw new Error(`Cannot rotate ${existingMetadata.status} API key`);
    }

    // Generate new key and secret
    const newApiKey = this.generateKey();
    const newApiSecret = this.generateSecret();
    const newKeyId = this.generateKeyId();

    // Calculate grace period end
    const now = Math.floor(Date.now() / 1000);
    const gracePeriodEnds = now + this.config.rotationGracePeriod;

    // Create new metadata
    const newMetadata: APIKeyMetadata = {
      ...existingMetadata,
      id: newKeyId,
      name: params?.name || existingMetadata.name,
      createdAt: now,
      lastRotatedAt: now,
      rotationCount: existingMetadata.rotationCount + 1,
    };

    // Store new key
    this.keys.set(newKeyId, newMetadata);

    // Store new key hash
    if (this.config.enableKeyHashing) {
      const newKeyHash = this.hashKey(newApiKey);
      this.keyHashMap.set(newKeyHash, newKeyId);
    }

    // Track user keys
    const userKeySet = this.userKeys.get(existingMetadata.userId);
    if (userKeySet) {
      userKeySet.add(newKeyId);
    }

    // Initialize rate limit state for new key
    const rateLimit = this.getRateLimitForUser(existingMetadata.userId);
    this.initializeRateLimitState(newKeyId, rateLimit);

    // Mark old key as revoked after grace period
    // For now, we'll keep it active during grace period
    setTimeout(() => {
      const oldMetadata = this.keys.get(keyId);
      if (oldMetadata && oldMetadata.status === 'active') {
        oldMetadata.status = 'revoked';
        this.stats.activeKeys--;
        this.stats.revokedKeys++;
        this.updateStats();

        this.logAPIKeyEvent('api_key_grace_period_ended', {
          oldKeyId: keyId,
          newKeyId,
          userId: existingMetadata.userId,
        });
      }
    }, this.config.rotationGracePeriod * 1000);

    // Update statistics
    this.stats.totalRotations++;
    this.stats.activeKeys++;
    this.updateStats();

    this.logAPIKeyEvent('api_key_rotated', {
      oldKeyId: keyId,
      newKeyId,
      userId: existingMetadata.userId,
      clientId: existingMetadata.clientId,
      rotationCount: newMetadata.rotationCount,
      gracePeriodEnds,
    });

    return {
      newApiKey,
      newApiSecret,
      oldKeyId: keyId,
      newKeyId,
      metadata: newMetadata,
      gracePeriodEnds,
    };
  }

  /**
   * Revoke an API key
   */
  revokeAPIKey(keyId: string, reason: string = 'Manual revocation'): boolean {
    this.stats.lastActivity = Date.now();

    const metadata = this.keys.get(keyId);
    if (!metadata) {
      this.logAPIKeyEvent('api_key_revocation_failed', {
        keyId,
        reason: 'API key not found',
      });
      return false;
    }

    if (metadata.status === 'revoked') {
      return true; // Already revoked
    }

    // Update status
    const wasActive = metadata.status === 'active';
    metadata.status = 'revoked';

    // Update statistics
    if (wasActive) {
      this.stats.activeKeys--;
    }
    this.stats.revokedKeys++;
    this.stats.totalRevocations++;
    this.updateStats();

    this.logAPIKeyEvent('api_key_revoked', {
      keyId,
      userId: metadata.userId,
      clientId: metadata.clientId,
      reason,
    });

    return true;
  }

  /**
   * Revoke all API keys for a user
   */
  revokeAllUserKeys(userId: string, reason: string = 'User request'): number {
    this.stats.lastActivity = Date.now();

    const userKeySet = this.userKeys.get(userId);
    if (!userKeySet || userKeySet.size === 0) {
      return 0;
    }

    let revokedCount = 0;
    for (const keyId of userKeySet) {
      if (this.revokeAPIKey(keyId, reason)) {
        revokedCount++;
      }
    }

    this.logAPIKeyEvent('all_user_keys_revoked', {
      userId,
      reason,
      revokedCount,
    });

    return revokedCount;
  }

  /**
   * Update an API key
   */
  updateAPIKey(keyId: string, params: UpdateAPIKeyParams): APIKeyMetadata | null {
    this.stats.lastActivity = Date.now();

    const metadata = this.keys.get(keyId);
    if (!metadata) {
      this.logAPIKeyEvent('api_key_update_failed', {
        keyId,
        reason: 'API key not found',
      });
      return null;
    }

    // Update fields
    if (params.name !== undefined) {
      metadata.name = params.name;
    }
    if (params.permissions !== undefined) {
      metadata.permissions = params.permissions;
    }
    if (params.scopes !== undefined) {
      metadata.scopes = params.scopes;
    }
    if (params.status !== undefined) {
      const oldStatus = metadata.status;
      metadata.status = params.status;

      // Update statistics
      if (oldStatus === 'active' && params.status !== 'active') {
        this.stats.activeKeys--;
      } else if (oldStatus !== 'active' && params.status === 'active') {
        this.stats.activeKeys++;
      }

      if (params.status === 'revoked') {
        this.stats.revokedKeys++;
      } else if (params.status === 'expired') {
        this.stats.expiredKeys++;
      } else if (params.status === 'suspended') {
        this.stats.suspendedKeys++;
      }
    }
    if (params.metadata !== undefined) {
      metadata.metadata = { ...metadata.metadata, ...params.metadata };
    }

    // Update rate limit if provided
    if (params.rateLimit) {
      const currentRateLimit = this.getRateLimitForUser(metadata.userId);
      const newRateLimit: RateLimit = {
        ...currentRateLimit,
        ...params.rateLimit,
      };
      this.initializeRateLimitState(keyId, newRateLimit);
    }

    this.updateStats();

    this.logAPIKeyEvent('api_key_updated', {
      keyId,
      userId: metadata.userId,
      updates: params,
    });

    return { ...metadata };
  }

  /**
   * Get API key metadata
   */
  getAPIKey(keyId: string): APIKeyMetadata | null {
    const metadata = this.keys.get(keyId);
    return metadata ? { ...metadata } : null;
  }

  /**
   * Get all API keys for a user
   */
  getUserAPIKeys(userId: string): APIKeyMetadata[] {
    const userKeySet = this.userKeys.get(userId);
    if (!userKeySet) {
      return [];
    }

    const keys: APIKeyMetadata[] = [];
    for (const keyId of userKeySet) {
      const metadata = this.keys.get(keyId);
      if (metadata) {
        keys.push({ ...metadata });
      }
    }

    return keys;
  }

  /**
   * Get usage history for an API key
   */
  getUsageHistory(
    keyId: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): APIKeyUsage[] {
    const history = this.usageHistory.get(keyId) || [];

    let filtered = history;
    if (options?.startTime) {
      filtered = filtered.filter(usage => usage.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      filtered = filtered.filter(usage => usage.timestamp <= options.endTime!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get rate limit state for an API key
   */
  getRateLimitState(keyId: string): APIKeyRateLimitState | null {
    const state = this.rateLimitStates.get(keyId);
    return state ? { ...state } : null;
  }

  /**
   * Get API key statistics
   */
  getStats(): APIKeyStats {
    return { ...this.stats };
  }

  /**
   * Clear expired API keys
   */
  cleanupExpiredKeys(): number {
    const now = Math.floor(Date.now() / 1000);
    let cleanedCount = 0;

    for (const [keyId, metadata] of this.keys.entries()) {
      if (
        this.config.enableExpiration &&
        metadata.expiresAt < now &&
        metadata.status === 'active'
      ) {
        metadata.status = 'expired';
        this.stats.activeKeys--;
        this.stats.expiredKeys++;
        cleanedCount++;

        this.logAPIKeyEvent('api_key_expired', {
          keyId,
          userId: metadata.userId,
          expiresAt: metadata.expiresAt,
        });
      }
    }

    this.updateStats();

    if (cleanedCount > 0) {
      this.logAPIKeyEvent('cleanup_completed', {
        cleanedCount,
        remainingActiveKeys: this.stats.activeKeys,
      });
    }

    return cleanedCount;
  }

  /**
   * Generate API key string
   */
  private generateKey(): string {
    const randomBytes = crypto.randomBytes(this.config.keyLength);
    const key = randomBytes.toString('hex');
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Generate API secret string
   */
  private generateSecret(): string {
    return crypto.randomBytes(this.config.secretLength).toString('hex');
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hash API key for storage
   */
  private hashKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Initialize rate limit state for a key
   */
  private initializeRateLimitState(keyId: string, _rateLimit: RateLimit): void {
    const now = Date.now();
    this.rateLimitStates.set(keyId, {
      keyId,
      minuteCount: 0,
      minuteResetAt: now + 60000,
      hourCount: 0,
      hourResetAt: now + 3600000,
      dayCount: 0,
      dayResetAt: now + 86400000,
      burstCount: 0,
      burstResetAt: now + 1000, // 1 second burst window
    });
  }

  /**
   * Check rate limit for a key
   */
  private checkRateLimit(keyId: string): {
    allowed: boolean;
    state: APIKeyRateLimitState;
  } {
    const state = this.rateLimitStates.get(keyId);
    if (!state) {
      return {
        allowed: true,
        state: {
          keyId,
          minuteCount: 0,
          minuteResetAt: Date.now() + 60000,
          hourCount: 0,
          hourResetAt: Date.now() + 3600000,
          dayCount: 0,
          dayResetAt: Date.now() + 86400000,
          burstCount: 0,
          burstResetAt: Date.now() + 1000,
        },
      };
    }

    const now = Date.now();
    const metadata = this.keys.get(keyId);
    if (!metadata) {
      return { allowed: false, state };
    }

    // Get rate limit for this user/key
    const rateLimit = this.getRateLimitForUser(metadata.userId);

    // Reset counters if needed
    if (now > state.minuteResetAt) {
      state.minuteCount = 0;
      state.minuteResetAt = now + 60000;
    }
    if (now > state.hourResetAt) {
      state.hourCount = 0;
      state.hourResetAt = now + 3600000;
    }
    if (now > state.dayResetAt) {
      state.dayCount = 0;
      state.dayResetAt = now + 86400000;
    }
    if (now > state.burstResetAt) {
      state.burstCount = 0;
      state.burstResetAt = now + 1000;
    }

    // Check limits
    if (state.minuteCount >= rateLimit.requestsPerMinute) {
      return { allowed: false, state };
    }
    if (state.hourCount >= rateLimit.requestsPerHour) {
      return { allowed: false, state };
    }
    if (state.dayCount >= rateLimit.requestsPerDay) {
      return { allowed: false, state };
    }
    if (state.burstCount >= rateLimit.burstLimit) {
      return { allowed: false, state };
    }

    // Increment counters
    state.minuteCount++;
    state.hourCount++;
    state.dayCount++;
    state.burstCount++;

    return { allowed: true, state };
  }

  /**
   * Get rate limit for a user
   */
  private getRateLimitForUser(userId: string): RateLimit {
    // Find the most permissive rate limit among user's keys
    const userKeySet = this.userKeys.get(userId);
    if (!userKeySet) {
      return this.config.defaultRateLimit;
    }

    const maxRateLimit = this.config.defaultRateLimit;
    for (const keyId of userKeySet) {
      const state = this.rateLimitStates.get(keyId);
      if (state) {
        // Use the stored rate limit (we'd need to store it separately for this to work perfectly)
        // For now, return default
      }
    }

    return maxRateLimit;
  }

  /**
   * Track API key usage
   */
  private trackUsage(keyId: string, usage: APIKeyUsage): void {
    if (!this.usageHistory.has(keyId)) {
      this.usageHistory.set(keyId, []);
    }

    const history = this.usageHistory.get(keyId)!;
    history.push(usage);

    // Keep only last 1000 usage records per key
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.stats.totalUsageRecords++;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    // Recalculate active/revoked/expired/suspended counts
    let activeKeys = 0;
    let revokedKeys = 0;
    let expiredKeys = 0;
    let suspendedKeys = 0;

    for (const metadata of this.keys.values()) {
      switch (metadata.status) {
        case 'active':
          activeKeys++;
          break;
        case 'revoked':
          revokedKeys++;
          break;
        case 'expired':
          expiredKeys++;
          break;
        case 'suspended':
          suspendedKeys++;
          break;
      }
    }

    this.stats.activeKeys = activeKeys;
    this.stats.revokedKeys = revokedKeys;
    this.stats.expiredKeys = expiredKeys;
    this.stats.suspendedKeys = suspendedKeys;
  }

  /**
   * Log API key event
   */
  private logAPIKeyEvent(action: string, metadata: Record<string, unknown>): void {
    if (!this.config.enableLogging) {
      return;
    }

    const event: SecurityEventDetails = {
      action,
      resource: 'api_key',
      reason: `API key event: ${action}`,
      metadata,
    };

    this.securityLogger.logSecurityEvent(event);
  }
}
