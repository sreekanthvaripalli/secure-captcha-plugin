/**
 * Audit Logger Tests
 * Comprehensive test suite for audit logging functionality
 */

import {
  AuditLogger,
  AuditLoggerConfig,
  defaultAuditLoggerConfig,
} from '../../src/security/audit-logger';
import { ELKLogger } from '../../src/services/elk-logger';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock dependencies
jest.mock('../../src/services/elk-logger');
jest.mock('../../src/security/security-logger');

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let mockElkLogger: jest.Mocked<ELKLogger>;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;
  let config: AuditLoggerConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockElkLogger = {
      logAudit: jest.fn(),
      logSecurityEvent: jest.fn(),
      logRequest: jest.fn(),
      logResponse: jest.fn(),
      logError: jest.fn(),
      logPerformance: jest.fn(),
      logCaptchaGeneration: jest.fn(),
      logCaptchaValidation: jest.fn(),
      logSession: jest.fn(),
      logCache: jest.fn(),
      logRateLimit: jest.fn(),
      close: jest.fn(),
    } as any;

    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
      getSecurityStats: jest.fn(),
    } as any;

    // Create config
    config = {
      enableIntegrityChain: true,
      enableEncryption: false,
      retentionPolicy: {
        retentionDays: 365,
        archiveBeforeDelete: true,
      },
      complianceStandards: ['GDPR', 'SOC2'],
      enableRealTimeAlerts: false, // Disable for most tests
      alertThresholds: {
        criticalEventsPerHour: 5,
        failedAuthenticationsPerHour: 20,
        suspiciousActivitiesPerHour: 10,
      },
    };

    // Create audit logger instance
    auditLogger = new AuditLogger(config, mockElkLogger, mockSecurityLogger);
  });

  describe('Event Logging', () => {
    it('should log a basic audit event', async () => {
      const event = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        { userId: 'user123', ip: '192.168.1.1' },
        'success',
        { method: 'password' }
      );

      expect(event).toBeDefined();
      expect(event.id).toMatch(/^audit_\d+_[a-f0-9]{16}$/);
      expect(event.eventType).toBe('authentication');
      expect(event.action).toBe('login');
      expect(event.resource).toBe('auth_system');
      expect(event.actor.userId).toBe('user123');
      expect(event.outcome).toBe('success');
      expect(event.integrity.hash).toBeDefined();
      expect(mockElkLogger.logAudit).toHaveBeenCalled();
    });

    it('should log authentication events', async () => {
      const event = await auditLogger.logAuthentication(
        'login',
        { userId: 'user123', ip: '192.168.1.1' },
        'success',
        { method: 'password' }
      );

      expect(event.eventType).toBe('authentication');
      expect(event.action).toBe('login');
      expect(event.outcome).toBe('success');
      expect(event.metadata.tags).toContain('authentication');
    });

    it('should log failed authentication with warning severity', async () => {
      const event = await auditLogger.logAuthentication(
        'login_failed',
        { userId: 'user123', ip: '192.168.1.1' },
        'failure',
        { reason: 'invalid_password' }
      );

      expect(event.severity).toBe('warning');
      expect(event.outcome).toBe('failure');
    });

    it('should log authorization events', async () => {
      const event = await auditLogger.logAuthorization(
        'access_granted',
        'api/users',
        { userId: 'user123' },
        'success',
        { permission: 'read' }
      );

      expect(event.eventType).toBe('authorization');
      expect(event.action).toBe('access_granted');
      expect(event.resource).toBe('api/users');
    });

    it('should log data access events', async () => {
      const event = await auditLogger.logDataAccess(
        'read',
        'database/users',
        { userId: 'user123' },
        'success',
        { recordCount: 10 }
      );

      expect(event.eventType).toBe('data_access');
      expect(event.action).toBe('read');
      expect(event.metadata.tags).toContain('data_access');
    });

    it('should log data modification events', async () => {
      const event = await auditLogger.logDataModification(
        'delete',
        'database/users/user123',
        { userId: 'admin' },
        'success',
        { reason: 'user_request' }
      );

      expect(event.eventType).toBe('data_modification');
      expect(event.action).toBe('delete');
      expect(event.severity).toBe('warning');
    });

    it('should log system configuration changes', async () => {
      const event = await auditLogger.logSystemConfiguration(
        'config_updated',
        'security/rate_limit',
        { userId: 'admin' },
        'success',
        { oldValue: 100, newValue: 200 }
      );

      expect(event.eventType).toBe('system_configuration');
      expect(event.action).toBe('config_updated');
    });

    it('should log security events', async () => {
      const event = await auditLogger.logSecurityEvent(
        'suspicious_activity',
        { ip: '192.168.1.100' },
        'pending',
        { reason: 'multiple_failed_logins' }
      );

      expect(event.eventType).toBe('security_event');
      expect(event.action).toBe('suspicious_activity');
      expect(event.severity).toBe('warning');
    });

    it('should log API access events', async () => {
      const event = await auditLogger.logApiAccess(
        'POST',
        '/api/v1/captcha/generate',
        { userId: 'user123', ip: '192.168.1.1' },
        'success',
        { responseTime: 150 }
      );

      expect(event.eventType).toBe('api_access');
      expect(event.action).toBe('POST /api/v1/captcha/generate');
      expect(event.resource).toBe('/api/v1/captcha/generate');
    });

    it('should log captcha operations', async () => {
      const event = await auditLogger.logCaptchaOperation(
        'generate',
        'image',
        { sessionId: 'session123' },
        'success',
        { difficulty: 'hard' }
      );

      expect(event.eventType).toBe('captcha_operation');
      expect(event.action).toBe('generate');
      expect(event.resource).toBe('captcha:image');
    });

    it('should log session management events', async () => {
      const event = await auditLogger.logSessionManagement(
        'create',
        'session123',
        { userId: 'user123' },
        'success',
        { expiresAt: new Date() }
      );

      expect(event.eventType).toBe('session_management');
      expect(event.action).toBe('create');
      expect(event.resource).toBe('session:session123');
    });

    it('should log compliance events', async () => {
      const event = await auditLogger.logComplianceEvent(
        'data_export',
        'GDPR',
        { userId: 'user123' },
        'success',
        { dataTypes: ['profile', 'activity'] }
      );

      expect(event.eventType).toBe('compliance_event');
      expect(event.action).toBe('data_export');
      expect(event.resource).toBe('compliance:GDPR');
      expect(event.metadata.tags).toContain('gdpr');
    });
  });

  describe('Integrity Chain', () => {
    it('should maintain integrity chain when enabled', async () => {
      const event1 = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        { userId: 'user1' },
        'success',
        {}
      );

      const event2 = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        { userId: 'user2' },
        'success',
        {}
      );

      expect(event1.integrity.previousHash).toBeUndefined();
      expect(event2.integrity.previousHash).toBe(event1.integrity.hash);
      expect(event2.integrity.sequenceNumber).toBe(event1.integrity.sequenceNumber + 1);
    });

    it('should verify integrity successfully', async () => {
      await auditLogger.logEvent('authentication', 'login', 'auth_system', {}, 'success', {});
      await auditLogger.logEvent('authentication', 'logout', 'auth_system', {}, 'success', {});

      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
    });

    it('should detect integrity violation', async () => {
      const event1 = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        {},
        'success',
        {}
      );

      // Tamper with the event
      const storedEvent = auditLogger.getEvent(event1.id);
      if (storedEvent) {
        storedEvent.details = { tampered: true };
      }

      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(false);
      expect(integrity.brokenAt).toBe(event1.id);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Create test events
      await auditLogger.logAuthentication(
        'login',
        { userId: 'user1', ip: '192.168.1.1' },
        'success',
        {}
      );
      await auditLogger.logAuthentication(
        'login_failed',
        { userId: 'user2', ip: '192.168.1.2' },
        'failure',
        {}
      );
      await auditLogger.logDataAccess('read', 'database/users', { userId: 'user1' }, 'success', {});
      await auditLogger.logSecurityEvent(
        'suspicious_activity',
        { ip: '192.168.1.3' },
        'pending',
        {}
      );
    });

    it('should search by event type', async () => {
      const result = await auditLogger.search({
        eventTypes: ['authentication'],
      });

      expect(result.events.length).toBe(2);
      expect(result.events.every(e => e.eventType === 'authentication')).toBe(true);
    });

    it('should search by severity', async () => {
      const result = await auditLogger.search({
        severities: ['warning'],
      });

      expect(result.events.length).toBe(2);
      expect(result.events.some(e => e.action === 'login_failed')).toBe(true);
      expect(result.events.some(e => e.action === 'suspicious_activity')).toBe(true);
    });

    it('should search by actor', async () => {
      const result = await auditLogger.search({
        actors: { userId: 'user1' },
      });

      expect(result.events.length).toBe(2);
      expect(result.events.every(e => e.actor.userId === 'user1')).toBe(true);
    });

    it('should search by IP address', async () => {
      const result = await auditLogger.search({
        actors: { ip: '192.168.1.2' },
      });

      expect(result.events.length).toBe(1);
      expect(result.events[0].actor.ip).toBe('192.168.1.2');
    });

    it('should search by outcome', async () => {
      const result = await auditLogger.search({
        outcomes: ['failure'],
      });

      expect(result.events.length).toBe(1);
      expect(result.events[0].outcome).toBe('failure');
    });

    it('should search by text', async () => {
      const result = await auditLogger.search({
        searchText: 'suspicious',
      });

      expect(result.events.length).toBe(1);
      expect(result.events[0].action).toBe('suspicious_activity');
    });

    it('should search by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await auditLogger.search({
        startDate: oneHourAgo,
        endDate: now,
      });

      expect(result.events.length).toBe(4);
    });

    it('should paginate results', async () => {
      const result = await auditLogger.search({
        limit: 2,
        offset: 0,
      });

      expect(result.events.length).toBe(2);
      expect(result.total).toBe(4);
      expect(result.hasMore).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const result = await auditLogger.search({
        eventTypes: ['authentication'],
        outcomes: ['success'],
      });

      expect(result.events.length).toBe(1);
      expect(result.events[0].action).toBe('login');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await auditLogger.logAuthentication('login', {}, 'success', {});
      await auditLogger.logAuthentication('login_failed', {}, 'failure', {});
      await auditLogger.logDataAccess('read', 'resource', {}, 'success', {});
      await auditLogger.logSecurityEvent('suspicious_activity', {}, 'pending', {});
    });

    it('should return correct statistics', () => {
      const stats = auditLogger.getStatistics();

      expect(stats.totalEvents).toBe(4);
      expect(stats.eventsByType.authentication).toBe(2);
      expect(stats.eventsByType.data_access).toBe(1);
      expect(stats.eventsByType.security_event).toBe(1);
      expect(stats.eventsByOutcome.success).toBe(2);
      expect(stats.eventsByOutcome.failure).toBe(1);
      expect(stats.eventsByOutcome.pending).toBe(1);
      expect(stats.integrityStatus.valid).toBe(true);
    });
  });

  describe('Retention Policy', () => {
    it('should apply retention policy', async () => {
      // Create old event by manipulating timestamp
      const oldEvent = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        {},
        'success',
        {}
      );

      // Manually set old timestamp
      const storedEvent = auditLogger.getEvent(oldEvent.id);
      if (storedEvent) {
        storedEvent.timestamp = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 days ago
      }

      // Create recent event
      await auditLogger.logEvent('authentication', 'login', 'auth_system', {}, 'success', {});

      const result = await auditLogger.applyRetentionPolicy();

      expect(result.deleted).toBe(1);
      expect(result.archived).toBe(1);
    });
  });

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      // Create events for compliance report
      for (let i = 0; i < 15; i++) {
        await auditLogger.logAuthentication('login_failed', {}, 'failure', {});
      }
      await auditLogger.logAuthorization('access_denied', 'resource', {}, 'failure', {});
      await auditLogger.logComplianceEvent('data_export', 'GDPR', {}, 'failure', {});
    });

    it('should generate GDPR compliance report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport('GDPR', startDate, endDate);

      expect(report.standard).toBe('GDPR');
      expect(report.summary.totalEvents).toBe(17);
      expect(report.summary.eventsByType.authentication).toBe(15);
      expect(report.summary.eventsByType.authorization).toBe(1);
      expect(report.summary.eventsByType.compliance_event).toBe(1);
      expect(report.summary.securityIncidents).toBe(0);
      expect(report.summary.complianceViolations).toBe(1);
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate SOC2 compliance report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport('SOC2', startDate, endDate);

      expect(report.standard).toBe('SOC2');
      expect(report.recommendations).toContain('Review security controls and monitoring');
    });

    it('should identify high failed authentication attempts', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport('GDPR', startDate, endDate);

      const authFinding = report.findings.find(f => f.description.includes('authentication'));
      expect(authFinding).toBeDefined();
      expect(authFinding?.severity).toBe('warning');
    });

    it('should identify unauthorized access attempts', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await auditLogger.generateComplianceReport('GDPR', startDate, endDate);

      const authzFinding = report.findings.find(f => f.description.includes('Unauthorized'));
      expect(authzFinding).toBeDefined();
      expect(authzFinding?.severity).toBe('error');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields', async () => {
      const event = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        {},
        'success',
        {
          username: 'testuser',
          password: 'secret123',
          token: 'abc123',
          secret: 'mysecret',
          normalField: 'normalValue',
        }
      );

      expect(event.details.password).toBe('[REDACTED]');
      expect(event.details.token).toBe('[REDACTED]');
      expect(event.details.secret).toBe('[REDACTED]');
      expect(event.details.normalField).toBe('normalValue');
    });
  });

  describe('Encryption', () => {
    it('should encrypt details when encryption is enabled', async () => {
      const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const encryptedConfig: AuditLoggerConfig = {
        ...config,
        enableEncryption: true,
        encryptionKey,
      };

      const encryptedLogger = new AuditLogger(encryptedConfig, mockElkLogger, mockSecurityLogger);

      const event = await encryptedLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        {},
        'success',
        { sensitiveData: 'confidential' }
      );

      expect(event.details.encrypted).toBe(true);
      expect(event.details.data).toBeDefined();
      expect(event.details.iv).toBeDefined();
      expect(event.details.authTag).toBeDefined();
    });
  });

  describe('Real-time Alerts', () => {
    it('should trigger alert when critical threshold is exceeded', async () => {
      const alertConfig: AuditLoggerConfig = {
        ...config,
        enableRealTimeAlerts: true,
        alertThresholds: {
          criticalEventsPerHour: 2,
          failedAuthenticationsPerHour: 20,
          suspiciousActivitiesPerHour: 10,
        },
      };

      const alertLogger = new AuditLogger(alertConfig, mockElkLogger, mockSecurityLogger);

      // Log critical events
      await alertLogger.logEvent(
        'security_event',
        'breach_detected',
        'system',
        {},
        'failure',
        {},
        {},
        'critical'
      );
      await alertLogger.logEvent(
        'security_event',
        'data_leak',
        'system',
        {},
        'failure',
        {},
        {},
        'critical'
      );

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'audit_alert_critical_threshold',
        })
      );
    });

    it('should trigger alert when failed auth threshold is exceeded', async () => {
      const alertConfig: AuditLoggerConfig = {
        ...config,
        enableRealTimeAlerts: true,
        alertThresholds: {
          criticalEventsPerHour: 5,
          failedAuthenticationsPerHour: 3,
          suspiciousActivitiesPerHour: 10,
        },
      };

      const alertLogger = new AuditLogger(alertConfig, mockElkLogger, mockSecurityLogger);

      // Log failed authentications
      for (let i = 0; i < 4; i++) {
        await alertLogger.logAuthentication('login_failed', {}, 'failure', {});
      }

      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'audit_alert_failed_auth_threshold',
        })
      );
    });
  });

  describe('Severity Determination', () => {
    it('should assign critical severity to breach events', async () => {
      const event = await auditLogger.logSecurityEvent('breach_detected', {}, 'failure', {});

      expect(event.severity).toBe('critical');
    });

    it('should assign error severity to auth failures', async () => {
      const event = await auditLogger.logSecurityEvent('authentication_failed', {}, 'failure', {});

      expect(event.severity).toBe('error');
    });

    it('should assign warning severity to suspicious activity', async () => {
      const event = await auditLogger.logSecurityEvent('suspicious_activity', {}, 'pending', {});

      expect(event.severity).toBe('warning');
    });

    it('should assign info severity to other events', async () => {
      const event = await auditLogger.logSecurityEvent('normal_operation', {}, 'success', {});

      expect(event.severity).toBe('info');
    });
  });

  describe('Event Retrieval', () => {
    it('should retrieve event by ID', async () => {
      const event = await auditLogger.logEvent(
        'authentication',
        'login',
        'auth_system',
        {},
        'success',
        {}
      );

      const retrieved = auditLogger.getEvent(event.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(event.id);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = auditLogger.getEvent('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Default Configuration', () => {
    it('should have correct default values', () => {
      expect(defaultAuditLoggerConfig.enableIntegrityChain).toBe(true);
      expect(defaultAuditLoggerConfig.enableEncryption).toBe(false);
      expect(defaultAuditLoggerConfig.retentionPolicy.retentionDays).toBe(365);
      expect(defaultAuditLoggerConfig.complianceStandards).toContain('GDPR');
      expect(defaultAuditLoggerConfig.complianceStandards).toContain('SOC2');
      expect(defaultAuditLoggerConfig.enableRealTimeAlerts).toBe(true);
    });
  });
});
