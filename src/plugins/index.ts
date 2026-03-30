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

// Koa.js Middleware Plugin
export {
  KoaCaptchaMiddleware,
  KoaCaptchaOptions,
  CaptchaContext,
  createKoaCaptcha,
} from './koa-captcha';

// NestJS Module Plugin
export {
  NestJsCaptchaModule,
  NestJsCaptchaService,
  NestJsCaptchaOptions,
  CaptchaMiddleware,
  CaptchaGuard,
  CaptchaGuardOptions,
  UseCaptchaGuard,
  CaptchaOptions,
  CAPTCHA_GUARD_OPTIONS_KEY,
  createNestJsCaptchaModule,
} from './nestjs-captcha';

// Default exports
export { default as ExpressCaptcha } from './express-captcha';
export { default as FastifyCaptcha } from './fastify-captcha';
export { default as KoaCaptcha } from './koa-captcha';
export { default as NestJsCaptcha } from './nestjs-captcha';
