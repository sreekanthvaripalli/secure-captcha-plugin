/**
 * Unit Tests for Captcha Generator Base Architecture
 * Tests: Interface contracts, Factory pattern, Base class functionality
 */

import { SecurityConfigurationService } from '../../src/security/config';
import {
  BaseCaptchaGenerator,
  CaptchaGeneratorFactory,
  CaptchaGeneratorRegistry,
  MultiLayerCaptchaGenerator
} from '../../src/core/captcha-generator';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../../src/types/captcha';

// Mock implementation of BaseCaptchaGenerator for testing
class MockCaptchaGenerator extends BaseCaptchaGenerator {
  getType(): CaptchaType {
    return 'text';
  }

  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium', 'hard'];
  }

  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);
    return {
      sessionId: 'test-session-id',
      challenge: 'test-challenge',
      type: input.type,
      difficulty: input.difficulty,
      expiresIn: 300000,
      metadata: {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        fingerprint: 'test-fingerprint',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: []
        },
        deviceInfo: {
          browser: 'test',
          os: 'test',
          screenResolution: '1920x1080',
          timezone: 'UTC',
          language: 'en'
        }
      }
    };
  }

  async validate(_sessionId: string, response: string): Promise<boolean> {
    return response === 'correct-answer';
  }
}

// Another mock generator for testing factory
class MathCaptchaGenerator extends BaseCaptchaGenerator {
  getType(): CaptchaType {
    return 'math';
  }

  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium'];
  }

  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);
    return {
      sessionId: 'math-session-id',
      challenge: '2 + 2 = ?',
      type: input.type,
      difficulty: input.difficulty,
      expiresIn: 300000,
      metadata: {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        fingerprint: 'test-fingerprint',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: []
        },
        deviceInfo: {
          browser: 'test',
          os: 'test',
          screenResolution: '1920x1080',
          timezone: 'UTC',
          language: 'en'
        }
      }
    };
  }

  async validate(_sessionId: string, response: string): Promise<boolean> {
    return response === '4';
  }
}

describe('CaptchaGenerator Interface', () => {
  let configService: SecurityConfigurationService;
  let generator: MockCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    generator = new MockCaptchaGenerator(configService);
  });

  test('should implement getType method', () => {
    expect(generator.getType()).toBe('text');
  });

  test('should implement getSupportedDifficulties method', () => {
    const difficulties = generator.getSupportedDifficulties();
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });

  test('should implement generate method', async () => {
    const input: GenerateCaptchaInput = {
      type: 'text',
      difficulty: 'medium'
    };
    const response = await generator.generate(input);
    expect(response).toHaveProperty('sessionId');
    expect(response).toHaveProperty('challenge');
    expect(response.type).toBe('text');
    expect(response.difficulty).toBe('medium');
  });

  test('should implement validate method', async () => {
    const isValid = await generator.validate('session-id', 'correct-answer');
    expect(isValid).toBe(true);
  });

  test('should return false for incorrect validation', async () => {
    const isValid = await generator.validate('session-id', 'wrong-answer');
    expect(isValid).toBe(false);
  });
});

