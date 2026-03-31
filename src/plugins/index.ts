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

// React Component Library
export {
  CaptchaProvider,
  CaptchaWidget,
  CaptchaContainer,
  CaptchaButton,
  CaptchaInput,
  useCaptcha,
  defaultTheme,
  CaptchaTheme,
  CaptchaOptions as ReactCaptchaOptions,
  CaptchaState,
  CaptchaContextValue,
  CaptchaWidgetProps,
  CaptchaProviderProps,
  UseCaptchaReturn,
} from './react-captcha';

// Vue.js Plugin
export {
  VueCaptcha,
  CaptchaProvider as VueCaptchaProvider,
  CaptchaWidget as VueCaptchaWidget,
  CaptchaContainer as VueCaptchaContainer,
  CaptchaButton as VueCaptchaButton,
  CaptchaInput as VueCaptchaInput,
  useCaptcha as useVueCaptcha,
  defaultTheme as vueDefaultTheme,
  CAPTCHA_CONTEXT_KEY,
  CaptchaTheme as VueCaptchaTheme,
  CaptchaOptions as VueCaptchaOptions,
  CaptchaState as VueCaptchaState,
  CaptchaContextValue as VueCaptchaContextValue,
  CaptchaWidgetProps as VueCaptchaWidgetProps,
  UseCaptchaReturn as UseVueCaptchaReturn,
  VueCaptchaPluginOptions,
} from './vue-captcha';

// Svelte Component
export {
  createCaptchaStore,
  captchaAction,
  defaultTheme as svelteDefaultTheme,
  getContainerStyle,
  getButtonStyle,
  getInputStyle,
  getChallengeStyle,
  getTypeButtonStyle,
  CaptchaTheme as SvelteCaptchaTheme,
  CaptchaOptions as SvelteCaptchaOptions,
  CaptchaState as SvelteCaptchaState,
  CaptchaStore as SvelteCaptchaStore,
  CaptchaWidgetProps as SvelteCaptchaWidgetProps,
} from './svelte-captcha';

// Default exports
export { default as ExpressCaptcha } from './express-captcha';
export { default as FastifyCaptcha } from './fastify-captcha';
export { default as KoaCaptcha } from './koa-captcha';
export { default as NestJsCaptcha } from './nestjs-captcha';
export { default as ReactCaptcha } from './react-captcha';
export { default as VueCaptchaPlugin } from './vue-captcha';
export { default as SvelteCaptcha } from './svelte-captcha';
