/**
 * Vue Testing Setup
 * Configures Vue testing environment
 */

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Configure Vue Test Utils after Vue is available
let config: any;
try {
  const vueTestUtils = require('@vue/test-utils');
  config = vueTestUtils.config;
  if (config && config.global) {
    config.global.stubs = {
      teleport: true,
    };
  }
} catch (e) {
  // Vue test utils not available, skip configuration
}
