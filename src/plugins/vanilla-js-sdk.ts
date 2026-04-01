/**
 * Vanilla JavaScript SDK for Secure CAPTCHA
 * Zero-dependency SDK for integrating CAPTCHA into any web application
 *
 * This SDK provides:
 * - CaptchaClient: API client for server communication
 * - CaptchaWidget: DOM-based widget rendering
 * - Event system for callbacks
 * - Theme customization
 * - TypeScript types
 */

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
 * Event handlers for CAPTCHA widget
 */
export interface CaptchaEventHandlers {
  /** Called when CAPTCHA is generated */
  onGenerate?: (response: CaptchaResponse) => void;
  /** Called when CAPTCHA is validated */
  onValidate?: (result: ValidationResponse) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when CAPTCHA is reset */
  onReset?: () => void;
  /** Called when CAPTCHA expires */
  onExpire?: () => void;
}

/**
 * Widget configuration
 */
export interface CaptchaWidgetConfig {
  /** Container element or selector */
  container: HTMLElement | string;
  /** CAPTCHA type to display */
  type?: CaptchaType;
  /** Difficulty level */
  difficulty?: Difficulty;
  /** Theme customization */
  theme?: CaptchaTheme;
  /** Event handlers */
  handlers?: CaptchaEventHandlers;
  /** Whether to auto-generate on mount */
  autoGenerate?: boolean;
  /** Whether widget is disabled */
  disabled?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Submit button text */
  submitText?: string;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Whether to show type selector */
  showTypeSelector?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * CaptchaClient options
 */
export interface CaptchaClientOptions {
  /** API base URL */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Whether to use local CaptchaService (for testing) */
  useLocalService?: boolean;
}

// ============================================================================
// CAPTCHA CLIENT
// ============================================================================

/**
 * CaptchaClient - API client for server communication
 * Provides methods to interact with CAPTCHA server or local service
 */
export class CaptchaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  private readonly useLocalService: boolean;
  private readonly captchaService: CaptchaService | null = null;

  constructor(options: CaptchaClientOptions = {}) {
    this.baseUrl = options.baseUrl || '/api/v1/captcha';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    this.useLocalService = options.useLocalService || false;

    if (this.useLocalService) {
      this.captchaService = new CaptchaService();
    }
  }

  /**
   * Generate a new CAPTCHA
   */
  async generate(
    type: CaptchaType = 'text',
    difficulty: Difficulty = 'medium'
  ): Promise<CaptchaResponse> {
    if (this.useLocalService && this.captchaService) {
      return this.captchaService.generateCaptcha(type, difficulty);
    }

    const response = await this.fetch('/generate', {
      method: 'POST',
      body: JSON.stringify({ type, difficulty }),
    });

    return response.json() as Promise<CaptchaResponse>;
  }

  /**
   * Validate CAPTCHA response
   */
  async validate(
    sessionId: string,
    response: string,
    type: CaptchaType
  ): Promise<ValidationResponse> {
    if (this.useLocalService && this.captchaService) {
      return this.captchaService.validateResponse(sessionId, response, type);
    }

    const res = await this.fetch('/validate', {
      method: 'POST',
      body: JSON.stringify({ sessionId, response, type }),
    });

    return res.json() as Promise<ValidationResponse>;
  }

  /**
   * Get available CAPTCHA types
   */
  async getTypes(): Promise<CaptchaType[]> {
    if (this.useLocalService && this.captchaService) {
      return this.captchaService.getAvailableTypes();
    }

    const response = await this.fetch('/types');
    const data = (await response.json()) as { types: CaptchaType[] };
    return data.types;
  }

