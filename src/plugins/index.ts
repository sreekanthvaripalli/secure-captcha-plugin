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

// Fastify Plugin
export {
  FastifyCaptchaPlugin,
  FastifyCaptchaOptions,
  createFastifyCaptcha,
} from './fastify-captcha';

// Default exports
export { default as ExpressCaptcha } from './express-captcha';
export { default as FastifyCaptcha } from './fastify-captcha';
