/**
 * GDPR Compliance Service
 * Implements GDPR requirements including data subject rights,
 * consent management, data retention, and privacy-by-design
 */

import * as crypto from 'crypto';
import { AuditLogger } from './audit-logger';
import { SecurityLogger } from './security-logger';

// GDPR Data Subject Rights
export type DataSubjectRight =
  | 'access' // Right to access (Article 15)
  | 'rectification' // Right to rectification (Article 16)
  | 'erasure' // Right to erasure (Article 17)
  | 'restriction' // Right to restriction of processing (Article 18)
  | 'portability' // Right to data portability (Article 20)
  | 'objection'; // Right to object (Article 21)

// Consent Status
export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'pending';

// Consent Record
export interface ConsentRecord {
  id: string;
  dataSubjectId: string;
  purpose: string;
  status: ConsentStatus;
  grantedAt?: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    consentMethod: 'explicit' | 'implicit' | 'opt-in' | 'opt-out';
    version: string;
    legalBasis: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Personal Data Record
export interface PersonalDataRecord {
  id: string;
  dataSubjectId: string;
  dataType: string;
  data: Record<string, unknown>;
  purpose: string;
  legalBasis: string;
  collectedAt: Date;
  expiresAt?: Date;
  retentionPeriod?: number; // in days
  metadata: {
    source: string;
    encrypted: boolean;
    anonymized: boolean;
    pseudonymized: boolean;
  };
}

// Data Subject Request
export interface DataSubjectRequest {
  id: string;
  dataSubjectId: string;
  rightType: DataSubjectRight;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  deadline: Date; // 30 days from request
  details: {
    reason?: string;
    specificData?: string[];
    format?: 'json' | 'csv' | 'xml';
  };
  verification: {
    verified: boolean;
    verifiedAt?: Date;
    verificationMethod?: string;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  };
}

// Data Export Format
export interface DataExport {
  dataSubjectId: string;
  exportedAt: Date;
  format: 'json' | 'csv' | 'xml';
  data: {
    personalData: PersonalDataRecord[];
    consentRecords: ConsentRecord[];
    processingActivities: Array<{
      purpose: string;
      legalBasis: string;
      dataTypes: string[];
      recipients?: string[];
      retentionPeriod?: number;
    }>;
  };
  metadata: {
    version: string;
    encrypted: boolean;
    signature?: string;
  };
}

// Privacy Impact Assessment
export interface PrivacyImpactAssessment {
  id: string;
  processingActivity: string;
  description: string;
  dataTypes: string[];
  purposes: string[];
  legalBasis: string;
  riskAssessment: {
    likelihood: 'low' | 'medium' | 'high';
    severity: 'low' | 'medium' | 'high';
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  mitigationMeasures: string[];
  dataSubjectRights: DataSubjectRight[];
  createdAt: Date;
  reviewedAt?: Date;
  approvedBy?: string;
}

// GDPR Configuration
export interface GDPRConfig {
  dataRetentionDays: number;
  consentExpirationDays: number;
  requestDeadlineDays: number;
  enableDataMinimization: boolean;
  enablePseudonymization: boolean;
  enableAnonymization: boolean;
  exportFormats: Array<'json' | 'csv' | 'xml'>;
  requireExplicitConsent: boolean;
  enablePrivacyByDesign: boolean;
  dataSubjectVerificationRequired: boolean;
}

// Default Configuration
export const defaultGDPRConfig: GDPRConfig = {
  dataRetentionDays: 365,
  consentExpirationDays: 365,
  requestDeadlineDays: 30,
  enableDataMinimization: true,
  enablePseudonymization: true,
  enableAnonymization: true,
  exportFormats: ['json', 'csv', 'xml'],
  requireExplicitConsent: true,
  enablePrivacyByDesign: true,
  dataSubjectVerificationRequired: true,
};

/**
 * GDPR Compliance Service
 * Implements comprehensive GDPR compliance features
 */
export class GDPRComplianceService {
  private readonly config: GDPRConfig;
  private readonly auditLogger: AuditLogger;
  private readonly securityLogger: SecurityLogger;
  private readonly consentRecords: Map<string, ConsentRecord> = new Map();
  private readonly personalDataRecords: Map<string, PersonalDataRecord> = new Map();
  private readonly dataSubjectRequests: Map<string, DataSubjectRequest> = new Map();
  private readonly privacyAssessments: Map<string, PrivacyImpactAssessment> = new Map();

