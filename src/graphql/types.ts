/**
 * GraphQL Type Definitions for Secure CAPTCHA Plugin
 */

import { CaptchaType, CaptchaDifficulty, SessionStatus } from '../types/captcha';

export interface CaptchaChallenge {
  sessionId: string;
  challenge: string;
  type: CaptchaType;
  difficulty: CaptchaDifficulty;
  expiresIn: number;
  createdAt: string;
}

export interface CaptchaValidationResult {
  valid: boolean;
  securityScore: number;
  message: string;
  sessionId: string;
}

export interface CaptchaTypeInfo {
  type: string;
  name: string;
  difficulties: CaptchaDifficulty[];
  description: string;
}

export interface CaptchaStats {
  totalGenerated: number;
  totalValidated: number;
  successRate: number;
  averageGenerationTime: number;
  averageValidationTime: number;
  activeSessions: number;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface CaptchaSession {
  id: string;
  type: CaptchaType;
  difficulty: CaptchaDifficulty;
  status: SessionStatus;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  securityScore: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}