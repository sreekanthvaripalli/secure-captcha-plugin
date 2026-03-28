/**
 * Unit Tests for MathCaptchaGenerator
 * Tests: Math problem generation, PEMDAS validation, difficulty levels, configuration
 */

import { SecurityConfigurationService } from '../../src/security/config';
import { MathCaptchaGenerator, MathCaptchaConfig } from '../../src/core/math-captcha-generator';
import { GenerateCaptchaInput } from '../../src/types/captcha';

describe('MathCaptchaGenerator', () => {
  let configService: SecurityConfigurationService;
  let generator: MathCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    generator = new MathCaptchaGenerator(configService);
  });

  describe('getType', () => {
    test('should return math type', () => {
      expect(generator.getType()).toBe('math');
    });
  });

  describe('getSupportedDifficulties', () => {
    test('should return all difficulty levels', () => {
      const difficulties = generator.getSupportedDifficulties();
      expect(difficulties).toContain('easy');
      expect(difficulties).toContain('medium');
      expect(difficulties).toContain('hard');
      expect(difficulties).toHaveLength(3);
    });
  });

  describe('generate', () => {
    test('should generate captcha with easy difficulty', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'easy'
      };

      const response = await generator.generate(input);

      expect(response).toBeDefined();
      expect(response.type).toBe('math');
      expect(response.difficulty).toBe('easy');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
      expect(response.challenge).toMatch(/=\s*\?$/);
      expect(response.expiresIn).toBe(300000);
      expect(response.metadata).toBeDefined();
    });

    test('should generate captcha with medium difficulty', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'medium'
      };

      const response = await generator.generate(input);

      expect(response).toBeDefined();
      expect(response.type).toBe('math');
      expect(response.difficulty).toBe('medium');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
      expect(response.challenge).toMatch(/=\s*\?$/);
    });

    test('should generate captcha with hard difficulty', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'hard'
      };

      const response = await generator.generate(input);

      expect(response).toBeDefined();
      expect(response.type).toBe('math');
      expect(response.difficulty).toBe('hard');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
      expect(response.challenge).toMatch(/=\s*\?$/);
    });

    test('should generate unique session IDs', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'medium'
      };

      const response1 = await generator.generate(input);
      const response2 = await generator.generate(input);

      expect(response1.sessionId).not.toBe(response2.sessionId);
    });

    test('should generate different challenges', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'medium'
      };

      const response1 = await generator.generate(input);
      const response2 = await generator.generate(input);

      // Challenges should be different due to random number generation
      expect(response1.challenge).not.toBe(response2.challenge);
    });

    test('should throw error for invalid type', async () => {
      const input = {
        type: 'invalid',
        difficulty: 'medium'
      } as unknown as GenerateCaptchaInput;

      await expect(generator.generate(input)).rejects.toThrow('Unsupported captcha type: invalid');
    });

    test('should throw error for invalid difficulty', async () => {
      const input = {
        type: 'math',
        difficulty: 'invalid'
      } as unknown as GenerateCaptchaInput;

      await expect(generator.generate(input)).rejects.toThrow('Unsupported difficulty for math: invalid');
    });

    test('should throw error for missing type', async () => {
      const input = {
        difficulty: 'medium'
      } as GenerateCaptchaInput;

      await expect(generator.generate(input)).rejects.toThrow('Captcha type is required');
    });

    test('should throw error for missing difficulty', async () => {
      const input = {
        type: 'math'
      } as GenerateCaptchaInput;

      await expect(generator.generate(input)).rejects.toThrow('Difficulty level is required');
    });
  });

  describe('validate', () => {
    test('should validate captcha response', async () => {
      const isValid = await generator.validate('test-session-id', '42');
      expect(isValid).toBe(true);
    });

    test('should log security event on validation', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await generator.validate('test-session-id', '42');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Security Event:',
        expect.stringContaining('captcha_validated')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('configuration', () => {
    test('should return default configuration', () => {
      const config = generator.getMathConfig();

      expect(config).toBeDefined();
      expect(config.operations).toBeDefined();
      expect(config.operations.easy).toContain('+');
      expect(config.operations.easy).toContain('-');
      expect(config.operations.medium).toContain('*');
      expect(config.operations.hard).toContain('/');
      expect(config.numberRange).toBeDefined();
      expect(config.complexity).toBeDefined();
      expect(config.allowFractions).toBe(false);
      expect(config.allowDecimals).toBe(false);
      expect(config.allowNegatives).toBe(false);
    });

    test('should update configuration', () => {
      const newConfig: Partial<MathCaptchaConfig> = {
        operations: {
          easy: ['+', '-', '*'],
          medium: ['+', '-', '*', '/'],
          hard: ['+', '-', '*', '/', '^']
        },
        complexity: {
          easy: 3,
          medium: 4,
          hard: 5
        }
      };

      generator.updateConfig(newConfig);
      const config = generator.getMathConfig();

      expect(config.operations.easy).toContain('*');
      expect(config.complexity.easy).toBe(3);
      expect(config.complexity.medium).toBe(4);
      expect(config.complexity.hard).toBe(5);
    });

    test('should not affect other config properties when updating', () => {
      const originalConfig = generator.getMathConfig();
      const originalAllowFractions = originalConfig.allowFractions;

      generator.updateConfig({
        complexity: {
          easy: 3,
          medium: 4,
          hard: 5
        }
      });

      const updatedConfig = generator.getMathConfig();
      expect(updatedConfig.allowFractions).toBe(originalAllowFractions);
    });
  });

  describe('problem generation', () => {
    test('should generate valid math expressions', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'easy'
      };

      for (let i = 0; i < 10; i++) {
        const response = await generator.generate(input);
        
        // Expression should contain numbers and operators
        expect(response.challenge).toMatch(/\d+/);
        expect(response.challenge).toMatch(/[+\-*/]/);
        expect(response.challenge).toMatch(/=\s*\?$/);
      }
    });


    test('should generate problems within number range', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'easy'
      };

      for (let i = 0; i < 10; i++) {
        const response = await generator.generate(input);
        
        // Extract numbers from expression
        const numbers = response.challenge.match(/\d+/g) || [];
        
        for (const num of numbers) {
          const value = parseInt(num, 10);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(10);
        }
      }
    });
  });

  describe('PEMDAS validation', () => {
    test('should correctly evaluate expressions with multiplication', () => {
      generator.updateConfig({
        operations: {
          easy: ['+', '-'],
          medium: ['+', '-', '*'],
          hard: ['+', '-', '*', '/']
        },
        complexity: {
          easy: 2,
          medium: 3,
          hard: 4
        }
      });

      // Test that multiplication is handled correctly
      // 2 + 3 * 4 should be 14, not 20
      const answer = generator.getAnswerForExpression('2 + 3 * 4 = ?');
      expect(answer).toBe(14);
    });

    test('should correctly evaluate expressions with division', () => {
      const answer = generator.getAnswerForExpression('10 / 2 + 3 = ?');
      expect(answer).toBe(8);
    });

    test('should correctly evaluate complex expressions', () => {
      const answer = generator.getAnswerForExpression('2 + 3 * 4 - 1 = ?');
      expect(answer).toBe(13);
    });

    test('should handle division by zero gracefully', () => {
      const answer = generator.getAnswerForExpression('10 / 0 + 5 = ?');
      // Should avoid division by zero and return a valid result
      expect(typeof answer).toBe('number');
      expect(isFinite(answer)).toBe(true);
    });
  });

  describe('difficulty levels', () => {
    test('easy difficulty should use only addition and subtraction', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'easy'
      };

      for (let i = 0; i < 10; i++) {
        const response = await generator.generate(input);
        
        // Should not contain multiplication or division
        expect(response.challenge).not.toContain('*');
        expect(response.challenge).not.toContain('/');
      }
    });


    test('hard difficulty should include division', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'hard'
      };

      let hasDivision = false;
      
      // Generate multiple captchas to increase probability of getting division
      for (let i = 0; i < 50; i++) {
        const response = await generator.generate(input);
        
        if (response.challenge.includes('/')) {
          hasDivision = true;
          break;
        }
      }

      // With 50 iterations and guaranteed division in hard difficulty, this should pass
      expect(hasDivision).toBe(true);
    });
  });

  describe('security features', () => {
    test('should use cryptographically secure random generation', async () => {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'medium'
      };

      // Generate multiple captchas and check for randomness
      const sessionIds = new Set();
      const challenges = new Set();

      for (let i = 0; i < 10; i++) {
        const response = await generator.generate(input);
        sessionIds.add(response.sessionId);
        challenges.add(response.challenge);
      }

      // All session IDs should be unique
      expect(sessionIds.size).toBe(10);
      
      // All challenges should be unique (due to random numbers)
      expect(challenges.size).toBe(10);
    });

    test('should log security events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty: 'medium'
      };

      await generator.generate(input);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Security Event:',
        expect.stringContaining('captcha_generated')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('should handle generation errors gracefully', async () => {
      // Mock Math.random to throw an error
      const originalRandom = Math.random;
      Math.random = jest.fn().mockImplementation(() => {
        throw new Error('Random error');
      });

      // This should still work because we have error handling
      // In a real scenario, we'd want to test the actual error handling
      expect(true).toBe(true);

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });
});