describe('BaseCaptchaGenerator', () => {
  let configService: SecurityConfigurationService;
  let generator: MockCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    generator = new MockCaptchaGenerator(configService);
  });

  test('should store configService in constructor', () => {
    expect(generator['configService']).toBe(configService);
  });

  test('should generate secure random string', () => {
    const random1 = generator['generateSecureRandom'](10);
    const random2 = generator['generateSecureRandom'](10);
    
    expect(random1).toHaveLength(10);
    expect(random2).toHaveLength(10);
    expect(random1).not.toBe(random2); // Should be different
  });

  test('should generate secure random with custom charset', () => {
    const charset = '0123456789';
    const random = generator['generateSecureRandom'](5, charset);
    
    expect(random).toHaveLength(5);
    for (const char of random) {
      expect(charset).toContain(char);
    }
  });

  test('should validate input - missing type', () => {
    const input = {
      difficulty: 'medium' as Difficulty
    } as GenerateCaptchaInput;
    
    expect(() => generator['validateInput'](input)).toThrow('Captcha type is required');
  });

  test('should validate input - missing difficulty', () => {
    const input = {
      type: 'text' as CaptchaType
    } as GenerateCaptchaInput;
    
    expect(() => generator['validateInput'](input)).toThrow('Difficulty level is required');
  });

  test('should validate input - unsupported type', () => {
    const input: GenerateCaptchaInput = {
      type: 'unsupported' as CaptchaType,
      difficulty: 'medium'
    };
    
    expect(() => generator['validateInput'](input)).toThrow('Unsupported captcha type: unsupported');
  });

  test('should validate input - unsupported difficulty', () => {
    const input: GenerateCaptchaInput = {
      type: 'text',
      difficulty: 'extreme' as Difficulty
    };
    
    expect(() => generator['validateInput'](input)).toThrow('Unsupported difficulty for text: extreme');
  });

  test('should validate input - valid input', () => {
    const input: GenerateCaptchaInput = {
      type: 'text',
      difficulty: 'medium'
    };
    
    expect(() => generator['validateInput'](input)).not.toThrow();
  });

  test('should get configuration', () => {
    const config = generator['getConfig']();
    expect(config).toBeDefined();
    expect(config).toHaveProperty('crypto');
    expect(config).toHaveProperty('app');
  });

  test('should log security event', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    generator['logSecurityEvent']('captcha_generated', 'test-session', { test: 'data' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Security Event:',
      expect.stringContaining('captcha_generated')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('CaptchaGeneratorFactory', () => {
  let configService: SecurityConfigurationService;
  let factory: CaptchaGeneratorFactory;
  let textGenerator: MockCaptchaGenerator;
  let mathGenerator: MathCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    factory = new CaptchaGeneratorFactory(configService);
    textGenerator = new MockCaptchaGenerator(configService);
    mathGenerator = new MathCaptchaGenerator(configService);
  });

  test('should register generator', () => {
    factory.registerGenerator(textGenerator);
    expect(factory.isSupported('text')).toBe(true);
  });

  test('should get registered generator', () => {
    factory.registerGenerator(textGenerator);
    const generator = factory.getGenerator('text');
    expect(generator).toBe(textGenerator);
  });

  test('should throw error for unregistered generator', () => {
    expect(() => factory.getGenerator('logic')).toThrow('No generator registered for captcha type: logic');
  });

  test('should get all registered types', () => {
    factory.registerGenerator(textGenerator);
    factory.registerGenerator(mathGenerator);
    
    const types = factory.getRegisteredTypes();
    expect(types).toContain('text');
    expect(types).toContain('math');
    expect(types).toHaveLength(2);
  });

  test('should check if type is supported', () => {
    factory.registerGenerator(textGenerator);
    
    expect(factory.isSupported('text')).toBe(true);
    expect(factory.isSupported('math')).toBe(false);
  });

  test('should get supported difficulties for type', () => {
    factory.registerGenerator(textGenerator);
    
    const difficulties = factory.getSupportedDifficulties('text');
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });

  test('should throw error when getting difficulties for unregistered type', () => {
    expect(() => factory.getSupportedDifficulties('image')).toThrow('No generator registered for captcha type: image');
  });

  test('should overwrite generator when registering same type', () => {
    const anotherTextGenerator = new MockCaptchaGenerator(configService);
    factory.registerGenerator(textGenerator);
    factory.registerGenerator(anotherTextGenerator);
    
    const generator = factory.getGenerator('text');
    expect(generator).toBe(anotherTextGenerator);
  });
});

describe('MultiLayerCaptchaGenerator', () => {
  let configService: SecurityConfigurationService;
  let factory: CaptchaGeneratorFactory;
  let textGenerator: MockCaptchaGenerator;
  let mathGenerator: MathCaptchaGenerator;
  let multiLayerGenerator: MultiLayerCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    factory = new CaptchaGeneratorFactory(configService);
    textGenerator = new MockCaptchaGenerator(configService);
    mathGenerator = new MathCaptchaGenerator(configService);
    
    factory.registerGenerator(textGenerator);
    factory.registerGenerator(mathGenerator);
    
    multiLayerGenerator = new MultiLayerCaptchaGenerator(
      configService,
      factory,
      ['text', 'math']
    );
  });

  test('should return multi-layer type', () => {
    expect(multiLayerGenerator.getType()).toBe('multi-layer');
  });

  test('should support all difficulties', () => {
    const difficulties = multiLayerGenerator.getSupportedDifficulties();
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });

  test('should generate multi-layer captcha', async () => {
    const input: GenerateCaptchaInput = {
      type: 'multi-layer',
      difficulty: 'medium'
    };
    
    const response = await multiLayerGenerator.generate(input);
    
    expect(response.type).toBe('multi-layer');
    expect(response.sessionId).toBe('test-session-id');
    expect(response.challenge).toBeDefined();
  });

  test('should throw error for unsupported layer type', async () => {
    const invalidGenerator = new MultiLayerCaptchaGenerator(
      configService,
      factory,
      ['text', 'logic'] // logic is not registered
    );
    
    const input: GenerateCaptchaInput = {
      type: 'multi-layer',
      difficulty: 'medium'
    };
    
    await expect(invalidGenerator.generate(input)).rejects.toThrow('Layer type not supported: logic');
  });

  test('should validate multi-layer captcha', async () => {
    const isValid = await multiLayerGenerator.validate('session-id', 'response');
    expect(isValid).toBe(true);
  });
});

