/**
 * Threat Intelligence Service
 * Provides IP reputation checking, bot signatures, attack patterns, and threat feeds
 */

import { SecurityLogger } from './security-logger';
import { SecurityEventDetails } from '../types/security';

// Threat Intelligence Types
export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatCategory =
  | 'bot'
  | 'scanner'
  | 'spam'
  | 'malware'
  | 'phishing'
  | 'ddos'
  | 'bruteforce'
  | 'credential_stuffing'
  | 'api_abuse'
  | 'suspicious';

export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'pattern' | 'signature';
  value: string;
  category: ThreatCategory;
  threatLevel: ThreatLevel;
  confidence: number; // 0-1
  source: string;
  description: string;
  tags: string[];
  firstSeen: number;
  lastSeen: number;
  expiresAt?: number;
  metadata: Record<string, unknown>;
}

export interface IPReputation {
  ip: string;
  reputation: number; // 0-100, lower is worse
  threatLevel: ThreatLevel;
  categories: ThreatCategory[];
  isProxy: boolean;
  isVPN: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  country: string;
  asn: string;
  isp: string;
  lastSeen: number;
  reportCount: number;
  sources: string[];
  metadata: Record<string, unknown>;
}

export interface BotSignature {
  id: string;
  name: string;
  pattern: RegExp | string;
  patternType: 'regex' | 'string' | 'header' | 'behavior';
  category: ThreatCategory;
  threatLevel: ThreatLevel;
  description: string;
  userAgent?: string;
  headers?: Record<string, string>;
  behaviorPatterns?: string[];
  confidence: number;
  source: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface AttackPattern {
  id: string;
  name: string;
  type: 'injection' | 'xss' | 'csrf' | 'bruteforce' | 'enumeration' | 'scanning' | 'dos';
  patterns: string[];
  severity: ThreatLevel;
  description: string;
  mitigation: string;
  cwe?: string; // Common Weakness Enumeration
  cvss?: number; // Common Vulnerability Scoring System
  source: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface ThreatFeed {
  id: string;
  name: string;
  url: string;
  type: 'ip' | 'domain' | 'hash' | 'pattern';
  format: 'text' | 'json' | 'csv' | 'stix';
  updateInterval: number; // minutes
  lastUpdated: number;
  isActive: boolean;
  indicators: ThreatIndicator[];
  metadata: Record<string, unknown>;
}

export interface ThreatIntelligenceConfig {
  // IP Reputation
  enableIPReputation: boolean;
  ipReputationCacheTTL: number; // seconds
  ipReputationSources: string[];

  // Bot Signatures
  enableBotSignatures: boolean;
  botSignatureCacheTTL: number; // seconds

  // Attack Patterns
  enableAttackPatterns: boolean;
  attackPatternCacheTTL: number; // seconds

  // Threat Feeds
  enableThreatFeeds: boolean;
  threatFeedUpdateInterval: number; // minutes
  maxIndicatorsPerFeed: number;

  // General
  enableRealTimeUpdates: boolean;
  enableLogging: boolean;
  confidenceThreshold: number; // 0-1
  maxCacheSize: number;
}

export interface ThreatCheckResult {
  isThreat: boolean;
  threatLevel: ThreatLevel;
  confidence: number;
  categories: ThreatCategory[];
  indicators: ThreatIndicator[];
  matchedSignatures: BotSignature[];
  matchedPatterns: AttackPattern[];
  recommendations: string[];
  metadata: Record<string, unknown>;
}

export interface ThreatIntelligenceStats {
  totalIndicators: number;
  indicatorsByType: Record<string, number>;
  indicatorsByCategory: Record<string, number>;
  indicatorsByThreatLevel: Record<string, number>;
  botSignatures: number;
  attackPatterns: number;
  threatFeeds: number;
  cacheHits: number;
  cacheMisses: number;
  lastUpdate: number;
}

export class ThreatIntelligence {
  private readonly config: ThreatIntelligenceConfig;
  private readonly securityLogger: SecurityLogger;

  // Caches
  private readonly ipReputationCache: Map<string, IPReputation> = new Map();
  private readonly botSignatureCache: Map<string, BotSignature> = new Map();
  private readonly attackPatternCache: Map<string, AttackPattern> = new Map();
  private readonly threatIndicatorCache: Map<string, ThreatIndicator> = new Map();

  // Data stores
  private readonly botSignatures: Map<string, BotSignature> = new Map();
  private readonly attackPatterns: Map<string, AttackPattern> = new Map();
  private readonly threatFeeds: Map<string, ThreatFeed> = new Map();
  private readonly threatIndicators: Map<string, ThreatIndicator> = new Map();

  // Statistics
  private readonly stats: ThreatIntelligenceStats = {
    totalIndicators: 0,
    indicatorsByType: {},
    indicatorsByCategory: {},
    indicatorsByThreatLevel: {},
    botSignatures: 0,
    attackPatterns: 0,
    threatFeeds: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastUpdate: Date.now(),
  };

  constructor(config: Partial<ThreatIntelligenceConfig>, securityLogger: SecurityLogger) {
    this.config = {
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
      maxCacheSize: 100000,
      ...config,
    };

    this.securityLogger = securityLogger;
    this.initializeDefaultData();
  }

  /**
   * Initialize default bot signatures and attack patterns
   */
  private initializeDefaultData(): void {
    // Initialize default bot signatures
    this.initializeBotSignatures();

    // Initialize default attack patterns
    this.initializeAttackPatterns();

    // Initialize default threat feeds
    this.initializeThreatFeeds();

    this.updateStats();
  }

  /**
   * Initialize default bot signatures
   */
  private initializeBotSignatures(): void {
    const defaultSignatures: Omit<BotSignature, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Known bot user agents
      {
        name: 'Googlebot',
        pattern: /Googlebot\/[\d.]+/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'low',
        description: 'Google search crawler',
        userAgent: 'Googlebot',
        confidence: 0.95,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'Bingbot',
        pattern: /bingbot\/[\d.]+/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'low',
        description: 'Bing search crawler',
        userAgent: 'bingbot',
        confidence: 0.95,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'Scrapy',
        pattern: /Scrapy\/[\d.]+/i,
        patternType: 'regex',
        category: 'scanner',
        threatLevel: 'medium',
        description: 'Scrapy web scraping framework',
        confidence: 0.9,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'Python Requests',
        pattern: /python-requests\/[\d.]+/i,
        patternType: 'regex',
        category: 'scanner',
        threatLevel: 'medium',
        description: 'Python requests library',
        confidence: 0.85,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'curl',
        pattern: /curl\/[\d.]+/i,
        patternType: 'regex',
        category: 'scanner',
        threatLevel: 'low',
        description: 'curl command line tool',
        confidence: 0.8,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'wget',
        pattern: /Wget\/[\d.]+/i,
        patternType: 'regex',
        category: 'scanner',
        threatLevel: 'low',
        description: 'wget download utility',
        confidence: 0.8,
        source: 'internal',
        isActive: true,
      },
      // Suspicious patterns
      {
        name: 'Headless Chrome',
        pattern: /HeadlessChrome/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'high',
        description: 'Headless Chrome browser (often used for automation)',
        confidence: 0.9,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'PhantomJS',
        pattern: /PhantomJS\/[\d.]+/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'high',
        description: 'PhantomJS headless browser',
        confidence: 0.95,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'Selenium',
        pattern: /selenium/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'high',
        description: 'Selenium WebDriver',
        confidence: 0.9,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'Puppeteer',
        pattern: /puppeteer/i,
        patternType: 'regex',
        category: 'bot',
        threatLevel: 'high',
        description: 'Puppeteer headless browser',
        confidence: 0.9,
        source: 'internal',
        isActive: true,
      },
    ];

    defaultSignatures.forEach(sig => {
      const id = this.generateId('bot-sig');
      const signature: BotSignature = {
        ...sig,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.botSignatures.set(id, signature);
    });

    this.stats.botSignatures = this.botSignatures.size;
  }

  /**
   * Initialize default attack patterns
   */
  private initializeAttackPatterns(): void {
    const defaultPatterns: Omit<AttackPattern, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // SQL Injection patterns
      {
        name: 'SQL Injection - UNION',
        type: 'injection',
        patterns: ['UNION\\s+SELECT', 'UNION\\s+ALL\\s+SELECT', 'UNION\\s+DISTINCT'],
        severity: 'critical',
        description: 'SQL injection attempt using UNION',
        mitigation: 'Use parameterized queries and input validation',
        cwe: 'CWE-89',
        cvss: 9.8,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'SQL Injection - OR/AND',
        type: 'injection',
        patterns: [
          "'\\s*OR\\s*'1'\\s*=\\s*'1",
          "'\\s*OR\\s*1\\s*=\\s*1",
          "'\\s*AND\\s*'1'\\s*=\\s*'1",
          "'\\s*AND\\s*1\\s*=\\s*1",
        ],
        severity: 'critical',
        description: 'SQL injection attempt using OR/AND conditions',
        mitigation: 'Use parameterized queries and input validation',
        cwe: 'CWE-89',
        cvss: 9.8,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'SQL Injection - Comment',
        type: 'injection',
        patterns: ['--\\s*$', '/\\*.*\\*/', '#\\s*$'],
        severity: 'high',
        description: 'SQL injection attempt using comments',
        mitigation: 'Use parameterized queries and input validation',
        cwe: 'CWE-89',
        cvss: 8.6,
        source: 'internal',
        isActive: true,
      },
      // XSS patterns
      {
        name: 'XSS - Script Tag',
        type: 'xss',
        patterns: ['<script[^>]*>', '<\\/script>', 'javascript:', 'vbscript:'],
        severity: 'high',
        description: 'Cross-site scripting attempt using script tags',
        mitigation: 'Implement Content Security Policy and output encoding',
        cwe: 'CWE-79',
        cvss: 7.5,
        source: 'internal',
        isActive: true,
      },
      {
        name: 'XSS - Event Handlers',
        type: 'xss',
        patterns: [
          'on\\w+\\s*=',
          'onerror\\s*=',
          'onload\\s*=',
          'onclick\\s*=',
          'onmouseover\\s*=',
        ],
        severity: 'high',
        description: 'Cross-site scripting attempt using event handlers',
        mitigation: 'Implement Content Security Policy and output encoding',
        cwe: 'CWE-79',
        cvss: 7.5,
        source: 'internal',
        isActive: true,
      },
      // Path traversal
      {
        name: 'Path Traversal',
        type: 'injection',
        patterns: [
          '\\.\\.\\/\\.\\.\\/\\.\\.\\/',
          '\\.\\.\\\\\\.\\.\\\\\\.\\.\\\\',
          '%2e%2e%2f',
          '%2e%2e%5c',
        ],
        severity: 'high',
        description: 'Path traversal attempt',
        mitigation: 'Validate and sanitize file paths',
        cwe: 'CWE-22',
        cvss: 7.5,
        source: 'internal',
        isActive: true,
      },
      // Command injection
      {
        name: 'Command Injection',
        type: 'injection',
        patterns: [
          ';\\s*(ls|dir|cat|type|rm|del)',
          '\\|\\s*(ls|dir|cat|type|rm|del)',
          '`[^`]*`',
          '\\$\\([^)]*\\)',
        ],
        severity: 'critical',
        description: 'Command injection attempt',
        mitigation: 'Avoid shell execution and use safe APIs',
        cwe: 'CWE-78',
        cvss: 9.8,
        source: 'internal',
        isActive: true,
      },
      // Brute force patterns
      {
        name: 'Brute Force - Multiple Failed Logins',
        type: 'bruteforce',
        patterns: ['failed_login', 'invalid_password', 'authentication_failed'],
        severity: 'high',
        description: 'Potential brute force attack detected',
        mitigation: 'Implement rate limiting and account lockout',
        cwe: 'CWE-307',
        cvss: 7.5,
        source: 'internal',
        isActive: true,
      },
    ];

    defaultPatterns.forEach(pattern => {
      const id = this.generateId('attack-pattern');
      const attackPattern: AttackPattern = {
        ...pattern,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.attackPatterns.set(id, attackPattern);
    });

    this.stats.attackPatterns = this.attackPatterns.size;
  }

  /**
   * Initialize default threat feeds
   */
  private initializeThreatFeeds(): void {
    const defaultFeeds: Omit<ThreatFeed, 'id' | 'lastUpdated' | 'indicators'>[] = [
      {
        name: 'Internal Threat Feed',
        url: 'internal://threats',
        type: 'ip',
        format: 'json',
        updateInterval: 60,
        isActive: true,
        metadata: { source: 'internal' },
      },
      {
        name: 'Known Malicious IPs',
        url: 'internal://malicious-ips',
        type: 'ip',
        format: 'text',
        updateInterval: 120,
        isActive: true,
        metadata: { source: 'internal' },
      },
    ];

    defaultFeeds.forEach(feed => {
      const id = this.generateId('threat-feed');
      const threatFeed: ThreatFeed = {
        ...feed,
        id,
        lastUpdated: Date.now(),
        indicators: [],
      };
      this.threatFeeds.set(id, threatFeed);
    });

    this.stats.threatFeeds = this.threatFeeds.size;
  }

  /**
   * Check IP reputation
   */
  async checkIPReputation(ip: string): Promise<IPReputation | null> {
    if (!this.config.enableIPReputation) {
      return null;
    }

    // Check cache first
    const cached = this.ipReputationCache.get(ip);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;

    // Check threat indicators
    const indicators = Array.from(this.threatIndicators.values()).filter(
      indicator => indicator.type === 'ip' && indicator.value === ip
    );

    if (indicators.length === 0) {
      return null;
    }

    // Calculate reputation based on indicators
    const threatLevels: Record<ThreatLevel, number> = {
      critical: 0,
      high: 25,
      medium: 50,
      low: 75,
    };

    const categories = new Set<ThreatCategory>();
    let minReputation = 100;
    let maxThreatLevel: ThreatLevel = 'low';
    const sources = new Set<string>();

    indicators.forEach(indicator => {
      categories.add(indicator.category);
      sources.add(indicator.source);

      const reputation = threatLevels[indicator.threatLevel];
      if (reputation < minReputation) {
        minReputation = reputation;
        maxThreatLevel = indicator.threatLevel;
      }
    });

    const reputation: IPReputation = {
      ip,
      reputation: minReputation,
      threatLevel: maxThreatLevel,
      categories: Array.from(categories),
      isProxy: false,
      isVPN: false,
      isTor: false,
      isDatacenter: false,
      country: 'Unknown',
      asn: 'Unknown',
      isp: 'Unknown',
      lastSeen: Date.now(),
      reportCount: indicators.length,
      sources: Array.from(sources),
      metadata: { indicators: indicators.map(i => i.id) },
    };

    // Cache the result
    this.ipReputationCache.set(ip, reputation);

    // Log if threat detected
    if (reputation.reputation < 50) {
      this.logThreatEvent('ip_reputation_check', {
        ip,
        reputation: reputation.reputation,
        threatLevel: reputation.threatLevel,
        categories: reputation.categories,
      });
    }

    return reputation;
  }

  /**
   * Check user agent against bot signatures
   */
  checkBotSignatures(userAgent: string): BotSignature[] {
    if (!this.config.enableBotSignatures) {
      return [];
    }

    const matches: BotSignature[] = [];

    this.botSignatures.forEach(signature => {
      if (!signature.isActive) {
        return;
      }

      let isMatch = false;

      switch (signature.patternType) {
        case 'regex':
          const regex =
            signature.pattern instanceof RegExp
              ? signature.pattern
              : new RegExp(signature.pattern, 'i');
          isMatch = regex.test(userAgent);
          break;
        case 'string':
          isMatch = userAgent.toLowerCase().includes((signature.pattern as string).toLowerCase());
          break;
        case 'header':
          // Header-based matching would require full request headers
          break;
        case 'behavior':
          // Behavior-based matching requires behavioral analysis
          break;
      }

      if (isMatch) {
        matches.push(signature);
      }
    });

    // Log if bot detected
    if (matches.length > 0) {
      this.logThreatEvent('bot_signature_match', {
        userAgent,
        matchedSignatures: matches.map(s => s.name),
        threatLevel: matches[0].threatLevel,
      });
    }

    return matches;
  }

  /**
   * Check input against attack patterns
   */
  checkAttackPatterns(input: string): AttackPattern[] {
    if (!this.config.enableAttackPatterns) {
      return [];
    }

    const matches: AttackPattern[] = [];

    this.attackPatterns.forEach(pattern => {
      if (!pattern.isActive) {
        return;
      }

      for (const regexPattern of pattern.patterns) {
        try {
          const regex = new RegExp(regexPattern, 'i');
          if (regex.test(input)) {
            matches.push(pattern);
            break;
          }
        } catch (error) {
          // Invalid regex pattern, skip
          continue;
        }
      }
    });

    // Log if attack pattern detected
    if (matches.length > 0) {
      this.logThreatEvent('attack_pattern_match', {
        input: input.substring(0, 100), // Log only first 100 chars
        matchedPatterns: matches.map(p => p.name),
        severity: matches[0].severity,
      });
    }

    return matches;
  }

  /**
   * Comprehensive threat check
   */
  async checkThreat(data: {
    ip?: string;
    userAgent?: string;
    input?: string;
    headers?: Record<string, string>;
    behavior?: Record<string, unknown>;
  }): Promise<ThreatCheckResult> {
    const indicators: ThreatIndicator[] = [];
    const matchedSignatures: BotSignature[] = [];
    const matchedPatterns: AttackPattern[] = [];
    const categories = new Set<ThreatCategory>();
    const recommendations: string[] = [];

    // Check IP reputation
    if (data.ip) {
      const ipReputation = await this.checkIPReputation(data.ip);
      if (ipReputation && ipReputation.reputation < 50) {
        ipReputation.categories.forEach(cat => categories.add(cat));
        recommendations.push(
          `Block or rate limit IP ${data.ip} (reputation: ${ipReputation.reputation})`
        );
      }
    }

    // Check bot signatures
    if (data.userAgent) {
      const botMatches = this.checkBotSignatures(data.userAgent);
      matchedSignatures.push(...botMatches);
      botMatches.forEach(sig => {
        categories.add(sig.category);
        if (sig.threatLevel === 'high' || sig.threatLevel === 'critical') {
          recommendations.push(`Block request from ${sig.name}`);
        }
      });
    }

    // Check attack patterns
    if (data.input) {
      const patternMatches = this.checkAttackPatterns(data.input);
      matchedPatterns.push(...patternMatches);
      patternMatches.forEach(pattern => {
        categories.add('suspicious');
        recommendations.push(`Potential ${pattern.type} attack detected: ${pattern.mitigation}`);
      });
    }

    // Determine overall threat level
    let threatLevel: ThreatLevel = 'low';
    let confidence = 0;

    if (matchedPatterns.length > 0) {
      const maxSeverity = matchedPatterns.reduce((max, p) => {
        const severityOrder: Record<ThreatLevel, number> = {
          low: 1,
          medium: 2,
          high: 3,
          critical: 4,
        };
        return severityOrder[p.severity] > severityOrder[max] ? p.severity : max;
      }, 'low' as ThreatLevel);
      threatLevel = maxSeverity;
      confidence = 0.9;
    } else if (matchedSignatures.length > 0) {
      const maxThreat = matchedSignatures.reduce((max, s) => {
        const severityOrder: Record<ThreatLevel, number> = {
          low: 1,
          medium: 2,
          high: 3,
          critical: 4,
        };
        return severityOrder[s.threatLevel] > severityOrder[max] ? s.threatLevel : max;
      }, 'low' as ThreatLevel);
      threatLevel = maxThreat;
      confidence = matchedSignatures[0].confidence;
    }

    const isThreat = threatLevel !== 'low' || categories.size > 0;

    return {
      isThreat,
      threatLevel,
      confidence,
      categories: Array.from(categories),
      indicators,
      matchedSignatures,
      matchedPatterns,
      recommendations,
      metadata: {
        ip: data.ip,
        userAgent: data.userAgent,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Add threat indicator
   */
  addThreatIndicator(
    indicator: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen'>
  ): ThreatIndicator {
    const id = this.generateId('indicator');
    const now = Date.now();

    const threatIndicator: ThreatIndicator = {
      ...indicator,
      id,
      firstSeen: now,
      lastSeen: now,
    };

    this.threatIndicators.set(id, threatIndicator);
    this.updateStats();

    return threatIndicator;
  }

  /**
   * Add bot signature
   */
  addBotSignature(signature: Omit<BotSignature, 'id' | 'createdAt' | 'updatedAt'>): BotSignature {
    const id = this.generateId('bot-sig');
    const now = Date.now();

    const botSignature: BotSignature = {
      ...signature,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.botSignatures.set(id, botSignature);
    this.stats.botSignatures = this.botSignatures.size;

    return botSignature;
  }

  /**
   * Add attack pattern
   */
  addAttackPattern(pattern: Omit<AttackPattern, 'id' | 'createdAt' | 'updatedAt'>): AttackPattern {
    const id = this.generateId('attack-pattern');
    const now = Date.now();

    const attackPattern: AttackPattern = {
      ...pattern,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.attackPatterns.set(id, attackPattern);
    this.stats.attackPatterns = this.attackPatterns.size;

    return attackPattern;
  }

  /**
   * Update threat feed
   */
  async updateThreatFeed(feedId: string): Promise<boolean> {
    const feed = this.threatFeeds.get(feedId);
    if (!feed || !feed.isActive) {
      return false;
    }

    try {
      // In a real implementation, this would fetch from the feed URL
      // For now, we'll simulate an update
      feed.lastUpdated = Date.now();

      this.logThreatEvent('threat_feed_updated', {
        feedId,
        feedName: feed.name,
        indicatorCount: feed.indicators.length,
      });

      return true;
    } catch (error) {
      this.logThreatEvent('threat_feed_update_failed', {
        feedId,
        feedName: feed.name,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Get threat intelligence statistics
   */
  getStats(): ThreatIntelligenceStats {
    return { ...this.stats };
  }

  /**
   * Get all bot signatures
   */
  getBotSignatures(): BotSignature[] {
    return Array.from(this.botSignatures.values());
  }

  /**
   * Get all attack patterns
   */
  getAttackPatterns(): AttackPattern[] {
    return Array.from(this.attackPatterns.values());
  }

  /**
   * Get all threat feeds
   */
  getThreatFeeds(): ThreatFeed[] {
    return Array.from(this.threatFeeds.values());
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.ipReputationCache.clear();
    this.botSignatureCache.clear();
    this.attackPatternCache.clear();
    this.threatIndicatorCache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.totalIndicators = this.threatIndicators.size;

    // Count by type
    this.stats.indicatorsByType = {};
    this.threatIndicators.forEach(indicator => {
      this.stats.indicatorsByType[indicator.type] =
        (this.stats.indicatorsByType[indicator.type] || 0) + 1;
    });

    // Count by category
    this.stats.indicatorsByCategory = {};
    this.threatIndicators.forEach(indicator => {
      this.stats.indicatorsByCategory[indicator.category] =
        (this.stats.indicatorsByCategory[indicator.category] || 0) + 1;
    });

    // Count by threat level
    this.stats.indicatorsByThreatLevel = {};
    this.threatIndicators.forEach(indicator => {
      this.stats.indicatorsByThreatLevel[indicator.threatLevel] =
        (this.stats.indicatorsByThreatLevel[indicator.threatLevel] || 0) + 1;
    });

    this.stats.lastUpdate = Date.now();
  }

  /**
   * Log threat event
   */
  private logThreatEvent(action: string, metadata: Record<string, unknown>): void {
    if (!this.config.enableLogging) {
      return;
    }

    const event: SecurityEventDetails = {
      action,
      resource: 'threat_intelligence',
      reason: `Threat intelligence event: ${action}`,
      metadata,
    };

    this.securityLogger.logSecurityEvent(event);
  }
}
