/**
 * Keystroke Dynamics Analyzer Service
 * Analyzes keystroke patterns to detect bots and anomalous behavior
 */

import { CryptoService } from './crypto';
import { SecurityLogger } from './security-logger';
import {
  KeystrokeEvent,
  KeystrokePattern,
  KeystrokeMetrics,
  Anomaly,
  AnomalyDetectionResult,
  BotDetectionFeatures,
  BotDetectionResult,
  BotDetectionVerdict,
  BehavioralSession,
  BehavioralAnalysisConfig,
  StatisticalSummary
} from '../types/behavioral';

export class KeystrokeDynamicsAnalyzer {
  private readonly config: BehavioralAnalysisConfig;
  private readonly securityLogger: SecurityLogger;
  private readonly sessions: Map<string, BehavioralSession> = new Map();
  private readonly analysisCache: Map<string, BotDetectionResult> = new Map();

  constructor(
    config: Partial<BehavioralAnalysisConfig>,
    _cryptoService: CryptoService,
    securityLogger: SecurityLogger
  ) {
    this.config = {
      botScoreThreshold: 0.7,
      humanScoreThreshold: 0.3,
      anomalyThreshold: 0.5,
      featureWeights: {
        movement: 0.35,
        click: 0.2,
        scroll: 0.15,
        keystroke: 0.15,
        timing: 0.1,
        pattern: 0.05
      },
      useMachineLearning: false,
      cacheResults: true,
      cacheTTL: 300,
      maxAnalysisPerMinute: 100,
      logLevel: 'info',
      logAnomalies: true,
      ...config
    };

    this.securityLogger = securityLogger;
  }

  /**
   * Analyze keystroke events and calculate metrics
   */
  analyzeKeystrokeEvents(events: KeystrokeEvent[]): KeystrokeMetrics {
    if (events.length < 2) {
      return this.getEmptyKeystrokeMetrics();
    }

    // Calculate hold times (key press to key release)
    const holdTimes: number[] = [];
    const pressTimes: Map<string, number> = new Map();

    for (const event of events) {
      if (event.duration !== undefined) {
        holdTimes.push(event.duration);
      } else if (event.code) {
        // Track key press times to calculate hold duration
        const key = `${event.code}-${event.modifiers.shift}-${event.modifiers.ctrl}-${event.modifiers.alt}-${event.modifiers.meta}`;
        
        if (!pressTimes.has(key)) {
          pressTimes.set(key, event.timestamp);
        } else {
          const pressTime = pressTimes.get(key)!;
          holdTimes.push(event.timestamp - pressTime);
          pressTimes.delete(key);
        }
      }
    }

    // Calculate flight times (time between key releases and next key press)
    const flightTimes: number[] = [];
    let lastReleaseTime: number | null = null;

    for (const event of events) {
      if (lastReleaseTime !== null) {
        const flightTime = event.timestamp - lastReleaseTime;
        if (flightTime >= 0) {
          flightTimes.push(flightTime);
        }
      }
      
      // Assume key release happens after hold duration
      if (event.duration !== undefined) {
        lastReleaseTime = event.timestamp + event.duration;
      } else {
        // Estimate hold time as 50-150ms for typical typing
        lastReleaseTime = event.timestamp + 80;
      }
    }

    // Calculate typing speed (characters per minute)
    const totalTime = events[events.length - 1].timestamp - events[0].timestamp;
    const typingSpeed = totalTime > 0 ? (events.length / totalTime) * 60000 : 0;

    // Calculate rhythm (inter-key intervals)
    const rhythm: number[] = [];
    for (let i = 1; i < events.length; i++) {
      rhythm.push(events[i].timestamp - events[i - 1].timestamp);
    }

    // Calculate error rate (backspace/delete key presses)
    const errorKeys = events.filter(e => 
      e.key === 'Backspace' || 
      e.key === 'Delete' || 
      e.code === 'Backspace' || 
      e.code === 'Delete'
    );
    const errorRate = events.length > 0 ? errorKeys.length / events.length : 0;

    // Calculate statistics
    const holdTimeStats = this.calculateStatistics(holdTimes);
    const flightTimeStats = this.calculateStatistics(flightTimes);
    const rhythmStats = this.calculateStatistics(rhythm);

    // Calculate rhythm consistency (lower variance = more consistent)
    const rhythmConsistency = rhythmStats.variance > 0 
      ? 1 / (1 + rhythmStats.variance) 
      : 1;

    return {
      averageHoldTime: holdTimeStats.mean,
      holdTimeVariance: holdTimeStats.variance,
      averageFlightTime: flightTimeStats.mean,
      flightTimeVariance: flightTimeStats.variance,
      typingSpeed,
      rhythmConsistency,
      errorRate
    };
  }

