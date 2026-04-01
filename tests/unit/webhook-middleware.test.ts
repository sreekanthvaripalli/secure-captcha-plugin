import { createWebhookMiddleware } from '../../src/webhooks/webhook-middleware';

// Mock express Request/Response
const createMockRequest = (body: any = {}, params: any = {}, query: any = {}) => {
  return {
    body,
    params,
    query,
  } as any;
};

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('WebhookMiddleware', () => {
  let middleware: ReturnType<typeof createWebhookMiddleware>;

  beforeEach(() => {
    middleware = createWebhookMiddleware();
  });

  afterEach(() => {
    // WebhookService doesn't have shutdown, cleanup handled by GC
  });

  describe('createWebhookMiddleware', () => {
    it('should create middleware with default options', () => {
      expect(middleware).toBeDefined();
      expect(middleware.router).toBeDefined();
      expect(middleware.webhookService).toBeDefined();
    });

    it('should create middleware with custom config', () => {
      const customMiddleware = createWebhookMiddleware({
        config: {
          maxRetries: 5,
          baseRetryDelay: 1000,
          maxRetryDelay: 5000,
        },
      });
      expect(customMiddleware).toBeDefined();
    });
  });

  describe('POST /webhooks', () => {
    it('should register a new webhook successfully', () => {
      const req = createMockRequest({
        url: 'https://example.com/webhook',
        events: ['captcha.generated', 'captcha.validated'],
        secret: 'test-secret',
      });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            url: 'https://example.com/webhook',
            events: expect.arrayContaining(['captcha.generated', 'captcha.validated']),
          }),
        })
      );
    });

    it('should return 400 when URL is missing', () => {
      const req = createMockRequest({
        events: ['captcha.generated'],
      });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: 'URL is required',
          }),
        })
      );
    });

    it('should return 400 when events array is missing', () => {
      const req = createMockRequest({
        url: 'https://example.com/webhook',
      });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: 'Events array is required',
          }),
        })
      );
    });

    it('should return 400 when events array is empty', () => {
      const req = createMockRequest({
        url: 'https://example.com/webhook',
        events: [],
      });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: 'Events array is required',
          }),
        })
      );
    });

    it('should return 400 when event types are invalid', () => {
      const req = createMockRequest({
        url: 'https://example.com/webhook',
        events: ['invalid.event', 'another.invalid'],
      });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: expect.stringContaining('Invalid event types'),
          }),
        })
      );
    });
  });

  describe('GET /webhooks', () => {
    it('should list all webhooks', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.get) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            webhooks: expect.any(Array),
          }),
        })
      );
    });

    it('should list webhooks filtered by status', () => {
      const req = createMockRequest({}, {}, { status: 'active' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks' && layer.route.methods?.get) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            webhooks: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('GET /webhooks/:id', () => {
    it('should return 404 for non-existent webhook', () => {
      const req = createMockRequest({}, { id: 'non-existent-id' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/:id' && layer.route.methods?.get) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Webhook not found',
          }),
        })
      );
    });
  });

  describe('PUT /webhooks/:id', () => {
    it('should return 404 for non-existent webhook', () => {
      const req = createMockRequest(
        { url: 'https://example.com/updated' },
        { id: 'non-existent-id' }
      );
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/:id' && layer.route.methods?.put) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Webhook not found',
          }),
        })
      );
    });
  });

  describe('DELETE /webhooks/:id', () => {
    it('should return 404 for non-existent webhook', () => {
      const req = createMockRequest({}, { id: 'non-existent-id' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/:id' && layer.route.methods?.delete) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Webhook not found',
          }),
        })
      );
    });
  });

  describe('GET /webhooks/:id/deliveries', () => {
    it('should list deliveries for a webhook', () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (
          layer.route &&
          layer.route.path === '/webhooks/:id/deliveries' &&
          layer.route.methods?.get
        ) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            deliveries: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('GET /webhooks/deliveries/:deliveryId', () => {
    it('should return 404 for non-existent delivery', () => {
      const req = createMockRequest({}, { deliveryId: 'non-existent-delivery' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (
          layer.route &&
          layer.route.path === '/webhooks/deliveries/:deliveryId' &&
          layer.route.methods?.get
        ) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Delivery not found',
          }),
        })
      );
    });
  });

  describe('POST /webhooks/deliveries/:deliveryId/retry', () => {
    it('should return false for non-existent delivery', async () => {
      // Use the webhook service directly since the route handler is async
      const result = await middleware.webhookService.retryDelivery('non-existent-delivery');
      expect(result).toBe(false);
    });
  });

  describe('GET /webhooks/stats', () => {
    it('should return webhook statistics', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/stats' && layer.route.methods?.get) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalWebhooks: expect.any(Number),
            activeWebhooks: expect.any(Number),
            totalDeliveries: expect.any(Number),
            successfulDeliveries: expect.any(Number),
            failedDeliveries: expect.any(Number),
            successRate: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('POST /webhooks/trigger', () => {
    it('should return 400 when event is missing', () => {
      const req = createMockRequest({ data: { test: true } });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/trigger' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: 'Event and data are required',
          }),
        })
      );
    });

    it('should return 400 when data is missing', () => {
      const req = createMockRequest({ event: 'captcha.generated' });
      const res = createMockResponse();

      middleware.router.stack.find((layer: any) => {
        if (layer.route && layer.route.path === '/webhooks/trigger' && layer.route.methods?.post) {
          layer.route.stack[0].handle(req, res);
          return true;
        }
        return false;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_REQUEST',
            message: 'Event and data are required',
          }),
        })
      );
    });
  });
});
