/**
 * Angular Component for Secure CAPTCHA
 * Provides Angular components and services for CAPTCHA integration
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgModule,
  Injectable,
  InjectionToken,
  Inject,
  Optional,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaptchaService } from '../core/captcha-service';
import { CaptchaType, Difficulty, CaptchaResponse, ValidationResponse } from '../types/captcha';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Theme configuration for CAPTCHA widget
 */
export interface CaptchaTheme {
  /** Primary color for the widget */
  primaryColor?: string;
  /** Secondary color for accents */
  secondaryColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Border color */
  borderColor?: string;
  /** Error color */
  errorColor?: string;
  /** Success color */
  successColor?: string;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize?: string;
  /** Padding */
  padding?: string;
  /** Box shadow */
  boxShadow?: string;
}

/**
 * Default theme configuration
 */
export const defaultTheme: Required<CaptchaTheme> = {
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderColor: '#e5e7eb',
  errorColor: '#ef4444',
  successColor: '#22c55e',
  borderRadius: 8,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  padding: '16px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

/**
 * CAPTCHA configuration options
 */
export interface CaptchaOptions {
  /** CAPTCHA types to support */
  types?: CaptchaType[];
  /** Default difficulty level */
  defaultDifficulty?: Difficulty;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Maximum validation attempts */
  maxAttempts?: number;
  /** Enable behavioral analysis */
  enableBehavioralAnalysis?: boolean;
  /** Enable device fingerprinting */
  enableDeviceFingerprinting?: boolean;
  /** API endpoint for CAPTCHA operations */
  apiEndpoint?: string;
  /** Custom headers for API requests */
  headers?: Record<string, string>;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
}

/**
 * CAPTCHA state
 */
export interface CaptchaState {
  /** Whether CAPTCHA is loading */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Current CAPTCHA session ID */
  sessionId: string | null;
  /** Current CAPTCHA challenge */
  challenge: string | null;
  /** Current CAPTCHA type */
  type: CaptchaType | null;
  /** Current difficulty */
  difficulty: Difficulty | null;
  /** Time until expiration in seconds */
  expiresIn: number | null;
  /** Whether CAPTCHA has been validated */
  isValidated: boolean;
  /** Validation result */
  validationResult: ValidationResponse | null;
  /** Number of validation attempts */
  attempts: number;
}

/**
 * Angular CAPTCHA configuration token
 */
export const CAPTCHA_CONFIG = new InjectionToken<CaptchaOptions>('CAPTCHA_CONFIG');

/**
 * Angular CAPTCHA theme token
 */
export const CAPTCHA_THEME = new InjectionToken<CaptchaTheme>('CAPTCHA_THEME');

// ============================================================================
// SERVICE
// ============================================================================

/**
 * AngularCaptchaService
 * Provides CAPTCHA functionality to Angular components
 */
@Injectable({
  providedIn: 'root',
})
export class AngularCaptchaService {
  private captchaService: CaptchaService;
  private state: CaptchaState;
  private autoRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private mergedOptions: Required<CaptchaOptions>;
  private mergedTheme: Required<CaptchaTheme>;

  constructor(
    @Optional() @Inject(CAPTCHA_CONFIG) config: CaptchaOptions | null,
    @Optional() @Inject(CAPTCHA_THEME) theme: CaptchaTheme | null
  ) {
    this.captchaService = new CaptchaService();

    this.mergedTheme = {
      ...defaultTheme,
      ...(theme || {}),
    };

    this.mergedOptions = {
      types: config?.types || ['text', 'math', 'logic', 'image'],
      defaultDifficulty: config?.defaultDifficulty || 'medium',
      sessionTimeout: config?.sessionTimeout || 300000,
      maxAttempts: config?.maxAttempts || 3,
      enableBehavioralAnalysis: config?.enableBehavioralAnalysis ?? true,
      enableDeviceFingerprinting: config?.enableDeviceFingerprinting ?? true,
      apiEndpoint: config?.apiEndpoint || '/api/v1/captcha',
      headers: config?.headers || {},
      autoRefreshInterval: config?.autoRefreshInterval || 0,
    };

    this.state = {
      isLoading: false,
      error: null,
      sessionId: null,
      challenge: null,
      type: null,
      difficulty: null,
      expiresIn: null,
      isValidated: false,
      validationResult: null,
      attempts: 0,
    };
  }

  /**
   * Get current CAPTCHA state
   */
  getState(): CaptchaState {
    return { ...this.state };
  }

  /**
   * Get available CAPTCHA types
   */
  getAvailableTypes(): CaptchaType[] {
    return this.captchaService.getAvailableTypes();
  }

  /**
   * Get current theme
   */
  getTheme(): Required<CaptchaTheme> {
    return { ...this.mergedTheme };
  }

  /**
   * Get current options
   */
  getOptions(): Required<CaptchaOptions> {
    return { ...this.mergedOptions };
  }

  /**
   * Generate a new CAPTCHA
   */
  async generate(type?: CaptchaType, difficulty?: Difficulty): Promise<CaptchaResponse> {
    const captchaType = type || this.mergedOptions.types[0];
    const captchaDifficulty = difficulty || this.mergedOptions.defaultDifficulty;

    this.updateState({ isLoading: true, error: null });

    try {
      const response = await this.captchaService.generateCaptcha(captchaType, captchaDifficulty, {
        enableBehavioralAnalysis: this.mergedOptions.enableBehavioralAnalysis,
        enableDeviceFingerprinting: this.mergedOptions.enableDeviceFingerprinting,
      });

      this.updateState({
        isLoading: false,
        sessionId: response.sessionId,
        challenge: response.challenge,
        type: response.type,
        difficulty: response.difficulty,
        expiresIn: response.expiresIn,
        isValidated: false,
        validationResult: null,
        attempts: 0,
      });

      this.startAutoRefresh();

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate CAPTCHA';
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Validate CAPTCHA response
   */
  async validate(response: string): Promise<ValidationResponse> {
    if (!this.state.sessionId || !this.state.type) {
      throw new Error('No active CAPTCHA session');
    }

    if (this.state.attempts >= this.mergedOptions.maxAttempts) {
      throw new Error('Maximum validation attempts exceeded');
    }

    this.updateState({ isLoading: true, error: null });

    try {
      const result = await this.captchaService.validateResponse(
        this.state.sessionId!,
        response,
        this.state.type!
      );

      this.updateState({
        isLoading: false,
        isValidated: result.valid,
        validationResult: result,
        attempts: this.state.attempts + 1,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      this.updateState({
        isLoading: false,
        error: errorMessage,
        attempts: this.state.attempts + 1,
      });
      throw error;
    }
  }

  /**
   * Reset CAPTCHA state
   */
  reset(): void {
    this.clearAutoRefresh();
    this.updateState({
      isLoading: false,
      error: null,
      sessionId: null,
      challenge: null,
      type: null,
      difficulty: null,
      expiresIn: null,
      isValidated: false,
      validationResult: null,
      attempts: 0,
    });
  }

  /**
   * Update theme configuration
   */
  updateTheme(theme: CaptchaTheme): void {
    this.mergedTheme = { ...defaultTheme, ...theme };
  }

  /**
   * Update options configuration
   */
  updateOptions(options: CaptchaOptions): void {
    this.mergedOptions = {
      types: options.types || ['text', 'math', 'logic', 'image'],
      defaultDifficulty: options.defaultDifficulty || 'medium',
      sessionTimeout: options.sessionTimeout || 300000,
      maxAttempts: options.maxAttempts || 3,
      enableBehavioralAnalysis: options.enableBehavioralAnalysis ?? true,
      enableDeviceFingerprinting: options.enableDeviceFingerprinting ?? true,
      apiEndpoint: options.apiEndpoint || '/api/v1/captcha',
      headers: options.headers || {},
      autoRefreshInterval: options.autoRefreshInterval || 0,
    };
  }

  private updateState(updates: Partial<CaptchaState>): void {
    this.state = { ...this.state, ...updates };
  }

  private startAutoRefresh(): void {
    this.clearAutoRefresh();
    if (
      this.mergedOptions.autoRefreshInterval > 0 &&
      this.state.sessionId &&
      !this.state.isValidated
    ) {
      this.autoRefreshInterval = setInterval(() => {
        if (this.state.expiresIn !== null && this.state.expiresIn <= 0) {
          this.generate(this.state.type || undefined, this.state.difficulty || undefined);
        } else {
          this.updateState({
            expiresIn: this.state.expiresIn !== null ? this.state.expiresIn - 1 : null,
          });
        }
      }, 1000);
    }
  }

  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.clearAutoRefresh();
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CaptchaWidget component
 * Renders a CAPTCHA challenge with input and validation
 */
@Component({
  selector: 'captcha-widget',
  template: `
    <div class="captcha-widget" [ngStyle]="containerStyle">
      <!-- Type Selector -->
      <div *ngIf="showTypeSelector" class="type-selector" [ngStyle]="typeSelectorStyle">
        <button
          *ngFor="let t of availableTypes"
          type="button"
          [ngStyle]="getTypeButtonStyle(t === selectedType)"
          (click)="handleTypeChange(t)"
          [disabled]="disabled || state.isLoading"
        >
          {{ t.charAt(0).toUpperCase() + t.slice(1) }}
        </button>
      </div>

      <!-- Challenge Display -->
      <div
        *ngIf="state.isLoading"
        [ngStyle]="{ ...challengeStyle, color: mergedTheme.secondaryColor }"
      >
        Loading...
      </div>
      <ng-container *ngIf="!state.isLoading">
        <!-- Image-based challenges -->
        <img
          *ngIf="state.type === 'image' && state.challenge?.startsWith('data:')"
          [src]="state.challenge"
          alt="CAPTCHA Challenge"
          [ngStyle]="{ maxWidth: '100%', height: 'auto' }"
        />
        <!-- Text/math/logic challenges -->
        <div
          *ngIf="state.type !== 'image' || !state.challenge?.startsWith('data:')"
          [ngStyle]="challengeStyle"
        >
          {{ state.challenge }}
        </div>
      </ng-container>

      <!-- Input Field -->
      <div [ngStyle]="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
        <input
          type="text"
          [(ngModel)]="inputValue"
          (keypress)="handleKeyPress($event)"
          [placeholder]="placeholder"
          [disabled]="disabled || state.isLoading || state.isValidated"
          [ngStyle]="inputStyle"
          aria-label="CAPTCHA response"
        />
        <button
          *ngIf="showRefresh"
          type="button"
          (click)="handleRefresh()"
          [disabled]="disabled || state.isLoading"
          [ngStyle]="{
            ...buttonStyle,
            padding: '8px 12px',
            backgroundColor: mergedTheme.secondaryColor,
          }"
          aria-label="Refresh CAPTCHA"
        >
          ↻
        </button>
      </div>

      <!-- Submit Button -->
      <button
        type="button"
        (click)="handleValidate()"
        [disabled]="disabled || state.isLoading || !inputValue?.trim() || state.isValidated"
        [ngStyle]="{ ...buttonStyle, width: '100%' }"
      >
        {{ state.isLoading ? 'Verifying...' : submitText }}
      </button>

      <!-- Status Messages -->
      <div *ngIf="state.error" [ngStyle]="errorStyle">{{ state.error }}</div>
      <div *ngIf="state.isValidated && state.validationResult?.valid" [ngStyle]="successStyle">
        ✓ Verified successfully!
      </div>
      <div
        *ngIf="state.validationResult && !state.validationResult.valid && !state.error"
        [ngStyle]="errorStyle"
      >
        {{ state.validationResult.message }}
      </div>

      <!-- Expiration Timer -->
      <div
        *ngIf="state.expiresIn !== null && state.expiresIn > 0 && !state.isValidated"
        [ngStyle]="{ fontSize: '11px', color: mergedTheme.secondaryColor, marginTop: '8px' }"
      >
        Expires in {{ state.expiresIn }} seconds
      </div>

      <!-- Attempts Counter -->
      <div
        *ngIf="state.attempts > 0 && !state.isValidated"
        [ngStyle]="{ fontSize: '11px', color: mergedTheme.secondaryColor, marginTop: '4px' }"
      >
        Attempts: {{ state.attempts }}/{{ options.maxAttempts }}
      </div>
    </div>
  `,
  styles: [
    `
      .captcha-widget {
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
      }
      .type-selector {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaptchaWidgetComponent implements OnInit, OnDestroy {
  @Input() type?: CaptchaType;
  @Input() difficulty?: Difficulty;
  @Input() theme?: CaptchaTheme;
  @Input() autoGenerate = true;
  @Input() disabled = false;
  @Input() placeholder = 'Enter CAPTCHA';
  @Input() submitText = 'Verify';
  @Input() showRefresh = true;
  @Input() showTypeSelector = false;

  @Output() generateEvent = new EventEmitter<CaptchaResponse>();
  @Output() validateEvent = new EventEmitter<ValidationResponse>();
  @Output() errorEvent = new EventEmitter<Error>();

  state: CaptchaState;
  inputValue = '';
  selectedType: CaptchaType;
  availableTypes: CaptchaType[];
  mergedTheme: Required<CaptchaTheme>;
  options: Required<CaptchaOptions>;

  containerStyle: Record<string, string | number>;
  buttonStyle: Record<string, string | number>;
  inputStyle: Record<string, string | number>;
  challengeStyle: Record<string, string | number>;
  errorStyle: Record<string, string | number>;
  successStyle: Record<string, string | number>;
  typeSelectorStyle: Record<string, string | number>;

  constructor(
    private captchaService: AngularCaptchaService,
    private cdr: ChangeDetectorRef
  ) {
    this.state = this.captchaService.getState();
    this.availableTypes = this.captchaService.getAvailableTypes();
    this.mergedTheme = this.captchaService.getTheme();
    this.options = this.captchaService.getOptions();
    this.selectedType = this.type || this.options.types[0];

    this.containerStyle = this.getContainerStyle();
    this.buttonStyle = this.getButtonStyle();
    this.inputStyle = this.getInputStyle();
    this.challengeStyle = this.getChallengeStyle();
    this.errorStyle = this.getErrorStyle();
    this.successStyle = this.getSuccessStyle();
    this.typeSelectorStyle = this.getTypeSelectorStyle();
  }

  ngOnInit(): void {
    if (this.theme) {
      this.mergedTheme = { ...this.mergedTheme, ...this.theme };
      this.captchaService.updateTheme(this.theme);
      this.updateStyles();
    }

    if (this.autoGenerate && !this.state.sessionId) {
      this.handleGenerate();
    }
  }

  ngOnDestroy(): void {
    // Cleanup handled by service
  }

  async handleGenerate(): Promise<void> {
    try {
      const response = await this.captchaService.generate(this.selectedType, this.difficulty);
      this.generateEvent.emit(response);
      this.updateState();
    } catch (error) {
      this.errorEvent.emit(error as Error);
      this.updateState();
    }
  }

  async handleValidate(): Promise<void> {
    if (!this.inputValue?.trim()) {
      return;
    }

    try {
      const result = await this.captchaService.validate(this.inputValue);
      this.validateEvent.emit(result);
      if (!result.valid) {
        this.inputValue = '';
      }
      this.updateState();
    } catch (error) {
      this.errorEvent.emit(error as Error);
      this.updateState();
    }
  }

  handleRefresh(): void {
    this.captchaService.reset();
    this.inputValue = '';
    this.handleGenerate();
  }

  handleTypeChange(newType: CaptchaType): void {
    this.selectedType = newType;
    this.captchaService.reset();
    this.inputValue = '';
    this.captchaService.generate(newType, this.difficulty);
    this.updateState();
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.disabled && !this.state.isLoading) {
      this.handleValidate();
    }
  }

  getTypeButtonStyle(isActive: boolean): Record<string, string | number> {
    return {
      padding: '4px 12px',
      border: `1px solid ${isActive ? this.mergedTheme.primaryColor : this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      backgroundColor: isActive ? this.mergedTheme.primaryColor : this.mergedTheme.backgroundColor,
      color: isActive ? '#ffffff' : this.mergedTheme.textColor,
      cursor: 'pointer',
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: '12px',
      transition: 'all 0.2s',
    };
  }

  private updateState(): void {
    this.state = this.captchaService.getState();
    this.cdr.markForCheck();
  }

  private updateStyles(): void {
    this.containerStyle = this.getContainerStyle();
    this.buttonStyle = this.getButtonStyle();
    this.inputStyle = this.getInputStyle();
    this.challengeStyle = this.getChallengeStyle();
    this.errorStyle = this.getErrorStyle();
    this.successStyle = this.getSuccessStyle();
    this.typeSelectorStyle = this.getTypeSelectorStyle();
  }

  private getContainerStyle(): Record<string, string | number> {
    return {
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: this.mergedTheme.fontSize,
      padding: this.mergedTheme.padding,
      backgroundColor: this.mergedTheme.backgroundColor,
      border: `1px solid ${this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      boxShadow: this.mergedTheme.boxShadow,
      maxWidth: '400px',
    };
  }

  private getButtonStyle(): Record<string, string | number> {
    return {
      backgroundColor: this.mergedTheme.primaryColor,
      color: '#ffffff',
      border: 'none',
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      padding: '8px 16px',
      cursor: this.disabled || this.state.isLoading ? 'not-allowed' : 'pointer',
      opacity: this.disabled || this.state.isLoading ? 0.6 : 1,
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: this.mergedTheme.fontSize,
      transition: 'background-color 0.2s',
    };
  }

  private getInputStyle(): Record<string, string | number> {
    return {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${this.state.error ? this.mergedTheme.errorColor : this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: this.mergedTheme.fontSize,
      color: this.mergedTheme.textColor,
      backgroundColor: '#ffffff',
      outline: 'none',
      boxSizing: 'border-box',
    };
  }

  private getChallengeStyle(): Record<string, string | number> {
    return {
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      marginBottom: '12px',
      textAlign: 'center',
      fontFamily: 'monospace',
      fontSize: '18px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      color: this.mergedTheme.textColor,
      userSelect: 'none',
    };
  }

  private getErrorStyle(): Record<string, string | number> {
    return {
      color: this.mergedTheme.errorColor,
      fontSize: '12px',
      marginTop: '4px',
    };
  }

  private getSuccessStyle(): Record<string, string | number> {
    return {
      color: this.mergedTheme.successColor,
      fontSize: '12px',
      marginTop: '4px',
    };
  }

  private getTypeSelectorStyle(): Record<string, string | number> {
    return {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
      flexWrap: 'wrap',
    };
  }
}

// ============================================================================
// MODULE
// ============================================================================

/**
 * Angular CAPTCHA Module
 * Provides all CAPTCHA components and services
 */
@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [CaptchaWidgetComponent],
  exports: [CaptchaWidgetComponent],
  providers: [AngularCaptchaService],
})
export class AngularCaptchaModule {
  static forRoot(
    options?: CaptchaOptions,
    theme?: CaptchaTheme
  ): {
    ngModule: typeof AngularCaptchaModule;
    providers: Array<{
      provide: InjectionToken<CaptchaOptions | CaptchaTheme>;
      useValue: CaptchaOptions | CaptchaTheme;
    }>;
  } {
    return {
      ngModule: AngularCaptchaModule,
      providers: [
        { provide: CAPTCHA_CONFIG, useValue: options || {} },
        { provide: CAPTCHA_THEME, useValue: theme || {} },
      ],
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  AngularCaptchaModule,
  CaptchaWidgetComponent,
  AngularCaptchaService,
  defaultTheme,
};
