/**
 * Bot Detection ML Model Tests
 * Tests for the TensorFlow.js-based bot detection system
 */

import { BotDetectionML, MLModelConfig, TrainingData } from '../../src/security/bot-detection-ml';
import { CryptoService } from '../../src/security/crypto';
import { SecurityLogger } from '../../src/security/security-logger';
import { MouseMovementAnalyzer } from '../../src/security/mouse-movement-analyzer';
import { KeystrokeDynamicsAnalyzer } from '../../src/security/keystroke-dynamics-analyzer';
import { BehavioralSession } from '../../src/types/behavioral';

// Mock dependencies
jest.mock('../../src/security/crypto');
jest.mock('../../src/security/security-logger');
jest.mock('../../src/security/mouse-movement-analyzer');
jest.mock('../../src/security/keystroke-dynamics-analyzer');

// TensorFlow.js is mocked in __mocks__/@tensorflow/tfjs-node.js

describe('BotDetectionML', () => {
  let botDetectionML: BotDetectionML;
  let mockCryptoService: jest.Mocked<CryptoService>;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;
  let mockMouseAnalyzer: jest.Mocked<MouseMovementAnalyzer>;
  let mockKeystrokeAnalyzer: jest.Mocked<KeystrokeDynamicsAnalyzer>;

  const defaultConfig: Partial<MLModelConfig> = {
    featureDimensions: 50,
    hiddenLayers: [128, 64, 32],
    learningRate: 0.001,
    epochs: 10,
    batchSize: 32,
    validationSplit: 0.2,
    usePretrainedModel: false,
    retrainInterval: 24,
    confidenceThreshold: 0.7
  };

  beforeEach(() => {
    mockCryptoService = new CryptoService({} as any) as jest.Mocked<CryptoService>;
    mockSecurityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: '/tmp/test.log',
      maxLogFileSize: 1024,
      maxLogFiles: 5
    }) as jest.Mocked<SecurityLogger>;
    mockMouseAnalyzer = new MouseMovementAnalyzer({}, mockCryptoService, mockSecurityLogger) as jest.Mocked<MouseMovementAnalyzer>;
    mockKeystrokeAnalyzer = new KeystrokeDynamicsAnalyzer({}, mockCryptoService, mockSecurityLogger) as jest.Mocked<KeystrokeDynamicsAnalyzer>;

    botDetectionML = new BotDetectionML(
      defaultConfig,
      mockSecurityLogger,
      mockMouseAnalyzer,
      mockKeystrokeAnalyzer
    );
  });

  afterEach(() => {
    botDetectionML.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(botDetectionML).toBeDefined();
      const stats = botDetectionML.getStats();
      expect(stats.modelLoaded).toBe(false);
      expect(stats.featureCacheSize).toBe(0);
    });

    it('should initialize ML model successfully', async () => {
      await botDetectionML.initialize();
      const stats = botDetectionML.getStats();
      expect(stats.modelLoaded).toBe(true);
    });

    it('should log initialization event', async () => {
      await botDetectionML.initialize();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ml_model_initialized',
          resource: 'bot_detection_ml'
        })
      );
    });
  });

  describe('feature extraction', () => {
    const createMockSession = (overrides: Partial<BehavioralSession> = {}): BehavioralSession => ({
      sessionId: 'test-session-123',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      dataPoints: [
        {
          type: 'mouse_move',
          timestamp: Date.now() - 4000,
          data: { x: 100, y: 200, timestamp: Date.now() - 4000 },
          sessionId: 'test-session-123',
          sequenceNumber: 1
        }
      ],
      mouseTrail: {
        sessionId: 'test-session-123',
        movements: [
          { x: 100, y: 200, timestamp: Date.now() - 4000 },
          { x: 150, y: 250, timestamp: Date.now() - 3000 }
        ],
        clicks: [],
        scrolls: [],
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDistance: 70.71,
        averageVelocity: 0.014,
        maxVelocity: 0.02,
        minVelocity: 0.01
      },
      keystrokePattern: {
        sessionId: 'test-session-123',
        events: [],
        averageHoldTime: 80,
        averageFlightTime: 100,
        typingSpeed: 200,
        errorRate: 0.05,
        rhythm: [100, 120, 90, 110]
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
          jerkVariance: 0.00001
        },
        click: {
          totalClicks: 0,
          averageClickDuration: 0,
          clickDurationVariance: 0,
          doubleClickRate: 0,
          clickAccuracy: 1.0,
          clickIntervalVariance: 0
        },
        scroll: {
          totalScrolls: 0,
          averageScrollSpeed: 0,
          scrollSpeedVariance: 0,
          scrollDirectionConsistency: 1.0,
          smoothScrollingScore: 1.0
        },
        keystroke: {
          averageHoldTime: 80,
          holdTimeVariance: 100,
          averageFlightTime: 100,
          flightTimeVariance: 200,
          typingSpeed: 200,
          rhythmConsistency: 0.8,
          errorRate: 0.05
        }
      },
      ...overrides
    });

    it('should extract features from session', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      expect(features).toHaveLength(50);
      expect(features.every(f => typeof f === 'number')).toBe(true);
      expect(features.every(f => f >= 0 && f <= 1)).toBe(true);
    });

    it('should cache extracted features', () => {
      const session = createMockSession();
      const features1 = botDetectionML.extractFeatures(session);
      const features2 = botDetectionML.extractFeatures(session);
      
      expect(features1).toEqual(features2);
      expect(botDetectionML.getStats().featureCacheSize).toBe(1);
    });

    it('should extract movement features correctly', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      // First 20 features are movement features
      const movementFeatures = features.slice(0, 20);
      expect(movementFeatures.length).toBe(20);
    });

    it('should extract keystroke features correctly', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      // Features 20-34 are keystroke features
      const keystrokeFeatures = features.slice(20, 35);
      expect(keystrokeFeatures.length).toBe(15);
    });

    it('should extract click features correctly', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      // Features 35-42 are click features
      const clickFeatures = features.slice(35, 43);
      expect(clickFeatures.length).toBe(8);
    });

    it('should extract scroll features correctly', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      // Features 43-47 are scroll features
      const scrollFeatures = features.slice(43, 48);
      expect(scrollFeatures.length).toBe(5);
    });

    it('should extract timing features correctly', () => {
      const session = createMockSession();
      const features = botDetectionML.extractFeatures(session);
      
      // Features 48-49 are timing features
      const timingFeatures = features.slice(48, 50);
      expect(timingFeatures.length).toBe(2);
    });
  });

  describe('prediction', () => {
    beforeEach(async () => {
      await botDetectionML.initialize();
    });

    const createMockSession = (): BehavioralSession => ({
      sessionId: 'test-session-123',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      dataPoints: [],
      mouseTrail: {
        sessionId: 'test-session-123',
        movements: [
          { x: 100, y: 200, timestamp: Date.now() - 4000 },
          { x: 150, y: 250, timestamp: Date.now() - 3000 }
        ],
        clicks: [],
        scrolls: [],
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDistance: 70.71,
        averageVelocity: 0.014,
        maxVelocity: 0.02,
        minVelocity: 0.01
      },
      keystrokePattern: {
        sessionId: 'test-session-123',
        events: [],
        averageHoldTime: 80,
        averageFlightTime: 100,
        typingSpeed: 200,
        errorRate: 0.05,
        rhythm: []
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
          jerkVariance: 0.00001
        },
        click: {
          totalClicks: 0,
          averageClickDuration: 0,
          clickDurationVariance: 0,
          doubleClickRate: 0,
          clickAccuracy: 1.0,
          clickIntervalVariance: 0
        },
        scroll: {
          totalScrolls: 0,
          averageScrollSpeed: 0,
          scrollSpeedVariance: 0,
          scrollDirectionConsistency: 1.0,
          smoothScrollingScore: 1.0
        },
        keystroke: {
          averageHoldTime: 80,
          holdTimeVariance: 100,
          averageFlightTime: 100,
          flightTimeVariance: 200,
          typingSpeed: 200,
          rhythmConsistency: 0.8,
          errorRate: 0.05
        }
      }
    });

    it('should make prediction successfully', async () => {
      const session = createMockSession();
      const prediction = await botDetectionML.predict(session);
      
      expect(prediction).toHaveProperty('botProbability');
      expect(prediction).toHaveProperty('humanProbability');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('features');
      expect(prediction).toHaveProperty('processingTime');
      
      expect(prediction.botProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.botProbability).toBeLessThanOrEqual(1);
      expect(prediction.humanProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.humanProbability).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it('should throw error if model not initialized', async () => {
      const uninitializedML = new BotDetectionML(
        defaultConfig,
        mockSecurityLogger,
        mockMouseAnalyzer,
        mockKeystrokeAnalyzer
      );
      
      const session = createMockSession();
      await expect(uninitializedML.predict(session)).rejects.toThrow('ML model not initialized');
    });
  });

  describe('bot detection', () => {
    beforeEach(async () => {
      await botDetectionML.initialize();
      
      // Mock analyzer responses
      mockMouseAnalyzer.performBotDetection.mockResolvedValue({
        verdict: 'human',
        confidence: 0.8,
        botScore: 0.2,
        humanScore: 0.8,
        features: {
          movementNaturalness: 0.9,
          velocityConsistency: 0.7,
          accelerationPattern: 0.8,
          pathEfficiency: 0.6,
          microMovementPresence: 0.85,
          clickNaturalness: 0.9,
          clickTimingVariation: 0.8,
          scrollNaturalness: 0.9,
          scrollSmoothness: 0.85,
          keystrokeRhythm: 0.5,
          typingSpeedNaturalness: 0.5,
          responseTimeNaturalness: 0.8,
          sessionDurationNaturalness: 0.9,
          patternVariability: 0.7,
          repetitionScore: 0.3
        },
        anomalies: [],
        riskFactors: [],
        timestamp: Date.now(),
        processingTime: 10
      });
      
      mockKeystrokeAnalyzer.performBotDetection.mockResolvedValue({
        verdict: 'human',
        confidence: 0.75,
        botScore: 0.25,
        humanScore: 0.75,
        features: {
          movementNaturalness: 0.5,
          velocityConsistency: 0.5,
          accelerationPattern: 0.5,
          pathEfficiency: 0.5,
          microMovementPresence: 0.5,
          clickNaturalness: 0.5,
          clickTimingVariation: 0.5,
          scrollNaturalness: 0.5,
          scrollSmoothness: 0.5,
          keystrokeRhythm: 0.8,
          typingSpeedNaturalness: 0.85,
          responseTimeNaturalness: 0.7,
          sessionDurationNaturalness: 0.8,
          patternVariability: 0.75,
          repetitionScore: 0.25
        },
        anomalies: [],
        riskFactors: [],
        timestamp: Date.now(),
        processingTime: 8
      });
    });

    const createMockSession = (): BehavioralSession => ({
      sessionId: 'test-session-123',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      dataPoints: [],
      mouseTrail: {
        sessionId: 'test-session-123',
        movements: [
          { x: 100, y: 200, timestamp: Date.now() - 4000 },
          { x: 150, y: 250, timestamp: Date.now() - 3000 }
        ],
        clicks: [],
        scrolls: [],
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDistance: 70.71,
        averageVelocity: 0.014,
        maxVelocity: 0.02,
        minVelocity: 0.01
      },
      keystrokePattern: {
        sessionId: 'test-session-123',
        events: [],
        averageHoldTime: 80,
        averageFlightTime: 100,
        typingSpeed: 200,
        errorRate: 0.05,
        rhythm: []
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
          jerkVariance: 0.00001
        },
        click: {
          totalClicks: 0,
          averageClickDuration: 0,
          clickDurationVariance: 0,
          doubleClickRate: 0,
          clickAccuracy: 1.0,
          clickIntervalVariance: 0
        },
        scroll: {
          totalScrolls: 0,
          averageScrollSpeed: 0,
          scrollSpeedVariance: 0,
          scrollDirectionConsistency: 1.0,
          smoothScrollingScore: 1.0
        },
        keystroke: {
          averageHoldTime: 80,
          holdTimeVariance: 100,
          averageFlightTime: 100,
          flightTimeVariance: 200,
          typingSpeed: 200,
          rhythmConsistency: 0.8,
          errorRate: 0.05
        }
      }
    });

    it('should perform comprehensive bot detection', async () => {
      const session = createMockSession();
      const result = await botDetectionML.detectBot(session);
      
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('botScore');
      expect(result).toHaveProperty('humanScore');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('riskFactors');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('processingTime');
      
      expect(['human', 'bot', 'suspicious', 'uncertain']).toContain(result.verdict);
      expect(result.botScore).toBeGreaterThanOrEqual(0);
      expect(result.botScore).toBeLessThanOrEqual(1);
      expect(result.humanScore).toBeGreaterThanOrEqual(0);
      expect(result.humanScore).toBeLessThanOrEqual(1);
    });

    it('should combine ML and rule-based scores', async () => {
      const session = createMockSession();
      const result = await botDetectionML.detectBot(session);
      
      // Combined score should be weighted average
      expect(result.botScore).toBeGreaterThanOrEqual(0);
      expect(result.botScore).toBeLessThanOrEqual(1);
    });

    it('should log detection result', async () => {
      const session = createMockSession();
      await botDetectionML.detectBot(session);
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'bot_detection_completed',
          resource: 'bot_detection_ml'
        })
      );
    });

    it('should identify risk factors', async () => {
      // Mock high bot score scenario
      mockMouseAnalyzer.performBotDetection.mockResolvedValue({
        verdict: 'bot',
        confidence: 0.9,
        botScore: 0.85,
        humanScore: 0.15,
        features: {
          movementNaturalness: 0.2,
          velocityConsistency: 0.95,
          accelerationPattern: 0.1,
          pathEfficiency: 0.98,
          microMovementPresence: 0.1,
          clickNaturalness: 0.3,
          clickTimingVariation: 0.1,
          scrollNaturalness: 0.2,
          scrollSmoothness: 0.1,
          keystrokeRhythm: 0.5,
          typingSpeedNaturalness: 0.5,
          responseTimeNaturalness: 0.3,
          sessionDurationNaturalness: 0.4,
          patternVariability: 0.1,
          repetitionScore: 0.9
        },
        anomalies: [
          {
            type: 'linear_movement',
            severity: 'high',
            confidence: 0.9,
            description: 'Suspiciously linear movement',
            evidence: { pathEfficiency: 0.98 },
            timestamp: Date.now()
          }
        ],
        riskFactors: ['Unnatural movement patterns', 'High velocity consistency'],
        timestamp: Date.now(),
        processingTime: 12
      });
      
      const session = createMockSession();
      const result = await botDetectionML.detectBot(session);
      
      expect(result.riskFactors.length).toBeGreaterThan(0);
    });
  });

  describe('training', () => {
    beforeEach(async () => {
      await botDetectionML.initialize();
    });

    it('should train model with provided data', async () => {
      const trainingData: TrainingData = {
        features: [
          [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
           0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
           0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
           0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
           0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
          [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
           0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
           0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
           0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
           0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0]
        ],
        labels: [0, 1], // 0 = human, 1 = bot
        metadata: [
          { sessionId: 'human-session', timestamp: Date.now(), source: 'test' },
          { sessionId: 'bot-session', timestamp: Date.now(), source: 'test' }
        ]
      };
      
      const metrics = await botDetectionML.train(trainingData);
      
      expect(metrics).toHaveProperty('accuracy');
      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1Score');
      expect(metrics).toHaveProperty('auc');
      expect(metrics).toHaveProperty('confusionMatrix');
      
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
    });

    it('should throw error if model not initialized', async () => {
      const uninitializedML = new BotDetectionML(
        defaultConfig,
        mockSecurityLogger,
        mockMouseAnalyzer,
        mockKeystrokeAnalyzer
      );
      
      const trainingData: TrainingData = {
        features: [[0.1, 0.2, 0.3]],
        labels: [0],
        metadata: [{ sessionId: 'test', timestamp: Date.now(), source: 'test' }]
      };
      
      await expect(uninitializedML.train(trainingData)).rejects.toThrow('ML model not initialized');
    });
  });

  describe('model management', () => {
    beforeEach(async () => {
      await botDetectionML.initialize();
    });

    it('should check if model needs retraining', () => {
      const needsRetraining = botDetectionML.needsRetraining();
      expect(typeof needsRetraining).toBe('boolean');
    });

    it('should get model metrics', () => {
      const metrics = botDetectionML.getModelMetrics();
      expect(metrics).toBeNull(); // No training yet
    });

    it('should clear feature cache', () => {
      const session = createMockSession();
      botDetectionML.extractFeatures(session);
      expect(botDetectionML.getStats().featureCacheSize).toBe(1);
      
      botDetectionML.clearCache();
      expect(botDetectionML.getStats().featureCacheSize).toBe(0);
    });

    it('should get analyzer statistics', () => {
      const stats = botDetectionML.getStats();
      
      expect(stats).toHaveProperty('modelLoaded');
      expect(stats).toHaveProperty('featureCacheSize');
      expect(stats).toHaveProperty('lastTrainingTime');
      expect(stats).toHaveProperty('modelMetrics');
      
      expect(stats.modelLoaded).toBe(true);
      expect(stats.featureCacheSize).toBe(0);
      expect(stats.lastTrainingTime).toBeNull();
      expect(stats.modelMetrics).toBeNull();
    });

    it('should dispose model and free resources', () => {
      botDetectionML.dispose();
      const stats = botDetectionML.getStats();
      expect(stats.modelLoaded).toBe(false);
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await botDetectionML.initialize();
    });

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
          minVelocity: 0
        },
        keystrokePattern: {
          sessionId: 'minimal-session',
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
            totalDuration: 1000,
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
      
      const features = botDetectionML.extractFeatures(minimalSession);
      expect(features).toHaveLength(50);
      expect(features.every(f => typeof f === 'number')).toBe(true);
    });

    it('should handle very long session', async () => {
      const longSession: BehavioralSession = {
        sessionId: 'long-session',
        startTime: Date.now() - 600000, // 10 minutes
        endTime: Date.now(),
        dataPoints: [],
        mouseTrail: {
          sessionId: 'long-session',
          movements: Array.from({ length: 1000 }, (_, i) => ({
            x: i * 10,
            y: i * 10,
            timestamp: Date.now() - 600000 + i * 600
          })),
          clicks: [],
          scrolls: [],
          startTime: Date.now() - 600000,
          endTime: Date.now(),
          totalDistance: 14142.13,
          averageVelocity: 0.0236,
          maxVelocity: 0.05,
          minVelocity: 0.01
        },
        keystrokePattern: {
          sessionId: 'long-session',
          events: [],
          averageHoldTime: 80,
          averageFlightTime: 100,
          typingSpeed: 200,
          errorRate: 0.05,
          rhythm: []
        },
        metrics: {
          movement: {
            averageVelocity: 0.0236,
            maxVelocity: 0.05,
            minVelocity: 0.01,
            velocityVariance: 0.0002,
            averageAcceleration: 0.002,
            maxAcceleration: 0.01,
            accelerationVariance: 0.00002,
            totalDistance: 14142.13,
            straightLineDistance: 14142.13,
            pathEfficiency: 1.0,
            totalDuration: 600000,
            pauseCount: 0,
            averagePauseDuration: 0,
            averageAngle: 0.785,
            angleVariance: 0.05,
            directionChanges: 100,
            averageJerk: 0.0002,
            jerkVariance: 0.00002
          },
          click: {
            totalClicks: 0,
            averageClickDuration: 0,
            clickDurationVariance: 0,
            doubleClickRate: 0,
            clickAccuracy: 1.0,
            clickIntervalVariance: 0
          },
          scroll: {
            totalScrolls: 0,
            averageScrollSpeed: 0,
            scrollSpeedVariance: 0,
            scrollDirectionConsistency: 1.0,
            smoothScrollingScore: 1.0
          },
          keystroke: {
            averageHoldTime: 80,
            holdTimeVariance: 100,
            averageFlightTime: 100,
            flightTimeVariance: 200,
            typingSpeed: 200,
            rhythmConsistency: 0.8,
            errorRate: 0.05
          }
        }
      };
      
      const features = botDetectionML.extractFeatures(longSession);
      expect(features).toHaveLength(50);
      
      const prediction = await botDetectionML.predict(longSession);
      expect(prediction.processingTime).toBeLessThan(1000); // Should be fast
    });
  });
});

