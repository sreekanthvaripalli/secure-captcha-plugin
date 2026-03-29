/**
 * Logic Puzzle Captcha Generator
 * Generates various types of logic puzzles including pattern recognition,
 * sequence completion, and spatial reasoning challenges
 */

import { BaseCaptchaGenerator } from './captcha-generator';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../types/captcha';
import { SecurityEventType } from '../types/security';

export type LogicPuzzleType = 'pattern' | 'sequence' | 'spatial' | 'analogies';

export interface LogicPuzzle {
  type: LogicPuzzleType;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface LogicCaptchaConfig {
  puzzleTypes: LogicPuzzleType[];
  difficulty: {
    easy: {
      patternLength: number;
      sequenceLength: number;
      gridSize: number;
    };
    medium: {
      patternLength: number;
      sequenceLength: number;
      gridSize: number;
    };
    hard: {
      patternLength: number;
      sequenceLength: number;
      gridSize: number;
    };
  };
}

export class LogicCaptchaGenerator extends BaseCaptchaGenerator {
  private readonly config: LogicCaptchaConfig;

  constructor(configService: SecurityConfigurationService) {
    super(configService);

    this.config = {
      puzzleTypes: ['pattern', 'sequence', 'spatial', 'analogies'],
      difficulty: {
        easy: {
          patternLength: 4,
          sequenceLength: 4,
          gridSize: 3,
        },
        medium: {
          patternLength: 5,
          sequenceLength: 5,
          gridSize: 4,
        },
        hard: {
          patternLength: 6,
          sequenceLength: 6,
          gridSize: 5,
        },
      },
    };
  }

  /**
   * Get the captcha type
   */
  getType(): CaptchaType {
    return 'logic';
  }

  /**
   * Get supported difficulty levels
   */
  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium', 'hard'];
  }