  /**
   * Make HTTP request with error handling
   */
  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const config: RequestInit = {
      ...init,
      headers: {
        ...this.headers,
        ...init.headers,
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Get local CaptchaService (for testing)
   */
  getLocalService(): CaptchaService | null {
    return this.captchaService;
  }
}

// ============================================================================
// CAPTCHA WIDGET
// ============================================================================

/**
 * CaptchaWidget - DOM-based CAPTCHA widget
 * Renders a CAPTCHA challenge with input and validation
 */
export class CaptchaWidget {
  private readonly container: HTMLElement;
  private readonly client: CaptchaClient;
  private state: CaptchaState;
  private readonly options: Required<CaptchaOptions>;
  private readonly theme: Required<CaptchaTheme>;
  private readonly handlers: CaptchaEventHandlers;
  private autoRefreshInterval: number | null = null;
  private selectedType: CaptchaType;
  private inputElement: HTMLInputElement | null = null;
  private challengeElement: HTMLElement | null = null;
  private errorElement: HTMLElement | null = null;
  private successElement: HTMLElement | null = null;
  private attemptsElement: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private isDestroyed = false;

  constructor(config: CaptchaWidgetConfig, client?: CaptchaClient) {
    // Resolve container
    if (typeof config.container === 'string') {
      const element = document.querySelector(config.container);
      if (!element) {
        throw new Error(`Container not found: ${config.container}`);
      }
      this.container = element as HTMLElement;
    } else {
      this.container = config.container;
    }

    // Initialize client
    this.client = client || new CaptchaClient({ useLocalService: true });

    // Initialize state
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

    // Initialize options
    this.options = {
      types: config.type ? [config.type] : ['text', 'math', 'logic', 'image'],
      defaultDifficulty: config.difficulty || 'medium',
      sessionTimeout: 300000,
      maxAttempts: 3,
      enableBehavioralAnalysis: true,
      enableDeviceFingerprinting: true,
      apiEndpoint: '/api/v1/captcha',
      headers: {},
      autoRefreshInterval: 0,
    };

    // Initialize theme
    this.theme = { ...defaultTheme, ...config.theme };

    // Initialize handlers
    this.handlers = config.handlers || {};

    // Initialize selected type
    this.selectedType = config.type || this.options.types[0];

    // Render widget
    this.render(config);

    // Auto-generate if enabled
    if (config.autoGenerate !== false) {
      this.generate();
    }
  }

  /**
   * Generate a new CAPTCHA
   */
  async generate(type?: CaptchaType, difficulty?: Difficulty): Promise<CaptchaResponse> {
    if (this.isDestroyed) {
      throw new Error('Widget has been destroyed');
    }

    const captchaType = type || this.selectedType;
    const captchaDifficulty = difficulty || this.options.defaultDifficulty;

    this.setState({ isLoading: true, error: null });

    try {
      const response = await this.client.generate(captchaType, captchaDifficulty);

      this.setState({
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

      this.updateUI();
      this.handlers.onGenerate?.(response);

      // Set up auto-refresh timer
      this.setupAutoRefresh();

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate CAPTCHA';
      this.setState({ isLoading: false, error: errorMessage });
      this.updateUI();
      this.handlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Validate CAPTCHA response
   */
  async validate(response: string): Promise<ValidationResponse> {
    if (this.isDestroyed) {
      throw new Error('Widget has been destroyed');
    }

    if (!this.state.sessionId || !this.state.type) {
      throw new Error('No active CAPTCHA session');
    }

    if (this.state.attempts >= this.options.maxAttempts) {
      throw new Error('Maximum validation attempts exceeded');
    }

    this.setState({ isLoading: true, error: null });

    try {
      const result = await this.client.validate(this.state.sessionId, response, this.state.type);

      this.setState({
        isLoading: false,
        isValidated: result.valid,
        validationResult: result,
        attempts: this.state.attempts + 1,
      });

      this.updateUI();
      this.handlers.onValidate?.(result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      this.setState({ isLoading: false, error: errorMessage, attempts: this.state.attempts + 1 });
      this.updateUI();
      this.handlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Reset CAPTCHA state
   */
  reset(): void {
    if (this.isDestroyed) {
      return;
    }

    this.clearAutoRefresh();
    this.setState({
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

    this.updateUI();
    this.handlers.onReset?.();
  }

  /**
   * Destroy widget and cleanup resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clearAutoRefresh();
    this.container.innerHTML = '';
  }

  /**
   * Get current state
   */
  getState(): CaptchaState {
    return { ...this.state };
  }

  /**
   * Get available types
   */
  async getAvailableTypes(): Promise<CaptchaType[]> {
    return this.client.getTypes();
  }

  /**
   * Set state and trigger re-render
   */
  private setState(partial: Partial<CaptchaState>): void {
    this.state = { ...this.state, ...partial };
  }

  /**
   * Setup auto-refresh timer
   */
  private setupAutoRefresh(): void {
    this.clearAutoRefresh();

    if (this.options.autoRefreshInterval > 0 && this.state.sessionId && !this.state.isValidated) {
      this.autoRefreshInterval = window.setInterval(() => {
        if (this.state.expiresIn !== null && this.state.expiresIn <= 0) {
          this.handlers.onExpire?.();
          this.generate();
        } else if (this.state.expiresIn !== null) {
          this.setState({ expiresIn: this.state.expiresIn - 1 });
          this.updateTimerUI();
        }
      }, 1000);
    }
  }

  /**
   * Clear auto-refresh timer
   */
  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  /**
   * Render widget HTML
   */
  private render(config: CaptchaWidgetConfig): void {
    const widget = document.createElement('div');
    widget.className = `captcha-widget ${config.className || ''}`;
    widget.style.cssText = this.getContainerStyle();

    // Type selector
    if (config.showTypeSelector) {
      const typeSelector = this.createTypeSelector();
      widget.appendChild(typeSelector);
    }

    // Challenge display
    const challengeDiv = document.createElement('div');
    challengeDiv.className = 'captcha-challenge';
    challengeDiv.style.cssText = this.getChallengeStyle();
    challengeDiv.textContent = 'Loading...';
    this.challengeElement = challengeDiv;
    widget.appendChild(challengeDiv);

    // Input field
    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.placeholder || 'Enter CAPTCHA';
    input.style.cssText = this.getInputStyle();
    input.setAttribute('aria-label', 'CAPTCHA response');
    this.inputElement = input;
    inputWrapper.appendChild(input);

    // Refresh button
    if (config.showRefresh !== false) {
      const refreshBtn = document.createElement('button');
      refreshBtn.type = 'button';
      refreshBtn.textContent = '↻';
      refreshBtn.setAttribute('aria-label', 'Refresh CAPTCHA');
      refreshBtn.style.cssText = `
        ${this.getButtonStyle()}
        padding: 8px 12px;
        background-color: ${this.theme.secondaryColor};
      `;
      refreshBtn.addEventListener('click', () => {
        this.reset();
        this.generate();
      });
      inputWrapper.appendChild(refreshBtn);
    }

    widget.appendChild(inputWrapper);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.textContent = config.submitText || 'Verify';
    submitBtn.style.cssText = `${this.getButtonStyle()} width: 100%;`;
    submitBtn.addEventListener('click', () => {
      const value = this.inputElement?.value.trim();
      if (value) {
        this.validate(value);
      }
    });
    widget.appendChild(submitBtn);

    // Error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      color: ${this.theme.errorColor};
      font-size: 12px;
      margin-top: 4px;
    `;
    this.errorElement = errorDiv;
    widget.appendChild(errorDiv);

    // Success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      color: ${this.theme.successColor};
      font-size: 12px;
      margin-top: 4px;
    `;
    this.successElement = successDiv;
    widget.appendChild(successDiv);

    // Timer
    const timerDiv = document.createElement('div');
    timerDiv.style.cssText = `
      font-size: 11px;
      color: ${this.theme.secondaryColor};
      margin-top: 8px;
    `;
    this.timerElement = timerDiv;
    widget.appendChild(timerDiv);

    // Attempts counter
    const attemptsDiv = document.createElement('div');
    attemptsDiv.style.cssText = `
      font-size: 11px;
      color: ${this.theme.secondaryColor};
      margin-top: 4px;
    `;
    this.attemptsElement = attemptsDiv;
    widget.appendChild(attemptsDiv);

    // Enter key handler
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        const value = (e.target as HTMLInputElement).value.trim();
        if (value) {
          this.validate(value);
        }
      }
    });

    this.container.innerHTML = '';
    this.container.appendChild(widget);
  }

  /**
   * Create type selector
   */
  private createTypeSelector(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    `;

    this.options.types.forEach(type => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      btn.style.cssText = this.getTypeButtonStyle(type === this.selectedType);
      btn.addEventListener('click', () => {
        this.selectedType = type;
        this.reset();
        this.generate(type);
      });
      container.appendChild(btn);
    });

    return container;
  }

  /**
   * Update UI based on current state
   */
  private updateUI(): void {
    if (
      !this.challengeElement ||
      !this.inputElement ||
      !this.errorElement ||
      !this.successElement ||
      !this.timerElement ||
      !this.attemptsElement
    ) {
      return;
    }

    // Update challenge
    if (this.state.isLoading) {
      this.challengeElement.textContent = 'Loading...';
      this.challengeElement.style.color = this.theme.secondaryColor;
    } else if (this.state.challenge) {
      this.challengeElement.textContent = this.state.challenge;
      this.challengeElement.style.color = this.theme.textColor;
    } else {
      this.challengeElement.textContent = '';
    }

    // Update input state
    this.inputElement.disabled = this.state.isLoading || this.state.isValidated;
    this.inputElement.style.borderColor = this.state.error
      ? this.theme.errorColor
      : this.theme.borderColor;

    // Update error message
    this.errorElement.textContent = this.state.error || '';

    // Update success message
    if (this.state.isValidated && this.state.validationResult?.valid) {
      this.successElement.textContent = '✓ Verified successfully!';
    } else if (
      this.state.validationResult &&
      !this.state.validationResult.valid &&
      !this.state.error
    ) {
      this.successElement.textContent = this.state.validationResult.message || '';
      this.successElement.style.color = this.theme.errorColor;
    } else {
      this.successElement.textContent = '';
    }

    // Update timer
    this.updateTimerUI();

    // Update attempts counter
    if (this.state.attempts > 0 && !this.state.isValidated) {
      this.attemptsElement.textContent = `Attempts: ${this.state.attempts}/${this.options.maxAttempts}`;
    } else {
      this.attemptsElement.textContent = '';
    }
  }

  /**
   * Update timer UI
   */
  private updateTimerUI(): void {
    if (!this.timerElement) {
      return;
    }

    if (this.state.expiresIn !== null && this.state.expiresIn > 0 && !this.state.isValidated) {
      this.timerElement.textContent = `Expires in ${this.state.expiresIn} seconds`;
    } else {
      this.timerElement.textContent = '';
    }
  }

  /**
   * Get container style string
   */
  private getContainerStyle(): string {
    return `
      font-family: ${this.theme.fontFamily};
      font-size: ${this.theme.fontSize};
      padding: ${this.theme.padding};
      background-color: ${this.theme.backgroundColor};
      border: 1px solid ${this.theme.borderColor};
      border-radius: ${this.theme.borderRadius}px;
      box-shadow: ${this.theme.boxShadow};
      max-width: 400px;
    `;
  }

  /**
   * Get button style string
   */
  private getButtonStyle(): string {
    return `
      background-color: ${this.theme.primaryColor};
      color: #ffffff;
      border: none;
      border-radius: ${this.theme.borderRadius}px;
      padding: 8px 16px;
      cursor: pointer;
      font-family: ${this.theme.fontFamily};
      font-size: ${this.theme.fontSize};
      transition: background-color 0.2s;
    `;
  }

  /**
   * Get input style string
   */
  private getInputStyle(): string {
    return `
      flex: 1;
      padding: 8px 12px;
      border: 1px solid ${this.theme.borderColor};
      border-radius: ${this.theme.borderRadius}px;
      font-family: ${this.theme.fontFamily};
      font-size: ${this.theme.fontSize};
      color: ${this.theme.textColor};
      background-color: #ffffff;
      outline: none;
      box-sizing: border-box;
    `;
  }

  /**
   * Get challenge style string
   */
  private getChallengeStyle(): string {
    return `
      padding: 16px;
      background-color: #f9fafb;
      border-radius: ${this.theme.borderRadius}px;
      margin-bottom: 12px;
      text-align: center;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2px;
      color: ${this.theme.textColor};
      user-select: none;
    `;
  }

  /**
   * Get type button style string
   */
  private getTypeButtonStyle(isActive: boolean): string {
    return `
      padding: 4px 12px;
      border: 1px solid ${isActive ? this.theme.primaryColor : this.theme.borderColor};
      border-radius: ${this.theme.borderRadius}px;
      background-color: ${isActive ? this.theme.primaryColor : this.theme.backgroundColor};
      color: ${isActive ? '#ffffff' : this.theme.textColor};
      cursor: pointer;
      font-family: ${this.theme.fontFamily};
      font-size: 12px;
      transition: all 0.2s;
    `;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a CAPTCHA widget
 * Convenience function for quick integration
 *
 * @example
 * ```javascript
 * // Simple usage
 * const captcha = createCaptchaWidget({
 *   container: '#captcha-container',
 *   onValidate: (result) => {
 *     if (result.valid) {
 *       console.log('CAPTCHA verified!');
 *     }
 *   }
 * });
 *
 * // With custom options
 * const captcha = createCaptchaWidget({
 *   container: document.getElementById('my-captcha'),
 *   type: 'math',
 *   difficulty: 'hard',
 *   theme: {
 *     primaryColor: '#6366f1',
 *     borderRadius: 12
 *   },
 *   handlers: {
 *     onGenerate: (response) => console.log('Generated:', response.sessionId),
 *     onValidate: (result) => console.log('Validated:', result.valid),
 *     onError: (error) => console.error('Error:', error.message)
 *   }
 * });
 * ```
 */
export function createCaptchaWidget(
  config: CaptchaWidgetConfig,
  client?: CaptchaClient
): CaptchaWidget {
  return new CaptchaWidget(config, client);
}

// ============================================================================
// GLOBAL INITIALIZATION
// ============================================================================

/**
 * Initialize CAPTCHA widgets from data attributes
 * Automatically finds elements with data-captcha attribute and creates widgets
 *
 * @example
 * ```html
 * <div data-captcha
 *      data-captcha-type="math"
 *      data-captcha-difficulty="medium"
 *      data-captcha-primary-color="#6366f1">
 * </div>
 * ```
 */
export function initCaptchaWidgets(): CaptchaWidget[] {
  const elements = document.querySelectorAll('[data-captcha]');
  const widgets: CaptchaWidget[] = [];

  elements.forEach(element => {
    const el = element as HTMLElement;
    const config: CaptchaWidgetConfig = {
      container: el,
      type: (el.dataset.captchaType as CaptchaType) || undefined,
      difficulty: (el.dataset.captchaDifficulty as Difficulty) || undefined,
      autoGenerate: el.dataset.captchaAutoGenerate !== 'false',
      showRefresh: el.dataset.captchaShowRefresh !== 'false',
      showTypeSelector: el.dataset.captchaShowTypeSelector === 'true',
      placeholder: el.dataset.captchaPlaceholder || undefined,
      submitText: el.dataset.captchaSubmitText || undefined,
      className: el.dataset.captchaClassName || undefined,
      theme: {
        primaryColor: el.dataset.captchaPrimaryColor || undefined,
        secondaryColor: el.dataset.captchaSecondaryColor || undefined,
        backgroundColor: el.dataset.captchaBackgroundColor || undefined,
        textColor: el.dataset.captchaTextColor || undefined,
        borderColor: el.dataset.captchaBorderColor || undefined,
        errorColor: el.dataset.captchaErrorColor || undefined,
        successColor: el.dataset.captchaSuccessColor || undefined,
        borderRadius: el.dataset.captchaBorderRadius
          ? parseInt(el.dataset.captchaBorderRadius, 10)
          : undefined,
        fontFamily: el.dataset.captchaFontFamily || undefined,
        fontSize: el.dataset.captchaFontSize || undefined,
        padding: el.dataset.captchaPadding || undefined,
        boxShadow: el.dataset.captchaBoxShadow || undefined,
      },
    };

    // Remove undefined values from theme
    const theme = config.theme as Record<string, string | number | undefined>;
    Object.keys(theme).forEach(key => {
      if (theme[key] === undefined) {
        delete theme[key];
      }
    });

    try {
      const widget = createCaptchaWidget(config);
      widgets.push(widget);

      // Store widget reference on element
      (el as unknown as { __captchaWidget: CaptchaWidget }).__captchaWidget = widget;
    } catch (error) {
      console.error('Failed to initialize CAPTCHA widget:', error);
    }
  });

  return widgets;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CaptchaClient,
  CaptchaWidget,
  createCaptchaWidget,
  initCaptchaWidgets,
  defaultTheme,
};
