/**
 * Mock for @angular/platform-browser
 */
const By = {
  all: jest.fn(),
  css: jest.fn((selector) => (debugElement) => debugElement),
  directive: jest.fn(),
};

const HAMMER_GESTURE_CONFIG = jest.fn();
const HammerGestureConfig = jest.fn();
const DomSanitizer = jest.fn().mockImplementation(() => ({
  sanitize: jest.fn((ctx, val) => val),
  bypassSecurityTrustHtml: jest.fn((val) => val),
  bypassSecurityTrustStyle: jest.fn((val) => val),
  bypassSecurityTrustScript: jest.fn((val) => val),
  bypassSecurityTrustUrl: jest.fn((val) => val),
  bypassSecurityTrustResourceUrl: jest.fn((val) => val),
}));
const Title = jest.fn();
const Meta = jest.fn();

module.exports = {
  By,
  HAMMER_GESTURE_CONFIG,
  HammerGestureConfig,
  DomSanitizer,
  Title,
  Meta,
};