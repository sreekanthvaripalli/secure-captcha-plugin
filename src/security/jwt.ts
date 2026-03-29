/**
 * JWT Token System
 * Implements enterprise-grade JWT token generation, validation, refresh, and revocation
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { SecurityLogger } from './security-logger';
import { SecurityEventDetails } from '../types/security';

// JWT Types
export type JWTAlgorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'ES256'
  | 'ES384'
  | 'ES512';

export type TokenType = 'access' | 'refresh' | 'id' | 'api';

export interface JWTPayload {
  // Standard JWT claims
  iss?: string; // Issuer
  sub?: string; // Subject
  aud?: string | string[]; // Audience
  exp?: number; // Expiration time
  nbf?: number; // Not before
  iat?: number; // Issued at
  jti?: string; // JWT ID

  // Custom claims
  type?: TokenType;
  scope?: string[];
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

export interface AccessTokenPayload extends JWTPayload {
  type: 'access';
  userId: string;
  clientId: string;
  sessionId: string;
  scope: string[];
  roles: string[];
  permissions: string[];
}

export interface RefreshTokenPayload extends JWTPayload {
  type: 'refresh';
  userId: string;
  clientId: string;
  sessionId: string;
  accessTokenId: string;
  family: string; // Token family for rotation detection
  generation: number; // Generation number for rotation tracking
}

export interface IdTokenPayload extends JWTPayload {
  type: 'id';
  userId: string;
  clientId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  nonce?: string;
}

export interface ApiTokenPayload extends JWTPayload {
  type: 'api';
  apiKeyId: string;
  clientId: string;
  scope: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export interface JWTConfig {
  // Issuer configuration
  issuer: string;
  audience: string | string[];

  // Token lifetimes (in seconds)
  accessTokenLifetime: number;
  refreshTokenLifetime: number;
  idTokenLifetime: number;
  apiTokenLifetime: number;

  // Signing configuration
  algorithm: JWTAlgorithm;
  secret: string;
  publicKey?: string;
  privateKey?: string;

  // Security settings
  enableTokenRotation: boolean;
  enableTokenBlacklisting: boolean;
  enableTokenIntrospection: boolean;
  maxRefreshTokenGenerations: number;

  // Rate limiting
  enableRateLimiting: boolean;
  tokenGenerationRateLimit: number; // per minute
  tokenRefreshRateLimit: number; // per minute

  // Logging
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  errorCode?: string;
}

export interface TokenIntrospectionResult {
  active: boolean;
  scope?: string;
  clientId?: string;
  username?: string;
  tokenType?: TokenType;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
  metadata?: Record<string, unknown>;
}

export interface BlacklistedToken {
  jti: string;
  tokenType: TokenType;
  userId: string;
  clientId: string;
  reason: string;
  blacklistedAt: number;
  expiresAt: number;
}

export interface TokenStats {
  totalAccessTokens: number;
  totalRefreshTokens: number;
  totalIdTokens: number;
  totalApiTokens: number;
  activeTokens: number;
  blacklistedTokens: number;
  tokenGenerations: number;
  tokenValidations: number;
  tokenRefreshes: number;
  tokenRevocations: number;
  failedValidations: number;
  rateLimitHits: number;
  lastActivity: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class JWTService {
  private readonly config: JWTConfig;
  private readonly securityLogger: SecurityLogger;

  // Token storage
  private readonly accessTokens: Map<string, AccessTokenPayload> = new Map();
  private readonly refreshTokens: Map<string, RefreshTokenPayload> = new Map();
  private readonly idTokens: Map<string, IdTokenPayload> = new Map();
  private readonly apiTokens: Map<string, ApiTokenPayload> = new Map();

  // Blacklist
  private readonly blacklist: Map<string, BlacklistedToken> = new Map();

  // Rate limiting
  private readonly rateLimitEntries: Map<string, RateLimitEntry> = new Map();

  // Statistics
  private readonly stats: TokenStats = {
    totalAccessTokens: 0,
    totalRefreshTokens: 0,
    totalIdTokens: 0,
    totalApiTokens: 0,
    activeTokens: 0,
    blacklistedTokens: 0,
    tokenGenerations: 0,
    tokenValidations: 0,
    tokenRefreshes: 0,
    tokenRevocations: 0,
    failedValidations: 0,
    rateLimitHits: 0,
    lastActivity: Date.now(),
  };

  constructor(config: Partial<JWTConfig>, securityLogger: SecurityLogger) {
    this.config = {
      issuer: 'https://secure-captcha.example.com',
      audience: 'https://secure-captcha.example.com',
      accessTokenLifetime: 3600, // 1 hour
      refreshTokenLifetime: 86400 * 30, // 30 days
      idTokenLifetime: 3600, // 1 hour
      apiTokenLifetime: 86400 * 365, // 1 year
      algorithm: 'HS256',
      secret: this.generateSecret(),
      enableTokenRotation: true,
      enableTokenBlacklisting: true,
      enableTokenIntrospection: true,
      maxRefreshTokenGenerations: 10,
      enableRateLimiting: true,
      tokenGenerationRateLimit: 100, // per minute
      tokenRefreshRateLimit: 50, // per minute
      enableLogging: true,
      logLevel: 'info',
      ...config,
    };

    this.securityLogger = securityLogger;
  }

  /**
   * Generate access token
   */
  generateAccessToken(params: {
    userId: string;
    clientId: string;
    sessionId: string;
    scope?: string[];
    roles?: string[];
    permissions?: string[];
    metadata?: Record<string, unknown>;
  }): { token: string; payload: AccessTokenPayload } {
    // Check rate limit
    if (this.config.enableRateLimiting) {
      const rateLimitKey = `access_token:${params.userId}`;
      if (!this.checkRateLimit(rateLimitKey, this.config.tokenGenerationRateLimit)) {
        this.stats.rateLimitHits++;
        this.logJWTEvent('rate_limit_exceeded', {
          userId: params.userId,
          tokenType: 'access',
        });
        throw new Error('Rate limit exceeded for token generation');
      }
    }

    const jti = this.generateJTI();
    const now = Math.floor(Date.now() / 1000);

    const payload: AccessTokenPayload = {
      type: 'access',
      iss: this.config.issuer,
      sub: params.userId,
      aud: this.config.audience,
      exp: now + this.config.accessTokenLifetime,
      iat: now,
      jti,
      userId: params.userId,
      clientId: params.clientId,
      sessionId: params.sessionId,
      scope: params.scope || [],
      roles: params.roles || [],
      permissions: params.permissions || [],
      metadata: params.metadata,
    };

    const token = this.signToken(payload);

    // Store token
    this.accessTokens.set(jti, payload);
    this.stats.totalAccessTokens++;
    this.stats.tokenGenerations++;
    this.stats.lastActivity = Date.now();
    this.updateStats();

    this.logJWTEvent('access_token_generated', {
      jti,
      userId: params.userId,
      clientId: params.clientId,
      scope: params.scope,
      expiresAt: payload.exp,
    });

    return { token, payload };
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(params: {
    userId: string;
    clientId: string;
    sessionId: string;
    accessTokenId: string;
    scope?: string[];
    family?: string;
    generation?: number;
  }): { token: string; payload: RefreshTokenPayload } {
    // Check rate limit
    if (this.config.enableRateLimiting) {
      const rateLimitKey = `refresh_token:${params.userId}`;
      if (!this.checkRateLimit(rateLimitKey, this.config.tokenRefreshRateLimit)) {
        this.stats.rateLimitHits++;
        this.logJWTEvent('rate_limit_exceeded', {
          userId: params.userId,
          tokenType: 'refresh',
        });
        throw new Error('Rate limit exceeded for token refresh');
      }
    }

    const jti = this.generateJTI();
    const now = Math.floor(Date.now() / 1000);
    const family = params.family || this.generateTokenFamily();
    const generation = params.generation ?? 0;

    // Check max generations
    if (generation >= this.config.maxRefreshTokenGenerations) {
      throw new Error('Maximum refresh token generations exceeded. Token family revoked.');
    }

    const payload: RefreshTokenPayload = {
      type: 'refresh',
      iss: this.config.issuer,
      sub: params.userId,
      aud: this.config.audience,
      exp: now + this.config.refreshTokenLifetime,
      iat: now,
      jti,
      userId: params.userId,
      clientId: params.clientId,
      sessionId: params.sessionId,
      accessTokenId: params.accessTokenId,
      scope: params.scope || [],
      family,
      generation,
    };

    const token = this.signToken(payload);

    // Store token
    this.refreshTokens.set(jti, payload);
    this.stats.totalRefreshTokens++;
    this.stats.tokenGenerations++;
    this.stats.lastActivity = Date.now();
    this.updateStats();

    this.logJWTEvent('refresh_token_generated', {
      jti,
      userId: params.userId,
      clientId: params.clientId,
      family,
      generation,
      expiresAt: payload.exp,
    });

    return { token, payload };
  }

  /**
   * Generate ID token (OpenID Connect)
   */
  generateIdToken(params: {
    userId: string;
    clientId: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
    locale?: string;
    nonce?: string;
    scope?: string[];
  }): { token: string; payload: IdTokenPayload } {
    const jti = this.generateJTI();
    const now = Math.floor(Date.now() / 1000);

    const payload: IdTokenPayload = {
      type: 'id',
      iss: this.config.issuer,
      sub: params.userId,
      aud: params.clientId,
      exp: now + this.config.idTokenLifetime,
      iat: now,
      jti,
      userId: params.userId,
      clientId: params.clientId,
      email: params.email,
      emailVerified: params.emailVerified,
      name: params.name,
      picture: params.picture,
      locale: params.locale,
      nonce: params.nonce,
    };

    const token = this.signToken(payload);

    // Store token
    this.idTokens.set(jti, payload);
    this.stats.totalIdTokens++;
    this.stats.tokenGenerations++;
    this.stats.lastActivity = Date.now();
    this.updateStats();

    this.logJWTEvent('id_token_generated', {
      jti,
      userId: params.userId,
      clientId: params.clientId,
      expiresAt: payload.exp,
    });

    return { token, payload };
  }

  /**
   * Generate API token
   */
  generateApiToken(params: {
    apiKeyId: string;
    clientId: string;
    scope?: string[];
    rateLimit?: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
  }): { token: string; payload: ApiTokenPayload } {
    const jti = this.generateJTI();
    const now = Math.floor(Date.now() / 1000);

    const payload: ApiTokenPayload = {
      type: 'api',
      iss: this.config.issuer,
      sub: params.apiKeyId,
      aud: this.config.audience,
      exp: now + this.config.apiTokenLifetime,
      iat: now,
      jti,
      apiKeyId: params.apiKeyId,
      clientId: params.clientId,
      scope: params.scope || [],
      rateLimit: params.rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
      },
    };

    const token = this.signToken(payload);

    // Store token
    this.apiTokens.set(jti, payload);
    this.stats.totalApiTokens++;
    this.stats.tokenGenerations++;
    this.stats.lastActivity = Date.now();
    this.updateStats();

    this.logJWTEvent('api_token_generated', {
      jti,
      apiKeyId: params.apiKeyId,
      clientId: params.clientId,
      scope: params.scope,
      expiresAt: payload.exp,
    });

    return { token, payload };
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(params: {
    userId: string;
    clientId: string;
    sessionId: string;
    scope?: string[];
    roles?: string[];
    permissions?: string[];
    metadata?: Record<string, unknown>;
  }): TokenPair {
    // Generate access token
    const accessTokenResult = this.generateAccessToken(params);

    // Generate refresh token
    const refreshTokenResult = this.generateRefreshToken({
      userId: params.userId,
      clientId: params.clientId,
      sessionId: params.sessionId,
      accessTokenId: accessTokenResult.payload.jti!,
      scope: params.scope,
    });

    // Generate ID token if openid scope is present
    let idToken: string | undefined;
    if (params.scope?.includes('openid')) {
      const idTokenResult = this.generateIdToken({
        userId: params.userId,
        clientId: params.clientId,
        scope: params.scope,
      });
      idToken = idTokenResult.token;
    }

    return {
      accessToken: accessTokenResult.token,
      refreshToken: refreshTokenResult.token,
      idToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenLifetime,
      scope: params.scope?.join(' ') || '',
    };
  }

  /**
   * Validate token
   */
  validateToken(token: string): TokenValidationResult {
    this.stats.tokenValidations++;
    this.stats.lastActivity = Date.now();

    try {
      // Verify and decode token
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
      };

      let decoded: JWTPayload;

      // Handle audience - jwt.verify expects specific type
      if (Array.isArray(this.config.audience)) {
        // For array audience, we need to use a different approach
        // jwt.verify doesn't directly support string[] in the options
        // We'll verify without audience in options and check manually
        decoded = jwt.verify(token, this.config.secret, verifyOptions) as JWTPayload;
        
        // Manual audience validation for array case
        if (decoded.aud) {
          const tokenAudience = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
          const hasValidAudience = tokenAudience.some(aud => 
            this.config.audience.includes(aud)
          );
          if (!hasValidAudience) {
            throw new jwt.JsonWebTokenError('Audience mismatch');
          }
        }
      } else {
        verifyOptions.audience = this.config.audience;
        decoded = jwt.verify(token, this.config.secret, verifyOptions) as JWTPayload;
      }

      // Check if token is blacklisted
      if (this.config.enableTokenBlacklisting && decoded.jti) {
        if (this.blacklist.has(decoded.jti)) {
          this.stats.failedValidations++;
          this.logJWTEvent('token_validation_failed', {
            jti: decoded.jti,
            reason: 'Token is blacklisted',
          });
          return {
            valid: false,
            error: 'Token has been revoked',
            errorCode: 'TOKEN_REVOKED',
          };
        }
      }

      // Check token type specific validation
      if (decoded.type === 'access') {
        const storedToken = this.accessTokens.get(decoded.jti!);
        if (!storedToken) {
          this.stats.failedValidations++;
          return {
            valid: false,
            error: 'Token not found',
            errorCode: 'TOKEN_NOT_FOUND',
          };
        }
      } else if (decoded.type === 'refresh') {
        const storedToken = this.refreshTokens.get(decoded.jti!);
        if (!storedToken) {
          this.stats.failedValidations++;
          return {
            valid: false,
            error: 'Token not found',
            errorCode: 'TOKEN_NOT_FOUND',
          };
        }
      }

      this.logJWTEvent('token_validated', {
        jti: decoded.jti,
        type: decoded.type,
        sub: decoded.sub,
      });

      return {
        valid: true,
        payload: decoded,
      };
    } catch (error) {
      this.stats.failedValidations++;

      let errorCode = 'TOKEN_INVALID';
      let errorMessage = 'Invalid token';

      if (error instanceof jwt.TokenExpiredError) {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.NotBeforeError) {
        errorCode = 'TOKEN_NOT_ACTIVE';
        errorMessage = 'Token is not yet active';
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorCode = 'TOKEN_MALFORMED';
        errorMessage = 'Token is malformed';
      }

      this.logJWTEvent('token_validation_failed', {
        error: errorMessage,
        errorCode,
      });

      return {
        valid: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * Refresh access token
   */
  refreshAccessToken(
    refreshToken: string,
    options?: {
      scope?: string[];
      rotateRefreshToken?: boolean;
    }
  ): TokenPair {
    this.stats.tokenRefreshes++;
    this.stats.lastActivity = Date.now();

    // Validate refresh token first to get user ID for rate limiting
    const validation = this.validateToken(refreshToken);
    if (!validation.valid || !validation.payload) {
      throw new Error(`Invalid refresh token: ${validation.error}`);
    }

    const refreshPayload = validation.payload as RefreshTokenPayload;
    if (refreshPayload.type !== 'refresh') {
      throw new Error('Token is not a refresh token');
    }

    // Check rate limit for refresh token operations
    if (this.config.enableRateLimiting) {
      const rateLimitKey = `refresh_token:${refreshPayload.userId}`;
      if (!this.checkRateLimit(rateLimitKey, this.config.tokenRefreshRateLimit)) {
        this.stats.rateLimitHits++;
        this.logJWTEvent('rate_limit_exceeded', {
          userId: refreshPayload.userId,
          tokenType: 'refresh',
        });
        throw new Error('Rate limit exceeded for token refresh');
      }
    }

    // Get stored refresh token
    const storedRefreshToken = this.refreshTokens.get(refreshPayload.jti!);
    if (!storedRefreshToken) {
      throw new Error('Refresh token not found');
    }

    // Check generation limit
    if (storedRefreshToken.generation >= this.config.maxRefreshTokenGenerations) {
      // Revoke the entire token family
      this.revokeTokenFamily(storedRefreshToken.family);
      throw new Error('Maximum refresh token generations exceeded. Token family revoked.');
    }

    // Determine scope for new access token
    let scope = storedRefreshToken.scope || [];
    if (options?.scope) {
      // Validate requested scope doesn't exceed original scope
      const invalidScopes = options.scope.filter(s => !scope.includes(s));
      if (invalidScopes.length > 0) {
        throw new Error(`Cannot grant scopes not in original token: ${invalidScopes.join(', ')}`);
      }
      scope = options.scope;
    }

    // Generate new access token
    const accessTokenResult = this.generateAccessToken({
      userId: storedRefreshToken.userId,
      clientId: storedRefreshToken.clientId,
      sessionId: storedRefreshToken.sessionId,
      scope,
    });

    // Rotate refresh token if enabled
    let newRefreshToken = refreshToken;
    if (this.config.enableTokenRotation || options?.rotateRefreshToken) {
      // Revoke old refresh token
      this.revokeToken(refreshPayload.jti!, 'refresh', 'Token rotation');

      // Generate new refresh token
      const newRefreshTokenResult = this.generateRefreshToken({
        userId: storedRefreshToken.userId,
        clientId: storedRefreshToken.clientId,
        sessionId: storedRefreshToken.sessionId,
        accessTokenId: accessTokenResult.payload.jti!,
        family: storedRefreshToken.family,
        generation: storedRefreshToken.generation + 1,
      });
      newRefreshToken = newRefreshTokenResult.token;
    }

    this.logJWTEvent('token_refreshed', {
      oldRefreshTokenJti: refreshPayload.jti,
      newAccessTokenJti: accessTokenResult.payload.jti,
      userId: storedRefreshToken.userId,
      clientId: storedRefreshToken.clientId,
      rotatedRefreshToken: this.config.enableTokenRotation,
    });

    return {
      accessToken: accessTokenResult.token,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenLifetime,
      scope: scope.join(' '),
    };
  }

  /**
   * Introspect token
   */
  introspectToken(token: string): TokenIntrospectionResult {
    if (!this.config.enableTokenIntrospection) {
      return { active: false };
    }

    const validation = this.validateToken(token);

    if (!validation.valid || !validation.payload) {
      return { active: false };
    }

    const payload = validation.payload;

    return {
      active: true,
      scope: payload.scope?.join(' '),
      clientId: (payload as AccessTokenPayload).clientId,
      username: payload.sub,
      tokenType: payload.type,
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      sub: payload.sub,
      aud: Array.isArray(payload.aud) ? payload.aud.join(' ') : payload.aud,
      iss: payload.iss,
      jti: payload.jti,
      metadata: payload.metadata,
    };
  }

  /**
   * Revoke token
   */
  revokeToken(
    jti: string,
    tokenType?: TokenType,
    reason: string = 'Manual revocation'
  ): boolean {
    this.stats.tokenRevocations++;
    this.stats.lastActivity = Date.now();

    let revoked = false;
    let userId = '';
    let clientId = '';

    // Try to revoke from each token store
    if (!tokenType || tokenType === 'access') {
      const accessToken = this.accessTokens.get(jti);
      if (accessToken) {
        userId = accessToken.userId;
        clientId = accessToken.clientId;
        this.accessTokens.delete(jti);
        revoked = true;
      }
    }

    if (!tokenType || tokenType === 'refresh') {
      const refreshToken = this.refreshTokens.get(jti);
      if (refreshToken) {
        userId = refreshToken.userId;
        clientId = refreshToken.clientId;
        this.refreshTokens.delete(jti);
        revoked = true;
      }
    }

    if (!tokenType || tokenType === 'id') {
      const idToken = this.idTokens.get(jti);
      if (idToken) {
        userId = idToken.userId;
        clientId = idToken.clientId;
        this.idTokens.delete(jti);
        revoked = true;
      }
    }

    if (!tokenType || tokenType === 'api') {
      const apiToken = this.apiTokens.get(jti);
      if (apiToken) {
        clientId = apiToken.clientId;
        this.apiTokens.delete(jti);
        revoked = true;
      }
    }

    // Add to blacklist
    if (revoked && this.config.enableTokenBlacklisting) {
      const blacklistedToken: BlacklistedToken = {
        jti,
        tokenType: tokenType || 'access',
        userId,
        clientId,
        reason,
        blacklistedAt: Date.now(),
        expiresAt: Date.now() + this.config.refreshTokenLifetime * 1000,
      };
      this.blacklist.set(jti, blacklistedToken);
      this.stats.blacklistedTokens++;
    }

    this.updateStats();

    this.logJWTEvent('token_revoked', {
      jti,
      tokenType: tokenType || 'access',
      userId,
      clientId,
      reason,
      revoked,
    });

    return revoked;
  }

  /**
   * Revoke all tokens for a user
   */
  revokeAllUserTokens(userId: string, reason: string = 'User logout'): number {
    let revokedCount = 0;

    // Revoke access tokens
    for (const [jti, token] of this.accessTokens.entries()) {
      if (token.userId === userId) {
        this.revokeToken(jti, 'access', reason);
        revokedCount++;
      }
    }

    // Revoke refresh tokens
    for (const [jti, token] of this.refreshTokens.entries()) {
      if (token.userId === userId) {
        this.revokeToken(jti, 'refresh', reason);
        revokedCount++;
      }
    }

    // Revoke ID tokens
    for (const [jti, token] of this.idTokens.entries()) {
      if (token.userId === userId) {
        this.revokeToken(jti, 'id', reason);
        revokedCount++;
      }
    }

    this.logJWTEvent('all_user_tokens_revoked', {
      userId,
      reason,
      revokedCount,
    });

    return revokedCount;
  }

  /**
   * Revoke token family (for refresh token rotation)
   */
  private revokeTokenFamily(family: string): void {
    let revokedCount = 0;

    for (const [jti, token] of this.refreshTokens.entries()) {
      if (token.family === family) {
        this.revokeToken(jti, 'refresh', 'Token family revoked');
        revokedCount++;
      }
    }

    this.logJWTEvent('token_family_revoked', {
      family,
      revokedCount,
    });
  }

  /**
   * Get token statistics
   */
  getStats(): TokenStats {
    return { ...this.stats };
  }

  /**
   * Get active tokens for a user
   */
  getUserTokens(userId: string): {
    accessTokens: AccessTokenPayload[];
    refreshTokens: RefreshTokenPayload[];
    idTokens: IdTokenPayload[];
  } {
    const accessTokens: AccessTokenPayload[] = [];
    const refreshTokens: RefreshTokenPayload[] = [];
    const idTokens: IdTokenPayload[] = [];

    for (const token of this.accessTokens.values()) {
      if (token.userId === userId) {
        accessTokens.push(token);
      }
    }

    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId) {
        refreshTokens.push(token);
      }
    }

    for (const token of this.idTokens.values()) {
      if (token.userId === userId) {
        idTokens.push(token);
      }
    }

    return { accessTokens, refreshTokens, idTokens };
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(jti: string): boolean {
    const blacklisted = this.blacklist.get(jti);
    if (!blacklisted) {
      return false;
    }

    // Check if blacklist entry has expired
    if (Date.now() > blacklisted.expiresAt) {
      this.blacklist.delete(jti);
      this.stats.blacklistedTokens--;
      return false;
    }

    return true;
  }

  /**
   * Clear expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    let cleanedCount = 0;

    // Clean up access tokens
    for (const [jti, token] of this.accessTokens.entries()) {
      if (token.exp && token.exp < now) {
        this.accessTokens.delete(jti);
        cleanedCount++;
      }
    }

    // Clean up refresh tokens
    for (const [jti, token] of this.refreshTokens.entries()) {
      if (token.exp && token.exp < now) {
        this.refreshTokens.delete(jti);
        cleanedCount++;
      }
    }

    // Clean up ID tokens
    for (const [jti, token] of this.idTokens.entries()) {
      if (token.exp && token.exp < now) {
        this.idTokens.delete(jti);
        cleanedCount++;
      }
    }

    // Clean up API tokens
    for (const [jti, token] of this.apiTokens.entries()) {
      if (token.exp && token.exp < now) {
        this.apiTokens.delete(jti);
        cleanedCount++;
      }
    }

    // Clean up blacklist
    for (const [jti, entry] of this.blacklist.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.blacklist.delete(jti);
        this.stats.blacklistedTokens--;
      }
    }

    this.updateStats();

    this.logJWTEvent('cleanup_completed', {
      cleanedCount,
      remainingAccessTokens: this.accessTokens.size,
      remainingRefreshTokens: this.refreshTokens.size,
      remainingIdTokens: this.idTokens.size,
      remainingApiTokens: this.apiTokens.size,
    });
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return new Date() > expiration;
  }

  /**
   * Sign token with JWT
   */
  private signToken(payload: JWTPayload): string {
    const signOptions: jwt.SignOptions = {
      algorithm: this.config.algorithm,
    };

    // Only set issuer in options if payload doesn't already have it
    // jsonwebtoken doesn't allow both payload.iss and options.issuer
    if (!payload.iss) {
      signOptions.issuer = this.config.issuer;
    }

    // Only set audience in options if payload doesn't already have it
    // jsonwebtoken doesn't allow both payload.aud and options.audience
    if (!payload.aud) {
      signOptions.audience = this.config.audience;
    }

    return jwt.sign(payload, this.config.secret, signOptions);
  }

  /**
   * Generate unique JWT ID
   */
  private generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate token family ID
   */
  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate secret key
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(key: string, limit: number): boolean {
    const now = Date.now();
    const entry = this.rateLimitEntries.get(key);

    if (!entry || now > entry.resetAt) {
      // Reset or create new entry
      this.rateLimitEntries.set(key, {
        count: 1,
        resetAt: now + 60000, // 1 minute
      });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.activeTokens =
      this.accessTokens.size +
      this.refreshTokens.size +
      this.idTokens.size +
      this.apiTokens.size;
  }

  /**
   * Log JWT event
   */
  private logJWTEvent(action: string, metadata: Record<string, unknown>): void {
    if (!this.config.enableLogging) {
      return;
    }

    const event: SecurityEventDetails = {
      action,
      resource: 'jwt',
      reason: `JWT event: ${action}`,
      metadata,
    };

    this.securityLogger.logSecurityEvent(event);
  }
}
