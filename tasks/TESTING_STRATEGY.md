# Secure CAPTCHA Plugin - Comprehensive Testing Strategy

## Overview

This document defines the testing strategy for each phase of the Secure CAPTCHA Plugin implementation **from scratch**. Testing is mandatory and must be completed before moving to the next phase.

**Testing Philosophy**: Write comprehensive tests to ensure security, performance, and reliability.

---

## Phase 1: Core Security Foundation Testing (Weeks 1-4)

### Week 1: Project Setup & Cryptographic Foundation Testing

#### 1.1.1 Project Setup Tests
```typescript
// tests/unit/setup/project-setup.test.ts
describe('Project Setup', () => {
  describe('Project Initialization', () => {
    test('should initialize Node.js project', async () => {
      // Arrange
      const projectDir = '/tmp/test-project';
      
      // Act
      const result = await initializeProject(projectDir);
      
      // Assert
      expect(result.success).toBe(true);
      expect(fs.existsSync(`${projectDir}/package.json`)).toBe(true);
      expect(fs.existsSync(`${projectDir}/tsconfig.json`)).toBe(true);
    });

    test('should configure TypeScript', async () => {
      // Arrange
      const projectDir = '/tmp/test-project';
      
      // Act
      await initializeProject(projectDir);
      const tsConfig = JSON.parse(fs.readFileSync(`${projectDir}/tsconfig.json`, 'utf8'));
      
      // Assert
      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsConfig.compilerOptions.target).toBe('ES2020');
    });

    test('should configure ESLint with security rules', async () => {
      // Arrange
      const projectDir = '/tmp/test-project';
      
      // Act
      await initializeProject(projectDir);
      const eslintConfig = JSON.parse(fs.readFileSync(`${projectDir}/.eslintrc.json`, 'utf8'));
      
      // Assert
      expect(eslintConfig.plugins).toContain('security');
      expect(eslintConfig.rules['security/detect-sql-injection']).toBeDefined();
    });
  });

  describe('Testing Framework Setup', () => {
    test('should configure Jest', async () => {
      // Arrange
      const projectDir = '/tmp/test-project';
      
      // Act
      await initializeProject(projectDir);
      const jestConfig = JSON.parse(fs.readFileSync(`${projectDir}/jest.config.js`, 'utf8'));
      
      // Assert
      expect(jestConfig.preset).toBe('ts-jest');
      expect(jestConfig.collectCoverage).toBe(true);
      expect(jestConfig.coverageThreshold.global.lines).toBe(95);
    });

    test('should setup Husky pre-commit hooks', async () => {
      // Arrange
      const projectDir = '/tmp/test-project';
      
      // Act
      await initializeProject(projectDir);
      
      // Assert
      expect(fs.existsSync(`${projectDir}/.husky/pre-commit`)).toBe(true);
    });
  });
});
```

