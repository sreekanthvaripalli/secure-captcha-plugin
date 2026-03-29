/**
 * Bot Detection ML Model Service
 * Uses TensorFlow.js for machine learning-based bot detection
 */

import * as tf from '@tensorflow/tfjs-node';
import { SecurityLogger } from './security-logger';
import { MouseMovementAnalyzer } from './mouse-movement-analyzer';
import { KeystrokeDynamicsAnalyzer } from './keystroke-dynamics-analyzer';
import {
  BehavioralSession,
  BotDetectionResult,
  BotDetectionVerdict,
  BotDetectionFeatures,
  Anomaly,
  MovementMetrics,
  KeystrokeMetrics,
} from '../types/behavioral';

export interface MLModelConfig {
  modelPath?: string;
  featureDimensions: number;
  hiddenLayers: number[];
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
  usePretrainedModel: boolean;
  retrainInterval: number; // hours
  confidenceThreshold: number;
}

export interface TrainingData {
  features: number[][];
  labels: number[]; // 0 = human, 1 = bot
  metadata: {
    sessionId: string;
    timestamp: number;
    source: string;
  }[];
}

export interface ModelPrediction {
  botProbability: number;
  humanProbability: number;
  confidence: number;
  features: number[];
  processingTime: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix: number[][];
}

export class BotDetectionML {
  private model: tf.LayersModel | null = null;
  private readonly config: MLModelConfig;
  private readonly securityLogger: SecurityLogger;
  private readonly mouseAnalyzer: MouseMovementAnalyzer;
  private readonly keystrokeAnalyzer: KeystrokeDynamicsAnalyzer;
  private readonly featureCache: Map<string, number[]> = new Map();
  private lastTrainingTime: number = 0;
  private modelMetrics: ModelMetrics | null = null;

  constructor(
    config: Partial<MLModelConfig>,
    securityLogger: SecurityLogger,
    mouseAnalyzer: MouseMovementAnalyzer,
    keystrokeAnalyzer: KeystrokeDynamicsAnalyzer
  ) {
    this.config = {
      modelPath: undefined,
      featureDimensions: 50,
      hiddenLayers: [128, 64, 32],
      learningRate: 0.001,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      usePretrainedModel: false,
      retrainInterval: 24,
      confidenceThreshold: 0.7,
      ...config,
    };

    this.securityLogger = securityLogger;
    this.mouseAnalyzer = mouseAnalyzer;
    this.keystrokeAnalyzer = keystrokeAnalyzer;
  }