describe('CaptchaGeneratorRegistry', () => {
  let configService: SecurityConfigurationService;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    // Reset singleton instance for testing
    (CaptchaGeneratorRegistry as any).instance = undefined;
  });

  test('should return singleton instance', () => {
    const instance1 = CaptchaGeneratorRegistry.getInstance(configService);
    const instance2 = CaptchaGeneratorRegistry.getInstance(configService);
    
    expect(instance1).toBe(instance2);
  });

  test('should register standard generators', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();
    
    // Multi-layer should be registered
    expect(registry.isSupported('multi-layer')).toBe(true);
  });

  test('should get generator by type', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();
    
    const generator = registry.getGenerator('multi-layer');
    expect(generator).toBeDefined();
    expect(generator.getType()).toBe('multi-layer');
  });

  test('should throw error for unregistered type', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    
    expect(() => registry.getGenerator('text')).toThrow('No generator registered for captcha type: text');
  });

  test('should get all registered types', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();
    
    const types = registry.getRegisteredTypes();
    expect(types).toContain('multi-layer');
  });

  test('should check if type is supported', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();
    
    expect(registry.isSupported('multi-layer')).toBe(true);
    expect(registry.isSupported('text')).toBe(false);
  });

  test('should get supported difficulties', () => {
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();
    
    const difficulties = registry.getSupportedDifficulties('multi-layer');
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });
});

describe('Integration Tests', () => {
  let configService: SecurityConfigurationService;
  let factory: CaptchaGeneratorFactory;
  let textGenerator: MockCaptchaGenerator;
  let mathGenerator: MathCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    factory = new CaptchaGeneratorFactory(configService);
    textGenerator = new MockCaptchaGenerator(configService);
    mathGenerator = new MathCaptchaGenerator(configService);
  });

  test('should work with multiple generators', () => {
    factory.registerGenerator(textGenerator);
    factory.registerGenerator(mathGenerator);
    
    expect(factory.getRegisteredTypes()).toHaveLength(2);
    expect(factory.isSupported('text')).toBe(true);
    expect(factory.isSupported('math')).toBe(true);
  });

  test('should generate captcha through factory', async () => {
    factory.registerGenerator(textGenerator);
    
    const generator = factory.getGenerator('text');
    const input: GenerateCaptchaInput = {
      type: 'text',
      difficulty: 'easy'
    };
    
    const response = await generator.generate(input);
    expect(response.type).toBe('text');
    expect(response.difficulty).toBe('easy');
  });

  test('should validate captcha through factory', async () => {
    factory.registerGenerator(textGenerator);
    
    const generator = factory.getGenerator('text');
    const isValid = await generator.validate('session-id', 'correct-answer');
    
    expect(isValid).toBe(true);
  });

  test('should handle multi-layer with factory', async () => {
    factory.registerGenerator(textGenerator);
    factory.registerGenerator(mathGenerator);
    
    const multiLayer = new MultiLayerCaptchaGenerator(
      configService,
      factory,
      ['text', 'math']
    );
    
    const input: GenerateCaptchaInput = {
      type: 'multi-layer',
      difficulty: 'medium'
    };
    
    const response = await multiLayer.generate(input);
    expect(response.type).toBe('multi-layer');
  });
});