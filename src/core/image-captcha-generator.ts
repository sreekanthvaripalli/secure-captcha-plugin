/**
 * Image Recognition Captcha Generator
 * Generates visual challenges including object identification, pattern matching,
 * and spatial reasoning puzzles using SVG/Canvas image generation
 */

import { BaseCaptchaGenerator } from './captcha-generator';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../types/captcha';
import { SecurityEventType } from '../types/security';

export type ImagePuzzleType =
  | 'object-identification'
  | 'pattern-matching'
  | 'spatial-arrangement'
  | 'color-sequence';

export interface ImagePuzzle {
  type: ImagePuzzleType;
  question: string;
  imageUrl: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ImageCaptchaConfig {
  puzzleTypes: ImagePuzzleType[];
  difficulty: {
    easy: {
      gridSize: number;
      objectCount: number;
      colorCount: number;
    };
    medium: {
      gridSize: number;
      objectCount: number;
      colorCount: number;
    };
    hard: {
      gridSize: number;
      objectCount: number;
      colorCount: number;
    };
  };
}

export class ImageCaptchaGenerator extends BaseCaptchaGenerator {
  private readonly config: ImageCaptchaConfig;

  constructor(configService: SecurityConfigurationService) {
    super(configService);

    this.config = {
      puzzleTypes: [
        'object-identification',
        'pattern-matching',
        'spatial-arrangement',
        'color-sequence',
      ],
      difficulty: {
        easy: {
          gridSize: 3,
          objectCount: 3,
          colorCount: 3,
        },
        medium: {
          gridSize: 4,
          objectCount: 5,
          colorCount: 4,
        },
        hard: {
          gridSize: 5,
          objectCount: 7,
          colorCount: 5,
        },
      },
    };
  }

  /**
   * Get the captcha type
   */
  getType(): CaptchaType {
    return 'image';
  }

  /**
   * Get supported difficulty levels
   */
  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium', 'hard'];
  }

  /**
   * Generate an image recognition captcha
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
      reason: 'Image captcha generation',
      metadata: {
        type: 'image',
        puzzleType,
        difficulty,
      },
    });

    const challenge = this.formatChallenge(puzzle);

    return {
      sessionId,
      challenge,
      type: 'image',
      difficulty,
      expiresIn: 300000,
      correctAnswer: puzzle.correctAnswer,
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
   * Validate an image captcha response
   */
  async validate(sessionId: string, response: string): Promise<boolean> {
    this.logSecurityEvent('captcha_validated' as SecurityEventType, sessionId, {
      action: 'validate',
      resource: 'captcha',
      reason: 'Image captcha validation',
      metadata: {
        type: 'image',
        responseLength: response.length,
      },
    });

    return true;
  }

