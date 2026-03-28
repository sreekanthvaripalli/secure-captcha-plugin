/**
 * Mouse Movement Analyzer Service
 * Analyzes mouse movement patterns to detect bots and anomalous behavior
 */

import { CryptoService } from './crypto';
import { SecurityLogger } from './security-logger';
import { MouseMovement } from '../types/captcha';
import {
  MouseClick,
  MouseScroll,
  MovementMetrics,
  ClickMetrics,
  ScrollMetrics,
  Anomaly,
  AnomalyDetectionResult,
  BotDetectionFeatures,
  BotDetectionResult,
  BotDetectionVerdict,
  BehavioralSession,
  BehavioralAnalysisConfig,
  StatisticalSummary
} from '../types/behavioral';

export class MouseMovementAnalyzer {
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
   * Analyze mouse movements and calculate metrics
   */
  analyzeMouseMovements(movements: MouseMovement[]): MovementMetrics {
    if (movements.length < 2) {
      return this.getEmptyMovementMetrics();
    }

    // Calculate velocities
    const velocities: number[] = [];
    const accelerations: number[] = [];
    const angles: number[] = [];
    const jerks: number[] = [];
    let totalDistance = 0;
    let pauseCount = 0;
    let totalPauseDuration = 0;
    let lastPauseTime = 0;

    for (let i = 1; i < movements.length; i++) {
      const prev = movements[i - 1];
      const curr = movements[i];

      // Calculate distance
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalDistance += distance;

      // Calculate time delta
      const dt = curr.timestamp - prev.timestamp;
      if (dt === 0) continue;

      // Calculate velocity
      const velocity = distance / dt;
      velocities.push(velocity);

      // Calculate angle
      const angle = Math.atan2(dy, dx);
      angles.push(angle);

      // Detect pauses (velocity near 0)
      if (velocity < 0.01) {
        if (lastPauseTime === 0) {
          lastPauseTime = prev.timestamp;
        }
      } else {
        if (lastPauseTime > 0) {
          pauseCount++;
          totalPauseDuration += prev.timestamp - lastPauseTime;
          lastPauseTime = 0;
        }
      }

      // Calculate acceleration (if we have previous velocity)
      if (i > 1 && velocities.length >= 2) {
        const prevVelocity = velocities[velocities.length - 2];
        const acceleration = (velocity - prevVelocity) / dt;
        accelerations.push(acceleration);

        // Calculate jerk (if we have previous acceleration)
        if (accelerations.length >= 2) {
          const prevAcceleration = accelerations[accelerations.length - 2];
          const jerk = (acceleration - prevAcceleration) / dt;
          jerks.push(jerk);
        }
      }
    }

    // Handle last pause
    if (lastPauseTime > 0) {
      pauseCount++;
      totalPauseDuration += movements[movements.length - 1].timestamp - lastPauseTime;
    }

    // Calculate straight-line distance
    const firstPoint = movements[0];
    const lastPoint = movements[movements.length - 1];
    const straightLineDistance = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) +
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );

    // Calculate direction changes
    let directionChanges = 0;
    for (let i = 2; i < angles.length; i++) {
      const angleDiff = Math.abs(angles[i] - angles[i - 1]);
      if (angleDiff > Math.PI / 4) { // 45 degrees threshold
        directionChanges++;
      }
    }

    // Calculate statistics
    const velocityStats = this.calculateStatistics(velocities);
    const accelerationStats = this.calculateStatistics(accelerations);
    const angleStats = this.calculateStatistics(angles);
    const jerkStats = this.calculateStatistics(jerks);

    const totalDuration = movements[movements.length - 1].timestamp - movements[0].timestamp;

    return {
      averageVelocity: velocityStats.mean,
      maxVelocity: velocityStats.max,
      minVelocity: velocityStats.min,
      velocityVariance: velocityStats.variance,
      averageAcceleration: accelerationStats.mean,
      maxAcceleration: accelerationStats.max,
      accelerationVariance: accelerationStats.variance,
      totalDistance,
      straightLineDistance,
      pathEfficiency: totalDistance > 0 ? straightLineDistance / totalDistance : 0,
      totalDuration,
      pauseCount,
      averagePauseDuration: pauseCount > 0 ? totalPauseDuration / pauseCount : 0,
      averageAngle: angleStats.mean,
      angleVariance: angleStats.variance,
      directionChanges,
      averageJerk: jerkStats.mean,
      jerkVariance: jerkStats.variance
    };
  }

  /**
   * Analyze click patterns and calculate metrics
   */
  analyzeClickPatterns(clicks: MouseClick[]): ClickMetrics {
    if (clicks.length === 0) {
      return this.getEmptyClickMetrics();
    }

    const durations = clicks.map(c => c.duration);
    const durationStats = this.calculateStatistics(durations);

    // Calculate intervals between clicks
    const intervals: number[] = [];
    for (let i = 1; i < clicks.length; i++) {
      intervals.push(clicks[i].timestamp - clicks[i - 1].timestamp);
    }
    const intervalStats = this.calculateStatistics(intervals);

    // Detect double clicks (interval < 500ms)
    let doubleClicks = 0;
    for (const interval of intervals) {
      if (interval < 500) {
        doubleClicks++;
      }
    }

    return {
      totalClicks: clicks.length,
      averageClickDuration: durationStats.mean,
      clickDurationVariance: durationStats.variance,
      doubleClickRate: clicks.length > 1 ? doubleClicks / (clicks.length - 1) : 0,
      clickIntervalVariance: intervalStats.variance,
      clickAccuracy: 1.0 // Would need target information to calculate accurately
    };
  }

  /**
   * Analyze scroll patterns and calculate metrics
   */
  analyzeScrollPatterns(scrolls: MouseScroll[]): ScrollMetrics {
    if (scrolls.length === 0) {
      return this.getEmptyScrollMetrics();
    }

    const speeds = scrolls.map(s => Math.sqrt(s.deltaX * s.deltaX + s.deltaY * s.deltaY));
    const speedStats = this.calculateStatistics(speeds);

    // Calculate direction consistency
    let consistentDirections = 0;
    for (let i = 1; i < scrolls.length; i++) {
      const prevDy = scrolls[i - 1].deltaY;
      const currDy = scrolls[i].deltaY;
      if ((prevDy > 0 && currDy > 0) || (prevDy < 0 && currDy < 0) || (prevDy === 0 && currDy === 0)) {
        consistentDirections++;
      }
    }

    // Calculate smoothness (lower variance = smoother)
    const smoothness = 1 / (1 + speedStats.variance);

    return {
      totalScrolls: scrolls.length,
      averageScrollSpeed: speedStats.mean,
      scrollSpeedVariance: speedStats.variance,
      scrollDirectionConsistency: scrolls.length > 1 ? consistentDirections / (scrolls.length - 1) : 1,
      smoothScrollingScore: smoothness
    };
  }

  /**
   * Detect anomalies in movement patterns
   */
  detectAnomalies(metrics: MovementMetrics): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    // Check for unnatural movement (too linear)
    if (metrics.pathEfficiency > 0.95) {
      anomalies.push({
        type: 'linear_movement',
        severity: 'high',
        confidence: 0.8,
        description: 'Movement path is suspiciously linear',
        evidence: { pathEfficiency: metrics.pathEfficiency },
        timestamp: Date.now()
      });
    }

    // Check for no acceleration variation (bot-like)
    if (metrics.accelerationVariance < 0.001 && metrics.averageVelocity > 0) {
      anomalies.push({
        type: 'no_acceleration',
        severity: 'high',
        confidence: 0.85,
        description: 'No acceleration variation detected',
        evidence: { accelerationVariance: metrics.accelerationVariance },
        timestamp: Date.now()
      });
    }

    // Check for missing micro-movements
    if (metrics.jerkVariance < 0.0001 && metrics.totalDistance > 100) {
      anomalies.push({
        type: 'missing_micro_movements',
        severity: 'medium',
        confidence: 0.7,
        description: 'Missing natural micro-movements',
        evidence: { jerkVariance: metrics.jerkVariance },
        timestamp: Date.now()
      });
    }

    // Check for too fast movement
    if (metrics.averageVelocity > 2.0) {
      anomalies.push({
        type: 'too_fast',
        severity: 'medium',
        confidence: 0.6,
        description: 'Movement speed is unusually fast',
        evidence: { averageVelocity: metrics.averageVelocity },
        timestamp: Date.now()
      });
    }

    // Check for too slow movement
    if (metrics.averageVelocity < 0.01 && metrics.totalDuration > 1000) {
      anomalies.push({
        type: 'too_slow',
        severity: 'low',
        confidence: 0.5,
        description: 'Movement speed is unusually slow',
        evidence: { averageVelocity: metrics.averageVelocity },
        timestamp: Date.now()
      });
    }

    // Check for no variation in velocity
    if (metrics.velocityVariance < 0.0001 && metrics.totalDistance > 50) {
      anomalies.push({
        type: 'no_variation',
        severity: 'high',
        confidence: 0.9,
        description: 'No velocity variation detected',
        evidence: { velocityVariance: metrics.velocityVariance },
        timestamp: Date.now()
      });
    }

    // Check for inhuman precision
    if (metrics.angleVariance < 0.01 && metrics.directionChanges < 2 && metrics.totalDistance > 200) {
      anomalies.push({
        type: 'inhuman_precision',
        severity: 'high',
        confidence: 0.85,
        description: 'Inhuman precision in movement angles',
        evidence: { angleVariance: metrics.angleVariance, directionChanges: metrics.directionChanges },
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
   * Perform comprehensive bot detection analysis
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

    // Calculate movement features
    const movementMetrics = session.metrics.movement;
    const clickMetrics = session.metrics.click;
    const scrollMetrics = session.metrics.scroll;

    // Detect anomalies
    const anomalyResult = this.detectAnomalies(movementMetrics);

    // Calculate feature scores
    const features: BotDetectionFeatures = {
      // Movement features
      movementNaturalness: this.calculateMovementNaturalness(movementMetrics),
      velocityConsistency: this.calculateVelocityConsistency(movementMetrics),
      accelerationPattern: this.calculateAccelerationPattern(movementMetrics),
      pathEfficiency: movementMetrics.pathEfficiency,
      microMovementPresence: this.calculateMicroMovementPresence(movementMetrics),

      // Click features
      clickNaturalness: this.calculateClickNaturalness(clickMetrics),
      clickTimingVariation: clickMetrics.clickIntervalVariance > 0 ? 1 : 0,

      // Scroll features
      scrollNaturalness: scrollMetrics.smoothScrollingScore,
      scrollSmoothness: scrollMetrics.smoothScrollingScore,

      // Keystroke features (placeholder - would need keystroke data)
      keystrokeRhythm: 0.5,
      typingSpeedNaturalness: 0.5,

      // Timing features
      responseTimeNaturalness: this.calculateResponseTimeNaturalness(session),
      sessionDurationNaturalness: this.calculateSessionDurationNaturalness(session),

      // Pattern features
      patternVariability: this.calculatePatternVariability(movementMetrics),
      repetitionScore: this.calculateRepetitionScore(session)
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
        action: 'bot_detection_anomalies',
        resource: 'mouse_movement_analyzer',
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
   * Calculate movement naturalness score
   */
  private calculateMovementNaturalness(metrics: MovementMetrics): number {
    let score = 0.5; // Base score

    // Natural movements have some path inefficiency (not perfectly straight)
    if (metrics.pathEfficiency > 0.3 && metrics.pathEfficiency < 0.9) {
      score += 0.2;
    }

    // Natural movements have velocity variation
    if (metrics.velocityVariance > 0.001) {
      score += 0.15;
    }

    // Natural movements have acceleration variation
    if (metrics.accelerationVariance > 0.0001) {
      score += 0.15;
    }

    // Natural movements have some pauses
    if (metrics.pauseCount > 0) {
      score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate velocity consistency score
   */
  private calculateVelocityConsistency(metrics: MovementMetrics): number {
    // Lower variance = more consistent (more bot-like)
    // We want some variation for human-like behavior
    const normalizedVariance = Math.min(1, metrics.velocityVariance * 1000);
    return 1 - normalizedVariance;
  }

  /**
   * Calculate acceleration pattern score
   */
  private calculateAccelerationPattern(metrics: MovementMetrics): number {
    // Humans have varying acceleration patterns
    const normalizedVariance = Math.min(1, metrics.accelerationVariance * 10000);
    return normalizedVariance;
  }

  /**
   * Calculate micro-movement presence score
   */
  private calculateMicroMovementPresence(metrics: MovementMetrics): number {
    // Micro-movements are indicated by jerk variance
    const normalizedJerk = Math.min(1, metrics.jerkVariance * 100000);
    return normalizedJerk;
  }

  /**
   * Calculate click naturalness score
   */
  private calculateClickNaturalness(metrics: ClickMetrics): number {
    let score = 0.5;

    // Natural clicks have some duration variation
    if (metrics.clickDurationVariance > 100) {
      score += 0.2;
    }

    // Natural clicks have some interval variation
    if (metrics.clickIntervalVariance > 10000) {
      score += 0.2;
    }

    // Natural click durations are typically 50-200ms
    if (metrics.averageClickDuration > 50 && metrics.averageClickDuration < 200) {
      score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate response time naturalness
   */
  private calculateResponseTimeNaturalness(session: BehavioralSession): number {
    if (session.dataPoints.length < 2) return 0.5;

    // Calculate time between page load and first interaction
    const firstInteraction = session.dataPoints[0];
    const responseTime = firstInteraction.timestamp - session.startTime;

    // Natural response times are typically 200ms - 3s
    if (responseTime > 200 && responseTime < 3000) {
      return 0.8;
    } else if (responseTime > 100 && responseTime < 5000) {
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

    // Natural sessions are typically 5s - 5min
    if (duration > 5000 && duration < 300000) {
      return 0.8;
    } else if (duration > 1000 && duration < 600000) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  /**
   * Calculate pattern variability score
   */
  private calculatePatternVariability(metrics: MovementMetrics): number {
    // Humans have varying patterns
    const angleVariability = Math.min(1, metrics.angleVariance * 10);
    const directionVariability = Math.min(1, metrics.directionChanges / 10);
    return (angleVariability + directionVariability) / 2;
  }

  /**
   * Calculate repetition score
   */
  private calculateRepetitionScore(session: BehavioralSession): number {
    // Check for repeated patterns in movements
    const movements = session.mouseTrail.movements;
    if (movements.length < 10) return 0;

    // Simple repetition detection: check if similar sequences exist
    let repeatedSequences = 0;
    const sequenceLength = 5;

    for (let i = 0; i < movements.length - sequenceLength * 2; i++) {
      const sequence1 = movements.slice(i, i + sequenceLength);
      
      for (let j = i + sequenceLength; j < movements.length - sequenceLength; j++) {
        const sequence2 = movements.slice(j, j + sequenceLength);
        
        // Check if sequences are similar
        let similar = true;
        for (let k = 0; k < sequenceLength; k++) {
          const dx = Math.abs(sequence1[k].x - sequence2[k].x);
          const dy = Math.abs(sequence1[k].y - sequence2[k].y);
          if (dx > 10 || dy > 10) {
            similar = false;
            break;
          }
        }
        
        if (similar) {
          repeatedSequences++;
        }
      }
    }

    return Math.min(1, repeatedSequences / 10);
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
      (1 - features.movementNaturalness) * weights.movement +
      (1 - features.clickNaturalness) * weights.click +
      (1 - features.scrollNaturalness) * weights.scroll +
      (1 - features.keystrokeRhythm) * weights.keystroke +
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

    if (features.movementNaturalness < 0.3) {
      riskFactors.push('Unnatural movement patterns');
    }

    if (features.velocityConsistency > 0.9) {
      riskFactors.push('Suspiciously consistent velocity');
    }

    if (features.microMovementPresence < 0.2) {
      riskFactors.push('Missing micro-movements');
    }

    if (features.clickNaturalness < 0.3) {
      riskFactors.push('Unnatural click patterns');
    }

    if (features.repetitionScore > 0.7) {
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
    const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / standardDeviation, 3), 0) / n;

    // Calculate kurtosis
    const kurtosis = values.reduce((sum, v) => sum + Math.pow((v - mean) / standardDeviation, 4), 0) / n - 3;

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
   * Get empty movement metrics
   */
  private getEmptyMovementMetrics(): MovementMetrics {
    return {
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
    };
  }

  /**
   * Get empty click metrics
   */
  private getEmptyClickMetrics(): ClickMetrics {
    return {
      totalClicks: 0,
      averageClickDuration: 0,
      clickDurationVariance: 0,
      doubleClickRate: 0,
      clickAccuracy: 0,
      clickIntervalVariance: 0
    };
  }

  /**
   * Get empty scroll metrics
   */
  private getEmptyScrollMetrics(): ScrollMetrics {
    return {
      totalScrolls: 0,
      averageScrollSpeed: 0,
      scrollSpeedVariance: 0,
      scrollDirectionConsistency: 0,
      smoothScrollingScore: 0
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
        movement: this.getEmptyMovementMetrics(),
        click: this.getEmptyClickMetrics(),
        scroll: this.getEmptyScrollMetrics(),
        keystroke: {
          averageHoldTime: 0,
          holdTimeVariance: 0,
          averageFlightTime: 0,
          flightTimeVariance: 0,
          typingSpeed: 0,
          rhythmConsistency: 0,
          errorRate: 0
        }
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
   * Update session with new data
   */
  updateSession(sessionId: string, movements: MouseMovement[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Add movements to trail
    session.mouseTrail.movements.push(...movements);
    session.mouseTrail.endTime = Date.now();

    // Recalculate metrics
    session.metrics.movement = this.analyzeMouseMovements(session.mouseTrail.movements);
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