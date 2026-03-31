/**
 * Vanilla JavaScript SDK Tests
 * Tests for CaptchaClient, CaptchaWidget, createCaptchaWidget, and initCaptchaWidgets
 *
 * @jest-environment jsdom
 */

import {
  CaptchaClient,
  CaptchaWidget,
  createCaptchaWidget,
  initCaptchaWidgets,
  defaultTheme,
  CaptchaWidgetConfig,
  CaptchaClientOptions,
} from '../../src/plugins/vanilla-js-sdk';
import { CaptchaService } from '../../src/core/captcha-service';

// Mock CaptchaService
jest.mock('../../src/core/captcha-service');

const mockCaptchaService = CaptchaService as jest.MockedClass<typeof CaptchaService>;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Vanilla JavaScript SDK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

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
  });

  describe('CaptchaClient', () => {
    describe('Constructor', () => {
      it('should create client with default options', () => {
        const client = new CaptchaClient();
        expect(client).toBeDefined();
      });

      it('should create client with custom options', () => {
        const options: CaptchaClientOptions = {
          baseUrl: 'https://api.example.com/captcha',
          apiKey: 'test-api-key',
          timeout: 5000,
          headers: { 'X-Custom-Header': 'value' },
          useLocalService: true,
        };

        const client = new CaptchaClient(options);
        expect(client).toBeDefined();
      });

      it('should initialize local service when useLocalService is true', () => {
        const client = new CaptchaClient({ useLocalService: true });
        expect(client.getLocalService()).toBeDefined();
      });

      it('should not initialize local service when useLocalService is false', () => {
        const client = new CaptchaClient({ useLocalService: false });
        expect(client.getLocalService()).toBeNull();
      });
    });

    describe('generate()', () => {
      it('should generate captcha using local service', async () => {
        const client = new CaptchaClient({ useLocalService: true });
        const response = await client.generate('text', 'medium');

        expect(response.sessionId).toBe('test-session-123');
        expect(response.challenge).toBe('ABC123');
        expect(response.type).toBe('text');
        expect(response.difficulty).toBe('medium');
      });

      it('should generate captcha using API', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'api-session-456',
              challenge: 'XYZ789',
              type: 'math',
              difficulty: 'hard',
              expiresIn: 600,
            }),
        });

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          useLocalService: false,
        });

        const response = await client.generate('math', 'hard');

        expect(response.sessionId).toBe('api-session-456');
        expect(response.challenge).toBe('XYZ789');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/captcha/generate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ type: 'math', difficulty: 'hard' }),
          })
        );
      });

      it('should include API key in headers', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: 'test',
              challenge: 'test',
              type: 'text',
              difficulty: 'medium',
              expiresIn: 300,
            }),
        });

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          apiKey: 'test-key',
          useLocalService: false,
        });

        await client.generate();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': 'test-key',
            }),
          })
        );
      });

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'Server error' }),
        });

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          useLocalService: false,
        });

        await expect(client.generate()).rejects.toThrow('Server error');
      });

      it('should handle timeout errors', async () => {
        mockFetch.mockImplementation(
          () =>
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
        );

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          timeout: 50,
          useLocalService: false,
        });

        await expect(client.generate()).rejects.toThrow('Request timeout');
      });
    });

    describe('validate()', () => {
      it('should validate captcha using local service', async () => {
        const client = new CaptchaClient({ useLocalService: true });
        const result = await client.validate('session-123', 'ABC123', 'text');

        expect(result.valid).toBe(true);
        expect(result.securityScore).toBe(95);
        expect(result.message).toBe('Validation successful');
      });

      it('should validate captcha using API', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              valid: true,
              securityScore: 90,
              message: 'Valid',
            }),
        });

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          useLocalService: false,
        });

        const result = await client.validate('session-123', 'ABC123', 'text');

        expect(result.valid).toBe(true);
        expect(result.securityScore).toBe(90);
      });
    });

    describe('getTypes()', () => {
      it('should get types from local service', async () => {
        const client = new CaptchaClient({ useLocalService: true });
        const types = await client.getTypes();

        expect(types).toEqual(['text', 'math', 'logic', 'image']);
      });

      it('should get types from API', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ types: ['text', 'math'] }),
        });

        const client = new CaptchaClient({
          baseUrl: 'https://api.example.com/captcha',
          useLocalService: false,
        });

        const types = await client.getTypes();

        expect(types).toEqual(['text', 'math']);
      });
    });
  });

  describe('CaptchaWidget', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-container';
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create widget with element container', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      new CaptchaWidget(config);
      expect(container.querySelector('.captcha-widget')).toBeDefined();
    });

    it('should create widget with selector container', () => {
      const config: CaptchaWidgetConfig = {
        container: '#test-container',
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      void widget;
      expect(widget).toBeDefined();
    });

    it('should throw error for invalid selector', () => {
      const config: CaptchaWidgetConfig = {
        container: '#non-existent',
        autoGenerate: false,
      };

      expect(() => new CaptchaWidget(config)).toThrow('Container not found');
    });

    it('should render widget HTML', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      new CaptchaWidget(config);
      expect(container.innerHTML).toContain('captcha-widget');
      expect(container.querySelector('input')).toBeDefined();
      expect(container.querySelector('button')).toBeDefined();
    });

    it('should generate captcha on mount when autoGenerate is true', async () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: true,
      };

      void new CaptchaWidget(config);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalled();
    });

    it('should not generate captcha on mount when autoGenerate is false', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      void new CaptchaWidget(config);
      expect(mockCaptchaService.prototype.generateCaptcha).not.toHaveBeenCalled();
    });

    it('should call onGenerate handler', async () => {
      const onGenerate = jest.fn();
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        handlers: { onGenerate },
      };

      const widget = new CaptchaWidget(config);
      await widget.generate();

      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          challenge: 'ABC123',
        })
      );
    });

    it('should call onValidate handler', async () => {
      const onValidate = jest.fn();
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        handlers: { onValidate },
      };

      const widget = new CaptchaWidget(config);
      await widget.generate();
      await widget.validate('ABC123');

      expect(onValidate).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          securityScore: 95,
        })
      );
    });

    it('should call onError handler on error', async () => {
      mockCaptchaService.prototype.generateCaptcha.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const onError = jest.fn();
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        handlers: { onError },
      };

      const widget = new CaptchaWidget(config);

      await expect(widget.generate()).rejects.toThrow('Generation failed');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onReset handler', () => {
      const onReset = jest.fn();
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        handlers: { onReset },
      };

      const widget = new CaptchaWidget(config);
      widget.reset();

      expect(onReset).toHaveBeenCalled();
    });

    it('should get current state', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      const state = widget.getState();

      expect(state).toHaveProperty('isLoading');
      expect(state).toHaveProperty('error');
      expect(state).toHaveProperty('sessionId');
      expect(state).toHaveProperty('challenge');
      expect(state).toHaveProperty('type');
      expect(state).toHaveProperty('difficulty');
      expect(state).toHaveProperty('expiresIn');
      expect(state).toHaveProperty('isValidated');
      expect(state).toHaveProperty('validationResult');
      expect(state).toHaveProperty('attempts');
    });

    it('should throw error when validating without session', async () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);

      await expect(widget.validate('ABC123')).rejects.toThrow('No active CAPTCHA session');
    });

    it('should throw error when max attempts exceeded', async () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      await widget.generate();

      // Simulate max attempts
      (widget as any).state.attempts = 3;

      await expect(widget.validate('ABC123')).rejects.toThrow(
        'Maximum validation attempts exceeded'
      );
    });

    it('should throw error when widget is destroyed', async () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      widget.destroy();

      await expect(widget.generate()).rejects.toThrow('Widget has been destroyed');
    });

    it('should destroy widget and cleanup', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      widget.destroy();

      expect(container.innerHTML).toBe('');
    });

    it('should get available types', async () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
      };

      const widget = new CaptchaWidget(config);
      const types = await widget.getAvailableTypes();

      expect(types).toEqual(['text', 'math', 'logic', 'image']);
    });

    it('should render with custom theme', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        theme: {
          primaryColor: '#ff0000',
          borderRadius: 12,
        },
      };

      new CaptchaWidget(config);
      expect(container.querySelector('.captcha-widget')).toBeDefined();
    });

    it('should render with type selector when showTypeSelector is true', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        showTypeSelector: true,
      };

      new CaptchaWidget(config);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(1);
    });

    it('should render without refresh button when showRefresh is false', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        showRefresh: false,
      };

      new CaptchaWidget(config);
      const refreshBtn = container.querySelector('button[aria-label="Refresh CAPTCHA"]');
      expect(refreshBtn).toBeNull();
    });

    it('should render with custom placeholder', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        placeholder: 'Custom placeholder',
      };

      new CaptchaWidget(config);
      const input = container.querySelector('input');
      expect(input?.getAttribute('placeholder')).toBe('Custom placeholder');
    });

    it('should render with custom submit text', () => {
      const config: CaptchaWidgetConfig = {
        container,
        autoGenerate: false,
        submitText: 'Submit',
      };

      new CaptchaWidget(config);
      const buttons = container.querySelectorAll('button');
      const submitBtn = Array.from(buttons).find(btn => btn.textContent === 'Submit');
      expect(submitBtn).toBeDefined();
    });
  });

  describe('createCaptchaWidget', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-container';
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create widget using factory function', () => {
      const widget = createCaptchaWidget({
        container: '#test-container',
        autoGenerate: false,
      });

      expect(widget).toBeDefined();
      expect(widget).toBeInstanceOf(CaptchaWidget);
    });

    it('should create widget with custom client', () => {
      const client = new CaptchaClient({ useLocalService: true });
      const widget = createCaptchaWidget(
        {
          container: '#test-container',
          autoGenerate: false,
        },
        client
      );

      expect(widget).toBeDefined();
    });
  });

  describe('initCaptchaWidgets', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should initialize widgets from data attributes', () => {
      const div = document.createElement('div');
      div.setAttribute('data-captcha', '');
      div.setAttribute('data-captcha-type', 'math');
      div.setAttribute('data-captcha-difficulty', 'hard');
      document.body.appendChild(div);

      const widgets = initCaptchaWidgets();

      expect(widgets.length).toBe(1);
      expect(widgets[0]).toBeInstanceOf(CaptchaWidget);
    });

    it('should initialize multiple widgets', () => {
      const div1 = document.createElement('div');
      div1.setAttribute('data-captcha', '');
      document.body.appendChild(div1);

      const div2 = document.createElement('div');
      div2.setAttribute('data-captcha', '');
      document.body.appendChild(div2);

      const widgets = initCaptchaWidgets();

      expect(widgets.length).toBe(2);
    });

    it('should apply theme from data attributes', () => {
      const div = document.createElement('div');
      div.setAttribute('data-captcha', '');
      div.setAttribute('data-captcha-primary-color', '#ff0000');
      div.setAttribute('data-captcha-border-radius', '12');
      document.body.appendChild(div);

      const widgets = initCaptchaWidgets();

      expect(widgets.length).toBe(1);
    });

    it('should handle invalid elements gracefully', () => {
      const widgets = initCaptchaWidgets();
      expect(widgets.length).toBe(0);
    });

    it('should store widget reference on element', () => {
      const div = document.createElement('div');
      div.setAttribute('data-captcha', '');
      document.body.appendChild(div);

      const widgets = initCaptchaWidgets();

      expect((div as any).__captchaWidget).toBeDefined();
      expect((div as any).__captchaWidget).toBe(widgets[0]);
    });
  });
});
