/**
 * Device Fingerprint Analyzer Service
 * Analyzes device characteristics to create unique fingerprints for bot detection
 */

import * as crypto from 'crypto';
import { CryptoService } from './crypto';
import { SecurityLogger } from './security-logger';

export interface DeviceFingerprint {
  id: string;
  components: {
    browser: BrowserFingerprint;
    canvas: CanvasFingerprint;
    webgl: WebGLFingerprint;
    audio: AudioFingerprint;
    fonts: FontFingerprint;
    hardware: HardwareFingerprint;
    network: NetworkFingerprint;
  };
  hash: string;
  confidence: number;
  timestamp: number;
}

export interface BrowserFingerprint {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  cookieEnabled: boolean;
  doNotTrack: string | null;
  timezone: string;
  timezoneOffset: number;
  screenResolution: string;
  screenColorDepth: number;
  pixelRatio: number;
  touchSupport: boolean;
  plugins: string[];
  mimeTypes: string[];
}

export interface CanvasFingerprint {
  dataUrl: string;
  hash: string;
  width: number;
  height: number;
}

export interface WebGLFingerprint {
  vendor: string;
  renderer: string;
  version: string;
  shadingLanguageVersion: string;
  extensions: string[];
  maxTextureSize: number;
  maxViewportDims: number[];
  hash: string;
}

export interface AudioFingerprint {
  sampleRate: number;
  channelCount: number;
  hash: string;
}

export interface FontFingerprint {
  detectedFonts: string[];
  hash: string;
}

export interface HardwareFingerprint {
  hardwareConcurrency: number;
  deviceMemory: number | undefined;
  maxTouchPoints: number;
  platform: string;
}

export interface NetworkFingerprint {
  connectionType: string | undefined;
  downlink: number | undefined;
  effectiveType: string | undefined;
  rtt: number | undefined;
}

export interface FingerprintAnalysisResult {
  fingerprint: DeviceFingerprint;
  isUnique: boolean;
  similarityScore: number;
  riskScore: number;
  anomalies: FingerprintAnomaly[];
  timestamp: number;
  processingTime: number;
}

export interface FingerprintAnomaly {
  type: 'missing_component' | 'suspicious_value' | 'inconsistent_data' | 'known_bot_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, unknown>;
}

export interface FingerprintConfig {
  enableCanvas: boolean;
  enableWebGL: boolean;
  enableAudio: boolean;
  enableFonts: boolean;
  cacheResults: boolean;
  cacheTTL: number;
  logAnomalies: boolean;
}

export class DeviceFingerprintAnalyzer {
  private readonly config: FingerprintConfig;
  private readonly securityLogger: SecurityLogger;
  private readonly fingerprintCache: Map<string, FingerprintAnalysisResult> = new Map();
  private readonly knownFingerprints: Map<string, DeviceFingerprint> = new Map();

  constructor(
    config: Partial<FingerprintConfig>,
    _cryptoService: CryptoService,
    securityLogger: SecurityLogger
  ) {
    this.config = {
      enableCanvas: true,
      enableWebGL: true,
      enableAudio: true,
      enableFonts: true,
      cacheResults: true,
      cacheTTL: 3600,
      logAnomalies: true,
      ...config
    };

    this.securityLogger = securityLogger;
  }

  /**
   * Analyze device fingerprint from collected data
   */
  async analyzeFingerprint(data: {
    browser: Partial<BrowserFingerprint>;
    canvas?: Partial<CanvasFingerprint>;
    webgl?: Partial<WebGLFingerprint>;
    audio?: Partial<AudioFingerprint>;
    fonts?: Partial<FontFingerprint>;
    hardware: Partial<HardwareFingerprint>;
    network?: Partial<NetworkFingerprint>;
  }): Promise<FingerprintAnalysisResult> {
    const startTime = Date.now();

    // Build complete fingerprint
    const fingerprint = await this.buildFingerprint(data);

    // Check cache
    if (this.config.cacheResults) {
      const cached = this.fingerprintCache.get(fingerprint.hash);
      if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL * 1000) {
        return cached;
      }
    }

    // Analyze fingerprint
    const anomalies = this.detectAnomalies(fingerprint);
    const isUnique = this.checkUniqueness(fingerprint);
    const similarityScore = this.calculateSimilarityScore(fingerprint);
    const riskScore = this.calculateRiskScore(fingerprint, anomalies);

    const result: FingerprintAnalysisResult = {
      fingerprint,
      isUnique,
      similarityScore,
      riskScore,
      anomalies,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime
    };

    // Cache result
    if (this.config.cacheResults) {
      this.fingerprintCache.set(fingerprint.hash, result);
    }

