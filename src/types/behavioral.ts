/**
 * Behavioral Analysis Type Definitions
 * Types for mouse movement tracking, keystroke dynamics, and bot detection
 */

import { MouseMovement } from './captcha';

export type BehavioralEventType = 
  | 'mouse_move'
  | 'mouse_click'
  | 'mouse_scroll'
  | 'mouse_enter'
  | 'mouse_leave'
  | 'key_press'
  | 'key_release'
  | 'focus'
  | 'blur'
  | 'touch_start'
  | 'touch_move'
  | 'touch_end';

export type BotDetectionVerdict = 
  | 'human'
  | 'bot'
  | 'suspicious'
  | 'uncertain';

export type AnomalyType =
  | 'unnatural_movement'
  | 'perfect_timing'
  | 'no_variation'
  | 'too_fast'
  | 'too_slow'
  | 'linear_movement'
  | 'no_acceleration'
  | 'repeated_pattern'
  | 'inhuman_precision'
  | 'missing_micro_movements';

// Mouse Movement Tracking
export interface MousePosition {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number; // For touch devices
}

export interface DetailedMouseMovement extends MousePosition {
  velocity?: number;
  acceleration?: number;
  angle?: number;
}

export interface MouseClick {
  x: number;
  y: number;
  timestamp: number;
  button: 'left' | 'right' | 'middle';
  target?: string; // Element selector or tag
  duration: number; // Click hold duration
}

export interface MouseScroll {
  x: number;
  y: number;
  timestamp: number;
  deltaX: number;
  deltaY: number;
  target?: string;
}

export interface MouseTrail {
  sessionId: string;
  movements: MouseMovement[];
  clicks: MouseClick[];
  scrolls: MouseScroll[];
  startTime: number;
  endTime: number;
  totalDistance: number;
  averageVelocity: number;
  maxVelocity: number;
  minVelocity: number;
}

// Keystroke Dynamics
export interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  duration?: number; // Key hold duration
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface KeystrokePattern {
  sessionId: string;
  events: KeystrokeEvent[];
  averageHoldTime: number;
  averageFlightTime: number; // Time between key releases and next key press
  typingSpeed: number; // Characters per minute
  errorRate: number;
  rhythm: number[]; // Array of inter-key intervals
}

// Behavioral Metrics
export interface MovementMetrics {
  // Velocity metrics
  averageVelocity: number;
  maxVelocity: number;
  minVelocity: number;
  velocityVariance: number;
  
  // Acceleration metrics
  averageAcceleration: number;
  maxAcceleration: number;
  accelerationVariance: number;
  
  // Path metrics
  totalDistance: number;
  straightLineDistance: number;
  pathEfficiency: number; // straightLineDistance / totalDistance
  
  // Timing metrics
  totalDuration: number;
  pauseCount: number;
  averagePauseDuration: number;
  
  // Angle metrics
  averageAngle: number;
  angleVariance: number;
  directionChanges: number;
  
  // Jerk metrics (rate of change of acceleration)
  averageJerk: number;
  jerkVariance: number;
}

export interface ClickMetrics {
  totalClicks: number;
  averageClickDuration: number;
  clickDurationVariance: number;
  doubleClickRate: number;
  clickAccuracy: number; // How close clicks are to target center
  clickIntervalVariance: number;
}

export interface ScrollMetrics {
  totalScrolls: number;
  averageScrollSpeed: number;
  scrollSpeedVariance: number;
  scrollDirectionConsistency: number;
  smoothScrollingScore: number;
}

export interface KeystrokeMetrics {
  averageHoldTime: number;
  holdTimeVariance: number;
  averageFlightTime: number;
  flightTimeVariance: number;
  typingSpeed: number;
  rhythmConsistency: number;
  errorRate: number;
}

// Anomaly Detection
export interface Anomaly {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  description: string;
  evidence: Record<string, unknown>;
  timestamp: number;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  anomalyScore: number; // 0-1, higher means more anomalous
  humanLikelihood: number; // 0-1, higher means more likely human
}

// Bot Detection
export interface BotDetectionFeatures {
  // Movement features
  movementNaturalness: number;
  velocityConsistency: number;
  accelerationPattern: number;
  pathEfficiency: number;
  microMovementPresence: number;
  
  // Click features
  clickNaturalness: number;
  clickTimingVariation: number;
  
  // Scroll features
  scrollNaturalness: number;
  scrollSmoothness: number;
  