  /**
   * Initialize the ML model
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.usePretrainedModel && this.config.modelPath) {
        await this.loadPretrainedModel();
      } else {
        await this.buildModel();
      }

      this.securityLogger.logSecurityEvent({
        action: 'ml_model_initialized',
        resource: 'bot_detection_ml',
        reason: 'ML model initialized successfully',
        metadata: {
          modelPath: this.config.modelPath,
          featureDimensions: this.config.featureDimensions,
          hiddenLayers: this.config.hiddenLayers,
        },
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        action: 'ml_model_initialization_failed',
        resource: 'bot_detection_ml',
        reason: `Failed to initialize ML model: ${error}`,
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Load pretrained model from file
   */
  private async loadPretrainedModel(): Promise<void> {
    if (!this.config.modelPath) {
      throw new Error('Model path not configured');
    }

    try {
      this.model = await tf.loadLayersModel(`file://${this.config.modelPath}/model.json`);
      this.securityLogger.logSecurityEvent({
        action: 'pretrained_model_loaded',
        resource: 'bot_detection_ml',
        reason: 'Pretrained model loaded successfully',
        metadata: { modelPath: this.config.modelPath },
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        action: 'pretrained_model_load_failed',
        resource: 'bot_detection_ml',
        reason: `Failed to load pretrained model: ${error}`,
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Build neural network model
   */
  private async buildModel(): Promise<void> {
    const model = tf.sequential();

    // Input layer
    model.add(
      tf.layers.dense({
        units: this.config.hiddenLayers[0],
        activation: 'relu',
        inputShape: [this.config.featureDimensions],
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      })
    );

    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(
        tf.layers.dense({
          units: this.config.hiddenLayers[i],
          activation: 'relu',
          kernelInitializer: 'heNormal',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        })
      );

      model.add(tf.layers.batchNormalization());
      model.add(tf.layers.dropout({ rate: 0.2 }));
    }

    // Output layer (binary classification: human vs bot)
    model.add(
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
      })
    );

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
  }

  /**
   * Extract features from behavioral session
   */
  extractFeatures(session: BehavioralSession): number[] {
    const cacheKey = session.sessionId;

    // Check cache
    if (this.featureCache.has(cacheKey)) {
      return this.featureCache.get(cacheKey)!;
    }

    const features: number[] = [];

    // Movement features (20 features)
    const movementFeatures = this.extractMovementFeatures(session.metrics.movement);
    features.push(...movementFeatures);

    // Keystroke features (15 features)
    const keystrokeFeatures = this.extractKeystrokeFeatures(session.metrics.keystroke);
    features.push(...keystrokeFeatures);

    // Click features (8 features)
    const clickFeatures = this.extractClickFeatures(session.metrics.click);
    features.push(...clickFeatures);

    // Scroll features (5 features)
    const scrollFeatures = this.extractScrollFeatures(session.metrics.scroll);
    features.push(...scrollFeatures);

    // Timing features (2 features)
    const timingFeatures = this.extractTimingFeatures(session);
    features.push(...timingFeatures);

    // Pad or truncate to match expected dimensions
    while (features.length < this.config.featureDimensions) {
      features.push(0);
    }

    const normalizedFeatures = features.slice(0, this.config.featureDimensions);

    // Cache features
    this.featureCache.set(cacheKey, normalizedFeatures);

    return normalizedFeatures;
  }

  /**
   * Extract movement-related features
   */
  private extractMovementFeatures(metrics: MovementMetrics): number[] {
    return [
      // Velocity features
      this.normalizeValue(metrics.averageVelocity, 0, 5),
      this.normalizeValue(metrics.maxVelocity, 0, 10),
      this.normalizeValue(metrics.minVelocity, 0, 5),
      this.normalizeValue(metrics.velocityVariance, 0, 1),

      // Acceleration features
      this.normalizeValue(metrics.averageAcceleration, -5, 5),
      this.normalizeValue(metrics.maxAcceleration, 0, 20),
      this.normalizeValue(metrics.accelerationVariance, 0, 1),

      // Path features
      this.normalizeValue(metrics.totalDistance, 0, 5000),
      this.normalizeValue(metrics.straightLineDistance, 0, 2000),
      metrics.pathEfficiency, // Already 0-1

      // Timing features
      this.normalizeValue(metrics.totalDuration, 0, 60000),
      this.normalizeValue(metrics.pauseCount, 0, 50),
      this.normalizeValue(metrics.averagePauseDuration, 0, 2000),

      // Angle features
      this.normalizeValue(metrics.averageAngle, -Math.PI, Math.PI),
      this.normalizeValue(metrics.angleVariance, 0, 1),
      this.normalizeValue(metrics.directionChanges, 0, 100),

      // Jerk features
      this.normalizeValue(metrics.averageJerk, -10, 10),
      this.normalizeValue(metrics.jerkVariance, 0, 1),

      // Derived features
      metrics.pathEfficiency > 0.95 ? 1 : 0, // Suspiciously linear
      metrics.velocityVariance < 0.001 ? 1 : 0, // No velocity variation
    ];
  }

  /**
   * Extract keystroke-related features
   */
  private extractKeystrokeFeatures(metrics: KeystrokeMetrics): number[] {
    return [
      // Hold time features
      this.normalizeValue(metrics.averageHoldTime, 0, 500),
      this.normalizeValue(metrics.holdTimeVariance, 0, 10000),

      // Flight time features
      this.normalizeValue(metrics.averageFlightTime, 0, 1000),
      this.normalizeValue(metrics.flightTimeVariance, 0, 100000),

      // Typing features
      this.normalizeValue(metrics.typingSpeed, 0, 1000),
      metrics.rhythmConsistency, // Already 0-1
      metrics.errorRate, // Already 0-1

      // Derived features
      metrics.holdTimeVariance < 10 ? 1 : 0, // Perfect timing
      metrics.rhythmConsistency > 0.95 ? 1 : 0, // No rhythm variation
      metrics.typingSpeed > 800 ? 1 : 0, // Inhuman speed
      metrics.typingSpeed < 20 ? 1 : 0, // Too slow

      // Pattern features
      metrics.flightTimeVariance < 5 ? 1 : 0, // Repeated pattern
      metrics.holdTimeVariance < 5 ? 1 : 0, // Inhuman precision

      // Additional derived features
      metrics.averageHoldTime > 50 && metrics.averageHoldTime < 200 ? 0 : 1, // Unnatural hold time
      metrics.typingSpeed > 60 && metrics.typingSpeed < 400 ? 0 : 1, // Unnatural typing speed
    ];
  }

  /**
   * Extract click-related features
   */
  private extractClickFeatures(metrics: {
    totalClicks: number;
    averageClickDuration: number;
    clickDurationVariance: number;
    doubleClickRate: number;
    clickAccuracy: number;
    clickIntervalVariance: number;
  }): number[] {
    return [
      this.normalizeValue(metrics.totalClicks, 0, 100),
      this.normalizeValue(metrics.averageClickDuration, 0, 500),
      this.normalizeValue(metrics.clickDurationVariance, 0, 10000),
      metrics.doubleClickRate, // Already 0-1
      metrics.clickAccuracy, // Already 0-1
      this.normalizeValue(metrics.clickIntervalVariance, 0, 100000),

      // Derived features
      metrics.clickDurationVariance < 100 ? 1 : 0, // No click variation
      metrics.clickIntervalVariance < 10000 ? 1 : 0, // No interval variation
    ];
  }

  /**
   * Extract scroll-related features
   */
  private extractScrollFeatures(metrics: {
    totalScrolls: number;
    averageScrollSpeed: number;
    scrollSpeedVariance: number;
    scrollDirectionConsistency: number;
    smoothScrollingScore: number;
  }): number[] {
    return [
      this.normalizeValue(metrics.totalScrolls, 0, 100),
      this.normalizeValue(metrics.averageScrollSpeed, 0, 1000),
      this.normalizeValue(metrics.scrollSpeedVariance, 0, 100000),
      metrics.scrollDirectionConsistency, // Already 0-1
      metrics.smoothScrollingScore, // Already 0-1
    ];
  }

  /**
   * Extract timing-related features
   */
  private extractTimingFeatures(session: BehavioralSession): number[] {
    const now = Date.now();
    const sessionDuration = (session.endTime || now) - session.startTime;
    const responseTime =
      session.dataPoints.length > 0 ? session.dataPoints[0].timestamp - session.startTime : 0;

    return [
      this.normalizeValue(sessionDuration, 0, 600000), // Max 10 minutes
      this.normalizeValue(responseTime, 0, 10000), // Max 10 seconds
    ];
  }

  /**
   * Normalize value to 0-1 range
   */
  private normalizeValue(value: number, min: number, max: number): number {
    if (max === min) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Predict bot probability using ML model
   */
  async predict(session: BehavioralSession): Promise<ModelPrediction> {
    const startTime = Date.now();

    if (!this.model) {
      throw new Error('ML model not initialized');
    }

    // Extract features
    const features = this.extractFeatures(session);

    // Create tensor
    const inputTensor = tf.tensor2d([features]);

    // Make prediction
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await prediction.data();

    // Get bot probability
    const botProbability = predictionData[0];
    const humanProbability = 1 - botProbability;

    // Calculate confidence based on distance from decision boundary
    const confidence = Math.abs(botProbability - 0.5) * 2;

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    return {
      botProbability,
      humanProbability,
      confidence,
      features,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Perform comprehensive bot detection using ML and rule-based analysis
   */
  async detectBot(session: BehavioralSession): Promise<BotDetectionResult> {
    const startTime = Date.now();

    // Get ML prediction
    const mlPrediction = await this.predict(session);

    // Get rule-based analysis from existing analyzers
    const mouseAnalysis = await this.mouseAnalyzer.performBotDetection(session);
    const keystrokeAnalysis = await this.keystrokeAnalyzer.performBotDetection(session);

    // Combine ML and rule-based scores
    const mlWeight = 0.5;
    const ruleWeight = 0.5;

    const combinedBotScore =
      mlPrediction.botProbability * mlWeight +
      mouseAnalysis.botScore * ruleWeight * 0.6 +
      keystrokeAnalysis.botScore * ruleWeight * 0.4;

    // Determine verdict
    const verdict = this.determineVerdict(combinedBotScore, mlPrediction.confidence);

    // Combine anomalies
    const anomalies: Anomaly[] = [...mouseAnalysis.anomalies, ...keystrokeAnalysis.anomalies];

    // Add ML-specific anomalies
    if (mlPrediction.botProbability > 0.8) {
      anomalies.push({
        type: 'repeated_pattern',
        severity: 'high',
        confidence: mlPrediction.confidence,
        description: 'ML model detected bot-like patterns',
        evidence: { botProbability: mlPrediction.botProbability },
        timestamp: Date.now(),
      });
    }

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(mlPrediction, mouseAnalysis, keystrokeAnalysis);

    // Calculate feature scores for result
    const features: BotDetectionFeatures = {
      movementNaturalness: mouseAnalysis.features.movementNaturalness,
      velocityConsistency: mouseAnalysis.features.velocityConsistency,
      accelerationPattern: mouseAnalysis.features.accelerationPattern,
      pathEfficiency: mouseAnalysis.features.pathEfficiency,
      microMovementPresence: mouseAnalysis.features.microMovementPresence,
      clickNaturalness: mouseAnalysis.features.clickNaturalness,
      clickTimingVariation: mouseAnalysis.features.clickTimingVariation,
      scrollNaturalness: mouseAnalysis.features.scrollNaturalness,
      scrollSmoothness: mouseAnalysis.features.scrollSmoothness,
      keystrokeRhythm: keystrokeAnalysis.features.keystrokeRhythm,
      typingSpeedNaturalness: keystrokeAnalysis.features.typingSpeedNaturalness,
      responseTimeNaturalness:
        (mouseAnalysis.features.responseTimeNaturalness +
          keystrokeAnalysis.features.responseTimeNaturalness) /
        2,
      sessionDurationNaturalness:
        (mouseAnalysis.features.sessionDurationNaturalness +
          keystrokeAnalysis.features.sessionDurationNaturalness) /
        2,
      patternVariability:
        (mouseAnalysis.features.patternVariability +
          keystrokeAnalysis.features.patternVariability) /
        2,
      repetitionScore: Math.max(
        mouseAnalysis.features.repetitionScore,
        keystrokeAnalysis.features.repetitionScore
      ),
    };

    const result: BotDetectionResult = {
      verdict,
      confidence: mlPrediction.confidence,
      botScore: combinedBotScore,
      humanScore: 1 - combinedBotScore,
      features,
      anomalies,
      riskFactors,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    };

    // Log detection result
    this.securityLogger.logSecurityEvent({
      action: 'bot_detection_completed',
      resource: 'bot_detection_ml',
      reason: `Bot detection completed with verdict: ${verdict}`,
      metadata: {
        sessionId: session.sessionId,
        verdict,
        botScore: combinedBotScore,
        confidence: mlPrediction.confidence,
        anomalyCount: anomalies.length,
        processingTime: result.processingTime,
      },
    });

    return result;
  }

  /**
   * Determine verdict based on bot score and confidence
   */
  private determineVerdict(botScore: number, confidence: number): BotDetectionVerdict {
    if (botScore >= 0.7 && confidence >= 0.6) {
      return 'bot';
    } else if (botScore <= 0.3 && confidence >= 0.6) {
      return 'human';
    } else if (botScore >= 0.5 || confidence < 0.4) {
      return 'suspicious';
    } else {
      return 'uncertain';
    }
  }

  /**
   * Identify risk factors from analysis results
   */
  private identifyRiskFactors(
    mlPrediction: ModelPrediction,
    mouseAnalysis: BotDetectionResult,
    keystrokeAnalysis: BotDetectionResult
  ): string[] {
    const riskFactors: string[] = [];

    // ML-based risk factors
    if (mlPrediction.botProbability > 0.7) {
      riskFactors.push('High ML bot probability');
    }

    if (mlPrediction.confidence < 0.4) {
      riskFactors.push('Low prediction confidence');
    }

    // Mouse-based risk factors
    if (mouseAnalysis.riskFactors.length > 0) {
      riskFactors.push(...mouseAnalysis.riskFactors.slice(0, 3));
    }

    // Keystroke-based risk factors
    if (keystrokeAnalysis.riskFactors.length > 0) {
      riskFactors.push(...keystrokeAnalysis.riskFactors.slice(0, 3));
    }

    // Combined risk factors
    if (mouseAnalysis.botScore > 0.6 && keystrokeAnalysis.botScore > 0.6) {
      riskFactors.push('Multiple detection systems flagged as bot');
    }

    return [...new Set(riskFactors)]; // Remove duplicates
  }

  /**
   * Train model with new data
   */
  async train(trainingData: TrainingData): Promise<ModelMetrics> {
    if (!this.model) {
      throw new Error('ML model not initialized');
    }

    const startTime = Date.now();

    try {
      // Prepare training data
      const featuresTensor = tf.tensor2d(trainingData.features);
      const labelsTensor = tf.tensor2d(trainingData.labels.map(l => [l]));

      // Train model
      await this.model.fit(featuresTensor, labelsTensor, {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: this.config.validationSplit,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              this.securityLogger.logSecurityEvent({
                action: 'ml_training_progress',
                resource: 'bot_detection_ml',
                reason: `Training epoch ${epoch}`,
                metadata: {
                  loss: logs?.loss,
                  accuracy: logs?.acc,
                  valLoss: logs?.val_loss,
                  valAccuracy: logs?.val_acc,
                },
              });
            }
          },
        },
      });

      // Calculate metrics
      const predictions = this.model.predict(featuresTensor) as tf.Tensor;
      const predictionsData = await predictions.data();
      const predictedLabels = Array.from(predictionsData).map(p => (p > 0.5 ? 1 : 0));

      const metrics = this.calculateMetrics(trainingData.labels, predictedLabels);
      this.modelMetrics = metrics;

      // Cleanup tensors
      featuresTensor.dispose();
      labelsTensor.dispose();
      predictions.dispose();

      this.lastTrainingTime = Date.now();

      this.securityLogger.logSecurityEvent({
        action: 'ml_training_completed',
        resource: 'bot_detection_ml',
        reason: 'Model training completed',
        metadata: {
          trainingTime: Date.now() - startTime,
          samples: trainingData.features.length,
          metrics,
        },
      });

      return metrics;
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        action: 'ml_training_failed',
        resource: 'bot_detection_ml',
        reason: `Model training failed: ${error}`,
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Calculate model performance metrics
   */
  private calculateMetrics(actual: number[], predicted: number[]): ModelMetrics {
    let tp = 0,
      fp = 0,
      tn = 0,
      fn = 0;

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] === 1 && predicted[i] === 1) {
        tp++;
      } else if (actual[i] === 0 && predicted[i] === 1) {
        fp++;
      } else if (actual[i] === 0 && predicted[i] === 0) {
        tn++;
      } else if (actual[i] === 1 && predicted[i] === 0) {
        fn++;
      }
    }

    const accuracy = (tp + tn) / actual.length;
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = (2 * (precision * recall)) / (precision + recall) || 0;

    // Simple AUC calculation (approximation)
    const tpr = recall;
    const fpr = fp / (fp + tn) || 0;
    const auc = (1 + tpr - fpr) / 2;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      auc,
      confusionMatrix: [
        [tn, fp],
        [fn, tp],
      ],
    };
  }

  /**
   * Save model to file
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('ML model not initialized');
    }

    try {
      await this.model.save(`file://${path}`);

      this.securityLogger.logSecurityEvent({
        action: 'ml_model_saved',
        resource: 'bot_detection_ml',
        reason: 'Model saved successfully',
        metadata: { path },
      });
    } catch (error) {
      this.securityLogger.logSecurityEvent({
        action: 'ml_model_save_failed',
        resource: 'bot_detection_ml',
        reason: `Failed to save model: ${error}`,
        metadata: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Check if model needs retraining
   */
  needsRetraining(): boolean {
    if (!this.lastTrainingTime) {
      return true;
    }

    const hoursSinceTraining = (Date.now() - this.lastTrainingTime) / (1000 * 60 * 60);
    return hoursSinceTraining >= this.config.retrainInterval;
  }

  /**
   * Get model metrics
   */
  getModelMetrics(): ModelMetrics | null {
    return this.modelMetrics;
  }

  /**
   * Clear feature cache
   */
  clearCache(): void {
    this.featureCache.clear();
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    modelLoaded: boolean;
    featureCacheSize: number;
    lastTrainingTime: number | null;
    modelMetrics: ModelMetrics | null;
  } {
    return {
      modelLoaded: this.model !== null,
      featureCacheSize: this.featureCache.size,
      lastTrainingTime: this.lastTrainingTime || null,
      modelMetrics: this.modelMetrics,
    };
  }

  /**
   * Dispose of model and free resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.featureCache.clear();
  }
}