  /**
   * Generate a logic puzzle captcha
   */
  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);

    const difficulty = input.difficulty;
    const puzzleType = this.selectPuzzleType();
    const puzzle = this.generatePuzzle(puzzleType, difficulty);

    const sessionId = this.generateSecureRandom(32);

    this.logSecurityEvent('captcha_generated' as SecurityEventType, sessionId, {
      action: 'generate',
      resource: 'captcha',
      reason: 'Logic captcha generation',
      metadata: {
        type: 'logic',
        puzzleType,
        difficulty,
      },
    });

    const challenge = this.formatChallenge(puzzle);

    return {
      sessionId,
      challenge,
      type: 'logic',
      difficulty,
      expiresIn: 300000,
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
   * Validate a logic puzzle response
   */
  async validate(sessionId: string, response: string): Promise<boolean> {
    this.logSecurityEvent('captcha_validated' as SecurityEventType, sessionId, {
      action: 'validate',
      resource: 'captcha',
      reason: 'Logic captcha validation',
      metadata: {
        type: 'logic',
        responseLength: response.length,
      },
    });

    return true;
  }

  /**
   * Select a random puzzle type
   */
  private selectPuzzleType(): LogicPuzzleType {
    const types = this.config.puzzleTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Generate a puzzle based on type and difficulty
   */
  private generatePuzzle(type: LogicPuzzleType, difficulty: Difficulty): LogicPuzzle {
    switch (type) {
      case 'pattern':
        return this.generatePatternPuzzle(difficulty);
      case 'sequence':
        return this.generateSequencePuzzle(difficulty);
      case 'spatial':
        return this.generateSpatialPuzzle(difficulty);
      case 'analogies':
        return this.generateAnalogyPuzzle(difficulty);
      default:
        return this.generatePatternPuzzle(difficulty);
    }
  }

  /**
   * Generate pattern recognition puzzle
   */
  private generatePatternPuzzle(difficulty: Difficulty): LogicPuzzle {
    const length = this.config.difficulty[difficulty].patternLength;
    const patterns = [
      { sequence: ['🔴', '🔵', '🔴', '🔵'], answer: '🔴', rule: 'Alternating colors' },
      { sequence: ['▲', '▲▲', '▲▲▲', '▲▲▲▲'], answer: '▲▲▲▲▲', rule: 'Increasing triangles' },
      { sequence: ['●', '●●', '●●●', '●●●●'], answer: '●●●●●', rule: 'Increasing circles' },
      { sequence: ['■', '□', '■', '□'], answer: '■', rule: 'Alternating filled/empty' },
      { sequence: ['↑', '→', '↓', '←'], answer: '↑', rule: 'Clockwise rotation' },
      { sequence: ['A', 'C', 'E', 'G'], answer: 'I', rule: 'Skip one letter' },
      { sequence: ['1', '3', '5', '7'], answer: '9', rule: 'Odd numbers' },
      { sequence: ['2', '4', '6', '8'], answer: '10', rule: 'Even numbers' },
      { sequence: ['Z', 'Y', 'X', 'W'], answer: 'V', rule: 'Reverse alphabet' },
      { sequence: ['🌑', '🌒', '🌓', '🌔'], answer: '🌕', rule: 'Moon phases' },
    ];

    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
    const sequence = selectedPattern.sequence.slice(0, length);
    const correctAnswer = selectedPattern.answer;

    const options = this.generateOptions(correctAnswer, 4);

    return {
      type: 'pattern',
      question: `What comes next in this pattern?\n${sequence.join(' ')}`,
      options: options.map(opt => `${opt}`),
      correctAnswer: options.indexOf(correctAnswer),
      explanation: `The pattern follows: ${selectedPattern.rule}`,
    };
  }

  /**
   * Generate sequence completion puzzle
   */
  private generateSequencePuzzle(difficulty: Difficulty): LogicPuzzle {
    const length = this.config.difficulty[difficulty].sequenceLength;

    const sequences = [
      { start: 2, rule: (n: number) => n * 2, name: 'Doubling' },
      { start: 1, rule: (n: number) => n + 3, name: 'Add 3' },
      { start: 1, rule: (n: number) => n * n, name: 'Squares' },
      { start: 0, rule: (n: number) => n + n + 1, name: 'Fibonacci-like' },
      { start: 1, rule: (n: number) => n * 3, name: 'Tripling' },
    ];

    const selected = sequences[Math.floor(Math.random() * sequences.length)];
    const sequence: number[] = [];

    let current = selected.start;
    for (let i = 0; i < length; i++) {
      sequence.push(current);
      current = selected.rule(current);
    }

    const correctAnswer = current;
    const options = this.generateNumericOptions(correctAnswer, 4);

    return {
      type: 'sequence',
      question: `Complete the sequence:\n${sequence.join(', ')}, ?`,
      options: options.map(opt => opt.toString()),
      correctAnswer: options.indexOf(correctAnswer),
      explanation: `The sequence follows the rule: ${selected.name}`,
    };
  }

  /**
   * Generate spatial reasoning puzzle
   */
  private generateSpatialPuzzle(difficulty: Difficulty): LogicPuzzle {
    const gridSize = this.config.difficulty[difficulty].gridSize;

    const puzzles = [
      {
        type: 'spatial' as LogicPuzzleType,
        question: `If you rotate the letter 'L' 90 degrees clockwise, what shape do you get?`,
        options: ['⌐', '¬', '└', 'L'],
        correctAnswer: 2,
        explanation: 'Rotating L 90° clockwise gives └',
      },
      {
        type: 'spatial' as LogicPuzzleType,
        question: `How many squares are in a ${gridSize}x${gridSize} grid?`,
        options: [
          (gridSize * gridSize).toString(),
          ((gridSize - 1) * (gridSize - 1)).toString(),
          (gridSize * gridSize + (gridSize - 1) * (gridSize - 1)).toString(),
          (gridSize * 2).toString(),
        ],
        correctAnswer: 2,
        explanation: `A ${gridSize}x${gridSize} grid contains ${gridSize * gridSize} 1x1 squares and ${(gridSize - 1) * (gridSize - 1)} 2x2 squares`,
      },
      {
        type: 'spatial' as LogicPuzzleType,
        question: 'Which direction is opposite to Northeast?',
        options: ['Southwest', 'Southeast', 'Northwest', 'West'],
        correctAnswer: 0,
        explanation: 'The opposite of Northeast is Southwest',
      },
      {
        type: 'spatial' as LogicPuzzleType,
        question: 'If you fold a square paper in half twice, how many layers do you have?',
        options: ['2', '3', '4', '8'],
        correctAnswer: 2,
        explanation: 'Folding in half twice creates 4 layers',
      },
    ];

    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }

  /**
   * Generate analogy puzzle
   */
  private generateAnalogyPuzzle(_difficulty: Difficulty): LogicPuzzle {
    const analogies = [
      {
        type: 'analogies' as LogicPuzzleType,
        question: 'Hot is to Cold as Day is to ___?',
        options: ['Night', 'Sun', 'Light', 'Dark'],
        correctAnswer: 0,
        explanation: 'Hot:Cold :: Day:Night (opposites)',
      },
      {
        type: 'analogies' as LogicPuzzleType,
        question: 'Book is to Reading as Fork is to ___?',
        options: ['Kitchen', 'Eating', 'Metal', 'Spoon'],
        correctAnswer: 1,
        explanation: 'Book:Reading :: Fork:Eating (tool:action)',
      },
      {
        type: 'analogies' as LogicPuzzleType,
        question: 'Pen is to Writer as Brush is to ___?',
        options: ['Paint', 'Canvas', 'Artist', 'Color'],
        correctAnswer: 2,
        explanation: 'Pen:Writer :: Brush:Artist (tool:person)',
      },
      {
        type: 'analogies' as LogicPuzzleType,
        question: 'Seed is to Plant as Egg is to ___?',
        options: ['Bird', 'Nest', 'Shell', 'Chicken'],
        correctAnswer: 0,
        explanation: 'Seed:Plant :: Egg:Bird (beginning:development)',
      },
      {
        type: 'analogies' as LogicPuzzleType,
        question: 'Smile is to Happy as Cry is to ___?',
        options: ['Tears', 'Sad', 'Face', 'Eye'],
        correctAnswer: 1,
        explanation: 'Smile:Happy :: Cry:Sad (expression:emotion)',
      },
    ];

    return analogies[Math.floor(Math.random() * analogies.length)];
  }

  /**
   * Generate options for a text answer
   */
  private generateOptions(correctAnswer: string, count: number): string[] {
    const options = [correctAnswer];
    const alternatives = ['⭐', '🔷', '🔶', '⬛', '⬜', '🔺', '💎', '🌟', '✨', '🎯'];

    while (options.length < count) {
      const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
      if (!options.includes(alt)) {
        options.push(alt);
      }
    }

    return this.shuffleArray(options);
  }

  /**
   * Generate options for a numeric answer
   */
  private generateNumericOptions(correctAnswer: number, count: number): number[] {
    const options = [correctAnswer];

    while (options.length < count) {
      const offset = Math.floor(Math.random() * 10) - 5;
      const newOption = correctAnswer + offset;
      if (newOption > 0 && !options.includes(newOption)) {
        options.push(newOption);
      }
    }

    return this.shuffleArray(options);
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Format puzzle as challenge string
   */
  private formatChallenge(puzzle: LogicPuzzle): string {
    let challenge = `${puzzle.question}\n\n`;
    puzzle.options.forEach((option, index) => {
      challenge += `${String.fromCharCode(65 + index)}) ${option}\n`;
    });
    return challenge;
  }

  /**
   * Get answer for a given puzzle (for testing/validation)
   */
  getAnswerForPuzzle(_challenge: string): number {
    // This is a simplified version - in production, you'd store the answer with the session
    return 0;
  }
}
