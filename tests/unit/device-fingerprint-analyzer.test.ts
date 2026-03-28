/**
 * Device Fingerprint Analyzer Tests
 * Unit tests for device fingerprinting and bot detection
 */

import { DeviceFingerprintAnalyzer } from '../../src/security/device-fingerprint-analyzer';
import { CryptoService } from '../../src/security/crypto';
import { SecurityLogger } from '../../src/security/security-logger';

describe('DeviceFingerprintAnalyzer', () => {
  let analyzer: DeviceFingerprintAnalyzer;
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

    analyzer = new DeviceFingerprintAnalyzer(
      {
        enableCanvas: true,
        enableWebGL: true,
        enableAudio: true,
        enableFonts: true,
        cacheResults: false,
        logAnomalies: false
      },
      cryptoService,
      securityLogger
    );
  });

  describe('analyzeFingerprint', () => {
    it('should analyze complete fingerprint data', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          platform: 'Win32',
          language: 'en-US',
          languages: ['en-US', 'en'],
          cookieEnabled: true,
          doNotTrack: null,
          timezone: 'America/New_York',
          timezoneOffset: 300,
          screenResolution: '1920x1080',
          screenColorDepth: 24,
          pixelRatio: 1,
          touchSupport: false,
          plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
          mimeTypes: ['application/pdf']
        },
        canvas: {
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          hash: 'abc123',
          width: 200,
          height: 50
        },
        webgl: {
          vendor: 'Google Inc. (NVIDIA)',
          renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
          version: 'OpenGL ES 2.0 (ANGLE 2.1.0.0)',
          shadingLanguageVersion: 'OpenGL ES GLSL ES 1.00 (ANGLE 2.1.0.0)',
          extensions: ['ANGLE_instanced_arrays', 'EXT_blend_minmax'],
          maxTextureSize: 16384,
          maxViewportDims: [16384, 16384],
          hash: 'def456'
        },
        audio: {
          sampleRate: 44100,
          channelCount: 2,
          hash: 'ghi789'
        },
        fonts: {
          detectedFonts: ['Arial', 'Times New Roman', 'Courier New'],
          hash: 'jkl012'
        },
        hardware: {
          hardwareConcurrency: 8,
          deviceMemory: 8,
          maxTouchPoints: 0,
          platform: 'Win32'
        },
        network: {
          connectionType: 'wifi',
          downlink: 10,
          effectiveType: '4g',
          rtt: 50
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result).toBeDefined();
      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint.id).toMatch(/^fp_[a-f0-9]{16}$/);
      expect(result.fingerprint.hash).toBeDefined();
      expect(result.fingerprint.confidence).toBeGreaterThan(0);
      expect(result.fingerprint.timestamp).toBeGreaterThan(0);
      expect(result.isUnique).toBe(true);
      expect(result.similarityScore).toBe(1.0);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
      expect(result.anomalies).toEqual([]);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle minimal fingerprint data', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Linux'
        },
        hardware: {
          hardwareConcurrency: 4
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result).toBeDefined();
      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint.confidence).toBeGreaterThan(0);
    });

    it('should detect missing user agent anomaly', async () => {
      const data = {
        browser: {
          userAgent: 'unknown',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some(a => a.type === 'missing_component')).toBe(true);
      expect(result.anomalies.some(a => a.description.includes('User agent'))).toBe(true);
    });

    it('should detect headless browser pattern', async () => {
      const data = {
        browser: {
          userAgent: 'HeadlessChrome/91.0.4472.124',
          platform: 'Linux'
        },
        hardware: {
          hardwareConcurrency: 4
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.anomalies.some(a => a.type === 'known_bot_pattern')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(0.3);
    });

    it('should detect suspicious screen resolution', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          screenResolution: '0x0'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.anomalies.some(a => a.type === 'known_bot_pattern')).toBe(true);
    });

    it('should detect inconsistent timezone offset', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          timezoneOffset: 1000 // More than 12 hours
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.anomalies.some(a => a.type === 'inconsistent_data')).toBe(true);
    });

    it('should detect invalid screen resolution', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          screenResolution: '50x50' // Too small
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.anomalies.some(a => a.type === 'inconsistent_data')).toBe(true);
    });

    it('should calculate higher risk for multiple anomalies', async () => {
      const data = {
        browser: {
          userAgent: 'unknown',
          platform: 'Win32',
          screenResolution: '0x0',
          timezoneOffset: 1000
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.riskScore).toBeGreaterThan(0.5);
    });

    it('should cache results when enabled', async () => {
      const analyzerWithCache = new DeviceFingerprintAnalyzer(
        {
          cacheResults: true,
          cacheTTL: 300
        },
        cryptoService,
        securityLogger
      );

      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result1 = await analyzerWithCache.analyzeFingerprint(data);
      const result2 = await analyzerWithCache.analyzeFingerprint(data);

      expect(result1.fingerprint.hash).toEqual(result2.fingerprint.hash);
    });
  });

  describe('fingerprint components', () => {
    it('should normalize browser fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          language: 'en-US'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.browser.userAgent).toBe('Mozilla/5.0');
      expect(result.fingerprint.components.browser.platform).toBe('Win32');
      expect(result.fingerprint.components.browser.language).toBe('en-US');
    });

    it('should normalize canvas fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        canvas: {
          dataUrl: 'data:image/png;base64,test',
          hash: 'testhash',
          width: 200,
          height: 50
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.canvas.dataUrl).toBe('data:image/png;base64,test');
      expect(result.fingerprint.components.canvas.hash).toBe('testhash');
    });

    it('should normalize WebGL fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        webgl: {
          vendor: 'Google Inc.',
          renderer: 'ANGLE',
          version: 'OpenGL ES 2.0'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.webgl.vendor).toBe('Google Inc.');
      expect(result.fingerprint.components.webgl.renderer).toBe('ANGLE');
    });

    it('should normalize audio fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        audio: {
          sampleRate: 44100,
          channelCount: 2
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.audio.sampleRate).toBe(44100);
      expect(result.fingerprint.components.audio.channelCount).toBe(2);
    });

    it('should normalize font fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        fonts: {
          detectedFonts: ['Arial', 'Times New Roman']
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.fonts.detectedFonts).toEqual(['Arial', 'Times New Roman']);
    });

    it('should normalize hardware fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8,
          deviceMemory: 16,
          maxTouchPoints: 10,
          platform: 'Win32'
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.hardware.hardwareConcurrency).toBe(8);
      expect(result.fingerprint.components.hardware.deviceMemory).toBe(16);
      expect(result.fingerprint.components.hardware.maxTouchPoints).toBe(10);
    });

    it('should normalize network fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        },
        network: {
          connectionType: 'wifi',
          downlink: 10,
          effectiveType: '4g',
          rtt: 50
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.network.connectionType).toBe('wifi');
      expect(result.fingerprint.components.network.downlink).toBe(10);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate high confidence for complete data', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        canvas: {
          dataUrl: 'data:image/png;base64,test',
          hash: 'testhash'
        },
        webgl: {
          vendor: 'Google Inc.',
          renderer: 'ANGLE'
        },
        audio: {
          sampleRate: 44100,
          hash: 'audiohash'
        },
        fonts: {
          detectedFonts: ['Arial'],
          hash: 'fonthash'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.confidence).toBeGreaterThan(0.8);
    });

    it('should calculate low confidence for minimal data', async () => {
      const data = {
        browser: {
          userAgent: 'unknown',
          platform: 'unknown'
        },
        hardware: {
          hardwareConcurrency: 0
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.confidence).toBeLessThan(0.5);
    });
  });

  describe('uniqueness check', () => {
    it('should identify unique fingerprints', async () => {
      const data1 = {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows)',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const data2 = {
        browser: {
          userAgent: 'Mozilla/5.0 (Mac)',
          platform: 'MacIntel'
        },
        hardware: {
          hardwareConcurrency: 4
        }
      };

      const result1 = await analyzer.analyzeFingerprint(data1);
      const result2 = await analyzer.analyzeFingerprint(data2);

      expect(result1.isUnique).toBe(true);
      expect(result2.isUnique).toBe(true);
    });
  });

  describe('similarity score', () => {
    it('should calculate similarity between fingerprints', async () => {
      const analyzerWithCache = new DeviceFingerprintAnalyzer(
        {
          cacheResults: false,
          logAnomalies: false
        },
        cryptoService,
        securityLogger
      );

      const data1 = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          language: 'en-US',
          screenResolution: '1920x1080'
        },
        hardware: {
          hardwareConcurrency: 8,
          platform: 'Win32'
        }
      };

      const data2 = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32',
          language: 'en-US',
          screenResolution: '1920x1080'
        },
        hardware: {
          hardwareConcurrency: 8,
          platform: 'Win32'
        }
      };

      const result1 = await analyzerWithCache.analyzeFingerprint(data1);
      analyzerWithCache.registerFingerprint(result1.fingerprint);
      const result2 = await analyzerWithCache.analyzeFingerprint(data2);

      expect(result2.similarityScore).toBe(1.0);
    });
  });

  describe('risk score calculation', () => {
    it('should calculate low risk for normal fingerprint', async () => {
      const analyzerNoLog = new DeviceFingerprintAnalyzer(
        {
          enableCanvas: true,
          enableWebGL: true,
          enableAudio: true,
          enableFonts: true,
          cacheResults: false,
          logAnomalies: false
        },
        cryptoService,
        securityLogger
      );

      const data = {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          platform: 'Win32',
          screenResolution: '1920x1080',
          timezoneOffset: 300,
          plugins: ['Chrome PDF Plugin'],
          mimeTypes: ['application/pdf']
        },
        canvas: {
          dataUrl: 'data:image/png;base64,test',
          hash: 'testhash'
        },
        webgl: {
          vendor: 'Google Inc.',
          renderer: 'ANGLE'
        },
        audio: {
          sampleRate: 44100,
          channelCount: 2,
          hash: 'audiohash'
        },
        fonts: {
          detectedFonts: ['Arial', 'Times New Roman'],
          hash: 'fonthash'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzerNoLog.analyzeFingerprint(data);

      expect(result.riskScore).toBeLessThan(0.3);
    });

    it('should calculate high risk for suspicious fingerprint', async () => {
      const data = {
        browser: {
          userAgent: 'HeadlessChrome',
          platform: 'Linux',
          screenResolution: '0x0',
          timezoneOffset: 1000
        },
        hardware: {
          hardwareConcurrency: 4
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.riskScore).toBeGreaterThan(0.5);
    });
  });

  describe('registerFingerprint', () => {
    it('should register known fingerprint', () => {
      const fingerprint = {
        id: 'fp_test123',
        components: {
          browser: {
            userAgent: 'Mozilla/5.0',
            platform: 'Win32',
            language: 'en-US',
            languages: ['en-US'],
            cookieEnabled: true,
            doNotTrack: null,
            timezone: 'UTC',
            timezoneOffset: 0,
            screenResolution: '1920x1080',
            screenColorDepth: 24,
            pixelRatio: 1,
            touchSupport: false,
            plugins: [],
            mimeTypes: []
          },
          canvas: {
            dataUrl: '',
            hash: '',
            width: 0,
            height: 0
          },
          webgl: {
            vendor: 'unknown',
            renderer: 'unknown',
            version: 'unknown',
            shadingLanguageVersion: 'unknown',
            extensions: [],
            maxTextureSize: 0,
            maxViewportDims: [0, 0],
            hash: ''
          },
          audio: {
            sampleRate: 0,
            channelCount: 0,
            hash: ''
          },
          fonts: {
            detectedFonts: [],
            hash: ''
          },
          hardware: {
            hardwareConcurrency: 8,
            deviceMemory: undefined,
            maxTouchPoints: 0,
            platform: 'Win32'
          },
          network: {
            connectionType: undefined,
            downlink: undefined,
            effectiveType: undefined,
            rtt: undefined
          }
        },
        hash: 'testhash123',
        confidence: 0.8,
        timestamp: Date.now()
      };

      analyzer.registerFingerprint(fingerprint);

      const stats = analyzer.getStats();
      expect(stats.knownFingerprints).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old cache entries', async () => {
      const analyzerWithCache = new DeviceFingerprintAnalyzer(
        {
          cacheResults: true,
          cacheTTL: 1 // 1 second
        },
        cryptoService,
        securityLogger
      );

      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      await analyzerWithCache.analyzeFingerprint(data);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      analyzerWithCache.cleanup(1000);

      const stats = analyzerWithCache.getStats();
      expect(stats.cachedFingerprints).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      await analyzer.analyzeFingerprint(data);

      const stats = analyzer.getStats();

      expect(stats.cachedFingerprints).toBe(0);
      expect(stats.knownFingerprints).toBe(0);
      expect(stats.totalAnalyses).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty browser data', async () => {
      const data = {
        browser: {},
        hardware: {}
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result).toBeDefined();
      expect(result.fingerprint).toBeDefined();
    });

    it('should handle undefined optional components', async () => {
      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzer.analyzeFingerprint(data);

      expect(result.fingerprint.components.canvas.hash).toBe('');
      expect(result.fingerprint.components.webgl.vendor).toBe('unknown');
      expect(result.fingerprint.components.audio.hash).toBe('');
      expect(result.fingerprint.components.fonts.detectedFonts).toEqual([]);
    });

    it('should handle disabled components', async () => {
      const analyzerDisabled = new DeviceFingerprintAnalyzer(
        {
          enableCanvas: false,
          enableWebGL: false,
          enableAudio: false,
          enableFonts: false
        },
        cryptoService,
        securityLogger
      );

      const data = {
        browser: {
          userAgent: 'Mozilla/5.0',
          platform: 'Win32'
        },
        canvas: {
          dataUrl: 'data:image/png;base64,test',
          hash: 'testhash'
        },
        hardware: {
          hardwareConcurrency: 8
        }
      };

      const result = await analyzerDisabled.analyzeFingerprint(data);

      expect(result.fingerprint.components.canvas.hash).toBe('');
      expect(result.fingerprint.components.webgl.vendor).toBe('unknown');
    });
  });
});