  /**
   * Analyze keystroke patterns for a session
   */
  analyzeKeystrokePattern(pattern: KeystrokePattern): KeystrokeMetrics {
    return this.analyzeKeystrokeEvents(pattern.events);
  }

  /**
   * Detect anomalies in keystroke patterns
   */
  detectAnomalies(metrics: KeystrokeMetrics): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    // Check for perfect timing (bot-like)
    if (metrics.holdTimeVariance < 10 && metrics.averageHoldTime > 0) {
      anomalies.push({
        type: 'perfect_timing',
        severity: 'high',
        confidence: 0.85,
        description: 'Suspiciously consistent key hold times',
        evidence: { holdTimeVariance: metrics.holdTimeVariance },
        timestamp: Date.now()
      });
    }

    // Check for no variation in rhythm
    if (metrics.rhythmConsistency > 0.95) {
      anomalies.push({
        type: 'no_variation',
        severity: 'high',
        confidence: 0.9,
        description: 'No variation in typing rhythm',
        evidence: { rhythmConsistency: metrics.rhythmConsistency },
        timestamp: Date.now()
      });
    }

    // Check for inhuman typing speed (too fast)
    if (metrics.typingSpeed > 800) { // More than 800 CPM is suspicious
      anomalies.push({
        type: 'too_fast',
        severity: 'high',
        confidence: 0.8,
        description: 'Inhuman typing speed detected',
        evidence: { typingSpeed: metrics.typingSpeed },
        timestamp: Date.now()
      });
    }

    // Check for too slow typing (bot waiting)
    if (metrics.typingSpeed < 20 && metrics.averageFlightTime > 1000) {
      anomalies.push({
        type: 'too_slow',
        severity: 'medium',
        confidence: 0.6,
        description: 'Suspiciously slow typing pattern',
        evidence: { 
          typingSpeed: metrics.typingSpeed,
          averageFlightTime: metrics.averageFlightTime 
        },
        timestamp: Date.now()
      });
    }

    // Check for repeated pattern (same intervals)
    if (metrics.flightTimeVariance < 5 && metrics.averageFlightTime > 0) {
      anomalies.push({
        type: 'repeated_pattern',
        severity: 'high',
        confidence: 0.85,
        description: 'Repeated keystroke timing pattern',
        evidence: { flightTimeVariance: metrics.flightTimeVariance },
        timestamp: Date.now()
      });
    }

    // Check for unnatural precision in hold times
    if (metrics.holdTimeVariance < 5 && metrics.averageHoldTime > 50) {
      anomalies.push({
        type: 'inhuman_precision',
        severity: 'medium',
        confidence: 0.7,
        description: 'Unnatural precision in key hold durations',
        evidence: { holdTimeVariance: metrics.holdTimeVariance },
        timestamp: Date.now()
      });
    }

    // Calculate overall anomaly score
    const anomalyScore = anomalies.length > 0
      ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
      : 0;

    const humanLikelihood = 1 - anomalyScore;

