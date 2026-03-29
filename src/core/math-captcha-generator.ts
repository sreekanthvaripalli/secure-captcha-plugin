/**
 * Mathematical Captcha Generator
 * Generates arithmetic problems with configurable difficulty and PEMDAS validation
 */

import { BaseCaptchaGenerator } from './captcha-generator';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../types/captcha';
import { SecurityEventType } from '../types/security';

export interface MathCaptchaConfig {
  operations: {
    easy: string[];
    medium: string[];
    hard: string[];
  };
  numberRange: {
    easy: { min: number; max: number };
    medium: { min: number; max: number };
    hard: { min: number; max: number };
  };
  complexity: {
    easy: number; // Number of operations
    medium: number;
    hard: number;
  };
  allowFractions: boolean;
  allowDecimals: boolean;
  allowNegatives: boolean;
}

export interface MathProblem {
  expression: string;
  answer: number;
  steps: string[];
}

export class MathCaptchaGenerator extends BaseCaptchaGenerator {
  private readonly config: MathCaptchaConfig;

  constructor(configService: SecurityConfigurationService) {
    super(configService);

    // Default configuration
    this.config = {
      operations: {
        easy: ['+', '-'],
        medium: ['+', '-', '*'],
        hard: ['+', '-', '*', '/'],
      },
      numberRange: {
        easy: { min: 1, max: 10 },
        medium: { min: 1, max: 20 },
        hard: { min: 1, max: 50 },
      },
      complexity: {
        easy: 2, // 2 operations: a + b
        medium: 3, // 3 operations: a + b * c
        hard: 4, // 4 operations: a + b * c - d
      },
      allowFractions: false,
      allowDecimals: false,
      allowNegatives: false,
    };
  }

  /**
   * Get the captcha type
   */
  getType(): CaptchaType {
    return 'math';
  }

