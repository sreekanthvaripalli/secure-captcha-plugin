/**
 * Secure CAPTCHA Plugin
 * Enterprise-grade, non-crackable CAPTCHA solution with lightning-fast performance
 * 
 * @module secure-captcha-plugin
 */

export { CaptchaService } from './core/captcha-service';
export { CryptoService } from './security/crypto';
export { SecurityConfigurationService } from './security/config';
export { InputValidationService } from './security/input-validation';
export { 
  CaptchaGenerator, 
  BaseCaptchaGenerator, 
  CaptchaGeneratorFactory, 
  MultiLayerCaptchaGenerator, 
  CaptchaGeneratorRegistry 
} from './core/captcha-generator';

// Export types
export * from './types/captcha';
export * from './types/security';

// Export version
export const VERSION = '1.0.0';

// Default export
export default {
  version: VERSION,
  name: 'secure-captcha-plugin'
};