  constructor(config: GDPRConfig, auditLogger: AuditLogger, securityLogger: SecurityLogger) {
    this.config = config;
    this.auditLogger = auditLogger;
    this.securityLogger = securityLogger;
  }

  // ==================== CONSENT MANAGEMENT ====================

  /**
   * Record consent from data subject
   */
  async recordConsent(
    dataSubjectId: string,
    purpose: string,
    status: ConsentStatus,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      consentMethod: ConsentRecord['metadata']['consentMethod'];
      legalBasis: string;
    }
  ): Promise<ConsentRecord> {
    const consentId = this.generateId('consent');
    const now = new Date();

    const consentRecord: ConsentRecord = {
      id: consentId,
      dataSubjectId,
      purpose,
      status,
      grantedAt: status === 'granted' ? now : undefined,
      withdrawnAt: status === 'withdrawn' ? now : undefined,
      expiresAt:
        status === 'granted'
          ? new Date(now.getTime() + this.config.consentExpirationDays * 24 * 60 * 60 * 1000)
          : undefined,
      metadata: {
        ...metadata,
        version: '1.0',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.consentRecords.set(consentId, consentRecord);

    // Log audit event
    await this.auditLogger.logComplianceEvent(
      `consent_${status}`,
      'GDPR',
      {
        userId: dataSubjectId,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      'success',
      {
        consentId,
        purpose,
        status,
        consentMethod: metadata.consentMethod,
        legalBasis: metadata.legalBasis,
      }
    );

    this.securityLogger.logSecurityEvent({
      action: 'GDPR_CONSENT_RECORDED',
      resource: 'gdpr_compliance',
      reason: `Consent ${status} for purpose: ${purpose}`,
      metadata: {
        consentId,
        dataSubjectId,
        purpose,
        status,
      },
    });

    return consentRecord;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    consentId: string,
    metadata: { ipAddress?: string; userAgent?: string }
  ): Promise<ConsentRecord | null> {
    const consent = this.consentRecords.get(consentId);

    if (!consent) {
      return null;
    }

    consent.status = 'withdrawn';
    consent.withdrawnAt = new Date();
    consent.updatedAt = new Date();

    // Log audit event
    await this.auditLogger.logComplianceEvent(
      'consent_withdrawn',
      'GDPR',
      {
        userId: consent.dataSubjectId,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      'success',
      {
        consentId,
        purpose: consent.purpose,
        previousStatus: 'granted',
      }
    );

    return consent;
  }

  /**
   * Get consent records for data subject
   */
  getConsentRecords(dataSubjectId: string): ConsentRecord[] {
    return Array.from(this.consentRecords.values()).filter(c => c.dataSubjectId === dataSubjectId);
  }

  /**
   * Check if valid consent exists for purpose
   */
  hasValidConsent(dataSubjectId: string, purpose: string): boolean {
    const consents = this.getConsentRecords(dataSubjectId);
    const now = new Date();

    return consents.some(
      c => c.purpose === purpose && c.status === 'granted' && (!c.expiresAt || c.expiresAt > now)
    );
  }

  // ==================== DATA SUBJECT RIGHTS ====================

  /**
   * Submit data subject request
   */
  async submitDataSubjectRequest(
    dataSubjectId: string,
    rightType: DataSubjectRight,
    details: DataSubjectRequest['details'],
    metadata: { ipAddress?: string; userAgent?: string }
  ): Promise<DataSubjectRequest> {
    const requestId = this.generateId('dsr');
    const now = new Date();
    const deadline = new Date(
      now.getTime() + this.config.requestDeadlineDays * 24 * 60 * 60 * 1000
    );

    const request: DataSubjectRequest = {
      id: requestId,
      dataSubjectId,
      rightType,
      status: 'pending',
      requestedAt: now,
      deadline,
      details,
      verification: {
        verified: !this.config.dataSubjectVerificationRequired,
      },
      metadata: {
        ...metadata,
        requestId,
      },
    };

    this.dataSubjectRequests.set(requestId, request);

    // Log audit event
    await this.auditLogger.logComplianceEvent(
      `data_subject_request_${rightType}`,
      'GDPR',
      {
        userId: dataSubjectId,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      'success',
      {
        requestId,
        rightType,
        deadline: deadline.toISOString(),
      }
    );

    this.securityLogger.logSecurityEvent({
      action: 'GDPR_DATA_SUBJECT_REQUEST',
      resource: 'gdpr_compliance',
      reason: `Data subject request submitted: ${rightType}`,
      metadata: {
        requestId,
        dataSubjectId,
        rightType,
      },
    });

    return request;
  }

  /**
   * Verify data subject identity
   */
  async verifyDataSubject(requestId: string, verificationMethod: string): Promise<boolean> {
    const request = this.dataSubjectRequests.get(requestId);

    if (!request) {
      return false;
    }

    request.verification = {
      verified: true,
      verifiedAt: new Date(),
      verificationMethod,
    };
    request.status = 'processing';

    await this.auditLogger.logComplianceEvent(
      'data_subject_verified',
      'GDPR',
      { userId: request.dataSubjectId },
      'success',
      {
        requestId,
        verificationMethod,
      }
    );

    return true;
  }

  /**
   * Process right to access - export personal data
   */
  async processDataAccessRequest(
    requestId: string,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<DataExport | null> {
    const request = this.dataSubjectRequests.get(requestId);

    if (!request || request.rightType !== 'access') {
      return null;
    }

    if (!request.verification.verified) {
      throw new Error('Data subject identity must be verified before processing access request');
    }

    const dataSubjectId = request.dataSubjectId;
    const personalData = this.getPersonalDataRecords(dataSubjectId);
    const consentRecords = this.getConsentRecords(dataSubjectId);

    const dataExport: DataExport = {
      dataSubjectId,
      exportedAt: new Date(),
      format,
      data: {
        personalData,
        consentRecords,
        processingActivities: this.getProcessingActivities(dataSubjectId),
      },
      metadata: {
        version: '1.0',
        encrypted: false,
        signature: this.generateDataSignature(personalData, consentRecords),
      },
    };

    request.status = 'completed';
    request.completedAt = new Date();

    await this.auditLogger.logDataAccess(
      'export',
      `personal_data:${dataSubjectId}`,
      { userId: dataSubjectId },
      'success',
      {
        requestId,
        format,
        dataTypes: personalData.map(d => d.dataType),
        recordCount: personalData.length,
      }
    );

    return dataExport;
  }

  /**
   * Process right to erasure (right to be forgotten)
   */
  async processDataErasureRequest(
    requestId: string,
    specificData?: string[]
  ): Promise<{ deletedRecords: number; anonymizedRecords: number }> {
    const request = this.dataSubjectRequests.get(requestId);

    if (!request || request.rightType !== 'erasure') {
      return { deletedRecords: 0, anonymizedRecords: 0 };
    }

    if (!request.verification.verified) {
      throw new Error('Data subject identity must be verified before processing erasure request');
    }

    const dataSubjectId = request.dataSubjectId;
    let deletedRecords = 0;
    let anonymizedRecords = 0;

    // Get all records for data subject
    const records = this.getPersonalDataRecords(dataSubjectId);

    for (const record of records) {
      if (specificData && specificData.length > 0) {
        if (!specificData.includes(record.dataType)) {
          continue;
        }
      }

      if (this.config.enableAnonymization) {
        // Anonymize the data instead of deletion if required for legal/compliance reasons
        record.data = this.anonymizeData(record.data);
        record.metadata.anonymized = true;
        anonymizedRecords++;
      } else {
        // Delete the record
        this.personalDataRecords.delete(record.id);
        deletedRecords++;
      }
    }

    // Also withdraw all consents
    const consents = this.getConsentRecords(dataSubjectId);
    for (const consent of consents) {
      if (consent.status === 'granted') {
        await this.withdrawConsent(consent.id, {});
      }
    }

    request.status = 'completed';
    request.completedAt = new Date();

    await this.auditLogger.logDataModification(
      'delete',
      `personal_data:${dataSubjectId}`,
      { userId: dataSubjectId },
      'success',
      {
        requestId,
        deletedRecords,
        anonymizedRecords,
        specificData,
      }
    );

    this.securityLogger.logSecurityEvent({
      action: 'GDPR_DATA_ERASURE_COMPLETED',
      resource: 'gdpr_compliance',
      reason: 'Data erasure request processed',
      metadata: {
        requestId,
        dataSubjectId,
        deletedRecords,
        anonymizedRecords,
      },
    });

    return { deletedRecords, anonymizedRecords };
  }

  /**
   * Process right to rectification
   */
  async processDataRectificationRequest(
    requestId: string,
    dataType: string,
    correctedData: Record<string, unknown>
  ): Promise<PersonalDataRecord | null> {
    const request = this.dataSubjectRequests.get(requestId);

    if (!request || request.rightType !== 'rectification') {
      return null;
    }

    if (!request.verification.verified) {
      throw new Error(
        'Data subject identity must be verified before processing rectification request'
      );
    }

    const dataSubjectId = request.dataSubjectId;
    const records = this.getPersonalDataRecords(dataSubjectId);
    const existingRecord = records.find(r => r.dataType === dataType);

    if (existingRecord) {
      existingRecord.data = { ...existingRecord.data, ...correctedData };

      request.status = 'completed';
      request.completedAt = new Date();

      await this.auditLogger.logDataModification(
        'update',
        `personal_data:${dataSubjectId}`,
        { userId: dataSubjectId },
        'success',
        {
          requestId,
          dataType,
          correctedFields: Object.keys(correctedData),
        }
      );

      return existingRecord;
    }

    return null;
  }

  /**
   * Process right to data portability
   */
  async processDataPortabilityRequest(
    requestId: string,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<DataExport | null> {
    const request = this.dataSubjectRequests.get(requestId);

    if (!request || request.rightType !== 'portability') {
      return null;
    }

    if (!request.verification.verified) {
      throw new Error(
        'Data subject identity must be verified before processing portability request'
      );
    }

    // Portability is similar to access but focuses on machine-readable format
    const dataSubjectId = request.dataSubjectId;
    const personalData = this.getPersonalDataRecords(dataSubjectId);
    const consentRecords = this.getConsentRecords(dataSubjectId);

    const dataExport: DataExport = {
      dataSubjectId,
      exportedAt: new Date(),
      format,
      data: {
        personalData,
        consentRecords,
        processingActivities: this.getProcessingActivities(dataSubjectId),
      },
      metadata: {
        version: '1.0',
        encrypted: false,
        signature: this.generateDataSignature(personalData, consentRecords),
      },
    };

    request.status = 'completed';
    request.completedAt = new Date();

    await this.auditLogger.logDataAccess(
      'export',
      `personal_data:${dataSubjectId}`,
      { userId: dataSubjectId },
      'success',
      {
        requestId,
        format,
        dataTypes: personalData.map(d => d.dataType),
        recordCount: personalData.length,
      }
    );

    return dataExport;
  }

  // ==================== DATA MANAGEMENT ====================

  /**
   * Store personal data with GDPR compliance
   */
  async storePersonalData(
    dataSubjectId: string,
    dataType: string,
    data: Record<string, unknown>,
    purpose: string,
    legalBasis: string,
    metadata: {
      source: string;
      retentionPeriod?: number;
      encrypt?: boolean;
    }
  ): Promise<PersonalDataRecord> {
    // Check if consent is required and obtained
    if (this.config.requireExplicitConsent && legalBasis === 'consent') {
      if (!this.hasValidConsent(dataSubjectId, purpose)) {
        throw new Error(`Valid consent required for purpose: ${purpose}`);
      }
    }

    // Apply data minimization if enabled
    const minimizedData = this.config.enableDataMinimization
      ? this.minimizeData(data, purpose)
      : data;

    const recordId = this.generateId('data');
    const now = new Date();
    const retentionPeriod = metadata.retentionPeriod || this.config.dataRetentionDays;
    const expiresAt = new Date(now.getTime() + retentionPeriod * 24 * 60 * 60 * 1000);

    const record: PersonalDataRecord = {
      id: recordId,
      dataSubjectId,
      dataType,
      data: minimizedData,
      purpose,
      legalBasis,
      collectedAt: now,
      expiresAt,
      retentionPeriod,
      metadata: {
        source: metadata.source,
        encrypted: metadata.encrypt || false,
        anonymized: false,
        pseudonymized: this.config.enablePseudonymization,
      },
    };

    this.personalDataRecords.set(recordId, record);

    await this.auditLogger.logDataModification(
      'create',
      `personal_data:${dataType}`,
      { userId: dataSubjectId },
      'success',
      {
        recordId,
        dataType,
        purpose,
        legalBasis,
        retentionPeriod,
      }
    );

    return record;
  }

  /**
   * Get personal data records for data subject
   */
  getPersonalDataRecords(dataSubjectId: string): PersonalDataRecord[] {
    return Array.from(this.personalDataRecords.values()).filter(
      r => r.dataSubjectId === dataSubjectId
    );
  }

  /**
   * Get data subject requests
   */
  getDataSubjectRequests(dataSubjectId: string): DataSubjectRequest[] {
    return Array.from(this.dataSubjectRequests.values()).filter(
      r => r.dataSubjectId === dataSubjectId
    );
  }

  // ==================== PRIVACY BY DESIGN ====================

  /**
   * Create privacy impact assessment
   */
  async createPrivacyImpactAssessment(
    processingActivity: string,
    description: string,
    dataTypes: string[],
    purposes: string[],
    legalBasis: string
  ): Promise<PrivacyImpactAssessment> {
    const assessmentId = this.generateId('pia');

    const assessment: PrivacyImpactAssessment = {
      id: assessmentId,
      processingActivity,
      description,
      dataTypes,
      purposes,
      legalBasis,
      riskAssessment: {
        likelihood: 'medium',
        severity: 'medium',
        overallRisk: 'medium',
      },
      mitigationMeasures: [],
      dataSubjectRights: ['access', 'rectification', 'erasure', 'portability'],
      createdAt: new Date(),
    };

    this.privacyAssessments.set(assessmentId, assessment);

    await this.auditLogger.logComplianceEvent('privacy_assessment_created', 'GDPR', {}, 'success', {
      assessmentId,
      processingActivity,
      dataTypes,
      purposes,
    });

    return assessment;
  }

  /**
   * Apply data minimization
   */
  private minimizeData(data: Record<string, unknown>, purpose: string): Record<string, unknown> {
    // Define minimum required fields per purpose
    const purposeRequirements: Record<string, string[]> = {
      authentication: ['userId', 'sessionId'],
      analytics: ['sessionId', 'timestamp'],
      captcha: ['sessionId', 'captchaType', 'verified'],
      security: ['ipAddress', 'userAgent', 'timestamp'],
    };

    const requiredFields = purposeRequirements[purpose] || Object.keys(data);
    const minimized: Record<string, unknown> = {};

    for (const field of requiredFields) {
      if (data[field] !== undefined) {
        minimized[field] = data[field];
      }
    }

    return minimized;
  }

  /**
   * Anonymize data
   */
  private anonymizeData(data: Record<string, unknown>): Record<string, unknown> {
    const anonymized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Hash string values
        anonymized[key] = crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
      } else if (typeof value === 'number') {
        // Round numbers to reduce precision
        anonymized[key] = Math.round(value / 10) * 10;
      } else {
        anonymized[key] = '[ANONYMIZED]';
      }
    }

    return anonymized;
  }

  /**
   * Pseudonymize data
   */
  pseudonymizeData(data: Record<string, unknown>, salt: string): Record<string, unknown> {
    const pseudonymized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('id') || key.toLowerCase().includes('email')) {
        // Pseudonymize identifiers
        pseudonymized[key] = crypto
          .createHmac('sha256', salt)
          .update(String(value))
          .digest('hex')
          .substring(0, 16);
      } else {
        pseudonymized[key] = value;
      }
    }

    return pseudonymized;
  }

  // ==================== DATA RETENTION ====================

  /**
   * Apply data retention policy
   */
  async applyRetentionPolicy(): Promise<{
    deletedRecords: number;
    expiredConsents: number;
  }> {
    const now = new Date();
    let deletedRecords = 0;
    let expiredConsents = 0;

    // Delete expired personal data
    for (const [recordId, record] of this.personalDataRecords.entries()) {
      if (record.expiresAt && record.expiresAt < now) {
        this.personalDataRecords.delete(recordId);
        deletedRecords++;
      }
    }

    // Mark expired consents
    for (const consent of this.consentRecords.values()) {
      if (consent.status === 'granted' && consent.expiresAt && consent.expiresAt < now) {
        consent.status = 'denied';
        consent.updatedAt = now;
        expiredConsents++;
      }
    }

    if (deletedRecords > 0 || expiredConsents > 0) {
      await this.auditLogger.logComplianceEvent('retention_policy_applied', 'GDPR', {}, 'success', {
        deletedRecords,
        expiredConsents,
      });
    }

    return { deletedRecords, expiredConsents };
  }

  // ==================== COMPLIANCE REPORTING ====================

  /**
   * Generate GDPR compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { startDate: Date; endDate: Date };
    consentStatistics: {
      totalConsents: number;
      grantedConsents: number;
      withdrawnConsents: number;
      expiredConsents: number;
    };
    dataSubjectRequests: {
      total: number;
      byType: Record<DataSubjectRight, number>;
      completed: number;
      pending: number;
      averageCompletionTime: number;
    };
    dataRetention: {
      totalRecords: number;
      expiredRecords: number;
      anonymizedRecords: number;
    };
    complianceStatus: {
      consentCompliance: boolean;
      dataMinimization: boolean;
      rightToErasure: boolean;
      dataPortability: boolean;
    };
  }> {
    const consents = Array.from(this.consentRecords.values()).filter(
      c => c.createdAt >= startDate && c.createdAt <= endDate
    );

    const requests = Array.from(this.dataSubjectRequests.values()).filter(
      r => r.requestedAt >= startDate && r.requestedAt <= endDate
    );

    const records = Array.from(this.personalDataRecords.values());

    const completedRequests = requests.filter(r => r.status === 'completed');
    const totalCompletionTime = completedRequests.reduce((sum, r) => {
      if (r.completedAt) {
        return sum + (r.completedAt.getTime() - r.requestedAt.getTime());
      }
      return sum;
    }, 0);

    return {
      period: { startDate, endDate },
      consentStatistics: {
        totalConsents: consents.length,
        grantedConsents: consents.filter(c => c.status === 'granted').length,
        withdrawnConsents: consents.filter(c => c.status === 'withdrawn').length,
        expiredConsents: consents.filter(
          c => c.status === 'granted' && c.expiresAt && c.expiresAt < new Date()
        ).length,
      },
      dataSubjectRequests: {
        total: requests.length,
        byType: {
          access: requests.filter(r => r.rightType === 'access').length,
          rectification: requests.filter(r => r.rightType === 'rectification').length,
          erasure: requests.filter(r => r.rightType === 'erasure').length,
          restriction: requests.filter(r => r.rightType === 'restriction').length,
          portability: requests.filter(r => r.rightType === 'portability').length,
          objection: requests.filter(r => r.rightType === 'objection').length,
        },
        completed: completedRequests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        averageCompletionTime:
          completedRequests.length > 0 ? totalCompletionTime / completedRequests.length : 0,
      },
      dataRetention: {
        totalRecords: records.length,
        expiredRecords: records.filter(r => r.expiresAt && r.expiresAt < new Date()).length,
        anonymizedRecords: records.filter(r => r.metadata.anonymized).length,
      },
      complianceStatus: {
        consentCompliance: this.config.requireExplicitConsent,
        dataMinimization: this.config.enableDataMinimization,
        rightToErasure: true,
        dataPortability: true,
      },
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get processing activities for data subject
   */
  private getProcessingActivities(
    dataSubjectId: string
  ): DataExport['data']['processingActivities'] {
    const records = this.getPersonalDataRecords(dataSubjectId);
    const activities: Map<string, DataExport['data']['processingActivities'][0]> = new Map();

    for (const record of records) {
      if (!activities.has(record.purpose)) {
        activities.set(record.purpose, {
          purpose: record.purpose,
          legalBasis: record.legalBasis,
          dataTypes: [],
          retentionPeriod: record.retentionPeriod,
        });
      }

      const activity = activities.get(record.purpose)!;
      if (!activity.dataTypes.includes(record.dataType)) {
        activity.dataTypes.push(record.dataType);
      }
    }

    return Array.from(activities.values());
  }

  /**
   * Generate data signature for integrity verification
   */
  private generateDataSignature(
    personalData: PersonalDataRecord[],
    consentRecords: ConsentRecord[]
  ): string {
    const data = JSON.stringify({
      personalData: personalData.map(p => p.id),
      consentRecords: consentRecords.map(c => c.id),
      timestamp: new Date().toISOString(),
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalConsents: number;
    activeConsents: number;
    totalDataRecords: number;
    totalRequests: number;
    pendingRequests: number;
    totalAssessments: number;
  } {
    const now = new Date();

    return {
      totalConsents: this.consentRecords.size,
      activeConsents: Array.from(this.consentRecords.values()).filter(
        c => c.status === 'granted' && (!c.expiresAt || c.expiresAt > now)
      ).length,
      totalDataRecords: this.personalDataRecords.size,
      totalRequests: this.dataSubjectRequests.size,
      pendingRequests: Array.from(this.dataSubjectRequests.values()).filter(
        r => r.status === 'pending'
      ).length,
      totalAssessments: this.privacyAssessments.size,
    };
  }
}

// Singleton instance
let gdprComplianceInstance: GDPRComplianceService | null = null;

export function getGDPRComplianceService(
  config?: GDPRConfig,
  auditLogger?: AuditLogger,
  securityLogger?: SecurityLogger
): GDPRComplianceService {
  if (!gdprComplianceInstance) {
    if (!auditLogger || !securityLogger) {
      throw new Error('AuditLogger and SecurityLogger are required for first initialization');
    }
    gdprComplianceInstance = new GDPRComplianceService(
      config || defaultGDPRConfig,
      auditLogger,
      securityLogger
    );
  }
  return gdprComplianceInstance;
}

export function resetGDPRComplianceService(): void {
  gdprComplianceInstance = null;
}
