/**
 * Plugins Index
 * Exports all available plugins for the Secure CAPTCHA system
 */

// Express.js Middleware Plugin
export {
  ExpressCaptchaMiddleware,
  ExpressCaptchaOptions,
  CaptchaRequest,
  GenerateCaptchaBody,
  ValidateCaptchaBody,
  CaptchaErrorMessages,
  createExpressCaptcha,
} from './express-captcha';

// Default export
export { default as ExpressCaptcha } from './express-captcha';