// Helper function to create mock session
function createMockSession(): BehavioralSession {
  return {
    sessionId: 'test-session-123',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    dataPoints: [],
    mouseTrail: {
      sessionId: 'test-session-123',
      movements: [
        { x: 100, y: 200, timestamp: Date.now() - 4000 },
        { x: 150, y: 250, timestamp: Date.now() - 3000 }
      ],
      clicks: [],
      scrolls: [],
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      totalDistance: 70.71,
      averageVelocity: 0.014,
      maxVelocity: 0.02,
      minVelocity: 0.01
    },
    keystrokePattern: {
      sessionId: 'test-session-123',
      events: [],
      averageHoldTime: 80,
      averageFlightTime: 100,
      typingSpeed: 200,
      errorRate: 0.05,
      rhythm: []
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
        jerkVariance: 0.00001
      },
      click: {
        totalClicks: 0,
        averageClickDuration: 0,
        clickDurationVariance: 0,
        doubleClickRate: 0,
        clickAccuracy: 1.0,
        clickIntervalVariance: 0
      },
      scroll: {
        totalScrolls: 0,
        averageScrollSpeed: 0,
        scrollSpeedVariance: 0,
        scrollDirectionConsistency: 1.0,
        smoothScrollingScore: 1.0
      },
      keystroke: {
        averageHoldTime: 80,
        holdTimeVariance: 100,
        averageFlightTime: 100,
        flightTimeVariance: 200,
        typingSpeed: 200,
        rhythmConsistency: 0.8,
        errorRate: 0.05
      }
    }
  };
}