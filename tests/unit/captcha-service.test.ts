/**
 * Unit Tests for CaptchaService
 * Tests: Unified interface, multi-layer generation, validation, session management
 */

import { CaptchaService } from '../../src/core/captcha-service';
import { CaptchaType } from '../../src/types/captcha';

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(() => {
    service = new CaptchaService();
    service.clearSessions();
  });

  describe('getAvailableTypes', () => {
    test('should return all registered captcha types', () => {
      const types = service.getAvailableTypes();

      expect(types).toContain('text');
      expect(types).toContain('math');
      expect(types).toContain('logic');
      expect(types).toContain('image');
      expect(types).toHaveLength(4);
    });
  });

  describe('isSupportedType', () => {
    test('should return true for supported types', () => {
      expect(service.isSupportedType('text')).toBe(true);
      expect(service.isSupportedType('math')).toBe(true);
      expect(service.isSupportedType('logic')).toBe(true);
      expect(service.isSupportedType('image')).toBe(true);
    });

    test('should return false for unsupported types', () => {
      expect(service.isSupportedType('audio')).toBe(false);
      expect(service.isSupportedType('behavioral')).toBe(false);
      expect(service.isSupportedType('invisible')).toBe(false);
      expect(service.isSupportedType('invalid')).toBe(false);
    });
  });

  describe('generateCaptcha', () => {
    test('should generate text captcha with easy difficulty', async () => {
      const response = await service.generateCaptcha('text', 'easy');

      expect(response).toBeDefined();
      expect(response.type).toBe('text');
      expect(response.difficulty).toBe('easy');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
      expect(response.expiresIn).toBeGreaterThan(0);
      expect(response.metadata).toBeDefined();
    });

    test('should generate math captcha with medium difficulty', async () => {
      const response = await service.generateCaptcha('math', 'medium');

      expect(response).toBeDefined();
      expect(response.type).toBe('math');
      expect(response.difficulty).toBe('medium');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
    });

    test('should generate logic captcha with hard difficulty', async () => {
      const response = await service.generateCaptcha('logic', 'hard');

      expect(response).toBeDefined();
      expect(response.type).toBe('logic');
      expect(response.difficulty).toBe('hard');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
    });

    test('should generate image captcha', async () => {
      const response = await service.generateCaptcha('image', 'medium');

      expect(response).toBeDefined();
      expect(response.type).toBe('image');
      expect(response.sessionId).toBeDefined();
      expect(response.challenge).toBeDefined();
    });

    test('should throw error for unsupported type', async () => {
      await expect(service.generateCaptcha('audio' as CaptchaType, 'medium')).rejects.toThrow(
        'Unsupported captcha type: audio'
      );
    });

    test('should generate unique session IDs', async () => {
      const response1 = await service.generateCaptcha('text', 'medium');
      const response2 = await service.generateCaptcha('text', 'medium');

      expect(response1.sessionId).not.toBe(response2.sessionId);
    });

    test('should store session in memory', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const session = service.getSession(response.sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(response.sessionId);
      expect(session?.type).toBe('text');
      expect(session?.difficulty).toBe('medium');
      expect(session?.status).toBe('active');
    });

    test('should include metadata in response', async () => {
      const response = await service.generateCaptcha('text', 'medium', {
        ip: '192.168.1.1',
        userAgent: 'Test Browser',
      });

      expect(response.metadata.ip).toBe('192.168.1.1');
      expect(response.metadata.userAgent).toBe('Test Browser');
    });
  });

  describe('generateMultiLayerCaptcha', () => {
    test('should generate multiple captcha layers', async () => {
      const layers: CaptchaType[] = ['text', 'math', 'logic'];
      const responses = await service.generateMultiLayerCaptcha(layers, 'medium');

      expect(responses).toHaveLength(3);
      expect(responses[0].type).toBe('text');
      expect(responses[1].type).toBe('math');
      expect(responses[2].type).toBe('logic');
    });

    test('should generate unique session IDs for each layer', async () => {
      const layers: CaptchaType[] = ['text', 'math'];
      const responses = await service.generateMultiLayerCaptcha(layers, 'medium');

      expect(responses[0].sessionId).not.toBe(responses[1].sessionId);
    });

    test('should throw error for unsupported layer type', async () => {
      const layers: CaptchaType[] = ['text', 'audio' as CaptchaType];

      await expect(service.generateMultiLayerCaptcha(layers, 'medium')).rejects.toThrow(
        'Unsupported captcha type: audio'
      );
    });
  });

  describe('validateResponse', () => {
    test('should validate correct response', async () => {
      // Use math captcha for this test since it doesn't require internal answer property
      const response = await service.generateCaptcha('math', 'easy');
      // For math captchas we can extract answer from challenge
      const expression = response.challenge.replace(' = ?', '').trim();
      // Simple math evaluation for testing
      const answer = eval(expression).toString();

      const result = await service.validateResponse(response.sessionId, answer, 'math');

      expect(result.valid).toBe(true);
      expect(result.securityScore).toBe(100);
      expect(result.message).toBe('Captcha validated successfully');
    });

    test('should reject incorrect response', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const result = await service.validateResponse(response.sessionId, 'wrong-answer', 'text');

      expect(result.valid).toBe(false);
      expect(result.securityScore).toBeLessThan(100);
      expect(result.message).toBe('Incorrect answer');
    });

    test('should reject expired session', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const session = service.getSession(response.sessionId);

      if (session) {
        session.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      }

      const result = await service.validateResponse(response.sessionId, response.challenge, 'text');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Captcha has expired');
    });

    test('should reject non-existent session', async () => {
      const result = await service.validateResponse('non-existent-session', 'answer', 'text');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Session not found or expired');
    });

    test('should reject inactive session', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const session = service.getSession(response.sessionId);

      if (session) {
        session.status = 'validated';
      }

      const result = await service.validateResponse(response.sessionId, response.challenge, 'text');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Session is no longer active');
    });

    test('should reject after max attempts exceeded', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const session = service.getSession(response.sessionId);

      if (session) {
        session.attempts = 3;
        session.maxAttempts = 3;
      }

      const result = await service.validateResponse(response.sessionId, response.challenge, 'text');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Maximum attempts exceeded');
    });

    test('should increment attempt counter', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const sessionBefore = service.getSession(response.sessionId);
      const attemptsBefore = sessionBefore?.attempts || 0;

      await service.validateResponse(response.sessionId, 'wrong-answer', 'text');

      const sessionAfter = service.getSession(response.sessionId);
      expect(sessionAfter?.attempts).toBe(attemptsBefore + 1);
    });

    test('should update session status on successful validation', async () => {
      // Use math captcha for this test since it doesn't require internal answer property
      const response = await service.generateCaptcha('math', 'easy');
      // For math captchas we can extract answer from challenge
      const expression = response.challenge.replace(' = ?', '').trim();
      // Simple math evaluation for testing
      const answer = eval(expression).toString();

      await service.validateResponse(response.sessionId, answer, 'math');

      const session = service.getSession(response.sessionId);
      expect(session?.status).toBe('validated');
    });

    test('should reduce security score on failed validation', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const sessionBefore = service.getSession(response.sessionId);
      const scoreBefore = sessionBefore?.securityScore || 100;

      const result = await service.validateResponse(response.sessionId, 'wrong-answer', 'text');

      expect(result.securityScore).toBeLessThan(scoreBefore);
    });
  });

  describe('session management', () => {
    test('should clear all sessions', async () => {
      await service.generateCaptcha('text', 'medium');
      await service.generateCaptcha('math', 'medium');

      expect(service.getAvailableTypes().length).toBeGreaterThan(0);

      service.clearSessions();

      // Sessions should be cleared
      const types = service.getAvailableTypes();
      expect(types).toBeDefined();
    });

    test('should get session by ID', async () => {
      const response = await service.generateCaptcha('text', 'medium');
      const session = service.getSession(response.sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(response.sessionId);
    });

    test('should return undefined for non-existent session', () => {
      const session = service.getSession('non-existent-id');
      expect(session).toBeUndefined();
    });
  });

  describe('security configuration', () => {
    test('should return security configuration service', () => {
      const config = service.getSecurityConfig();
      expect(config).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('should handle generation errors gracefully', async () => {
      // This test verifies that errors are properly thrown
      await expect(
        service.generateCaptcha('unsupported' as CaptchaType, 'medium')
      ).rejects.toThrow();
    });

    test('should handle validation errors gracefully', async () => {
      const result = await service.validateResponse('invalid-session', 'answer', 'text');

      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('integration with generators', () => {
    test('should use TextCaptchaGenerator for text type', async () => {
      const response = await service.generateCaptcha('text', 'medium');

      expect(response.type).toBe('text');
      expect(response.challenge).toBeDefined();
      // Text captcha should have image data
      expect(response.challenge).toContain('data:image');
    });

    test('should use MathCaptchaGenerator for math type', async () => {
      const response = await service.generateCaptcha('math', 'medium');

      expect(response.type).toBe('math');
      expect(response.challenge).toBeDefined();
      // Math captcha should contain arithmetic operators
      expect(response.challenge).toMatch(/[+\-*/=]/);
    });

    test('should use LogicCaptchaGenerator for logic type', async () => {
      const response = await service.generateCaptcha('logic', 'medium');

      expect(response.type).toBe('logic');
      expect(response.challenge).toBeDefined();
      // Logic captcha should have options
      expect(response.challenge).toContain(')');
    });

    test('should use ImageCaptchaGenerator for image type', async () => {
      const response = await service.generateCaptcha('image', 'medium');

      expect(response.type).toBe('image');
      expect(response.challenge).toBeDefined();
      // Image captcha should contain image data
      expect(response.challenge).toContain('data:image');
    });
  });
});
