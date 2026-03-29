/**
 * Audit Logger Service
 * Provides comprehensive audit logging with tamper-proof logs,
 * retention policies, compliance reporting, and search capabilities
 */

import * as crypto from 'crypto';
import { ELKLogger, LogContext } from '../services/elk-logger';
import { SecurityLogger } from './security-logger';

export type AuditEventType =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'system_configuration'
  | 'security_event'
  | 'user_management'
  | 'api_access'
  | 'captcha_operation'
  | 'session_management'
  | 'compliance_event';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  action: string;
  resource: string;
  actor: {
    userId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
  };
  outcome: 'success' | 'failure' | 'pending';
  details: Record<string, unknown>;
  metadata: {
    requestId?: string;
    correlationId?: string;
    source?: string;
    tags?: string[];
  };
  integrity: {
    hash: string;
    previousHash?: string;
    sequenceNumber: number;
  };
}

export interface AuditLogSearchQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  actors?: {
    userId?: string;
    sessionId?: string;
    ip?: string;
  };
  resources?: string[];
  outcomes?: ('success' | 'failure' | 'pending')[];
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogSearchResult {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}

export interface RetentionPolicy {
  retentionDays: number;
  archiveBeforeDelete: boolean;
  archiveLocation?: string;
}

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  standard: string;
  summary: {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    securityIncidents: number;
    complianceViolations: number;
  };
  findings: Array<{
    id: string;
    severity: AuditSeverity;
    description: string;
    recommendation: string;
    events: string[];
  }>;
  recommendations: string[];
}

export interface AuditLoggerConfig {
  enableIntegrityChain: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  retentionPolicy: RetentionPolicy;
  complianceStandards: string[];
  enableRealTimeAlerts: boolean;
  alertThresholds: {
    criticalEventsPerHour: number;
    failedAuthenticationsPerHour: number;
    suspiciousActivitiesPerHour: number;
  };
}

/**
 * Audit Logger Service
 * Implements comprehensive audit logging with tamper-proof capabilities
 */
export class AuditLogger {
  private readonly config: AuditLoggerConfig;
  private readonly elkLogger: ELKLogger;
  private readonly securityLogger: SecurityLogger;
  private readonly auditEvents: Map<string, AuditEvent> = new Map();
  private lastHash: string | undefined = undefined;
  private sequenceNumber: number = 0;
  private readonly encryptionKey: Buffer | null = null;

