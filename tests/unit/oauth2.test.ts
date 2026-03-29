/**
 * OAuth 2.0 / OpenID Connect Tests
 * Tests for authorization code flow, PKCE, token refresh, and provider integration
 */

import { OAuth2Service, OAuth2Config } from '../../src/security/oauth2';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock dependencies
jest.mock('../../src/security/security-logger');

describe('OAuth2Service', () => {
  let oauth2Service: OAuth2Service;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  const defaultConfig: Partial<OAuth2Config> = {
    issuer: 'https://secure-captcha.example.com',
    authorizationEndpoint: '/oauth2/authorize',
    tokenEndpoint: '/oauth2/token',
    userInfoEndpoint: '/oauth2/userinfo',
    jwksUri: '/oauth2/jwks',
    revocationEndpoint: '/oauth2/revoke',
    introspectionEndpoint: '/oauth2/introspect',
    authorizationCodeLifetime: 600,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 86400 * 30,
    idTokenLifetime: 3600,
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
    logLevel: 'info'
  };

  beforeEach(() => {
    mockSecurityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: '/tmp/test.log',
      maxLogFileSize: 1024,
      maxLogFiles: 5
    }) as jest.Mocked<SecurityLogger>;

    oauth2Service = new OAuth2Service(defaultConfig, mockSecurityLogger);
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(oauth2Service).toBeDefined();
      const stats = oauth2Service.getStats();
      expect(stats.totalClients).toBeGreaterThan(0);
      expect(stats.activeClients).toBeGreaterThan(0);
    });

    it('should initialize default clients', () => {
      const stats = oauth2Service.getStats();
      expect(stats.totalClients).toBe(3);
      expect(stats.activeClients).toBe(3);
    });

    it('should initialize default providers', () => {
      const providers = oauth2Service.getProviders();
      expect(providers.length).toBe(3);
      
      const google = providers.find(p => p.id === 'google');
      expect(google).toBeDefined();
      expect(google?.name).toBe('Google');
      
      const github = providers.find(p => p.id === 'github');
      expect(github).toBeDefined();
      expect(github?.name).toBe('GitHub');
      
      const microsoft = providers.find(p => p.id === 'microsoft');
      expect(microsoft).toBeDefined();
      expect(microsoft?.name).toBe('Microsoft');
    });

    it('should get discovery document', () => {
      const doc = oauth2Service.getDiscoveryDocument();
      
      expect(doc).toHaveProperty('issuer');
      expect(doc).toHaveProperty('authorization_endpoint');
      expect(doc).toHaveProperty('token_endpoint');
      expect(doc).toHaveProperty('userinfo_endpoint');
      expect(doc).toHaveProperty('jwks_uri');
      expect(doc).toHaveProperty('revocation_endpoint');
      expect(doc).toHaveProperty('introspection_endpoint');
      expect(doc).toHaveProperty('scopes_supported');
      expect(doc).toHaveProperty('response_types_supported');
      expect(doc).toHaveProperty('grant_types_supported');
      expect(doc).toHaveProperty('code_challenge_methods_supported');
      expect(doc).toHaveProperty('claims_supported');
    });
  });

  describe('client management', () => {
    it('should register new client', () => {
      const client = oauth2Service.registerClient({
        name: 'Test Client',
        redirectUris: ['https://test.example.com/callback'],
        allowedScopes: ['openid', 'profile'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: {}
      });
      
      expect(client).toHaveProperty('id');
      expect(client).toHaveProperty('secret');
      expect(client.name).toBe('Test Client');
      expect(client.redirectUris).toContain('https://test.example.com/callback');
      expect(client.isActive).toBe(true);
      
      const stats = oauth2Service.getStats();
      expect(stats.totalClients).toBe(4);
    });

    it('should get client by ID', () => {
      const client = oauth2Service.registerClient({
        name: 'Get Test Client',
        redirectUris: ['https://get.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const retrievedClient = oauth2Service.getClient(client.id);
      expect(retrievedClient).toBeDefined();
      expect(retrievedClient?.id).toBe(client.id);
      expect(retrievedClient?.name).toBe('Get Test Client');
    });

    it('should validate client credentials', () => {
      const client = oauth2Service.registerClient({
        name: 'Validation Test Client',
        redirectUris: ['https://validation.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['client_credentials'],
        responseTypes: [],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 0,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const isValid = oauth2Service.validateClientCredentials(client.id, client.secret);
      expect(isValid).toBe(true);
      
      const isInvalid = oauth2Service.validateClientCredentials(client.id, 'wrong-secret');
      expect(isInvalid).toBe(false);
    });

    it('should validate public client without secret', () => {
      const client = oauth2Service.registerClient({
        name: 'Public Client',
        redirectUris: ['com.example.app://callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: {}
      });
      
      const isValid = oauth2Service.validateClientCredentials(client.id);
      expect(isValid).toBe(true);
    });

    it('should reject inactive client', () => {
      const client = oauth2Service.registerClient({
        name: 'Inactive Client',
        redirectUris: ['https://inactive.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: false,
        metadata: {}
      });
      
      const isValid = oauth2Service.validateClientCredentials(client.id, client.secret);
      expect(isValid).toBe(false);
    });
  });

  describe('authorization code flow', () => {
    let testClient: any;

    beforeEach(() => {
      testClient = oauth2Service.registerClient({
        name: 'Auth Code Test Client',
        redirectUris: ['https://auth.example.com/callback'],
        allowedScopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code', 'id_token', 'code id_token'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: {}
      });
    });

    it('should generate authorization URL', () => {
      const authUrl = oauth2Service.generateAuthorizationUrl({
        responseType: 'code',
        clientId: testClient.id,
        redirectUri: 'https://auth.example.com/callback',
        scopes: ['openid', 'profile'],
        state: 'test-state',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256'
      });
      
      expect(authUrl).toContain('/oauth2/authorize');
      expect(authUrl).toContain(`client_id=${testClient.id}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=openid');
      expect(authUrl).toContain('profile');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('code_challenge=test-challenge');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should reject invalid client for authorization', () => {
      expect(() => {
        oauth2Service.generateAuthorizationUrl({
          responseType: 'code',
          clientId: 'invalid-client',
          redirectUri: 'https://auth.example.com/callback',
          scopes: ['openid']
        });
      }).toThrow('Invalid or inactive client');
    });

    it('should reject invalid redirect URI', () => {
      expect(() => {
        oauth2Service.generateAuthorizationUrl({
          responseType: 'code',
          clientId: testClient.id,
          redirectUri: 'https://invalid.example.com/callback',
          scopes: ['openid']
        });
      }).toThrow('Invalid redirect URI');
    });

    it('should reject invalid response type', () => {
      expect(() => {
        oauth2Service.generateAuthorizationUrl({
          responseType: 'token' as any,
          clientId: testClient.id,
          redirectUri: 'https://auth.example.com/callback',
          scopes: ['openid']
        });
      }).toThrow('Unsupported response type');
    });

    it('should reject invalid scopes', () => {
      expect(() => {
        oauth2Service.generateAuthorizationUrl({
          responseType: 'code',
          clientId: testClient.id,
          redirectUri: 'https://auth.example.com/callback',
          scopes: ['invalid-scope']
        });
      }).toThrow('Invalid scopes: invalid-scope');
    });

    it('should create authorization code', () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid', 'profile'],
        'test-challenge',
        'S256',
        'test-nonce',
        'test-state'
      );
      
      expect(authCode).toHaveProperty('code');
      expect(authCode.clientId).toBe(testClient.id);
      expect(authCode.userId).toBe('user-123');
      expect(authCode.scopes).toEqual(['openid', 'profile']);
      expect(authCode.codeChallenge).toBe('test-challenge');
      expect(authCode.codeChallengeMethod).toBe('S256');
      expect(authCode.used).toBe(false);
    });

    it('should reject PKCE when required but not provided', () => {
      const pkceClient = oauth2Service.registerClient({
        name: 'PKCE Required Client',
        redirectUris: ['https://pkce.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: true,
        requireConsent: true,
        isActive: true,
        metadata: {}
      });
      
      expect(() => {
        oauth2Service.createAuthorizationCode(
          pkceClient.id,
          'user-123',
          'https://pkce.example.com/callback',
          ['openid']
        );
      }).toThrow('PKCE is required for this client');
    });

    it('should exchange authorization code for tokens', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid', 'profile'],
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        'S256'
      );
      
      const tokenResponse = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://auth.example.com/callback',
        clientId: testClient.id,
        codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      });
      
      expect(tokenResponse).toHaveProperty('access_token');
      expect(tokenResponse).toHaveProperty('token_type');
      expect(tokenResponse.token_type).toBe('Bearer');
      expect(tokenResponse).toHaveProperty('expires_in');
      expect(tokenResponse).toHaveProperty('refresh_token');
      expect(tokenResponse).toHaveProperty('id_token');
      expect(tokenResponse).toHaveProperty('scope');
      expect(tokenResponse.scope).toBe('openid profile');
    });

    it('should reject invalid authorization code', async () => {
      await expect(
        oauth2Service.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: 'invalid-code',
          redirectUri: 'https://auth.example.com/callback',
          clientId: testClient.id
        })
      ).rejects.toThrow('Invalid authorization code');
    });

    it('should reject used authorization code', async () => {
      // Use a client without PKCE requirement for this test
      const noPkceClient = oauth2Service.registerClient({
        name: 'No PKCE Client',
        redirectUris: ['https://auth.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = oauth2Service.createAuthorizationCode(
        noPkceClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid']
      );
      
      // Use the code once
      await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://auth.example.com/callback',
        clientId: noPkceClient.id
      });
      
      // Try to use it again
      await expect(
        oauth2Service.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: authCode.code,
          redirectUri: 'https://auth.example.com/callback',
          clientId: noPkceClient.id
        })
      ).rejects.toThrow('Authorization code has already been used');
    });

    it('should reject expired authorization code', async () => {
      const shortLivedConfig: Partial<OAuth2Config> = {
        ...defaultConfig,
        authorizationCodeLifetime: 0 // Immediate expiration
      };
      
      const shortLivedService = new OAuth2Service(shortLivedConfig, mockSecurityLogger);
      
      const client = shortLivedService.registerClient({
        name: 'Short Lived Client',
        redirectUris: ['https://short.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = shortLivedService.createAuthorizationCode(
        client.id,
        'user-123',
        'https://short.example.com/callback',
        ['openid']
      );
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(
        shortLivedService.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: authCode.code,
          redirectUri: 'https://short.example.com/callback',
          clientId: client.id
        })
      ).rejects.toThrow('Authorization code has expired');
    });

    it('should reject client ID mismatch', async () => {
      // Use a client without PKCE requirement for this test
      const noPkceClient = oauth2Service.registerClient({
        name: 'No PKCE Client',
        redirectUris: ['https://auth.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const otherClient = oauth2Service.registerClient({
        name: 'Other Client',
        redirectUris: ['https://other.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = oauth2Service.createAuthorizationCode(
        noPkceClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid']
      );
      
      await expect(
        oauth2Service.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: authCode.code,
          redirectUri: 'https://auth.example.com/callback',
          clientId: otherClient.id
        })
      ).rejects.toThrow('Client ID mismatch');
    });

    it('should reject redirect URI mismatch', async () => {
      // Use a client without PKCE requirement for this test
      const noPkceClient = oauth2Service.registerClient({
        name: 'No PKCE Client',
        redirectUris: ['https://auth.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = oauth2Service.createAuthorizationCode(
        noPkceClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid']
      );
      
      await expect(
        oauth2Service.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: authCode.code,
          redirectUri: 'https://different.example.com/callback',
          clientId: noPkceClient.id
        })
      ).rejects.toThrow('Redirect URI mismatch');
    });

    it('should validate PKCE S256', async () => {
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid'],
        codeChallenge,
        'S256'
      );
      
      const tokenResponse = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://auth.example.com/callback',
        clientId: testClient.id,
        codeVerifier
      });
      
      expect(tokenResponse).toHaveProperty('access_token');
    });

    it('should reject invalid PKCE verifier', async () => {
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://auth.example.com/callback',
        ['openid'],
        codeChallenge,
        'S256'
      );
      
      await expect(
        oauth2Service.exchangeCodeForTokens({
          grantType: 'authorization_code',
          code: authCode.code,
          redirectUri: 'https://auth.example.com/callback',
          clientId: testClient.id,
          codeVerifier: 'invalid-verifier'
        })
      ).rejects.toThrow('PKCE validation failed');
    });
  });

  describe('token refresh', () => {
    let testClient: any;

    beforeEach(async () => {
      testClient = oauth2Service.registerClient({
        name: 'Refresh Test Client',
        redirectUris: ['https://refresh.example.com/callback'],
        allowedScopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
    });

    it('should refresh access token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://refresh.example.com/callback',
        ['openid', 'profile']
      );
      
      const initialTokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://refresh.example.com/callback',
        clientId: testClient.id
      });
      
      const refreshedTokens = await oauth2Service.refreshAccessToken({
        grantType: 'refresh_token',
        refreshToken: initialTokens.refresh_token,
        clientId: testClient.id
      });
      
      expect(refreshedTokens).toHaveProperty('access_token');
      expect(refreshedTokens.access_token).not.toBe(initialTokens.access_token);
      expect(refreshedTokens).toHaveProperty('refresh_token');
      expect(refreshedTokens.refresh_token).not.toBe(initialTokens.refresh_token);
    });

    it('should refresh with reduced scopes', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://refresh.example.com/callback',
        ['openid', 'profile', 'email']
      );
      
      const initialTokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://refresh.example.com/callback',
        clientId: testClient.id
      });
      
      const refreshedTokens = await oauth2Service.refreshAccessToken({
        grantType: 'refresh_token',
        refreshToken: initialTokens.refresh_token,
        clientId: testClient.id,
        scope: 'openid profile'
      });
      
      expect(refreshedTokens.scope).toBe('openid profile');
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        oauth2Service.refreshAccessToken({
          grantType: 'refresh_token',
          refreshToken: 'invalid-refresh-token',
          clientId: testClient.id
        })
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      const shortLivedConfig: Partial<OAuth2Config> = {
        ...defaultConfig,
        refreshTokenLifetime: 0
      };
      
      const shortLivedService = new OAuth2Service(shortLivedConfig, mockSecurityLogger);
      
      const client = shortLivedService.registerClient({
        name: 'Short Refresh Client',
        redirectUris: ['https://shortrefresh.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 0,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = shortLivedService.createAuthorizationCode(
        client.id,
        'user-123',
        'https://shortrefresh.example.com/callback',
        ['openid']
      );
      
      const tokens = await shortLivedService.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://shortrefresh.example.com/callback',
        clientId: client.id
      });
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(
        shortLivedService.refreshAccessToken({
          grantType: 'refresh_token',
          refreshToken: tokens.refresh_token,
          clientId: client.id
        })
      ).rejects.toThrow('Refresh token has expired');
    });

    it('should reject client ID mismatch for refresh', async () => {
      const otherClient = oauth2Service.registerClient({
        name: 'Other Refresh Client',
        redirectUris: ['https://otherrefresh.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://refresh.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://refresh.example.com/callback',
        clientId: testClient.id
      });
      
      await expect(
        oauth2Service.refreshAccessToken({
          grantType: 'refresh_token',
          refreshToken: tokens.refresh_token,
          clientId: otherClient.id
        })
      ).rejects.toThrow('Client ID mismatch');
    });

    it('should reject expanded scopes during refresh', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://refresh.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://refresh.example.com/callback',
        clientId: testClient.id
      });
      
      await expect(
        oauth2Service.refreshAccessToken({
          grantType: 'refresh_token',
          refreshToken: tokens.refresh_token,
          clientId: testClient.id,
          scope: 'openid profile email'
        })
      ).rejects.toThrow('Cannot grant scopes not in original token');
    });
  });

  describe('client credentials flow', () => {
    let serviceClient: any;

    beforeEach(() => {
      serviceClient = oauth2Service.registerClient({
        name: 'Service Client',
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
        metadata: {}
      });
    });

    it('should generate client credentials token', async () => {
      const tokenResponse = await oauth2Service.generateClientCredentialsToken({
        grantType: 'client_credentials',
        clientId: serviceClient.id,
        clientSecret: serviceClient.secret
      });
      
      expect(tokenResponse).toHaveProperty('access_token');
      expect(tokenResponse.token_type).toBe('Bearer');
      expect(tokenResponse).toHaveProperty('expires_in');
      expect(tokenResponse).not.toHaveProperty('refresh_token');
      expect(tokenResponse.scope).toBe('openid');
    });

    it('should generate client credentials token with specific scopes', async () => {
      const scopedClient = oauth2Service.registerClient({
        name: 'Scoped Service Client',
        redirectUris: [],
        allowedScopes: ['openid', 'profile'],
        grantTypes: ['client_credentials'],
        responseTypes: [],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 0,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const tokenResponse = await oauth2Service.generateClientCredentialsToken({
        grantType: 'client_credentials',
        clientId: scopedClient.id,
        clientSecret: scopedClient.secret,
        scope: 'openid'
      });
      
      expect(tokenResponse.scope).toBe('openid');
    });

    it('should reject invalid client credentials', async () => {
      await expect(
        oauth2Service.generateClientCredentialsToken({
          grantType: 'client_credentials',
          clientId: serviceClient.id,
          clientSecret: 'wrong-secret'
        })
      ).rejects.toThrow('Invalid client credentials');
    });

    it('should reject invalid scopes', async () => {
      await expect(
        oauth2Service.generateClientCredentialsToken({
          grantType: 'client_credentials',
          clientId: serviceClient.id,
          clientSecret: serviceClient.secret,
          scope: 'invalid-scope'
        })
      ).rejects.toThrow('Invalid scopes: invalid-scope');
    });
  });

  describe('token validation', () => {
    let testClient: any;

    beforeEach(async () => {
      testClient = oauth2Service.registerClient({
        name: 'Validation Test Client',
        redirectUris: ['https://validation.example.com/callback'],
        allowedScopes: ['openid', 'profile'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
    });

    it('should validate access token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://validation.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://validation.example.com/callback',
        clientId: testClient.id
      });
      
      const accessToken = oauth2Service.validateAccessToken(tokens.access_token);
      
      expect(accessToken).not.toBeNull();
      expect(accessToken?.token).toBe(tokens.access_token);
      expect(accessToken?.clientId).toBe(testClient.id);
      expect(accessToken?.userId).toBe('user-123');
    });

    it('should return null for invalid token', () => {
      const accessToken = oauth2Service.validateAccessToken('invalid-token');
      expect(accessToken).toBeNull();
    });

    it('should cache validated tokens', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://validation.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://validation.example.com/callback',
        clientId: testClient.id
      });
      
      // First validation
      const accessToken1 = oauth2Service.validateAccessToken(tokens.access_token);
      // Second validation (should hit cache)
      const accessToken2 = oauth2Service.validateAccessToken(tokens.access_token);
      
      expect(accessToken1).toEqual(accessToken2);
      
      const stats = oauth2Service.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });

    it('should introspect token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://validation.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://validation.example.com/callback',
        clientId: testClient.id
      });
      
      const introspection = oauth2Service.introspectToken(tokens.access_token);
      
      expect(introspection.active).toBe(true);
      expect(introspection.scope).toBe('openid');
      expect(introspection.clientId).toBe(testClient.id);
      expect(introspection.sub).toBe('user-123');
      expect(introspection.tokenType).toBe('Bearer');
    });

    it('should return inactive for invalid token introspection', () => {
      const introspection = oauth2Service.introspectToken('invalid-token');
      expect(introspection.active).toBe(false);
    });
  });

  describe('token revocation', () => {
    let testClient: any;

    beforeEach(async () => {
      testClient = oauth2Service.registerClient({
        name: 'Revocation Test Client',
        redirectUris: ['https://revocation.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
    });

    it('should revoke access token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://revocation.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://revocation.example.com/callback',
        clientId: testClient.id
      });
      
      const revoked = oauth2Service.revokeToken(tokens.access_token, 'access_token');
      expect(revoked).toBe(true);
      
      const accessToken = oauth2Service.validateAccessToken(tokens.access_token);
      expect(accessToken).toBeNull();
    });

    it('should revoke refresh token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://revocation.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://revocation.example.com/callback',
        clientId: testClient.id
      });
      
      const revoked = oauth2Service.revokeToken(tokens.refresh_token!, 'refresh_token');
      expect(revoked).toBe(true);
    });

    it('should return false for non-existent token', () => {
      const revoked = oauth2Service.revokeToken('non-existent-token');
      expect(revoked).toBe(false);
    });
  });

  describe('user info', () => {
    let testClient: any;

    beforeEach(async () => {
      testClient = oauth2Service.registerClient({
        name: 'UserInfo Test Client',
        redirectUris: ['https://userinfo.example.com/callback'],
        allowedScopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
    });

    it('should get user info from access token', async () => {
      const authCode = oauth2Service.createAuthorizationCode(
        testClient.id,
        'user-123',
        'https://userinfo.example.com/callback',
        ['openid', 'profile', 'email']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: authCode.code,
        redirectUri: 'https://userinfo.example.com/callback',
        clientId: testClient.id
      });
      
      const userInfo = oauth2Service.getUserInfo(tokens.access_token);
      
      expect(userInfo).not.toBeNull();
      expect(userInfo?.sub).toBe('user-123');
      expect(userInfo).toHaveProperty('name');
      expect(userInfo).toHaveProperty('email');
    });

    it('should return null for invalid token', () => {
      const userInfo = oauth2Service.getUserInfo('invalid-token');
      expect(userInfo).toBeNull();
    });
  });

  describe('providers', () => {
    it('should get all providers', () => {
      const providers = oauth2Service.getProviders();
      expect(providers.length).toBe(3);
    });

    it('should get provider by ID', () => {
      const google = oauth2Service.getProvider('google');
      expect(google).toBeDefined();
      expect(google?.name).toBe('Google');
      expect(google?.issuer).toBe('https://accounts.google.com');
    });

    it('should return undefined for non-existent provider', () => {
      const provider = oauth2Service.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should get OAuth 2.0 statistics', () => {
      const stats = oauth2Service.getStats();
      
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('activeClients');
      expect(stats).toHaveProperty('totalAuthorizationCodes');
      expect(stats).toHaveProperty('totalAccessTokens');
      expect(stats).toHaveProperty('totalRefreshTokens');
      expect(stats).toHaveProperty('totalIdTokens');
      expect(stats).toHaveProperty('tokenRequests');
      expect(stats).toHaveProperty('tokenRefreshes');
      expect(stats).toHaveProperty('tokenRevocations');
      expect(stats).toHaveProperty('authorizationRequests');
      expect(stats).toHaveProperty('failedAuthorizations');
      expect(stats).toHaveProperty('failedTokenRequests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('lastActivity');
    });

    it('should update statistics after operations', async () => {
      const initialStats = oauth2Service.getStats();
      
      oauth2Service.registerClient({
        name: 'Stats Test Client',
        redirectUris: ['https://stats.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const updatedStats = oauth2Service.getStats();
      expect(updatedStats.totalClients).toBe(initialStats.totalClients + 1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired tokens and codes', async () => {
      const cleanupClient = oauth2Service.registerClient({
        name: 'Cleanup Test Client',
        redirectUris: ['https://cleanup.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      oauth2Service.createAuthorizationCode(
        cleanupClient.id,
        'user-123',
        'https://cleanup.example.com/callback',
        ['openid']
      );
      
      oauth2Service.cleanupExpired();
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cleanup_completed',
          resource: 'oauth2'
        })
      );
    });
  });

  describe('logging', () => {
    it('should log authorization URL generation', () => {
      const loggingClient = oauth2Service.registerClient({
        name: 'Logging Test Client',
        redirectUris: ['https://logging.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      oauth2Service.generateAuthorizationUrl({
        responseType: 'code',
        clientId: loggingClient.id,
        redirectUri: 'https://logging.example.com/callback',
        scopes: ['openid']
      });
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'authorization_url_generated',
          resource: 'oauth2'
        })
      );
    });

    it('should log code exchange', async () => {
      const codeExchangeClient = oauth2Service.registerClient({
        name: 'Code Exchange Log Client',
        redirectUris: ['https://codeexchange.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const codeExchangeAuthCode = oauth2Service.createAuthorizationCode(
        codeExchangeClient.id,
        'user-123',
        'https://codeexchange.example.com/callback',
        ['openid']
      );
      
      await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: codeExchangeAuthCode.code,
        redirectUri: 'https://codeexchange.example.com/callback',
        clientId: codeExchangeClient.id
      });
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'code_exchanged',
          resource: 'oauth2'
        })
      );
    });

    it('should log token refresh', async () => {
      const refreshLogClient = oauth2Service.registerClient({
        name: 'Refresh Log Client',
        redirectUris: ['https://refreshlog.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const refreshLogAuthCode = oauth2Service.createAuthorizationCode(
        refreshLogClient.id,
        'user-123',
        'https://refreshlog.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: refreshLogAuthCode.code,
        redirectUri: 'https://refreshlog.example.com/callback',
        clientId: refreshLogClient.id
      });
      
      await oauth2Service.refreshAccessToken({
        grantType: 'refresh_token',
        refreshToken: tokens.refresh_token!,
        clientId: refreshLogClient.id
      });
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_refreshed',
          resource: 'oauth2'
        })
      );
    });

    it('should log token revocation', async () => {
      const revocationLogClient = oauth2Service.registerClient({
        name: 'Revocation Log Client',
        redirectUris: ['https://revocationlog.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const revocationLogAuthCode = oauth2Service.createAuthorizationCode(
        revocationLogClient.id,
        'user-123',
        'https://revocationlog.example.com/callback',
        ['openid']
      );
      
      const tokens = await oauth2Service.exchangeCodeForTokens({
        grantType: 'authorization_code',
        code: revocationLogAuthCode.code,
        redirectUri: 'https://revocationlog.example.com/callback',
        clientId: revocationLogClient.id
      });
      
      oauth2Service.revokeToken(tokens.access_token, 'access_token');
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'access_token_revoked',
          resource: 'oauth2'
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent token requests', async () => {
      const client = oauth2Service.registerClient({
        name: 'Concurrent Test Client',
        redirectUris: ['https://concurrent.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const authCode = oauth2Service.createAuthorizationCode(
          client.id,
          `user-${i}`,
          'https://concurrent.example.com/callback',
          ['openid']
        );
        
        promises.push(
          oauth2Service.exchangeCodeForTokens({
            grantType: 'authorization_code',
            code: authCode.code,
            redirectUri: 'https://concurrent.example.com/callback',
            clientId: client.id
          })
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result).toHaveProperty('access_token');
      });
    });

    it('should handle disabled logging', () => {
      const disabledConfig: Partial<OAuth2Config> = {
        ...defaultConfig,
        enableLogging: false
      };
      
      const disabledService = new OAuth2Service(disabledConfig, mockSecurityLogger);
      
      const client = disabledService.registerClient({
        name: 'No Log Client',
        redirectUris: ['https://nolog.example.com/callback'],
        allowedScopes: ['openid'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_basic',
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        requirePkce: false,
        requireConsent: false,
        isActive: true,
        metadata: {}
      });
      
      disabledService.generateAuthorizationUrl({
        responseType: 'code',
        clientId: client.id,
        redirectUri: 'https://nolog.example.com/callback',
        scopes: ['openid']
      });
      
      // Should not log when disabled
      expect(mockSecurityLogger.logSecurityEvent).not.toHaveBeenCalled();
    });
  });
});