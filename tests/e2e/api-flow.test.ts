/**
 * E2E API Flow Tests - Task 6.1.3
 * Tests complete end-to-end flows through the API
 */

import { test, expect } from '@playwright/test';

test.describe('E2E API Flow Tests', () => {
  test.describe('Health Check Flow', () => {
    test('should return healthy status with all required fields', async ({ request }) => {
      const response = await request.get('/api/v1/health');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
      });
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('memory');
      expect(body.memory).toHaveProperty('heapUsed');
      expect(body.memory).toHaveProperty('heapTotal');
      expect(body.memory).toHaveProperty('rss');
    });

    test('should respond quickly to health checks', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('/api/v1/health');
      const duration = Date.now() - startTime;

      expect(response.ok()).toBeTruthy();
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  test.describe('Captcha Types Flow', () => {
    test('should return all captcha types with metadata', async ({ request }) => {
      const response = await request.get('/api/v1/captcha/types');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('types');
      expect(Array.isArray(body.data.types)).toBe(true);

      // Verify all expected captcha types are present
      const typeNames = body.data.types.map((t: any) => t.type);
      expect(typeNames).toContain('text');
      expect(typeNames).toContain('math');
      expect(typeNames).toContain('logic');
      expect(typeNames).toContain('image');

      // Verify each type has required metadata
      body.data.types.forEach((type: any) => {
        expect(type).toHaveProperty('type');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('difficulties');
        expect(Array.isArray(type.difficulties)).toBe(true);
        expect(type.difficulties).toContain('easy');
        expect(type.difficulties).toContain('medium');
        expect(type.difficulties).toContain('hard');
      });
    });
  });

  test.describe('Captcha Generation Flow', () => {
    test('should generate text captcha successfully', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: 'text',
          difficulty: 'medium',
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('sessionId');
      expect(body.data).toHaveProperty('challenge');
      expect(body.data.type).toBe('text');
      expect(body.data.difficulty).toBe('medium');
      expect(body.data).toHaveProperty('expiresIn');
      expect(body.data).toHaveProperty('metadata');
    });

    test('should generate math captcha with valid format', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: 'math',
          difficulty: 'easy',
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('math');
      expect(body.data.difficulty).toBe('easy');
      expect(body.data).toHaveProperty('challenge');
      expect(body.data).toHaveProperty('sessionId');
    });

    test('should generate logic captcha with valid format', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: 'logic',
          difficulty: 'hard',
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('logic');
      expect(body.data.difficulty).toBe('hard');
    });

    test('should generate image captcha with valid format', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: 'image',
          difficulty: 'medium',
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('image');
      expect(body.data.difficulty).toBe('medium');
    });

    test('should generate unique session IDs for each request', async ({ request }) => {
      const responses = await Promise.all([
        request.post('/api/v1/captcha/generate', { data: { type: 'text', difficulty: 'medium' } }),
        request.post('/api/v1/captcha/generate', { data: { type: 'text', difficulty: 'medium' } }),
        request.post('/api/v1/captcha/generate', { data: { type: 'text', difficulty: 'medium' } }),
      ]);

      const bodies = await Promise.all(responses.map(r => r.json()));
      const sessionIds = bodies.map(j => j.data.sessionId);
      const uniqueSessionIds = new Set(sessionIds);

      expect(uniqueSessionIds.size).toBe(3);
    });

    test('should handle all difficulty levels', async ({ request }) => {
      const difficulties = ['easy', 'medium', 'hard'];

      for (const difficulty of difficulties) {
        const response = await request.post('/api/v1/captcha/generate', {
          data: { type: 'text', difficulty },
        });

        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.data.difficulty).toBe(difficulty);
      }
    });

    test('should return error for missing type', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: { difficulty: 'medium' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    });

    test('should return error for missing difficulty', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: { type: 'text' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return error for unsupported captcha type', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: { type: 'invalid-type', difficulty: 'medium' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  test.describe('Captcha Validation Flow', () => {
    test('should validate captcha with session ID', async ({ request }) => {
      // First generate a captcha
      const generateResponse = await request.post('/api/v1/captcha/generate', {
        data: { type: 'text', difficulty: 'medium' },
      });
      expect(generateResponse.ok()).toBeTruthy();

      const generateBody = await generateResponse.json();
      const { sessionId } = generateBody.data;

      // Then validate it
      const validateResponse = await request.post('/api/v1/captcha/validate', {
        data: {
          sessionId,
          response: 'test-answer',
          type: 'text',
        },
      });

      expect(validateResponse.ok()).toBeTruthy();
      expect(validateResponse.status()).toBe(200);

      const validateBody = await validateResponse.json();
      expect(validateBody.success).toBe(true);
      expect(validateBody.data).toHaveProperty('valid');
      expect(validateBody.data).toHaveProperty('securityScore');
      expect(validateBody.data).toHaveProperty('message');
    });

    test('should return error for missing sessionId', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/validate', {
        data: { response: 'answer', type: 'text' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should return error for missing response', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/validate', {
        data: { sessionId: 'test-session', type: 'text' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should handle invalid session gracefully', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/validate', {
        data: {
          sessionId: 'non-existent-session-id',
          response: 'test',
          type: 'text',
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(false);
    });
  });

  test.describe('Complete Captcha Lifecycle Flow', () => {
    test('should complete full captcha generation and validation cycle', async ({ request }) => {
      // Step 1: Generate captcha
      const generateResponse = await request.post('/api/v1/captcha/generate', {
        data: { type: 'math', difficulty: 'easy' },
      });
      expect(generateResponse.ok()).toBeTruthy();

      const generateBody = await generateResponse.json();
      expect(generateBody.success).toBe(true);
      expect(generateBody.data).toHaveProperty('sessionId');
      expect(generateBody.data.type).toBe('math');
      expect(generateBody.data.difficulty).toBe('easy');

      const { sessionId } = generateBody.data;

      // Step 2: Validate captcha
      const validateResponse = await request.post('/api/v1/captcha/validate', {
        data: {
          sessionId,
          response: 'test-answer',
          type: 'math',
        },
      });
      expect(validateResponse.ok()).toBeTruthy();

      const validateBody = await validateResponse.json();
      expect(validateBody.success).toBe(true);
      expect(validateBody.data).toHaveProperty('valid');
      expect(validateBody.data).toHaveProperty('securityScore');
    });

    test('should handle multiple captcha generations and validations', async ({ request }) => {
      const captchas = [];

      // Generate multiple captchas
      for (let i = 0; i < 5; i++) {
        const generateResponse = await request.post('/api/v1/captcha/generate', {
          data: { type: 'text', difficulty: 'medium' },
        });
        expect(generateResponse.ok()).toBeTruthy();
        captchas.push(await generateResponse.json());
      }

      // Verify all have unique session IDs
      const sessionIds = captchas.map(c => c.data.sessionId);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(5);

      // Validate each captcha
      for (const captcha of captchas) {
        const validateResponse = await request.post('/api/v1/captcha/validate', {
          data: {
            sessionId: captcha.data.sessionId,
            response: 'test-answer',
            type: 'text',
          },
        });
        expect(validateResponse.ok()).toBeTruthy();
        const validateBody = await validateResponse.json();
        expect(validateBody.success).toBe(true);
      }
    });
  });

  test.describe('Metrics Endpoint Flow', () => {
    test('should return Prometheus metrics', async ({ request }) => {
      const response = await request.get('/api/v1/metrics');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/plain');

      const body = await response.text();
      expect(body).toContain('# HELP');
      expect(body).toContain('# TYPE');
    });

    test('should include captcha-related metrics', async ({ request }) => {
      // Generate a few captchas first to trigger metrics
      await request.post('/api/v1/captcha/generate', {
        data: { type: 'text', difficulty: 'medium' },
      });

      const response = await request.get('/api/v1/metrics');
      const body = await response.text();

      // Check for captcha-related metrics
      expect(body).toMatch(/captcha_/);
    });
  });

  test.describe('Error Handling Flow', () => {
    test('should return 404 for unknown endpoints', async ({ request }) => {
      const response = await request.get('/api/v1/non-existent-endpoint');

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    test('should handle malformed JSON body', async ({ request }) => {
      const response = await request.fetch('/api/v1/captcha/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: '{"type": "text", invalid json}',
      });

      expect(response.status()).toBe(400);
    });

    test('should handle empty body', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {},
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should return proper error format for all errors', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: { type: 'text' },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error).toHaveProperty('timestamp');
    });
  });

  test.describe('Security Headers Flow', () => {
    test('should include security headers in responses', async ({ request }) => {
      const response = await request.get('/api/v1/health');

      expect(response.ok()).toBeTruthy();
      const headers = response.headers();

      // Check for common security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['strict-transport-security']).toBeDefined();
    });
  });

  test.describe('Input Validation Flow', () => {
    test('should reject SQL injection attempts', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: "'; DROP TABLE users; --",
          difficulty: 'medium',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    test('should reject XSS attempts', async ({ request }) => {
      const response = await request.post('/api/v1/captcha/generate', {
        data: {
          type: '<script>alert("xss")</script>',
          difficulty: 'medium',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });
});