  constructor(config: AuditLoggerConfig, elkLogger: ELKLogger, securityLogger: SecurityLogger) {
    this.config = config;
    this.elkLogger = elkLogger;
    this.securityLogger = securityLogger;

    if (config.enableEncryption && config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    action: string,
    resource: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown>,
    metadata: AuditEvent['metadata'] = {},
    severity: AuditSeverity = 'info'
  ): Promise<AuditEvent> {
    const eventId = this.generateEventId();
    const timestamp = new Date();

    // Create audit event
    const auditEvent: AuditEvent = {
      id: eventId,
      timestamp,
      eventType,
      severity,
      action,
      resource,
      actor,
      outcome,
      details: this.sanitizeDetails(details),
      metadata: {
        ...metadata,
        source: 'audit-logger',
      },
      integrity: {
        hash: '',
        previousHash: this.config.enableIntegrityChain ? this.lastHash : undefined,
        sequenceNumber: this.sequenceNumber++,
      },
    };

    // Calculate integrity hash
    if (this.config.enableIntegrityChain) {
      auditEvent.integrity.hash = this.calculateHash(auditEvent);
      this.lastHash = auditEvent.integrity.hash;
    }

    // Encrypt sensitive data if enabled
    if (this.config.enableEncryption && this.encryptionKey) {
      auditEvent.details = this.encryptDetails(auditEvent.details);
    }

    // Store event
    this.auditEvents.set(eventId, auditEvent);

    // Log to ELK
    this.logToELK(auditEvent);

    // Log security event if applicable
    if (this.isSecurityRelevant(eventType, severity)) {
      this.securityLogger.logSecurityEvent({
        action: auditEvent.action,
        resource: auditEvent.resource,
        reason: `Audit event: ${auditEvent.action}`,
        metadata: {
          auditEventId: auditEvent.id,
          eventType: auditEvent.eventType,
          severity: auditEvent.severity,
          outcome: auditEvent.outcome,
        },
      });
    }

    // Check for real-time alerts
    if (this.config.enableRealTimeAlerts) {
      await this.checkAlertThresholds(auditEvent);
    }

    return auditEvent;
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'login_failed' | 'mfa_challenge' | 'mfa_success' | 'mfa_failed',
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    const severity: AuditSeverity = outcome === 'failure' ? 'warning' : 'info';
    return this.logEvent(
      'authentication',
      action,
      'auth_system',
      actor,
      outcome,
      details,
      { tags: ['authentication', 'security'] },
      severity
    );
  }

  /**
   * Log authorization event
   */
  async logAuthorization(
    action: 'access_granted' | 'access_denied' | 'permission_changed' | 'role_assigned',
    resource: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    const severity: AuditSeverity = outcome === 'failure' ? 'warning' : 'info';
    return this.logEvent(
      'authorization',
      action,
      resource,
      actor,
      outcome,
      details,
      { tags: ['authorization', 'access_control'] },
      severity
    );
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    action: 'read' | 'export' | 'query' | 'download',
    resource: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.logEvent(
      'data_access',
      action,
      resource,
      actor,
      outcome,
      details,
      { tags: ['data_access', 'privacy'] },
      'info'
    );
  }

  /**
   * Log data modification event
   */
  async logDataModification(
    action: 'create' | 'update' | 'delete' | 'restore',
    resource: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    const severity: AuditSeverity = action === 'delete' ? 'warning' : 'info';
    return this.logEvent(
      'data_modification',
      action,
      resource,
      actor,
      outcome,
      details,
      { tags: ['data_modification', 'change_management'] },
      severity
    );
  }

  /**
   * Log system configuration change
   */
  async logSystemConfiguration(
    action: 'config_updated' | 'feature_toggled' | 'setting_changed',
    resource: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.logEvent(
      'system_configuration',
      action,
      resource,
      actor,
      outcome,
      details,
      { tags: ['configuration', 'system'] },
      'info'
    );
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'] = 'pending',
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    const severity: AuditSeverity = this.determineSeverity(action);
    return this.logEvent(
      'security_event',
      action,
      'security_system',
      actor,
      outcome,
      details,
      { tags: ['security', 'incident'] },
      severity
    );
  }

  /**
   * Log API access event
   */
  async logApiAccess(
    method: string,
    endpoint: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.logEvent(
      'api_access',
      `${method} ${endpoint}`,
      endpoint,
      actor,
      outcome,
      details,
      { tags: ['api', 'access'] },
      'info'
    );
  }

  /**
   * Log captcha operation
   */
  async logCaptchaOperation(
    action: 'generate' | 'validate' | 'invalidate',
    captchaType: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.logEvent(
      'captcha_operation',
      action,
      `captcha:${captchaType}`,
      actor,
      outcome,
      details,
      { tags: ['captcha', 'security'] },
      'info'
    );
  }

  /**
   * Log session management event
   */
  async logSessionManagement(
    action: 'create' | 'refresh' | 'revoke' | 'expire',
    sessionId: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    return this.logEvent(
      'session_management',
      action,
      `session:${sessionId}`,
      actor,
      outcome,
      details,
      { tags: ['session', 'authentication'] },
      'info'
    );
  }

  /**
   * Log compliance event
   */
  async logComplianceEvent(
    action: string,
    standard: string,
    actor: AuditEvent['actor'],
    outcome: AuditEvent['outcome'],
    details: Record<string, unknown> = {}
  ): Promise<AuditEvent> {
    const severity: AuditSeverity = outcome === 'failure' ? 'error' : 'info';
    return this.logEvent(
      'compliance_event',
      action,
      `compliance:${standard}`,
      actor,
      outcome,
      details,
      { tags: ['compliance', standard.toLowerCase()] },
      severity
    );
  }

  /**
   * Search audit logs
   */
  async search(query: AuditLogSearchQuery): Promise<AuditLogSearchResult> {
    let events = Array.from(this.auditEvents.values());

    // Apply filters
    if (query.startDate) {
      events = events.filter(e => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      events = events.filter(e => e.timestamp <= query.endDate!);
    }
    if (query.eventTypes && query.eventTypes.length > 0) {
      events = events.filter(e => query.eventTypes!.includes(e.eventType));
    }
    if (query.severities && query.severities.length > 0) {
      events = events.filter(e => query.severities!.includes(e.severity));
    }
    if (query.actors) {
      if (query.actors.userId) {
        events = events.filter(e => e.actor.userId === query.actors!.userId);
      }
      if (query.actors.sessionId) {
        events = events.filter(e => e.actor.sessionId === query.actors!.sessionId);
      }
      if (query.actors.ip) {
        events = events.filter(e => e.actor.ip === query.actors!.ip);
      }
    }
    if (query.resources && query.resources.length > 0) {
      events = events.filter(e => query.resources!.some(r => e.resource.includes(r)));
    }
    if (query.outcomes && query.outcomes.length > 0) {
      events = events.filter(e => query.outcomes!.includes(e.outcome));
    }
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      events = events.filter(
        e =>
          e.action.toLowerCase().includes(searchLower) ||
          e.resource.toLowerCase().includes(searchLower) ||
          JSON.stringify(e.details).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const total = events.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get audit event by ID
   */
  getEvent(eventId: string): AuditEvent | undefined {
    return this.auditEvents.get(eventId);
  }

  /**
   * Verify audit log integrity
   */
  verifyIntegrity(): {
    valid: boolean;
    brokenAt?: string;
    expectedHash?: string;
    actualHash?: string;
  } {
    if (!this.config.enableIntegrityChain) {
      return { valid: true };
    }

    const events = Array.from(this.auditEvents.values()).sort(
      (a, b) => a.integrity.sequenceNumber - b.integrity.sequenceNumber
    );

    let previousHash: string | undefined = undefined;
    for (const event of events) {
      const expectedPreviousHash = previousHash;
      if (event.integrity.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          brokenAt: event.id,
          expectedHash: expectedPreviousHash,
          actualHash: event.integrity.previousHash,
        };
      }

      const calculatedHash = this.calculateHash(event);
      if (event.integrity.hash !== calculatedHash) {
        return {
          valid: false,
          brokenAt: event.id,
          expectedHash: calculatedHash,
          actualHash: event.integrity.hash,
        };
      }

      previousHash = event.integrity.hash;
    }

    return { valid: true };
  }

  /**
   * Apply retention policy
   */
  async applyRetentionPolicy(): Promise<{ deleted: number; archived: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPolicy.retentionDays);

    let deleted = 0;
    let archived = 0;

    for (const [eventId, event] of this.auditEvents.entries()) {
      if (event.timestamp < cutoffDate) {
        if (this.config.retentionPolicy.archiveBeforeDelete) {
          // Archive event (in production, this would write to archive storage)
          archived++;
        }
        this.auditEvents.delete(eventId);
        deleted++;
      }
    }

    return { deleted, archived };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    standard: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const events = Array.from(this.auditEvents.values()).filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );

    const eventsByType: Record<AuditEventType, number> = {
      authentication: 0,
      authorization: 0,
      data_access: 0,
      data_modification: 0,
      system_configuration: 0,
      security_event: 0,
      user_management: 0,
      api_access: 0,
      captcha_operation: 0,
      session_management: 0,
      compliance_event: 0,
    };

    const eventsBySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    let securityIncidents = 0;
    let complianceViolations = 0;

    for (const event of events) {
      eventsByType[event.eventType]++;
      eventsBySeverity[event.severity]++;

      if (event.eventType === 'security_event') {
        securityIncidents++;
      }

      if (event.outcome === 'failure' && event.eventType === 'compliance_event') {
        complianceViolations++;
      }
    }

    const findings = this.analyzeComplianceFindings(events, standard);
    const recommendations = this.generateRecommendations(findings, standard);

    return {
      id: crypto.randomUUID(),
      generatedAt: new Date(),
      period: { startDate, endDate },
      standard,
      summary: {
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        securityIncidents,
        complianceViolations,
      },
      findings,
      recommendations,
    };
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    eventsByOutcome: Record<string, number>;
    integrityStatus: { valid: boolean; brokenAt?: string };
  } {
    const events = Array.from(this.auditEvents.values());

    const eventsByType: Record<AuditEventType, number> = {
      authentication: 0,
      authorization: 0,
      data_access: 0,
      data_modification: 0,
      system_configuration: 0,
      security_event: 0,
      user_management: 0,
      api_access: 0,
      captcha_operation: 0,
      session_management: 0,
      compliance_event: 0,
    };

    const eventsBySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const eventsByOutcome: Record<string, number> = {
      success: 0,
      failure: 0,
      pending: 0,
    };

    for (const event of events) {
      eventsByType[event.eventType]++;
      eventsBySeverity[event.severity]++;
      eventsByOutcome[event.outcome]++;
    }

    const integrityStatus = this.verifyIntegrity();

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsByOutcome,
      integrityStatus,
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calculate hash for tamper-proof integrity
   */
  private calculateHash(event: AuditEvent): string {
    const data = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      action: event.action,
      resource: event.resource,
      actor: event.actor,
      outcome: event.outcome,
      details: event.details,
      previousHash: event.integrity.previousHash,
      sequenceNumber: event.integrity.sequenceNumber,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...details };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Encrypt sensitive details
   */
  private encryptDetails(details: Record<string, unknown>): Record<string, unknown> {
    if (!this.encryptionKey) {
      return details;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(details), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: true,
      data: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Log to ELK stack
   */
  private logToELK(event: AuditEvent): void {
    const context: LogContext = {
      requestId: event.metadata.requestId,
      sessionId: event.actor.sessionId,
      userId: event.actor.userId,
      ip: event.actor.ip,
      userAgent: event.actor.userAgent,
    };

    this.elkLogger.logAudit(
      event.action,
      {
        eventId: event.id,
        eventType: event.eventType,
        severity: event.severity,
        resource: event.resource,
        outcome: event.outcome,
        details: event.details,
        integrity: event.integrity,
      },
      context
    );
  }

  /**
   * Check if event is security relevant
   */
  private isSecurityRelevant(eventType: AuditEventType, severity: AuditSeverity): boolean {
    return (
      eventType === 'security_event' ||
      eventType === 'authentication' ||
      severity === 'critical' ||
      severity === 'error'
    );
  }

  /**
   * Determine severity based on action
   */
  private determineSeverity(action: string): AuditSeverity {
    const criticalActions = ['breach_detected', 'data_leak', 'unauthorized_access'];
    const errorActions = ['authentication_failed', 'authorization_failed', 'injection_attempt'];
    const warningActions = ['suspicious_activity', 'rate_limit_exceeded', 'bot_detected'];

    if (criticalActions.some(a => action.includes(a))) {
      return 'critical';
    }
    if (errorActions.some(a => action.includes(a))) {
      return 'error';
    }
    if (warningActions.some(a => action.includes(a))) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(_event: AuditEvent): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = Array.from(this.auditEvents.values()).filter(
      e => e.timestamp >= oneHourAgo
    );

    const criticalEvents = recentEvents.filter(e => e.severity === 'critical').length;
    const failedAuths = recentEvents.filter(
      e => e.eventType === 'authentication' && e.outcome === 'failure'
    ).length;
    const suspiciousActivities = recentEvents.filter(
      e => e.eventType === 'security_event' && e.severity === 'warning'
    ).length;

    if (criticalEvents >= this.config.alertThresholds.criticalEventsPerHour) {
      this.securityLogger.logSecurityEvent({
        action: 'audit_alert_critical_threshold',
        resource: 'audit_logger',
        reason: `Critical events threshold exceeded: ${criticalEvents} events in last hour`,
        metadata: { threshold: this.config.alertThresholds.criticalEventsPerHour },
      });
    }

    if (failedAuths >= this.config.alertThresholds.failedAuthenticationsPerHour) {
      this.securityLogger.logSecurityEvent({
        action: 'audit_alert_failed_auth_threshold',
        resource: 'audit_logger',
        reason: `Failed authentication threshold exceeded: ${failedAuths} events in last hour`,
        metadata: { threshold: this.config.alertThresholds.failedAuthenticationsPerHour },
      });
    }

    if (suspiciousActivities >= this.config.alertThresholds.suspiciousActivitiesPerHour) {
      this.securityLogger.logSecurityEvent({
        action: 'audit_alert_suspicious_threshold',
        resource: 'audit_logger',
        reason: `Suspicious activity threshold exceeded: ${suspiciousActivities} events in last hour`,
        metadata: { threshold: this.config.alertThresholds.suspiciousActivitiesPerHour },
      });
    }
  }

  /**
   * Analyze compliance findings
   */
  private analyzeComplianceFindings(
    events: AuditEvent[],
    _standard: string
  ): ComplianceReport['findings'] {
    const findings: ComplianceReport['findings'] = [];

    // Check for failed authentications
    const failedAuths = events.filter(
      e => e.eventType === 'authentication' && e.outcome === 'failure'
    );
    if (failedAuths.length > 10) {
      findings.push({
        id: crypto.randomUUID(),
        severity: 'warning',
        description: `High number of failed authentication attempts: ${failedAuths.length}`,
        recommendation:
          'Review authentication logs and consider implementing additional security measures',
        events: failedAuths.slice(0, 5).map(e => e.id),
      });
    }

    // Check for data access without proper authorization
    const unauthorizedAccess = events.filter(
      e => e.eventType === 'authorization' && e.outcome === 'failure'
    );
    if (unauthorizedAccess.length > 0) {
      findings.push({
        id: crypto.randomUUID(),
        severity: 'error',
        description: `Unauthorized access attempts detected: ${unauthorizedAccess.length}`,
        recommendation: 'Review access control policies and user permissions',
        events: unauthorizedAccess.slice(0, 5).map(e => e.id),
      });
    }

    // Check for data modifications
    const dataModifications = events.filter(e => e.eventType === 'data_modification');
    if (dataModifications.length > 100) {
      findings.push({
        id: crypto.randomUUID(),
        severity: 'info',
        description: `High volume of data modifications: ${dataModifications.length}`,
        recommendation: 'Ensure all data changes are properly documented and approved',
        events: dataModifications.slice(0, 5).map(e => e.id),
      });
    }

    return findings;
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(
    findings: ComplianceReport['findings'],
    standard: string
  ): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.severity === 'critical')) {
      recommendations.push('Immediate action required for critical findings');
    }

    if (findings.some(f => f.description.includes('authentication'))) {
      recommendations.push('Implement multi-factor authentication for all users');
      recommendations.push('Review and strengthen password policies');
    }

    if (findings.some(f => f.description.includes('unauthorized'))) {
      recommendations.push('Review and update access control policies');
      recommendations.push('Implement principle of least privilege');
    }

    if (standard === 'GDPR') {
      recommendations.push('Ensure data minimization principles are followed');
      recommendations.push('Verify consent management for data processing');
      recommendations.push('Review data retention policies');
    }

    if (standard === 'SOC2') {
      recommendations.push('Review security controls and monitoring');
      recommendations.push('Ensure availability and processing integrity');
      recommendations.push('Verify confidentiality and privacy controls');
    }

    return recommendations;
  }
}

// Default configuration
export const defaultAuditLoggerConfig: AuditLoggerConfig = {
  enableIntegrityChain: true,
  enableEncryption: false,
  retentionPolicy: {
    retentionDays: 365,
    archiveBeforeDelete: true,
  },
  complianceStandards: ['GDPR', 'SOC2'],
  enableRealTimeAlerts: true,
  alertThresholds: {
    criticalEventsPerHour: 5,
    failedAuthenticationsPerHour: 20,
    suspiciousActivitiesPerHour: 10,
  },
};

// Singleton instance
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(
  config?: AuditLoggerConfig,
  elkLogger?: ELKLogger,
  securityLogger?: SecurityLogger
): AuditLogger {
  if (!auditLoggerInstance) {
    if (!elkLogger || !securityLogger) {
      throw new Error('ELKLogger and SecurityLogger are required for first initialization');
    }
    auditLoggerInstance = new AuditLogger(
      config || defaultAuditLoggerConfig,
      elkLogger,
      securityLogger
    );
  }
  return auditLoggerInstance;
}

export function resetAuditLogger(): void {
  auditLoggerInstance = null;
}
