/**
 * Mock for @angular/core/testing
 */
const _providers = new Map();
const _services = new Map();

const TestBed = {
  configureTestingModule: jest.fn().mockImplementation((config) => {
    // Store providers from providers array
    if (config && config.providers) {
      config.providers.forEach((provider) => {
        if (provider && provider.provide && provider.useValue !== undefined) {
          _providers.set(provider.provide, provider.useValue);
        }
      });
    }
    // Store providers from imports array (modules with forRoot)
    if (config && config.imports) {
      config.imports.forEach((imp) => {
        if (imp && imp.providers) {
          imp.providers.forEach((provider) => {
            if (provider && provider.provide && provider.useValue !== undefined) {
              _providers.set(provider.provide, provider.useValue);
            }
          });
        }
      });
    }
    return TestBed;
  }),
  compileComponents: jest.fn().mockResolvedValue(undefined),
  createComponent: jest.fn().mockImplementation((component) => ({
    componentInstance: new component(),
    debugElement: {
      query: jest.fn().mockReturnValue({ nativeElement: { textContent: 'ABC123', style: {}, value: '' } }),
      queryAll: jest.fn().mockReturnValue([]),
    },
    detectChanges: jest.fn(),
    destroy: jest.fn(),
  })),
  get: jest.fn().mockImplementation((token) => {
    if (_providers.has(token)) {
      return _providers.get(token);
    }
    if (_services.has(token)) {
      return _services.get(token);
    }
    // Try to instantiate the token as a class
    try {
      if (typeof token === 'function') {
        const instance = new token();
        _services.set(token, instance);
        return instance;
      }
    } catch (e) {
      // ignore
    }
    return {};
  }),
  inject: jest.fn().mockImplementation((token) => {
    if (_providers.has(token)) {
      return _providers.get(token);
    }
    if (_services.has(token)) {
      return _services.get(token);
    }
    // Try to instantiate the token as a class
    try {
      if (typeof token === 'function') {
        const instance = new token();
        _services.set(token, instance);
        return instance;
      }
    } catch (e) {
      // ignore
    }
    return {};
  }),
  overrideProvider: jest.fn().mockImplementation((token, value) => {
    _providers.set(token, value);
    return TestBed;
  }),
  resetTestingModule: jest.fn().mockImplementation(() => {
    _providers.clear();
    _services.clear();
    return TestBed;
  }),
};

const ComponentFixture = jest.fn().mockImplementation(() => ({
  componentInstance: {},
  debugElement: {
    query: jest.fn(),
    queryAll: jest.fn(),
  },
  detectChanges: jest.fn(),
  destroy: jest.fn(),
}));

const fakeAsync = (fn) => (...args) => fn(...args);
const tick = jest.fn();
const flush = jest.fn();
const flushMicrotasks = jest.fn();
const inject = jest.fn();
const async = jest.fn();
const waitForAsync = jest.fn();
const discardPeriodicTasks = jest.fn();
const resetFakeAsyncZone = jest.fn();
const getTestBed = jest.fn().mockReturnValue(TestBed);

module.exports = {
  TestBed,
  ComponentFixture,
  fakeAsync,
  tick,
  flush,
  flushMicrotasks,
  inject,
  async,
  waitForAsync,
  discardPeriodicTasks,
  resetFakeAsyncZone,
  getTestBed,
};