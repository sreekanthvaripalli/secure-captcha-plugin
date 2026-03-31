/**
 * Svelte Component for Secure CAPTCHA
 * Provides Svelte components and stores for CAPTCHA integration
 *
 * Note: This module requires Svelte to be installed as a peer dependency.
 * Install with: npm install svelte
 */

// Type definitions for Svelte store (to avoid requiring Svelte at compile time)
type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;
type StartStopNotifier<T> = (set: (value: T) => void) => void | (() => void);

interface Readable<T> {
  subscribe(subscriber: Subscriber<T>): Unsubscriber;
}

interface Writable<T> extends Readable<T> {
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

// Dynamic import for Svelte store to make it optional
let svelteStore: {
  writable: <T>(value: T, start?: StartStopNotifier<T>) => Writable<T>;
  derived: <S, T>(stores: Readable<S>, fn: (value: S) => T) => Readable<T>;
  get: <T>(store: Readable<T>) => T;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  svelteStore = require('svelte/store');
} catch {
  // Svelte not installed - provide fallback implementations
  svelteStore = {
    writable: <T>(value: T): Writable<T> => {
      let currentValue = value;
      const subscribers = new Set<Subscriber<T>>();
      return {
        subscribe(subscriber: Subscriber<T>): Unsubscriber {
          subscriber(currentValue);
          subscribers.add(subscriber);
          return () => subscribers.delete(subscriber);
        },
        set(newValue: T): void {
          currentValue = newValue;
          subscribers.forEach(sub => sub(currentValue));
        },
        update(updater: (value: T) => T): void {
          currentValue = updater(currentValue);
          subscribers.forEach(sub => sub(currentValue));
        },
      };
    },
    derived: <S, T>(stores: Readable<S>, fn: (value: S) => T): Readable<T> => {
      let derivedValue: T;
      const subscribers = new Set<Subscriber<T>>();
      stores.subscribe((value: S) => {
        derivedValue = fn(value);
        subscribers.forEach(sub => sub(derivedValue));
      });
      return {
        subscribe(subscriber: Subscriber<T>): Unsubscriber {
          subscriber(derivedValue);
          subscribers.add(subscriber);
          return () => subscribers.delete(subscriber);
        },
      };
    },
    get: <T>(store: Readable<T>): T => {
      let value: T;
      store.subscribe((v: T) => {
        value = v;
      })();
      return value!;
    },
  };
}

// Use non-null assertion since we always provide fallback implementations
const { writable, derived, get } = svelteStore as {
  writable: <T>(value: T, start?: StartStopNotifier<T>) => Writable<T>;
  derived: <S, T>(stores: Readable<S>, fn: (value: S) => T) => Readable<T>;
  get: <T>(store: Readable<T>) => T;
};

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
 * CAPTCHA store interface
 */
export interface CaptchaStore {
  /** Current CAPTCHA state */
  state: Readable<CaptchaState>;
  /** Generate a new CAPTCHA */
  generate: (type?: CaptchaType, difficulty?: Difficulty) => Promise<CaptchaResponse>;
  /** Validate CAPTCHA response */
  validate: (response: string) => Promise<ValidationResponse>;
  /** Reset CAPTCHA state */
  reset: () => void;
  /** Available CAPTCHA types */
  availableTypes: Readable<CaptchaType[]>;
  /** Theme configuration */
  theme: Readable<Required<CaptchaTheme>>;
  /** Configuration options */
  options: Readable<Required<CaptchaOptions>>;
}

/**
 * CaptchaWidget props
 */
export interface CaptchaWidgetProps {
  /** CAPTCHA type to display */
  type?: CaptchaType;
  /** Difficulty level */
  difficulty?: Difficulty;
  /** Theme customization */
  theme?: CaptchaTheme;
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
}

// ============================================================================
// STORE
// ============================================================================

let captchaServiceInstance: CaptchaService | null = null;

function getCaptchaService(): CaptchaService {
  if (!captchaServiceInstance) {
    captchaServiceInstance = new CaptchaService();
  }
  return captchaServiceInstance;
}

/**
 * Create a CAPTCHA store
 * @param options - CAPTCHA configuration options
 * @param theme - Theme configuration
 * @returns CaptchaStore instance
 */
export function createCaptchaStore(
  options: CaptchaOptions = {},
  theme: CaptchaTheme = {}
): CaptchaStore {
  const captchaService = getCaptchaService();

  const mergedThemeStore: Writable<Required<CaptchaTheme>> = writable({
    ...defaultTheme,
    ...theme,
  });

  const mergedOptionsStore: Writable<Required<CaptchaOptions>> = writable({
    types: options.types || ['text', 'math', 'logic', 'image'],
    defaultDifficulty: options.defaultDifficulty || 'medium',
    sessionTimeout: options.sessionTimeout || 300000,
    maxAttempts: options.maxAttempts || 3,
    enableBehavioralAnalysis: options.enableBehavioralAnalysis ?? true,
    enableDeviceFingerprinting: options.enableDeviceFingerprinting ?? true,
    apiEndpoint: options.apiEndpoint || '/api/v1/captcha',
    headers: options.headers || {},
    autoRefreshInterval: options.autoRefreshInterval || 0,
  });

  const stateStore: Writable<CaptchaState> = writable({
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

  let autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

  const clearAutoRefresh = (): void => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  };

  const startAutoRefresh = (): void => {
    clearAutoRefresh();
    const options = get(mergedOptionsStore);
    const state = get(stateStore);

    if (options.autoRefreshInterval > 0 && state.sessionId && !state.isValidated) {
      autoRefreshInterval = setInterval(() => {
        const currentState = get(stateStore);
        if (currentState.expiresIn !== null && currentState.expiresIn <= 0) {
          generate(currentState.type || undefined, currentState.difficulty || undefined);
        } else {
          stateStore.update(s => ({
            ...s,
            expiresIn: s.expiresIn !== null ? s.expiresIn - 1 : null,
          }));
        }
      }, 1000);
    }
  };

  const generate = async (
    type?: CaptchaType,
    difficulty?: Difficulty
  ): Promise<CaptchaResponse> => {
    const options = get(mergedOptionsStore);
    const captchaType = type || options.types[0];
    const captchaDifficulty = difficulty || options.defaultDifficulty;

    stateStore.update(s => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await captchaService.generateCaptcha(captchaType, captchaDifficulty, {
        enableBehavioralAnalysis: options.enableBehavioralAnalysis,
        enableDeviceFingerprinting: options.enableDeviceFingerprinting,
      });

      stateStore.set({
        isLoading: false,
        error: null,
        sessionId: response.sessionId,
        challenge: response.challenge,
        type: response.type,
        difficulty: response.difficulty,
        expiresIn: response.expiresIn,
        isValidated: false,
        validationResult: null,
        attempts: 0,
      });

      startAutoRefresh();

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate CAPTCHA';
      stateStore.update(s => ({
        ...s,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  const validate = async (response: string): Promise<ValidationResponse> => {
    const state = get(stateStore);
    const options = get(mergedOptionsStore);

    if (!state.sessionId || !state.type) {
      throw new Error('No active CAPTCHA session');
    }

    if (state.attempts >= options.maxAttempts) {
      throw new Error('Maximum validation attempts exceeded');
    }

    stateStore.update(s => ({ ...s, isLoading: true, error: null }));

    try {
      const result = await captchaService.validateResponse(
        state.sessionId as string,
        response,
        state.type as CaptchaType
      );

      stateStore.update(s => ({
        ...s,
        isLoading: false,
        isValidated: result.valid,
        validationResult: result,
        attempts: s.attempts + 1,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      stateStore.update(s => ({
        ...s,
        isLoading: false,
        error: errorMessage,
        attempts: s.attempts + 1,
      }));
      throw error;
    }
  };

  const reset = (): void => {
    clearAutoRefresh();
    stateStore.set({
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
  };

  const availableTypesStore = derived(mergedOptionsStore, _options =>
    captchaService.getAvailableTypes()
  );

  return {
    state: { subscribe: stateStore.subscribe },
    generate,
    validate,
    reset,
    availableTypes: availableTypesStore,
    theme: { subscribe: mergedThemeStore.subscribe },
    options: { subscribe: mergedOptionsStore.subscribe },
  };
}

// ============================================================================
// SVELTE ACTION
// ============================================================================

/**
 * Svelte action for CAPTCHA integration
 * Use this action to integrate CAPTCHA functionality into any element
 *
 * @example
 * ```svelte
 * <script>
 *   import { captchaAction } from 'secure-captcha-plugin/svelte';
 *
 *   let captchaStore;
 * </script>
 *
 * <div use:captchaAction={{ store: captchaStore, onValidate: handleValidate }}>
 *   <!-- Your content here -->
 * </div>
 * ```
 */
export function captchaAction(
  node: HTMLElement,
  params: {
    store?: CaptchaStore;
    options?: CaptchaOptions;
    theme?: CaptchaTheme;
    onGenerate?: (response: CaptchaResponse) => void;
    onValidate?: (result: ValidationResponse) => void;
    onError?: (error: Error) => void;
  } = {}
): { destroy: () => void; update: (newParams: typeof params) => void } {
  let store = params.store || createCaptchaStore(params.options, params.theme);

  const handleGenerate = params.onGenerate;
  const handleValidate = params.onValidate;
  const handleError = params.onError;

  // Store the original handlers for cleanup
  const originalGenerate = store.generate;
  const originalValidate = store.validate;

  // Wrap generate to call onGenerate callback
  const wrappedGenerate = async (
    type?: CaptchaType,
    difficulty?: Difficulty
  ): Promise<CaptchaResponse> => {
    try {
      const response = await originalGenerate(type, difficulty);
      handleGenerate?.(response);
      return response;
    } catch (error) {
      handleError?.(error as Error);
      throw error;
    }
  };

  // Wrap validate to call onValidate callback
  const wrappedValidate = async (response: string): Promise<ValidationResponse> => {
    try {
      const result = await originalValidate(response);
      handleValidate?.(result);
      return result;
    } catch (error) {
      handleError?.(error as Error);
      throw error;
    }
  };

  // Replace store methods with wrapped versions
  store.generate = wrappedGenerate;
  store.validate = wrappedValidate;

  // Store the store instance on the node for access
  (node as unknown as { __captchaStore: CaptchaStore }).__captchaStore = store;

  return {
    destroy(): void {
      store.reset();
      (node as unknown as { __captchaStore?: CaptchaStore }).__captchaStore = undefined;
    },
    update(newParams: typeof params): void {
      // Update store if new options/theme provided
      if (newParams.options || newParams.theme) {
        store = createCaptchaStore(newParams.options, newParams.theme);
        (node as unknown as { __captchaStore: CaptchaStore }).__captchaStore = store;
      }
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get container styles based on theme
 */
export function getContainerStyle(theme: Required<CaptchaTheme>): string {
  return `
    font-family: ${theme.fontFamily};
    font-size: ${theme.fontSize};
    padding: ${theme.padding};
    background-color: ${theme.backgroundColor};
    border: 1px solid ${theme.borderColor};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadow};
    max-width: 400px;
  `;
}

/**
 * Get button styles based on theme
 */
export function getButtonStyle(theme: Required<CaptchaTheme>, disabled: boolean = false): string {
  return `
    background-color: ${theme.primaryColor};
    color: #ffffff;
    border: none;
    border-radius: ${theme.borderRadius}px;
    padding: 8px 16px;
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    opacity: ${disabled ? 0.6 : 1};
    font-family: ${theme.fontFamily};
    font-size: ${theme.fontSize};
    transition: background-color 0.2s;
  `;
}

/**
 * Get input styles based on theme
 */
export function getInputStyle(theme: Required<CaptchaTheme>, hasError: boolean = false): string {
  return `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid ${hasError ? theme.errorColor : theme.borderColor};
    border-radius: ${theme.borderRadius}px;
    font-family: ${theme.fontFamily};
    font-size: ${theme.fontSize};
    color: ${theme.textColor};
    background-color: #ffffff;
    outline: none;
    box-sizing: border-box;
  `;
}

/**
 * Get challenge styles based on theme
 */
export function getChallengeStyle(theme: Required<CaptchaTheme>): string {
  return `
    padding: 16px;
    background-color: #f9fafb;
    border-radius: ${theme.borderRadius}px;
    margin-bottom: 12px;
    text-align: center;
    font-family: monospace;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
    color: ${theme.textColor};
    user-select: none;
  `;
}

/**
 * Get type button styles based on theme
 */
export function getTypeButtonStyle(theme: Required<CaptchaTheme>, isActive: boolean): string {
  return `
    padding: 4px 12px;
    border: 1px solid ${isActive ? theme.primaryColor : theme.borderColor};
    border-radius: ${theme.borderRadius}px;
    background-color: ${isActive ? theme.primaryColor : theme.backgroundColor};
    color: ${isActive ? '#ffffff' : theme.textColor};
    cursor: pointer;
    font-family: ${theme.fontFamily};
    font-size: 12px;
    transition: all 0.2s;
  `;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createCaptchaStore,
  captchaAction,
  defaultTheme,
  getContainerStyle,
  getButtonStyle,
  getInputStyle,
  getChallengeStyle,
  getTypeButtonStyle,
} as {
  createCaptchaStore: typeof createCaptchaStore;
  captchaAction: typeof captchaAction;
  defaultTheme: typeof defaultTheme;
  getContainerStyle: typeof getContainerStyle;
  getButtonStyle: typeof getButtonStyle;
  getInputStyle: typeof getInputStyle;
  getChallengeStyle: typeof getChallengeStyle;
  getTypeButtonStyle: typeof getTypeButtonStyle;
};