    // Log anomalies
    if (this.config.logAnomalies && anomalies.length > 0) {
      this.securityLogger.logSecurityEvent({
        action: 'device_fingerprint_anomalies',
        resource: 'device_fingerprint_analyzer',
        reason: `Detected ${anomalies.length} anomalies`,
        metadata: {
          fingerprintId: fingerprint.id,
          anomalies,
          riskScore
        }
      });
    }

    return result;
  }

  /**
   * Build complete fingerprint from partial data
   */
  private async buildFingerprint(data: {
    browser: Partial<BrowserFingerprint>;
    canvas?: Partial<CanvasFingerprint>;
    webgl?: Partial<WebGLFingerprint>;
    audio?: Partial<AudioFingerprint>;
    fonts?: Partial<FontFingerprint>;
    hardware: Partial<HardwareFingerprint>;
    network?: Partial<NetworkFingerprint>;
  }): Promise<DeviceFingerprint> {
    const browser = this.normalizeBrowserFingerprint(data.browser);
    const canvas = this.config.enableCanvas ? this.normalizeCanvasFingerprint(data.canvas) : this.getEmptyCanvasFingerprint();
    const webgl = this.config.enableWebGL ? this.normalizeWebGLFingerprint(data.webgl) : this.getEmptyWebGLFingerprint();
    const audio = this.config.enableAudio ? this.normalizeAudioFingerprint(data.audio) : this.getEmptyAudioFingerprint();
    const fonts = this.config.enableFonts ? this.normalizeFontFingerprint(data.fonts) : this.getEmptyFontFingerprint();
    const hardware = this.normalizeHardwareFingerprint(data.hardware);
    const network = this.normalizeNetworkFingerprint(data.network);

    // Generate hash from all components
    const componentsString = JSON.stringify({
      browser,
      canvas: canvas.hash,
      webgl: webgl.hash,
      audio: audio.hash,
      fonts: fonts.hash,
      hardware,
      network
    });

    const hash = crypto.createHash('sha256').update(componentsString).digest('hex');
    const id = `fp_${hash.substring(0, 16)}`;

    return {
      id,
      components: {
        browser,
        canvas,
        webgl,
        audio,
        fonts,
        hardware,
        network
      },
      hash,
      confidence: this.calculateConfidence(browser, canvas, webgl, audio, fonts, hardware),
      timestamp: Date.now()
    };
  }

  /**
   * Normalize browser fingerprint data
   */
  private normalizeBrowserFingerprint(data: Partial<BrowserFingerprint>): BrowserFingerprint {
    return {
      userAgent: data.userAgent || 'unknown',
      platform: data.platform || 'unknown',
      language: data.language || 'en-US',
      languages: data.languages || ['en-US'],
      cookieEnabled: data.cookieEnabled ?? true,
      doNotTrack: data.doNotTrack ?? null,
      timezone: data.timezone || 'UTC',
      timezoneOffset: data.timezoneOffset ?? 0,
      screenResolution: data.screenResolution || '1920x1080',
      screenColorDepth: data.screenColorDepth ?? 24,
      pixelRatio: data.pixelRatio ?? 1,
      touchSupport: data.touchSupport ?? false,
      plugins: data.plugins || [],
      mimeTypes: data.mimeTypes || []
    };
  }

  /**
   * Normalize canvas fingerprint data
   */
  private normalizeCanvasFingerprint(data?: Partial<CanvasFingerprint>): CanvasFingerprint {
    if (!data || !data.dataUrl) {
      return this.getEmptyCanvasFingerprint();
    }

    return {
      dataUrl: data.dataUrl,
      hash: data.hash || this.generateHash(data.dataUrl),
      width: data.width ?? 200,
      height: data.height ?? 50
    };
  }

  /**
   * Normalize WebGL fingerprint data
   */
  private normalizeWebGLFingerprint(data?: Partial<WebGLFingerprint>): WebGLFingerprint {
    if (!data || !data.vendor) {
      return this.getEmptyWebGLFingerprint();
    }

    return {
      vendor: data.vendor,
      renderer: data.renderer || 'unknown',
      version: data.version || 'unknown',
      shadingLanguageVersion: data.shadingLanguageVersion || 'unknown',
      extensions: data.extensions || [],
      maxTextureSize: data.maxTextureSize ?? 0,
      maxViewportDims: data.maxViewportDims ?? [0, 0],
      hash: data.hash || this.generateHash(JSON.stringify(data))
    };
  }

  /**
   * Normalize audio fingerprint data
   */
  private normalizeAudioFingerprint(data?: Partial<AudioFingerprint>): AudioFingerprint {
    if (!data || !data.sampleRate) {
      return this.getEmptyAudioFingerprint();
    }

    return {
      sampleRate: data.sampleRate,
      channelCount: data.channelCount ?? 2,
      hash: data.hash || this.generateHash(JSON.stringify(data))
    };
  }

  /**
   * Normalize font fingerprint data
   */
  private normalizeFontFingerprint(data?: Partial<FontFingerprint>): FontFingerprint {
    if (!data || !data.detectedFonts) {
      return this.getEmptyFontFingerprint();
    }

    return {
      detectedFonts: data.detectedFonts,
      hash: data.hash || this.generateHash(JSON.stringify(data.detectedFonts))
    };
  }

  /**
   * Normalize hardware fingerprint data
   */
  private normalizeHardwareFingerprint(data: Partial<HardwareFingerprint>): HardwareFingerprint {
    return {
      hardwareConcurrency: data.hardwareConcurrency ?? 4,
      deviceMemory: data.deviceMemory,
      maxTouchPoints: data.maxTouchPoints ?? 0,
      platform: data.platform || 'unknown'
    };
  }

  /**
   * Normalize network fingerprint data
   */
  private normalizeNetworkFingerprint(data?: Partial<NetworkFingerprint>): NetworkFingerprint {
    return {
      connectionType: data?.connectionType,
      downlink: data?.downlink,
      effectiveType: data?.effectiveType,
      rtt: data?.rtt
    };
  }

  /**
   * Detect anomalies in fingerprint
   */
  private detectAnomalies(fingerprint: DeviceFingerprint): FingerprintAnomaly[] {
    const anomalies: FingerprintAnomaly[] = [];

    // Check for missing critical components
    if (fingerprint.components.browser.userAgent === 'unknown') {
      anomalies.push({
        type: 'missing_component',
        severity: 'high',
        description: 'User agent is missing or unknown',
        evidence: { userAgent: fingerprint.components.browser.userAgent }
      });
    }

    // Check for suspicious canvas fingerprint
    if (this.config.enableCanvas && fingerprint.components.canvas.hash === '') {
      anomalies.push({
        type: 'missing_component',
        severity: 'medium',
        description: 'Canvas fingerprint is empty',
        evidence: { canvasHash: fingerprint.components.canvas.hash }
      });
    }

    // Check for suspicious WebGL fingerprint
    if (this.config.enableWebGL && fingerprint.components.webgl.vendor === 'unknown') {
      anomalies.push({
        type: 'suspicious_value',
        severity: 'medium',
        description: 'WebGL vendor is unknown',
        evidence: { webglVendor: fingerprint.components.webgl.vendor }
      });
    }

    // Check for known bot patterns
    if (this.isKnownBotPattern(fingerprint)) {
      anomalies.push({
        type: 'known_bot_pattern',
        severity: 'critical',
        description: 'Fingerprint matches known bot pattern',
        evidence: { fingerprintId: fingerprint.id }
      });
    }

    // Check for inconsistent data
    if (this.hasInconsistentData(fingerprint)) {
      anomalies.push({
        type: 'inconsistent_data',
        severity: 'high',
        description: 'Fingerprint contains inconsistent data',
        evidence: { fingerprintId: fingerprint.id }
      });
    }

    return anomalies;
  }

  /**
   * Check if fingerprint is unique
   */
  private checkUniqueness(fingerprint: DeviceFingerprint): boolean {
    return !this.knownFingerprints.has(fingerprint.hash);
  }

  /**
   * Calculate similarity score with known fingerprints
   */
  private calculateSimilarityScore(fingerprint: DeviceFingerprint): number {
    if (this.knownFingerprints.size === 0) {
      return 1.0;
    }

    let maxSimilarity = 0;
    for (const [, knownFp] of this.knownFingerprints) {
      const similarity = this.compareFingerprints(fingerprint, knownFp);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Compare two fingerprints
   */
  private compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    let matches = 0;
    let total = 0;

    // Compare browser
    if (fp1.components.browser.platform === fp2.components.browser.platform) matches++;
    if (fp1.components.browser.language === fp2.components.browser.language) matches++;
    if (fp1.components.browser.screenResolution === fp2.components.browser.screenResolution) matches++;
    total += 3;

    // Compare hardware
    if (fp1.components.hardware.hardwareConcurrency === fp2.components.hardware.hardwareConcurrency) matches++;
    if (fp1.components.hardware.platform === fp2.components.hardware.platform) matches++;
    total += 2;

    // Compare canvas
    if (fp1.components.canvas.hash === fp2.components.canvas.hash) matches++;
    total++;

    // Compare WebGL
    if (fp1.components.webgl.hash === fp2.components.webgl.hash) matches++;
    total++;

    return total > 0 ? matches / total : 0;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(fingerprint: DeviceFingerprint, anomalies: FingerprintAnomaly[]): number {
    let riskScore = 0;

    // Base risk from anomalies
    for (const anomaly of anomalies) {
      switch (anomaly.severity) {
        case 'critical':
          riskScore += 0.4;
          break;
        case 'high':
          riskScore += 0.3;
          break;
        case 'medium':
          riskScore += 0.2;
          break;
        case 'low':
          riskScore += 0.1;
          break;
      }
    }

    // Risk from low confidence
    if (fingerprint.confidence < 0.5) {
      riskScore += 0.2;
    }

    // Risk from missing components
    if (fingerprint.components.canvas.hash === '') riskScore += 0.1;
    if (fingerprint.components.webgl.hash === '') riskScore += 0.1;
    if (fingerprint.components.audio.hash === '') riskScore += 0.05;

    return Math.min(1.0, riskScore);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    browser: BrowserFingerprint,
    canvas: CanvasFingerprint,
    webgl: WebGLFingerprint,
    audio: AudioFingerprint,
    fonts: FontFingerprint,
    hardware: HardwareFingerprint
  ): number {
    let confidence = 0;
    let components = 0;

    // Browser confidence
    if (browser.userAgent !== 'unknown') confidence += 0.2;
    if (browser.platform !== 'unknown') confidence += 0.1;
    components += 0.3;

    // Canvas confidence
    if (canvas.hash !== '') confidence += 0.2;
    components += 0.2;

    // WebGL confidence
    if (webgl.vendor !== 'unknown') confidence += 0.2;
    components += 0.2;

    // Audio confidence
    if (audio.hash !== '') confidence += 0.1;
    components += 0.1;

    // Fonts confidence
    if (fonts.detectedFonts.length > 0) confidence += 0.1;
    components += 0.1;

    // Hardware confidence
    if (hardware.hardwareConcurrency > 0) confidence += 0.1;
    components += 0.1;

    return components > 0 ? confidence / components : 0;
  }

  /**
   * Check for known bot patterns
   */
  private isKnownBotPattern(fingerprint: DeviceFingerprint): boolean {
    // Check for headless browser indicators
    if (fingerprint.components.browser.userAgent.includes('HeadlessChrome')) {
      return true;
    }

    // Check for automation tools
    if (fingerprint.components.browser.plugins.length === 0 &&
        fingerprint.components.browser.mimeTypes.length === 0) {
      return true;
    }

    // Check for suspicious screen resolution
    if (fingerprint.components.browser.screenResolution === '0x0' ||
        fingerprint.components.browser.screenResolution === '1x1') {
      return true;
    }

    return false;
  }

  /**
   * Check for inconsistent data
   */
  private hasInconsistentData(fingerprint: DeviceFingerprint): boolean {
    // Check timezone offset consistency
    const expectedOffset = fingerprint.components.browser.timezoneOffset;
    if (Math.abs(expectedOffset) > 720) { // More than 12 hours
      return true;
    }

    // Check screen resolution consistency
    const resolution = fingerprint.components.browser.screenResolution;
    const [width, height] = resolution.split('x').map(Number);
    if (width < 100 || height < 100 || width > 10000 || height > 10000) {
      return true;
    }

    return false;
  }

  /**
   * Generate hash from string
   */
  private generateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get empty canvas fingerprint
   */
  private getEmptyCanvasFingerprint(): CanvasFingerprint {
    return {
      dataUrl: '',
      hash: '',
      width: 0,
      height: 0
    };
  }

  /**
   * Get empty WebGL fingerprint
   */
  private getEmptyWebGLFingerprint(): WebGLFingerprint {
    return {
      vendor: 'unknown',
      renderer: 'unknown',
      version: 'unknown',
      shadingLanguageVersion: 'unknown',
      extensions: [],
      maxTextureSize: 0,
      maxViewportDims: [0, 0],
      hash: ''
    };
  }

  /**
   * Get empty audio fingerprint
   */
  private getEmptyAudioFingerprint(): AudioFingerprint {
    return {
      sampleRate: 0,
      channelCount: 0,
      hash: ''
    };
  }

  /**
   * Get empty font fingerprint
   */
  private getEmptyFontFingerprint(): FontFingerprint {
    return {
      detectedFonts: [],
      hash: ''
    };
  }

  /**
   * Register a known fingerprint
   */
  registerFingerprint(fingerprint: DeviceFingerprint): void {
    this.knownFingerprints.set(fingerprint.hash, fingerprint);
  }

  /**
   * Clear old cache entries
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();

    for (const [hash, result] of this.fingerprintCache.entries()) {
      if (now - result.timestamp > maxAge) {
        this.fingerprintCache.delete(hash);
      }
    }
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    cachedFingerprints: number;
    knownFingerprints: number;
    totalAnalyses: number;
  } {
    return {
      cachedFingerprints: this.fingerprintCache.size,
      knownFingerprints: this.knownFingerprints.size,
      totalAnalyses: this.fingerprintCache.size
    };
  }
}