/**
 * GraphQL Schema Tests
 * Validates GraphQL schema, queries, mutations, and subscriptions
 */

import { graphql } from 'graphql';
import { schema, pubsub, CAPTCHA_GENERATED, CAPTCHA_VALIDATED } from '../../src/graphql/schema';

describe('GraphQL Schema', () => {
  describe('Schema Structure', () => {
    test('should have query type', () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();
      expect(queryType?.getFields()).toHaveProperty('health');
      expect(queryType?.getFields()).toHaveProperty('captchaTypes');
      expect(queryType?.getFields()).toHaveProperty('captchaStats');
      expect(queryType?.getFields()).toHaveProperty('captchaSession');
    });

    test('should have mutation type', () => {
      const mutationType = schema.getMutationType();
      expect(mutationType).toBeDefined();
      expect(mutationType?.getFields()).toHaveProperty('generateCaptcha');
      expect(mutationType?.getFields()).toHaveProperty('validateCaptcha');
    });

    test('should have subscription type', () => {
      const subscriptionType = schema.getSubscriptionType();
      expect(subscriptionType).toBeDefined();
      expect(subscriptionType?.getFields()).toHaveProperty('captchaGenerated');
      expect(subscriptionType?.getFields()).toHaveProperty('captchaValidated');
      expect(subscriptionType?.getFields()).toHaveProperty('securityEvent');
      expect(subscriptionType?.getFields()).toHaveProperty('rateLimitExceeded');
    });
  });

  describe('Query: health', () => {
    test('should return health status', async () => {
      const query = `
        query {
          health {
            status
            timestamp
            version
            uptime
            memory {
              rss
              heapTotal
              heapUsed
              external
            }
          }
        }
      `;

      const result = await graphql({ schema, source: query });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      const health = result.data?.health as any;
      expect(health.status).toBe('HEALTHY');
      expect(health.version).toBe('1.0.0');
      expect(health.uptime).toBeGreaterThan(0);
    });
  });

  describe('Query: captchaTypes', () => {
    test('should return available captcha types', async () => {
      const query = `
        query {
          captchaTypes {
            type
            name
            difficulties
            description
          }
        }
      `;

      const result = await graphql({ schema, source: query });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data?.captchaTypes)).toBe(true);
      expect((result.data?.captchaTypes as any[]).length).toBeGreaterThan(0);

      const types = result.data?.captchaTypes as any[];
      const typeNames = types.map(t => t.type);
      expect(typeNames).toContain('text');
      expect(typeNames).toContain('math');
      expect(typeNames).toContain('logic');
      expect(typeNames).toContain('image');
    });
  });

  describe('Query: captchaStats', () => {
    test('should return captcha statistics', async () => {
      const query = `
        query {
          captchaStats {
            totalGenerated
            totalValidated
            successRate
            averageGenerationTime
            averageValidationTime
            activeSessions
          }
        }
      `;

      const result = await graphql({ schema, source: query });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.captchaStats).toBeDefined();
    });
  });

  describe('Mutation: generateCaptcha', () => {
    test('should generate text captcha', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { type: TEXT, difficulty: EASY }) {
            success
            data {
              sessionId
              challenge
              type
              difficulty
              expiresIn
              createdAt
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      const generateCaptcha = result.data?.generateCaptcha as any;
      expect(generateCaptcha.success).toBe(true);
      expect(generateCaptcha.data).toBeDefined();
      expect(generateCaptcha.data.sessionId).toBeDefined();
      expect(generateCaptcha.data.type).toBe('TEXT');
      expect(generateCaptcha.data.difficulty).toBe('EASY');
    });

    test('should generate math captcha', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { type: MATH, difficulty: MEDIUM }) {
            success
            data {
              sessionId
              challenge
              type
              difficulty
              expiresIn
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      const generateCaptcha = result.data?.generateCaptcha as any;
      expect(generateCaptcha.success).toBe(true);
      expect(generateCaptcha.data.type).toBe('MATH');
      expect(generateCaptcha.data.difficulty).toBe('MEDIUM');
    });

    test('should generate logic captcha', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { type: LOGIC, difficulty: HARD }) {
            success
            data {
              sessionId
              challenge
              type
              difficulty
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      const generateCaptcha = result.data?.generateCaptcha as any;
      expect(generateCaptcha.success).toBe(true);
      expect(generateCaptcha.data.type).toBe('LOGIC');
    });

    test('should generate image captcha', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { type: IMAGE, difficulty: EASY }) {
            success
            data {
              sessionId
              challenge
              type
              difficulty
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      const generateCaptcha = result.data?.generateCaptcha as any;
      expect(generateCaptcha.success).toBe(true);
      expect(generateCaptcha.data.type).toBe('IMAGE');
    });

    test('should fail with invalid captcha type', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { type: INVALID, difficulty: EASY }) {
            success
            data {
              sessionId
            }
            error {
              code
              message
            }
          }
        }
      `;

      // This should fail at schema validation level since INVALID is not a valid enum value
      const result = await graphql({ schema, source: mutation });

      expect(result.errors).toBeDefined();
    });
  });

  describe('Mutation: validateCaptcha', () => {
    test('should validate captcha with invalid session', async () => {
      const mutation = `
        mutation {
          validateCaptcha(input: { 
            sessionId: "invalid-session-id", 
            response: "test", 
            type: TEXT 
          }) {
            success
            data {
              valid
              securityScore
              message
              sessionId
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      // Should return result (service may return success even for invalid session)
      expect(result.data).toBeDefined();
      const validateCaptcha = result.data?.validateCaptcha as any;
      expect(validateCaptcha.success).toBe(true);
      expect(validateCaptcha.data).toBeDefined();
    });
  });

  describe('Subscription Events', () => {
    test('should have correct event names', () => {
      expect(CAPTCHA_GENERATED).toBe('CAPTCHA_GENERATED');
      expect(CAPTCHA_VALIDATED).toBe('CAPTCHA_VALIDATED');
    });

    test('should publish captcha generated event', async () => {
      const testChallenge = {
        sessionId: 'test-session',
        challenge: 'test-challenge',
        type: 'text',
        difficulty: 'easy',
        expiresIn: 300,
        createdAt: new Date().toISOString(),
      };

      // This tests that pubsub.publish works
      await expect(
        pubsub.publish(CAPTCHA_GENERATED, { captchaGenerated: testChallenge })
      ).resolves.toBeUndefined();
    });

    test('should publish captcha validated event', async () => {
      const testValidation = {
        valid: true,
        securityScore: 95,
        message: 'Valid',
        sessionId: 'test-session',
      };

      await expect(
        pubsub.publish(CAPTCHA_VALIDATED, { captchaValidated: testValidation })
      ).resolves.toBeUndefined();
    });
  });

  describe('Type Validation', () => {
    test('should validate enum types', () => {
      const types = schema.getTypeMap();

      expect(types['CaptchaType']).toBeDefined();
      expect(types['CaptchaDifficulty']).toBeDefined();
      expect(types['SessionStatus']).toBeDefined();
      expect(types['HealthStatus']).toBeDefined();
    });

    test('should validate input types', () => {
      const types = schema.getTypeMap();

      expect(types['GenerateCaptchaInput']).toBeDefined();
      expect(types['ValidateCaptchaInput']).toBeDefined();
      expect(types['CaptchaOptionsInput']).toBeDefined();
    });

    test('should validate object types', () => {
      const types = schema.getTypeMap();

      expect(types['CaptchaChallenge']).toBeDefined();
      expect(types['ValidationResponse']).toBeDefined();
      expect(types['CaptchaTypeInfo']).toBeDefined();
      expect(types['CaptchaStats']).toBeDefined();
      expect(types['SecurityEvent']).toBeDefined();
      expect(types['CaptchaSession']).toBeDefined();
      expect(types['RateLimitInfo']).toBeDefined();
      expect(types['Error']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return error for missing required fields', async () => {
      const mutation = `
        mutation {
          generateCaptcha(input: { difficulty: EASY }) {
            success
            data {
              sessionId
            }
            error {
              code
              message
            }
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      // Should fail at schema validation since type is required
      expect(result.errors).toBeDefined();
    });

    test('should return error for invalid input type', async () => {
      const mutation = `
        mutation {
          validateCaptcha(input: { 
            sessionId: 123, 
            response: "test", 
            type: TEXT 
          }) {
            success
          }
        }
      `;

      const result = await graphql({ schema, source: mutation });

      // Should fail at schema validation since sessionId should be String
      expect(result.errors).toBeDefined();
    });
  });
});