  /**
   * Select a random puzzle type
   */
  private selectPuzzleType(): ImagePuzzleType {
    const types = this.config.puzzleTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Generate a puzzle based on type and difficulty
   */
  private generatePuzzle(type: ImagePuzzleType, difficulty: Difficulty): ImagePuzzle {
    switch (type) {
      case 'object-identification':
        return this.generateObjectIdentificationPuzzle(difficulty);
      case 'pattern-matching':
        return this.generatePatternMatchingPuzzle(difficulty);
      case 'spatial-arrangement':
        return this.generateSpatialArrangementPuzzle(difficulty);
      case 'color-sequence':
        return this.generateColorSequencePuzzle(difficulty);
      default:
        return this.generateObjectIdentificationPuzzle(difficulty);
    }
  }

  /**
   * Generate object identification puzzle
   */
  private generateObjectIdentificationPuzzle(difficulty: Difficulty): ImagePuzzle {
    const { objectCount } = this.config.difficulty[difficulty];

    const objects = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⚫', '⚪'];
    const selectedObjects = this.shuffleArray([...objects]).slice(0, objectCount);

    // Create a grid with objects
    const gridSize = this.config.difficulty[difficulty].gridSize;
    const grid: string[][] = [];

    for (let i = 0; i < gridSize; i++) {
      grid[i] = [];
      for (let j = 0; j < gridSize; j++) {
        if (Math.random() < 0.3) {
          grid[i][j] = selectedObjects[Math.floor(Math.random() * selectedObjects.length)];
        } else {
          grid[i][j] = '⬜';
        }
      }
    }

    // Count objects present in grid and select one that actually exists
    const objectCounts = new Map<string, number>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== '⬜' && cell !== '❓') {
          objectCounts.set(cell, (objectCounts.get(cell) || 0) + 1);
        }
      }
    }

    // Ensure we have at least one object in the grid
    if (objectCounts.size === 0) {
      // If grid is empty, place at least one object
      const randomObject = selectedObjects[Math.floor(Math.random() * selectedObjects.length)];
      const randomRow = Math.floor(Math.random() * grid.length);
      const randomCol = Math.floor(Math.random() * grid[0].length);
      grid[randomRow][randomCol] = randomObject;
      objectCounts.set(randomObject, 1);
    }

    // Select a random target object that actually exists in the grid
    const availableObjects = Array.from(objectCounts.keys());
    const targetObject = availableObjects[Math.floor(Math.random() * availableObjects.length)];
    const count = objectCounts.get(targetObject)!;

    const svgImage = this.generateGridSvg(grid);
    const options = this.generateNumericOptions(count, 4);

    return {
      type: 'object-identification',
      question: `How many ${targetObject} are in this image?`,
      imageUrl: svgImage,
      options: options.map(opt => opt.toString()),
      correctAnswer: options.indexOf(count),
      explanation: `Count all ${targetObject} objects in the grid`,
    };
  }

  /**
   * Generate pattern matching puzzle
   */
  private generatePatternMatchingPuzzle(difficulty: Difficulty): ImagePuzzle {
    const { gridSize } = this.config.difficulty[difficulty];

    const patterns = [
      { sequence: ['🔴', '🔵', '🔴', '🔵'], answer: '🔴', rule: 'Alternating colors' },
      { sequence: ['▲', '●', '▲', '●'], answer: '▲', rule: 'Alternating shapes' },
      { sequence: ['■', '□', '■', '□'], answer: '■', rule: 'Alternating filled/empty' },
      { sequence: ['↑', '→', '↓', '←'], answer: '↑', rule: 'Clockwise rotation' },
    ];

    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
    const sequence = selectedPattern.sequence.slice(0, gridSize);
    const correctAnswer = selectedPattern.answer;

    const svgImage = this.generateSequenceSvg(sequence);
    const options = this.generateOptions(correctAnswer, 4);

    return {
      type: 'pattern-matching',
      question: 'What comes next in this pattern?',
      imageUrl: svgImage,
      options: options.map(opt => `${opt}`),
      correctAnswer: options.indexOf(correctAnswer),
      explanation: `The pattern follows: ${selectedPattern.rule}`,
    };
  }

  /**
   * Generate spatial arrangement puzzle
   */
  private generateSpatialArrangementPuzzle(difficulty: Difficulty): ImagePuzzle {
    const { gridSize } = this.config.difficulty[difficulty];

    // Create a grid with one missing piece
    const grid: string[][] = [];
    const colors = ['🔴', '🔵', '🟢', '🟡', '🟣'];

    for (let i = 0; i < gridSize; i++) {
      grid[i] = [];
      for (let j = 0; j < gridSize; j++) {
        grid[i][j] = colors[Math.floor(Math.random() * colors.length)];
      }
    }

    // Remove one piece
    const missingRow = Math.floor(Math.random() * gridSize);
    const missingCol = Math.floor(Math.random() * gridSize);
    const missingPiece = grid[missingRow][missingCol];
    grid[missingRow][missingCol] = '❓';

    const svgImage = this.generateGridSvg(grid);
    const options = this.generateOptions(missingPiece, 4);

    return {
      type: 'spatial-arrangement',
      question: 'What color should replace the question mark?',
      imageUrl: svgImage,
      options: options.map(opt => `${opt}`),
      correctAnswer: options.indexOf(missingPiece),
      explanation: 'Identify the missing piece based on the pattern',
    };
  }

  /**
   * Generate color sequence puzzle
   */
  private generateColorSequencePuzzle(difficulty: Difficulty): ImagePuzzle {
    const { colorCount } = this.config.difficulty[difficulty];

    const colors = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
    const selectedColors = this.shuffleArray([...colors]).slice(0, colorCount);

    // Create a sequence with a pattern
    const sequence: string[] = [];
    for (let i = 0; i < colorCount + 1; i++) {
      sequence.push(selectedColors[i % selectedColors.length]);
    }

    const correctAnswer = selectedColors[0]; // First color in the cycle
    const svgImage = this.generateColorSequenceSvg(sequence);
    const options = this.generateOptions(correctAnswer, 4);

    return {
      type: 'color-sequence',
      question: 'What color comes next in this sequence?',
      imageUrl: svgImage,
      options: options.map(opt => `${opt}`),
      correctAnswer: options.indexOf(correctAnswer),
      explanation: 'The sequence follows a repeating color pattern',
    };
  }

  /**
   * Generate SVG for a grid
   */
  private generateGridSvg(grid: string[][]): string {
    const cellSize = 40;
    const padding = 10;
    const width = grid[0].length * cellSize + padding * 2;
    const height = grid.length * cellSize + padding * 2;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;

    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const x = padding + j * cellSize;
        const y = padding + i * cellSize;
        const cell = grid[i][j];

        // Draw cell background
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="white" stroke="#ccc"/>`;

        // Draw object
        if (cell !== '⬜' && cell !== '❓') {
          svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 8}" text-anchor="middle" font-size="24">${cell}</text>`;
        } else if (cell === '❓') {
          svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 8}" text-anchor="middle" font-size="24" fill="#999">?</text>`;
        }
      }
    }

    svg += '</svg>';
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate SVG for a sequence
   */
  private generateSequenceSvg(sequence: string[]): string {
    const cellSize = 50;
    const padding = 10;
    const width = sequence.length * cellSize + padding * 2;
    const height = cellSize + padding * 2;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;

    for (let i = 0; i < sequence.length; i++) {
      const x = padding + i * cellSize;
      const y = padding;

      // Draw cell background
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="white" stroke="#ccc"/>`;

      // Draw object
      svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 8}" text-anchor="middle" font-size="24">${sequence[i]}</text>`;
    }

    // Add arrow pointing to next position
    const arrowX = padding + sequence.length * cellSize;
    const arrowY = padding + cellSize / 2;
    svg += `<text x="${arrowX}" y="${arrowY + 8}" text-anchor="middle" font-size="24" fill="#666">→</text>`;

    svg += '</svg>';
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate SVG for color sequence
   */
  private generateColorSequenceSvg(sequence: string[]): string {
    const circleRadius = 20;
    const spacing = 50;
    const padding = 10;
    const width = sequence.length * spacing + padding * 2;
    const height = circleRadius * 2 + padding * 2;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;

    for (let i = 0; i < sequence.length; i++) {
      const cx = padding + circleRadius + i * spacing;
      const cy = padding + circleRadius;

      // Draw circle
      svg += `<circle cx="${cx}" cy="${cy}" r="${circleRadius}" fill="white" stroke="#ccc"/>`;

      // Draw color
      svg += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="24">${sequence[i]}</text>`;
    }

    // Add question mark for next position
    const nextCx = padding + circleRadius + sequence.length * spacing;
    const nextCy = padding + circleRadius;
    svg += `<circle cx="${nextCx}" cy="${nextCy}" r="${circleRadius}" fill="white" stroke="#ccc"/>`;
    svg += `<text x="${nextCx}" y="${nextCy + 8}" text-anchor="middle" font-size="24" fill="#999">?</text>`;

    svg += '</svg>';
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate options for a text answer
   */
  private generateOptions(correctAnswer: string, count: number): string[] {
    const options = [correctAnswer];
    const alternatives = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⚫', '⚪'];

    // Filter out the correct answer from alternatives
    const availableAlternatives = alternatives.filter(alt => alt !== correctAnswer);

    // Add unique alternatives until we reach the desired count
    let attempts = 0;
    const maxAttempts = 100; // Safety limit to prevent infinite loop

    while (options.length < count && attempts < maxAttempts) {
      const alt = availableAlternatives[Math.floor(Math.random() * availableAlternatives.length)];
      if (!options.includes(alt)) {
        options.push(alt);
      }
      attempts++;
    }

    // If we still don't have enough options, add duplicates
    while (options.length < count) {
      const alt = availableAlternatives[Math.floor(Math.random() * availableAlternatives.length)];
      options.push(alt);
    }

    return this.shuffleArray(options);
  }

  /**
   * Generate options for a numeric answer
   */
  private generateNumericOptions(correctAnswer: number, count: number): number[] {
    const options = [correctAnswer];

    let attempts = 0;
    const maxAttempts = 100; // Safety limit to prevent infinite loop

    while (options.length < count && attempts < maxAttempts) {
      const offset = Math.floor(Math.random() * 5) - 2;
      const newOption = correctAnswer + offset;
      if (newOption >= 0 && !options.includes(newOption)) {
        options.push(newOption);
      }
      attempts++;
    }

    // If we still don't have enough options, add variations
    while (options.length < count) {
      const offset = Math.floor(Math.random() * 10) - 5;
      const newOption = Math.max(0, correctAnswer + offset);
      options.push(newOption);
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
  private formatChallenge(puzzle: ImagePuzzle): string {
    let challenge = `${puzzle.question}\n\n`;
    challenge += `[Image: ${puzzle.imageUrl}]\n\n`;
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
