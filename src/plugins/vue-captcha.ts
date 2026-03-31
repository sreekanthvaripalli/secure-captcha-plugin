/**
 * Vue.js Plugin for Secure CAPTCHA
 * Provides Vue components and composables for CAPTCHA integration
 */

import {
  defineComponent,
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  provide,
  inject,
  InjectionKey,
  App,
  Ref,
  ComputedRef,
  PropType,
  h,
  VNode,
} from 'vue';
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
 * CAPTCHA context value
 */
export interface CaptchaContextValue {
  /** Current CAPTCHA state */
  state: Ref<CaptchaState>;
  /** Generate a new CAPTCHA */
  generate: (type?: CaptchaType, difficulty?: Difficulty) => Promise<CaptchaResponse>;
  /** Validate CAPTCHA response */
  validate: (response: string) => Promise<ValidationResponse>;
  /** Reset CAPTCHA state */
  reset: () => void;
  /** Available CAPTCHA types */
  availableTypes: ComputedRef<CaptchaType[]>;
  /** Theme configuration */
  theme: Ref<Required<CaptchaTheme>>;
  /** Configuration options */
  options: Ref<Required<CaptchaOptions>>;
}

/**
 * Use captcha composable return type
 */
export interface UseCaptchaReturn {
  /** Current CAPTCHA state */
  state: Ref<CaptchaState>;
  /** Generate a new CAPTCHA */
  generate: (type?: CaptchaType, difficulty?: Difficulty) => Promise<CaptchaResponse>;
  /** Validate CAPTCHA response */
  validate: (response: string) => Promise<ValidationResponse>;
  /** Reset CAPTCHA state */
  reset: () => void;
  /** Available CAPTCHA types */
  availableTypes: ComputedRef<CaptchaType[]>;
  /** Theme configuration */
  theme: Ref<Required<CaptchaTheme>>;
  /** Configuration options */
  options: Ref<Required<CaptchaOptions>>;
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

/**
 * Vue plugin options
 */
export interface VueCaptchaPluginOptions {
  /** CAPTCHA configuration options */
  options?: CaptchaOptions;
  /** Theme configuration */
  theme?: CaptchaTheme;
}

// ============================================================================
// INJECTION KEY
// ============================================================================

export const CAPTCHA_CONTEXT_KEY: InjectionKey<CaptchaContextValue> = Symbol('captcha-context');

// ============================================================================
// COMPOSABLE
// ============================================================================

/**
 * useCaptcha composable
 * Provides CAPTCHA functionality to Vue components
 */
export function useCaptcha(): UseCaptchaReturn {
  const context = inject(CAPTCHA_CONTEXT_KEY);

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
 * CaptchaProvider component
 * Provides CAPTCHA context to child components
 */
export const CaptchaProvider = defineComponent({
  name: 'CaptchaProvider',

  props: {
    options: {
      type: Object as PropType<CaptchaOptions>,
      default: () => ({}),
    },
    theme: {
      type: Object as PropType<CaptchaTheme>,
      default: () => ({}),
    },
  },

  setup(props, { slots }) {
    const mergedTheme = ref<Required<CaptchaTheme>>({
      ...defaultTheme,
      ...props.theme,
    });

    const mergedOptions = ref<Required<CaptchaOptions>>({
      types: props.options.types || ['text', 'math', 'logic', 'image'],
      defaultDifficulty: props.options.defaultDifficulty || 'medium',
      sessionTimeout: props.options.sessionTimeout || 300000,
      maxAttempts: props.options.maxAttempts || 3,
      enableBehavioralAnalysis: props.options.enableBehavioralAnalysis ?? true,
      enableDeviceFingerprinting: props.options.enableDeviceFingerprinting ?? true,
      apiEndpoint: props.options.apiEndpoint || '/api/v1/captcha',
      headers: props.options.headers || {},
      autoRefreshInterval: props.options.autoRefreshInterval || 0,
    });

    const captchaService = new CaptchaService();

    const state = ref<CaptchaState>({
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
      if (
        mergedOptions.value.autoRefreshInterval > 0 &&
        state.value.sessionId &&
        !state.value.isValidated
      ) {
        autoRefreshInterval = setInterval(() => {
          if (state.value.expiresIn !== null && state.value.expiresIn <= 0) {
            generate(state.value.type || undefined, state.value.difficulty || undefined);
          } else {
            state.value = {
              ...state.value,
              expiresIn: state.value.expiresIn !== null ? state.value.expiresIn - 1 : null,
            };
          }
        }, 1000);
      }
    };

    const generate = async (
      type?: CaptchaType,
      difficulty?: Difficulty
    ): Promise<CaptchaResponse> => {
      const captchaType = type || mergedOptions.value.types[0];
      const captchaDifficulty = difficulty || mergedOptions.value.defaultDifficulty;

      state.value = { ...state.value, isLoading: true, error: null };

      try {
        const response = await captchaService.generateCaptcha(captchaType, captchaDifficulty, {
          enableBehavioralAnalysis: mergedOptions.value.enableBehavioralAnalysis,
          enableDeviceFingerprinting: mergedOptions.value.enableDeviceFingerprinting,
        });

        state.value = {
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
        };

        startAutoRefresh();

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate CAPTCHA';
        state.value = {
          ...state.value,
          isLoading: false,
          error: errorMessage,
        };
        throw error;
      }
    };

    const validate = async (response: string): Promise<ValidationResponse> => {
      if (!state.value.sessionId || !state.value.type) {
        throw new Error('No active CAPTCHA session');
      }

      if (state.value.attempts >= mergedOptions.value.maxAttempts) {
        throw new Error('Maximum validation attempts exceeded');
      }

      state.value = { ...state.value, isLoading: true, error: null };

      try {
        const result = await captchaService.validateResponse(
          state.value.sessionId!,
          response,
          state.value.type!
        );

        state.value = {
          ...state.value,
          isLoading: false,
          isValidated: result.valid,
          validationResult: result,
          attempts: state.value.attempts + 1,
        };

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Validation failed';
        state.value = {
          ...state.value,
          isLoading: false,
          error: errorMessage,
          attempts: state.value.attempts + 1,
        };
        throw error;
      }
    };

    const reset = (): void => {
      clearAutoRefresh();
      state.value = {
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
    };

    const availableTypes = computed<CaptchaType[]>(() => captchaService.getAvailableTypes());

    // Watch for theme changes
    watch(
      () => props.theme,
      newTheme => {
        mergedTheme.value = { ...defaultTheme, ...newTheme };
      },
      { deep: true }
    );

    // Watch for options changes
    watch(
      () => props.options,
      newOptions => {
        mergedOptions.value = {
          types: newOptions.types || ['text', 'math', 'logic', 'image'],
          defaultDifficulty: newOptions.defaultDifficulty || 'medium',
          sessionTimeout: newOptions.sessionTimeout || 300000,
          maxAttempts: newOptions.maxAttempts || 3,
          enableBehavioralAnalysis: newOptions.enableBehavioralAnalysis ?? true,
          enableDeviceFingerprinting: newOptions.enableDeviceFingerprinting ?? true,
          apiEndpoint: newOptions.apiEndpoint || '/api/v1/captcha',
          headers: newOptions.headers || {},
          autoRefreshInterval: newOptions.autoRefreshInterval || 0,
        };
      },
      { deep: true }
    );

    // Cleanup on unmount
    onUnmounted(() => {
      clearAutoRefresh();
    });

    // Provide context to children
    const contextValue: CaptchaContextValue = {
      state,
      generate,
      validate,
      reset,
      availableTypes,
      theme: mergedTheme,
      options: mergedOptions,
    };

    provide(CAPTCHA_CONTEXT_KEY, contextValue);

    return (): VNode[] | undefined => slots.default?.();
  },
});

/**
 * CaptchaWidget component
 * Renders a CAPTCHA challenge with input and validation
 */
export const CaptchaWidget = defineComponent({
  name: 'CaptchaWidget',

  props: {
    type: {
      type: String as PropType<CaptchaType>,
      default: undefined,
    },
    difficulty: {
      type: String as PropType<Difficulty>,
      default: undefined,
    },
    theme: {
      type: Object as PropType<CaptchaTheme>,
      default: () => ({}),
    },
    autoGenerate: {
      type: Boolean,
      default: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
      default: 'Enter CAPTCHA',
    },
    submitText: {
      type: String,
      default: 'Verify',
    },
    showRefresh: {
      type: Boolean,
      default: true,
    },
    showTypeSelector: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['generate', 'validate', 'error'],

  setup(props, { emit }) {
    const {
      state,
      generate,
      validate,
      reset,
      availableTypes,
      theme: contextTheme,
      options,
    } = useCaptcha();

    const inputValue = ref('');
    const selectedType = ref<CaptchaType>(props.type || options.value.types[0]);

    const mergedTheme = computed(() => ({
      ...contextTheme.value,
      ...props.theme,
    }));

    const handleGenerate = async (): Promise<void> => {
      try {
        const response = await generate(selectedType.value, props.difficulty);
        emit('generate', response);
      } catch (error) {
        emit('error', error);
      }
    };

    const handleValidate = async (): Promise<void> => {
      if (!inputValue.value.trim()) {
        return;
      }

      try {
        const result = await validate(inputValue.value);
        emit('validate', result);
        if (!result.valid) {
          inputValue.value = '';
        }
      } catch (error) {
        emit('error', error);
      }
    };

    const handleRefresh = (): void => {
      reset();
      inputValue.value = '';
      handleGenerate();
    };

    const handleTypeChange = (newType: CaptchaType): void => {
      selectedType.value = newType;
      reset();
      inputValue.value = '';
      generate(newType, props.difficulty);
    };

    const handleKeyPress = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !props.disabled && !state.value.isLoading) {
        handleValidate();
      }
    };

    // Auto-generate on mount
    onMounted(() => {
      if (props.autoGenerate && !state.value.sessionId) {
        handleGenerate();
      }
    });

    return {
      state,
      inputValue,
      selectedType,
      mergedTheme,
      availableTypes,
      options,
      handleGenerate,
      handleValidate,
      handleRefresh,
      handleTypeChange,
      handleKeyPress,
    };
  },

  render(): VNode {
    const containerStyle = {
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: this.mergedTheme.fontSize,
      padding: this.mergedTheme.padding,
      backgroundColor: this.mergedTheme.backgroundColor,
      border: `1px solid ${this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      boxShadow: this.mergedTheme.boxShadow,
      maxWidth: '400px',
    };

    const buttonStyle = {
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

    const inputStyle = {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${this.state.error ? this.mergedTheme.errorColor : this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: this.mergedTheme.fontSize,
      color: this.mergedTheme.textColor,
      backgroundColor: '#ffffff',
      outline: 'none',
      boxSizing: 'border-box' as const,
    };

    const challengeStyle = {
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      marginBottom: '12px',
      textAlign: 'center' as const,
      fontFamily: 'monospace',
      fontSize: '18px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      color: this.mergedTheme.textColor,
      userSelect: 'none' as const,
    };

    const errorStyle = {
      color: this.mergedTheme.errorColor,
      fontSize: '12px',
      marginTop: '4px',
    };

    const successStyle = {
      color: this.mergedTheme.successColor,
      fontSize: '12px',
      marginTop: '4px',
    };

    const typeSelectorStyle = {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
      flexWrap: 'wrap' as const,
    };

    const typeButtonStyle = (isActive: boolean): Record<string, string> => ({
      padding: '4px 12px',
      border: `1px solid ${isActive ? this.mergedTheme.primaryColor : this.mergedTheme.borderColor}`,
      borderRadius: `${this.mergedTheme.borderRadius}px`,
      backgroundColor: isActive ? this.mergedTheme.primaryColor : this.mergedTheme.backgroundColor,
      color: isActive ? '#ffffff' : this.mergedTheme.textColor,
      cursor: 'pointer',
      fontFamily: this.mergedTheme.fontFamily,
      fontSize: '12px',
      transition: 'all 0.2s',
    });

    const renderChallengeContent = (): VNode | null => {
      if (!this.state.challenge) {
        return null;
      }

      // For image-based challenges, render as image
      if (this.state.type === 'image' && this.state.challenge.startsWith('data:')) {
        return h('img', {
          src: this.state.challenge,
          alt: 'CAPTCHA Challenge',
          style: { maxWidth: '100%', height: 'auto' },
        });
      }

      // For text/math/logic, render as text
      return h('div', { style: challengeStyle }, this.state.challenge);
    };

    const children: VNode[] = [];

    // Type Selector
    if (this.showTypeSelector) {
      children.push(
        h(
          'div',
          { style: typeSelectorStyle },
          this.availableTypes.map(t =>
            h(
              'button',
              {
                type: 'button',
                style: typeButtonStyle(t === this.selectedType),
                onClick: () => this.handleTypeChange(t),
                disabled: this.disabled || this.state.isLoading,
              },
              t.charAt(0).toUpperCase() + t.slice(1)
            )
          )
        )
      );
    }

    // Challenge Display
    if (this.state.isLoading) {
      children.push(
        h(
          'div',
          { style: { ...challengeStyle, color: this.mergedTheme.secondaryColor } },
          'Loading...'
        )
      );
    } else {
      const challengeContent = renderChallengeContent();
      if (challengeContent) {
        children.push(challengeContent);
      }
    }

    // Input Field
    children.push(
      h('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [
        h('input', {
          type: 'text',
          value: this.inputValue,
          onInput: (e: Event) => {
            this.inputValue = (e.target as HTMLInputElement).value;
          },
          onKeypress: this.handleKeyPress,
          placeholder: this.placeholder,
          disabled: this.disabled || this.state.isLoading || this.state.isValidated,
          style: inputStyle,
          'aria-label': 'CAPTCHA response',
        }),
        this.showRefresh
          ? h(
              'button',
              {
                type: 'button',
                onClick: this.handleRefresh,
                disabled: this.disabled || this.state.isLoading,
                style: {
                  ...buttonStyle,
                  padding: '8px 12px',
                  backgroundColor: this.mergedTheme.secondaryColor,
                },
                'aria-label': 'Refresh CAPTCHA',
              },
              '↻'
            )
          : null,
      ])
    );

    // Submit Button
    children.push(
      h(
        'button',
        {
          type: 'button',
          onClick: this.handleValidate,
          disabled:
            this.disabled ||
            this.state.isLoading ||
            !this.inputValue.trim() ||
            this.state.isValidated,
          style: { ...buttonStyle, width: '100%' },
        },
        this.state.isLoading ? 'Verifying...' : this.submitText
      )
    );

    // Status Messages
    if (this.state.error) {
      children.push(h('div', { style: errorStyle }, this.state.error));
    }

    if (this.state.isValidated && this.state.validationResult?.valid) {
      children.push(h('div', { style: successStyle }, '✓ Verified successfully!'));
    }

    if (this.state.validationResult && !this.state.validationResult.valid && !this.state.error) {
      children.push(h('div', { style: errorStyle }, this.state.validationResult.message));
    }

    // Expiration Timer
    if (this.state.expiresIn !== null && this.state.expiresIn > 0 && !this.state.isValidated) {
      children.push(
        h(
          'div',
          { style: { fontSize: '11px', color: this.mergedTheme.secondaryColor, marginTop: '8px' } },
          `Expires in ${this.state.expiresIn} seconds`
        )
      );
    }

    // Attempts Counter
    if (this.state.attempts > 0 && !this.state.isValidated) {
      children.push(
        h(
          'div',
          { style: { fontSize: '11px', color: this.mergedTheme.secondaryColor, marginTop: '4px' } },
          `Attempts: ${this.state.attempts}/${this.options.maxAttempts}`
        )
      );
    }

    return h('div', { class: 'captcha-widget', style: containerStyle }, children);
  },
});

/**
 * CaptchaContainer - A styled container for CAPTCHA widgets
 */
export const CaptchaContainer = defineComponent({
  name: 'CaptchaContainer',

  props: {
    theme: {
      type: Object as PropType<CaptchaTheme>,
      default: () => ({}),
    },
  },

  setup(props, { slots }) {
    const { theme: contextTheme } = useCaptcha();

    const mergedTheme = computed(() => ({
      ...contextTheme.value,
      ...props.theme,
    }));

    return (): VNode =>
      h(
        'div',
        {
          class: 'captcha-container',
          style: {
            fontFamily: mergedTheme.value.fontFamily,
            fontSize: mergedTheme.value.fontSize,
            color: mergedTheme.value.textColor,
          },
        },
        slots.default?.()
      );
  },
});

/**
 * CaptchaButton - A styled button for CAPTCHA actions
 */
export const CaptchaButton = defineComponent({
  name: 'CaptchaButton',

  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    variant: {
      type: String as PropType<'primary' | 'secondary' | 'outline'>,
      default: 'primary',
    },
    theme: {
      type: Object as PropType<CaptchaTheme>,
      default: () => ({}),
    },
  },

  emits: ['click'],

  setup(props, { slots, emit }) {
    const { theme: contextTheme } = useCaptcha();

    const mergedTheme = computed(() => ({
      ...contextTheme.value,
      ...props.theme,
    }));

    const getButtonStyle = (): Record<string, string | number> => {
      const baseStyle = {
        padding: '8px 16px',
        borderRadius: `${mergedTheme.value.borderRadius}px`,
        fontFamily: mergedTheme.value.fontFamily,
        fontSize: mergedTheme.value.fontSize,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        transition: 'all 0.2s',
        border: 'none',
      };

      switch (props.variant) {
        case 'primary':
          return {
            ...baseStyle,
            backgroundColor: mergedTheme.value.primaryColor,
            color: '#ffffff',
          };
        case 'secondary':
          return {
            ...baseStyle,
            backgroundColor: mergedTheme.value.secondaryColor,
            color: '#ffffff',
          };
        case 'outline':
          return {
            ...baseStyle,
            backgroundColor: 'transparent',
            color: mergedTheme.value.primaryColor,
            border: `1px solid ${mergedTheme.value.primaryColor}`,
          };
        default:
          return baseStyle;
      }
    };

    return (): VNode =>
      h(
        'button',
        {
          type: 'button',
          onClick: () => emit('click'),
          disabled: props.disabled,
          class: 'captcha-button',
          style: getButtonStyle(),
        },
        slots.default?.()
      );
  },
});

/**
 * CaptchaInput - A styled input for CAPTCHA responses
 */
export const CaptchaInput = defineComponent({
  name: 'CaptchaInput',

  props: {
    modelValue: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: 'Enter CAPTCHA',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    error: {
      type: Boolean,
      default: false,
    },
    theme: {
      type: Object as PropType<CaptchaTheme>,
      default: () => ({}),
    },
  },

  emits: ['update:modelValue'],

  setup(props, { emit }) {
    const { theme: contextTheme } = useCaptcha();

    const mergedTheme = computed(() => ({
      ...contextTheme.value,
      ...props.theme,
    }));

    const inputStyle = computed(() => ({
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${props.error ? mergedTheme.value.errorColor : mergedTheme.value.borderColor}`,
      borderRadius: `${mergedTheme.value.borderRadius}px`,
      fontFamily: mergedTheme.value.fontFamily,
      fontSize: mergedTheme.value.fontSize,
      color: mergedTheme.value.textColor,
      backgroundColor: '#ffffff',
      outline: 'none',
      boxSizing: 'border-box' as const,
    }));

    return (): VNode =>
      h('input', {
        type: 'text',
        value: props.modelValue,
        onInput: (e: Event) => {
          emit('update:modelValue', (e.target as HTMLInputElement).value);
        },
        placeholder: props.placeholder,
        disabled: props.disabled,
        class: 'captcha-input',
        style: inputStyle.value,
      });
  },
});

// ============================================================================
// PLUGIN
// ============================================================================

/**
 * Vue CAPTCHA Plugin
 * Install with: app.use(VueCaptcha, options)
 */
export const VueCaptcha = {
  install(app: App, options: VueCaptchaPluginOptions = {}): void {
    // Register components globally
    app.component('CaptchaProvider', CaptchaProvider);
    app.component('CaptchaWidget', CaptchaWidget);
    app.component('CaptchaContainer', CaptchaContainer);
    app.component('CaptchaButton', CaptchaButton);
    app.component('CaptchaInput', CaptchaInput);

    // Provide default options if needed
    if (options.options || options.theme) {
      // Will be set by CaptchaProvider
    }
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  VueCaptcha,
  CaptchaProvider,
  CaptchaWidget,
  CaptchaContainer,
  CaptchaButton,
  CaptchaInput,
  useCaptcha,
  defaultTheme,
};
