/**
 * Threat Intelligence Tests
 * Tests for IP reputation checking, bot signatures, attack patterns, and threat feeds
 */

import { ThreatIntelligence, ThreatIntelligenceConfig } from '../../src/security/threat-intelligence';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock dependencies
jest.mock('../../src/security/security-logger');

describe('ThreatIntelligence', () => {
  let threatIntelligence: ThreatIntelligence;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  const defaultConfig: Partial<ThreatIntelligenceConfig> = {
    enableIPReputation: true,
    ipReputationCacheTTL: 3600,
    ipReputationSources: ['internal', 'abuseipdb', 'virustotal'],
    enableBotSignatures: true,
    botSignatureCacheTTL: 1800,
    enableAttackPatterns: true,
    attackPatternCacheTTL: 1800,
    enableThreatFeeds: true,
    threatFeedUpdateInterval: 60,
    maxIndicatorsPerFeed: 10000,
    enableRealTimeUpdates: true,
    enableLogging: true,
    confidenceThreshold: 0.7,
    maxCacheSize: 100000
  };

  beforeEach(() => {
    mockSecurityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: '/tmp/test.log',
      maxLogFileSize: 1024,
      maxLogFiles: 5
    }) as jest.Mocked<SecurityLogger>;

    threatIntelligence = new ThreatIntelligence(defaultConfig, mockSecurityLogger);
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(threatIntelligence).toBeDefined();
      const stats = threatIntelligence.getStats();
      expect(stats.botSignatures).toBeGreaterThan(0);
      expect(stats.attackPatterns).toBeGreaterThan(0);
      expect(stats.threatFeeds).toBeGreaterThan(0);
    });

    it('should initialize default bot signatures', () => {
      const signatures = threatIntelligence.getBotSignatures();
      expect(signatures.length).toBeGreaterThan(0);
      
      // Check for known bot signatures
      const googlebot = signatures.find(s => s.name === 'Googlebot');
      expect(googlebot).toBeDefined();
      expect(googlebot?.category).toBe('bot');
      expect(googlebot?.threatLevel).toBe('low');
      
      const headlessChrome = signatures.find(s => s.name === 'Headless Chrome');
      expect(headlessChrome).toBeDefined();
      expect(headlessChrome?.threatLevel).toBe('high');
    });

    it('should initialize default attack patterns', () => {
      const patterns = threatIntelligence.getAttackPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      
      // Check for SQL injection patterns
      const sqlInjection = patterns.find(p => p.name === 'SQL Injection - UNION');
      expect(sqlInjection).toBeDefined();
      expect(sqlInjection?.type).toBe('injection');
      expect(sqlInjection?.severity).toBe('critical');
      
      // Check for XSS patterns
      const xss = patterns.find(p => p.name === 'XSS - Script Tag');
      expect(xss).toBeDefined();
      expect(xss?.type).toBe('xss');
    });

    it('should initialize default threat feeds', () => {
      const feeds = threatIntelligence.getThreatFeeds();
      expect(feeds.length).toBeGreaterThan(0);
      
      const internalFeed = feeds.find(f => f.name === 'Internal Threat Feed');
      expect(internalFeed).toBeDefined();
      expect(internalFeed?.isActive).toBe(true);
    });
  });

  describe('IP reputation checking', () => {
    it('should return null for unknown IP', async () => {
      const reputation = await threatIntelligence.checkIPReputation('192.168.1.1');
      expect(reputation).toBeNull();
    });

    it('should check IP reputation with threat indicator', async () => {
      // Add a threat indicator for an IP
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.1',
        category: 'bot',
        threatLevel: 'high',
        confidence: 0.9,
        source: 'test',
        description: 'Known malicious IP',
        tags: ['malicious', 'bot'],
        expiresAt: Date.now() + 86400000,
        metadata: {}
      });

      const reputation = await threatIntelligence.checkIPReputation('10.0.0.1');
      
      expect(reputation).not.toBeNull();
      expect(reputation?.ip).toBe('10.0.0.1');
      expect(reputation?.reputation).toBeLessThan(50);
      expect(reputation?.threatLevel).toBe('high');
      expect(reputation?.categories).toContain('bot');
    });

    it('should cache IP reputation results', async () => {
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.2',
        category: 'scanner',
        threatLevel: 'medium',
        confidence: 0.8,
        source: 'test',
        description: 'Scanner IP',
        tags: ['scanner'],
        metadata: {}
      });

      const reputation1 = await threatIntelligence.checkIPReputation('10.0.0.2');
      const reputation2 = await threatIntelligence.checkIPReputation('10.0.0.2');
      
      expect(reputation1).toEqual(reputation2);
      
      const stats = threatIntelligence.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });

    it('should return null when IP reputation is disabled', async () => {
      const disabledConfig: Partial<ThreatIntelligenceConfig> = {
        ...defaultConfig,
        enableIPReputation: false
      };
      
      const disabledThreatIntel = new ThreatIntelligence(disabledConfig, mockSecurityLogger);
      
      const reputation = await disabledThreatIntel.checkIPReputation('10.0.0.1');
      expect(reputation).toBeNull();
    });

    it('should log threat event for low reputation IP', async () => {
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.3',
        category: 'malware',
        threatLevel: 'critical',
        confidence: 0.95,
        source: 'test',
        description: 'Malware C2 server',
        tags: ['malware', 'c2'],
        metadata: {}
      });

      await threatIntelligence.checkIPReputation('10.0.0.3');
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ip_reputation_check',
          resource: 'threat_intelligence'
        })
      );
    });
  });

  describe('bot signature checking', () => {
    it('should detect Googlebot', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const googlebot = matches.find(m => m.name === 'Googlebot');
      expect(googlebot).toBeDefined();
      expect(googlebot?.threatLevel).toBe('low');
    });

    it('should detect Headless Chrome', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.114 Safari/537.36'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const headless = matches.find(m => m.name === 'Headless Chrome');
      expect(headless).toBeDefined();
      expect(headless?.threatLevel).toBe('high');
    });

    it('should detect Selenium', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36 selenium'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const selenium = matches.find(m => m.name === 'Selenium');
      expect(selenium).toBeDefined();
      expect(selenium?.threatLevel).toBe('high');
    });

    it('should detect Python requests', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'python-requests/2.25.1'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const python = matches.find(m => m.name === 'Python Requests');
      expect(python).toBeDefined();
      expect(python?.threatLevel).toBe('medium');
    });

    it('should detect curl', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'curl/7.68.0'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const curl = matches.find(m => m.name === 'curl');
      expect(curl).toBeDefined();
      expect(curl?.threatLevel).toBe('low');
    });

    it('should return empty array for normal browser', () => {
      const matches = threatIntelligence.checkBotSignatures(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      expect(matches.length).toBe(0);
    });

    it('should return empty array when bot signatures are disabled', () => {
      const disabledConfig: Partial<ThreatIntelligenceConfig> = {
        ...defaultConfig,
        enableBotSignatures: false
      };
      
      const disabledThreatIntel = new ThreatIntelligence(disabledConfig, mockSecurityLogger);
      
      const matches = disabledThreatIntel.checkBotSignatures(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      );
      
      expect(matches.length).toBe(0);
    });

    it('should log bot detection event', () => {
      threatIntelligence.checkBotSignatures(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      );
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'bot_signature_match',
          resource: 'threat_intelligence'
        })
      );
    });
  });

  describe('attack pattern checking', () => {
    it('should detect SQL injection - UNION', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        "1 UNION SELECT * FROM users"
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const sqlInjection = matches.find(m => m.name === 'SQL Injection - UNION');
      expect(sqlInjection).toBeDefined();
      expect(sqlInjection?.severity).toBe('critical');
    });

    it('should detect SQL injection - OR', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        "admin' OR '1'='1"
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const sqlInjection = matches.find(m => m.name === 'SQL Injection - OR/AND');
      expect(sqlInjection).toBeDefined();
    });

    it('should detect XSS - script tag', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        '<script>alert("XSS")</script>'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const xss = matches.find(m => m.name === 'XSS - Script Tag');
      expect(xss).toBeDefined();
      expect(xss?.severity).toBe('high');
    });

    it('should detect XSS - event handler', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        '<img src=x onerror=alert("XSS")>'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const xss = matches.find(m => m.name === 'XSS - Event Handlers');
      expect(xss).toBeDefined();
    });

    it('should detect path traversal', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        '../../../etc/passwd'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const pathTraversal = matches.find(m => m.name === 'Path Traversal');
      expect(pathTraversal).toBeDefined();
      expect(pathTraversal?.severity).toBe('high');
    });

    it('should detect command injection', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        '; ls -la'
      );
      
      expect(matches.length).toBeGreaterThan(0);
      const cmdInjection = matches.find(m => m.name === 'Command Injection');
      expect(cmdInjection).toBeDefined();
      expect(cmdInjection?.severity).toBe('critical');
    });

    it('should return empty array for safe input', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        'Hello, this is a normal user input'
      );
      
      expect(matches.length).toBe(0);
    });

    it('should return empty array when attack patterns are disabled', () => {
      const disabledConfig: Partial<ThreatIntelligenceConfig> = {
        ...defaultConfig,
        enableAttackPatterns: false
      };
      
      const disabledThreatIntel = new ThreatIntelligence(disabledConfig, mockSecurityLogger);
      
      const matches = disabledThreatIntel.checkAttackPatterns(
        "1 UNION SELECT * FROM users"
      );
      
      expect(matches.length).toBe(0);
    });

    it('should log attack pattern detection event', () => {
      threatIntelligence.checkAttackPatterns(
        "1 UNION SELECT * FROM users"
      );
      
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'attack_pattern_match',
          resource: 'threat_intelligence'
        })
      );
    });
  });

  describe('comprehensive threat check', () => {
    it('should perform comprehensive threat check', async () => {
      const result = await threatIntelligence.checkThreat({
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        input: 'Hello world'
      });
      
      expect(result).toHaveProperty('isThreat');
      expect(result).toHaveProperty('threatLevel');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('indicators');
      expect(result).toHaveProperty('matchedSignatures');
      expect(result).toHaveProperty('matchedPatterns');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('metadata');
      
      expect(typeof result.isThreat).toBe('boolean');
      expect(['low', 'medium', 'high', 'critical']).toContain(result.threatLevel);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect threat from malicious IP', async () => {
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.10',
        category: 'bot',
        threatLevel: 'high',
        confidence: 0.9,
        source: 'test',
        description: 'Known bot IP',
        tags: ['bot'],
        metadata: {}
      });

      const result = await threatIntelligence.checkThreat({
        ip: '10.0.0.10',
        userAgent: 'Mozilla/5.0',
        input: 'Hello'
      });
      
      expect(result.isThreat).toBe(true);
      expect(result.categories).toContain('bot');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect threat from bot user agent', async () => {
      const result = await threatIntelligence.checkThreat({
        ip: '192.168.1.1',
        userAgent: 'HeadlessChrome/91.0.4472.114',
        input: 'Hello'
      });
      
      expect(result.isThreat).toBe(true);
      expect(result.matchedSignatures.length).toBeGreaterThan(0);
      expect(result.threatLevel).toBe('high');
    });

    it('should detect threat from attack pattern', async () => {
      const result = await threatIntelligence.checkThreat({
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        input: "1 UNION SELECT * FROM users"
      });
      
      expect(result.isThreat).toBe(true);
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
      expect(result.threatLevel).toBe('critical');
    });

    it('should not detect threat for safe request', async () => {
      const result = await threatIntelligence.checkThreat({
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        input: 'Hello world'
      });
      
      expect(result.isThreat).toBe(false);
      expect(result.threatLevel).toBe('low');
      expect(result.matchedSignatures.length).toBe(0);
      expect(result.matchedPatterns.length).toBe(0);
    });
  });

  describe('threat indicator management', () => {
    it('should add threat indicator', () => {
      const indicator = threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.20',
        category: 'spam',
        threatLevel: 'medium',
        confidence: 0.8,
        source: 'test',
        description: 'Spam source',
        tags: ['spam'],
        metadata: {}
      });
      
      expect(indicator).toHaveProperty('id');
      expect(indicator).toHaveProperty('firstSeen');
      expect(indicator).toHaveProperty('lastSeen');
      expect(indicator.type).toBe('ip');
      expect(indicator.value).toBe('10.0.0.20');
    });

    it('should add bot signature', () => {
      const signature = threatIntelligence.addBotSignature({
        name: 'Test Bot',
        pattern: /testbot/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'medium',
        description: 'Test bot signature',
        confidence: 0.8,
        source: 'test',
        isActive: true
      });
      
      expect(signature).toHaveProperty('id');
      expect(signature).toHaveProperty('createdAt');
      expect(signature).toHaveProperty('updatedAt');
      expect(signature.name).toBe('Test Bot');
    });

    it('should add attack pattern', () => {
      const pattern = threatIntelligence.addAttackPattern({
        name: 'Test Attack',
        type: 'injection',
        patterns: ['test_pattern'],
        severity: 'high',
        description: 'Test attack pattern',
        mitigation: 'Test mitigation',
        source: 'test',
        isActive: true
      });
      
      expect(pattern).toHaveProperty('id');
      expect(pattern).toHaveProperty('createdAt');
      expect(pattern).toHaveProperty('updatedAt');
      expect(pattern.name).toBe('Test Attack');
    });
  });

  describe('threat feed management', () => {
    it('should update threat feed', async () => {
      const feeds = threatIntelligence.getThreatFeeds();
      const feedId = feeds[0].id;
      
      const result = await threatIntelligence.updateThreatFeed(feedId);
      
      expect(result).toBe(true);
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'threat_feed_updated',
          resource: 'threat_intelligence'
        })
      );
    });

    it('should return false for non-existent feed', async () => {
      const result = await threatIntelligence.updateThreatFeed('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return false for inactive feed', async () => {
      const feeds = threatIntelligence.getThreatFeeds();
      const inactiveFeed = feeds.find(f => !f.isActive);
      
      if (inactiveFeed) {
        const result = await threatIntelligence.updateThreatFeed(inactiveFeed.id);
        expect(result).toBe(false);
      }
    });
  });

  describe('statistics', () => {
    it('should get threat intelligence statistics', () => {
      const stats = threatIntelligence.getStats();
      
      expect(stats).toHaveProperty('totalIndicators');
      expect(stats).toHaveProperty('indicatorsByType');
      expect(stats).toHaveProperty('indicatorsByCategory');
      expect(stats).toHaveProperty('indicatorsByThreatLevel');
      expect(stats).toHaveProperty('botSignatures');
      expect(stats).toHaveProperty('attackPatterns');
      expect(stats).toHaveProperty('threatFeeds');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('lastUpdate');
      
      expect(stats.botSignatures).toBeGreaterThan(0);
      expect(stats.attackPatterns).toBeGreaterThan(0);
      expect(stats.threatFeeds).toBeGreaterThan(0);
    });

    it('should update statistics after adding indicators', () => {
      const initialStats = threatIntelligence.getStats();
      
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.30',
        category: 'bot',
        threatLevel: 'high',
        confidence: 0.9,
        source: 'test',
        description: 'Test indicator',
        tags: ['test'],
        metadata: {}
      });
      
      const updatedStats = threatIntelligence.getStats();
      expect(updatedStats.totalIndicators).toBe(initialStats.totalIndicators + 1);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      // Add some data to caches
      threatIntelligence.addThreatIndicator({
        type: 'ip',
        value: '10.0.0.40',
        category: 'bot',
        threatLevel: 'high',
        confidence: 0.9,
        source: 'test',
        description: 'Test',
        tags: ['test'],
        metadata: {}
      });
      
      await threatIntelligence.checkIPReputation('10.0.0.40');
      
      threatIntelligence.clearCaches();
      
      // Caches should be cleared
      const stats = threatIntelligence.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty user agent', () => {
      const matches = threatIntelligence.checkBotSignatures('');
      expect(matches.length).toBe(0);
    });

    it('should handle empty input', () => {
      const matches = threatIntelligence.checkAttackPatterns('');
      expect(matches.length).toBe(0);
    });

    it('should handle special characters in input', () => {
      const matches = threatIntelligence.checkAttackPatterns(
        '!@#$%^&*()_+-=[]{}|;:,.<>?'
      );
      expect(matches.length).toBe(0);
    });

    it('should handle very long input', () => {
      const longInput = 'a'.repeat(10000);
      const matches = threatIntelligence.checkAttackPatterns(longInput);
      expect(matches.length).toBe(0);
    });

    it('should handle concurrent threat checks', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          threatIntelligence.checkThreat({
            ip: `192.168.1.${i}`,
            userAgent: 'Mozilla/5.0',
            input: 'Hello'
          })
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result).toHaveProperty('isThreat');
        expect(result).toHaveProperty('threatLevel');
      });
    });
  });
});