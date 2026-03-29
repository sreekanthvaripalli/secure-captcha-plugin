/**
 * GDPR Compliance Service Tests
 * Comprehensive test suite for GDPR compliance features
 */

import {
  GDPRComplianceService,
  GDPRConfig,
  defaultGDPRConfig,
  getGDPRComplianceService,
  resetGDPRComplianceService,
} from '../../src/security/gdpr-compliance';
import { AuditLogger, AuditLoggerConfig } from '../../src/security/audit-logger';
import { SecurityLogger } from '../../src/security/security-logger';
import { ELKLogger } from '../../src/services/elk-logger';

// Mock dependencies
jest.mock('../../src/services/elk-logger');
jest.mock('../../src/security/security-logger');

describe('GDPRComplianceService', () => {
  let gdprService: GDPRComplianceService;
  let auditLogger: AuditLogger;
  let securityLogger: SecurityLogger;
  let elkLogger: ELKLogger;

  const mockAuditLoggerConfig: AuditLoggerConfig = {
    enableIntegrityChain: true,
    enableEncryption: false,
    retentionPolicy: {
      retentionDays: 365,
      archiveBeforeDelete: true,
    },
    complianceStandards: ['GDPR', 'SOC2'],
    enableRealTimeAlerts: false,
    alertThresholds: {
      criticalEventsPerHour: 5,
      failedAuthenticationsPerHour: 20,
      suspiciousActivitiesPerHour: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetGDPRComplianceService();

    elkLogger = new ELKLogger({
      elasticsearch: {
        node: 'http://localhost:9200',
        index: 'test-logs',
        indexPrefix: 'test',
        indexSuffixPattern: 'YYYY.MM.DD',
      },
      logLevel: 'info',
      enableConsole: false,
      enableFile: false,
      enableElasticsearch: false,
    });
    securityLogger = new SecurityLogger({
      level: 'info',
      enableFileLogging: false,
      logFilePath: './logs/test.log',
      maxLogFileSize: 10 * 1024 * 1024,
      maxLogFiles: 5,
    });
    auditLogger = new AuditLogger(mockAuditLoggerConfig, elkLogger, securityLogger);

    gdprService = new GDPRComplianceService(defaultGDPRConfig, auditLogger, securityLogger);
  });

  describe('Consent Management', () => {
    describe('recordConsent', () => {
      it('should record consent successfully', async () => {
        const consent = await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        expect(consent).toBeDefined();
        expect(consent.id).toMatch(/^consent_/);
        expect(consent.dataSubjectId).toBe('user-123');
        expect(consent.purpose).toBe('analytics');
        expect(consent.status).toBe('granted');
        expect(consent.grantedAt).toBeDefined();
        expect(consent.expiresAt).toBeDefined();
        expect(consent.metadata.consentMethod).toBe('explicit');
        expect(consent.metadata.legalBasis).toBe('consent');
      });

      it('should set expiration date based on config', async () => {
        const beforeTime = Date.now();
        const consent = await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });
        const afterTime = Date.now();

        const expectedExpiry =
          beforeTime + defaultGDPRConfig.consentExpirationDays * 24 * 60 * 60 * 1000;
        const actualExpiry = consent.expiresAt!.getTime();

        expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
        expect(actualExpiry).toBeLessThanOrEqual(
          afterTime + defaultGDPRConfig.consentExpirationDays * 24 * 60 * 60 * 1000 + 1000
        );
      });

      it('should not set expiration for denied consent', async () => {
        const consent = await gdprService.recordConsent('user-123', 'analytics', 'denied', {
          consentMethod: 'opt-out',
          legalBasis: 'consent',
        });

        expect(consent.status).toBe('denied');
        expect(consent.expiresAt).toBeUndefined();
        expect(consent.grantedAt).toBeUndefined();
      });

      it('should log audit event for consent recording', async () => {
        const logComplianceEventSpy = jest.spyOn(auditLogger, 'logComplianceEvent');

        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        expect(logComplianceEventSpy).toHaveBeenCalledWith(
          'consent_granted',
          'GDPR',
          expect.objectContaining({
            userId: 'user-123',
          }),
          'success',
          expect.objectContaining({
            purpose: 'analytics',
            status: 'granted',
          })
        );
      });
    });

    describe('withdrawConsent', () => {
      it('should withdraw consent successfully', async () => {
        const consent = await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const withdrawnConsent = await gdprService.withdrawConsent(consent.id, {
          ipAddress: '192.168.1.1',
        });

        expect(withdrawnConsent).toBeDefined();
        expect(withdrawnConsent!.status).toBe('withdrawn');
        expect(withdrawnConsent!.withdrawnAt).toBeDefined();
      });

      it('should return null for non-existent consent', async () => {
        const result = await gdprService.withdrawConsent('non-existent', {});
        expect(result).toBeNull();
      });

      it('should log audit event for consent withdrawal', async () => {
        const logComplianceEventSpy = jest.spyOn(auditLogger, 'logComplianceEvent');

        const consent = await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.withdrawConsent(consent.id, {});

        expect(logComplianceEventSpy).toHaveBeenCalledWith(
          'consent_withdrawn',
          'GDPR',
          expect.objectContaining({
            userId: 'user-123',
          }),
          'success',
          expect.objectContaining({
            consentId: consent.id,
          })
        );
      });
    });

    describe('getConsentRecords', () => {
      it('should return all consent records for a data subject', async () => {
        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-123', 'marketing', 'denied', {
          consentMethod: 'opt-out',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-456', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const user123Consents = gdprService.getConsentRecords('user-123');
        expect(user123Consents).toHaveLength(2);
        expect(user123Consents.every(c => c.dataSubjectId === 'user-123')).toBe(true);
      });

      it('should return empty array for non-existent user', () => {
        const consents = gdprService.getConsentRecords('non-existent');
        expect(consents).toHaveLength(0);
      });
    });

    describe('hasValidConsent', () => {
      it('should return true for valid consent', async () => {
        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const hasConsent = gdprService.hasValidConsent('user-123', 'analytics');
        expect(hasConsent).toBe(true);
      });

      it('should return false for denied consent', async () => {
        await gdprService.recordConsent('user-123', 'analytics', 'denied', {
          consentMethod: 'opt-out',
          legalBasis: 'consent',
        });

        const hasConsent = gdprService.hasValidConsent('user-123', 'analytics');
        expect(hasConsent).toBe(false);
      });

      it('should return false for withdrawn consent', async () => {
        const consent = await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.withdrawConsent(consent.id, {});

        const hasConsent = gdprService.hasValidConsent('user-123', 'analytics');
        expect(hasConsent).toBe(false);
      });

      it('should return false for different purpose', async () => {
        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const hasConsent = gdprService.hasValidConsent('user-123', 'marketing');
        expect(hasConsent).toBe(false);
      });
    });
  });

  describe('Data Subject Rights', () => {
    describe('submitDataSubjectRequest', () => {
      it('should submit access request successfully', async () => {
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'access',
          { format: 'json' },
          { ipAddress: '192.168.1.1' }
        );

        expect(request).toBeDefined();
        expect(request.id).toMatch(/^dsr_/);
        expect(request.dataSubjectId).toBe('user-123');
        expect(request.rightType).toBe('access');
        expect(request.status).toBe('pending');
        expect(request.deadline).toBeDefined();
        expect(request.details.format).toBe('json');
      });

      it('should set deadline based on config', async () => {
        const beforeTime = Date.now();
        const request = await gdprService.submitDataSubjectRequest('user-123', 'erasure', {}, {});
        const afterTime = Date.now();

        const expectedDeadline =
          beforeTime + defaultGDPRConfig.requestDeadlineDays * 24 * 60 * 60 * 1000;
        const actualDeadline = request.deadline.getTime();

        expect(actualDeadline).toBeGreaterThanOrEqual(expectedDeadline - 1000);
        expect(actualDeadline).toBeLessThanOrEqual(
          afterTime + defaultGDPRConfig.requestDeadlineDays * 24 * 60 * 60 * 1000 + 1000
        );
      });

      it('should auto-verify if verification not required', async () => {
        const config: GDPRConfig = {
          ...defaultGDPRConfig,
          dataSubjectVerificationRequired: false,
        };

        const service = new GDPRComplianceService(config, auditLogger, securityLogger);

        const request = await service.submitDataSubjectRequest('user-123', 'access', {}, {});

        expect(request.verification.verified).toBe(true);
      });

      it('should require verification if configured', async () => {
        const request = await gdprService.submitDataSubjectRequest('user-123', 'access', {}, {});

        expect(request.verification.verified).toBe(false);
      });
    });

    describe('verifyDataSubject', () => {
      it('should verify data subject successfully', async () => {
        const request = await gdprService.submitDataSubjectRequest('user-123', 'access', {}, {});

        const verified = await gdprService.verifyDataSubject(request.id, 'email_verification');

        expect(verified).toBe(true);

        const updatedRequest = gdprService.getDataSubjectRequests('user-123')[0];
        expect(updatedRequest.verification.verified).toBe(true);
        expect(updatedRequest.verification.verificationMethod).toBe('email_verification');
        expect(updatedRequest.status).toBe('processing');
      });

      it('should return false for non-existent request', async () => {
        const verified = await gdprService.verifyDataSubject('non-existent', 'email');
        expect(verified).toBe(false);
      });
    });

    describe('processDataAccessRequest', () => {
      it('should export personal data in JSON format', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store some personal data
        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John Doe', email: 'john@example.com' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        // Submit and verify access request
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'access',
          { format: 'json' },
          {}
        );

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process access request
        const dataExport = await gdprService.processDataAccessRequest(request.id, 'json');

        expect(dataExport).toBeDefined();
        expect(dataExport!.dataSubjectId).toBe('user-123');
        expect(dataExport!.format).toBe('json');
        expect(dataExport!.data.personalData).toHaveLength(1);
        expect(dataExport!.data.consentRecords).toHaveLength(1);
        expect(dataExport!.metadata.signature).toBeDefined();
      });

      it('should throw error if not verified', async () => {
        const request = await gdprService.submitDataSubjectRequest('user-123', 'access', {}, {});

        await expect(gdprService.processDataAccessRequest(request.id)).rejects.toThrow(
          'Data subject identity must be verified'
        );
      });

      it('should return null for wrong request type', async () => {
        const request = await gdprService.submitDataSubjectRequest('user-123', 'erasure', {}, {});

        await gdprService.verifyDataSubject(request.id, 'email');

        const result = await gdprService.processDataAccessRequest(request.id);
        expect(result).toBeNull();
      });
    });

    describe('processDataErasureRequest', () => {
      it('should delete personal data', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store personal data
        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John Doe' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        // Submit and verify erasure request
        const request = await gdprService.submitDataSubjectRequest('user-123', 'erasure', {}, {});

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process erasure request
        const result = await gdprService.processDataErasureRequest(request.id);

        expect(result.deletedRecords).toBe(0); // Anonymization is enabled by default
        expect(result.anonymizedRecords).toBe(1);

        // Verify data is anonymized
        const records = gdprService.getPersonalDataRecords('user-123');
        expect(records).toHaveLength(1);
        expect(records[0].metadata.anonymized).toBe(true);
      });

      it('should delete specific data types only', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store multiple data types
        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        await gdprService.storePersonalData(
          'user-123',
          'analytics',
          { clicks: 10 },
          'analytics',
          'legitimate_interest',
          { source: 'tracking' }
        );

        // Submit erasure request for specific data
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'erasure',
          { specificData: ['profile'] },
          {}
        );

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process erasure request
        await gdprService.processDataErasureRequest(request.id, ['profile']);

        // Verify only profile data was anonymized
        const records = gdprService.getPersonalDataRecords('user-123');
        const profileRecord = records.find(r => r.dataType === 'profile');
        const analyticsRecord = records.find(r => r.dataType === 'analytics');

        expect(profileRecord?.metadata.anonymized).toBe(true);
        expect(analyticsRecord?.metadata.anonymized).toBe(false);
      });

      it('should withdraw all consents on erasure', async () => {
        // Record consents
        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-123', 'marketing', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Submit and verify erasure request
        const request = await gdprService.submitDataSubjectRequest('user-123', 'erasure', {}, {});

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process erasure request
        await gdprService.processDataErasureRequest(request.id);

        // Verify consents are withdrawn
        const consents = gdprService.getConsentRecords('user-123');
        expect(consents.every(c => c.status === 'withdrawn')).toBe(true);
      });
    });

    describe('processDataRectificationRequest', () => {
      it('should update personal data', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store personal data
        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John Doe', email: 'john@example.com' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        // Submit and verify rectification request
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'rectification',
          {},
          {}
        );

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process rectification request
        const updatedRecord = await gdprService.processDataRectificationRequest(
          request.id,
          'profile',
          { name: 'Jane Doe', email: 'jane@example.com' }
        );

        expect(updatedRecord).toBeDefined();
        expect(updatedRecord!.data.name).toBe('Jane Doe');
        expect(updatedRecord!.data.email).toBe('jane@example.com');
      });

      it('should return null for non-existent data type', async () => {
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'rectification',
          {},
          {}
        );

        await gdprService.verifyDataSubject(request.id, 'email');

        const result = await gdprService.processDataRectificationRequest(
          request.id,
          'non-existent',
          {}
        );

        expect(result).toBeNull();
      });
    });

    describe('processDataPortabilityRequest', () => {
      it('should export data in portable format', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store personal data
        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        // Submit and verify portability request
        const request = await gdprService.submitDataSubjectRequest(
          'user-123',
          'portability',
          { format: 'csv' },
          {}
        );

        await gdprService.verifyDataSubject(request.id, 'email');

        // Process portability request
        const dataExport = await gdprService.processDataPortabilityRequest(request.id, 'csv');

        expect(dataExport).toBeDefined();
        expect(dataExport!.format).toBe('csv');
      });
    });
  });

  describe('Data Management', () => {
    describe('storePersonalData', () => {
      it('should store personal data with GDPR compliance', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const record = await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John', email: 'john@example.com' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        expect(record).toBeDefined();
        expect(record.id).toMatch(/^data_/);
        expect(record.dataSubjectId).toBe('user-123');
        expect(record.dataType).toBe('profile');
        expect(record.purpose).toBe('authentication');
        expect(record.legalBasis).toBe('consent');
        expect(record.metadata.source).toBe('registration');
      });

      it('should apply data minimization', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const record = await gdprService.storePersonalData(
          'user-123',
          'profile',
          {
            userId: 'user-123',
            sessionId: 'sess-123',
            name: 'John',
            email: 'john@example.com',
            extraField: 'should be removed',
          },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        // Data minimization should keep only required fields for authentication
        expect(record.data.userId).toBe('user-123');
        expect(record.data.sessionId).toBe('sess-123');
      });

      it('should set retention period', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const record = await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration', retentionPeriod: 90 }
        );

        expect(record.retentionPeriod).toBe(90);
        expect(record.expiresAt).toBeDefined();

        const expectedExpiry = new Date(record.collectedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
        expect(record.expiresAt!.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
      });

      it('should throw error if consent required but not obtained', async () => {
        await expect(
          gdprService.storePersonalData(
            'user-123',
            'profile',
            { name: 'John' },
            'marketing',
            'consent',
            { source: 'registration' }
          )
        ).rejects.toThrow('Valid consent required');
      });

      it('should allow storage with legitimate interest', async () => {
        const record = await gdprService.storePersonalData(
          'user-123',
          'security',
          { ipAddress: '192.168.1.1' },
          'security',
          'legitimate_interest',
          { source: 'server_logs' }
        );

        expect(record).toBeDefined();
        expect(record.legalBasis).toBe('legitimate_interest');
      });
    });

    describe('getPersonalDataRecords', () => {
      it('should return all records for a data subject', async () => {
        // Record consent first
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-456', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        await gdprService.storePersonalData(
          'user-123',
          'analytics',
          { clicks: 10 },
          'analytics',
          'legitimate_interest',
          { source: 'tracking' }
        );

        await gdprService.storePersonalData(
          'user-456',
          'profile',
          { name: 'Jane' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        const user123Records = gdprService.getPersonalDataRecords('user-123');
        expect(user123Records).toHaveLength(2);
        expect(user123Records.every(r => r.dataSubjectId === 'user-123')).toBe(true);
      });
    });
  });

  describe('Privacy by Design', () => {
    describe('createPrivacyImpactAssessment', () => {
      it('should create privacy impact assessment', async () => {
        const assessment = await gdprService.createPrivacyImpactAssessment(
          'User Analytics',
          'Collect and analyze user behavior data',
          ['clicks', 'page_views', 'session_duration'],
          ['analytics', 'product_improvement'],
          'legitimate_interest'
        );

        expect(assessment).toBeDefined();
        expect(assessment.id).toMatch(/^pia_/);
        expect(assessment.processingActivity).toBe('User Analytics');
        expect(assessment.dataTypes).toContain('clicks');
        expect(assessment.purposes).toContain('analytics');
        expect(assessment.riskAssessment).toBeDefined();
        expect(assessment.dataSubjectRights).toContain('access');
      });
    });

    describe('pseudonymizeData', () => {
      it('should pseudonymize identifiers', () => {
        const data = {
          userId: 'user-123',
          email: 'john@example.com',
          name: 'John Doe',
          clicks: 10,
        };

        const pseudonymized = gdprService.pseudonymizeData(data, 'salt-123');

        expect(pseudonymized.userId).not.toBe('user-123');
        expect(pseudonymized.userId).toMatch(/^[a-f0-9]{16}$/);
        expect(pseudonymized.email).not.toBe('john@example.com');
        expect(pseudonymized.email).toMatch(/^[a-f0-9]{16}$/);
        expect(pseudonymized.name).toBe('John Doe'); // Non-identifier preserved
        expect(pseudonymized.clicks).toBe(10); // Non-identifier preserved
      });

      it('should produce consistent results with same salt', () => {
        const data = { userId: 'user-123', email: 'john@example.com' };

        const result1 = gdprService.pseudonymizeData(data, 'salt-123');
        const result2 = gdprService.pseudonymizeData(data, 'salt-123');

        expect(result1.userId).toBe(result2.userId);
        expect(result1.email).toBe(result2.email);
      });

      it('should produce different results with different salts', () => {
        const data = { userId: 'user-123' };

        const result1 = gdprService.pseudonymizeData(data, 'salt-123');
        const result2 = gdprService.pseudonymizeData(data, 'salt-456');

        expect(result1.userId).not.toBe(result2.userId);
      });
    });
  });

  describe('Data Retention', () => {
    describe('applyRetentionPolicy', () => {
      it('should delete expired records', async () => {
        // Create service with short retention period
        const shortRetentionConfig: GDPRConfig = {
          ...defaultGDPRConfig,
          dataRetentionDays: 0, // Immediate expiration
        };

        const service = new GDPRComplianceService(
          shortRetentionConfig,
          auditLogger,
          securityLogger
        );

        // Record consent first
        await service.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store data that will expire immediately
        const record = await service.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration', retentionPeriod: 0 }
        );

        // Manually set the expiration to the past to ensure it's expired
        record.expiresAt = new Date(Date.now() - 1000);

        // Apply retention policy
        const result = await service.applyRetentionPolicy();

        expect(result.deletedRecords).toBe(1);
      });

      it('should mark expired consents as denied', async () => {
        // Create service with short consent expiration
        const shortConsentConfig: GDPRConfig = {
          ...defaultGDPRConfig,
          consentExpirationDays: 0,
        };

        const service = new GDPRComplianceService(shortConsentConfig, auditLogger, securityLogger);

        // Record consent that will expire immediately
        const consent = await service.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Manually set the expiration to the past to ensure it's expired
        consent.expiresAt = new Date(Date.now() - 1000);

        // Apply retention policy
        const result = await service.applyRetentionPolicy();

        expect(result.expiredConsents).toBe(1);

        // Verify consent is now denied
        const consents = service.getConsentRecords('user-123');
        expect(consents[0].status).toBe('denied');
      });
    });
  });

  describe('Compliance Reporting', () => {
    describe('generateComplianceReport', () => {
      it('should generate comprehensive compliance report', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        // Add some test data
        await gdprService.recordConsent('user-123', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.submitDataSubjectRequest('user-123', 'access', {}, {});

        // Record consent for authentication before storing data
        await gdprService.recordConsent('user-123', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.storePersonalData(
          'user-123',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        const report = await gdprService.generateComplianceReport(startDate, endDate);

        expect(report).toBeDefined();
        expect(report.period.startDate).toEqual(startDate);
        expect(report.period.endDate).toEqual(endDate);
        expect(report.consentStatistics).toBeDefined();
        expect(report.dataSubjectRequests).toBeDefined();
        expect(report.dataRetention).toBeDefined();
        expect(report.complianceStatus).toBeDefined();
      });

      it('should calculate consent statistics correctly', async () => {
        const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endDate = new Date(Date.now() + 1000); // Add 1 second to ensure all consents are included

        await gdprService.recordConsent('user-1', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-2', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        const consent3 = await gdprService.recordConsent('user-3', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.withdrawConsent(consent3.id, {});

        await gdprService.recordConsent('user-4', 'analytics', 'denied', {
          consentMethod: 'opt-out',
          legalBasis: 'consent',
        });

        const report = await gdprService.generateComplianceReport(startDate, endDate);

        expect(report.consentStatistics.totalConsents).toBe(4);
        expect(report.consentStatistics.grantedConsents).toBe(2); // user-1 and user-2 are granted
        expect(report.consentStatistics.withdrawnConsents).toBe(1); // user-3 is withdrawn
      });

      it('should calculate data subject request statistics', async () => {
        const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endDate = new Date();

        // Record consent for user-1 before submitting access request
        await gdprService.recordConsent('user-1', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        // Store personal data for user-1
        await gdprService.storePersonalData(
          'user-1',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        const req1 = await gdprService.submitDataSubjectRequest('user-1', 'access', {}, {});
        await gdprService.verifyDataSubject(req1.id, 'email');
        await gdprService.processDataAccessRequest(req1.id);

        await gdprService.submitDataSubjectRequest('user-2', 'erasure', {}, {});

        await gdprService.submitDataSubjectRequest('user-3', 'portability', {}, {});

        const report = await gdprService.generateComplianceReport(startDate, endDate);

        expect(report.dataSubjectRequests.total).toBe(3);
        expect(report.dataSubjectRequests.byType.access).toBe(1);
        expect(report.dataSubjectRequests.byType.erasure).toBe(1);
        expect(report.dataSubjectRequests.byType.portability).toBe(1);
        expect(report.dataSubjectRequests.completed).toBe(1);
        expect(report.dataSubjectRequests.pending).toBe(2);
      });
    });
  });

  describe('Statistics', () => {
    describe('getStatistics', () => {
      it('should return accurate statistics', async () => {
        await gdprService.recordConsent('user-1', 'analytics', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.recordConsent('user-2', 'analytics', 'denied', {
          consentMethod: 'opt-out',
          legalBasis: 'consent',
        });

        // Record consent for authentication before storing data
        await gdprService.recordConsent('user-1', 'authentication', 'granted', {
          consentMethod: 'explicit',
          legalBasis: 'consent',
        });

        await gdprService.storePersonalData(
          'user-1',
          'profile',
          { name: 'John' },
          'authentication',
          'consent',
          { source: 'registration' }
        );

        await gdprService.submitDataSubjectRequest('user-1', 'access', {}, {});

        await gdprService.createPrivacyImpactAssessment(
          'Test Activity',
          'Test Description',
          ['data1'],
          ['purpose1'],
          'consent'
        );

        const stats = gdprService.getStatistics();

        expect(stats.totalConsents).toBe(3); // user-1 analytics, user-2 analytics, user-1 authentication
        expect(stats.activeConsents).toBe(2); // user-1 analytics and user-1 authentication
        expect(stats.totalDataRecords).toBe(1);
        expect(stats.totalRequests).toBe(1);
        expect(stats.pendingRequests).toBe(1);
        expect(stats.totalAssessments).toBe(1);
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getGDPRComplianceService(defaultGDPRConfig, auditLogger, securityLogger);

      const instance2 = getGDPRComplianceService();

      expect(instance1).toBe(instance2);
    });

    it('should throw error on first call without dependencies', () => {
      resetGDPRComplianceService();

      expect(() => getGDPRComplianceService()).toThrow(
        'AuditLogger and SecurityLogger are required'
      );
    });

    it('should reset singleton instance', () => {
      const instance1 = getGDPRComplianceService(defaultGDPRConfig, auditLogger, securityLogger);

      resetGDPRComplianceService();

      const instance2 = getGDPRComplianceService(defaultGDPRConfig, auditLogger, securityLogger);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent consent operations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          gdprService.recordConsent(`user-${i}`, 'analytics', 'granted', {
            consentMethod: 'explicit',
            legalBasis: 'consent',
          })
        );
      }

      const consents = await Promise.all(promises);

      expect(consents).toHaveLength(10);
      expect(new Set(consents.map(c => c.id)).size).toBe(10);
    });

    it('should handle large data exports', async () => {
      // Store many records
      for (let i = 0; i < 100; i++) {
        await gdprService.storePersonalData(
          'user-123',
          `data_type_${i}`,
          { value: i },
          'analytics',
          'legitimate_interest',
          { source: 'test' }
        );
      }

      const request = await gdprService.submitDataSubjectRequest('user-123', 'access', {}, {});

      await gdprService.verifyDataSubject(request.id, 'email');

      const dataExport = await gdprService.processDataAccessRequest(request.id);

      expect(dataExport).toBeDefined();
      expect(dataExport!.data.personalData).toHaveLength(100);
    });

    it('should handle special characters in data', async () => {
      // Record consent first
      await gdprService.recordConsent('user-123', 'authentication', 'granted', {
        consentMethod: 'explicit',
        legalBasis: 'consent',
      });

      const specialData = {
        name: 'John <script>alert("xss")</script>',
        email: 'john@example.com',
        bio: 'Line 1\nLine 2\tTabbed',
      };

      const record = await gdprService.storePersonalData(
        'user-123',
        'profile',
        specialData,
        'authentication',
        'consent',
        { source: 'registration' }
      );

      expect(record.data).toBeDefined();
    });
  });
});