    return {
      anomalies,
      anomalyScore,
      humanLikelihood
    };
  }

  /**
   * Perform comprehensive bot detection analysis for keystroke dynamics
   */
  async performBotDetection(session: BehavioralSession): Promise<BotDetectionResult> {
    const startTime = Date.now();

    // Check cache first
    if (this.config.cacheResults) {
      const cached = this.analysisCache.get(session.sessionId);
      if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL * 1000) {
        return cached;
      }
    }

    // Calculate keystroke metrics
    const keystrokeMetrics = session.metrics.keystroke;

    // Detect anomalies
    const anomalyResult = this.detectAnomalies(keystrokeMetrics);

    // Calculate feature scores
    const features: BotDetectionFeatures = {
      // Movement features (placeholder - not used for keystroke analysis)
      movementNaturalness: 0.5,
      velocityConsistency: 0.5,
      accelerationPattern: 0.5,
      pathEfficiency: 0.5,
      microMovementPresence: 0.5,

      // Click features (placeholder - not used for keystroke analysis)
      clickNaturalness: 0.5,
      clickTimingVariation: 0.5,

      // Scroll features (placeholder - not used for keystroke analysis)
      scrollNaturalness: 0.5,
      scrollSmoothness: 0.5,

      // Keystroke features
      keystrokeRhythm: this.calculateKeystrokeRhythmScore(keystrokeMetrics),
      typingSpeedNaturalness: this.calculateTypingSpeedNaturalness(keystrokeMetrics),

      // Timing features
      responseTimeNaturalness: this.calculateResponseTimeNaturalness(session),
      sessionDurationNaturalness: this.calculateSessionDurationNaturalness(session),

      // Pattern features
      patternVariability: this.calculatePatternVariability(keystrokeMetrics),
      repetitionScore: this.calculateRepetitionScore(keystrokeMetrics)
    };

    // Calculate weighted bot score
    const botScore = this.calculateBotScore(features, anomalyResult);

    // Determine verdict
    const verdict = this.determineVerdict(botScore, anomalyResult);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(features, anomalyResult);

    const result: BotDetectionResult = {
      verdict,
      confidence: Math.abs(botScore - 0.5) * 2, // Convert to 0-1 confidence
      botScore,
      humanScore: 1 - botScore,
      features,
      anomalies: anomalyResult.anomalies,
      riskFactors,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime
    };

    // Cache result
    if (this.config.cacheResults) {
      this.analysisCache.set(session.sessionId, result);
    }

    // Log anomalies if configured
    if (this.config.logAnomalies && anomalyResult.anomalies.length > 0) {
      this.securityLogger.logSecurityEvent({
        action: 'keystroke_detection_anomalies',
        resource: 'keystroke_dynamics_analyzer',
        reason: `Detected ${anomalyResult.anomalies.length} anomalies`,
        metadata: {
          sessionId: session.sessionId,
          anomalies: anomalyResult.anomalies,
          botScore,
          verdict
        }
      });
    }

    return result;
  }

  /**
   * Calculate keystroke rhythm score
   */
  private calculateKeystrokeRhythmScore(metrics: KeystrokeMetrics): number {
    // Humans have natural rhythm variations
    // Higher consistency = more bot-like
    const rhythmScore = 1 - metrics.rhythmConsistency;
    
    // Adjust based on typing speed naturalness
    const speedAdjustment = metrics.typingSpeed > 100 && metrics.typingSpeed < 400 ? 0.2 : 0;
    
    return Math.min(1, Math.max(0, rhythmScore + speedAdjustment));
  }

  /**
   * Calculate typing speed naturalness score
   */
  private calculateTypingSpeedNaturalness(metrics: KeystrokeMetrics): number {
    // Natural typing speeds are typically 60-200 CPM for average users
    // Professional typists can reach 300-400 CPM
    if (metrics.typingSpeed >= 60 && metrics.typingSpeed <= 400) {
      return 0.8;
    } else if (metrics.typingSpeed >= 40 && metrics.typingSpeed <= 600) {
      return 0.6;
    } else if (metrics.typingSpeed >= 20 && metrics.typingSpeed <= 800) {
      return 0.4;
    } else {
      return 0.2;
    }
  }

  /**
   * Calculate response time naturalness
   */
  private calculateResponseTimeNaturalness(session: BehavioralSession): number {
    if (session.keystrokePattern.events.length < 2) return 0.5;

    // Calculate time between page load and first keystroke
    const firstKeystroke = session.keystrokePattern.events[0];
    const responseTime = firstKeystroke.timestamp - session.startTime;

    // Natural response times are typically 500ms - 5s
    if (responseTime > 500 && responseTime < 5000) {
      return 0.8;
    } else if (responseTime > 200 && responseTime < 10000) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  /**
   * Calculate session duration naturalness
   */
  private calculateSessionDurationNaturalness(session: BehavioralSession): number {
    const duration = (session.endTime || Date.now()) - session.startTime;

    // Natural sessions are typically 5s - 10min
    if (duration > 5000 && duration < 600000) {
      return 0.8;
    } else if (duration > 1000 && duration < 1800000) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  /**
   * Calculate pattern variability score
   */
  private calculatePatternVariability(metrics: KeystrokeMetrics): number {
    // Humans have varying patterns
    const holdVariability = Math.min(1, metrics.holdTimeVariance / 1000);
    const flightVariability = Math.min(1, metrics.flightTimeVariance / 10000);
    return (holdVariability + flightVariability) / 2;
  }

  /**
   * Calculate repetition score
   */
  private calculateRepetitionScore(metrics: KeystrokeMetrics): number {
    // Check for repeated patterns in timing
    // Lower variance = more repetition
    const holdRepetition = 1 - Math.min(1, metrics.holdTimeVariance / 100);
    const flightRepetition = 1 - Math.min(1, metrics.flightTimeVariance / 1000);
    return (holdRepetition + flightRepetition) / 2;
  }

  /**
   * Calculate overall bot score
   */
  private calculateBotScore(
    features: BotDetectionFeatures,
    anomalyResult: AnomalyDetectionResult
  ): number {
    const weights = this.config.featureWeights;

    // Calculate weighted feature score (higher = more bot-like)
    const featureScore = (
      (1 - features.keystrokeRhythm) * weights.keystroke +
      (1 - features.typingSpeedNaturalness) * weights.timing +
      (1 - features.responseTimeNaturalness) * weights.timing +
      (1 - features.patternVariability) * weights.pattern
    );

    // Combine with anomaly score
    const botScore = (featureScore * 0.7) + (anomalyResult.anomalyScore * 0.3);

    return Math.min(1, Math.max(0, botScore));
  }

  /**
   * Determine bot detection verdict
   */
  private determineVerdict(
    botScore: number,
    anomalyResult: AnomalyDetectionResult
  ): BotDetectionVerdict {
    if (botScore >= this.config.botScoreThreshold) {
      return 'bot';
    } else if (botScore <= this.config.humanScoreThreshold) {
      return 'human';
    } else if (anomalyResult.anomalyScore >= this.config.anomalyThreshold) {
      return 'suspicious';
    } else {
      return 'uncertain';
    }
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    features: BotDetectionFeatures,
    anomalyResult: AnomalyDetectionResult
  ): string[] {
    const riskFactors: string[] = [];

    if (features.keystrokeRhythm < 0.3) {
      riskFactors.push('Unnatural keystroke rhythm');
    }

    if (features.typingSpeedNaturalness < 0.3) {
      riskFactors.push('Unnatural typing speed');
    }

    if (features.patternVariability < 0.2) {
      riskFactors.push('Low pattern variability');
    }

    if (features.repetitionScore > 0.8) {
      riskFactors.push('High pattern repetition');
    }

    for (const anomaly of anomalyResult.anomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        riskFactors.push(anomaly.description);
      }
    }

    return riskFactors;
  }

  /**
   * Calculate statistical summary
   */
  private calculateStatistics(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        mode: 0,
        standardDeviation: 0,
        variance: 0,
        min: 0,
        max: 0,
        range: 0,
        quartiles: [0, 0, 0],
        iqr: 0,
        skewness: 0,
        kurtosis: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate mean
    const mean = values.reduce((sum, v) => sum + v, 0) / n;

    // Calculate median
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    // Calculate mode
    const freq: Record<number, number> = {};
    let maxFreq = 0;
    let mode = sorted[0];
    for (const v of values) {
      freq[v] = (freq[v] || 0) + 1;
      if (freq[v] > maxFreq) {
        maxFreq = freq[v];
        mode = v;
      }
    }

    // Calculate variance and standard deviation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Calculate quartiles
    const q1 = sorted[Math.floor(n * 0.25)];
    const q2 = median;
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // Calculate skewness
    const skewness = standardDeviation > 0
      ? values.reduce((sum, v) => sum + Math.pow((v - mean) / standardDeviation, 3), 0) / n
      : 0;

    // Calculate kurtosis
    const kurtosis = standardDeviation > 0
      ? values.reduce((sum, v) => sum + Math.pow((v - mean) / standardDeviation, 4), 0) / n - 3
      : 0;

    return {
      mean,
      median,
      mode,
      standardDeviation,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      quartiles: [q1, q2, q3],
      iqr,
      skewness,
      kurtosis
    };
  }

  /**
   * Get empty keystroke metrics
   */
  private getEmptyKeystrokeMetrics(): KeystrokeMetrics {
    return {
      averageHoldTime: 0,
      holdTimeVariance: 0,
      averageFlightTime: 0,
      flightTimeVariance: 0,
      typingSpeed: 0,
      rhythmConsistency: 0,
      errorRate: 0
    };
  }

  /**
   * Create or update behavioral session
   */
  createSession(sessionId: string): BehavioralSession {
    const session: BehavioralSession = {
      sessionId,
      startTime: Date.now(),
      dataPoints: [],
      mouseTrail: {
        sessionId,
        movements: [],
        clicks: [],
        scrolls: [],
        startTime: Date.now(),
        endTime: Date.now(),
        totalDistance: 0,
        averageVelocity: 0,
        maxVelocity: 0,
        minVelocity: 0
      },
      keystrokePattern: {
        sessionId,
        events: [],
        averageHoldTime: 0,
        averageFlightTime: 0,
        typingSpeed: 0,
        errorRate: 0,
        rhythm: []
      },
      metrics: {
        movement: {
          averageVelocity: 0,
          maxVelocity: 0,
          minVelocity: 0,
          velocityVariance: 0,
          averageAcceleration: 0,
          maxAcceleration: 0,
          accelerationVariance: 0,
          totalDistance: 0,
          straightLineDistance: 0,
          pathEfficiency: 0,
          totalDuration: 0,
          pauseCount: 0,
          averagePauseDuration: 0,
          averageAngle: 0,
          angleVariance: 0,
          directionChanges: 0,
          averageJerk: 0,
          jerkVariance: 0
        },
        click: {
          totalClicks: 0,
          averageClickDuration: 0,
          clickDurationVariance: 0,
          doubleClickRate: 0,
          clickAccuracy: 0,
          clickIntervalVariance: 0
        },
        scroll: {
          totalScrolls: 0,
          averageScrollSpeed: 0,
          scrollSpeedVariance: 0,
          scrollDirectionConsistency: 0,
          smoothScrollingScore: 0
        },
        keystroke: this.getEmptyKeystrokeMetrics()
      }
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): BehavioralSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session with new keystroke events
   */
  updateSession(sessionId: string, events: KeystrokeEvent[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Add events to pattern
    session.keystrokePattern.events.push(...events);
    session.endTime = Date.now();

    // Recalculate metrics
    session.metrics.keystroke = this.analyzeKeystrokeEvents(session.keystrokePattern.events);
  }

  /**
   * End session and perform final analysis
   */
  async endSession(sessionId: string): Promise<BotDetectionResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.endTime = Date.now();

    // Perform bot detection
    const result = await this.performBotDetection(session);
    session.botDetectionResult = result;

    return result;
  }

  /**
   * Clear old sessions and cache
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();

    // Clear old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - (session.endTime || session.startTime) > maxAge) {
        this.sessions.delete(sessionId);
      }
    }

    // Clear old cache entries
    for (const [sessionId, result] of this.analysisCache.entries()) {
      if (now - result.timestamp > this.config.cacheTTL * 1000) {
        this.analysisCache.delete(sessionId);
      }
    }
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    activeSessions: number;
    cachedResults: number;
    totalAnalyses: number;
  } {
    return {
      activeSessions: this.sessions.size,
      cachedResults: this.analysisCache.size,
      totalAnalyses: this.analysisCache.size
    };
  }
}