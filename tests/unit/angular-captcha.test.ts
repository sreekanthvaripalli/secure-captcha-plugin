// @ts-nocheck
/**
 * Angular Component Tests
 * Tests for AngularCaptchaModule, CaptchaWidgetComponent, and AngularCaptchaService
 */

// Skip all Angular tests if Angular is not installed
let hasAngular = false;
try {
  require('@angular/core/testing');
  require('@angular/core');
  require('@angular/platform-browser');
  hasAngular = true;
} catch (e) {
  // Angular not installed
}

// If Angular is not installed, skip all tests
if (!hasAngular) {
  describe.skip('Angular Component', () => {
    it('should be skipped when Angular is not installed', () => {
      // This test will be skipped
    });
  });
} else {
  // Only run Angular tests if Angular is installed
  const { ComponentFixture, TestBed, fakeAsync, tick } = require('@angular/core/testing');
  const { By } = require('@angular/platform-browser');
  const {
    AngularCaptchaModule,
    CaptchaWidgetComponent,
    AngularCaptchaService,
    defaultTheme,
    CAPTCHA_CONFIG,
    CAPTCHA_THEME,
  } = require('../../src/plugins/angular-captcha.component');
  const { CaptchaService } = require('../../src/core/captcha-service');

  // Mock CaptchaService
  jest.mock('../../src/core/captcha-service');
  jest.mock('../../src/security/config');

  const mockCaptchaService = CaptchaService as jest.MockedClass<typeof CaptchaService>;

  describe('Angular Component', () => {
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

    describe('AngularCaptchaModule', () => {
      it('should create module with forRoot configuration', async () => {
        const options = {
          types: ['text', 'math'],
          defaultDifficulty: 'hard',
          maxAttempts: 5,
        };

        const theme = {
          primaryColor: '#ff0000',
        };

        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule.forRoot(options, theme)],
        }).compileComponents();

        const config = TestBed.inject(CAPTCHA_CONFIG);
        const injectedTheme = TestBed.inject(CAPTCHA_THEME);

        expect(config).toEqual(options);
        expect(injectedTheme).toEqual(theme);
      });

      it('should create module without configuration', async () => {
        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule],
        }).compileComponents();

        const service = TestBed.inject(AngularCaptchaService);
        expect(service).toBeTruthy();
      });
    });

    describe('AngularCaptchaService', () => {
      let service: any;

      beforeEach(async () => {
        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule],
        }).compileComponents();

        service = TestBed.inject(AngularCaptchaService);
      });

      it('should be created', () => {
        expect(service).toBeTruthy();
      });

      it('should return initial state', () => {
        const state = service.getState();

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

      it('should return available types', () => {
        const types = service.getAvailableTypes();
        expect(types).toEqual(['text', 'math', 'logic', 'image']);
      });

      it('should return default theme', () => {
        const theme = service.getTheme();
        expect(theme).toEqual(defaultTheme);
      });

      it('should return default options', () => {
        const options = service.getOptions();

        expect(options.types).toEqual(['text', 'math', 'logic', 'image']);
        expect(options.defaultDifficulty).toBe('medium');
        expect(options.maxAttempts).toBe(3);
      });

      it('should generate captcha successfully', fakeAsync(async () => {
        const response = await service.generate('text', 'medium');
        tick();

        expect(response.sessionId).toBe('test-session-123');
        expect(response.challenge).toBe('ABC123');

        const state = service.getState();
        expect(state.sessionId).toBe('test-session-123');
        expect(state.challenge).toBe('ABC123');
        expect(state.isLoading).toBe(false);
      }));

      it('should validate captcha successfully', fakeAsync(async () => {
        await service.generate('text', 'medium');
        tick();

        const result = await service.validate('ABC123');
        tick();

        expect(result.valid).toBe(true);
        expect(result.securityScore).toBe(95);

        const state = service.getState();
        expect(state.isValidated).toBe(true);
        expect(state.attempts).toBe(1);
      }));

      it('should reset state', fakeAsync(async () => {
        await service.generate('text', 'medium');
        tick();

        service.reset();

        const state = service.getState();
        expect(state.sessionId).toBeNull();
        expect(state.challenge).toBeNull();
        expect(state.isLoading).toBe(false);
      }));

      it('should update theme', () => {
        const newTheme = {
          primaryColor: '#ff0000',
        };

        service.updateTheme(newTheme);

        const theme = service.getTheme();
        expect(theme.primaryColor).toBe('#ff0000');
      });

      it('should update options', () => {
        const newOptions = {
          types: ['text', 'math'],
          defaultDifficulty: 'hard',
          maxAttempts: 5,
        };

        service.updateOptions(newOptions);

        const options = service.getOptions();
        expect(options.types).toEqual(['text', 'math']);
        expect(options.defaultDifficulty).toBe('hard');
        expect(options.maxAttempts).toBe(5);
      });

      it('should throw error when validating without session', async () => {
        await expect(service.validate('test')).rejects.toThrow('No active CAPTCHA session');
      });

      it('should throw error when max attempts exceeded', fakeAsync(async () => {
        service.updateOptions({ maxAttempts: 1 });
        await service.generate('text', 'medium');
        tick();

        mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
          valid: false,
          securityScore: 0,
          message: 'Invalid',
        });

        await service.validate('wrong');
        tick();

        await expect(service.validate('wrong')).rejects.toThrow(
          'Maximum validation attempts exceeded'
        );
      }));
    });

    describe('CaptchaWidgetComponent', () => {
      let component: any;
      let fixture: any;
      let service: any;

      beforeEach(async () => {
        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule],
        }).compileComponents();

        fixture = TestBed.createComponent(CaptchaWidgetComponent);
        component = fixture.componentInstance;
        service = TestBed.inject(AngularCaptchaService);
      });

      it('should create', () => {
        expect(component).toBeTruthy();
      });

      it('should render without crashing', () => {
        fixture.detectChanges();
        const input = fixture.debugElement.query(By.css('input[type="text"]'));
        expect(input).toBeTruthy();
      });

      it('should auto-generate on mount when autoGenerate is true', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();

        expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalled();
      }));

      it('should not auto-generate when autoGenerate is false', () => {
        component.autoGenerate = false;
        fixture.detectChanges();

        expect(mockCaptchaService.prototype.generateCaptcha).not.toHaveBeenCalled();
      });

      it('should display challenge after generation', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        fixture.detectChanges();

        const challengeElement = fixture.debugElement.query(By.css('div'));
        expect(challengeElement.nativeElement.textContent).toContain('ABC123');
      }));

      it('should handle input change', fakeAsync(() => {
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="text"]'));
        input.nativeElement.value = 'test-input';
        input.nativeElement.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(component.inputValue).toBe('test-input');
      }));

      it('should emit generate event', fakeAsync(() => {
        const generateSpy = jest.spyOn(component.generateEvent, 'emit');

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        expect(generateSpy).toHaveBeenCalled();
      }));

      it('should emit validate event', fakeAsync(() => {
        const validateSpy = jest.spyOn(component.validateEvent, 'emit');

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'ABC123';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();
        tick();

        expect(validateSpy).toHaveBeenCalled();
      }));

      it('should emit error event on error', fakeAsync(() => {
        const errorSpy = jest.spyOn(component.errorEvent, 'emit');

        mockCaptchaService.prototype.generateCaptcha.mockRejectedValueOnce(
          new Error('Generation failed')
        );

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        expect(errorSpy).toHaveBeenCalled();
      }));

      it('should show refresh button when showRefresh is true', () => {
        component.showRefresh = true;
        fixture.detectChanges();

        const refreshButton = fixture.debugElement.query(
          By.css('button[aria-label="Refresh CAPTCHA"]')
        );
        expect(refreshButton).toBeTruthy();
      });

      it('should hide refresh button when showRefresh is false', () => {
        component.showRefresh = false;
        fixture.detectChanges();

        const refreshButton = fixture.debugElement.query(
          By.css('button[aria-label="Refresh CAPTCHA"]')
        );
        expect(refreshButton).toBeFalsy();
      });

      it('should show type selector when showTypeSelector is true', () => {
        component.showTypeSelector = true;
        fixture.detectChanges();

        const typeButtons = fixture.debugElement.queryAll(By.css('button'));
        const typeTexts = typeButtons.map((btn: any) => btn.nativeElement.textContent.trim());

        expect(typeTexts).toContain('Text');
        expect(typeTexts).toContain('Math');
        expect(typeTexts).toContain('Logic');
        expect(typeTexts).toContain('Image');
      });

      it('should change type when type button is clicked', fakeAsync(() => {
        component.showTypeSelector = true;
        fixture.detectChanges();

        const mathButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Math');
        mathButton?.nativeElement.click();
        tick();

        expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalledWith(
          'math',
          'medium',
          expect.any(Object)
        );
      }));

      it('should apply custom placeholder', () => {
        component.placeholder = 'Custom placeholder';
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[placeholder="Custom placeholder"]'));
        expect(input).toBeTruthy();
      });

      it('should apply custom submit text', () => {
        component.submitText = 'Custom Submit';
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('button'));
        const submitButton = buttons.find(
          (btn: any) => btn.nativeElement.textContent.trim() === 'Custom Submit'
        );
        expect(submitButton).toBeTruthy();
      });

      it('should disable widget when disabled prop is true', () => {
        component.disabled = true;
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[disabled]'));
        expect(input).toBeTruthy();

        const buttons = fixture.debugElement.queryAll(By.css('button[disabled]'));
        expect(buttons.length).toBeGreaterThan(0);
      });

      it('should apply custom theme', () => {
        const customTheme = {
          primaryColor: '#ff0000',
        };

        component.theme = customTheme;
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        expect(verifyButton?.nativeElement.style.backgroundColor).toBe('rgb(255, 0, 0)');
      });

      it('should show expiration timer', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        fixture.detectChanges();

        const expirationElement = fixture.debugElement.query(By.css('div'));
        expect(expirationElement.nativeElement.textContent).toMatch(/Expires in/);
      }));

      it('should show attempts counter after validation attempt', fakeAsync(() => {
        mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
          valid: false,
          securityScore: 0,
          message: 'Invalid answer',
        });

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'wrong-answer';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();

        fixture.detectChanges();

        const attemptsElement = fixture.debugElement.query(By.css('div'));
        expect(attemptsElement.nativeElement.textContent).toMatch(/Attempts:/);
      }));

      it('should handle keyboard enter key', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'ABC123';
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="text"]'));
        const event = new KeyboardEvent('keypress', { key: 'Enter' });
        input.nativeElement.dispatchEvent(event);
        tick();

        expect(mockCaptchaService.prototype.validateResponse).toHaveBeenCalled();
      }));

      it('should clear input after failed validation', fakeAsync(() => {
        mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
          valid: false,
          securityScore: 0,
          message: 'Invalid answer',
        });

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'wrong-answer';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();

        fixture.detectChanges();

        expect(component.inputValue).toBe('');
      }));

      it('should show success message after successful validation', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'ABC123';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();
        tick();

        fixture.detectChanges();

        const successElement = fixture.debugElement.query(By.css('div'));
        expect(successElement.nativeElement.textContent).toContain('✓ Verified successfully!');
      }));

      it('should show error message after failed validation', fakeAsync(() => {
        mockCaptchaService.prototype.validateResponse.mockResolvedValueOnce({
          valid: false,
          securityScore: 0,
          message: 'Invalid answer',
        });

        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'wrong-answer';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();
        tick();

        fixture.detectChanges();

        const errorElement = fixture.debugElement.query(By.css('div'));
        expect(errorElement.nativeElement.textContent).toContain('Invalid answer');
      }));

      it('should handle refresh button click', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        const refreshButton = fixture.debugElement.query(
          By.css('button[aria-label="Refresh CAPTCHA"]')
        );
        refreshButton?.nativeElement.click();
        tick();

        expect(mockCaptchaService.prototype.generateCaptcha).toHaveBeenCalledTimes(2);
      }));

      it('should update state after generation', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        expect(component.state.sessionId).toBe('test-session-123');
        expect(component.state.challenge).toBe('ABC123');
        expect(component.state.isLoading).toBe(false);
      }));

      it('should update state after validation', fakeAsync(() => {
        component.autoGenerate = true;
        fixture.detectChanges();
        tick();
        tick();

        component.inputValue = 'ABC123';
        fixture.detectChanges();

        const verifyButton = fixture.debugElement
          .queryAll(By.css('button'))
          .find((btn: any) => btn.nativeElement.textContent.trim() === 'Verify');
        verifyButton?.nativeElement.click();
        tick();
        tick();

        expect(component.state.isValidated).toBe(true);
        expect(component.state.attempts).toBe(1);
      }));
    });

    describe('Integration Tests', () => {
      it('should work with custom configuration', fakeAsync(async () => {
        const options = {
          types: ['text', 'math'],
          defaultDifficulty: 'hard',
          maxAttempts: 5,
        };

        const theme = {
          primaryColor: '#ff0000',
        };

        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule.forRoot(options, theme)],
        }).compileComponents();

        const service = TestBed.inject(AngularCaptchaService);
        const fixture = TestBed.createComponent(CaptchaWidgetComponent);
        const component = fixture.componentInstance;

        fixture.detectChanges();
        tick();

        const serviceOptions = service.getOptions();
        expect(serviceOptions.types).toEqual(['text', 'math']);
        expect(serviceOptions.defaultDifficulty).toBe('hard');
        expect(serviceOptions.maxAttempts).toBe(5);

        const serviceTheme = service.getTheme();
        expect(serviceTheme.primaryColor).toBe('#ff0000');
      }));

      it('should handle multiple components', fakeAsync(async () => {
        await TestBed.configureTestingModule({
          imports: [AngularCaptchaModule],
        }).compileComponents();

        const service = TestBed.inject(AngularCaptchaService);
        const fixture1 = TestBed.createComponent(CaptchaWidgetComponent);
        const fixture2 = TestBed.createComponent(CaptchaWidgetComponent);

        fixture1.componentInstance.autoGenerate = true;
        fixture2.componentInstance.autoGenerate = true;

        fixture1.detectChanges();
        fixture2.detectChanges();
        tick();
        tick();

        // Both components should share the same service
        expect(service.getState().sessionId).toBe('test-session-123');
      }));
    });
  });
}
