/**
 * Anomaly Detection Service
 * Provides statistical analysis, time series analysis, and pattern deviation detection
 */

import { SecurityLogger } from './security-logger';
import { BehavioralSession, Anomaly, MovementMetrics, KeystrokeMetrics } from '../types/behavioral';

export interface AnomalyDetectionConfig {
  statisticalThreshold: number;
  timeSeriesWindowSize: number;
  patternDeviationThreshold: number;
  adaptiveThresholdLearningRate: number;
  minSamplesForAdaptive: number;
  anomalyScoreThreshold: number;
}

export interface StatisticalAnalysis {
  mean: number;
  standardDeviation: number;
  variance: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  outliers: number[];
  zScores: number[];
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeriesAnalysis {
  trend: number;
  seasonality: number;
  residuals: number[];
  movingAverage: number[];
  exponentialSmoothing: number[];
  forecast: number[];
}

export interface PatternDeviation {
  expectedPattern: number[];
  actualPattern: number[];
  deviation: number;
  deviationPercentage: number;
  significantDeviations: number[];
}

export interface AdaptiveThreshold {
  metric: string;
  baseline: number;
  current: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  sampleCount: number;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  anomalyScore: number;
  statisticalAnalysis: Map<string, StatisticalAnalysis>;
  timeSeriesAnalysis: Map<string, TimeSeriesAnalysis>;
  patternDeviations: Map<string, PatternDeviation>;
  adaptiveThresholds: Map<string, AdaptiveThreshold>;
  processingTime: number;
}

export class AnomalyDetector {
  private readonly config: AnomalyDetectionConfig;
  private readonly securityLogger: SecurityLogger;
  private readonly historicalData: Map<string, number[]> = new Map();
  private readonly adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private readonly timeSeriesData: Map<string, TimeSeriesPoint[]> = new Map();

  constructor(config: Partial<AnomalyDetectionConfig>, securityLogger: SecurityLogger) {
    this.config = {
      statisticalThreshold: 2.0,
      timeSeriesWindowSize: 100,
      patternDeviationThreshold: 0.3,
      adaptiveThresholdLearningRate: 0.1,
      minSamplesForAdaptive: 50,
      anomalyScoreThreshold: 0.7,
      ...config,
    };

    this.securityLogger = securityLogger;
  }

  /**
   * Perform comprehensive anomaly detection on a behavioral session
   */
  async detectAnomalies(session: BehavioralSession): Promise<AnomalyDetectionResult> {
    const startTime = Date.now();
    const anomalies: Anomaly[] = [];

    // Perform statistical analysis
    const statisticalAnalysis = this.performStatisticalAnalysis(session);

    // Perform time series analysis
    const timeSeriesAnalysis = this.performTimeSeriesAnalysis(session);

    // Detect pattern deviations
    const patternDeviations = this.detectPatternDeviations(session);

    // Update and check adaptive thresholds
    const adaptiveThresholds = this.updateAdaptiveThresholds(session);

    // Detect anomalies from statistical analysis
    const statisticalAnomalies = this.detectStatisticalAnomalies(statisticalAnalysis);
    anomalies.push(...statisticalAnomalies);

    // Detect anomalies from time series analysis
    const timeSeriesAnomalies = this.detectTimeSeriesAnomalies(timeSeriesAnalysis);
    anomalies.push(...timeSeriesAnomalies);

    // Detect anomalies from pattern deviations
    const patternAnomalies = this.detectPatternAnomalies(patternDeviations);
    anomalies.push(...patternAnomalies);

    // Detect anomalies from adaptive thresholds
    const thresholdAnomalies = this.detectThresholdAnomalies(adaptiveThresholds);
    anomalies.push(...thresholdAnomalies);

    // Calculate overall anomaly score
    const anomalyScore = this.calculateAnomalyScore(anomalies);

    const result: AnomalyDetectionResult = {
      anomalies,
      anomalyScore,
      statisticalAnalysis,
      timeSeriesAnalysis,
      patternDeviations,
      adaptiveThresholds,
      processingTime: Date.now() - startTime,
    };

    // Log anomaly detection results
    this.securityLogger.logSecurityEvent({
      action: 'anomaly_detection_completed',
      resource: 'anomaly_detector',
      reason: `Anomaly detection completed with ${anomalies.length} anomalies found`,
      metadata: {
        sessionId: session.sessionId,
        anomalyCount: anomalies.length,
        anomalyScore,
        processingTime: result.processingTime,
      },
    });

    return result;
  }

