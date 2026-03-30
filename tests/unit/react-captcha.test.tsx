/**
 * React Component Library Tests
 * Tests for CaptchaProvider, CaptchaWidget, useCaptcha hook, and styled components
 */

import '../setup-react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CaptchaProvider,
  CaptchaWidget,
  CaptchaContainer,
  CaptchaButton,
  CaptchaInput,
  useCaptcha,
  defaultTheme,
  CaptchaTheme,
  CaptchaOptions,
} from '../../src/plugins/react-captcha';
import { CaptchaService } from '../../src/core/captcha-service';

// Mock CaptchaService
jest.mock('../../src/core/captcha-service');
jest.mock('../../src/security/config');

const mockCaptchaService = CaptchaService as jest.MockedClass<typeof CaptchaService>;

describe('React Component Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockCaptchaService.prototype.getAvailableTypes.mockReturnValue(['text', 'math', 'logic', 'image']);
    mockCaptchaService.prototype.generateCaptcha.mockResolvedValue({
      sessionId: 'test-session-123',
      challenge: 'ABC123',
      type: 'text',
      difficulty: 'medium',
      expiresIn: 300,
      metadata: {} as any,
    });
    mockCaptchaService.prototype.validateResponse.mockResolvedValue({
      valid: true,
      securityScore: 95,
      message: 'Validation successful',
    });
  });

  describe('defaultTheme', () => {
    it('should have all required theme properties', () => {
      expect(defaultTheme).toHaveProperty('primaryColor');
      expect(defaultTheme).toHaveProperty('secondaryColor');
      expect(defaultTheme).toHaveProperty('backgroundColor');
      expect(defaultTheme).toHaveProperty('textColor');
      expect(defaultTheme).toHaveProperty('borderColor');
      expect(defaultTheme).toHaveProperty('errorColor');
      expect(defaultTheme).toHaveProperty('successColor');
      expect(defaultTheme).toHaveProperty('borderRadius');
      expect(defaultTheme).toHaveProperty('fontFamily');
      expect(defaultTheme).toHaveProperty('fontSize');
      expect(defaultTheme).toHaveProperty('padding');
      expect(defaultTheme).toHaveProperty('boxShadow');
    });

    it('should have valid color values', () => {
      expect(defaultTheme.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.textColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.borderColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.errorColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(defaultTheme.successColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should have valid numeric values', () => {
      expect(typeof defaultTheme.borderRadius).toBe('number');
      expect(defaultTheme.borderRadius).toBeGreaterThan(0);
    });

    it('should have valid string values', () => {
      expect(typeof defaultTheme.fontFamily).toBe('string');
      expect(defaultTheme.fontFamily.length).toBeGreaterThan(0);
      expect(typeof defaultTheme.fontSize).toBe('string');
      expect(defaultTheme.fontSize.length).toBeGreaterThan(0);
      expect(typeof defaultTheme.padding).toBe('string');
      expect(defaultTheme.padding.length).toBeGreaterThan(0);
      expect(typeof defaultTheme.boxShadow).toBe('string');
      expect(defaultTheme.boxShadow.length).toBeGreaterThan(0);
    });
  });

  describe('CaptchaProvider', () => {
    it('should render children without crashing', () => {
      render(
        <CaptchaProvider>
          <div data-testid="child">Test Child</div>
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should provide context to child components', () => {
      const TestComponent = () => {
        const context = useCaptcha();
        return <div data-testid="context-test">{context.availableTypes.join(',')}</div>;
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('context-test')).toHaveTextContent('text,math,logic,image');
    });

    it('should accept custom options', () => {
      const customOptions: CaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
      };

      const TestComponent = () => {
        const context = useCaptcha();
        return (
          <div>
            <div data-testid="types">{context.availableTypes.join(',')}</div>
            <div data-testid="difficulty">{context.options.defaultDifficulty}</div>
            <div data-testid="max-attempts">{context.options.maxAttempts}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider options={customOptions}>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('difficulty')).toHaveTextContent('hard');
      expect(screen.getByTestId('max-attempts')).toHaveTextContent('5');
    });

    it('should accept custom theme', () => {
      const customTheme: CaptchaTheme = {
        primaryColor: '#ff0000',
        borderRadius: 12,
      };

      const TestComponent = () => {
        const context = useCaptcha();
        return (
          <div>
            <div data-testid="primary-color">{context.theme.primaryColor}</div>
            <div data-testid="border-radius">{context.theme.borderRadius}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider theme={customTheme}>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('primary-color')).toHaveTextContent('#ff0000');
      expect(screen.getByTestId('border-radius')).toHaveTextContent('12');
    });
  });

  describe('useCaptcha hook', () => {
    it('should throw error when used outside CaptchaProvider', () => {
      const TestComponent = () => {
        useCaptcha();
        return null;
      };

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<TestComponent />)).toThrow(
        'useCaptcha must be used within a CaptchaProvider'
      );
      
      consoleSpy.mockRestore();
    });

    it('should return initial state', () => {
      const TestComponent = () => {
        const { state } = useCaptcha();
        return (
          <div>
            <div data-testid="is-loading">{state.isLoading.toString()}</div>
            <div data-testid="error">{state.error || 'null'}</div>
            <div data-testid="session-id">{state.sessionId || 'null'}</div>
            <div data-testid="is-validated">{state.isValidated.toString()}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
      expect(screen.getByTestId('session-id')).toHaveTextContent('null');
      expect(screen.getByTestId('is-validated')).toHaveTextContent('false');
    });

    it('should generate captcha successfully', async () => {
      const TestComponent = () => {
        const { state, generate } = useCaptcha();
        return (
          <div>
            <button onClick={() => generate('text', 'medium')} data-testid="generate-btn">
              Generate
            </button>
            <div data-testid="session-id">{state.sessionId || 'null'}</div>
            <div data-testid="challenge">{state.challenge || 'null'}</div>
            <div data-testid="is-loading">{state.isLoading.toString()}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('generate-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');
        expect(screen.getByTestId('challenge')).toHaveTextContent('ABC123');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should validate captcha successfully', async () => {
      const TestComponent = () => {
        const { state, generate, validate } = useCaptcha();
        return (
          <div>
            <button onClick={() => generate('text', 'medium')} data-testid="generate-btn">
              Generate
            </button>
            <button onClick={() => validate('ABC123')} data-testid="validate-btn">
              Validate
            </button>
            <div data-testid="session-id">{state.sessionId || 'null'}</div>
            <div data-testid="is-validated">{state.isValidated.toString()}</div>
            <div data-testid="validation-result">
              {state.validationResult?.valid.toString() || 'null'}
            </div>
          </div>
        );
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('generate-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('validate-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-validated')).toHaveTextContent('true');
        expect(screen.getByTestId('validation-result')).toHaveTextContent('true');
      });
    });

    it('should reset state', async () => {
      const TestComponent = () => {
        const { state, generate, reset } = useCaptcha();
        return (
          <div>
            <button onClick={() => generate('text', 'medium')} data-testid="generate-btn">
              Generate
            </button>
            <button onClick={reset} data-testid="reset-btn">
              Reset
            </button>
            <div data-testid="session-id">{state.sessionId || 'null'}</div>
            <div data-testid="challenge">{state.challenge || 'null'}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('generate-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');
      });

      act(() => {
        fireEvent.click(screen.getByTestId('reset-btn'));
      });

      expect(screen.getByTestId('session-id')).toHaveTextContent('null');
      expect(screen.getByTestId('challenge')).toHaveTextContent('null');
    });

    it('should return available types', () => {
      const TestComponent = () => {
        const { availableTypes } = useCaptcha();
        return <div data-testid="types">{availableTypes.join(',')}</div>;
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('types')).toHaveTextContent('text,math,logic,image');
    });

    it('should return theme and options', () => {
      const TestComponent = () => {
        const { theme, options } = useCaptcha();
        return (
          <div>
            <div data-testid="primary-color">{theme.primaryColor}</div>
            <div data-testid="default-difficulty">{options.defaultDifficulty}</div>
          </div>
        );
      };

      render(
        <CaptchaProvider>
          <TestComponent />
        </CaptchaProvider>
      );
      
      expect(screen.getByTestId('primary-color')).toHaveTextContent('#3b82f6');
      expect(screen.getByTestId('default-difficulty')).toHaveTextContent('medium');
    });
  });

  describe('CaptchaWidget', () => {
    it('should render without crashing', async () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} />
        </CaptchaProvider>
      );
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should auto-generate on mount when autoGenerate is true', async () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalled();
      });
    });

    it('should not auto-generate when autoGenerate is false', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} />
        </CaptchaProvider>
      );

      expect(mockCaptchaService.prototype.generateCaptcha).not.toHaveBeenCalled();
    });

    it('should display challenge after generation', async () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });
    });

    it('should handle input change', async () => {
      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} />
        </CaptchaProvider>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test-input');
      
      expect(input).toHaveValue('test-input');
    });

    it('should call onGenerate callback', async () => {
      const onGenerate = jest.fn();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} onGenerate={onGenerate} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(onGenerate).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'test-session-123',
            challenge: 'ABC123',
          })
        );
      });
    });

    it('should call onValidate callback', async () => {
      const onValidate = jest.fn();
      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} onValidate={onValidate} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'ABC123');

      const verifyButton = screen.getByText('Verify');
      await user.click(verifyButton);

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalledWith(
          expect.objectContaining({
            valid: true,
            securityScore: 95,
          })
        );
      });
    });

    it('should call onError callback on error', async () => {
      const onError = jest.fn();
      mockCaptchaService.prototype.generateCaptcha.mockRejectedValueOnce(
        new Error('Generation failed')
      );
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} onError={onError} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Generation failed',
          })
        );
      });
    });

    it('should show refresh button when showRefresh is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} showRefresh={true} />
        </CaptchaProvider>
      );

      expect(screen.getByLabelText('Refresh CAPTCHA')).toBeInTheDocument();
    });

    it('should hide refresh button when showRefresh is false', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} showRefresh={false} />
        </CaptchaProvider>
      );

      expect(screen.queryByLabelText('Refresh CAPTCHA')).not.toBeInTheDocument();
    });

    it('should show type selector when showTypeSelector is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} showTypeSelector={true} />
        </CaptchaProvider>
      );

      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Logic')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('should change type when type button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} showTypeSelector={true} />
        </CaptchaProvider>
      );

      const mathButton = screen.getByText('Math');
      await user.click(mathButton);

      await waitFor(() => {
        expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalledWith(
          'math',
          'medium',
          expect.any(Object)
        );
      });
    });

    it('should apply custom placeholder', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} placeholder="Custom placeholder" />
        </CaptchaProvider>
      );

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should apply custom submit text', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} submitText="Custom Submit" />
        </CaptchaProvider>
      );

      expect(screen.getByText('Custom Submit')).toBeInTheDocument();
    });

    it('should disable widget when disabled prop is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} disabled={true} />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toBeDisabled();
      expect(screen.getByText('Verify')).toBeDisabled();
    });

    it('should apply custom className', () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} className="custom-class" />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox').closest('.captcha-widget')).toHaveClass('custom-class');
    });

    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} style={customStyle} />
        </CaptchaProvider>
      );

      const widget = screen.getByRole('textbox').closest('.captcha-widget');
      expect(widget).toHaveStyle({ backgroundColor: 'red' });
    });

    it('should apply custom theme', async () => {
      const customTheme: CaptchaTheme = {
        primaryColor: '#ff0000',
        errorColor: '#00ff00',
      };

      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={false} theme={customTheme} />
        </CaptchaProvider>
      );

      const verifyButton = screen.getByText('Verify');
      expect(verifyButton).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should use custom renderChallenge function', async () => {
      const customRenderChallenge = jest.fn((challenge, _type) => (
        <div data-testid="custom-challenge">Custom: {challenge}</div>
      ));

      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} renderChallenge={customRenderChallenge} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-challenge')).toBeInTheDocument();
        expect(screen.getByText('Custom: ABC123')).toBeInTheDocument();
      });
    });

    it('should show expiration timer', async () => {
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Expires in/)).toBeInTheDocument();
      });
    });

    it('should show attempts counter after validation attempt', async () => {
      mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
        valid: false,
        securityScore: 0,
        message: 'Invalid answer',
      });

      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'wrong-answer');

      const verifyButton = screen.getByText('Verify');
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText(/Attempts:/)).toBeInTheDocument();
      });
    });

    it('should handle keyboard enter key', async () => {
      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'ABC123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCaptchaService.prototype.validateResponse).toHaveBeenCalled();
      });
    });

    it('should clear input after failed validation', async () => {
      mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
        valid: false,
        securityScore: 0,
        message: 'Invalid answer',
      });

      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'wrong-answer');

      const verifyButton = screen.getByText('Verify');
      await user.click(verifyButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should show success message after successful validation', async () => {
      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'ABC123');

      const verifyButton = screen.getByText('Verify');
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Verified successfully!')).toBeInTheDocument();
      });
    });

    it('should show error message after failed validation', async () => {
      mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
        valid: false,
        securityScore: 0,
        message: 'Invalid answer',
      });

      const user = userEvent.setup();
      
      render(
        <CaptchaProvider>
          <CaptchaWidget autoGenerate={true} />
        </CaptchaProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('ABC123')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'wrong-answer');

      const verifyButton = screen.getByText('Verify');
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid answer')).toBeInTheDocument();
      });
    });
  });

  describe('CaptchaContainer', () => {
    it('should render children', () => {
      render(
        <CaptchaProvider>
          <CaptchaContainer>
            <div data-testid="child">Test</div>
          </CaptchaContainer>
        </CaptchaProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <CaptchaProvider>
          <CaptchaContainer className="custom-container">
            <div>Test</div>
          </CaptchaContainer>
        </CaptchaProvider>
      );

      expect(screen.getByText('Test').closest('.captcha-container')).toHaveClass('custom-container');
    });

    it('should apply custom styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaContainer style={{ color: 'red' }}>
            <div>Test</div>
          </CaptchaContainer>
        </CaptchaProvider>
      );

      expect(screen.getByText('Test').closest('.captcha-container')).toHaveStyle({ color: 'red' });
    });

    it('should apply theme from context', () => {
      render(
        <CaptchaProvider>
          <CaptchaContainer>
            <div>Test</div>
          </CaptchaContainer>
        </CaptchaProvider>
      );

      const container = screen.getByText('Test').closest('.captcha-container');
      expect(container).toHaveStyle({ fontFamily: defaultTheme.fontFamily });
    });

    it('should override theme with custom theme', () => {
      const customTheme: CaptchaTheme = {
        fontFamily: 'Arial',
      };

      render(
        <CaptchaProvider>
          <CaptchaContainer theme={customTheme}>
            <div>Test</div>
          </CaptchaContainer>
        </CaptchaProvider>
      );

      const container = screen.getByText('Test').closest('.captcha-container');
      expect(container).toHaveStyle({ fontFamily: 'Arial' });
    });
  });

  describe('CaptchaButton', () => {
    it('should render with children', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton>Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should handle click events', async () => {
      const onClick = jest.fn();
      const user = userEvent.setup();

      render(
        <CaptchaProvider>
          <CaptchaButton onClick={onClick}>Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      await user.click(screen.getByText('Click Me'));
      expect(onClick).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton disabled={true}>Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      expect(screen.getByText('Click Me')).toBeDisabled();
    });

    it('should apply primary variant styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton variant="primary">Primary</CaptchaButton>
        </CaptchaProvider>
      );

      const button = screen.getByText('Primary');
      expect(button).toHaveStyle({ backgroundColor: defaultTheme.primaryColor });
    });

    it('should apply secondary variant styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton variant="secondary">Secondary</CaptchaButton>
        </CaptchaProvider>
      );

      const button = screen.getByText('Secondary');
      expect(button).toHaveStyle({ backgroundColor: defaultTheme.secondaryColor });
    });

    it('should apply outline variant styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton variant="outline">Outline</CaptchaButton>
        </CaptchaProvider>
      );

      const button = screen.getByText('Outline');
      expect(button).toHaveStyle({ backgroundColor: 'transparent' });
    });

    it('should apply custom className', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton className="custom-btn">Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      expect(screen.getByText('Click Me')).toHaveClass('custom-btn');
    });

    it('should apply custom styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaButton style={{ margin: '10px' }}>Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      expect(screen.getByText('Click Me')).toHaveStyle({ margin: '10px' });
    });

    it('should apply custom theme', () => {
      const customTheme: CaptchaTheme = {
        primaryColor: '#ff0000',
      };

      render(
        <CaptchaProvider>
          <CaptchaButton variant="primary" theme={customTheme}>Click Me</CaptchaButton>
        </CaptchaProvider>
      );

      expect(screen.getByText('Click Me')).toHaveStyle({ backgroundColor: '#ff0000' });
    });
  });

  describe('CaptchaInput', () => {
    it('should render with placeholder', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} placeholder="Enter text" />
        </CaptchaProvider>
      );

      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should handle value changes', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();

      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={onChange} />
        </CaptchaProvider>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'a');

      expect(onChange).toHaveBeenCalled();
    });

    it('should display value', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="test-value" onChange={() => {}} />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toHaveValue('test-value');
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} disabled={true} />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should apply error styles when error prop is true', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} error={true} />
        </CaptchaProvider>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveStyle({ borderColor: defaultTheme.errorColor });
    });

    it('should apply custom className', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} className="custom-input" />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toHaveClass('custom-input');
    });

    it('should apply custom styles', () => {
      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} style={{ width: '300px' }} />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toHaveStyle({ width: '300px' });
    });

    it('should apply custom theme', () => {
      const customTheme: CaptchaTheme = {
        borderColor: '#00ff00',
      };

      render(
        <CaptchaProvider>
          <CaptchaInput value="" onChange={() => {}} theme={customTheme} />
        </CaptchaProvider>
      );

      expect(screen.getByRole('textbox')).toHaveStyle({ borderColor: '#00ff00' });
    });
  });
});