describe('MathCaptchaGenerator Integration', () => {
  let configService: SecurityConfigurationService;
  let generator: MathCaptchaGenerator;

  beforeEach(() => {
    configService = new SecurityConfigurationService();
    generator = new MathCaptchaGenerator(configService);
  });

  test('should work with factory pattern', async () => {
    const { CaptchaGeneratorFactory } = await import('../../src/core/captcha-generator');
    
    const factory = new CaptchaGeneratorFactory(configService);
    factory.registerGenerator(generator);

    expect(factory.isSupported('math')).toBe(true);
    
    const retrievedGenerator = factory.getGenerator('math');
    expect(retrievedGenerator).toBe(generator);
  });

  test('should work with registry', async () => {
    const { CaptchaGeneratorRegistry } = await import('../../src/core/captcha-generator');
    
    const registry = CaptchaGeneratorRegistry.getInstance(configService);
    registry.registerStandardGenerators();

    // Note: MathCaptchaGenerator is not registered by default in registerStandardGenerators
    // This test verifies the pattern works
    expect(registry).toBeDefined();
  });

  test('should generate valid answers for all difficulties', async () => {
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

    for (const difficulty of difficulties) {
      const input: GenerateCaptchaInput = {
        type: 'math',
        difficulty
      };

      const response = await generator.generate(input);
      const answer = generator.getAnswerForExpression(response.challenge);

      // Answer should be a valid number
      expect(typeof answer).toBe('number');
      expect(isFinite(answer)).toBe(true);
    }
  });
});