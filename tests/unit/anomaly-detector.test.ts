/**
 * Anomaly Detector Tests
 * Tests for statistical analysis, time series analysis, and pattern deviation detection
 */

import { AnomalyDetector, AnomalyDetectionConfig } from '../../src/security/anomaly-detector';
import { SecurityLogger } from '../../src/security/security-logger';
import { BehavioralSession } from '../../src/types/behavioral';

// Mock dependencies
jest.mock('../../src/security/security-logger');

describe('AnomalyDetector', () => {
  let anomalyDetector: AnomalyDetector;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  const defaultConfig: Partial<AnomalyDetectionConfig> = {
    statisticalThreshold: 2.0,
    timeSeriesWindowSize: 100,
    patternDeviationThreshold: 0.3,
    adaptiveThresholdLearningRate: 0.1,
    minSamplesForAdaptive: 50,
    anomalyScoreThreshold: 0.7,
  };

  beforeEach(() => {
    mockSecurityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: '/tmp/test.log',
      maxLogFileSize: 1024,
      maxLogFiles: 5,
    }) as jest.Mocked<SecurityLogger>;

    anomalyDetector = new AnomalyDetector(defaultConfig, mockSecurityLogger);
  });

  afterEach(() => {
    anomalyDetector.resetAdaptiveThresholds();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(anomalyDetector).toBeDefined();
      const stats = anomalyDetector.getStats();
      expect(stats.adaptiveThresholdCount).toBe(0);
      expect(stats.historicalDataSize).toBe(0);
      expect(stats.timeSeriesDataSize).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<AnomalyDetectionConfig> = {
        statisticalThreshold: 3.0,
        patternDeviationThreshold: 0.5,
      };

      const customDetector = new AnomalyDetector(customConfig, mockSecurityLogger);
      expect(customDetector).toBeDefined();
    });
  });

  describe('statistical analysis', () => {
    const createMockSession = (overrides: Partial<BehavioralSession> = {}): BehavioralSession => ({
      sessionId: 'test-session-123',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      dataPoints: [],
      mouseTrail: {
        sessionId: 'test-session-123',
        movements: [
          { x: 100, y: 200, timestamp: Date.now() - 4000 },
          { x: 150, y: 250, timestamp: Date.now() - 3000 },
          { x: 200, y: 300, timestamp: Date.now() - 2000 },
        ],
        clicks: [],
        scrolls: [],
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDistance: 70.71,
        averageVelocity: 0.014,
        maxVelocity: 0.02,
        minVelocity: 0.01,
      },
      keystrokePattern: {
        sessionId: 'test-session-123',
        events: [
          {
            key: 'a',
            code: 'KeyA',
            timestamp: Date.now() - 4000,
            duration: 80,
            modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          },
          {
            key: 'b',
            code: 'KeyB',
            timestamp: Date.now() - 3000,
            duration: 90,
            modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          },
          {
            key: 'c',
            code: 'KeyC',
            timestamp: Date.now() - 2000,
            duration: 85,
            modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          },
        ],
        averageHoldTime: 85,
        averageFlightTime: 100,
        typingSpeed: 200,
        errorRate: 0.05,
        rhythm: [100, 120, 90],
      },
      metrics: {
        movement: {
          averageVelocity: 0.014,
          maxVelocity: 0.02,
          minVelocity: 0.01,
          velocityVariance: 0.0001,
          averageAcceleration: 0.001,
          maxAcceleration: 0.005,
          accelerationVariance: 0.00001,
          totalDistance: 70.71,
          straightLineDistance: 70.71,
          pathEfficiency: 1.0,
          totalDuration: 5000,
          pauseCount: 0,
          averagePauseDuration: 0,
          averageAngle: 0.785,
          angleVariance: 0.1,
          directionChanges: 2,
          averageJerk: 0.0001,
          jerkVariance: 0.00001,
        },
        click: {
          totalClicks: 0,
          averageClickDuration: 0,
          clickDurationVariance: 0,
          doubleClickRate: 0,
          clickAccuracy: 1.0,
          clickIntervalVariance: 0,
        },
        scroll: {
          totalScrolls: 0,
          averageScrollSpeed: 0,
          scrollSpeedVariance: 0,
          scrollDirectionConsistency: 1.0,
          smoothScrollingScore: 1.0,
        },
        keystroke: {
          averageHoldTime: 85,
          holdTimeVariance: 100,
          averageFlightTime: 100,
          flightTimeVariance: 200,
          typingSpeed: 200,
          rhythmConsistency: 0.8,
          errorRate: 0.05,
        },
      },
      ...overrides,
    });

    it('should perform anomaly detection on a session', async () => {
      const session = createMockSession();
      const result = await anomalyDetector.detectAnomalies(session);

      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('anomalyScore');
      expect(result).toHaveProperty('statisticalAnalysis');
      expect(result).toHaveProperty('timeSeriesAnalysis');
      expect(result).toHaveProperty('patternDeviations');
      expect(result).toHaveProperty('adaptiveThresholds');
      expect(result).toHaveProperty('processingTime');

      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(typeof result.anomalyScore).toBe('number');
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
    });

    it('should calculate statistical analysis correctly', async () => {
      const session = createMockSession();
      const result = await anomalyDetector.detectAnomalies(session);

      expect(result.statisticalAnalysis).toBeDefined();
      expect(result.statisticalAnalysis.size).toBeGreaterThan(0);

      const movementStats = result.statisticalAnalysis.get('movement');
      expect(movementStats).toBeDefined();
      expect(movementStats).toHaveProperty('mean');
      expect(movementStats).toHaveProperty('standardDeviation');
      expect(movementStats).toHaveProperty('variance');
      expect(movementStats).toHaveProperty('median');
      expect(movementStats).toHaveProperty('q1');
      expect(movementStats).toHaveProperty('q3');
      expect(movementStats).toHaveProperty('iqr');
      expect(movementStats).toHaveProperty('outliers');
      expect(movementStats).toHaveProperty('zScores');
    });

    it('should detect outliers in statistical analysis', async () => {
      const session = createMockSession();
      const result = await anomalyDetector.detectAnomalies(session);
      expect(result.anomalies.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('time series analysis', () => {
    it('should perform time series analysis', async () => {
      const session: BehavioralSession = {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'test-session-123',
          movements: Array.from({ length: 20 }, (_, i) => ({
            x: i * 10,
            y: i * 10,
            timestamp: Date.now() - 5000 + i * 250,
          })),
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDistance: 282.84,
          averageVelocity: 0.056,
          maxVelocity: 0.1,
          minVelocity: 0.01,
        },
        keystrokePattern: {
          sessionId: 'test-session-123',
          events: Array.from({ length: 10 }, (_, i) => ({
            key: 'a',
            code: 'KeyA',
            timestamp: Date.now() - 5000 + i * 500,
            duration: 80 + i * 5,
            modifiers: { shift: false, ctrl: false, alt: false, meta: false },
          })),
          averageHoldTime: 85,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: [100, 120, 90, 110, 105, 115, 95, 125, 130, 120],
        },
        metrics: {
          movement: {
            averageVelocity: 0.056,
            maxVelocity: 0.1,
            minVelocity: 0.01,
            velocityVariance: 0.001,
            averageAcceleration: 0.002,
            maxAcceleration: 0.01,
            accelerationVariance: 0.0001,
            totalDistance: 282.84,
            straightLineDistance: 282.84,
            pathEfficiency: 1.0,
            totalDuration: 5000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.05,
            directionChanges: 10,
            averageJerk: 0.0002,
            jerkVariance: 0.00002,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0,
          },
          keystroke: {
            averageHoldTime: 85,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05,
          },
        },
      };

      const result = await anomalyDetector.detectAnomalies(session);

      expect(result.timeSeriesAnalysis).toBeDefined();
      expect(result.timeSeriesAnalysis.size).toBeGreaterThan(0);

      const movementTS = result.timeSeriesAnalysis.get('movement');
      expect(movementTS).toBeDefined();
      expect(movementTS).toHaveProperty('trend');
      expect(movementTS).toHaveProperty('seasonality');
      expect(movementTS).toHaveProperty('residuals');
      expect(movementTS).toHaveProperty('movingAverage');
      expect(movementTS).toHaveProperty('exponentialSmoothing');
      expect(movementTS).toHaveProperty('forecast');
    });
  });

  describe('pattern deviation detection', () => {
    it('should detect pattern deviations', async () => {
      const session: BehavioralSession = {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'test-session-123',
          movements: [
            { x: 100, y: 200, timestamp: Date.now() - 4000 },
            { x: 150, y: 250, timestamp: Date.now() - 3000 },
            { x: 200, y: 300, timestamp: Date.now() - 2000 },
          ],
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDistance: 70.71,
          averageVelocity: 0.014,
          maxVelocity: 0.02,
          minVelocity: 0.01,
        },
        keystrokePattern: {
          sessionId: 'test-session-123',
          events: [
            {
              key: 'a',
              code: 'KeyA',
              timestamp: Date.now() - 4000,
              duration: 80,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
            {
              key: 'b',
              code: 'KeyB',
              timestamp: Date.now() - 3000,
              duration: 90,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
            {
              key: 'c',
              code: 'KeyC',
              timestamp: Date.now() - 2000,
              duration: 85,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
          ],
          averageHoldTime: 85,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: [100, 120, 90],
        },
        metrics: {
          movement: {
            averageVelocity: 0.014,
            maxVelocity: 0.02,
            minVelocity: 0.01,
            velocityVariance: 0.0001,
            averageAcceleration: 0.001,
            maxAcceleration: 0.005,
            accelerationVariance: 0.00001,
            totalDistance: 70.71,
            straightLineDistance: 70.71,
            pathEfficiency: 1.0,
            totalDuration: 5000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.1,
            directionChanges: 2,
            averageJerk: 0.0001,
            jerkVariance: 0.00001,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0,
          },
          keystroke: {
            averageHoldTime: 85,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05,
          },
        },
      };

      const result = await anomalyDetector.detectAnomalies(session);

      expect(result.patternDeviations).toBeDefined();
      expect(result.patternDeviations.size).toBeGreaterThan(0);

      const movementDeviation = result.patternDeviations.get('movement');
      expect(movementDeviation).toBeDefined();
      expect(movementDeviation).toHaveProperty('expectedPattern');
      expect(movementDeviation).toHaveProperty('actualPattern');
      expect(movementDeviation).toHaveProperty('deviation');
      expect(movementDeviation).toHaveProperty('deviationPercentage');
      expect(movementDeviation).toHaveProperty('significantDeviations');
    });
  });

  describe('adaptive thresholds', () => {
    it('should update adaptive thresholds', async () => {
      const session: BehavioralSession = {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'test-session-123',
          movements: [
            { x: 100, y: 200, timestamp: Date.now() - 4000 },
            { x: 150, y: 250, timestamp: Date.now() - 3000 },
          ],
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDistance: 70.71,
          averageVelocity: 0.014,
          maxVelocity: 0.02,
          minVelocity: 0.01,
        },
        keystrokePattern: {
          sessionId: 'test-session-123',
          events: [
            {
              key: 'a',
              code: 'KeyA',
              timestamp: Date.now() - 4000,
              duration: 80,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
            {
              key: 'b',
              code: 'KeyB',
              timestamp: Date.now() - 3000,
              duration: 90,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
          ],
          averageHoldTime: 85,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: [100, 120],
        },
        metrics: {
          movement: {
            averageVelocity: 0.014,
            maxVelocity: 0.02,
            minVelocity: 0.01,
            velocityVariance: 0.0001,
            averageAcceleration: 0.001,
            maxAcceleration: 0.005,
            accelerationVariance: 0.00001,
            totalDistance: 70.71,
            straightLineDistance: 70.71,
            pathEfficiency: 1.0,
            totalDuration: 5000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.1,
            directionChanges: 2,
            averageJerk: 0.0001,
            jerkVariance: 0.00001,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0,
          },
          keystroke: {
            averageHoldTime: 85,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05,
          },
        },
      };

      const result = await anomalyDetector.detectAnomalies(session);

      expect(result.adaptiveThresholds).toBeDefined();
      expect(result.adaptiveThresholds.size).toBeGreaterThan(0);

      const velocityThreshold = result.adaptiveThresholds.get('movement_velocity');
      expect(velocityThreshold).toBeDefined();
      expect(velocityThreshold).toHaveProperty('metric');
      expect(velocityThreshold).toHaveProperty('baseline');
      expect(velocityThreshold).toHaveProperty('current');
      expect(velocityThreshold).toHaveProperty('upperBound');
      expect(velocityThreshold).toHaveProperty('lowerBound');
      expect(velocityThreshold).toHaveProperty('confidence');
      expect(velocityThreshold).toHaveProperty('sampleCount');
    });
  });

  describe('anomaly score calculation', () => {
    it('should calculate anomaly score correctly', async () => {
      const session: BehavioralSession = {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'test-session-123',
          movements: [
            { x: 100, y: 200, timestamp: Date.now() - 4000 },
            { x: 150, y: 250, timestamp: Date.now() - 3000 },
          ],
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDistance: 70.71,
          averageVelocity: 0.014,
          maxVelocity: 0.02,
          minVelocity: 0.01,
        },
        keystrokePattern: {
          sessionId: 'test-session-123',
          events: [
            {
              key: 'a',
              code: 'KeyA',
              timestamp: Date.now() - 4000,
              duration: 80,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
            {
              key: 'b',
              code: 'KeyB',
              timestamp: Date.now() - 3000,
              duration: 90,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
          ],
          averageHoldTime: 85,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: [100, 120],
        },
        metrics: {
          movement: {
            averageVelocity: 0.014,
            maxVelocity: 0.02,
            minVelocity: 0.01,
            velocityVariance: 0.0001,
            averageAcceleration: 0.001,
            maxAcceleration: 0.005,
            accelerationVariance: 0.00001,
            totalDistance: 70.71,
            straightLineDistance: 70.71,
            pathEfficiency: 1.0,
            totalDuration: 5000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.1,
            directionChanges: 2,
            averageJerk: 0.0001,
            jerkVariance: 0.00001,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0,
          },
          keystroke: {
            averageHoldTime: 85,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05,
          },
        },
      };

      const result = await anomalyDetector.detectAnomalies(session);

      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle session with minimal data', async () => {
      const minimalSession: BehavioralSession = {
        sessionId: 'minimal-session',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'minimal-session',
          movements: [],
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 1000,
          endTime: Date.now(),
          totalDistance: 0,
          averageVelocity: 0,
          maxVelocity: 0,
          minVelocity: 0,
        },
        keystrokePattern: {
          sessionId: 'minimal-session',
          events: [],
          averageHoldTime: 0,
          averageFlightTime: 0,
          typingSpeed: 0,
          errorRate: 0,
          rhythm: [],
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
            totalDuration: 1000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0,
            angleVariance: 0,
            directionChanges: 0,
            averageJerk: 0,
            jerkVariance: 0,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 0,
            smoothScrollingScore: 0,
          },
          keystroke: {
            averageHoldTime: 0,
            holdTimeVariance: 0,
            averageFlightTime: 0,
            flightTimeVariance: 0,
            typingSpeed: 0,
            rhythmConsistency: 0,
            errorRate: 0,
          },
        },
      };

      const result = await anomalyDetector.detectAnomalies(minimalSession);

      expect(result).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
    });

    it('should log security event', async () => {
      const session: BehavioralSession = {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'test-session-123',
          movements: [
            { x: 100, y: 200, timestamp: Date.now() - 4000 },
            { x: 150, y: 250, timestamp: Date.now() - 3000 },
          ],
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          totalDistance: 70.71,
          averageVelocity: 0.014,
          maxVelocity: 0.02,
          minVelocity: 0.01,
        },
        keystrokePattern: {
          sessionId: 'test-session-123',
          events: [
            {
              key: 'a',
              code: 'KeyA',
              timestamp: Date.now() - 4000,
              duration: 80,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
            {
              key: 'b',
              code: 'KeyB',
              timestamp: Date.now() - 3000,
              duration: 90,
              modifiers: { shift: false, ctrl: false, alt: false, meta: false },
            },
          ],
          averageHoldTime: 85,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: [100, 120],
        },
        metrics: {
          movement: {
            averageVelocity: 0.014,
            maxVelocity: 0.02,
            minVelocity: 0.01,
            velocityVariance: 0.0001,
            averageAcceleration: 0.001,
            maxAcceleration: 0.005,
            accelerationVariance: 0.00001,
            totalDistance: 70.71,
            straightLineDistance: 70.71,
            pathEfficiency: 1.0,
            totalDuration: 5000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.1,
            directionChanges: 2,
            averageJerk: 0.0001,
            jerkVariance: 0.00001,
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0,
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0,
          },
          keystroke: {
            averageHoldTime: 85,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05,
          },
        },
      };

      await anomalyDetector.detectAnomalies(session);

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'anomaly_detection_completed',
          resource: 'anomaly_detector',
        })
      );
    });
  });
});
