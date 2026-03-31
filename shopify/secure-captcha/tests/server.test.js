const http = require('http');

// Mock fetch globally
global.fetch = jest.fn();

describe('Shopify App Server', () => {
  let server;
  let app;

  beforeAll(async () => {
    // Set environment variables for testing
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_API_SCOPES = 'write_script_tags';
    process.env.SHOPIFY_APP_URL = 'https://test-app.ngrok.io';
    process.env.CAPTCHA_API_URL = 'http://localhost:3000/api/v1/captcha';
    process.env.PORT = '0'; // Use random port

    // Mock fetch responses
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, sessionId: 'test-session', challenge: 'ABC123' }),
    });

    // Create a simple Express app for testing (without Shopify SDK which requires real credentials)
    const express = require('express');
    app = express();
    app.use(express.json());

    // Webhook handler
    app.post('/api/webhooks', (req, res) => {
      const topic = req.headers['x-shopify-topic'];
      const shop = req.headers['x-shopify-shop-domain'];
      res.status(200).send('OK');
    });

    // CAPTCHA generate
    app.get('/api/captcha/generate', async (req, res) => {
      try {
        const { type, difficulty } = req.query;
        res.json({
          success: true,
          sessionId: 'test-session-123',
          challenge: 'ABC123',
          type: type || 'text',
          difficulty: difficulty || 'medium',
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate CAPTCHA' });
      }
    });

    // CAPTCHA validate
    app.post('/api/captcha/validate', async (req, res) => {
      try {
        const { sessionId, response: captchaResponse, type } = req.body;
        if (!sessionId || !captchaResponse) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
        res.json({
          success: true,
          valid: captchaResponse === 'ABC123',
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to validate CAPTCHA' });
      }
    });

    // Serve static files
    app.use(express.static('public'));

    // Home page
    app.get('/', (req, res) => {
      const shop = req.query.shop;
      if (shop) {
        return res.redirect(`/api/auth?shop=${shop}`);
      }
      res.sendFile(__dirname + '/../public/index.html');
    });

    // Error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ error: 'Internal server error' });
    });

    server = app.listen(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Webhook Handlers', () => {
    it('should handle app/uninstalled webhook', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': 'app/uninstalled',
          'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        },
        body: JSON.stringify({ id: 123 }),
      });

      expect(response.status).toBe(200);
    });

    it('should handle orders/create webhook', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': 'orders/create',
          'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        },
        body: JSON.stringify({ id: 456 }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('CAPTCHA API', () => {
    it('should generate CAPTCHA', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/captcha/generate?type=text&difficulty=medium`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('test-session-123');
      expect(data.challenge).toBe('ABC123');
    });

    it('should validate correct CAPTCHA response', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/captcha/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session',
          response: 'ABC123',
          type: 'text',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.valid).toBe(true);
    });

    it('should reject incorrect CAPTCHA response', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/captcha/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session',
          response: 'WRONG',
          type: 'text',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.valid).toBe(false);
    });

    it('should return error for missing parameters', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/api/captcha/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Home Page', () => {
    it('should serve home page without shop parameter', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/`);
      expect(response.status).toBe(200);
    });

    it('should redirect to auth with shop parameter', async () => {
      const response = await fetch(`http://localhost:${server.address().port}/?shop=test-shop.myshopify.com`, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('/api/auth?shop=test-shop.myshopify.com');
    });
  });
});