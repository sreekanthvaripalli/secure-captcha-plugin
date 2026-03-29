/**
 * OAuth 2.0 / OpenID Connect Service
 * Implements enterprise-grade OAuth 2.0 with PKCE, token refresh, and provider integration
 */

import * as crypto from 'crypto';
import { SecurityLogger } from './security-logger';
import { SecurityEventDetails } from '../types/security';

// OAuth 2.0 Types
export type OAuth2GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token' | 'implicit';
export type OAuth2ResponseType = 'code' | 'token' | 'id_token' | 'code token' | 'code id_token' | 'code token id_token';
export type OAuth2TokenType = 'Bearer' | 'MAC';
export type OAuth2CodeChallengeMethod = 'plain' | 'S256';

export interface OAuth2Client {
  id: string;
  secret: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: OAuth2GrantType[];
  responseTypes: OAuth2ResponseType[];
  tokenEndpointAuthMethod: 'client_secret_basic' | 'client_secret_post' | 'client_secret_jwt' | 'private_key_jwt' | 'none';
  accessTokenLifetime: number; // seconds
  refreshTokenLifetime: number; // seconds
  requirePkce: boolean;
  requireConsent: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface OAuth2AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: OAuth2CodeChallengeMethod;
  nonce?: string;
  state?: string;
  expiresAt: number;
  createdAt: number;
  used: boolean;
}

export interface OAuth2AccessToken {
  token: string;
  tokenType: OAuth2TokenType;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
  issuedAt: number;
  metadata: Record<string, unknown>;
}

export interface OAuth2RefreshToken {
  token: string;
  clientId: string;
  userId: string;
  scopes: string[];
  accessTokenId: string;
  expiresAt: number;
  issuedAt: number;
  revoked: boolean;
}

export interface OAuth2IdToken {
  token: string;
  iss: string; // Issuer
  sub: string; // Subject (user ID)
  aud: string; // Audience (client ID)
  exp: number; // Expiration time
  iat: number; // Issued at
  nonce?: string;
  authTime?: number;
  acr?: string; // Authentication Context Class Reference
  amr?: string[]; // Authentication Methods References
  azp?: string; // Authorized Party
  atHash?: string; // Access Token Hash
  cHash?: string; // Code Hash
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  locale?: string;
  updatedAt?: number;
  claims: Record<string, unknown>;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: OAuth2TokenType;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface OAuth2AuthorizationRequest {
  responseType: OAuth2ResponseType;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: OAuth2CodeChallengeMethod;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  maxAge?: number;
  loginHint?: string;
  idTokenHint?: string;
  acrValues?: string[];
}

export interface OAuth2TokenRequest {
  grantType: OAuth2GrantType;
  code?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
  codeVerifier?: string;
  scope?: string;
  username?: string;
  password?: string;
  assertion?: string;
}

export interface OAuth2IntrospectionResponse {
  active: boolean;
  scope?: string;
  clientId?: string;
  username?: string;
  tokenType?: OAuth2TokenType;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
}

export interface OAuth2Provider {
  id: string;
  name: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksUri?: string;
  revocationEndpoint?: string;
  introspectionEndpoint?: string;
  scopesSupported: string[];
  responseTypesSupported: OAuth2ResponseType[];
  grantTypesSupported: OAuth2GrantType[];
  tokenEndpointAuthMethodsSupported: string[];
  codeChallengeMethodsSupported: OAuth2CodeChallengeMethod[];
  metadata: Record<string, unknown>;
}

export interface OAuth2Config {
  // Server configuration
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri: string;
  revocationEndpoint: string;
  introspectionEndpoint: string;
  
  // Token lifetimes
  authorizationCodeLifetime: number; // seconds
  accessTokenLifetime: number; // seconds
  refreshTokenLifetime: number; // seconds
  idTokenLifetime: number; // seconds
  
  // Security settings
  requirePkce: boolean;
  requireState: boolean;
  requireNonce: boolean;
  allowRefreshTokenReuse: boolean;
  rotateRefreshTokens: boolean;
  