  /**
   * Get supported difficulty levels
   */
  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium', 'hard'];
  }

  /**
   * Generate a mathematical captcha
   */
  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);

    const difficulty = input.difficulty;
    const problem = this.generateProblem(difficulty);

    // Generate session ID
    const sessionId = this.generateSecureRandom(32);

    // Log security event
    this.logSecurityEvent('captcha_generated' as SecurityEventType, sessionId, {
      action: 'generate',
      resource: 'captcha',
      reason: 'Math captcha generation',
      metadata: {
        type: 'math',
        difficulty,
        expression: problem.expression,
        answer: problem.answer,
      },
    });

    return {
      sessionId,
      challenge: problem.expression,
      type: 'math',
      difficulty,
      expiresIn: 300000, // 5 minutes default
      metadata: {
        ip: 'unknown',
        userAgent: 'unknown',
        fingerprint: 'unknown',
        behavioralData: {
          mouseMovements: [],
          keystrokeTimings: [],
          interactionPatterns: [],
        },
        deviceInfo: {
          browser: 'unknown',
          os: 'unknown',
          screenResolution: 'unknown',
          timezone: 'unknown',
          language: 'unknown',
        },
      },
    };
  }

  /**
   * Validate a mathematical captcha response
   */
  async validate(sessionId: string, response: string): Promise<boolean> {
    // In a real implementation, this would check against stored session data
    // For now, we'll log the validation attempt
    this.logSecurityEvent('captcha_validated' as SecurityEventType, sessionId, {
      action: 'validate',
      resource: 'captcha',
      reason: 'Math captcha validation',
      metadata: {
        type: 'math',
        responseLength: response.length,
      },
    });

    // Placeholder: In production, this would verify against the stored answer
    // The actual validation would be handled by the CaptchaService
    return true;
  }

  /**
   * Generate a math problem based on difficulty
   */
  private generateProblem(difficulty: Difficulty): MathProblem {
    const operations = this.config.operations[difficulty];
    const complexity = this.config.complexity[difficulty];
    const numberRange = this.config.numberRange[difficulty];

    // Generate numbers
    const numbers: number[] = [];
    for (let i = 0; i < complexity; i++) {
      numbers.push(this.generateNumber(numberRange.min, numberRange.max));
    }

    // Generate operations
    const ops: string[] = [];

    // For medium difficulty, guarantee at least one multiplication
    if (difficulty === 'medium') {
      // Ensure multiplication is included by forcing it at a random position
      const multPosition = Math.floor(Math.random() * (complexity - 1));
      for (let i = 0; i < complexity - 1; i++) {
        if (i === multPosition) {
          ops.push('*');
        } else {
          // Only use + and - for other positions to ensure * stands out
          const otherOps = operations.filter(op => op !== '*');
          ops.push(otherOps[Math.floor(Math.random() * otherOps.length)]);
        }
      }
    } else if (difficulty === 'hard') {
      // Ensure division is included by forcing it at a random position
      const divPosition = Math.floor(Math.random() * (complexity - 1));
      for (let i = 0; i < complexity - 1; i++) {
        if (i === divPosition) {
          ops.push('/');
        } else {
          // Only use +, -, and * for other positions to ensure / stands out
          const otherOps = operations.filter(op => op !== '/');
          ops.push(otherOps[Math.floor(Math.random() * otherOps.length)]);
        }
      }
    } else {
      for (let i = 0; i < complexity - 1; i++) {
        ops.push(operations[Math.floor(Math.random() * operations.length)]);
      }
    }

    // Build expression and calculate answer
    const { expression, answer, steps } = this.buildExpression(numbers, ops, difficulty);

    return {
      expression,
      answer,
      steps,
    };
  }

  /**
   * Build expression and calculate answer with PEMDAS
   */
  private buildExpression(
    numbers: number[],
    operations: string[],
    difficulty: Difficulty
  ): MathProblem {
    let expression = '';
    let answer = 0;
    const steps: string[] = [];

    // For easy difficulty, simple left-to-right calculation
    if (difficulty === 'easy') {
      answer = numbers[0];
      expression = `${numbers[0]}`;

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const num = numbers[i + 1];

        expression += ` ${op} ${num}`;
        answer = this.calculate(answer, op, num);
        steps.push(`${expression} = ${answer}`);
      }
    } else {
      // For medium/hard, implement PEMDAS
      const result = this.evaluateWithPEMDAS(numbers, operations);
      expression = result.expression;
      answer = result.answer;
      steps.push(...result.steps);
    }

    return {
      expression: `${expression} = ?`,
      answer: Math.round(answer * 100) / 100, // Round to 2 decimal places
      steps,
    };
  }

  /**
   * Evaluate expression with PEMDAS (Parentheses, Exponents, Multiplication/Division, Addition/Subtraction)
   */
  private evaluateWithPEMDAS(
    numbers: number[],
    operations: string[]
  ): { expression: string; answer: number; steps: string[] } {
    // Create tokens array
    const tokens: (number | string)[] = [numbers[0]];
    for (let i = 0; i < operations.length; i++) {
      tokens.push(operations[i]);
      tokens.push(numbers[i + 1]);
    }

    // First pass: handle multiplication and division
    let i = 1;
    while (i < tokens.length - 1) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        const left = tokens[i - 1] as number;
        const right = tokens[i + 1] as number;
        const result = this.calculate(left, token as string, right);

        // Replace the operation with result
        tokens.splice(i - 1, 3, result);
        i = Math.max(1, i - 1);
      } else {
        i += 2;
      }
    }

    // Second pass: handle addition and subtraction
    let answer = tokens[0] as number;
    let expression = `${tokens[0]}`;
    const steps: string[] = [];

    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i] as string;
      const num = tokens[i + 1] as number;

      expression += ` ${op} ${num}`;
      answer = this.calculate(answer, op, num);
      steps.push(`${expression} = ${answer}`);
    }

    return { expression, answer, steps };
  }

  /**
   * Calculate result of operation
   */
  private calculate(left: number, operation: string, right: number): number {
    switch (operation) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) {
          return left; // Avoid division by zero
        }
        return left / right;
      default:
        return left;
    }
  }

  /**
   * Generate random number within range
   */
  private generateNumber(min: number, max: number): number {
    const range = max - min;
    return Math.floor(Math.random() * (range + 1)) + min;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MathCaptchaConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current math captcha configuration
   */
  getMathConfig(): MathCaptchaConfig {
    return { ...this.config };
  }

  /**
   * Get answer for a given expression (for testing/validation)
   */
  getAnswerForExpression(expression: string): number {
    // Remove the "= ?" part
    const cleanExpression = expression.replace(/\s*=\s*\?$/, '');

    // Parse and evaluate the expression
    return this.evaluateExpression(cleanExpression);
  }

  /**
   * Evaluate expression string
   */
  private evaluateExpression(expression: string): number {
    // Simple expression parser for basic arithmetic
    const tokens = expression.match(/(\d+\.?\d*|\+|-|\*|\/)/g);
    if (!tokens) {
      return 0;
    }

    const numbers: number[] = [];
    const operations: string[] = [];

    for (const token of tokens) {
      if (/^\d/.test(token)) {
        numbers.push(parseFloat(token));
      } else {
        operations.push(token);
      }
    }

    // Evaluate with PEMDAS
    const result = this.evaluateWithPEMDAS(numbers, operations);
    return result.answer;
  }
}
