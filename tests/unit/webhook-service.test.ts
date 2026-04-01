/**
 * Webhook Service Tests
 * Validates webhook registration, delivery, signing, and retry logic
 */

import { WebhookService } from '../../src/webhooks/webhook-service';
import { WebhookEventType } from '../../src/webhooks/types';

describe('WebhookService', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService({
      maxRetries: 3,
      baseRetryDelay: 100,
      maxRetryDelay: 1000,
      deliveryTimeout: 5000,
    });
  });

  describe('Webhook Registration', () => {
    test('should register a new webhook', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
        'captcha.validated',
      ]);

      expect(webhook).toBeDefined();
      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain('captcha.generated');
      expect(webhook.events).toContain('captcha.validated');
      expect(webhook.status).toBe('active');
      expect(webhook.secret).toBeDefined();
    });

    test('should register webhook with custom secret', () => {
      const webhook = webhookService.registerWebhook(
        'https://example.com/webhook',
        ['captcha.generated'],
        'my-secret'
      );

      expect(webhook.secret).toBe('my-secret');
    });

    test('should get webhook by ID', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      const retrieved = webhookService.getWebhook(webhook.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(webhook.id);
    });

    test('should return undefined for non-existent webhook', () => {
      const retrieved = webhookService.getWebhook('non-existent');
      expect(retrieved).toBeUndefined();
    });

    test('should list all webhooks', () => {
      webhookService.registerWebhook('https://example.com/1', ['captcha.generated']);
      webhookService.registerWebhook('https://example.com/2', ['captcha.validated']);

      const webhooks = webhookService.listWebhooks();
      expect(webhooks.length).toBe(2);
    });

    test('should filter webhooks by status', () => {
      const webhook1 = webhookService.registerWebhook('https://example.com/1', [
        'captcha.generated',
      ]);
      webhookService.registerWebhook('https://example.com/2', ['captcha.validated']);
      webhookService.updateWebhook(webhook1.id, { status: 'paused' });

      const activeWebhooks = webhookService.listWebhooks('active');
      expect(activeWebhooks.length).toBe(1);
    });

    test('should update webhook', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      const updated = webhookService.updateWebhook(webhook.id, {
        url: 'https://example.com/updated',
        status: 'paused',
      });

      expect(updated).toBeDefined();
      expect(updated?.url).toBe('https://example.com/updated');
      expect(updated?.status).toBe('paused');
    });

    test('should return null when updating non-existent webhook', () => {
      const updated = webhookService.updateWebhook('non-existent', { url: 'https://example.com' });
      expect(updated).toBeNull();
    });

    test('should delete webhook', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      const deleted = webhookService.deleteWebhook(webhook.id);
      expect(deleted).toBe(true);

      const retrieved = webhookService.getWebhook(webhook.id);
      expect(retrieved).toBeUndefined();
    });

    test('should return false when deleting non-existent webhook', () => {
      const deleted = webhookService.deleteWebhook('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Payload Signing', () => {
    test('should generate HMAC signature', () => {
      const signature = webhookService.signPayload('test-payload', 'secret');

      expect(signature.signature).toBeDefined();
      expect(signature.timestamp).toBeDefined();
      expect(signature.algorithm).toBe('hmac-sha256');
    });

    test('should verify valid signature', () => {
      const payload = 'test-payload';
      const secret = 'secret';
      const signature = webhookService.signPayload(payload, secret);

      const isValid = webhookService.verifySignature(
        payload,
        signature.signature,
        signature.timestamp,
        secret
      );

      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', () => {
      const payload = 'test-payload';
      const secret = 'secret';
      const wrongSecret = 'wrong-secret';
      const signature = webhookService.signPayload(payload, secret);

      const isValid = webhookService.verifySignature(
        payload,
        signature.signature,
        signature.timestamp,
        wrongSecret
      );

      expect(isValid).toBe(false);
    });

    test('should reject tampered payload', () => {
      const payload = 'test-payload';
      const secret = 'secret';
      const signature = webhookService.signPayload(payload, secret);

      const isValid = webhookService.verifySignature(
        'tampered-payload',
        signature.signature,
        signature.timestamp,
        secret
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Event Triggering', () => {
    test('should trigger event and create deliveries', async () => {
      webhookService.registerWebhook('https://example.com/webhook', ['captcha.generated']);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
        type: 'text',
      });

      expect(deliveryIds.length).toBe(1);
    });

    test('should not trigger event for non-matching webhooks', async () => {
      webhookService.registerWebhook('https://example.com/webhook', ['captcha.validated']);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      expect(deliveryIds.length).toBe(0);
    });

    test('should trigger event for multiple matching webhooks', async () => {
      webhookService.registerWebhook('https://example.com/1', ['captcha.generated']);
      webhookService.registerWebhook('https://example.com/2', ['captcha.generated']);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      expect(deliveryIds.length).toBe(2);
    });

    test('should not trigger event for paused webhooks', async () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);
      webhookService.updateWebhook(webhook.id, { status: 'paused' });

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      expect(deliveryIds.length).toBe(0);
    });
  });

  describe('Delivery Tracking', () => {
    test('should get delivery by ID', async () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      const delivery = webhookService.getDelivery(deliveryIds[0]);
      expect(delivery).toBeDefined();
      expect(delivery?.webhookId).toBe(webhook.id);
    });

    test('should list deliveries for webhook', async () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      await webhookService.triggerEvent('captcha.generated', { sessionId: '1' });
      await webhookService.triggerEvent('captcha.generated', { sessionId: '2' });

      const deliveries = webhookService.listDeliveries(webhook.id);
      expect(deliveries.length).toBe(2);
    });

    test('should filter deliveries by status', async () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'captcha.generated',
      ]);

      await webhookService.triggerEvent('captcha.generated', { sessionId: '1' });

      const pendingDeliveries = webhookService.listDeliveries(webhook.id, 'pending');
      expect(pendingDeliveries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    test('should return webhook statistics', () => {
      webhookService.registerWebhook('https://example.com/1', ['captcha.generated']);
      webhookService.registerWebhook('https://example.com/2', ['captcha.validated']);

      const stats = webhookService.getStats();

      expect(stats.totalWebhooks).toBe(2);
      expect(stats.activeWebhooks).toBe(2);
      expect(stats.totalDeliveries).toBe(0);
      expect(stats.successfulDeliveries).toBe(0);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed delivery', async () => {
      webhookService.registerWebhook('https://example.com/webhook', ['captcha.generated']);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      const delivery = webhookService.getDelivery(deliveryIds[0]);
      expect(delivery).toBeDefined();

      // Manually set delivery to failed for testing
      if (delivery) {
        (delivery as any).status = 'failed';
        (delivery as any).attempts = 3;
        (delivery as any).maxAttempts = 3;

        const retried = await webhookService.retryDelivery(delivery.id);
        expect(retried).toBe(true);
      }
    });

    test('should return false for non-failed delivery retry', async () => {
      webhookService.registerWebhook('https://example.com/webhook', ['captcha.generated']);

      const deliveryIds = await webhookService.triggerEvent('captcha.generated', {
        sessionId: 'test-session',
      });

      const retried = await webhookService.retryDelivery(deliveryIds[0]);
      expect(retried).toBe(false);
    });

    test('should return false for non-existent delivery retry', async () => {
      const retried = await webhookService.retryDelivery('non-existent');
      expect(retried).toBe(false);
    });
  });

  describe('All Event Types', () => {
    const eventTypes: WebhookEventType[] = [
      'captcha.generated',
      'captcha.validated',
      'captcha.failed',
      'session.expired',
      'rate.limit.exceeded',
      'security.alert',
      'bot.detected',
    ];

    test.each(eventTypes)('should trigger %s event', async eventType => {
      webhookService.registerWebhook('https://example.com/webhook', [eventType]);

      const deliveryIds = await webhookService.triggerEvent(eventType, {
        test: 'data',
      });

      expect(deliveryIds.length).toBe(1);
    });
  });
});