  // Supported features
  supportedScopes: string[];
  supportedGrantTypes: OAuth2GrantType[];
  supportedResponseTypes: OAuth2ResponseType[];
  supportedCodeChallengeMethods: OAuth2CodeChallengeMethod[];
  
  // Provider integration
  providers: OAuth2Provider[];
  
  // Logging
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface OAuth2Stats {
  totalClients: number;
  activeClients: number;
  totalAuthorizationCodes: number;
  totalAccessTokens: number;
  totalRefreshTokens: number;
  totalIdTokens: number;
  tokenRequests: number;
  tokenRefreshes: number;
  tokenRevocations: number;
  authorizationRequests: number;
  failedAuthorizations: number;
  failedTokenRequests: number;
  cacheHits: number;
  cacheMisses: number;
  lastActivity: number;
}

export class OAuth2Service {
  private readonly config: OAuth2Config;
  private readonly securityLogger: SecurityLogger;
  
  // Data stores
  private readonly clients: Map<string, OAuth2Client> = new Map();
  private readonly authorizationCodes: Map<string, OAuth2AuthorizationCode> = new Map();
  private readonly accessTokens: Map<string, OAuth2AccessToken> = new Map();
  private readonly refreshTokens: Map<string, OAuth2RefreshToken> = new Map();
  private readonly idTokens: Map<string, OAuth2IdToken> = new Map();
  private readonly providers: Map<string, OAuth2Provider> = new Map();
  
  // Caches
  private readonly tokenCache: Map<string, OAuth2AccessToken> = new Map();
  
  // Statistics
  private stats: OAuth2Stats = {
    totalClients: 0,
    activeClients: 0,
    totalAuthorizationCodes: 0,
    totalAccessTokens: 0,
    totalRefreshTokens: 0,
    totalIdTokens: 0,
    tokenRequests: 0,
    tokenRefreshes: 0,
    tokenRevocations: 0,
    authorizationRequests: 0,
    failedAuthorizations: 0,
    failedTokenRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastActivity: Date.now()
  };

  constructor(
    config: Partial<OAuth2Config>,
    securityLogger: SecurityLogger
  ) {
    this.config = {
      issuer: 'https://secure-captcha.example.com',
      authorizationEndpoint: '/oauth2/authorize',
      tokenEndpoint: '/oauth2/token',
      userInfoEndpoint: '/oauth2/userinfo',
      jwksUri: '/oauth2/jwks',
      revocationEndpoint: '/oauth2/revoke',
      introspectionEndpoint: '/oauth2/introspect',
      authorizationCodeLifetime: 600, // 10 minutes
      accessTokenLifetime: 3600, // 1 hour
      refreshTokenLifetime: 86400 * 30, // 30 days
      idTokenLifetime: 3600, // 1 hour
      requirePkce: true,
      requireState: true,
      requireNonce: false,
      allowRefreshTokenReuse: false,
      rotateRefreshTokens: true,
      supportedScopes: ['openid', 'profile', 'email', 'address', 'phone', 'offline_access'],
      supportedGrantTypes: ['authorization_code', 'client_credentials', 'refresh_token'],
      supportedResponseTypes: ['code', 'id_token', 'code id_token'],
      supportedCodeChallengeMethods: ['plain', 'S256'],
      providers: [],
      enableLogging: true,
      logLevel: 'info',
      ...config
    };

    this.securityLogger = securityLogger;
    this.initializeDefaultClients();
    this.initializeProviders();
  }

  /**
   * Initialize default OAuth 2.0 clients
   */
  private initializeDefaultClients(): void {
    const defaultClients: Omit<OAuth2Client, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        secret: this.generateClientSecret(),
        name: 'Secure CAPTCHA Web App',
        redirectUris: ['https://secure-captcha.example.com/callback', 'http://localhost:3000/callback'],
        allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code', 'id_token', 'code id_token'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400 * 30,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: { type: 'web' }
      },
      {
        secret: this.generateClientSecret(),
        name: 'Secure CAPTCHA Mobile App',
        redirectUris: ['com.securecaptcha.mobile://callback'],
        allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code', 'id_token', 'code id_token'],
        tokenEndpointAuthMethod: 'none', // Public client
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400 * 30,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: { type: 'native' }
      },
      {
        secret: this.generateClientSecret(),
        name: 'Secure CAPTCHA API Client',
        redirectUris: [],
        allowedScopes: ['openid'],
        grantTypes: ['client_credentials'],
        responseTypes: [],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 0,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: { type: 'service' }
      }
    ];