  // Keystroke features
  keystrokeRhythm: number;
  typingSpeedNaturalness: number;
  
  // Timing features
  responseTimeNaturalness: number;
  sessionDurationNaturalness: number;
  
  // Pattern features
  patternVariability: number;
  repetitionScore: number;
}

export interface BotDetectionResult {
  verdict: BotDetectionVerdict;
  confidence: number; // 0-1
  botScore: number; // 0-1, higher means more likely bot
  humanScore: number; // 0-1, higher means more likely human
  features: BotDetectionFeatures;
  anomalies: Anomaly[];
  riskFactors: string[];
  timestamp: number;
  processingTime: number;
}

// Behavioral Data Collection
export interface BehavioralDataPoint {
  type: BehavioralEventType;
  timestamp: number;
  data: MouseMovement | MouseClick | MouseScroll | KeystrokeEvent;
  sessionId: string;
  sequenceNumber: number;
}

export interface BehavioralSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  dataPoints: BehavioralDataPoint[];
  mouseTrail: MouseTrail;
  keystrokePattern: KeystrokePattern;
  metrics: {
    movement: MovementMetrics;
    click: ClickMetrics;
    scroll: ScrollMetrics;
    keystroke: KeystrokeMetrics;
  };
  botDetectionResult?: BotDetectionResult;
}

// Client SDK Configuration
export interface BehavioralTrackingConfig {
  // Tracking options
  trackMouseMovements: boolean;
  trackClicks: boolean;
  trackScrolls: boolean;
  trackKeystrokes: boolean;
  
  // Sampling configuration
  mouseSamplingRate: number; // ms between samples
  maxDataPoints: number;
  
  // Privacy settings
  anonymizeKeystrokes: boolean; // Don't record actual keys
  excludeSensitiveFields: string[]; // Selectors to exclude
  
  // Performance settings
  batchSize: number; // Send data in batches
  flushInterval: number; // ms between batch sends
  
  // Encryption
  encryptData: boolean;
  publicKey?: string; // For client-side encryption
}

// Server-side Analysis Configuration
export interface BehavioralAnalysisConfig {
  // Detection thresholds
  botScoreThreshold: number; // Above this = bot
  humanScoreThreshold: number; // Above this = human
  anomalyThreshold: number; // Above this = suspicious
  
  // Feature weights
  featureWeights: {
    movement: number;
    click: number;
    scroll: number;
    keystroke: number;
    timing: number;
    pattern: number;
  };
  
  // ML Model settings
  useMachineLearning: boolean;
  modelPath?: string;
  
  // Caching
  cacheResults: boolean;
  cacheTTL: number; // seconds
  
  // Rate limiting
  maxAnalysisPerMinute: number;
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logAnomalies: boolean;
}

// API Request/Response Types
export interface BehavioralDataRequest {
  sessionId: string;
  dataPoints: BehavioralDataPoint[];
  metadata: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
    platform: string;
  };
  signature?: string; // HMAC signature for data integrity
}

export interface BehavioralDataResponse {
  success: boolean;
  sessionId: string;
  botDetectionResult?: BotDetectionResult;
  error?: string;
  processingTime: number;
}

export interface BatchBehavioralDataRequest {
  sessionId: string;
  batches: BehavioralDataPoint[][];
  metadata: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
    platform: string;
    batchCount: number;
    totalDataPoints: number;
  };
  signature?: string;
}

// Statistical Analysis
export interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  quartiles: [number, number, number]; // Q1, Q2, Q3
  iqr: number; // Interquartile range
  skewness: number;
  kurtosis: number;
}

export interface TimeSeriesAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: boolean;
  periodicity?: number;
  autocorrelation: number[];
  stationarity: boolean;
}

// Pattern Recognition
export interface MovementPattern {
  type: 'linear' | 'curved' | 'zigzag' | 'spiral' | 'random' | 'bezier';
  confidence: number;
  startPoint: MousePosition;
  endPoint: MousePosition;
  controlPoints?: MousePosition[];
  duration: number;
  distance: number;
}

export interface RepetitivePattern {
  pattern: number[]; // Sequence of values
  occurrences: number;
  interval: number; // Average time between occurrences
  confidence: number;
}

// Export utility types
export type BehavioralDataCollector = (data: BehavioralDataPoint) => void;
export type BotDetector = (session: BehavioralSession) => Promise<BotDetectionResult>;
export type AnomalyDetector = (metrics: MovementMetrics) => AnomalyDetectionResult;