  /**
   * Perform statistical analysis on session metrics
   */
  private performStatisticalAnalysis(session: BehavioralSession): Map<string, StatisticalAnalysis> {
    const analysis = new Map<string, StatisticalAnalysis>();

    // Analyze movement metrics
    const movementValues = this.extractMovementValues(session.metrics.movement);
    analysis.set('movement', this.calculateStatistics(movementValues));

    // Analyze keystroke metrics
    const keystrokeValues = this.extractKeystrokeValues(session.metrics.keystroke);
    analysis.set('keystroke', this.calculateStatistics(keystrokeValues));

    // Analyze click metrics
    const clickValues = this.extractClickValues(session.metrics.click);
    analysis.set('click', this.calculateStatistics(clickValues));

    // Analyze scroll metrics
    const scrollValues = this.extractScrollValues(session.metrics.scroll);
    analysis.set('scroll', this.calculateStatistics(scrollValues));

    return analysis;
  }

  /**
   * Calculate statistical measures for a set of values
   */
  private calculateStatistics(values: number[]): StatisticalAnalysis {
    if (values.length === 0) {
      return {
        mean: 0,
        standardDeviation: 0,
        variance: 0,
        median: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        outliers: [],
        zScores: [],
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    // Calculate variance and standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Calculate median
    const median =
      n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Calculate quartiles
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    // Calculate z-scores
    const zScores = values.map(val =>
      standardDeviation > 0 ? (val - mean) / standardDeviation : 0
    );

    // Detect outliers using IQR method
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = values.filter(val => val < lowerBound || val > upperBound);

    return {
      mean,
      standardDeviation,
      variance,
      median,
      q1,
      q3,
      iqr,
      outliers,
      zScores,
    };
  }

  /**
   * Perform time series analysis on session data
   */
  private performTimeSeriesAnalysis(session: BehavioralSession): Map<string, TimeSeriesAnalysis> {
    const analysis = new Map<string, TimeSeriesAnalysis>();

    // Analyze movement time series
    const movementTimeSeries = this.extractMovementTimeSeries(session);
    analysis.set('movement', this.analyzeTimeSeries(movementTimeSeries));

    // Analyze keystroke time series
    const keystrokeTimeSeries = this.extractKeystrokeTimeSeries(session);
    analysis.set('keystroke', this.analyzeTimeSeries(keystrokeTimeSeries));

    return analysis;
  }

  /**
   * Analyze a time series for trends, seasonality, and anomalies
   */
  private analyzeTimeSeries(data: TimeSeriesPoint[]): TimeSeriesAnalysis {
    if (data.length < 3) {
      return {
        trend: 0,
        seasonality: 0,
        residuals: [],
        movingAverage: [],
        exponentialSmoothing: [],
        forecast: [],
      };
    }

    const values = data.map(p => p.value);

    // Calculate moving average
    const windowSize = Math.min(5, Math.floor(values.length / 2));
    const movingAverage = this.calculateMovingAverage(values, windowSize);

    // Calculate exponential smoothing
    const alpha = 0.3;
    const exponentialSmoothing = this.calculateExponentialSmoothing(values, alpha);

    // Calculate trend using linear regression
    const trend = this.calculateTrend(values);

    // Calculate seasonality (simplified)
    const seasonality = this.calculateSeasonality(values);

    // Calculate residuals
    const residuals = values.map((val, i) => {
      const predicted = trend * i + movingAverage[i] || val;
      return val - predicted;
    });

    // Generate forecast
    const forecast = this.generateForecast(values, trend, 5);

    return {
      trend,
      seasonality,
      residuals,
      movingAverage,
      exponentialSmoothing,
      forecast,
    };
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(values: number[], windowSize: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(avg);
    }
    return result;
  }

  /**
   * Calculate exponential smoothing
   */
  private calculateExponentialSmoothing(values: number[], alpha: number): number[] {
    const result: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      const smoothed = alpha * values[i] + (1 - alpha) * result[i - 1];
      result.push(smoothed);
    }
    return result;
  }

  /**
   * Calculate trend using linear regression
   */
  private calculateTrend(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate seasonality (simplified)
   */
  private calculateSeasonality(values: number[]): number {
    if (values.length < 4) {
      return 0;
    }

    // Simple seasonality detection using autocorrelation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const centered = values.map(val => val - mean);

    let maxCorrelation = 0;
    const maxLag = Math.min(10, Math.floor(values.length / 2));

    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      for (let i = lag; i < centered.length; i++) {
        correlation += centered[i] * centered[i - lag];
      }
      correlation /= centered.length - lag;
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }

    return maxCorrelation;
  }

  /**
   * Generate forecast
   */
  private generateForecast(values: number[], trend: number, steps: number): number[] {
    const forecast: number[] = [];
    const lastValue = values[values.length - 1];

    for (let i = 1; i <= steps; i++) {
      const predicted = lastValue + trend * i;
      forecast.push(predicted);
    }

    return forecast;
  }

  /**
   * Detect pattern deviations
   */
  private detectPatternDeviations(session: BehavioralSession): Map<string, PatternDeviation> {
    const deviations = new Map<string, PatternDeviation>();

    // Detect movement pattern deviations
    const movementPattern = this.extractMovementPattern(session);
    const expectedMovementPattern = this.getExpectedPattern('movement');
    deviations.set(
      'movement',
      this.calculatePatternDeviation(expectedMovementPattern, movementPattern)
    );

    // Detect keystroke pattern deviations
    const keystrokePattern = this.extractKeystrokePattern(session);
    const expectedKeystrokePattern = this.getExpectedPattern('keystroke');
    deviations.set(
      'keystroke',
      this.calculatePatternDeviation(expectedKeystrokePattern, keystrokePattern)
    );

    return deviations;
  }

  /**
   * Calculate pattern deviation
   */
  private calculatePatternDeviation(expected: number[], actual: number[]): PatternDeviation {
    if (expected.length === 0 || actual.length === 0) {
      return {
        expectedPattern: expected,
        actualPattern: actual,
        deviation: 0,
        deviationPercentage: 0,
        significantDeviations: [],
      };
    }

    // Normalize patterns to same length
    const minLength = Math.min(expected.length, actual.length);
    const normalizedExpected = expected.slice(0, minLength);
    const normalizedActual = actual.slice(0, minLength);

    // Calculate deviation
    let totalDeviation = 0;
    const significantDeviations: number[] = [];

    for (let i = 0; i < minLength; i++) {
      const deviation = Math.abs(normalizedExpected[i] - normalizedActual[i]);
      totalDeviation += deviation;

      if (deviation > this.config.patternDeviationThreshold) {
        significantDeviations.push(i);
      }
    }

    const avgDeviation = totalDeviation / minLength;
    const deviationPercentage = avgDeviation * 100;

    return {
      expectedPattern: normalizedExpected,
      actualPattern: normalizedActual,
      deviation: avgDeviation,
      deviationPercentage,
      significantDeviations,
    };
  }

  /**
   * Update adaptive thresholds based on new data
   */
  private updateAdaptiveThresholds(session: BehavioralSession): Map<string, AdaptiveThreshold> {
    const thresholds = new Map<string, AdaptiveThreshold>();

    // Update movement thresholds
    const movementMetrics = session.metrics.movement;
    this.updateThreshold('movement_velocity', movementMetrics.averageVelocity);
    this.updateThreshold('movement_acceleration', movementMetrics.averageAcceleration);
    this.updateThreshold('movement_path_efficiency', movementMetrics.pathEfficiency);

    // Update keystroke thresholds
    const keystrokeMetrics = session.metrics.keystroke;
    this.updateThreshold('keystroke_hold_time', keystrokeMetrics.averageHoldTime);
    this.updateThreshold('keystroke_flight_time', keystrokeMetrics.averageFlightTime);
    this.updateThreshold('keystroke_typing_speed', keystrokeMetrics.typingSpeed);

    // Copy current thresholds
    this.adaptiveThresholds.forEach((threshold, key) => {
      thresholds.set(key, { ...threshold });
    });

    return thresholds;
  }

  /**
   * Update a specific adaptive threshold
   */
  private updateThreshold(metric: string, value: number): void {
    const existing = this.adaptiveThresholds.get(metric);

    if (!existing) {
      // Initialize new threshold
      this.adaptiveThresholds.set(metric, {
        metric,
        baseline: value,
        current: value,
        upperBound: value * 1.5,
        lowerBound: value * 0.5,
        confidence: 0.5,
        sampleCount: 1,
      });
    } else {
      // Update existing threshold using exponential moving average
      const learningRate = this.config.adaptiveThresholdLearningRate;
      const newSampleCount = existing.sampleCount + 1;
      const newConfidence = Math.min(1, existing.confidence + 0.01);

      const newBaseline = existing.baseline * (1 - learningRate) + value * learningRate;
      const newCurrent = value;

      // Update bounds based on variance
      const variance = Math.pow(value - existing.baseline, 2);
      const stdDev = Math.sqrt(variance);
      const newUpperBound = newBaseline + 2 * stdDev;
      const newLowerBound = newBaseline - 2 * stdDev;

      this.adaptiveThresholds.set(metric, {
        metric,
        baseline: newBaseline,
        current: newCurrent,
        upperBound: newUpperBound,
        lowerBound: newLowerBound,
        confidence: newConfidence,
        sampleCount: newSampleCount,
      });
    }
  }

  /**
   * Detect anomalies from statistical analysis
   */
  private detectStatisticalAnomalies(analysis: Map<string, StatisticalAnalysis>): Anomaly[] {
    const anomalies: Anomaly[] = [];

    analysis.forEach((stats, category) => {
      // Check for outliers
      if (stats.outliers.length > 0) {
        anomalies.push({
          type: 'unnatural_movement',
          severity: stats.outliers.length > 3 ? 'high' : 'medium',
          confidence: Math.min(0.9, stats.outliers.length * 0.2),
          description: `Statistical outliers detected in ${category}`,
          evidence: {
            category,
            outlierCount: stats.outliers.length,
            outliers: stats.outliers.slice(0, 5),
            mean: stats.mean,
            standardDeviation: stats.standardDeviation,
          },
          timestamp: Date.now(),
        });
      }

      // Check for high z-scores
      const highZScores = stats.zScores.filter(z => Math.abs(z) > this.config.statisticalThreshold);
      if (highZScores.length > 0) {
        anomalies.push({
          type: 'unnatural_movement',
          severity: 'medium',
          confidence: Math.min(0.8, highZScores.length * 0.15),
          description: `High z-scores detected in ${category}`,
          evidence: {
            category,
            highZScoreCount: highZScores.length,
            threshold: this.config.statisticalThreshold,
          },
          timestamp: Date.now(),
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect anomalies from time series analysis
   */
  private detectTimeSeriesAnomalies(analysis: Map<string, TimeSeriesAnalysis>): Anomaly[] {
    const anomalies: Anomaly[] = [];

    analysis.forEach((tsAnalysis, category) => {
      // Check for unusual trends
      if (Math.abs(tsAnalysis.trend) > 0.1) {
        anomalies.push({
          type: 'repeated_pattern',
          severity: 'low',
          confidence: 0.6,
          description: `Unusual trend detected in ${category}`,
          evidence: {
            category,
            trend: tsAnalysis.trend,
            direction: tsAnalysis.trend > 0 ? 'increasing' : 'decreasing',
          },
          timestamp: Date.now(),
        });
      }

      // Check for high residuals
      const highResiduals = tsAnalysis.residuals.filter(r => Math.abs(r) > 2);
      if (highResiduals.length > 0) {
        anomalies.push({
          type: 'repeated_pattern',
          severity: 'medium',
          confidence: Math.min(0.7, highResiduals.length * 0.1),
          description: `High residuals detected in ${category}`,
          evidence: {
            category,
            highResidualCount: highResiduals.length,
          },
          timestamp: Date.now(),
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect anomalies from pattern deviations
   */
  private detectPatternAnomalies(deviations: Map<string, PatternDeviation>): Anomaly[] {
    const anomalies: Anomaly[] = [];

    deviations.forEach((deviation, category) => {
      if (deviation.deviationPercentage > this.config.patternDeviationThreshold * 100) {
        anomalies.push({
          type: 'repeated_pattern',
          severity: deviation.deviationPercentage > 50 ? 'high' : 'medium',
          confidence: Math.min(0.9, deviation.deviationPercentage / 100),
          description: `Significant pattern deviation detected in ${category}`,
          evidence: {
            category,
            deviationPercentage: deviation.deviationPercentage,
            significantDeviations: deviation.significantDeviations.length,
          },
          timestamp: Date.now(),
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect anomalies from adaptive thresholds
   */
  private detectThresholdAnomalies(thresholds: Map<string, AdaptiveThreshold>): Anomaly[] {
    const anomalies: Anomaly[] = [];

    thresholds.forEach((threshold, metric) => {
      if (threshold.sampleCount >= this.config.minSamplesForAdaptive) {
        // Check if current value exceeds bounds
        if (threshold.current > threshold.upperBound) {
          anomalies.push({
            type: 'repeated_pattern',
            severity: 'high',
            confidence: threshold.confidence,
            description: `Value exceeds upper adaptive threshold for ${metric}`,
            evidence: {
              metric,
              current: threshold.current,
              upperBound: threshold.upperBound,
              baseline: threshold.baseline,
            },
            timestamp: Date.now(),
          });
        } else if (threshold.current < threshold.lowerBound) {
          anomalies.push({
            type: 'repeated_pattern',
            severity: 'medium',
            confidence: threshold.confidence,
            description: `Value below lower adaptive threshold for ${metric}`,
            evidence: {
              metric,
              current: threshold.current,
              lowerBound: threshold.lowerBound,
              baseline: threshold.baseline,
            },
            timestamp: Date.now(),
          });
        }
      }
    });

    return anomalies;
  }

  /**
   * Calculate overall anomaly score
   */
  private calculateAnomalyScore(anomalies: Anomaly[]): number {
    if (anomalies.length === 0) {
      return 0;
    }

    const severityWeights: Record<string, number> = {
      low: 0.3,
      medium: 0.6,
      high: 1.0,
      critical: 1.0,
    };

    let totalScore = 0;
    let totalWeight = 0;

    anomalies.forEach(anomaly => {
      const weight = severityWeights[anomaly.severity] || 0.5;
      totalScore += anomaly.confidence * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Helper methods for extracting values and patterns

  private extractMovementValues(metrics: MovementMetrics): number[] {
    return [
      metrics.averageVelocity,
      metrics.maxVelocity,
      metrics.averageAcceleration,
      metrics.pathEfficiency,
      metrics.directionChanges,
    ];
  }

  private extractKeystrokeValues(metrics: KeystrokeMetrics): number[] {
    return [
      metrics.averageHoldTime,
      metrics.averageFlightTime,
      metrics.typingSpeed,
      metrics.rhythmConsistency,
      metrics.errorRate,
    ];
  }

  private extractClickValues(metrics: {
    totalClicks: number;
    averageClickDuration: number;
    clickDurationVariance: number;
    doubleClickRate: number;
    clickAccuracy: number;
    clickIntervalVariance: number;
  }): number[] {
    return [
      metrics.totalClicks,
      metrics.averageClickDuration,
      metrics.clickDurationVariance,
      metrics.doubleClickRate,
      metrics.clickAccuracy,
    ];
  }

  private extractScrollValues(metrics: {
    totalScrolls: number;
    averageScrollSpeed: number;
    scrollSpeedVariance: number;
    scrollDirectionConsistency: number;
    smoothScrollingScore: number;
  }): number[] {
    return [
      metrics.totalScrolls,
      metrics.averageScrollSpeed,
      metrics.scrollSpeedVariance,
      metrics.scrollDirectionConsistency,
      metrics.smoothScrollingScore,
    ];
  }

  private extractMovementTimeSeries(session: BehavioralSession): TimeSeriesPoint[] {
    return session.mouseTrail.movements.map(m => ({
      timestamp: m.timestamp,
      value: Math.sqrt(Math.pow(m.x, 2) + Math.pow(m.y, 2)),
    }));
  }

  private extractKeystrokeTimeSeries(session: BehavioralSession): TimeSeriesPoint[] {
    return session.keystrokePattern.events.map(e => ({
      timestamp: e.timestamp,
      value: e.duration || 0,
    }));
  }

  private extractMovementPattern(session: BehavioralSession): number[] {
    const movements = session.mouseTrail.movements;
    if (movements.length < 2) {
      return [];
    }

    const pattern: number[] = [];
    for (let i = 1; i < movements.length; i++) {
      const dx = movements[i].x - movements[i - 1].x;
      const dy = movements[i].y - movements[i - 1].y;
      const angle = Math.atan2(dy, dx);
      pattern.push(angle);
    }
    return pattern;
  }

  private extractKeystrokePattern(session: BehavioralSession): number[] {
    const events = session.keystrokePattern.events;
    if (events.length < 2) {
      return [];
    }

    const pattern: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const interval = events[i].timestamp - events[i - 1].timestamp;
      pattern.push(interval);
    }
    return pattern;
  }

  private getExpectedPattern(category: string): number[] {
    // Return expected patterns based on category
    // These would typically be learned from historical data
    const patterns: Record<string, number[]> = {
      movement: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
      keystroke: [100, 120, 110, 130, 115, 125, 105, 135, 140, 120],
    };
    return patterns[category] || [];
  }

  /**
   * Get current adaptive thresholds
   */
  getAdaptiveThresholds(): Map<string, AdaptiveThreshold> {
    return new Map(this.adaptiveThresholds);
  }

  /**
   * Reset adaptive thresholds
   */
  resetAdaptiveThresholds(): void {
    this.adaptiveThresholds.clear();
    this.historicalData.clear();
    this.timeSeriesData.clear();
  }

  /**
   * Get anomaly detection statistics
   */
  getStats(): {
    adaptiveThresholdCount: number;
    historicalDataSize: number;
    timeSeriesDataSize: number;
  } {
    return {
      adaptiveThresholdCount: this.adaptiveThresholds.size,
      historicalDataSize: this.historicalData.size,
      timeSeriesDataSize: this.timeSeriesData.size,
    };
  }
}