    defaultClients.forEach(client => {
      const id = this.generateId('client');
      const now = Date.now();
      
      this.clients.set(id, {
        ...client,
        id,
        createdAt: now,
        updatedAt: now
      });
    });

    this.updateStats();
  }

  /**
   * Initialize OAuth 2.0 providers
   */
  private initializeProviders(): void {
    const defaultProviders: OAuth2Provider[] = [
      {
        id: 'google',
        name: 'Google',
        issuer: 'https://accounts.google.com',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
        scopesSupported: ['openid', 'email', 'profile'],
        responseTypesSupported: ['code', 'token', 'id_token', 'code id_token'],
        grantTypesSupported: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethodsSupported: ['client_secret_basic', 'client_secret_post'],
        codeChallengeMethodsSupported: ['plain', 'S256'],
        metadata: {}
      },
      {
        id: 'github',
        name: 'GitHub',
        issuer: 'https://github.com',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        userInfoEndpoint: 'https://api.github.com/user',
        scopesSupported: ['user', 'user:email', 'read:user'],
        responseTypesSupported: ['code'],
        grantTypesSupported: ['authorization_code'],
        tokenEndpointAuthMethodsSupported: ['client_secret_basic', 'client_secret_post'],
        codeChallengeMethodsSupported: ['S256'],
        metadata: {}
      },
      {
        id: 'microsoft',
        name: 'Microsoft',
        issuer: 'https://login.microsoftonline.com/common/v2.0',
        authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
        jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
        scopesSupported: ['openid', 'profile', 'email', 'offline_access'],
        responseTypesSupported: ['code', 'id_token', 'code id_token'],
        grantTypesSupported: ['authorization_code', 'refresh_token'],
        tokenEndpointAuthMethodsSupported: ['client_secret_basic', 'client_secret_post', 'private_key_jwt'],
        codeChallengeMethodsSupported: ['plain', 'S256'],
        metadata: {}
      }
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  /**
   * Register a new OAuth 2.0 client
   */
  registerClient(client: Omit<OAuth2Client, 'id' | 'secret' | 'createdAt' | 'updatedAt'>): OAuth2Client {
    const id = this.generateId('client');
    const secret = this.generateClientSecret();
    const now = Date.now();

    const newClient: OAuth2Client = {
      ...client,
      id,
      secret,
      createdAt: now,
      updatedAt: now
    };

    this.clients.set(id, newClient);
    this.updateStats();

    this.logOAuth2Event('client_registered', {
      clientId: id,
      clientName: client.name,
      grantTypes: client.grantTypes
    });

    return newClient;
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): OAuth2Client | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Validate client credentials
   */
  validateClientCredentials(clientId: string, clientSecret?: string): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      return false;
    }

    // Public clients don't require secret
    if (client.tokenEndpointAuthMethod === 'none') {
      return true;
    }

    return client.secret === clientSecret;
  }

