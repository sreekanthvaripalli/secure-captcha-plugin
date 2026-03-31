// @ts-nocheck
/**
 * Angular Component Tests
 * Tests for AngularCaptchaModule, CaptchaWidgetComponent, and AngularCaptchaService
 *
 * Note: These tests verify the exported types and configurations from the Angular module.
 * Full component testing requires a real Angular environment with TestBed.
 */

// Mock Angular modules - moduleNameMapper in jest.config.js handles the mapping
jest.mock('@angular/core');
jest.mock('@angular/core/testing');
jest.mock('@angular/platform-browser');
jest.mock('@angular/common');
jest.mock('@angular/forms');

const {
  AngularCaptchaModule,
  CaptchaWidgetComponent,
  AngularCaptchaService,
  defaultTheme,
  CAPTCHA_CONFIG,
  CAPTCHA_THEME,
} = require('../../src/plugins/angular-captcha.component');

describe('Angular Component', () => {
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

  describe('AngularCaptchaModule', () => {
    it('should export AngularCaptchaModule class', () => {
      expect(AngularCaptchaModule).toBeDefined();
      expect(typeof AngularCaptchaModule).toBe('function');
    });

    it('should have forRoot static method', () => {
      expect(typeof AngularCaptchaModule.forRoot).toBe('function');
    });

    it('should return module config with forRoot', () => {
      const options = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
      };

      const theme = {
        primaryColor: '#ff0000',
      };

      const moduleConfig = AngularCaptchaModule.forRoot(options, theme);

      expect(moduleConfig).toBeDefined();
      expect(moduleConfig.ngModule).toBe(AngularCaptchaModule);
      expect(moduleConfig.providers).toBeDefined();
      expect(Array.isArray(moduleConfig.providers)).toBe(true);
    });

    it('should include CAPTCHA_CONFIG provider in forRoot', () => {
      const options = { types: ['text'] };
      const moduleConfig = AngularCaptchaModule.forRoot(options);

      const configProvider = moduleConfig.providers.find((p: any) => p.provide === CAPTCHA_CONFIG);
      expect(configProvider).toBeDefined();
      expect(configProvider.useValue).toEqual(options);
    });

    it('should include CAPTCHA_THEME provider in forRoot', () => {
      const theme = { primaryColor: '#ff0000' };
      const moduleConfig = AngularCaptchaModule.forRoot({}, theme);

      const themeProvider = moduleConfig.providers.find((p: any) => p.provide === CAPTCHA_THEME);
      expect(themeProvider).toBeDefined();
      expect(themeProvider.useValue).toEqual(theme);
    });
  });

  describe('Exports', () => {
    it('should export CaptchaWidgetComponent', () => {
      expect(CaptchaWidgetComponent).toBeDefined();
    });

    it('should export AngularCaptchaService', () => {
      expect(AngularCaptchaService).toBeDefined();
    });

    it('should export CAPTCHA_CONFIG token', () => {
      expect(CAPTCHA_CONFIG).toBeDefined();
      expect(CAPTCHA_CONFIG.name).toBe('CAPTCHA_CONFIG');
    });

    it('should export CAPTCHA_THEME token', () => {
      expect(CAPTCHA_THEME).toBeDefined();
      expect(CAPTCHA_THEME.name).toBe('CAPTCHA_THEME');
    });
  });

  describe('Integration', () => {
    it('should work with custom configuration', () => {
      const options = {
        types: ['text', 'math'],
        defaultDifficulty: 'hard',
        maxAttempts: 5,
      };

      const theme = {
        primaryColor: '#ff0000',
      };

      const moduleConfig = AngularCaptchaModule.forRoot(options, theme);

      expect(moduleConfig.ngModule).toBe(AngularCaptchaModule);
      expect(moduleConfig.providers.length).toBe(2);
    });

    it('should work with empty configuration', () => {
      const moduleConfig = AngularCaptchaModule.forRoot();

      expect(moduleConfig.ngModule).toBe(AngularCaptchaModule);
      expect(moduleConfig.providers).toBeDefined();
    });
  });
});