#### 1.1.2 Cryptographic Foundation Tests
```typescript
// tests/unit/crypto/crypto-service.test.ts
describe('CryptoService', () => {
  describe('AES-256-GCM Encryption', () => {
    test('should encrypt data with AES-256-GCM', async () => {
      // Arrange
      const plaintext = 'sensitive data';
      const key = cryptoService.generateSecureKey();
      
      // Act
      const result = await cryptoService.encryptAES256GCM(plaintext, key);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.iv.length).toBe(24); // 12 bytes in hex
      expect(result.authTag.length).toBe(32); // 16 bytes in hex
      expect(result.encryptedData).not.toBe(plaintext);
    });

    test('should decrypt data correctly', async () => {
      // Arrange
      const plaintext = 'test decryption data';
      const key = cryptoService.generateSecureKey();
      
      // Act
      const encrypted = await cryptoService.encryptAES256GCM(plaintext, key);
      const decrypted = await cryptoService.decryptAES256GCM(encrypted, key);
      
      // Assert
      expect(decrypted.success).toBe(true);
      expect(decrypted.decryptedData).toBe(plaintext);
      expect(decrypted.error).toBeUndefined();
    });

    test('should fail decryption with wrong key', async () => {
      // Arrange
      const plaintext = 'test data';
      const key1 = cryptoService.generateSecureKey();
      const key2 = cryptoService.generateSecureKey();
      
      // Act
      const encrypted = await cryptoService.encryptAES256GCM(plaintext, key1);
      const decrypted = await cryptoService.decryptAES256GCM(encrypted, key2);
      
      // Assert
      expect(decrypted.success).toBe(false);
      expect(decrypted.error).toBeDefined();
      expect(decrypted.decryptedData).toBe('');
    });

    test('should handle large data', async () => {
      // Arrange
      const plaintext = 'A'.repeat(10000); // 10KB of data
      const key = cryptoService.generateSecureKey();
      
      // Act
      const result = await cryptoService.encryptAES256GCM(plaintext, key);
      const decrypted = await cryptoService.decryptAES256GCM(result, key);
      
      // Assert
      expect(decrypted.success).toBe(true);
      expect(decrypted.decryptedData).toBe(plaintext);
    });

    test('should generate unique IVs for each encryption', async () => {
      // Arrange
      const plaintext = 'test data';
      const key = cryptoService.generateSecureKey();
      
      // Act
      const result1 = await cryptoService.encryptAES256GCM(plaintext, key);
      const result2 = await cryptoService.encryptAES256GCM(plaintext, key);
      
      // Assert
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encryptedData).not.toBe(result2.encryptedData);
    });
  });

  describe('RSA Key Generation', () => {
    test('should generate RSA key pairs', async () => {
      // Act
      const keyPair = await cryptoService.generateRSAKeyPair(2048);
      
      // Assert
      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.modulusLength).toBe(2048);
      expect(keyPair.publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
      expect(keyPair.privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
    });

    test('should generate different keys each time', async () => {
      // Act
      const keyPair1 = await cryptoService.generateRSAKeyPair(2048);
      const keyPair2 = await cryptoService.generateRSAKeyPair(2048);
      
      // Assert
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });

    test('should support different key sizes', async () => {
      // Act
      const keyPair2048 = await cryptoService.generateRSAKeyPair(2048);
      const keyPair4096 = await cryptoService.generateRSAKeyPair(4096);
      
      // Assert
      expect(keyPair2048.modulusLength).toBe(2048);
      expect(keyPair4096.modulusLength).toBe(4096);
    });
  });

  describe('HMAC-SHA256', () => {
    test('should generate HMAC correctly', async () => {
      // Arrange
      const data = { session: 'abc123', timestamp: Date.now() };
      const secret = cryptoService.generateSecureSecret();
      
      // Act
      const result = await cryptoService.generateHMAC(data, secret);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBe(64); // SHA-256 produces 64 hex characters
      expect(result.error).toBeUndefined();
    });

    test('should verify HMAC correctly', async () => {
      // Arrange
      const data = { session: 'abc123', timestamp: Date.now() };
      const secret = cryptoService.generateSecureSecret();
      
      // Act
      const signature = await cryptoService.generateHMAC(data, secret);
      const isValid = await cryptoService.verifyHMAC(data, secret, signature.hash);
      
      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject tampered data', async () => {
      // Arrange
      const data = { session: 'abc123', timestamp: Date.now() };
      const tamperedData = { ...data, session: 'tampered' };
      const secret = cryptoService.generateSecureSecret();
      
      // Act
      const signature = await cryptoService.generateHMAC(data, secret);
      const isValid = await cryptoService.verifyHMAC(tamperedData, secret, signature.hash);
      
      // Assert
      expect(isValid).toBe(false);
    });

    test('should reject wrong secret', async () => {
      // Arrange
      const data = { session: 'abc123', timestamp: Date.now() };
      const secret1 = cryptoService.generateSecureSecret();
      const secret2 = cryptoService.generateSecureSecret();
      
      // Act
      const signature = await cryptoService.generateHMAC(data, secret1);
      const isValid = await cryptoService.verifyHMAC(data, secret2, signature.hash);
      
      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Cryptographically Secure Random Generation', () => {
    test('should generate secure random strings', async () => {
      // Arrange
      const options = {
        length: 32,
        charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        excludeSimilar: true,
        excludeAmbiguous: true
      };
      
      // Act
      const randomString = await cryptoService.generateSecureRandom(options);
      
      // Assert
      expect(randomString).toBeDefined();
      expect(randomString.length).toBe(32);
      expect(typeof randomString).toBe('string');
      expect(randomString).toMatch(/^[A-Za-z0-9]+$/);
    });

    test('should generate unique random strings', async () => {
      // Arrange
      const options = { length: 64 };
      
      // Act
      const strings = [];
      for (let i = 0; i < 100; i++) {
        strings.push(await cryptoService.generateSecureRandom(options));
      }
      
      // Assert
      const uniqueStrings = new Set(strings);
      expect(uniqueStrings.size).toBe(100);
    });

    test('should handle different character sets', async () => {
      // Arrange
      const tests = [
        { charset: '0123456789', length: 20 },
        { charset: 'abcdef', length: 20 },
        { charset: '!@#$%^&*', length: 20 }
      ];
      
      // Act & Assert
      for (const test of tests) {
        const result = await cryptoService.generateSecureRandom(test);
        expect(result.length).toBe(test.length);
        expect(result).toMatch(new RegExp(`^[${test.charset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`));
      }
    });

    test('should exclude similar characters when requested', async () => {
      // Arrange
      const options = {
        length: 100,
        excludeSimilar: true
      };
      
      // Act
      const result = await cryptoService.generateSecureRandom(options);
      
      // Assert
      expect(result).not.toMatch(/[0oO1lI]/);
    });

    test('should exclude ambiguous characters when requested', async () => {
      // Arrange
      const options = {
        length: 100,
        excludeAmbiguous: true
      };
      
      // Act
      const result = await cryptoService.generateSecureRandom(options);
      
      // Assert
      expect(result).not.toMatch(/[{}[\]()/\\]/);
    });
  });

  describe('Session Token Generation', () => {
    test('should generate secure session tokens', async () => {
      // Arrange
      const sessionData = {
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      };
      
      // Act
      const sessionToken = await cryptoService.generateSessionToken(sessionData);
      
      // Assert
      expect(sessionToken).toBeDefined();
      expect(sessionToken.sessionId).toBeDefined();
      expect(sessionToken.createdAt).toBeInstanceOf(Date);
      expect(sessionToken.expiresAt).toBeInstanceOf(Date);
      expect(sessionToken.expiresAt.getTime()).toBeGreaterThan(sessionToken.createdAt.getTime());
      expect(sessionToken.securityMetadata).toBeDefined();
      expect(sessionToken.securityMetadata.entropy).toBeGreaterThan(5);
      expect(sessionToken.securityMetadata.generationTime).toBeGreaterThan(0);
    });

    test('should generate unique session tokens', async () => {
      // Act
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push(await cryptoService.generateSessionToken());
      }
      
      // Assert
      const uniqueTokens = new Set(tokens.map(t => t.sessionId));
      expect(uniqueTokens.size).toBe(100);
    });

    test('should validate session token expiration', async () => {
      // Arrange
      const sessionToken = await cryptoService.generateSessionToken({ expiresIn: 1000 }); // 1 second
      
      // Assert
      expect(sessionToken.expiresAt.getTime() - sessionToken.createdAt.getTime()).toBe(1000);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Act
      const isExpired = cryptoService.isSessionExpired(sessionToken);
      
      // Assert
      expect(isExpired).toBe(true);
    });
  });

  describe('Perfect Forward Secrecy', () => {
    test('should implement ECDH key exchange', async () => {
      // Arrange
      const config = {
        keyExchangeAlgorithm: 'ECDH',
        curve: 'secp256k1',
        keySize: 256,
        rotationInterval: 3600000 // 1 hour
      };
      
      // Act
      const keyExchange = await cryptoService.setupPerfectForwardSecrecy(config);
      
      // Assert
      expect(keyExchange).toBeDefined();
      expect(keyExchange.publicKey).toBeDefined();
      expect(keyExchange.sharedSecret).toBeDefined();
      expect(keyExchange.expiresAt).toBeDefined();
    });
  });

  describe('Key Rotation', () => {
    test('should rotate encryption keys', async () => {
      // Arrange
      const config = {
        rotationInterval: 3600000, // 1 hour
        keyHistory: 5,
        algorithm: 'AES-256-GCM',
        keySize: 256
      };
      
      // Act
      const rotationResult = await cryptoService.rotateEncryptionKeys(config);
      
      // Assert
      expect(rotationResult).toBeDefined();
      expect(rotationResult.newKey).toBeDefined();
      expect(rotationResult.oldKeys).toBeDefined();
      expect(rotationResult.rotationTime).toBeDefined();
      expect(rotationResult.success).toBe(true);
    });

    test('should maintain key history', async () => {
      // Arrange
      const config = {
        rotationInterval: 1000, // 1 second for testing
        keyHistory: 3,
        algorithm: 'AES-256-GCM',
        keySize: 256
      };
      
      // Act
      for (let i = 0; i < 5; i++) {
        await cryptoService.rotateEncryptionKeys(config);
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      
      // Assert
      const keyHistory = await cryptoService.getKeyHistory();
      expect(keyHistory.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Cryptographic Configuration', () => {
    test('should validate cryptographic configuration', async () => {
      // Arrange
      const config = {
        encryption: {
          algorithm: 'AES-256-GCM',
          keySize: 256,
          ivLength: 12,
          tagLength: 16
        },
        hashing: {
          algorithm: 'SHA-256',
          saltLength: 32
        },
        signing: {
          algorithm: 'HMAC-SHA256',
          keySize: 256
        },
        random: {
          algorithm: 'crypto.randomBytes',
          minEntropy: 128
        }
      };
      
      // Act
      const isValid = await cryptoService.validateConfig(config);
      
      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject weak cryptographic configuration', async () => {
      // Arrange
      const weakConfig = {
        encryption: {
          algorithm: 'AES-128-GCM', // Too weak
          keySize: 128,
          ivLength: 8, // Too short
          tagLength: 8
        }
      };
      
      // Act
      const isValid = await cryptoService.validateConfig(weakConfig);
      
      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Security Event Logging', () => {
    test('should log security events', async () => {
      // Arrange
      const event = {
        eventId: 'test-event-123',
        eventType: 'encryption_error',
        severity: 'high',
        timestamp: new Date(),
        details: {
          operation: 'encrypt',
          error: 'Invalid key format'
        },
        source: {
          ip: '192.168.1.1',
          userAgent: 'Test Agent'
        }
      };
      
      // Act
      const result = await cryptoService.logSecurityEvent(event);
      
      // Assert
      expect(result).toBe(true);
    });

    test('should track cryptographic statistics', async () => {
      // Act
      const stats = await cryptoService.getCryptographicStats();
      
      // Assert
      expect(stats).toBeDefined();
      expect(stats.totalOperations).toBeDefined();
      expect(stats.successfulOperations).toBeDefined();
      expect(stats.failedOperations).toBeDefined();
      expect(stats.averageOperationTime).toBeDefined();
      expect(stats.encryptionOperations).toBeDefined();
      expect(stats.decryptionOperations).toBeDefined();
      expect(stats.hmacOperations).toBeDefined();
      expect(stats.keyRotations).toBeDefined();
      expect(stats.lastKeyRotation).toBeDefined();
      expect(stats.securityEvents).toBeDefined();
    });
  });

  describe('Performance and Security Validation', () => {
    test('should meet performance requirements', async () => {
      // Arrange
      const startTime = Date.now();
      
      // Act
      for (let i = 0; i < 100; i++) {
        const plaintext = `test data ${i}`;
        const key = cryptoService.generateSecureKey();
        await cryptoService.encryptAES256GCM(plaintext, key);
      }
      
      // Assert
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 100;
      
      expect(totalTime).toBeLessThan(5000); // 5 seconds
      expect(avgTime).toBeLessThan(50); // 50ms average
    });

    test('should pass entropy tests', async () => {
      // Arrange
      const randomBytes = [];
      for (let i = 0; i < 1000; i++) {
        const random = await cryptoService.generateSecureRandom({ length: 32 });
        randomBytes.push(...random.split('').map(c => c.charCodeAt(0)));
      }
      
      // Act
      const entropy = cryptoService.calculateEntropy(randomBytes);
      
      // Assert
      expect(entropy).toBeGreaterThan(5); // High entropy threshold
    });

    test('should prevent timing attacks', async () => {
      // Arrange
      const key1 = cryptoService.generateSecureKey();
      const key2 = cryptoService.generateSecureKey();
      const data1 = 'test data 1';
      const data2 = 'test data 2';
      
      // Act
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await cryptoService.encryptAES256GCM(data1, key1);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }
      
      // Assert
      const stdDev = cryptoService.calculateStandardDeviation(times);
      expect(stdDev).toBeLessThan(1000000); // 1ms in nanoseconds
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty keys', async () => {
      // Act
      const result = await cryptoService.decryptAES256GCM(
        { encryptedData: 'test', iv: 'test', authTag: 'test' },
        ''
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle corrupted data', async () => {
      // Act
      const result = await cryptoService.decryptAES256GCM(
        { encryptedData: 'corrupted', iv: 'invalid', authTag: 'invalid' },
        cryptoService.generateSecureKey()
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

### Week 2: Security Configuration Testing

#### 1.2.1 Security Configuration Tests
```typescript
// tests/unit/security/security-config.test.ts
describe('SecurityConfigurationService', () => {
  describe('Configuration Validation', () => {
    test('should validate valid configuration', async () => {
      // Arrange
      const config = {
        app: {
          sessionTimeout: 1800000,
          maxLoginAttempts: 5,
          lockoutDuration: 900000,
          enableSecurityHeaders: true,
          enableRateLimiting: true,
          rateLimitRequests: 100
        },
        crypto: {
          encryptionAlgorithm: 'AES-256-GCM',
          keySize: 256,
          ivLength: 12,
          tagLength: 16,
          hashAlgorithm: 'SHA-256',
          saltLength: 32,
          minEntropy: 128
        }
      };
      
      // Act
      const isValid = await securityConfig.validateConfiguration(config);
      
      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject invalid configuration', async () => {
      // Arrange
      const invalidConfig = {
        app: {
          sessionTimeout: -1, // Invalid
          maxLoginAttempts: 0, // Invalid
        }
      };
      
      // Act
      const isValid = await securityConfig.validateConfiguration(invalidConfig);
      
      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Policy Evaluation', () => {
    test('should evaluate security policies', async () => {
      // Arrange
      const input = { query: 'SELECT * FROM users' };
      const context = { ip: '192.168.1.1', userAgent: 'Test Agent' };
      
      // Act
      const result = await securityConfig.evaluateRules(input, context);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    test('should block SQL injection attempts', async () => {
      // Arrange
      const input = { query: "SELECT * FROM users; DROP TABLE users;" };
      const context = { ip: '192.168.1.1', userAgent: 'Test Agent' };
      
      // Act
      const result = await securityConfig.evaluateRules(input, context);
      
      // Assert
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.includes('SQL injection'))).toBe(true);
    });
  });

  describe('Security Headers', () => {
    test('should configure security headers', async () => {
      // Act
      const headers = await securityConfig.getSecurityHeaders();
      
      // Assert
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['Content-Security-Policy']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    test('should configure CORS properly', async () => {
      // Act
      const corsConfig = await securityConfig.getCorsConfig();
      
      // Assert
      expect(corsConfig.origin).toBeDefined();
      expect(corsConfig.methods).toContain('GET');
      expect(corsConfig.methods).toContain('POST');
      expect(corsConfig.credentials).toBe(true);
    });

    test('should reject unauthorized origins', async () => {
      // Arrange
      const unauthorizedOrigin = 'https://malicious.com';
      
      // Act
      const isAllowed = await securityConfig.isOriginAllowed(unauthorizedOrigin);
      
      // Assert
      expect(isAllowed).toBe(false);
    });
  });
});
```

### Week 3: Input Validation Testing

#### 1.3.1 Input Validation Tests
```typescript
// tests/unit/validation/input-validation.test.ts
describe('Input Validation', () => {
  describe('SQL Injection Prevention', () => {
    test('should block SQL injection attempts', async () => {
      // Arrange
      const maliciousInput = "'; DROP TABLE users; --";
      
      // Act
      const result = await inputValidator.validate(maliciousInput);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('SQL injection detected');
    });

    test('should allow safe SQL-like input', async () => {
      // Arrange
      const safeInput = "SELECT * FROM users WHERE id = 1";
      
      // Act
      const result = await inputValidator.validate(safeInput);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.violations.length).toBe(0);
    });
  });

  describe('XSS Protection', () => {
    test('should block XSS attempts', async () => {
      // Arrange
      const maliciousInput = '<script>alert("xss")</script>';
      
      // Act
      const result = await inputValidator.validate(maliciousInput);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('XSS detected');
    });

    test('should sanitize HTML input', async () => {
      // Arrange
      const htmlInput = '<p>Hello <strong>World</strong></p>';
      
      // Act
      const sanitized = await inputValidator.sanitize(htmlInput);
      
      // Assert
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
    });
  });

  describe('CSRF Protection', () => {
    test('should generate CSRF tokens', async () => {
      // Act
      const token = await inputValidator.generateCsrfToken();
      
      // Assert
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(32);
    });

    test('should validate CSRF tokens', async () => {
      // Arrange
      const token = await inputValidator.generateCsrfToken();
      
      // Act
      const isValid = await inputValidator.validateCsrfToken(token);
      
      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject invalid CSRF tokens', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      
      // Act
      const isValid = await inputValidator.validateCsrfToken(invalidToken);
      
      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Parameter Pollution Protection', () => {
    test('should handle parameter pollution', async () => {
      // Arrange
      const pollutedParams = {
        id: ['1', '2', '3'], // Array instead of single value
        name: 'test'
      };
      
      // Act
      const result = await inputValidator.validate(pollutedParams);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Parameter pollution detected');
    });
  });

  describe('JSON Schema Validation', () => {
    test('should validate JSON schema', async () => {
      // Arrange
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };
      
      const validData = { name: 'John', age: 30 };
      const invalidData = { age: -5 };
      
      // Act
      const validResult = await inputValidator.validateJsonSchema(validData, schema);
      const invalidResult = await inputValidator.validateJsonSchema(invalidData, schema);
      
      // Assert
      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Whitelist-based Filtering', () => {
    test('should filter input based on whitelist', async () => {
      // Arrange
      const input = {
        name: 'John',
        email: 'john@example.com',
        password: 'secret123',
        role: 'admin' // Should be filtered out
      };
      
      const whitelist = ['name', 'email'];
      
      // Act
      const filtered = await inputValidator.filterWhitelist(input, whitelist);
      
      // Assert
      expect(filtered.name).toBe('John');
      expect(filtered.email).toBe('john@example.com');
      expect(filtered.password).toBeUndefined();
      expect(filtered.role).toBeUndefined();
    });
  });
});
```

### Week 4: Phase 1 Comprehensive Testing

#### 1.4.1 Integration Tests
```typescript
// tests/integration/phase1-integration.test.ts
describe('Phase 1 Integration Tests', () => {
  describe('Crypto + Security Config Integration', () => {
    test('should encrypt data using security config', async () => {
      // Arrange
      const plaintext = 'sensitive data';
      const config = await securityConfig.getCryptoConfig();
      
      // Act
      const encrypted = await cryptoService.encryptAES256GCM(plaintext, config.key);
      const decrypted = await cryptoService.decryptAES256GCM(encrypted, config.key);
      
      // Assert
      expect(decrypted.success).toBe(true);
      expect(decrypted.decryptedData).toBe(plaintext);
    });
  });

  describe('Validation + Crypto Integration', () => {
    test('should validate and encrypt input', async () => {
      // Arrange
      const input = { name: 'John', email: 'john@example.com' };
      
      // Act
      const validationResult = await inputValidator.validate(input);
      const encrypted = await cryptoService.encryptAES256GCM(JSON.stringify(input));
      
      // Assert
      expect(validationResult.isValid).toBe(true);
      expect(encrypted).toBeDefined();
    });
  });

  describe('End-to-End Security Flow', () => {
    test('should complete full security flow', async () => {
      // Arrange
      const userInput = { query: 'SELECT * FROM users' };
      
      // Act
      // 1. Validate input
      const validationResult = await inputValidator.validate(userInput);
      
      // 2. Generate session token
      const sessionToken = await cryptoService.generateSessionToken();
      
      // 3. Encrypt session data
      const encryptedSession = await cryptoService.encryptAES256GCM(
        JSON.stringify({ token: sessionToken, input: userInput })
      );
      
      // 4. Log security event
      await cryptoService.logSecurityEvent({
        eventId: `test-${Date.now()}`,
        eventType: 'captcha_generated',
        severity: 'low',
        timestamp: new Date(),
        details: { operation: 'test_flow' },
        source: { ip: '127.0.0.1', userAgent: 'Test' }
      });
      
      // Assert
      expect(validationResult.isValid).toBe(true);
      expect(sessionToken).toBeDefined();
      expect(encryptedSession).toBeDefined();
    });
  });
});
```

---

## Phase 2: Multi-Layer Captcha System Testing (Weeks 5-8)

### Week 5: Captcha Generator Architecture Testing

#### 2.1.1 Base Architecture Tests
```typescript
// tests/unit/captcha/captcha-generator.test.ts
describe('CaptchaGenerator', () => {
  describe('Interface Contracts', () => {
    test('should implement generate method', async () => {
      // Arrange
      const generator = new TextCaptchaGenerator();
      
      // Act
      const result = await generator.generate('medium');
      
      // Assert
      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.challenge).toBeDefined();
      expect(result.type).toBe('text');
    });

    test('should implement validate method', async () => {
      // Arrange
      const generator = new TextCaptchaGenerator();
      const captcha = await generator.generate('medium');
      
      // Act
      const result = await generator.validate(captcha.sessionId, captcha.answer);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.securityScore).toBeDefined();
    });
  });

  describe('Factory Pattern', () => {
    test('should create text captcha generator', () => {
      // Act
      const generator = CaptchaGeneratorFactory.getGenerator('text');
      
      // Assert
      expect(generator).toBeInstanceOf(TextCaptchaGenerator);
    });

    test('should create math captcha generator', () => {
      // Act
      const generator = CaptchaGeneratorFactory.getGenerator('math');
      
      // Assert
      expect(generator).toBeInstanceOf(MathCaptchaGenerator);
    });

    test('should throw error for invalid type', () => {
      // Act & Assert
      expect(() => CaptchaGeneratorFactory.getGenerator('invalid')).toThrow();
    });
  });

  describe('Base Class Functionality', () => {
    test('should integrate with security config', async () => {
      // Arrange
      const generator = new TextCaptchaGenerator();
      
      // Act
      const config = generator.getSecurityConfig();
      
      // Assert
      expect(config).toBeDefined();
      expect(config.encryptionAlgorithm).toBe('AES-256-GCM');
    });

    test('should log security events', async () => {
      // Arrange
      const generator = new TextCaptchaGenerator();
      
      // Act
      await generator.generate('medium');
      
      // Assert
      const events = await generator.getSecurityEvents();
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
```

### Week 2: Session Management & Caching Testing

#### 3.2.1 Redis Session Tests
```typescript
// tests/integration/session/redis-session.test.ts
describe('Redis Session Manager', () => {
  describe('Session Creation', () => {
    test('should create encrypted session', async () => {
      // Arrange
      const sessionData = {
        captchaType: 'text',
        answer: 'encrypted_answer',
        difficulty: 'medium'
      };
      
      // Act
      const session = await sessionManager.create(sessionData);
      
      // Assert
      expect(session.id).toBeDefined();
      expect(session.encryptedData).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    test('should set correct TTL', async () => {
      // Arrange
      const ttl = 300000; // 5 minutes
      
      // Act
      const session = await sessionManager.create({}, { ttl });
      
      // Assert
      const remainingTtl = await sessionManager.getTtl(session.id);
      expect(remainingTtl).toBeLessThanOrEqual(ttl / 1000);
      expect(remainingTtl).toBeGreaterThan((ttl / 1000) - 5);
    });
  });

  describe('Session Retrieval', () => {
    test('should retrieve existing session', async () => {
      // Arrange
      const session = await sessionManager.create({ test: 'data' });
      
      // Act
      const retrieved = await sessionManager.get(session.id);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.test).toBe('data');
    });

    test('should return null for non-existent session', async () => {
      // Act
      const session = await sessionManager.get('non-existent-id');
      
      // Assert
      expect(session).toBeNull();
    });

    test('should return null for expired session', async () => {
      // Arrange
      const session = await sessionManager.create({}, { ttl: 1 });
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Act
      const retrieved = await sessionManager.get(session.id);
      
      // Assert
      expect(retrieved).toBeNull();
    });
  });

  describe('Session Update', () => {
    test('should update session data', async () => {
      // Arrange
      const session = await sessionManager.create({ count: 1 });
      
      // Act
      await sessionManager.update(session.id, { count: 2 });
      const updated = await sessionManager.get(session.id);
      
      // Assert
      expect(updated.count).toBe(2);
    });

    test('should preserve TTL on update', async () => {
      // Arrange
      const session = await sessionManager.create({}, { ttl: 300000 });
      const initialTtl = await sessionManager.getTtl(session.id);
      
      // Act
      await sessionManager.update(session.id, { updated: true });
      const updatedTtl = await sessionManager.getTtl(session.id);
      
      // Assert
      expect(updatedTtl).toBeLessThanOrEqual(initialTtl);
    });
  });

  describe('Session Deletion', () => {
    test('should delete existing session', async () => {
      // Arrange
      const session = await sessionManager.create({ test: 'data' });
      
      // Act
      await sessionManager.delete(session.id);
      const retrieved = await sessionManager.get(session.id);
      
      // Assert
      expect(retrieved).toBeNull();
    });

    test('should handle deletion of non-existent session', async () => {
      // Act & Assert
      await expect(sessionManager.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Session Cleanup', () => {
    test('should cleanup expired sessions', async () => {
      // Arrange
      await sessionManager.create({}, { ttl: 1 });
      await sessionManager.create({}, { ttl: 1 });
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Act
      const cleaned = await sessionManager.cleanup();
      
      // Assert
      expect(cleaned).toBe(2);
    });
  });
});
```

#### 3.2.2 Cache Service Tests
```typescript
// tests/integration/cache/cache-service.test.ts
describe('Cache Service', () => {
  describe('Cache Operations', () => {
    test('should set and get cache value', async () => {
      // Arrange
      const key = 'test-key';
      const value = { data: 'test' };
      
      // Act
      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);
      
      // Assert
      expect(retrieved).toEqual(value);
    });

    test('should return null for non-existent key', async () => {
      // Act
      const value = await cacheService.get('non-existent');
      
      // Assert
      expect(value).toBeNull();
    });

    test('should delete cache value', async () => {
      // Arrange
      await cacheService.set('test-key', 'value');
      
      // Act
      await cacheService.delete('test-key');
      const value = await cacheService.get('test-key');
      
      // Assert
      expect(value).toBeNull();
    });
  });

  describe('Cache Levels', () => {
    test('should use L1 cache for frequently accessed data', async () => {
      // Arrange
      const key = 'frequent-key';
      const value = 'frequent-value';
      
      // Act
      await cacheService.set(key, value);
      await cacheService.get(key); // First access
      await cacheService.get(key); // Second access
      await cacheService.get(key); // Third access
      
      // Assert
      const stats = cacheService.getStats();
      expect(stats.l1Hits).toBe(3);
    });

    test('should fallback to L2 cache on L1 miss', async () => {
      // Arrange
      const key = 'l2-key';
      const value = 'l2-value';
      
      // Act
      await cacheService.set(key, value);
      cacheService.clearL1(); // Clear L1 cache
      const retrieved = await cacheService.get(key);
      
      // Assert
      expect(retrieved).toBe(value);
      const stats = cacheService.getStats();
      expect(stats.l2Hits).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate by pattern', async () => {
      // Arrange
      await cacheService.set('user:1', 'user1');
      await cacheService.set('user:2', 'user2');
      await cacheService.set('post:1', 'post1');
      
      // Act
      await cacheService.invalidatePattern('user:*');
      
      // Assert
      expect(await cacheService.get('user:1')).toBeNull();
      expect(await cacheService.get('user:2')).toBeNull();
      expect(await cacheService.get('post:1')).toBe('post1');
    });

    test('should invalidate by tags', async () => {
      // Arrange
      await cacheService.set('key1', 'value1', { tags: ['tag1', 'tag2'] });
      await cacheService.set('key2', 'value2', { tags: ['tag2', 'tag3'] });
      
      // Act
      await cacheService.invalidateByTag('tag2');
      
      // Assert
      expect(await cacheService.get('key1')).toBeNull();
      expect(await cacheService.get('key2')).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    test('should track hit/miss ratio', async () => {
      // Arrange
      await cacheService.set('key1', 'value1');
      
      // Act
      await cacheService.get('key1'); // Hit
      await cacheService.get('key2'); // Miss
      await cacheService.get('key1'); // Hit
      
      // Assert
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRatio).toBeCloseTo(0.67, 2);
    });
  });
});
```

### Week 3: Monitoring & Observability Testing

#### 3.3.1 Prometheus Metrics Tests
```typescript
// tests/unit/monitoring/prometheus-metrics.test.ts
describe('Prometheus Metrics', () => {
  describe('Request Metrics', () => {
    test('should record request rate', async () => {
      // Arrange
      const initialCount = await metrics.getRequestCount();
      
      // Act
      await makeRequest('/api/v1/captcha/generate');
      await makeRequest('/api/v1/captcha/generate');
      
      // Assert
      const finalCount = await metrics.getRequestCount();
      expect(finalCount - initialCount).toBe(2);
    });

    test('should record request latency', async () => {
      // Act
      await makeRequest('/api/v1/captcha/generate');
      
      // Assert
      const latency = await metrics.getAverageLatency();
      expect(latency).toBeGreaterThan(0);
    });

    test('should record error rate', async () => {
      // Arrange
      const initialErrors = await metrics.getErrorCount();
      
      // Act
      await makeRequest('/api/v1/invalid-endpoint');
      
      // Assert
      const finalErrors = await metrics.getErrorCount();
      expect(finalErrors - initialErrors).toBe(1);
    });
  });

  describe('Captcha Metrics', () => {
    test('should record captcha generation time', async () => {
      // Act
      await generateCaptcha('text', 'medium');
      
      // Assert
      const genTime = await metrics.getCaptchaGenerationTime();
      expect(genTime).toBeGreaterThan(0);
    });

    test('should record captcha validation time', async () => {
      // Arrange
      const captcha = await generateCaptcha('text', 'medium');
      
      // Act
      await validateCaptcha(captcha.sessionId, captcha.answer);
      
      // Assert
      const valTime = await metrics.getCaptchaValidationTime();
      expect(valTime).toBeGreaterThan(0);
    });

    test('should record active sessions', async () => {
      // Arrange
      const initialSessions = await metrics.getActiveSessions();
      
      // Act
      await generateCaptcha('text', 'medium');
      
      // Assert
      const finalSessions = await metrics.getActiveSessions();
      expect(finalSessions - initialSessions).toBe(1);
    });
  });

  describe('Security Metrics', () => {
    test('should record security events', async () => {
      // Arrange
      const initialEvents = await metrics.getSecurityEventCount();
      
      // Act
      await triggerSecurityEvent('failed_auth');
      
      // Assert
      const finalEvents = await metrics.getSecurityEventCount();
      expect(finalEvents - initialEvents).toBe(1);
    });

    test('should record bot detection rate', async () => {
      // Act
      await detectBot(botRequest);
      
      // Assert
      const botRate = await metrics.getBotDetectionRate();
      expect(botRate).toBeGreaterThan(0);
    });
  });

  describe('Metrics Export', () => {
    test('should export metrics in Prometheus format', async () => {
      // Act
      const exported = await metrics.export();
      
      // Assert
      expect(exported).toContain('# HELP');
      expect(exported).toContain('# TYPE');
      expect(exported).toContain('captcha_requests_total');
    });
  });
});
```

### Week 4: Deployment & Infrastructure Testing

#### 3.4.1 Docker Tests
```typescript
// tests/integration/docker/docker-build.test.ts
describe('Docker Build', () => {
  describe('Image Build', () => {
    test('should build Docker image successfully', async () => {
      // Act
      const result = await exec('docker build -t secure-captcha-plugin .');
      
      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Successfully built');
    });

    test('should use multi-stage build', async () => {
      // Act
      const layers = await exec('docker history secure-captcha-plugin');
      
      // Assert
      expect(layers.stdout).toContain('node:');
      expect(layers.stdout).toContain('alpine:');
    });

    test('should run as non-root user', async () => {
      // Act
      const user = await exec('docker run secure-captcha-plugin whoami');
      
      // Assert
      expect(user.stdout.trim()).not.toBe('root');
    });
  });

  describe('Container Startup', () => {
    test('should start container successfully', async () => {
      // Act
      const container = await exec('docker run -d secure-captcha-plugin');
      const logs = await exec(`docker logs ${container.stdout}`);
      
      // Assert
      expect(logs.stdout).toContain('Server started');
    });

    test('should pass health check', async () => {
      // Arrange
      const container = await exec('docker run -d secure-captcha-plugin');
      await sleep(5000); // Wait for startup
      
      // Act
      const health = await exec(`docker inspect --format='{{.State.Health.Status}}' ${container.stdout}`);
      
      // Assert
      expect(health.stdout.trim()).toBe('healthy');
    });
  });

  describe('Security Scanning', () => {
    test('should have no critical vulnerabilities', async () => {
      // Act
      const scan = await exec('trivy image secure-captcha-plugin');
      
      // Assert
      expect(scan.stdout).not.toContain('CRITICAL');
    });

    test('should have no high vulnerabilities', async () => {
      // Act
      const scan = await exec('trivy image secure-captcha-plugin --severity HIGH');
      
      // Assert
      expect(scan.stdout).not.toContain('HIGH');
    });
  });
});
```

#### 3.4.2 Kubernetes Tests
```typescript
// tests/integration/kubernetes/k8s-manifests.test.ts
describe('Kubernetes Manifests', () => {
  describe('Manifest Validation', () => {
    test('should validate deployment manifest', async () => {
      // Act
      const result = await exec('kubectl apply --dry-run=client -f k8s/deployment.yaml');
      
      // Assert
      expect(result.exitCode).toBe(0);
    });

    test('should validate service manifest', async () => {
      // Act
      const result = await exec('kubectl apply --dry-run=client -f k8s/service.yaml');
      
      // Assert
      expect(result.exitCode).toBe(0);
    });

    test('should validate ingress manifest', async () => {
      // Act
      const result = await exec('kubectl apply --dry-run=client -f k8s/ingress.yaml');
      
      // Assert
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Helm Chart', () => {
    test('should lint Helm chart', async () => {
      // Act
      const result = await exec('helm lint helm/secure-captcha-plugin');
      
      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1 chart(s) linted');
    });

    test('should template Helm chart', async () => {
      // Act
      const result = await exec('helm template helm/secure-captcha-plugin');
      
      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('kind: Deployment');
    });
  });

  describe('HPA Configuration', () => {
    test('should configure autoscaling', async () => {
      // Act
      const hpa = await exec('kubectl apply --dry-run=client -f k8s/hpa.yaml');
      
      // Assert
      expect(hpa.exitCode).toBe(0);
    });
  });
});
```

---

## Phase 4: Advanced Security Features Testing

### Week 1: Behavioral Analysis Testing

#### 4.1.1 Mouse Movement Tests
```typescript
// tests/unit/behavioral/mouse-movement.test.ts
describe('Mouse Movement Tracking', () => {
  describe('Data Collection', () => {
    test('should collect mouse movements', async () => {
      // Arrange
      const movements = [
        { x: 100, y: 200, timestamp: Date.now() },
        { x: 150, y: 250, timestamp: Date.now() + 100 },
        { x: 200, y: 300, timestamp: Date.now() + 200 }
      ];
      
      // Act
      const collected = await mouseTracker.collect(movements);
      
      // Assert
      expect(collected.length).toBe(3);
    });

    test('should encrypt data before sending', async () => {
      // Arrange
      const movements = [{ x: 100, y: 200, timestamp: Date.now() }];
      
      // Act
      const encrypted = await mouseTracker.encrypt(movements);
      
      // Assert
      expect(encrypted).not.toContain('100');
      expect(encrypted).not.toContain('200');
    });
  });

  describe('Pattern Analysis', () => {
    test('should detect human-like patterns', async () => {
      // Arrange
      const humanMovements = generateHumanMovements();
      
      // Act
      const analysis = await mouseTracker.analyze(humanMovements);
      
      // Assert
      expect(analysis.isHuman).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0.8);
    });

    test('should detect bot-like patterns', async () => {
      // Arrange
      const botMovements = generateBotMovements();
      
      // Act
      const analysis = await mouseTracker.analyze(botMovements);
      
      // Assert
      expect(analysis.isHuman).toBe(false);
      expect(analysis.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect speed anomalies', async () => {
      // Arrange
      const fastMovements = generateFastMovements();
      
      // Act
      const anomaly = await mouseTracker.detectAnomaly(fastMovements);
      
      // Assert
      expect(anomaly.type).toBe('speed');
      expect(anomaly.severity).toBe('high');
    });

    test('should detect pattern anomalies', async () => {
      // Arrange
      const linearMovements = generateLinearMovements();
      
      // Act
      const anomaly = await mouseTracker.detectAnomaly(linearMovements);
      
      // Assert
      expect(anomaly.type).toBe('pattern');
      expect(anomaly.severity).toBe('medium');
    });
  });
});
```

### Week 2: Machine Learning Testing

#### 4.2.1 ML Model Tests
```typescript
// tests/unit/ml/bot-detection.test.ts
describe('Bot Detection ML Model', () => {
  describe('Feature Extraction', () => {
    test('should extract features from request', async () => {
      // Arrange
      const request = createMockRequest();
      
      // Act
      const features = await mlModel.extractFeatures(request);
      
      // Assert
      expect(features.length).toBeGreaterThan(0);
      expect(features).toContain('mouseMovement');
      expect(features).toContain('keystrokeTiming');
    });

    test('should normalize features', async () => {
      // Arrange
      const features = [100, 200, 300];
      
      // Act
      const normalized = await mlModel.normalize(features);
      
      // Assert
      expect(Math.max(...normalized)).toBeLessThanOrEqual(1);
      expect(Math.min(...normalized)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Model Training', () => {
    test('should train model with labeled data', async () => {
      // Arrange
      const trainingData = generateTrainingData(1000);
      
      // Act
      const model = await mlModel.train(trainingData);
      
      // Assert
      expect(model.accuracy).toBeGreaterThan(0.9);
    });

    test('should evaluate model performance', async () => {
      // Arrange
      const testData = generateTestData(100);
      
      // Act
      const metrics = await mlModel.evaluate(testData);
      
      // Assert
      expect(metrics.accuracy).toBeGreaterThan(0.9);
      expect(metrics.precision).toBeGreaterThan(0.9);
      expect(metrics.recall).toBeGreaterThan(0.9);
      expect(metrics.f1Score).toBeGreaterThan(0.9);
    });
  });

  describe('Real-time Inference', () => {
    test('should predict bot with high confidence', async () => {
      // Arrange
      const botRequest = createBotRequest();
      
      // Act
      const prediction = await mlModel.predict(botRequest);
      
      // Assert
      expect(prediction.isBot).toBe(true);
      expect(prediction.confidence).toBeGreaterThan(0.95);
    });

    test('should predict human with high confidence', async () => {
      // Arrange
      const humanRequest = createHumanRequest();
      
      // Act
      const prediction = await mlModel.predict(humanRequest);
      
      // Assert
      expect(prediction.isBot).toBe(false);
      expect(prediction.confidence).toBeGreaterThan(0.95);
    });

    test('should meet inference time requirement', async () => {
      // Arrange
      const request = createMockRequest();
      
      // Act
      const startTime = Date.now();
      await mlModel.predict(request);
      const endTime = Date.now();
      
      // Assert
      expect(endTime - startTime).toBeLessThan(50); // < 50ms
    });
  });
});
```

### Week 3: Enterprise Authentication Testing

#### 4.3.1 OAuth 2.0 Tests
```typescript
// tests/integration/auth/oauth.test.ts
describe('OAuth 2.0 Authentication', () => {
  describe('Authorization Code Flow', () => {
    test('should generate authorization URL', async () => {
      // Act
      const url = await oauth.generateAuthUrl({
        clientId: 'test-client',
        redirectUri: 'https://example.com/callback',
        scope: ['read', 'write']
      });
      
      // Assert
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=');
    });

    test('should exchange code for tokens', async () => {
      // Arrange
      const code = 'valid-auth-code';
      
      // Act
      const tokens = await oauth.exchangeCode(code);
      
      // Assert
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    test('should reject invalid code', async () => {
      // Arrange
      const code = 'invalid-code';
      
      // Act & Assert
      await expect(oauth.exchangeCode(code)).rejects.toThrow('Invalid authorization code');
    });
  });

  describe('Token Refresh', () => {
    test('should refresh access token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      
      // Act
      const tokens = await oauth.refreshToken(refreshToken);
      
      // Assert
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.accessToken).not.toBe(refreshToken);
    });

    test('should reject expired refresh token', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token';
      
      // Act & Assert
      await expect(oauth.refreshToken(refreshToken)).rejects.toThrow('Refresh token expired');
    });
  });

  describe('PKCE Support', () => {
    test('should generate code verifier and challenge', async () => {
      // Act
      const pkce = await oauth.generatePKCE();
      
      // Assert
      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
    });

    test('should validate code verifier', async () => {
      // Arrange
      const pkce = await oauth.generatePKCE();
      
      // Act
      const isValid = await oauth.validatePKCE(pkce.codeVerifier, pkce.codeChallenge);
      
      // Assert
      expect(isValid).toBe(true);
    });
  });
});
```

### Week 4: Compliance Testing

#### 4.4.1 GDPR Compliance Tests
```typescript
// tests/integration/compliance/gdpr.test.ts
describe('GDPR Compliance', () => {
  describe('Data Minimization', () => {
    test('should collect only necessary data', async () => {
      // Act
      const data = await gdpr.collectUserData(userId);
      
      // Assert
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('timestamp');
      expect(data).not.toHaveProperty('email');
      expect(data).not.toHaveProperty('name');
    });

    test('should anonymize data after retention period', async () => {
      // Arrange
      await createUserData(userId, { retainDays: 30 });
      await advanceTime(31 * 24 * 60 * 60 * 1000); // 31 days
      
      // Act
      const data = await gdpr.getUserData(userId);
      
      // Assert
      expect(data.sessionId).toBeNull();
    });
  });

  describe('Right to Erasure', () => {
    test('should delete user data on request', async () => {
      // Arrange
      await createUserData(userId);
      
      // Act
      await gdpr.deleteUserData(userId);
      const data = await gdpr.getUserData(userId);
      
      // Assert
      expect(data).toBeNull();
    });

    test('should delete data from all systems', async () => {
      // Arrange
      await createUserData(userId);
      
      // Act
      await gdpr.deleteUserData(userId);
      
      // Assert
      expect(await postgres.getUser(userId)).toBeNull();
      expect(await redis.getSession(userId)).toBeNull();
      expect(await elasticsearch.getUser(userId)).toBeNull();
    });
  });

  describe('Data Portability', () => {
    test('should export user data in JSON format', async () => {
      // Arrange
      await createUserData(userId);
      
      // Act
      const exported = await gdpr.exportUserData(userId, 'json');
      
      // Assert
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    test('should export user data in CSV format', async () => {
      // Arrange
      await createUserData(userId);
      
      // Act
      const exported = await gdpr.exportUserData(userId, 'csv');
      
      // Assert
      expect(exported).toContain(',');
      expect(exported.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('Consent Management', () => {
    test('should record user consent', async () => {
      // Act
      await gdpr.recordConsent(userId, {
        analytics: true,
        marketing: false
      });
      
      // Assert
      const consent = await gdpr.getConsent(userId);
      expect(consent.analytics).toBe(true);
      expect(consent.marketing).toBe(false);
    });

    test('should respect consent preferences', async () => {
      // Arrange
      await gdpr.recordConsent(userId, { analytics: false });
      
      // Act
      const canTrack = await gdpr.canTrackAnalytics(userId);
      
      // Assert
      expect(canTrack).toBe(false);
    });
  });
});
```

---

## Phase 5: Plugin Ecosystem Testing

### Week 1: Framework Plugins Testing

#### 5.1.1 Express Middleware Tests
```typescript
// tests/integration/plugins/express.test.ts
describe('Express Middleware', () => {
  describe('Middleware Integration', () => {
    test('should register middleware successfully', async () => {
      // Arrange
      const app = express();
      
      // Act
      app.use(captchaMiddleware({ type: 'text' }));
      
      // Assert
      expect(app._router.stack.length).toBeGreaterThan(0);
    });

    test('should generate captcha on request', async () => {
      // Arrange
      const app = express();
      app.use(captchaMiddleware({ type: 'text' }));
      app.get('/test', (req, res) => {
        res.json({ captcha: req.captcha });
      });
      
      // Act
      const response = await request(app).get('/test');
      
      // Assert
      expect(response.body.captcha).toBeDefined();
      expect(response.body.captcha.sessionId).toBeDefined();
    });

    test('should validate captcha on form submission', async () => {
      // Arrange
      const app = express();
      app.use(captchaMiddleware({ type: 'text' }));
      app.post('/submit', (req, res) => {
        res.json({ valid: req.captchaValid });
      });
      
      // Act
      const response = await request(app)
        .post('/submit')
        .send({ captchaResponse: 'correct-answer' });
      
      // Assert
      expect(response.body.valid).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    test('should apply custom difficulty', async () => {
      // Arrange
      const app = express();
      app.use(captchaMiddleware({ type: 'text', difficulty: 'hard' }));
      
      // Act
      const response = await request(app).get('/test');
      
      // Assert
      expect(response.body.captcha.difficulty).toBe('hard');
    });

    test('should apply custom session timeout', async () => {
      // Arrange
      const app = express();
      app.use(captchaMiddleware({ type: 'text', sessionTimeout: 60000 }));
      
      // Act
      const response = await request(app).get('/test');
      
      // Assert
      expect(response.body.captcha.expiresIn).toBe(60000);
    });
  });

  describe('Error Handling', () => {
    test('should handle generation errors gracefully', async () => {
      // Arrange
      const app = express();
      app.use(captchaMiddleware({ type: 'invalid' }));
      
      // Act
      const response = await request(app).get('/test');
      
      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});
```

### Week 2: Frontend Components Testing

#### 5.2.1 React Component Tests
```typescript
// tests/integration/plugins/react.test.tsx
describe('React CaptchaWidget', () => {
  describe('Rendering', () => {
    test('should render captcha widget', () => {
      // Act
      render(<CaptchaWidget type="text" onVerify={jest.fn()} />);
      
      // Assert
      expect(screen.getByTestId('captcha-widget')).toBeInTheDocument();
    });

    test('should display captcha challenge', async () => {
      // Act
      render(<CaptchaWidget type="text" onVerify={jest.fn()} />);
      
      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('captcha-challenge')).toBeInTheDocument();
      });
    });

    test('should display input field', () => {
      // Act
      render(<CaptchaWidget type="text" onVerify={jest.fn()} />);
      
      // Assert
      expect(screen.getByTestId('captcha-input')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('should call onVerify with correct answer', async () => {
      // Arrange
      const onVerify = jest.fn();
      render(<CaptchaWidget type="text" onVerify={onVerify} />);
      
      // Act
      const input = screen.getByTestId('captcha-input');
      fireEvent.change(input, { target: { value: 'correct-answer' } });
      fireEvent.click(screen.getByTestId('captcha-submit'));
      
      // Assert
      await waitFor(() => {
        expect(onVerify).toHaveBeenCalledWith(true);
      });
    });

    test('should call onVerify with incorrect answer', async () => {
      // Arrange
      const onVerify = jest.fn();
      render(<CaptchaWidget type="text" onVerify={onVerify} />);
      
      // Act
      const input = screen.getByTestId('captcha-input');
      fireEvent.change(input, { target: { value: 'wrong-answer' } });
      fireEvent.click(screen.getByTestId('captcha-submit'));
      
      // Assert
      await waitFor(() => {
        expect(onVerify).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Theming', () => {
    test('should apply light theme', () => {
      // Act
      render(<CaptchaWidget type="text" theme="light" onVerify={jest.fn()} />);
      
      // Assert
      expect(screen.getByTestId('captcha-widget')).toHaveClass('theme-light');
    });

    test('should apply dark theme', () => {
      // Act
      render(<CaptchaWidget type="text" theme="dark" onVerify={jest.fn()} />);
      
      // Assert
      expect(screen.getByTestId('captcha-widget')).toHaveClass('theme-dark');
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      // Act
      render(<CaptchaWidget type="text" onVerify={jest.fn()} />);
      
      // Assert
      expect(screen.getByLabelText('Captcha challenge')).toBeInTheDocument();
      expect(screen.getByLabelText('Enter captcha answer')).toBeInTheDocument();
    });

    test('should be keyboard navigable', () => {
      // Act
      render(<CaptchaWidget type="text" onVerify={jest.fn()} />);
      
      // Assert
      const input = screen.getByTestId('captcha-input');
      expect(input).toHaveAttribute('tabindex', '0');
    });
  });
});
```

### Week 3: CMS Plugins Testing

#### 5.3.1 WordPress Plugin Tests
```php
// tests/integration/wordpress/wordpress-plugin.test.php
class CaptchaPluginTest extends WP_UnitTestCase {
    
    public function test_plugin_activation() {
        // Act
        activate_plugin('secure-captcha-plugin/secure-captcha-plugin.php');
        
        // Assert
        $this->assertTrue(is_plugin_active('secure-captcha-plugin/secure-captcha-plugin.php'));
    }
    
    public function test_settings_page_exists() {
        // Act
        $menu_items = $this->get_admin_menu_items();
        
        // Assert
        $this->assertArrayHasKey('secure-captcha', $menu_items);
    }
    
    public function test_captcha_generation() {
        // Act
        $captcha = captcha_generate('text', 'medium');
        
        // Assert
        $this->assertArrayHasKey('session_id', $captcha);
        $this->assertArrayHasKey('challenge', $captcha);
        $this->assertEquals('text', $captcha['type']);
    }
    
    public function test_captcha_validation() {
        // Arrange
        $captcha = captcha_generate('text', 'medium');
        
        // Act
        $result = captcha_validate($captcha['session_id'], $captcha['answer']);
        
        // Assert
        $this->assertTrue($result);
    }
    
    public function test_form_integration() {
        // Arrange
        $form_html = '<form><input type="text" name="name">' . captcha_get_html() . '</form>';
        
        // Act
        $rendered = do_shortcode($form_html);
        
        // Assert
        $this->assertContains('captcha-widget', $rendered);
    }
    
    public function test_login_protection() {
        // Arrange
        update_option('captcha_protect_login', true);
        
        // Act
        $login_form = wp_login_form();
        
        // Assert
        $this->assertContains('captcha', $login_form);
    }
}
```

### Week 4: API & Integrations Testing

#### 5.4.1 GraphQL Tests
```typescript
// tests/integration/api/graphql.test.ts
describe('GraphQL API', () => {
  describe('Queries', () => {
    test('should query captcha types', async () => {
      // Arrange
      const query = `
        query {
          captchaTypes {
            type
            difficulty
            description
          }
        }
      `;
      
      // Act
      const result = await graphql({ query });
      
      // Assert
      expect(result.data.captchaTypes).toBeDefined();
      expect(result.data.captchaTypes.length).toBeGreaterThan(0);
    });

    test('should query session status', async () => {
      // Arrange
      const session = await createSession();
      const query = `
        query {
          session(id: "${session.id}") {
            id
            status
            expiresAt
          }
        }
      `;
      
      // Act
      const result = await graphql({ query });
      
      // Assert
      expect(result.data.session.id).toBe(session.id);
      expect(result.data.session.status).toBe('active');
    });
  });

  describe('Mutations', () => {
    test('should generate captcha', async () => {
      // Arrange
      const mutation = `
        mutation {
          generateCaptcha(type: TEXT, difficulty: MEDIUM) {
            sessionId
            challenge
            type
            difficulty
          }
        }
      `;
      
      // Act
      const result = await graphql({ mutation });
      
      // Assert
      expect(result.data.generateCaptcha.sessionId).toBeDefined();
      expect(result.data.generateCaptcha.challenge).toBeDefined();
    });

    test('should validate captcha', async () => {
      // Arrange
      const captcha = await generateCaptcha('text', 'medium');
      const mutation = `
        mutation {
          validateCaptcha(sessionId: "${captcha.sessionId}", response: "${captcha.answer}") {
            valid
            securityScore
          }
        }
      `;
      
      // Act
      const result = await graphql({ mutation });
      
      // Assert
      expect(result.data.validateCaptcha.valid).toBe(true);
    });
  });

  describe('Subscriptions', () => {
    test('should subscribe to security events', async () => {
      // Arrange
      const subscription = `
        subscription {
          securityEvent {
            type
            severity
            timestamp
          }
        }
      `;
      
      // Act
      const subscription$ = await graphqlSubscribe({ subscription });
      
      // Assert
      expect(subscription$).toBeDefined();
    });
  });
});
```

---

## Phase 6: Testing & Security Validation

### Week 1: Comprehensive Testing

#### 6.1.1 Coverage Requirements
```typescript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

#### 6.1.2 E2E Testing with Playwright
```typescript
// tests/e2e/captcha-flow.test.ts
describe('Captcha Flow E2E', () => {
  test('should complete captcha generation and validation', async ({ page }) => {
    // Navigate to captcha page
    await page.goto('http://localhost:3000/captcha');
    
    // Wait for captcha to load
    await page.waitForSelector('[data-testid="captcha-widget"]');
    
    // Get captcha challenge
    const challenge = await page.textContent('[data-testid="captcha-challenge"]');
    
    // Enter answer
    await page.fill('[data-testid="captcha-input"]', 'answer');
    
    // Submit
    await page.click('[data-testid="captcha-submit"]');
    
    // Verify success
    await page.waitForSelector('[data-testid="captcha-success"]');
    expect(await page.textContent('[data-testid="captcha-success"]')).toContain('Verified');
  });

  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to captcha page
    await page.goto('http://localhost:3000/captcha');
    
    // Verify widget is responsive
    const widget = await page.$('[data-testid="captcha-widget"]');
    const box = await widget.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });
});
```

### Week 2: Security Testing

#### 6.2.1 Penetration Testing Scripts
```bash
#!/bin/bash
# tests/security/penetration-test.sh

echo "Starting Penetration Testing..."

# OWASP ZAP Scanning
echo "Running OWASP ZAP..."
zap-cli quick-scan -s all -r http://localhost:3000

# SQLMap Testing
echo "Running SQLMap..."
sqlmap -u "http://localhost:3000/api/v1/captcha/generate" --batch

# Nmap Scanning
echo "Running Nmap..."
nmap -sV -sC localhost

# Nikto Scanning
echo "Running Nikto..."
nikto -h http://localhost:3000

echo "Penetration Testing Complete"
```

#### 6.2.2 Load Testing with k6
```javascript
// tests/load/captcha-generation.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

export default function () {
  const response = http.post('http://localhost:3000/api/v1/captcha/generate', JSON.stringify({
    type: 'text',
    difficulty: 'medium'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### Week 3: Performance Optimization Testing

#### 6.3.1 Performance Profiling
```typescript
// tests/performance/profiling.test.ts
describe('Performance Profiling', () => {
  test('should profile captcha generation', async () => {
    // Start CPU profiling
    const profiler = await startProfiling();
    
    // Generate captcha
    await generateCaptcha('text', 'medium');
    
    // Stop profiling
    const profile = await profiler.stop();
    
    // Analyze profile
    const hotspots = analyzeProfile(profile);
    expect(hotspots.length).toBeLessThan(5); // Few hotspots
  });

  test('should profile memory usage', async () => {
    // Get initial memory
    const initialMemory = process.memoryUsage();
    
    // Generate 1000 captchas
    for (let i = 0; i < 1000; i++) {
      await generateCaptcha('text', 'medium');
    }
    
    // Get final memory
    const finalMemory = process.memoryUsage();
    
    // Check memory increase
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });
});
```

### Week 4: Production Readiness Testing

#### 6.4.1 Deployment Testing
```typescript
// tests/deployment/deployment.test.ts
describe('Deployment Testing', () => {
  test('should deploy to staging', async () => {
    // Act
    const result = await deploy('staging');
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
  });

  test('should pass health checks after deployment', async () => {
    // Arrange
    await deploy('staging');
    
    // Act
    const health = await checkHealth('https://staging.example.com/health');
    
    // Assert
    expect(health.status).toBe('healthy');
  });

  test('should rollback on failure', async () => {
    // Arrange
    const initialVersion = await getCurrentVersion();
    
    // Act
    await deploy('staging', { simulateFailure: true });
    
    // Assert
    const currentVersion = await getCurrentVersion();
    expect(currentVersion).toBe(initialVersion);
  });
});
```

---

## Testing Commands Summary

### Phase 3 Commands
```bash
# Unit Tests
npm run test:unit

# Integration Tests
npm run test:integration -- --grep "API"
npm run test:integration -- --grep "Redis"
npm run test:integration -- --grep "Session"

# Performance Tests
npm run test:performance -- --grep "API Response Time"
npm run test:performance -- --grep "Throughput"

# Security Tests
npm run test:security -- --grep "Authentication"
npm run test:security -- --grep "Rate Limiting"
```

### Phase 4 Commands
```bash
# Behavioral Analysis Tests
npm run test:unit -- --grep "Behavioral"
npm run test:integration -- --grep "Mouse Tracking"
npm run test:integration -- --grep "Keystroke"

# ML Tests
npm run test:unit -- --grep "ML"
npm run test:performance -- --grep "Inference Time"

# Compliance Tests
npm run test:security -- --grep "GDPR"
npm run test:security -- --grep "SOC2"
npm run test:security -- --grep "Audit"
```

### Phase 5 Commands
```bash
# Framework Plugin Tests
npm run test:unit -- --grep "Express"
npm run test:unit -- --grep "Fastify"
npm run test:unit -- --grep "Koa"
npm run test:unit -- --grep "NestJS"

# Frontend Component Tests
npm run test:unit -- --grep "React"
npm run test:unit -- --grep "Vue"
npm run test:unit -- --grep "Angular"
npm run test:unit -- --grep "Svelte"

# CMS Plugin Tests
npm run test:integration -- --grep "WordPress"
npm run test:integration -- --grep "Drupal"
npm run test:integration -- --grep "Shopify"
```

### Phase 6 Commands
```bash
# Comprehensive Testing
npm run test:coverage

# Security Testing
npm run test:security:zap
npm run test:security:penetration
npm run test:security:vulnerability

# Load Testing
k6 run tests/load/captcha-generation.js
k6 run tests/load/captcha-validation.js
k6 run tests/load/concurrent-users.js

# E2E Testing
npx playwright test
```

---

## Success Criteria

### Phase 3 Success Criteria
- [ ] API response time < 200ms (95th percentile)
- [ ] Throughput > 10,000 RPS
- [ ] Session management with Redis
- [ ] Prometheus metrics collecting
- [ ] Docker images building
- [ ] Kubernetes manifests valid
- [ ] CI/CD pipeline running

### Phase 4 Success Criteria
- [ ] Behavioral analysis detecting bots
- [ ] ML model accuracy > 99%
- [ ] OAuth 2.0 working
- [ ] JWT tokens secure
- [ ] GDPR compliance verified
- [ ] SOC 2 controls implemented

### Phase 5 Success Criteria
- [ ] Express middleware working
- [ ] Fastify plugin working
- [ ] React component rendering
- [ ] Vue component rendering
- [ ] WordPress plugin functional
- [ ] API documentation complete

### Phase 6 Success Criteria
- [ ] Test coverage > 95%
- [ ] Penetration tests passed
- [ ] Load tests passed (10,000+ concurrent users)
- [ ] Performance optimized
- [ ] Production deployment ready
- [ ] Documentation complete

---

## Notes

- **TDD Required**: All code must have tests written first
- **Security First**: Security is the prime factor in all decisions
- **Performance Critical**: All operations must meet performance targets
- **Documentation Required**: All features must be documented
- **Code Review Required**: All changes require code review
- **Security Review Required**: All security changes require security review