  /**
   * Generate authorization URL
   */
  generateAuthorizationUrl(request: OAuth2AuthorizationRequest): string {
    const client = this.clients.get(request.clientId);
    if (!client || !client.isActive) {
      throw new Error('Invalid or inactive client');
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(request.redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    // Validate response type
    if (!client.responseTypes.includes(request.responseType)) {
      throw new Error('Unsupported response type');
    }

    // Validate scopes
    const invalidScopes = request.scopes.filter(scope => !client.allowedScopes.includes(scope));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Generate state if required
    const state = request.state || (this.config.requireState ? this.generateState() : undefined);

    // Generate nonce if required
    const nonce = request.nonce || (this.config.requireNonce ? this.generateNonce() : undefined);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: request.responseType,
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      scope: request.scopes.join(' ')
    });

    if (state) params.append('state', state);
    if (nonce) params.append('nonce', nonce);
    if (request.codeChallenge) {
      params.append('code_challenge', request.codeChallenge);
      params.append('code_challenge_method', request.codeChallengeMethod || 'plain');
    }
    if (request.prompt) params.append('prompt', request.prompt);
    if (request.maxAge) params.append('max_age', request.maxAge.toString());
    if (request.loginHint) params.append('login_hint', request.loginHint);
    if (request.idTokenHint) params.append('id_token_hint', request.idTokenHint);
    if (request.acrValues) params.append('acr_values', request.acrValues.join(' '));

    this.stats.authorizationRequests++;
    this.updateStats();

    this.logOAuth2Event('authorization_url_generated', {
      clientId: request.clientId,
      responseType: request.responseType,
      scopes: request.scopes,
      hasPkce: !!request.codeChallenge
    });

    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Create authorization code
   */
  createAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scopes: string[],
    codeChallenge?: string,
    codeChallengeMethod?: OAuth2CodeChallengeMethod,
    nonce?: string,
    state?: string
  ): OAuth2AuthorizationCode {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      throw new Error('Invalid or inactive client');
    }

    // Validate PKCE if required
    if (client.requirePkce && !codeChallenge) {
      throw new Error('PKCE is required for this client');
    }

    const code = this.generateAuthorizationCode();
    const now = Date.now();

    const authCode: OAuth2AuthorizationCode = {
      code,
      clientId,
      userId,
      redirectUri,
      scopes,
      codeChallenge,
      codeChallengeMethod,
      nonce,
      state,
      expiresAt: now + (this.config.authorizationCodeLifetime * 1000),
      createdAt: now,
      used: false
    };

    this.authorizationCodes.set(code, authCode);
    this.stats.totalAuthorizationCodes++;
    this.updateStats();

    this.logOAuth2Event('authorization_code_created', {
      code: code.substring(0, 8) + '...',
      clientId,
      userId,
      scopes,
      expiresAt: authCode.expiresAt
    });

