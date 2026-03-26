/**
 * Security Configuration Service
 * Manages security policies and configuration
 */

import { SecurityConfiguration } from '../types/security';
import { SecurityLogger } from './security-logger';
import { CryptoService } from './crypto';

export class SecurityConfigurationService {
  private config: SecurityConfiguration;
  public securityLogger: SecurityLogger;
  public cryptoService: CryptoService;

  constructor(config?: Partial<SecurityConfiguration>) {
    this.config = {
      app: {
        sessionTimeout: 1800000, // 30 minutes
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 minutes
        enableSecurityHeaders: true,
        enableRateLimiting: true,
        rateLimitRequests: 100,
        ...config?.app
      },
      crypto: {
        encryption: {
          algorithm: 'AES-256-GCM',
          keySize: 256,
          ivLength: 12,
          tagLength: 16,
          ...config?.crypto?.encryption
        },
        hashing: {
          algorithm: 'SHA-256',
          saltLength: 32,
          ...config?.crypto?.hashing
        },
        signing: {
          algorithm: 'HMAC-SHA256',
          keySize: 256,
          ...config?.crypto?.signing
        },
        random: {
          algorithm: 'crypto.randomBytes',
          minEntropy: 128,
          ...config?.crypto?.random
        }
      },
      network: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        enforceHttps: true,
        trustedProxies: [],
        ...config?.network
      },
      logging: {
        level: 'info',
        enableFileLogging: true,
        logFilePath: './logs/security.log',
        maxLogFileSize: 10485760, // 10MB
        maxLogFiles: 5,
        enableSecurityLogging: true,
        ...config?.logging
      },
      monitoring: {
        enablePerformanceMonitoring: true,
        enableSecurityMonitoring: true,
        thresholds: {
          failedAuthThreshold: 10,
          suspiciousActivityThreshold: 5,
          performanceThreshold: 1000,
          ...config?.monitoring?.thresholds
        },
        alertChannels: {
          email: false,
          webhook: false,
          console: true,
          ...config?.monitoring?.alertChannels
        },
        ...config?.monitoring
      },
      compliance: {
        enableAuditLogging: true,
        auditLogRetentionDays: 90,
        dataRetentionDays: 365,
        encryptDataAtRest: true,
        encryptDataInTransit: true,
        standards: ['GDPR', 'SOC2'],
        ...config?.compliance
      }
    };

    // Initialize security logger
    this.securityLogger = new SecurityLogger({
      level: this.config.logging.level as 'debug' | 'info' | 'warn' | 'error',
      enableFileLogging: this.config.logging.enableFileLogging,
      logFilePath: this.config.logging.logFilePath,
      maxLogFileSize: this.config.logging.maxLogFileSize,
      maxLogFiles: this.config.logging.maxLogFiles
    });

    // Initialize crypto service
    this.cryptoService = new CryptoService(this.config.crypto);
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SecurityConfiguration>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config: SecurityConfiguration): boolean {
    // Validate app settings
    if (config.app.sessionTimeout <= 0) {
      throw new Error('Session timeout must be positive');
    }

    if (config.app.maxLoginAttempts <= 0) {
      throw new Error('Max login attempts must be positive');
    }

    // Validate crypto settings
    if (config.crypto.encryption.keySize < 256) {
      throw new Error('Encryption key size must be at least 256 bits');
    }

    if (config.crypto.encryption.ivLength < 12) {
      throw new Error('IV length must be at least 12 bytes');
    }

    // Validate network settings
    if (!config.network.enforceHttps) {
      // HTTPS enforcement is disabled - not recommended for production
      // This is a security warning that should be logged through proper channels
    }

    return true;
  }

  /**
   * Get security headers
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }

  /**
   * Get CORS configuration
   */
  getCorsConfig(): {
    origin: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  } {
    return {
      origin: this.config.network.allowedOrigins,
      methods: this.config.network.allowedMethods,
      allowedHeaders: this.config.network.allowedHeaders,
      credentials: true
    };
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (this.config.network.allowedOrigins.includes('*')) {
      return true;
    }
    return this.config.network.allowedOrigins.includes(origin);
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): {
    windowMs: number;
    max: number;
    message: string;
  } {
    return {
      windowMs: 60 * 1000, // 1 minute
      max: this.config.app.rateLimitRequests,
      message: 'Too many requests, please try again later'
    };
  }
}