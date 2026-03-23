import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../types/captcha';
import { SecurityEvent, SecurityEventType } from '../types/security';

/**
 * Interface for all captcha generators
 */
export interface CaptchaGenerator {
  /**
   * Generate a captcha challenge
   */
  generate(input: GenerateCaptchaInput): Promise<CaptchaResponse>;

  /**
   * Validate a captcha response
   */
  validate(sessionId: string, response: string): Promise<boolean>;

  /**
   * Get supported difficulty levels
   */
  getSupportedDifficulties(): Difficulty[];

  /**
   * Get generator type
   */
  getType(): CaptchaType;
}

/**
 * Abstract base class for all captcha generators
 */
export abstract class BaseCaptchaGenerator implements CaptchaGenerator {
  protected configService: SecurityConfigurationService;

  constructor(configService: SecurityConfigurationService) {
    this.configService = configService;
  }

  /**
   * Generate a captcha challenge
   */
  abstract generate(input: GenerateCaptchaInput): Promise<CaptchaResponse>;

  /**
   * Validate a captcha response
   */
  abstract validate(sessionId: string, response: string): Promise<boolean>;

  /**
   * Get supported difficulty levels
   */
  abstract getSupportedDifficulties(): Difficulty[];

  /**
   * Get generator type
   */
  abstract getType(): CaptchaType;

  /**
   * Generate cryptographically secure random string
   */
  protected generateSecureRandom(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    const crypto = require('crypto');
    let result = '';
    const charsetLength = charset.length;
    
    for (let i = 0; i < length; i++) {
      const randomBytes = crypto.randomBytes(4);
      const randomIndex = randomBytes.readUInt32BE(0) % charsetLength;
      result += charset[randomIndex];
    }
    
    return result;
  }

  /**
   * Validate input parameters
   */
  protected validateInput(input: GenerateCaptchaInput): void {
    if (!input.type) {
      throw new Error('Captcha type is required');
    }

    if (!input.difficulty) {
      throw new Error('Difficulty level is required');
    }

    const supportedTypes = ['text', 'math', 'logic', 'image', 'audio', 'behavioral', 'invisible', 'multi-layer'];
    if (!supportedTypes.includes(input.type)) {
      throw new Error(`Unsupported captcha type: ${input.type}`);
    }

    const supportedDifficulties = this.getSupportedDifficulties();
    if (!supportedDifficulties.includes(input.difficulty)) {
      throw new Error(`Unsupported difficulty for ${input.type}: ${input.difficulty}`);
    }
  }

  /**
   * Log security events
   */
  protected logSecurityEvent(type: SecurityEventType, sessionId: string, details: any): void {
    const event: SecurityEvent = {
      id: this.generateSecureRandom(32),
      type,
      severity: 'low',
      timestamp: new Date(),
      sessionId,
      ip: 'unknown', // Will be populated by calling service
      userAgent: 'unknown', // Will be populated by calling service
      details,
      resolved: false
    };

    // Log the event (implementation depends on logging service)
    console.log('Security Event:', JSON.stringify(event, null, 2));
  }

  /**
   * Get configuration for the generator
   */
  protected getConfig(): any {
    return this.configService.getConfig();
  }
}

/**
 * Factory for creating captcha generators
 */
export class CaptchaGeneratorFactory {
  private configService: SecurityConfigurationService;
  private generators: Map<CaptchaType, CaptchaGenerator> = new Map();

  constructor(configService: SecurityConfigurationService) {
    this.configService = configService;
  }

  /**
   * Register a captcha generator
   */
  registerGenerator(generator: CaptchaGenerator): void {
    const type = generator.getType();
    this.generators.set(type, generator);
  }

  /**
   * Get a captcha generator by type
   */
  getGenerator(type: CaptchaType): CaptchaGenerator {
    const generator = this.generators.get(type);
    if (!generator) {
      throw new Error(`No generator registered for captcha type: ${type}`);
    }
    return generator;
  }

