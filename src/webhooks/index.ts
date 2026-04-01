/**
 * Webhook Module Exports
 *
 * Provides webhook functionality for Secure CAPTCHA Plugin including:
 * - Webhook registration and management
 * - Payload signing with HMAC-SHA256
 * - Delivery with retry logic and exponential backoff
 * - Delivery tracking and status
 */

export { WebhookService } from './webhook-service';
export type { WebhookServiceConfig } from './webhook-service';
export { createWebhookMiddleware } from './webhook-middleware';
export type { WebhookMiddlewareOptions } from './webhook-middleware';
export type {
  WebhookEventType,
  WebhookStatus,
  DeliveryStatus,
  WebhookConfig,
  WebhookDelivery,
  WebhookPayload,
  WebhookSignature,
  WebhookDeliveryResult,
  WebhookStats,
} from './types';
