/**
 * Keystroke Dynamics Analyzer Tests
 * Unit tests for keystroke tracking and bot detection
 */

import { KeystrokeDynamicsAnalyzer } from '../../src/security/keystroke-dynamics-analyzer';
import { CryptoService } from '../../src/security/crypto';
import { SecurityLogger } from '../../src/security/security-logger';
import { KeystrokeEvent } from '../../src/types/behavioral';

describe('KeystrokeDynamicsAnalyzer', () => {
  let analyzer: KeystrokeDynamicsAnalyzer;
  let cryptoService: CryptoService;
  let securityLogger: SecurityLogger;

  beforeEach(() => {
    cryptoService = new CryptoService();
    securityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: '/tmp/test.log',
      maxLogFileSize: 1024 * 1024,
      maxLogFiles: 5
    });

    analyzer = new KeystrokeDynamicsAnalyzer(
      {
        botScoreThreshold: 0.7,
        humanScoreThreshold: 0.3,
        anomalyThreshold: 0.5,
        cacheResults: false
      },
      cryptoService,
      securityLogger
    );
  });

  describe('analyzeKeystrokeEvents', () => {
    it('should return empty metrics for insufficient data', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics.averageHoldTime).toBe(0);
      expect(metrics.typingSpeed).toBe(0);
      expect(metrics.rhythmConsistency).toBe(0);
    });

    it('should calculate typing speed correctly', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1400, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      // 3 characters in 400ms = 450 CPM
      expect(metrics.typingSpeed).toBe(450);
    });

    it('should calculate hold times from duration', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, duration: 80, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1200, duration: 100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1400, duration: 120, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics.averageHoldTime).toBe(100);
    });

    it('should calculate rhythm consistency', () => {
      // Consistent rhythm (same intervals)
      const consistentEvents: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1400, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'd', code: 'KeyD', timestamp: 1600, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const consistentMetrics = analyzer.analyzeKeystrokeEvents(consistentEvents);
      expect(consistentMetrics.rhythmConsistency).toBe(1);

      // Inconsistent rhythm (varying intervals)
      const inconsistentEvents: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1400, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'd', code: 'KeyD', timestamp: 1500, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const inconsistentMetrics = analyzer.analyzeKeystrokeEvents(inconsistentEvents);
      expect(inconsistentMetrics.rhythmConsistency).toBeLessThan(1);
    });

    it('should calculate error rate', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'Backspace', code: 'Backspace', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1300, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics.errorRate).toBe(0.25); // 1 backspace out of 4 keys
    });
  });

  describe('detectAnomalies', () => {
    it('should detect perfect timing anomaly', () => {
      const events: KeystrokeEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          key: 'a',
          code: 'KeyA',
          timestamp: 1000 + i * 100,
          duration: 80,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some(a => a.type === 'perfect_timing')).toBe(true);
    });

    it('should detect no variation in rhythm', () => {
      const events: KeystrokeEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          key: String.fromCharCode(97 + (i % 26)),
          code: `Key${String.fromCharCode(65 + (i % 26))}`,
          timestamp: 1000 + i * 100,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      expect(result.anomalies.some(a => a.type === 'no_variation')).toBe(true);
    });

    it('should detect inhuman typing speed', () => {
      const events: KeystrokeEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push({
          key: String.fromCharCode(97 + (i % 26)),
          code: `Key${String.fromCharCode(65 + (i % 26))}`,
          timestamp: 1000 + i * 10, // Very fast: 100 keys per second
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      expect(result.anomalies.some(a => a.type === 'too_fast')).toBe(true);
    });

    it('should detect suspiciously slow typing', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 10000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }, // 9 second gap
        { key: 'c', code: 'KeyC', timestamp: 20000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } } // 10 second gap
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      // Very slow typing (6 CPM) should trigger too_slow anomaly
      expect(metrics.typingSpeed).toBeLessThan(10);
      expect(result.anomalies.some(a => a.type === 'too_slow')).toBe(true);
    });

    it('should detect repeated pattern', () => {
      const events: KeystrokeEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          key: 'a',
          code: 'KeyA',
          timestamp: 1000 + i * 100,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      expect(result.anomalies.some(a => a.type === 'repeated_pattern')).toBe(true);
    });

    it('should not detect anomalies for natural typing', () => {
      // Simulate natural human typing with variations
      const events: KeystrokeEvent[] = [
        { key: 'h', code: 'KeyH', timestamp: 1000, duration: 85, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'e', code: 'KeyE', timestamp: 1150, duration: 90, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 1320, duration: 75, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 1480, duration: 95, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'o', code: 'KeyO', timestamp: 1650, duration: 80, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: ' ', code: 'Space', timestamp: 1850, duration: 120, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'w', code: 'KeyW', timestamp: 2050, duration: 88, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'o', code: 'KeyO', timestamp: 2220, duration: 82, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'r', code: 'KeyR', timestamp: 2380, duration: 78, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 2540, duration: 92, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'd', code: 'KeyD', timestamp: 2700, duration: 85, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);
      const result = analyzer.detectAnomalies(metrics);

      // Natural typing should have lower anomaly score
      expect(result.anomalyScore).toBeLessThan(0.5);
      expect(result.humanLikelihood).toBeGreaterThan(0.5);
    });
  });

  describe('performBotDetection', () => {
    it('should detect bot-like behavior', async () => {
      analyzer.createSession('test-session-1');

      // Simulate bot-like typing (perfectly regular intervals)
      const botEvents: KeystrokeEvent[] = [];
      for (let i = 0; i < 50; i++) {
        botEvents.push({
          key: String.fromCharCode(97 + (i % 26)),
          code: `Key${String.fromCharCode(65 + (i % 26))}`,
          timestamp: 1000 + i * 100,
          duration: 80,
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      analyzer.updateSession('test-session-1', botEvents);
      const result = await analyzer.endSession('test-session-1');

      expect(result).not.toBeNull();
      // Bot-like behavior should have elevated bot score (close to or above threshold)
      expect(result!.botScore).toBeGreaterThan(0.4);
      expect(['bot', 'suspicious']).toContain(result!.verdict);
    });

    it('should detect human-like behavior', async () => {
      analyzer.createSession('test-session-2');

      // Simulate human-like typing with natural variations
      const humanEvents: KeystrokeEvent[] = [
        { key: 'h', code: 'KeyH', timestamp: 1000, duration: 85, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'e', code: 'KeyE', timestamp: 1180, duration: 90, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 1350, duration: 75, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 1520, duration: 95, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'o', code: 'KeyO', timestamp: 1700, duration: 80, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: ' ', code: 'Space', timestamp: 1900, duration: 120, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'w', code: 'KeyW', timestamp: 2120, duration: 88, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'o', code: 'KeyO', timestamp: 2280, duration: 82, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'r', code: 'KeyR', timestamp: 2450, duration: 78, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'l', code: 'KeyL', timestamp: 2620, duration: 92, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'd', code: 'KeyD', timestamp: 2780, duration: 85, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      analyzer.updateSession('test-session-2', humanEvents);
      const result = await analyzer.endSession('test-session-2');

      expect(result).not.toBeNull();
      expect(result!.botScore).toBeLessThan(0.7);
      expect(['human', 'uncertain', 'suspicious']).toContain(result!.verdict);
    });

    it('should cache results when enabled', async () => {
      const analyzerWithCache = new KeystrokeDynamicsAnalyzer(
        {
          cacheResults: true,
          cacheTTL: 300
        },
        cryptoService,
        securityLogger
      );

      analyzerWithCache.createSession('cached-session');
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      analyzerWithCache.updateSession('cached-session', events);
      
      // First call
      const result1 = await analyzerWithCache.endSession('cached-session');
      
      // Second call should return cached result
      const result2 = await analyzerWithCache.endSession('cached-session');

      expect(result1).toEqual(result2);
    });
  });

  describe('session management', () => {
    it('should create session correctly', () => {
      const session = analyzer.createSession('test-session');

      expect(session.sessionId).toBe('test-session');
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.dataPoints).toEqual([]);
      expect(session.keystrokePattern.events).toEqual([]);
    });

    it('should update session with keystroke events', () => {
      analyzer.createSession('test-session');

      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      analyzer.updateSession('test-session', events);

      const session = analyzer.getSession('test-session');
      expect(session).toBeDefined();
      expect(session!.keystrokePattern.events.length).toBe(2);
    });

    it('should return undefined for non-existent session', () => {
      const session = analyzer.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('should cleanup old sessions', () => {
      analyzer.createSession('old-session');
      analyzer.createSession('new-session');

      // Mock old session start time
      const oldSession = analyzer.getSession('old-session');
      if (oldSession) {
        oldSession.startTime = Date.now() - 4000000; // More than 1 hour ago
      }

      analyzer.cleanup(3600000); // 1 hour max age

      expect(analyzer.getSession('old-session')).toBeUndefined();
      expect(analyzer.getSession('new-session')).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      analyzer.createSession('session-1');
      analyzer.createSession('session-2');

      const stats = analyzer.getStats();

      expect(stats.activeSessions).toBe(2);
      expect(stats.cachedResults).toBe(0);
      expect(stats.totalAnalyses).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle events with same timestamp', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      // Should not throw error
      expect(metrics).toBeDefined();
    });

    it('should handle very fast typing', () => {
      const events: KeystrokeEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push({
          key: String.fromCharCode(97 + (i % 26)),
          code: `Key${String.fromCharCode(65 + (i % 26))}`,
          timestamp: 1000 + i * 5, // 200 keys per second
          modifiers: { shift: false, ctrl: false, alt: false, meta: false }
        });
      }

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      // 200 keys per second = 12000 CPM (approximately)
      expect(metrics.typingSpeed).toBeGreaterThan(11000);
      expect(metrics.typingSpeed).toBeLessThan(13000);
    });

    it('should handle zero duration events', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, duration: 0, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1100, duration: 0, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics.averageHoldTime).toBe(0);
    });

    it('should handle modifier keys correctly', () => {
      const events: KeystrokeEvent[] = [
        { key: 'Shift', code: 'ShiftLeft', timestamp: 1000, modifiers: { shift: true, ctrl: false, alt: false, meta: false } },
        { key: 'A', code: 'KeyA', timestamp: 1100, modifiers: { shift: true, ctrl: false, alt: false, meta: false } },
        { key: 'Shift', code: 'ShiftLeft', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics).toBeDefined();
      expect(metrics.typingSpeed).toBeGreaterThan(0);
    });

    it('should handle backspace and delete keys', () => {
      const events: KeystrokeEvent[] = [
        { key: 'a', code: 'KeyA', timestamp: 1000, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'b', code: 'KeyB', timestamp: 1100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'Backspace', code: 'Backspace', timestamp: 1200, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'c', code: 'KeyC', timestamp: 1300, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
        { key: 'Delete', code: 'Delete', timestamp: 1400, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
      ];

      const metrics = analyzer.analyzeKeystrokeEvents(events);

      expect(metrics.errorRate).toBe(0.4); // 2 error keys out of 5
    });
  });

  describe('analyzeKeystrokePattern', () => {
    it('should analyze keystroke pattern correctly', () => {
      const pattern = {
        sessionId: 'test-session',
        events: [
          { key: 'a', code: 'KeyA', timestamp: 1000, duration: 80, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
          { key: 'b', code: 'KeyB', timestamp: 1200, duration: 90, modifiers: { shift: false, ctrl: false, alt: false, meta: false } },
          { key: 'c', code: 'KeyC', timestamp: 1400, duration: 100, modifiers: { shift: false, ctrl: false, alt: false, meta: false } }
        ],
        averageHoldTime: 0,
        averageFlightTime: 0,
        typingSpeed: 0,
        errorRate: 0,
        rhythm: []
      };

      const metrics = analyzer.analyzeKeystrokePattern(pattern);

      expect(metrics.averageHoldTime).toBe(90);
      // 3 chars in 400ms = (3/400)*60000 = 450 CPM
      expect(metrics.typingSpeed).toBe(450);
    });
  });
});