  /**
   * Get all registered generator types
   */
  getRegisteredTypes(): CaptchaType[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Check if a generator type is supported
   */
  isSupported(type: CaptchaType): boolean {
    return this.generators.has(type);
  }

  /**
   * Get supported difficulties for a type
   */
  getSupportedDifficulties(type: CaptchaType): Difficulty[] {
    const generator = this.getGenerator(type);
    return generator.getSupportedDifficulties();
  }
}

/**
 * Multi-layer captcha generator that combines multiple generators
 */
export class MultiLayerCaptchaGenerator extends BaseCaptchaGenerator {
  private factory: CaptchaGeneratorFactory;
  private layers: CaptchaType[];

  constructor(
    configService: SecurityConfigurationService,
    factory: CaptchaGeneratorFactory,
    layers: CaptchaType[]
  ) {
    super(configService);
    this.factory = factory;
    this.layers = layers;
  }

  getType(): CaptchaType {
    return 'multi-layer' as CaptchaType;
  }

  getSupportedDifficulties(): Difficulty[] {
    // Multi-layer supports all difficulties
    return ['easy', 'medium', 'hard'];
  }

  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);

    const responses: CaptchaResponse[] = [];
    
    // Generate captchas for each layer
    for (const layerType of this.layers) {
      if (!this.factory.isSupported(layerType)) {
        throw new Error(`Layer type not supported: ${layerType}`);
      }

      const generator = this.factory.getGenerator(layerType);
      const layerInput: GenerateCaptchaInput = {
        ...input,
        type: layerType
      };

      const response = await generator.generate(layerInput);
      responses.push(response);
    }

    // Create a combined response
    const combinedResponse: CaptchaResponse = {
      sessionId: responses[0].sessionId, // Use first session ID
      challenge: JSON.stringify(responses.map(r => r)), // Combine challenges
      type: 'multi-layer',
      difficulty: input.difficulty,
      expiresIn: responses[0].expiresIn,
      metadata: {
        ip: 'unknown',
        userAgent: 'unknown',
        fingerprint: 'unknown',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: []
        },
        deviceInfo: {
          browser: 'unknown',
          os: 'unknown',
          screenResolution: 'unknown',
          timezone: 'unknown',
          language: 'unknown'
        }
      }
    };

    this.logSecurityEvent('captcha_generated' as SecurityEventType, combinedResponse.sessionId, {
      type: 'multi-layer',
      layers: this.layers,
      difficulty: input.difficulty
    });

    return combinedResponse;
  }

  async validate(sessionId: string, response: string): Promise<boolean> {
    // For multi-layer, we need to validate each layer
    // This would typically involve checking against stored session data
    // For now, return true as placeholder
    this.logSecurityEvent('captcha_validated' as SecurityEventType, sessionId, {
      type: 'multi-layer',
      responseLength: response.length
    });

    return true;
  }
}

/**
 * Registry of all available captcha generators
 */
export class CaptchaGeneratorRegistry {
  private static instance: CaptchaGeneratorRegistry;
  private factory: CaptchaGeneratorFactory;

  private constructor(configService: SecurityConfigurationService) {
    this.factory = new CaptchaGeneratorFactory(configService);
  }

  static getInstance(configService: SecurityConfigurationService): CaptchaGeneratorRegistry {
    if (!CaptchaGeneratorRegistry.instance) {
      CaptchaGeneratorRegistry.instance = new CaptchaGeneratorRegistry(configService);
    }
    return CaptchaGeneratorRegistry.instance;
  }

  /**
   * Register all standard generators
   */
  registerStandardGenerators(): void {
    // Note: Actual generator implementations will be added in subsequent tasks
    // This is the base architecture setup
    
    // Register multi-layer generator
    const multiLayerGenerator = new MultiLayerCaptchaGenerator(
      this.factory['configService'],
      this.factory,
      ['text', 'math'] // Default layers
    );
    this.factory.registerGenerator(multiLayerGenerator);
  }

  /**
   * Get generator by type
   */
  getGenerator(type: CaptchaType): CaptchaGenerator {
    return this.factory.getGenerator(type);
  }

  /**
   * Get all registered types
   */
  getRegisteredTypes(): CaptchaType[] {
    return this.factory.getRegisteredTypes();
  }

  /**
   * Check if type is supported
   */
  isSupported(type: CaptchaType): boolean {
    return this.factory.isSupported(type);
  }

  /**
   * Get supported difficulties
   */
  getSupportedDifficulties(type: CaptchaType): Difficulty[] {
    return this.factory.getSupportedDifficulties(type);
  }
}