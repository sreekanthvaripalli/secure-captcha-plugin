/**
 * Webhook Service for Secure CAPTCHA Plugin
 *
 * Provides:
 * - Webhook registration and management
 * - Payload signing with HMAC-SHA256
 * - Delivery with retry logic and exponential backoff
 * - Delivery tracking and status
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookPayload,
  WebhookSignature,
  WebhookStats,
  WebhookEventType,
  WebhookStatus,
  DeliveryStatus,
} from './types';

export interface WebhookServiceConfig {
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  deliveryTimeout?: number;
  signingSecret?: string;
}

export class WebhookService {
  private readonly webhooks: Map<string, WebhookConfig> = new Map();
  private readonly deliveries: Map<string, WebhookDelivery> = new Map();
  private readonly config: Required<WebhookServiceConfig>;
  private readonly deliveryQueue: WebhookDelivery[] = [];
  private isProcessing: boolean = false;

  constructor(config?: WebhookServiceConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? 5,
      baseRetryDelay: config?.baseRetryDelay ?? 1000,
      maxRetryDelay: config?.maxRetryDelay ?? 60000,
      deliveryTimeout: config?.deliveryTimeout ?? 10000,
      signingSecret:
        config?.signingSecret ?? process.env.WEBHOOK_SECRET ?? 'default-webhook-secret',
    };
  }

  /**
   * Register a new webhook
   */
  registerWebhook(url: string, events: WebhookEventType[], secret?: string): WebhookConfig {
    const webhook: WebhookConfig = {
      id: uuidv4(),
      url,
      events,
      secret: secret || crypto.randomBytes(32).toString('hex'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.get(id);
  }

  /**
   * List all webhooks
   */
  listWebhooks(status?: WebhookStatus): WebhookConfig[] {
    const webhooks = Array.from(this.webhooks.values());
    if (status) {
      return webhooks.filter(w => w.status === status);
    }
    return webhooks;
  }

  /**
   * Update webhook
   */
  updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return null;
    }

    const updated = {
      ...webhook,
      ...updates,
      updatedAt: new Date(),
    };

    this.webhooks.set(id, updated);
    return updated;
  }

  /**
   * Delete webhook
   */
  deleteWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  /**
   * Generate HMAC signature for payload
   */
  signPayload(payload: string, secret: string): WebhookSignature {
    const timestamp = Date.now();
    const payloadToSign = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

    return {
      signature,
      timestamp,
      algorithm: 'hmac-sha256',
    };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, timestamp: number, secret: string): boolean {
    const payloadToSign = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Trigger webhook delivery
   */
  async triggerEvent(event: WebhookEventType, data: Record<string, unknown>): Promise<string[]> {
    const webhooks = this.listWebhooks('active').filter(w => w.events.includes(event));

    const deliveryIds: string[] = [];

    for (const webhook of webhooks) {
      const delivery = this.createDelivery(webhook.id, event, data);
      this.deliveries.set(delivery.id, delivery);
      this.deliveryQueue.push(delivery);
      deliveryIds.push(delivery.id);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return deliveryIds;
  }

  /**
   * Create a delivery record
   */
  private createDelivery(
    webhookId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): WebhookDelivery {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const payload: WebhookPayload = {
      id: uuidv4(),
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        webhookId,
        deliveryId: uuidv4(),
        attempt: 1,
      },
    };

    return {
      id: payload.metadata.deliveryId,
      webhookId,
      event,
      payload: payload as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: new Date(),
    };
  }

  /**
   * Process delivery queue
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue.shift();
      if (!delivery) {
        continue;
      }

      await this.processDelivery(delivery);
    }

    this.isProcessing = false;
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || webhook.status !== 'active') {
      delivery.status = 'failed';
      delivery.lastError = 'Webhook not active';
      return;
    }

    delivery.attempts++;
    delivery.status = 'retrying';

    const payload = JSON.stringify(delivery.payload);
    const signature = this.signPayload(payload, webhook.secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature.signature,
      'X-Webhook-Timestamp': signature.timestamp.toString(),
      'X-Webhook-Algorithm': signature.algorithm,
      'X-Webhook-Delivery-ID': delivery.id,
      'X-Webhook-Event': delivery.event,
      'User-Agent': 'Secure-CAPTCHA-Webhook/1.0',
    };

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.deliveryTimeout);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      delivery.responseCode = response.status;
      delivery.responseTime = Date.now() - startTime;

      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      delivery.responseTime = Date.now() - startTime;
      delivery.lastError = error.message;

      if (delivery.attempts < delivery.maxAttempts) {
        delivery.status = 'retrying';
        const retryDelay = this.calculateRetryDelay(delivery.attempts);
        delivery.nextRetryAt = new Date(Date.now() + retryDelay);

        // Schedule retry
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
          if (!this.isProcessing) {
            this.processQueue();
          }
        }, retryDelay);
      } else {
        delivery.status = 'failed';
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.baseRetryDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  /**
   * Get delivery by ID
   */
  getDelivery(id: string): WebhookDelivery | undefined {
    return this.deliveries.get(id);
  }

  /**
   * List deliveries for a webhook
   */
  listDeliveries(webhookId: string, status?: DeliveryStatus): WebhookDelivery[] {
    const deliveries = Array.from(this.deliveries.values()).filter(d => d.webhookId === webhookId);

    if (status) {
      return deliveries.filter(d => d.status === status);
    }

    return deliveries;
  }

  /**
   * Get webhook statistics
   */
  getStats(): WebhookStats {
    const webhooks = this.listWebhooks();
    const deliveries = Array.from(this.deliveries.values());

    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;
    const totalDeliveryTime = deliveries
      .filter(d => d.responseTime)
      .reduce((sum, d) => sum + (d.responseTime || 0), 0);

    return {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.status === 'active').length,
      totalDeliveries: deliveries.length,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime: successfulDeliveries > 0 ? totalDeliveryTime / successfulDeliveries : 0,
      successRate: deliveries.length > 0 ? (successfulDeliveries / deliveries.length) * 100 : 0,
    };
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== 'failed') {
      return false;
    }

    delivery.attempts = 0;
    delivery.status = 'pending';
    delivery.lastError = undefined;
    delivery.nextRetryAt = undefined;

    this.deliveryQueue.push(delivery);

    if (!this.isProcessing) {
      this.processQueue();
    }

    return true;
  }
}
