/**
 * Webhook Type Definitions for Secure CAPTCHA Plugin
 */

export type WebhookEventType =
  | 'captcha.generated'
  | 'captcha.validated'
  | 'captcha.failed'
  | 'session.expired'
  | 'rate.limit.exceeded'
  | 'security.alert'
  | 'bot.detected';

export type WebhookStatus = 'active' | 'paused' | 'disabled';

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  status: WebhookStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastError?: string;
  responseCode?: number;
  responseTime?: number;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  metadata: {
    webhookId: string;
    deliveryId: string;
    attempt: number;
  };
}

export interface WebhookSignature {
  signature: string;
  timestamp: number;
  algorithm: 'hmac-sha256';
}

export interface WebhookDeliveryResult {
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  error?: string;
}

export interface WebhookStats {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
  successRate: number;
}