    return authCode;
  }

  /**
   * Validate PKCE code verifier
   */
  private validatePkce(codeVerifier: string, codeChallenge: string, method: OAuth2CodeChallengeMethod): boolean {
    if (method === 'plain') {
      return codeVerifier === codeChallenge;
    }

    if (method === 'S256') {
      const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      return hash === codeChallenge;
    }

    return false;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse> {
    this.stats.tokenRequests++;
    this.stats.lastActivity = Date.now();

    try {
      if (request.grantType !== 'authorization_code') {
        throw new Error('Invalid grant type for code exchange');
      }

      if (!request.code) {
        throw new Error('Authorization code is required');
      }

      // Get and validate authorization code
      const authCode = this.authorizationCodes.get(request.code);
      if (!authCode) {
        throw new Error('Invalid authorization code');
      }

      if (authCode.used) {
        throw new Error('Authorization code has already been used');
      }

      if (Date.now() > authCode.expiresAt) {
        throw new Error('Authorization code has expired');
      }

      if (authCode.clientId !== request.clientId) {
        throw new Error('Client ID mismatch');
      }

      if (authCode.redirectUri !== request.redirectUri) {
        throw new Error('Redirect URI mismatch');
      }

      // Validate PKCE if present
      if (authCode.codeChallenge && request.codeVerifier) {
        const isValid = this.validatePkce(
          request.codeVerifier,
          authCode.codeChallenge,
          authCode.codeChallengeMethod || 'plain'
        );
        if (!isValid) {
          throw new Error('PKCE validation failed');
        }
      }

      // Mark code as used
      authCode.used = true;

      // Generate tokens
      const accessToken = this.generateAccessToken(
        request.clientId,
        authCode.userId,
        authCode.scopes
      );

      const refreshToken = this.generateRefreshToken(
        request.clientId,
        authCode.userId,
        authCode.scopes,
        accessToken.token
      );

      let idToken: string | undefined;
      if (authCode.scopes.includes('openid')) {
        const idTokenObj = this.generateIdToken(
          request.clientId,
          authCode.userId,
          authCode.scopes,
          authCode.nonce
        );
        idToken = idTokenObj.token;
      }

      const response: OAuth2TokenResponse = {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: this.config.accessTokenLifetime,
        refresh_token: refreshToken.token,
        id_token: idToken,
        scope: authCode.scopes.join(' ')
      };

      this.logOAuth2Event('code_exchanged', {
        clientId: request.clientId,
        userId: authCode.userId,
        scopes: authCode.scopes,
        hasRefreshToken: !!refreshToken.token,
        hasIdToken: !!idToken
      });

      return response;

    } catch (error) {
      this.stats.failedTokenRequests++;
      this.logOAuth2Event('code_exchange_failed', {
        clientId: request.clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse> {
    this.stats.tokenRefreshes++;
    this.stats.lastActivity = Date.now();

    try {
      if (request.grantType !== 'refresh_token') {
        throw new Error('Invalid grant type for token refresh');
      }

      if (!request.refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Get and validate refresh token
      const refreshToken = this.refreshTokens.get(request.refreshToken);
      if (!refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (refreshToken.revoked) {
        throw new Error('Refresh token has been revoked');
      }

      if (Date.now() > refreshToken.expiresAt) {
        throw new Error('Refresh token has expired');
      }

      if (refreshToken.clientId !== request.clientId) {
        throw new Error('Client ID mismatch');
      }

      // Get client
      const client = this.clients.get(request.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Determine scopes for new token
      let scopes = refreshToken.scopes;
      if (request.scope) {
        const requestedScopes = request.scope.split(' ');
        const invalidScopes = requestedScopes.filter(s => !refreshToken.scopes.includes(s));
        if (invalidScopes.length > 0) {
          throw new Error(`Cannot grant scopes not in original token: ${invalidScopes.join(', ')}`);
        }
        scopes = requestedScopes;
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(
        request.clientId,
        refreshToken.userId,
        scopes
      );

      // Rotate refresh token if configured
      let newRefreshToken: OAuth2RefreshToken | undefined;
      if (this.config.rotateRefreshTokens) {
        // Revoke old refresh token
        refreshToken.revoked = true;

        // Generate new refresh token
        newRefreshToken = this.generateRefreshToken(
          request.clientId,
          refreshToken.userId,
          scopes,
          newAccessToken.token
        );
      }

      const response: OAuth2TokenResponse = {
        access_token: newAccessToken.token,
        token_type: 'Bearer',
        expires_in: this.config.accessTokenLifetime,
        refresh_token: newRefreshToken?.token,
        scope: scopes.join(' ')
      };

      this.logOAuth2Event('token_refreshed', {
        clientId: request.clientId,
        userId: refreshToken.userId,
        scopes,
        rotatedRefreshToken: !!newRefreshToken
      });

      return response;

    } catch (error) {
      this.stats.failedTokenRequests++;
      this.logOAuth2Event('token_refresh_failed', {
        clientId: request.clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate client credentials token
   */
  async generateClientCredentialsToken(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse> {
    this.stats.tokenRequests++;
    this.stats.lastActivity = Date.now();

    try {
      if (request.grantType !== 'client_credentials') {
        throw new Error('Invalid grant type for client credentials');
      }

      // Validate client credentials
      if (!this.validateClientCredentials(request.clientId, request.clientSecret)) {
        throw new Error('Invalid client credentials');
      }

      const client = this.clients.get(request.clientId)!;

      // Determine scopes
      let scopes = client.allowedScopes;
      if (request.scope) {
        const requestedScopes = request.scope.split(' ');
        const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s));
        if (invalidScopes.length > 0) {
          throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
        }
        scopes = requestedScopes;
      }

      // Generate access token
      const accessToken = this.generateAccessToken(
        request.clientId,
        request.clientId, // For client credentials, subject is client ID
        scopes
      );

      const response: OAuth2TokenResponse = {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: client.accessTokenLifetime,
        scope: scopes.join(' ')
      };

      this.logOAuth2Event('client_credentials_token_issued', {
        clientId: request.clientId,
        scopes
      });

      return response;

    } catch (error) {
      this.stats.failedTokenRequests++;
      this.logOAuth2Event('client_credentials_failed', {
        clientId: request.clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate access token
   */
  validateAccessToken(token: string): OAuth2AccessToken | null {
    // Check cache first
    const cached = this.tokenCache.get(token);
    if (cached) {
      this.stats.cacheHits++;
      if (Date.now() < cached.expiresAt) {
        return cached;
      }
      this.tokenCache.delete(token);
    }

    this.stats.cacheMisses++;

    // Check token store
    const accessToken = this.accessTokens.get(token);
    if (!accessToken) {
      return null;
    }

    if (Date.now() > accessToken.expiresAt) {
      return null;
    }

    // Cache the token
    this.tokenCache.set(token, accessToken);

    return accessToken;
  }

  /**
   * Introspect token
   */
  introspectToken(token: string): OAuth2IntrospectionResponse {
    const accessToken = this.validateAccessToken(token);

    if (!accessToken) {
      return { active: false };
    }

    return {
      active: true,
      scope: accessToken.scopes.join(' '),
      clientId: accessToken.clientId,
      tokenType: accessToken.tokenType,
      exp: Math.floor(accessToken.expiresAt / 1000),
      iat: Math.floor(accessToken.issuedAt / 1000),
      sub: accessToken.userId,
      iss: this.config.issuer,
      jti: accessToken.token
    };
  }

  /**
   * Revoke token
   */
  revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): boolean {
    this.stats.tokenRevocations++;
    this.stats.lastActivity = Date.now();

    // Try to revoke as access token
    if (!tokenTypeHint || tokenTypeHint === 'access_token') {
      const accessToken = this.accessTokens.get(token);
      if (accessToken) {
        this.accessTokens.delete(token);
        this.tokenCache.delete(token);
        this.logOAuth2Event('access_token_revoked', {
          token: token.substring(0, 8) + '...',
          clientId: accessToken.clientId,
          userId: accessToken.userId
        });
        return true;
      }
    }

    // Try to revoke as refresh token
    if (!tokenTypeHint || tokenTypeHint === 'refresh_token') {
      const refreshToken = this.refreshTokens.get(token);
      if (refreshToken) {
        refreshToken.revoked = true;
        this.logOAuth2Event('refresh_token_revoked', {
          token: token.substring(0, 8) + '...',
          clientId: refreshToken.clientId,
          userId: refreshToken.userId
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get user info from access token
   */
  getUserInfo(accessToken: string): Record<string, unknown> | null {
    const token = this.validateAccessToken(accessToken);
    if (!token) {
      return null;
    }

    // In a real implementation, this would fetch user data from a database
    // For now, return mock user info
    return {
      sub: token.userId,
      name: 'Test User',
      email: 'user@example.com',
      email_verified: true,
      picture: 'https://example.com/avatar.jpg',
      locale: 'en-US',
      updated_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Get OpenID Connect discovery document
   */
  getDiscoveryDocument(): Record<string, unknown> {
    return {
      issuer: this.config.issuer,
      authorization_endpoint: `${this.config.issuer}${this.config.authorizationEndpoint}`,
      token_endpoint: `${this.config.issuer}${this.config.tokenEndpoint}`,
      userinfo_endpoint: `${this.config.issuer}${this.config.userInfoEndpoint}`,
      jwks_uri: `${this.config.issuer}${this.config.jwksUri}`,
      revocation_endpoint: `${this.config.issuer}${this.config.revocationEndpoint}`,
      introspection_endpoint: `${this.config.issuer}${this.config.introspectionEndpoint}`,
      scopes_supported: this.config.supportedScopes,
      response_types_supported: this.config.supportedResponseTypes,
      grant_types_supported: this.config.supportedGrantTypes,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: this.config.supportedCodeChallengeMethods,
      claims_supported: ['sub', 'name', 'email', 'email_verified', 'picture', 'locale', 'updated_at']
    };
  }

  /**
   * Get available providers
   */
  getProviders(): OAuth2Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): OAuth2Provider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Generate access token
   */
  private generateAccessToken(clientId: string, userId: string, scopes: string[]): OAuth2AccessToken {
    const token = this.generateToken();
    const now = Date.now();
    const client = this.clients.get(clientId);

    const accessToken: OAuth2AccessToken = {
      token,
      tokenType: 'Bearer',
      clientId,
      userId,
      scopes,
      expiresAt: now + ((client?.accessTokenLifetime || this.config.accessTokenLifetime) * 1000),
      issuedAt: now,
      metadata: {}
    };

    this.accessTokens.set(token, accessToken);
    this.stats.totalAccessTokens++;
    this.updateStats();

    return accessToken;
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(
    clientId: string,
    userId: string,
    scopes: string[],
    accessTokenId: string
  ): OAuth2RefreshToken {
    const token = this.generateToken();
    const now = Date.now();
    const client = this.clients.get(clientId);

    const refreshToken: OAuth2RefreshToken = {
      token,
      clientId,
      userId,
      scopes,
      accessTokenId,
      expiresAt: now + ((client?.refreshTokenLifetime || this.config.refreshTokenLifetime) * 1000),
      issuedAt: now,
      revoked: false
    };

    this.refreshTokens.set(token, refreshToken);
    this.stats.totalRefreshTokens++;
    this.updateStats();

    return refreshToken;
  }

  /**
   * Generate ID token
   */
  private generateIdToken(
    clientId: string,
    userId: string,
    scopes: string[],
    nonce?: string
  ): OAuth2IdToken {
    const token = this.generateToken();
    const now = Math.floor(Date.now() / 1000);

    const idToken: OAuth2IdToken = {
      token,
      iss: this.config.issuer,
      sub: userId,
      aud: clientId,
      exp: now + this.config.idTokenLifetime,
      iat: now,
      nonce,
      claims: {}
    };

    // Add claims based on scopes
    if (scopes.includes('email')) {
      idToken.email = 'user@example.com';
      idToken.emailVerified = true;
    }

    if (scopes.includes('profile')) {
      idToken.name = 'Test User';
      idToken.picture = 'https://example.com/avatar.jpg';
      idToken.locale = 'en-US';
      idToken.updatedAt = now;
    }

    this.idTokens.set(token, idToken);
    this.stats.totalIdTokens++;
    this.updateStats();

    return idToken;
  }

  /**
   * Generate unique token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate authorization code
   */
  private generateAuthorizationCode(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate client secret
   */
  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Generate nonce parameter
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.totalClients = this.clients.size;
    this.stats.activeClients = Array.from(this.clients.values()).filter(c => c.isActive).length;
  }

  /**
   * Get OAuth 2.0 statistics
   */
  getStats(): OAuth2Stats {
    return { ...this.stats };
  }

  /**
   * Clear expired tokens and codes
   */
  cleanupExpired(): void {
    const now = Date.now();

    // Clean up authorization codes
    for (const [code, authCode] of this.authorizationCodes.entries()) {
      if (now > authCode.expiresAt || authCode.used) {
        this.authorizationCodes.delete(code);
      }
    }

    // Clean up access tokens
    for (const [token, accessToken] of this.accessTokens.entries()) {
      if (now > accessToken.expiresAt) {
        this.accessTokens.delete(token);
        this.tokenCache.delete(token);
      }
    }

    // Clean up refresh tokens
    for (const [token, refreshToken] of this.refreshTokens.entries()) {
      if (now > refreshToken.expiresAt || refreshToken.revoked) {
        this.refreshTokens.delete(token);
      }
    }

    this.logOAuth2Event('cleanup_completed', {
      authorizationCodes: this.authorizationCodes.size,
      accessTokens: this.accessTokens.size,
      refreshTokens: this.refreshTokens.size
    });
  }

  /**
   * Log OAuth 2.0 event
   */
  private logOAuth2Event(action: string, metadata: Record<string, unknown>): void {
    if (!this.config.enableLogging) return;

    const event: SecurityEventDetails = {
      action,
      resource: 'oauth2',
      reason: `OAuth 2.0 event: ${action}`,
      metadata
    };

    this.securityLogger.logSecurityEvent(event);
  }
}