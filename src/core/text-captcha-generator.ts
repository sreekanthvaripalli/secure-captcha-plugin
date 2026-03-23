/**
 * Text-Based Captcha Generator
 * Generates cryptographically secure text captchas with image generation
 */

import { BaseCaptchaGenerator } from './captcha-generator';
import { SecurityConfigurationService } from '../security/config';
import { CaptchaType, Difficulty, GenerateCaptchaInput, CaptchaResponse } from '../types/captcha';
import { SecurityEventType } from '../types/security';

import sharp from 'sharp';

export interface TextCaptchaConfig {
  length: {
    easy: number;
    medium: number;
    hard: number;
  };
  charset: string;
  fontSize: {
    easy: number;
    medium: number;
    hard: number;
  };
  noiseLevel: {
    easy: number;
    medium: number;
    hard: number;
  };
  distortionLevel: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export class TextCaptchaGenerator extends BaseCaptchaGenerator {
  private readonly config: TextCaptchaConfig;

  constructor(configService: SecurityConfigurationService) {
    super(configService);
    
    // Default configuration
    this.config = {
      length: {
        easy: 4,
        medium: 6,
        hard: 8
      },
      charset: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', // Excludes similar characters
      fontSize: {
        easy: 48,
        medium: 42,
        hard: 36
      },
      noiseLevel: {
        easy: 0.5,
        medium: 1.0,
        hard: 1.5
      },
      distortionLevel: {
        easy: 0.3,
        medium: 0.6,
        hard: 0.9
      }
    };
  }

  /**
   * Get the captcha type
   */
  getType(): CaptchaType {
    return 'text';
  }

  /**
   * Get supported difficulty levels
   */
  getSupportedDifficulties(): Difficulty[] {
    return ['easy', 'medium', 'hard'];
  }

  /**
   * Generate a text-based captcha
   */
  async generate(input: GenerateCaptchaInput): Promise<CaptchaResponse> {
    this.validateInput(input);

    const difficulty = input.difficulty;
    const textLength = this.config.length[difficulty];
    
    // Generate cryptographically secure random text
    const text = this.generateSecureRandom(textLength, this.config.charset);
    
    // Generate image with the text
    const imageBuffer = await this.generateImage(text, difficulty);
    
    // Convert image to base64 for transmission
    const base64Image = imageBuffer.toString('base64');
    const challenge = `data:image/png;base64,${base64Image}`;
    
    // Generate session ID
    const sessionId = this.generateSecureRandom(32);
    
    // Log security event
    this.logSecurityEvent('captcha_generated' as SecurityEventType, sessionId, {
      type: 'text',
      difficulty,
      textLength,
      hasNoise: true,
      hasDistortion: true
    });

    return {
      sessionId,
      challenge,
      type: 'text',
      difficulty,
      expiresIn: 300000, // 5 minutes default
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
  }

  /**
   * Validate a text captcha response
   */
  async validate(sessionId: string, response: string): Promise<boolean> {
    // In a real implementation, this would check against stored session data
    // For now, we'll log the validation attempt
    this.logSecurityEvent('captcha_validated' as SecurityEventType, sessionId, {
      type: 'text',
      responseLength: response.length
    });

    // Placeholder: In production, this would verify against the stored answer
    // The actual validation would be handled by the CaptchaService
    return true;
  }

  /**
   * Generate image with text, noise, and distortion
   */
  private async generateImage(text: string, difficulty: Difficulty): Promise<Buffer> {
    const fontSize = this.config.fontSize[difficulty];
    const noiseLevel = this.config.noiseLevel[difficulty];
    const distortionLevel = this.config.distortionLevel[difficulty];

    // Create SVG with text and effects
    const svg = this.createSVG(text, fontSize, noiseLevel, distortionLevel);
    
    // Convert SVG to PNG using Sharp
    const imageBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    return imageBuffer;
  }

  /**
   * Create SVG with text, noise, and distortion effects
   */
  private createSVG(text: string, fontSize: number, noiseLevel: number, distortionLevel: number): string {
    const width = 200;
    const height = 80;
    
    // Generate random colors
    const bgColor = this.generateRandomColor(200, 255);
    
    // Create noise lines
    const noiseLines = this.generateNoiseLines(noiseLevel, width, height);
    
    // Create distortion effect
    const distortion = this.generateDistortion(distortionLevel);
    
    // Create text with individual character positioning
    const textElements = this.createTextElements(text, fontSize, width, height, distortion);
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="distort">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="${distortion * 10}" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
            <feColorMatrix type="saturate" values="0"/>
            <feBlend in="SourceGraphic" in2="noise" mode="multiply"/>
          </filter>
        </defs>
        
        <!-- Background -->
        <rect width="100%" height="100%" fill="rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})"/>
        
        <!-- Noise lines -->
        ${noiseLines}
        
        <!-- Text with distortion -->
        <g filter="url(#distort)">
          ${textElements}
        </g>
        
        <!-- Additional noise overlay -->
        <rect width="100%" height="100%" fill="url(#noisePattern)" opacity="${noiseLevel * 0.3}"/>
      </svg>
    `;
  }

  /**
   * Create text elements with individual character positioning
   */
  private createTextElements(text: string, fontSize: number, width: number, height: number, distortion: number): string {
    let elements = '';
    const charWidth = fontSize * 0.6;
    const startX = (width - (text.length * charWidth)) / 2;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = startX + (i * charWidth);
      const y = height / 2 + fontSize / 3;
      
      // Add random rotation and position variation
      const rotation = (Math.random() - 0.5) * distortion * 30;
      const yOffset = (Math.random() - 0.5) * distortion * 10;
      
      const color = this.generateRandomColor(0, 100);
      
      elements += `
        <text 
          x="${x}" 
          y="${y + yOffset}" 
          font-family="Arial, sans-serif" 
          font-size="${fontSize}px" 
          font-weight="bold"
          fill="rgb(${color.r}, ${color.g}, ${color.b})"
          transform="rotate(${rotation} ${x} ${y})"
          text-anchor="middle"
        >${char}</text>
      `;
    }
    
    return elements;
  }

  /**
   * Generate random noise lines
   */
  private generateNoiseLines(noiseLevel: number, width: number, height: number): string {
    let lines = '';
    const numLines = Math.floor(noiseLevel * 10);
    
    for (let i = 0; i < numLines; i++) {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const color = this.generateRandomColor(100, 200);
      const strokeWidth = Math.random() * 2 + 1;
      
      lines += `
        <line 
          x1="${x1}" y1="${y1}" 
          x2="${x2}" y2="${y2}" 
          stroke="rgb(${color.r}, ${color.g}, ${color.b})" 
          stroke-width="${strokeWidth}"
          opacity="${0.3 + Math.random() * 0.4}"
        />
      `;
    }
    
    return lines;
  }

  /**
   * Generate distortion effect parameters
   */
  private generateDistortion(level: number): number {
    return level * (0.5 + Math.random() * 0.5);
  }

  /**
   * Generate random RGB color within range
   */
  private generateRandomColor(min: number, max: number): { r: number; g: number; b: number } {
    const range = max - min;
    return {
      r: Math.floor(min + Math.random() * range),
      g: Math.floor(min + Math.random() * range),
      b: Math.floor(min + Math.random() * range)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TextCaptchaConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): TextCaptchaConfig {
    return { ...this.config };
  }
}