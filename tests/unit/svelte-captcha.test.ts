/**
 * Svelte Component Tests
 * Tests for createCaptchaStore, captchaAction, and helper functions
 *
 * @jest-environment jsdom
 */

import {
  createCaptchaStore,
  captchaAction,
  defaultTheme,
  getContainerStyle,
  getButtonStyle,
  getInputStyle,
  getChallengeStyle,
  getTypeButtonStyle,
  CaptchaTheme,
  CaptchaOptions,
} from '../../src/plugins/svelte-captcha';
import { CaptchaType } from '../../src/types/captcha';
import { CaptchaService } from '../../src/core/captcha-service';

// Mock CaptchaService
jest.mock('../../src/core/captcha-service');

const mockCaptchaService = CaptchaService as jest.MockedClass<typeof CaptchaService>;

describe('Svelte Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCaptchaService.prototype.getAvailableTypes.mockReturnValue([
      'text',
      'math',
      'logic',
      'image',
    ]);
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

  describe('createCaptchaStore', () => {
    it('should create a store with default options', () => {
      const store = createCaptchaStore();

      expect(store).toHaveProperty('state');
      expect(store).toHaveProperty('generate');
      expect(store).toHaveProperty('validate');
      expect(store).toHaveProperty('reset');
      expect(store).toHaveProperty('availableTypes');
      expect(store).toHaveProperty('theme');
      expect(store).toHaveProperty('options');
    });

    it('should return initial state', () => {
      const store = createCaptchaStore();
      let state: any;

      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.sessionId).toBeNull();
      expect(state.challenge).toBeNull();
      expect(state.type).toBeNull();
      expect(state.difficulty).toBeNull();
      expect(state.expiresIn).toBeNull();
      expect(state.isValidated).toBe(false);
      expect(state.validationResult).toBeNull();
      expect(state.attempts).toBe(0);
    });

    it('should accept custom options', () => {
      const customOptions: CaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
      };

      const store = createCaptchaStore(customOptions);
      let options: any;

      store.options.subscribe((o: any) => {
        options = o;
      })();

      expect(options.types).toEqual(['text', 'math']);
      expect(options.defaultDifficulty).toBe('hard');
      expect(options.maxAttempts).toBe(5);
    });

    it('should accept custom theme', () => {
      const customTheme: CaptchaTheme = {
        primaryColor: '#ff0000',
        borderRadius: 12,
      };

      const store = createCaptchaStore({}, customTheme);
      let theme: any;

      store.theme.subscribe((t: any) => {
        theme = t;
      })();

      expect(theme.primaryColor).toBe('#ff0000');
      expect(theme.borderRadius).toBe(12);
    });

    it('should generate captcha successfully', async () => {
      const store = createCaptchaStore();

      const response = await store.generate('text', 'medium');

      expect(response.sessionId).toBe('test-session-123');
      expect(response.challenge).toBe('ABC123');
      expect(response.type).toBe('text');
      expect(response.difficulty).toBe('medium');

      let state: any;
      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.sessionId).toBe('test-session-123');
      expect(state.challenge).toBe('ABC123');
      expect(state.type).toBe('text');
      expect(state.difficulty).toBe('medium');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle generate error', async () => {
      mockCaptchaService.prototype.generateCaptcha.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const store = createCaptchaStore();

      await expect(store.generate('text', 'medium')).rejects.toThrow('Generation failed');

      let state: any;
      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.error).toBe('Generation failed');
      expect(state.isLoading).toBe(false);
    });

    it('should validate captcha successfully', async () => {
      const store = createCaptchaStore();

      await store.generate('text', 'medium');
      const result = await store.validate('ABC123');

      expect(result.valid).toBe(true);
      expect(result.securityScore).toBe(95);
      expect(result.message).toBe('Validation successful');

      let state: any;
      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.isValidated).toBe(true);
      expect(state.validationResult?.valid).toBe(true);
      expect(state.attempts).toBe(1);
    });

    it('should throw error when validating without active session', async () => {
      const store = createCaptchaStore();

      await expect(store.validate('ABC123')).rejects.toThrow('No active CAPTCHA session');
    });

    it('should throw error when max attempts exceeded', async () => {
      const store = createCaptchaStore({ maxAttempts: 1 });

      await store.generate('text', 'medium');
      await store.validate('wrong-answer');

      await expect(store.validate('another-wrong')).rejects.toThrow(
        'Maximum validation attempts exceeded'
      );
    });

    it('should handle validate error', async () => {
      mockCaptchaService.prototype.validateResponse.mockRejectedValueOnce(
        new Error('Validation failed')
      );

      const store = createCaptchaStore();

      await store.generate('text', 'medium');

      await expect(store.validate('ABC123')).rejects.toThrow('Validation failed');

      let state: any;
      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.error).toBe('Validation failed');
      expect(state.attempts).toBe(1);
    });

    it('should reset state', async () => {
      const store = createCaptchaStore();

      await store.generate('text', 'medium');
      store.reset();

      let state: any;
      store.state.subscribe((s: any) => {
        state = s;
      })();

      expect(state.sessionId).toBeNull();
      expect(state.challenge).toBeNull();
      expect(state.type).toBeNull();
      expect(state.difficulty).toBeNull();
      expect(state.expiresIn).toBeNull();
      expect(state.isValidated).toBe(false);
      expect(state.validationResult).toBeNull();
      expect(state.attempts).toBe(0);
    });

    it('should return available types', () => {
      const store = createCaptchaStore();
      let availableTypes: CaptchaType[] = [];

      store.availableTypes.subscribe((types: CaptchaType[]) => {
        availableTypes = types;
      })();

      expect(availableTypes).toEqual(['text', 'math', 'logic', 'image']);
    });
  });

  describe('captchaAction', () => {
    let mockNode: HTMLElement;

    beforeEach(() => {
      mockNode = document.createElement('div');
    });

    it('should create action with store', () => {
      const store = createCaptchaStore();
      const action = captchaAction(mockNode, { store });

      expect(action).toHaveProperty('destroy');
      expect(action).toHaveProperty('update');
    });

    it('should create action with options', () => {
      const options: CaptchaOptions = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
      };

      const action = captchaAction(mockNode, { options });

      expect(action).toHaveProperty('destroy');
      expect(action).toHaveProperty('update');
    });

    it('should call onGenerate callback', async () => {
      const onGenerate = jest.fn();
      const store = createCaptchaStore();

      captchaAction(mockNode, { store, onGenerate });

      await store.generate('text', 'medium');

      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          challenge: 'ABC123',
        })
      );
    });

    it('should call onValidate callback', async () => {
      const onValidate = jest.fn();
      const store = createCaptchaStore();

      captchaAction(mockNode, { store, onValidate });

      await store.generate('text', 'medium');
      await store.validate('ABC123');

      expect(onValidate).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          securityScore: 95,
        })
      );
    });

    it('should call onError callback on generate error', async () => {
      mockCaptchaService.prototype.generateCaptcha.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const onError = jest.fn();
      const store = createCaptchaStore();

      captchaAction(mockNode, { store, onError });

      await expect(store.generate('text', 'medium')).rejects.toThrow('Generation failed');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onError callback on validate error', async () => {
      mockCaptchaService.prototype.validateResponse.mockRejectedValueOnce(
        new Error('Validation failed')
      );

      const onError = jest.fn();
      const store = createCaptchaStore();

      captchaAction(mockNode, { store, onError });

      await store.generate('text', 'medium');

      await expect(store.validate('ABC123')).rejects.toThrow('Validation failed');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should store captcha store on node', () => {
      const store = createCaptchaStore();

      captchaAction(mockNode, { store });

      expect((mockNode as any).__captchaStore).toBe(store);
    });

    it('should cleanup on destroy', () => {
      const store = createCaptchaStore();
      const resetSpy = jest.spyOn(store, 'reset');

      const action = captchaAction(mockNode, { store });

      action.destroy();

      expect(resetSpy).toHaveBeenCalled();
      expect((mockNode as any).__captchaStore).toBeUndefined();
    });

    it('should update store on update', () => {
      const store = createCaptchaStore();
      const action = captchaAction(mockNode, { store });

      const newOptions: CaptchaOptions = {
        types: ['math'],
        defaultDifficulty: 'easy',
      };

      action.update({ options: newOptions });

      // The store should be updated
      expect((mockNode as any).__captchaStore).toBeDefined();
    });
  });

  describe('getContainerStyle', () => {
    it('should return valid CSS string', () => {
      const style = getContainerStyle(defaultTheme);

      expect(style).toContain('font-family:');
      expect(style).toContain('font-size:');
      expect(style).toContain('padding:');
      expect(style).toContain('background-color:');
      expect(style).toContain('border:');
      expect(style).toContain('border-radius:');
      expect(style).toContain('box-shadow:');
      expect(style).toContain('max-width:');
    });

    it('should use theme values', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        fontFamily: 'Arial',
        fontSize: '16px',
        padding: '20px',
        backgroundColor: '#f0f0f0',
        borderColor: '#000000',
        borderRadius: 10,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      };

      const style = getContainerStyle(customTheme);

      expect(style).toContain('font-family: Arial');
      expect(style).toContain('font-size: 16px');
      expect(style).toContain('padding: 20px');
      expect(style).toContain('background-color: #f0f0f0');
      expect(style).toContain('border: 1px solid #000000');
      expect(style).toContain('border-radius: 10px');
      expect(style).toContain('box-shadow: 0 2px 4px rgba(0,0,0,0.2)');
    });
  });

  describe('getButtonStyle', () => {
    it('should return valid CSS string', () => {
      const style = getButtonStyle(defaultTheme);

      expect(style).toContain('background-color:');
      expect(style).toContain('color:');
      expect(style).toContain('border:');
      expect(style).toContain('border-radius:');
      expect(style).toContain('padding:');
      expect(style).toContain('cursor:');
      expect(style).toContain('opacity:');
      expect(style).toContain('font-family:');
      expect(style).toContain('font-size:');
      expect(style).toContain('transition:');
    });

    it('should use theme values', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        primaryColor: '#ff0000',
        borderRadius: 12,
        fontFamily: 'Arial',
        fontSize: '16px',
      };

      const style = getButtonStyle(customTheme);

      expect(style).toContain('background-color: #ff0000');
      expect(style).toContain('border-radius: 12px');
      expect(style).toContain('font-family: Arial');
      expect(style).toContain('font-size: 16px');
    });

    it('should apply disabled styles', () => {
      const style = getButtonStyle(defaultTheme, true);

      expect(style).toContain('cursor: not-allowed');
      expect(style).toContain('opacity: 0.6');
    });

    it('should apply enabled styles', () => {
      const style = getButtonStyle(defaultTheme, false);

      expect(style).toContain('cursor: pointer');
      expect(style).toContain('opacity: 1');
    });
  });

  describe('getInputStyle', () => {
    it('should return valid CSS string', () => {
      const style = getInputStyle(defaultTheme);

      expect(style).toContain('width:');
      expect(style).toContain('padding:');
      expect(style).toContain('border:');
      expect(style).toContain('border-radius:');
      expect(style).toContain('font-family:');
      expect(style).toContain('font-size:');
      expect(style).toContain('color:');
      expect(style).toContain('background-color:');
      expect(style).toContain('outline:');
      expect(style).toContain('box-sizing:');
    });

    it('should use theme values', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        borderColor: '#000000',
        borderRadius: 10,
        fontFamily: 'Arial',
        fontSize: '16px',
        textColor: '#333333',
      };

      const style = getInputStyle(customTheme);

      expect(style).toContain('border: 1px solid #000000');
      expect(style).toContain('border-radius: 10px');
      expect(style).toContain('font-family: Arial');
      expect(style).toContain('font-size: 16px');
      expect(style).toContain('color: #333333');
    });

    it('should apply error styles', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        errorColor: '#ff0000',
      };

      const style = getInputStyle(customTheme, true);

      expect(style).toContain('border: 1px solid #ff0000');
    });

    it('should apply normal styles', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        borderColor: '#cccccc',
      };

      const style = getInputStyle(customTheme, false);

      expect(style).toContain('border: 1px solid #cccccc');
    });
  });

  describe('getChallengeStyle', () => {
    it('should return valid CSS string', () => {
      const style = getChallengeStyle(defaultTheme);

      expect(style).toContain('padding:');
      expect(style).toContain('background-color:');
      expect(style).toContain('border-radius:');
      expect(style).toContain('margin-bottom:');
      expect(style).toContain('text-align:');
      expect(style).toContain('font-family:');
      expect(style).toContain('font-size:');
      expect(style).toContain('font-weight:');
      expect(style).toContain('letter-spacing:');
      expect(style).toContain('color:');
      expect(style).toContain('user-select:');
    });

    it('should use theme values', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        borderRadius: 12,
        textColor: '#333333',
      };

      const style = getChallengeStyle(customTheme);

      expect(style).toContain('border-radius: 12px');
      expect(style).toContain('color: #333333');
    });
  });

  describe('getTypeButtonStyle', () => {
    it('should return valid CSS string', () => {
      const style = getTypeButtonStyle(defaultTheme, false);

      expect(style).toContain('padding:');
      expect(style).toContain('border:');
      expect(style).toContain('border-radius:');
      expect(style).toContain('background-color:');
      expect(style).toContain('color:');
      expect(style).toContain('cursor:');
      expect(style).toContain('font-family:');
      expect(style).toContain('font-size:');
      expect(style).toContain('transition:');
    });

    it('should apply active styles', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        primaryColor: '#ff0000',
        borderRadius: 10,
      };

      const style = getTypeButtonStyle(customTheme, true);

      expect(style).toContain('border: 1px solid #ff0000');
      expect(style).toContain('background-color: #ff0000');
      expect(style).toContain('color: #ffffff');
      expect(style).toContain('border-radius: 10px');
    });

    it('should apply inactive styles', () => {
      const customTheme: Required<CaptchaTheme> = {
        ...defaultTheme,
        borderColor: '#cccccc',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderRadius: 10,
      };

      const style = getTypeButtonStyle(customTheme, false);

      expect(style).toContain('border: 1px solid #cccccc');
      expect(style).toContain('background-color: #ffffff');
      expect(style).toContain('color: #333333');
      expect(style).toContain('border-radius: 10px');
    });
  });
});
