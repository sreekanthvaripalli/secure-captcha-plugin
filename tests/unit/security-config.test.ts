import { SecurityConfigurationService } from '../../src/security/config';

describe('SecurityConfigurationService', () => {
  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.app.sessionTimeout).toBe(1800000);
      expect(config.app.maxLoginAttempts).toBe(5);
      expect(config.app.lockoutDuration).toBe(900000);
      expect(config.app.enableSecurityHeaders).toBe(true);
      expect(config.app.enableRateLimiting).toBe(true);
      expect(config.app.rateLimitRequests).toBe(100);
    });

    it('should initialize with custom configuration', () => {
      const service = new SecurityConfigurationService({
        app: {
          sessionTimeout: 3600000,
          maxLoginAttempts: 3,
        },
      } as any);
      const config = service.getConfig();

      expect(config.app.sessionTimeout).toBe(3600000);
      expect(config.app.maxLoginAttempts).toBe(3);
    });

    it('should initialize crypto with default settings', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.crypto.encryption.algorithm).toBe('AES-256-GCM');
      expect(config.crypto.encryption.keySize).toBe(256);
      expect(config.crypto.encryption.ivLength).toBe(12);
      expect(config.crypto.hashing.algorithm).toBe('SHA-256');
      expect(config.crypto.signing.algorithm).toBe('HMAC-SHA256');
    });

    it('should initialize network with default settings', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.network.allowedOrigins).toEqual(['*']);
      expect(config.network.allowedMethods).toEqual(['GET', 'POST']);
      expect(config.network.enforceHttps).toBe(true);
    });

    it('should initialize logging with default settings', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.logging.level).toBe('info');
      expect(config.logging.enableFileLogging).toBe(true);
      expect(config.logging.logFilePath).toBe('./logs/security.log');
    });

    it('should initialize monitoring with default settings', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.monitoring.enablePerformanceMonitoring).toBe(true);
      expect(config.monitoring.enableSecurityMonitoring).toBe(true);
      expect(config.monitoring.thresholds.failedAuthThreshold).toBe(10);
    });

    it('should initialize compliance with default settings', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(config.compliance.enableAuditLogging).toBe(true);
      expect(config.compliance.auditLogRetentionDays).toBe(90);
      expect(config.compliance.standards).toEqual(['GDPR', 'SOC2']);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const service = new SecurityConfigurationService();
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const service = new SecurityConfigurationService();
      service.updateConfig({
        app: {
          sessionTimeout: 3600000,
        },
      } as any);

      const config = service.getConfig();
      expect(config.app.sessionTimeout).toBe(3600000);
    });

    it('should update configuration with new values', () => {
      const service = new SecurityConfigurationService();
      service.updateConfig({
        app: {
          sessionTimeout: 3600000,
        },
      } as any);

      const config = service.getConfig();
      expect(config.app.sessionTimeout).toBe(3600000);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid configuration', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();

      expect(service.validateConfiguration(config)).toBe(true);
    });

    it('should throw error for invalid session timeout', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.app.sessionTimeout = 0;

      expect(() => service.validateConfiguration(config)).toThrow(
        'Session timeout must be positive'
      );
    });

    it('should throw error for negative session timeout', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.app.sessionTimeout = -100;

      expect(() => service.validateConfiguration(config)).toThrow(
        'Session timeout must be positive'
      );
    });

    it('should throw error for invalid max login attempts', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.app.maxLoginAttempts = 0;

      expect(() => service.validateConfiguration(config)).toThrow(
        'Max login attempts must be positive'
      );
    });

    it('should throw error for weak encryption key size', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.crypto.encryption.keySize = 128;

      expect(() => service.validateConfiguration(config)).toThrow(
        'Encryption key size must be at least 256 bits'
      );
    });

    it('should throw error for short IV length', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.crypto.encryption.ivLength = 8;

      expect(() => service.validateConfiguration(config)).toThrow(
        'IV length must be at least 12 bytes'
      );
    });

    it('should allow HTTPS to be disabled', () => {
      const service = new SecurityConfigurationService();
      const config = service.getConfig();
      config.network.enforceHttps = false;

      expect(service.validateConfiguration(config)).toBe(true);
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return security headers', () => {
      const service = new SecurityConfigurationService();
      const headers = service.getSecurityHeaders();

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toContain('geolocation=()');
    });
  });

  describe('getCorsConfig', () => {
    it('should return CORS configuration', () => {
      const service = new SecurityConfigurationService();
      const cors = service.getCorsConfig();

      expect(cors.origin).toEqual(['*']);
      expect(cors.methods).toEqual(['GET', 'POST']);
      expect(cors.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
      expect(cors.credentials).toBe(true);
    });

    it('should return custom CORS configuration', () => {
      const service = new SecurityConfigurationService({
        network: {
          allowedOrigins: ['https://example.com'],
          allowedMethods: ['GET', 'POST', 'PUT'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom'],
        },
      } as any);
      const cors = service.getCorsConfig();

      expect(cors.origin).toEqual(['https://example.com']);
      expect(cors.methods).toEqual(['GET', 'POST', 'PUT']);
      expect(cors.allowedHeaders).toEqual(['Content-Type', 'Authorization', 'X-Custom']);
    });
  });

  describe('isOriginAllowed', () => {
    it('should allow all origins when wildcard is configured', () => {
      const service = new SecurityConfigurationService();
      expect(service.isOriginAllowed('https://example.com')).toBe(true);
      expect(service.isOriginAllowed('https://evil.com')).toBe(true);
    });

    it('should allow specific origins when configured', () => {
      const service = new SecurityConfigurationService({
        network: {
          allowedOrigins: ['https://example.com', 'https://trusted.com'],
        },
      } as any);

      expect(service.isOriginAllowed('https://example.com')).toBe(true);
      expect(service.isOriginAllowed('https://trusted.com')).toBe(true);
      expect(service.isOriginAllowed('https://evil.com')).toBe(false);
    });
  });

  describe('getRateLimitConfig', () => {
    it('should return rate limit configuration', () => {
      const service = new SecurityConfigurationService();
      const rateLimit = service.getRateLimitConfig();

      expect(rateLimit.windowMs).toBe(60000);
      expect(rateLimit.max).toBe(100);
      expect(rateLimit.message).toBe('Too many requests, please try again later');
    });

    it('should return custom rate limit configuration', () => {
      const service = new SecurityConfigurationService({
        app: {
          rateLimitRequests: 50,
        },
      } as any);
      const rateLimit = service.getRateLimitConfig();

      expect(rateLimit.max).toBe(50);
    });
  });

  describe('securityLogger', () => {
    it('should have security logger initialized', () => {
      const service = new SecurityConfigurationService();
      expect(service.securityLogger).toBeDefined();
    });
  });

  describe('cryptoService', () => {
    it('should have crypto service initialized', () => {
      const service = new SecurityConfigurationService();
      expect(service.cryptoService).toBeDefined();
    });
  });
});
