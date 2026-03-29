/**
 * Security type definitions
 */

export type SecurityEventType =
  | 'captcha_generated'
  | 'captcha_validated'
  | 'validation_failed'
  | 'session_expired'
  | 'rate_limit_exceeded'
  | 'bot_detected'
  | 'suspicious_activity'
  | 'authentication_failed'
  | 'authorization_failed'
  | 'injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEventDetails {
  action: string;
  resource: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: Severity;
  timestamp: Date;
  sessionId: string;
  ip: string;
  userAgent: string;
  details: SecurityEventDetails;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  permissions: string[];
  rateLimit: RateLimit;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export interface DecryptionResult {
  decryptedData: string;
  success: boolean;
  error?: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  modulusLength: number;
}

export interface HMACResult {
  success: boolean;
  hash: string;
  error?: string;
}

export interface SecureRandomOptions {
  length: number;
  charset?: string;
  excludeSimilar?: boolean;
  excludeAmbiguous?: boolean;
}

export interface SessionToken {
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  securityMetadata: {
    entropy: number;
    generationTime: number;
  };
}

export interface CryptographicConfig {
  encryption: {
    algorithm: string;
    keySize: number;
    ivLength: number;
    tagLength: number;
  };
  hashing: {
    algorithm: string;
    saltLength: number;
  };
  signing: {
    algorithm: string;
    keySize: number;
  };
  random: {
    algorithm: string;
    minEntropy: number;
  };
}

export interface CryptographicStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  encryptionOperations: number;
  decryptionOperations: number;
  hmacOperations: number;
  keyRotations: number;
  lastKeyRotation: Date;
  securityEvents: SecurityEvent[];
}

export interface SecurityConfiguration {
  app: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableSecurityHeaders: boolean;
    enableRateLimiting: boolean;
    rateLimitRequests: number;
  };
  crypto: CryptographicConfig;
  network: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    enforceHttps: boolean;
    trustedProxies: string[];
  };
  logging: {
    level: string;
    enableFileLogging: boolean;
    logFilePath: string;
    maxLogFileSize: number;
    maxLogFiles: number;
    enableSecurityLogging: boolean;
  };
  monitoring: {
    enablePerformanceMonitoring: boolean;
    enableSecurityMonitoring: boolean;
    thresholds: {
      failedAuthThreshold: number;
      suspiciousActivityThreshold: number;
      performanceThreshold: number;
    };
    alertChannels: {
      email: boolean;
      webhook: boolean;
      console: boolean;
    };
  };
  compliance: {
    enableAuditLogging: boolean;
    auditLogRetentionDays: number;
    dataRetentionDays: number;
    encryptDataAtRest: boolean;
    encryptDataInTransit: boolean;
    standards: string[];
  };
}
