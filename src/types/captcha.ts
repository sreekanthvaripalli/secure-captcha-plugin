/**
 * Captcha type definitions
 */

export type CaptchaType = 
  | 'text' 
  | 'math' 
  | 'logic' 
  | 'image' 
  | 'audio' 
  | 'behavioral' 
  | 'invisible' 
  | 'multi-layer';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type SessionStatus = 'active' | 'validated' | 'expired' | 'failed';

export interface CaptchaOptions {
  length?: number;
  charset?: string;
  operations?: string[];
  puzzleTypes?: string[];
  categories?: string[];
  language?: string;
  layers?: CaptchaType[];
}

export interface SecurityConfig {
  sessionTimeout: number;
  maxAttempts: number;
  encryptionAlgorithm: string;
  keyRotationInterval: number;
  enableBehavioralAnalysis: boolean;
  enableDeviceFingerprinting: boolean;
  enableIpReputation: boolean;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

export interface MouseMovement {
  x: number;
  y: number;
  timestamp: number;
}

export interface KeystrokeTiming {
  key: string;
  pressTime: number;
  releaseTime: number;
}

export interface InteractionPattern {
  type: string;
  duration: number;
  timestamp: number;
}

export interface BehavioralData {
  mouseMovements: MouseMovement[];
  keystrokeTimings: KeystrokeTiming[];
  interactionPatterns: InteractionPattern[];
}

export interface SessionMetadata {
  ip: string;
  userAgent: string;
  fingerprint: string;
  behavioralData: BehavioralData;
  deviceInfo: DeviceInfo;
}

export interface CaptchaSession {
  id: string;
  type: CaptchaType;
  difficulty: Difficulty;
  challenge: string;
  answer: string;
  createdAt: Date;
  expiresAt: Date;
  status: SessionStatus;
  metadata: SessionMetadata;
  securityScore: number;
  attempts: number;
  maxAttempts: number;
}

export interface CaptchaConfig {
  id: string;
  name: string;
  type: CaptchaType;
  difficulty: Difficulty;
  options: CaptchaOptions;
  security: SecurityConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateCaptchaInput {
  type: CaptchaType;
  difficulty: Difficulty;
  options?: CaptchaOptions;
}

export interface ValidateCaptchaInput {
  sessionId: string;
  response: string;
}

export interface CaptchaResponse {
  sessionId: string;
  challenge: string;
  type: CaptchaType;
  difficulty: Difficulty;
  expiresIn: number;
  metadata: SessionMetadata;
}

export interface ValidationResponse {
  valid: boolean;
  securityScore: number;
  message: string;
}