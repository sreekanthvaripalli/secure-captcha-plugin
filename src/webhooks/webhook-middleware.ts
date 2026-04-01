/**
 * Webhook Middleware for Express.js
 *
 * Provides REST API endpoints for webhook management
 */

import { Request, Response, Router } from 'express';
import { WebhookService, WebhookServiceConfig } from './webhook-service';
import { WebhookEventType, WebhookStatus, DeliveryStatus } from './types';

export interface WebhookMiddlewareOptions {
  config?: WebhookServiceConfig;
  requireAuth?: boolean;
}

export function createWebhookMiddleware(options?: WebhookMiddlewareOptions): {
  router: Router;
  webhookService: WebhookService;
} {
  const router = Router();
  const webhookService = new WebhookService(options?.config);

  // Register webhook
  router.post('/webhooks', (req: Request, res: Response) => {
    try {
      const { url, events, secret } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'URL is required' },
        });
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Events array is required' },
        });
      }

      // Validate event types
      const validEvents: WebhookEventType[] = [
        'captcha.generated',
        'captcha.validated',
        'captcha.failed',
        'session.expired',
        'rate.limit.exceeded',
        'security.alert',
        'bot.detected',
      ];

      const invalidEvents = events.filter(
        (e: string) => !validEvents.includes(e as WebhookEventType)
      );
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: `Invalid event types: ${invalidEvents.join(', ')}`,
          },
        });
      }

      const webhook = webhookService.registerWebhook(url, events as WebhookEventType[], secret);

      return res.status(201).json({
        success: true,
        data: webhook,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // List webhooks
  router.get('/webhooks', (req: Request, res: Response) => {
    try {
      const status = req.query.status as WebhookStatus | undefined;
      const webhooks = webhookService.listWebhooks(status);

      return res.json({
        success: true,
        data: { webhooks },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Get webhook
  router.get('/webhooks/:id', (req: Request, res: Response) => {
    try {
      const webhook = webhookService.getWebhook(req.params.id);

      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return res.json({
        success: true,
        data: webhook,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Update webhook
  router.put('/webhooks/:id', (req: Request, res: Response) => {
    try {
      const webhook = webhookService.updateWebhook(req.params.id, req.body);

      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return res.json({
        success: true,
        data: webhook,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Delete webhook
  router.delete('/webhooks/:id', (req: Request, res: Response) => {
    try {
      const deleted = webhookService.deleteWebhook(req.params.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      return res.json({
        success: true,
        data: { message: 'Webhook deleted' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // List deliveries
  router.get('/webhooks/:id/deliveries', (req: Request, res: Response) => {
    try {
      const status = req.query.status as DeliveryStatus | undefined;
      const deliveries = webhookService.listDeliveries(req.params.id, status);

      return res.json({
        success: true,
        data: { deliveries },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Get delivery
  router.get('/webhooks/deliveries/:deliveryId', (req: Request, res: Response) => {
    try {
      const delivery = webhookService.getDelivery(req.params.deliveryId);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Delivery not found' },
        });
      }

      return res.json({
        success: true,
        data: delivery,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Retry delivery
  router.post('/webhooks/deliveries/:deliveryId/retry', async (req: Request, res: Response) => {
    try {
      const success = await webhookService.retryDelivery(req.params.deliveryId);
      if (!success) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Delivery not found or not failed' },
        });
      }

      return res.json({
        success: true,
        data: { message: 'Delivery retry scheduled' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Get webhook stats
  router.get('/webhooks/stats', (_req: Request, res: Response) => {
    try {
      const stats = webhookService.getStats();

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  // Trigger test event
  router.post('/webhooks/trigger', async (req: Request, res: Response) => {
    try {
      const { event, data } = req.body;

      if (!event || !data) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Event and data are required' },
        });
      }

      const deliveryIds = await webhookService.triggerEvent(event as WebhookEventType, data);
      return res.json({
        success: true,
        data: { deliveryIds },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  });

  return { router, webhookService };
}
