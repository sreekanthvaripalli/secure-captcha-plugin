/**
 * React Component Library for Secure CAPTCHA
 * Provides React components and hooks for CAPTCHA integration
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { CaptchaService } from '../core/captcha-service';
import { SecurityConfigurationService } from '../security/config';
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
 * CAPTCHA context value
 */
export interface CaptchaContextValue {
  /** Current CAPTCHA state */
  state: CaptchaState;
  /** Generate a new CAPTCHA */
  generate: (type?: CaptchaType, difficulty?: Difficulty) => Promise<CaptchaResponse>;
  /** Validate CAPTCHA response */
  validate: (response: string) => Promise<ValidationResponse>;
  /** Reset CAPTCHA state */
  reset: () => void;
  /** Available CAPTCHA types */
  availableTypes: CaptchaType[];
  /** Theme configuration */
  theme: Required<CaptchaTheme>;
  /** Configuration options */
  options: Required<CaptchaOptions>;
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
  /** Callback when CAPTCHA is generated */
  onGenerate?: (response: CaptchaResponse) => void;
  /** Callback when CAPTCHA is validated */
  onValidate?: (result: ValidationResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to auto-generate on mount */
  autoGenerate?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
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
  /** Custom render function for challenge */
  renderChallenge?: (challenge: string, type: CaptchaType) => ReactNode;
}

/**
 * Use captcha hook return type
 */
export interface UseCaptchaReturn {
  /** Current CAPTCHA state */
  state: CaptchaState;
  /** Generate a new CAPTCHA */
  generate: (type?: CaptchaType, difficulty?: Difficulty) => Promise<CaptchaResponse>;
  /** Validate CAPTCHA response */
  validate: (response: string) => Promise<ValidationResponse>;
  /** Reset CAPTCHA state */
  reset: () => void;
  /** Available CAPTCHA types */
  availableTypes: CaptchaType[];
  /** Theme configuration */
  theme: Required<CaptchaTheme>;
  /** Configuration options */
  options: Required<CaptchaOptions>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CaptchaContext = createContext<CaptchaContextValue | null>(null);

/**
 * CaptchaProvider component props
 */
export interface CaptchaProviderProps {
  /** Child components */
  children: ReactNode;
  /** CAPTCHA configuration options */
  options?: CaptchaOptions;
  /** Theme configuration */
  theme?: CaptchaTheme;
}

/**
 * CaptchaProvider component
 * Provides CAPTCHA context to child components
 */
export function CaptchaProvider({ children, options = {}, theme = {} }: CaptchaProviderProps): JSX.Element {
  const mergedTheme = { ...defaultTheme, ...theme };
  const mergedOptions: Required<CaptchaOptions> = {
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

  const captchaServiceRef = useRef<CaptchaService | null>(null);
  const configServiceRef = useRef<SecurityConfigurationService | null>(null);

  // Initialize services
  if (!captchaServiceRef.current) {
    captchaServiceRef.current = new CaptchaService();
  }
  if (!configServiceRef.current) {
    configServiceRef.current = new SecurityConfigurationService();
  }

  const [state, setState] = useState<CaptchaState>({
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

  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Clear auto-refresh on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    if (mergedOptions.autoRefreshInterval > 0 && state.sessionId && !state.isValidated) {
      autoRefreshRef.current = setInterval(() => {
        setState(prev => {
          if (prev.expiresIn !== null && prev.expiresIn <= 0) {
            // Session expired, generate new one
            generate(prev.type || undefined, prev.difficulty || undefined);
            return prev;
          }
          return {
            ...prev,
            expiresIn: prev.expiresIn !== null ? prev.expiresIn - 1 : null,
          };
        });
      }, 1000);
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [mergedOptions.autoRefreshInterval, state.sessionId, state.isValidated]);

  const generate = useCallback(
    async (type?: CaptchaType, difficulty?: Difficulty): Promise<CaptchaResponse> => {
      const captchaType = type || mergedOptions.types[0];
      const captchaDifficulty = difficulty || mergedOptions.defaultDifficulty;

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await captchaServiceRef.current!.generateCaptcha(
          captchaType,
          captchaDifficulty,
          {
            enableBehavioralAnalysis: mergedOptions.enableBehavioralAnalysis,
            enableDeviceFingerprinting: mergedOptions.enableDeviceFingerprinting,
          }
        );

        setState(prev => ({
          ...prev,
          isLoading: false,
          sessionId: response.sessionId,
          challenge: response.challenge,
          type: response.type,
          difficulty: response.difficulty,
          expiresIn: response.expiresIn,
          isValidated: false,
          validationResult: null,
          attempts: 0,
        }));

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate CAPTCHA';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [mergedOptions]
  );

  const validate = useCallback(
    async (response: string): Promise<ValidationResponse> => {
      if (!state.sessionId || !state.type) {
        throw new Error('No active CAPTCHA session');
      }

      if (state.attempts >= mergedOptions.maxAttempts) {
        throw new Error('Maximum validation attempts exceeded');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await captchaServiceRef.current!.validateResponse(
          state.sessionId,
          response,
          state.type
        );

        setState(prev => ({
          ...prev,
          isLoading: false,
          isValidated: result.valid,
          validationResult: result,
          attempts: prev.attempts + 1,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Validation failed';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          attempts: prev.attempts + 1,
        }));
        throw error;
      }
    },
    [state.sessionId, state.type, state.attempts, mergedOptions.maxAttempts]
  );

  const reset = useCallback((): void => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }
    setState({
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
  }, []);

  const availableTypes = captchaServiceRef.current!.getAvailableTypes();

  const contextValue: CaptchaContextValue = {
    state,
    generate,
    validate,
    reset,
    availableTypes,
    theme: mergedTheme,
    options: mergedOptions,
  };

  return <CaptchaContext.Provider value={contextValue}>{children}</CaptchaContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useCaptcha hook
 * Provides CAPTCHA functionality to components
 */
export function useCaptcha(): UseCaptchaReturn {
  const context = useContext(CaptchaContext);

  if (!context) {
    throw new Error('useCaptcha must be used within a CaptchaProvider');
  }

  return {
    state: context.state,
    generate: context.generate,
    validate: context.validate,
    reset: context.reset,
    availableTypes: context.availableTypes,
    theme: context.theme,
    options: context.options,
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * CaptchaWidget component
 * Renders a CAPTCHA challenge with input and validation
 */
export function CaptchaWidget({
  type,
  difficulty,
  theme: customTheme,
  onGenerate,
  onValidate,
  onError,
  autoGenerate = true,
  className = '',
  style = {},
  disabled = false,
  placeholder = 'Enter CAPTCHA',
  submitText = 'Verify',
  showRefresh = true,
  showTypeSelector = false,
  renderChallenge,
}: CaptchaWidgetProps): JSX.Element {
  const { state, generate, validate, reset, availableTypes, theme: contextTheme, options } = useCaptcha();
  const [inputValue, setInputValue] = useState('');
  const [selectedType, setSelectedType] = useState<CaptchaType>(type || options.types[0]);

  const mergedTheme = { ...contextTheme, ...customTheme };

  // Auto-generate on mount
  useEffect(() => {
    if (autoGenerate && !state.sessionId) {
      handleGenerate();
    }
  }, [autoGenerate]);

  const handleGenerate = async (): Promise<void> => {
    try {
      const response = await generate(selectedType, difficulty);
      onGenerate?.(response);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const handleValidate = async (): Promise<void> => {
    if (!inputValue.trim()) {
      return;
    }

    try {
      const result = await validate(inputValue);
      onValidate?.(result);
      if (!result.valid) {
        setInputValue('');
      }
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const handleRefresh = (): void => {
    reset();
    setInputValue('');
    handleGenerate();
  };

  const handleTypeChange = (newType: CaptchaType): void => {
    setSelectedType(newType);
    reset();
    setInputValue('');
    generate(newType, difficulty);
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !disabled && !state.isLoading) {
      handleValidate();
    }
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: mergedTheme.fontFamily,
    fontSize: mergedTheme.fontSize,
    padding: mergedTheme.padding,
    backgroundColor: mergedTheme.backgroundColor,
    border: `1px solid ${mergedTheme.borderColor}`,
    borderRadius: `${mergedTheme.borderRadius}px`,
    boxShadow: mergedTheme.boxShadow,
    maxWidth: '400px',
    ...style,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: mergedTheme.primaryColor,
    color: '#ffffff',
    border: 'none',
    borderRadius: `${mergedTheme.borderRadius}px`,
    padding: '8px 16px',
    cursor: disabled || state.isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || state.isLoading ? 0.6 : 1,
    fontFamily: mergedTheme.fontFamily,
    fontSize: mergedTheme.fontSize,
    transition: 'background-color 0.2s',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${state.error ? mergedTheme.errorColor : mergedTheme.borderColor}`,
    borderRadius: `${mergedTheme.borderRadius}px`,
    fontFamily: mergedTheme.fontFamily,
    fontSize: mergedTheme.fontSize,
    color: mergedTheme.textColor,
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const challengeStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: `${mergedTheme.borderRadius}px`,
    marginBottom: '12px',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: '18px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    color: mergedTheme.textColor,
    userSelect: 'none',
  };

  const errorStyle: React.CSSProperties = {
    color: mergedTheme.errorColor,
    fontSize: '12px',
    marginTop: '4px',
  };

  const successStyle: React.CSSProperties = {
    color: mergedTheme.successColor,
    fontSize: '12px',
    marginTop: '4px',
  };

  const typeSelectorStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  };

  const typeButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    border: `1px solid ${isActive ? mergedTheme.primaryColor : mergedTheme.borderColor}`,
    borderRadius: `${mergedTheme.borderRadius}px`,
    backgroundColor: isActive ? mergedTheme.primaryColor : mergedTheme.backgroundColor,
    color: isActive ? '#ffffff' : mergedTheme.textColor,
    cursor: 'pointer',
    fontFamily: mergedTheme.fontFamily,
    fontSize: '12px',
    transition: 'all 0.2s',
  });

  const renderChallengeContent = (): ReactNode => {
    if (renderChallenge && state.challenge) {
      return renderChallenge(state.challenge, state.type || 'text');
    }

    if (!state.challenge) {
      return null;
    }

    // For image-based challenges, render as image
    if (state.type === 'image' && state.challenge.startsWith('data:')) {
      return (
        <img
          src={state.challenge}
          alt="CAPTCHA Challenge"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      );
    }

    // For text/math/logic, render as text
    return <div style={challengeStyle}>{state.challenge}</div>;
  };

  return (
    <div className={`captcha-widget ${className}`} style={containerStyle}>
      {/* Type Selector */}
      {showTypeSelector && (
        <div style={typeSelectorStyle}>
          {availableTypes.map(t => (
            <button
              key={t}
              type="button"
              style={typeButtonStyle(t === selectedType)}
              onClick={() => handleTypeChange(t)}
              disabled={disabled || state.isLoading}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Challenge Display */}
      {state.isLoading ? (
        <div style={{ ...challengeStyle, color: mergedTheme.secondaryColor }}>Loading...</div>
      ) : (
        renderChallengeContent()
      )}

      {/* Input Field */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || state.isLoading || state.isValidated}
          style={inputStyle}
          aria-label="CAPTCHA response"
        />
        {showRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={disabled || state.isLoading}
            style={{
              ...buttonStyle,
              padding: '8px 12px',
              backgroundColor: mergedTheme.secondaryColor,
            }}
            aria-label="Refresh CAPTCHA"
          >
            ↻
          </button>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleValidate}
        disabled={disabled || state.isLoading || !inputValue.trim() || state.isValidated}
        style={{ ...buttonStyle, width: '100%' }}
      >
        {state.isLoading ? 'Verifying...' : submitText}
      </button>

      {/* Status Messages */}
      {state.error && <div style={errorStyle}>{state.error}</div>}
      {state.isValidated && state.validationResult?.valid && (
        <div style={successStyle}>✓ Verified successfully!</div>
      )}
      {state.validationResult && !state.validationResult.valid && !state.error && (
        <div style={errorStyle}>{state.validationResult.message}</div>
      )}

      {/* Expiration Timer */}
      {state.expiresIn !== null && state.expiresIn > 0 && !state.isValidated && (
        <div style={{ fontSize: '11px', color: mergedTheme.secondaryColor, marginTop: '8px' }}>
          Expires in {state.expiresIn} seconds
        </div>
      )}

      {/* Attempts Counter */}
      {state.attempts > 0 && !state.isValidated && (
        <div style={{ fontSize: '11px', color: mergedTheme.secondaryColor, marginTop: '4px' }}>
          Attempts: {state.attempts}/{options.maxAttempts}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

/**
 * CaptchaContainer - A styled container for CAPTCHA widgets
 */
export function CaptchaContainer({
  children,
  theme,
  className = '',
  style = {},
}: {
  children: ReactNode;
  theme?: CaptchaTheme;
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  const { theme: contextTheme } = useCaptcha();
  const mergedTheme = { ...contextTheme, ...theme };

  const containerStyle: React.CSSProperties = {
    fontFamily: mergedTheme.fontFamily,
    fontSize: mergedTheme.fontSize,
    color: mergedTheme.textColor,
    ...style,
  };

  return (
    <div className={`captcha-container ${className}`} style={containerStyle}>
      {children}
    </div>
  );
}

/**
 * CaptchaButton - A styled button for CAPTCHA actions
 */
export function CaptchaButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  theme,
  className = '',
  style = {},
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  theme?: CaptchaTheme;
  className?: string;
  style?: React.CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const { theme: contextTheme } = useCaptcha();
  const mergedTheme = { ...contextTheme, ...theme };

  const getButtonStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '8px 16px',
      borderRadius: `${mergedTheme.borderRadius}px`,
      fontFamily: mergedTheme.fontFamily,
      fontSize: mergedTheme.fontSize,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'all 0.2s',
      border: 'none',
      ...style,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: mergedTheme.primaryColor,
          color: '#ffffff',
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: mergedTheme.secondaryColor,
          color: '#ffffff',
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          color: mergedTheme.primaryColor,
          border: `1px solid ${mergedTheme.primaryColor}`,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`captcha-button ${className}`}
      style={getButtonStyle()}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * CaptchaInput - A styled input for CAPTCHA responses
 */
export function CaptchaInput({
  value,
  onChange,
  placeholder = 'Enter CAPTCHA',
  disabled = false,
  error = false,
  theme,
  className = '',
  style = {},
  ...props
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  theme?: CaptchaTheme;
  className?: string;
  style?: React.CSSProperties;
} & React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  const { theme: contextTheme } = useCaptcha();
  const mergedTheme = { ...contextTheme, ...theme };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${error ? mergedTheme.errorColor : mergedTheme.borderColor}`,
    borderRadius: `${mergedTheme.borderRadius}px`,
    fontFamily: mergedTheme.fontFamily,
    fontSize: mergedTheme.fontSize,
    color: mergedTheme.textColor,
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`captcha-input ${className}`}
      style={inputStyle}
      {...props}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CaptchaProvider,
  CaptchaWidget,
  CaptchaContainer,
  CaptchaButton,
  CaptchaInput,
  useCaptcha,
  defaultTheme,
};