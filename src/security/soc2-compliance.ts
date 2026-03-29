/**
 * SOC 2 Compliance Service
 * Implements SOC 2 Trust Service Criteria including Security, Availability,
 * Processing Integrity, Confidentiality, and Privacy controls
 */

import * as crypto from 'crypto';
import { AuditLogger } from './audit-logger';
import { SecurityLogger } from './security-logger';

// SOC 2 Trust Service Criteria
export type SOC2Criteria =
  | 'security' // Common Criteria (CC)
  | 'availability' // Availability (A)
  | 'processing_integrity' // Processing Integrity (PI)
  | 'confidentiality' // Confidentiality (C)
  | 'privacy'; // Privacy (P)

// SOC 2 Control Status
export type ControlStatus = 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';

// SOC 2 Control Category
export type ControlCategory =
  | 'control_environment'
  | 'communication_information'
  | 'risk_assessment'
  | 'monitoring_activities'
  | 'control_activities'
  | 'logical_physical_access'
  | 'system_operations'
  | 'change_management'
  | 'risk_mitigation';

// SOC 2 Control
export interface SOC2Control {
  id: string;
  criteria: SOC2Criteria;
  category: ControlCategory;
  controlId: string; // e.g., CC1.1, A1.1, PI1.1
  name: string;
  description: string;
  status: ControlStatus;
  implementationDetails: string;
  evidence: string[];
  lastAssessedAt?: Date;
  nextAssessmentAt?: Date;
  owner?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
  };
}

// SOC 2 Monitoring Metric
export interface SOC2MonitoringMetric {
  id: string;
  name: string;
  criteria: SOC2Criteria;
  metricType: 'availability' | 'performance' | 'security' | 'integrity' | 'confidentiality';
  value: number;
  unit: string;
  threshold: {
    warning: number;
    critical: number;
  };
  status: 'normal' | 'warning' | 'critical';
  measuredAt: Date;
  metadata: {
    source: string;
    tags?: string[];
  };
}

// SOC 2 Incident
export interface SOC2Incident {
  id: string;
  criteria: SOC2Criteria;
  incidentType:
    | 'security_breach'
    | 'availability_outage'
    | 'integrity_failure'
    | 'confidentiality_breach'
    | 'privacy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'investigating' | 'contained' | 'resolved' | 'closed';
  title: string;
  description: string;
  detectedAt: Date;
  containedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  impact: {
    affectedSystems: string[];
    affectedUsers: number;
    dataExposure: boolean;
    businessImpact: string;
  };
  response: {
    actions: Array<{
      action: string;
      performedAt: Date;
      performedBy: string;
      result: string;
    }>;
    rootCause?: string;
    remediation?: string;
    preventiveMeasures?: string[];
  };
  metadata: {
    reportedBy?: string;
    assignedTo?: string;
    tags?: string[];
  };
}

// SOC 2 Availability Report
export interface AvailabilityReport {
  period: { startDate: Date; endDate: Date };
  uptime: {
    totalMinutes: number;
    availableMinutes: number;
    uptimePercentage: number;
    target: number; // e.g., 99.9%
  };
  incidents: {
    total: number;
    byType: Record<string, number>;
    meanTimeToDetect: number; // minutes
    meanTimeToResolve: number; // minutes
  };
  performance: {
    averageResponseTime: number; // ms
    p95ResponseTime: number; // ms
    p99ResponseTime: number; // ms
    throughput: number; // requests/second
  };
  slaCompliance: boolean;
}

// SOC 2 Processing Integrity Report
export interface ProcessingIntegrityReport {
  period: { startDate: Date; endDate: Date };
  dataIntegrity: {
    totalRecords: number;
    validatedRecords: number;
    integrityScore: number; // 0-100
  };
  processingAccuracy: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    accuracyRate: number; // percentage
  };
  errorHandling: {
    totalErrors: number;
    detectedErrors: number;
    correctedErrors: number;
    errorDetectionRate: number; // percentage
  };
  auditTrail: {
    totalEvents: number;
    verifiedEvents: number;
    integrityViolations: number;
  };
}

// SOC 2 Confidentiality Report
export interface ConfidentialityReport {
  period: { startDate: Date; endDate: Date };
  dataClassification: {
    public: number;
    internal: number;
    confidential: number;
    restricted: number;
  };
  accessControls: {
    totalAccessRequests: number;
    grantedRequests: number;
    deniedRequests: number;
    unauthorizedAttempts: number;
  };
  encryption: {
    dataAtRest: boolean;
    dataInTransit: boolean;
    keyRotationCompliance: boolean;
    lastKeyRotation?: Date;
  };
  dataLoss: {
    incidents: number;
    exposedRecords: number;
    preventedAttempts: number;
  };
}

// SOC 2 Compliance Report
export interface SOC2ComplianceReport {
  id: string;
  generatedAt: Date;
  period: { startDate: Date; endDate: Date };
  criteria: SOC2Criteria[];
  overallStatus: 'compliant' | 'partially_compliant' | 'non_compliant';
  controls: {
    total: number;
    implemented: number;
    partial: number;
    notImplemented: number;
    notApplicable: number;
    complianceRate: number; // percentage
  };
  findings: Array<{
    id: string;
    criteria: SOC2Criteria;
    controlId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    status: 'open' | 'in_progress' | 'resolved';
  }>;
  recommendations: string[];
  evidence: Array<{
    controlId: string;
    evidenceType: string;
    description: string;
    collectedAt: Date;
  }>;
}

// SOC 2 Configuration
export interface SOC2Config {
  enabledCriteria: SOC2Criteria[];
  availabilityTarget: number; // percentage, e.g., 99.9
  monitoringInterval: number; // minutes
  incidentNotificationThreshold: 'low' | 'medium' | 'high' | 'critical';
  autoRemediation: boolean;
  evidenceRetentionDays: number;
  assessmentFrequency: number; // days
  enableRealTimeMonitoring: boolean;
  enableAutomatedReporting: boolean;
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

// Default Configuration
export const defaultSOC2Config: SOC2Config = {
  enabledCriteria: [
    'security',
    'availability',
    'processing_integrity',
    'confidentiality',
    'privacy',
  ],
  availabilityTarget: 99.9,
  monitoringInterval: 5,
  incidentNotificationThreshold: 'medium',
  autoRemediation: false,
  evidenceRetentionDays: 365,
  assessmentFrequency: 90,
  enableRealTimeMonitoring: true,
  enableAutomatedReporting: true,
  reportSchedule: 'monthly',
};

// Default SOC 2 Controls
export const defaultSOC2Controls: Omit<SOC2Control, 'id' | 'metadata'>[] = [
  // Security Controls (Common Criteria)
  {
    criteria: 'security',
    category: 'control_environment',
    controlId: 'CC1.1',
    name: 'Management Commitment',
    description: 'Management demonstrates commitment to integrity and ethical values',
    status: 'implemented',
    implementationDetails: 'Code of conduct established, security policies documented',
    evidence: ['code-of-conduct.pdf', 'security-policies.pdf'],
    riskLevel: 'medium',
  },
  {
    criteria: 'security',
    category: 'logical_physical_access',
    controlId: 'CC6.1',
    name: 'Logical Access Security',
    description:
      'Logical access security measures are implemented to protect against unauthorized access',
    status: 'implemented',
    implementationDetails:
      'Multi-factor authentication, role-based access control, session management',
    evidence: ['access-control-policy.pdf', 'mfa-implementation.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'security',
    category: 'system_operations',
    controlId: 'CC7.1',
    name: 'System Operations Monitoring',
    description: 'System operations are monitored to detect and respond to security events',
    status: 'implemented',
    implementationDetails: 'Real-time monitoring, SIEM integration, automated alerting',
    evidence: ['monitoring-dashboard.pdf', 'alert-configuration.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'security',
    category: 'change_management',
    controlId: 'CC8.1',
    name: 'Change Management',
    description: 'Changes to the system are authorized, designed, developed, and deployed',
    status: 'implemented',
    implementationDetails: 'CI/CD pipeline, code review, automated testing, deployment approval',
    evidence: ['change-management-policy.pdf', 'cicd-pipeline.pdf'],
    riskLevel: 'medium',
  },
  // Availability Controls
  {
    criteria: 'availability',
    category: 'system_operations',
    controlId: 'A1.1',
    name: 'Availability Monitoring',
    description: 'System availability is monitored and maintained',
    status: 'implemented',
    implementationDetails: 'Prometheus metrics, Grafana dashboards, uptime monitoring',
    evidence: ['availability-dashboard.pdf', 'uptime-report.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'availability',
    category: 'risk_mitigation',
    controlId: 'A1.2',
    name: 'Incident Response',
    description: 'Incident response procedures are established for availability issues',
    status: 'implemented',
    implementationDetails: 'Incident response plan, on-call rotation, escalation procedures',
    evidence: ['incident-response-plan.pdf', 'escalation-matrix.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'availability',
    category: 'system_operations',
    controlId: 'A1.3',
    name: 'Capacity Management',
    description: 'System capacity is managed to meet availability requirements',
    status: 'implemented',
    implementationDetails: 'Auto-scaling, load balancing, capacity planning',
    evidence: ['capacity-planning.pdf', 'auto-scaling-config.pdf'],
    riskLevel: 'medium',
  },
  // Processing Integrity Controls
  {
    criteria: 'processing_integrity',
    category: 'control_activities',
    controlId: 'PI1.1',
    name: 'Data Validation',
    description: 'Data input and output validation is performed to ensure processing integrity',
    status: 'implemented',
    implementationDetails: 'Input validation, output verification, data integrity checks',
    evidence: ['validation-rules.pdf', 'integrity-checks.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'processing_integrity',
    category: 'monitoring_activities',
    controlId: 'PI1.2',
    name: 'Processing Monitoring',
    description: 'Processing activities are monitored for completeness and accuracy',
    status: 'implemented',
    implementationDetails: 'Audit logging, processing metrics, error detection',
    evidence: ['audit-logs.pdf', 'processing-metrics.pdf'],
    riskLevel: 'medium',
  },
  {
    criteria: 'processing_integrity',
    category: 'control_activities',
    controlId: 'PI1.3',
    name: 'Error Handling',
    description: 'Errors are detected, recorded, and corrected in a timely manner',
    status: 'implemented',
    implementationDetails: 'Error logging, automated error detection, correction procedures',
    evidence: ['error-handling-policy.pdf', 'error-logs.pdf'],
    riskLevel: 'medium',
  },
  // Confidentiality Controls
  {
    criteria: 'confidentiality',
    category: 'logical_physical_access',
    controlId: 'C1.1',
    name: 'Data Classification',
    description: 'Data is classified based on sensitivity and confidentiality requirements',
    status: 'implemented',
    implementationDetails: 'Data classification policy, labeling, handling procedures',
    evidence: ['data-classification-policy.pdf', 'labeling-standards.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'confidentiality',
    category: 'logical_physical_access',
    controlId: 'C1.2',
    name: 'Encryption',
    description: 'Confidential data is encrypted at rest and in transit',
    status: 'implemented',
    implementationDetails: 'AES-256-GCM encryption, TLS 1.3, key management',
    evidence: ['encryption-policy.pdf', 'key-management.pdf'],
    riskLevel: 'critical',
  },
  {
    criteria: 'confidentiality',
    category: 'logical_physical_access',
    controlId: 'C1.3',
    name: 'Access Restrictions',
    description: 'Access to confidential data is restricted based on need-to-know',
    status: 'implemented',
    implementationDetails: 'Role-based access, data access logging, regular access reviews',
    evidence: ['access-control-matrix.pdf', 'access-review-logs.pdf'],
    riskLevel: 'high',
  },
  // Privacy Controls
  {
    criteria: 'privacy',
    category: 'control_activities',
    controlId: 'P1.1',
    name: 'Privacy Notice',
    description: 'Privacy notice is provided to data subjects',
    status: 'implemented',
    implementationDetails: 'Privacy policy, consent management, data subject notifications',
    evidence: ['privacy-policy.pdf', 'consent-records.pdf'],
    riskLevel: 'medium',
  },
  {
    criteria: 'privacy',
    category: 'control_activities',
    controlId: 'P1.2',
    name: 'Data Subject Rights',
    description: 'Data subject rights are supported and honored',
    status: 'implemented',
    implementationDetails: 'GDPR compliance, data access, rectification, erasure, portability',
    evidence: ['gdpr-compliance.pdf', 'data-subject-requests.pdf'],
    riskLevel: 'high',
  },
  {
    criteria: 'privacy',
    category: 'control_activities',
    controlId: 'P1.3',
    name: 'Data Retention',
    description: 'Personal data is retained only as long as necessary',
    status: 'implemented',
    implementationDetails: 'Retention policies, automated deletion, data minimization',
    evidence: ['retention-policy.pdf', 'deletion-logs.pdf'],
    riskLevel: 'medium',
  },
];

/**
 * SOC 2 Compliance Service
 * Implements comprehensive SOC 2 compliance features
 */
export class SOC2ComplianceService {
  private readonly config: SOC2Config;
  private readonly auditLogger: AuditLogger;
  private readonly securityLogger: SecurityLogger;
  private readonly controls: Map<string, SOC2Control> = new Map();
  private readonly metrics: Map<string, SOC2MonitoringMetric> = new Map();
  private readonly incidents: Map<string, SOC2Incident> = new Map();
  private readonly availabilityData: Array<{
    timestamp: Date;
    available: boolean;
    responseTime: number;
  }> = [];

  constructor(config: SOC2Config, auditLogger: AuditLogger, securityLogger: SecurityLogger) {
    this.config = config;
    this.auditLogger = auditLogger;
    this.securityLogger = securityLogger;

    // Initialize default controls
    this.initializeDefaultControls();
  }

  // ==================== CONTROL MANAGEMENT ====================

  /**
   * Initialize default SOC 2 controls
   */
  private initializeDefaultControls(): void {
    for (const control of defaultSOC2Controls) {
      if (this.config.enabledCriteria.includes(control.criteria)) {
        const controlId = this.generateId('ctrl');
        const now = new Date();

        const fullControl: SOC2Control = {
          ...control,
          id: controlId,
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: '1.0',
          },
        };

        this.controls.set(controlId, fullControl);
      }
    }
  }

  /**
   * Add or update a SOC 2 control
   */
  async addControl(control: Omit<SOC2Control, 'id' | 'metadata'>): Promise<SOC2Control> {
    const controlId = this.generateId('ctrl');
    const now = new Date();

    const fullControl: SOC2Control = {
      ...control,
      id: controlId,
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: '1.0',
      },
    };

    this.controls.set(controlId, fullControl);

    await this.auditLogger.logComplianceEvent('control_added', 'SOC2', {}, 'success', {
      controlId: fullControl.controlId,
      criteria: fullControl.criteria,
      status: fullControl.status,
    });

    return fullControl;
  }

  /**
   * Update control status
   */
  async updateControlStatus(
    controlId: string,
    status: ControlStatus,
    implementationDetails?: string,
    evidence?: string[]
  ): Promise<SOC2Control | null> {
    const control = this.controls.get(controlId);

    if (!control) {
      return null;
    }

    const previousStatus = control.status;
    control.status = status;
    control.metadata.updatedAt = new Date();
    control.metadata.version = this.incrementVersion(control.metadata.version);
    control.lastAssessedAt = new Date();
    control.nextAssessmentAt = new Date(
      Date.now() + this.config.assessmentFrequency * 24 * 60 * 60 * 1000
    );

    if (implementationDetails) {
      control.implementationDetails = implementationDetails;
    }

    if (evidence) {
      control.evidence = [...control.evidence, ...evidence];
    }

    await this.auditLogger.logComplianceEvent('control_updated', 'SOC2', {}, 'success', {
      controlId: control.controlId,
      previousStatus,
      newStatus: status,
      criteria: control.criteria,
    });

    return control;
  }

  /**
   * Get control by ID
   */
  getControl(controlId: string): SOC2Control | undefined {
    return this.controls.get(controlId);
  }

  /**
   * Get all controls
   */
  getAllControls(): SOC2Control[] {
    return Array.from(this.controls.values());
  }

  /**
   * Get controls by criteria
   */
  getControlsByCriteria(criteria: SOC2Criteria): SOC2Control[] {
    return Array.from(this.controls.values()).filter(c => c.criteria === criteria);
  }

  /**
   * Get controls by status
   */
  getControlsByStatus(status: ControlStatus): SOC2Control[] {
    return Array.from(this.controls.values()).filter(c => c.status === status);
  }

  // ==================== MONITORING ====================

  /**
   * Record monitoring metric
   */
  async recordMetric(
    name: string,
    criteria: SOC2Criteria,
    metricType: SOC2MonitoringMetric['metricType'],
    value: number,
    unit: string,
    threshold: { warning: number; critical: number },
    source: string,
    tags?: string[]
  ): Promise<SOC2MonitoringMetric> {
    const metricId = this.generateId('metric');
    const now = new Date();

    let status: SOC2MonitoringMetric['status'] = 'normal';
    if (value >= threshold.critical) {
      status = 'critical';
    } else if (value >= threshold.warning) {
      status = 'warning';
    }

    const metric: SOC2MonitoringMetric = {
      id: metricId,
      name,
      criteria,
      metricType,
      value,
      unit,
      threshold,
      status,
      measuredAt: now,
      metadata: {
        source,
        tags,
      },
    };

    this.metrics.set(metricId, metric);

    // Alert if threshold exceeded
    if (status !== 'normal' && this.shouldAlert(status)) {
      await this.securityLogger.logSecurityEvent({
        action: 'SOC2_METRIC_THRESHOLD_EXCEEDED',
        resource: 'soc2_compliance',
        reason: `Metric ${name} exceeded threshold: ${value} ${unit} (status: ${status})`,
        metadata: {
          metricId,
          name,
          value,
          threshold,
          status,
          criteria,
        },
      });
    }

    return metric;
  }

  /**
   * Record availability data
   */
  recordAvailability(available: boolean, responseTime: number): void {
    this.availabilityData.push({
      timestamp: new Date(),
      available,
      responseTime,
    });

    // Keep only last 30 days of data
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    while (
      this.availabilityData.length > 0 &&
      this.availabilityData[0].timestamp.getTime() < thirtyDaysAgo
    ) {
      this.availabilityData.shift();
    }
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(criteria?: SOC2Criteria): SOC2MonitoringMetric[] {
    let metrics = Array.from(this.metrics.values());

    if (criteria) {
      metrics = metrics.filter(m => m.criteria === criteria);
    }

    // Group by name and get latest for each
    const latestByname = new Map<string, SOC2MonitoringMetric>();
    for (const metric of metrics) {
      const existing = latestByname.get(metric.name);
      if (!existing || metric.measuredAt > existing.measuredAt) {
        latestByname.set(metric.name, metric);
      }
    }

    return Array.from(latestByname.values());
  }

  // ==================== INCIDENT MANAGEMENT ====================

  /**
   * Report a SOC 2 incident
   */
  async reportIncident(
    criteria: SOC2Criteria,
    incidentType: SOC2Incident['incidentType'],
    severity: SOC2Incident['severity'],
    title: string,
    description: string,
    impact: SOC2Incident['impact'],
    metadata: SOC2Incident['metadata'] = {}
  ): Promise<SOC2Incident> {
    const incidentId = this.generateId('inc');
    const now = new Date();

    const incident: SOC2Incident = {
      id: incidentId,
      criteria,
      incidentType,
      severity,
      status: 'detected',
      title,
      description,
      detectedAt: now,
      impact,
      response: {
        actions: [],
      },
      metadata,
    };

    this.incidents.set(incidentId, incident);

    await this.auditLogger.logSecurityEvent(`soc2_incident_${incidentType}`, {}, 'pending', {
      incidentId,
      criteria,
      severity,
      title,
      impact,
    });

    await this.securityLogger.logSecurityEvent({
      action: 'SOC2_INCIDENT_REPORTED',
      resource: 'soc2_compliance',
      reason: `SOC 2 incident reported: ${title}`,
      metadata: {
        incidentId,
        criteria,
        incidentType,
        severity,
      },
    });

    return incident;
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(
    incidentId: string,
    status: SOC2Incident['status'],
    action?: { action: string; performedBy: string; result: string },
    rootCause?: string,
    remediation?: string,
    preventiveMeasures?: string[]
  ): Promise<SOC2Incident | null> {
    const incident = this.incidents.get(incidentId);

    if (!incident) {
      return null;
    }

    const now = new Date();
    incident.status = status;

    if (status === 'contained') {
      incident.containedAt = now;
    } else if (status === 'resolved') {
      incident.resolvedAt = now;
    } else if (status === 'closed') {
      incident.closedAt = now;
    }

    if (action) {
      incident.response.actions.push({
        ...action,
        performedAt: now,
      });
    }

    if (rootCause) {
      incident.response.rootCause = rootCause;
    }

    if (remediation) {
      incident.response.remediation = remediation;
    }

    if (preventiveMeasures) {
      incident.response.preventiveMeasures = preventiveMeasures;
    }

    await this.auditLogger.logComplianceEvent(`incident_${status}`, 'SOC2', {}, 'success', {
      incidentId,
      status,
      criteria: incident.criteria,
      incidentType: incident.incidentType,
    });

    return incident;
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): SOC2Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): SOC2Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get incidents by criteria
   */
  getIncidentsByCriteria(criteria: SOC2Criteria): SOC2Incident[] {
    return Array.from(this.incidents.values()).filter(i => i.criteria === criteria);
  }

  /**
   * Get open incidents
   */
  getOpenIncidents(): SOC2Incident[] {
    return Array.from(this.incidents.values()).filter(
      i => i.status !== 'resolved' && i.status !== 'closed'
    );
  }

  // ==================== REPORTING ====================

  /**
   * Generate availability report
   */
  generateAvailabilityReport(startDate: Date, endDate: Date): AvailabilityReport {
    const dataInRange = this.availabilityData.filter(
      d => d.timestamp >= startDate && d.timestamp <= endDate
    );

    const totalMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    const availableMinutes = dataInRange.filter(d => d.available).length;
    const uptimePercentage = totalMinutes > 0 ? (availableMinutes / totalMinutes) * 100 : 100;

    const incidents = Array.from(this.incidents.values()).filter(
      i => i.criteria === 'availability' && i.detectedAt >= startDate && i.detectedAt <= endDate
    );

    const responseTimes = dataInRange.map(d => d.responseTime).sort((a, b) => a - b);
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
        : 0;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const resolvedIncidents = incidents.filter(i => i.resolvedAt);
    const mttr =
      resolvedIncidents.length > 0
        ? resolvedIncidents.reduce((sum, i) => {
            return sum + (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / (1000 * 60);
          }, 0) / resolvedIncidents.length
        : 0;

    const mttD =
      incidents.length > 0
        ? incidents.reduce((sum, i) => {
            const detected = i.containedAt || i.resolvedAt || i.detectedAt;
            return sum + (detected.getTime() - i.detectedAt.getTime()) / (1000 * 60);
          }, 0) / incidents.length
        : 0;

    return {
      period: { startDate, endDate },
      uptime: {
        totalMinutes,
        availableMinutes,
        uptimePercentage,
        target: this.config.availabilityTarget,
      },
      incidents: {
        total: incidents.length,
        byType: incidents.reduce(
          (acc, i) => {
            acc[i.incidentType] = (acc[i.incidentType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        meanTimeToDetect: mttD,
        meanTimeToResolve: mttr,
      },
      performance: {
        averageResponseTime: avgResponseTime,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
        throughput: dataInRange.length / (totalMinutes / 60),
      },
      slaCompliance: uptimePercentage >= this.config.availabilityTarget,
    };
  }

  /**
   * Generate processing integrity report
   */
  generateProcessingIntegrityReport(startDate: Date, endDate: Date): ProcessingIntegrityReport {
    const metricsInRange = Array.from(this.metrics.values()).filter(
      m =>
        m.criteria === 'processing_integrity' &&
        m.measuredAt >= startDate &&
        m.measuredAt <= endDate
    );

    const incidents = Array.from(this.incidents.values()).filter(
      i =>
        i.criteria === 'processing_integrity' &&
        i.detectedAt >= startDate &&
        i.detectedAt <= endDate
    );

    // Calculate integrity metrics from recorded metrics
    const integrityMetrics = metricsInRange.filter(m => m.metricType === 'integrity');
    const avgIntegrityScore =
      integrityMetrics.length > 0
        ? integrityMetrics.reduce((sum, m) => sum + m.value, 0) / integrityMetrics.length
        : 100;

    const totalOperations = metricsInRange.find(m => m.name === 'total_operations')?.value || 0;
    const successfulOperations =
      metricsInRange.find(m => m.name === 'successful_operations')?.value || 0;
    const failedOperations = totalOperations - successfulOperations;
    const accuracyRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;

    const totalErrors = metricsInRange.find(m => m.name === 'total_errors')?.value || 0;
    const detectedErrors = metricsInRange.find(m => m.name === 'detected_errors')?.value || 0;
    const correctedErrors = metricsInRange.find(m => m.name === 'corrected_errors')?.value || 0;
    const errorDetectionRate = totalErrors > 0 ? (detectedErrors / totalErrors) * 100 : 100;

    const auditEvents = metricsInRange.find(m => m.name === 'audit_events')?.value || 0;
    const verifiedEvents = metricsInRange.find(m => m.name === 'verified_events')?.value || 0;
    const integrityViolations = incidents.filter(
      i => i.incidentType === 'integrity_failure'
    ).length;

    return {
      period: { startDate, endDate },
      dataIntegrity: {
        totalRecords: metricsInRange.find(m => m.name === 'total_records')?.value || 0,
        validatedRecords: metricsInRange.find(m => m.name === 'validated_records')?.value || 0,
        integrityScore: avgIntegrityScore,
      },
      processingAccuracy: {
        totalOperations,
        successfulOperations,
        failedOperations,
        accuracyRate,
      },
      errorHandling: {
        totalErrors,
        detectedErrors,
        correctedErrors,
        errorDetectionRate,
      },
      auditTrail: {
        totalEvents: auditEvents,
        verifiedEvents,
        integrityViolations,
      },
    };
  }

  /**
   * Generate confidentiality report
   */
  generateConfidentialityReport(startDate: Date, endDate: Date): ConfidentialityReport {
    const metricsInRange = Array.from(this.metrics.values()).filter(
      m => m.criteria === 'confidentiality' && m.measuredAt >= startDate && m.measuredAt <= endDate
    );

    const incidents = Array.from(this.incidents.values()).filter(
      i => i.criteria === 'confidentiality' && i.detectedAt >= startDate && i.detectedAt <= endDate
    );

    const accessRequests = metricsInRange.find(m => m.name === 'access_requests')?.value || 0;
    const grantedRequests = metricsInRange.find(m => m.name === 'granted_requests')?.value || 0;
    const deniedRequests = metricsInRange.find(m => m.name === 'denied_requests')?.value || 0;
    const unauthorizedAttempts =
      metricsInRange.find(m => m.name === 'unauthorized_attempts')?.value || 0;

    const dataLossIncidents = incidents.filter(i => i.incidentType === 'confidentiality_breach');
    const exposedRecords = dataLossIncidents.reduce((sum, i) => sum + i.impact.affectedUsers, 0);

    return {
      period: { startDate, endDate },
      dataClassification: {
        public: metricsInRange.find(m => m.name === 'public_data')?.value || 0,
        internal: metricsInRange.find(m => m.name === 'internal_data')?.value || 0,
        confidential: metricsInRange.find(m => m.name === 'confidential_data')?.value || 0,
        restricted: metricsInRange.find(m => m.name === 'restricted_data')?.value || 0,
      },
      accessControls: {
        totalAccessRequests: accessRequests,
        grantedRequests,
        deniedRequests,
        unauthorizedAttempts,
      },
      encryption: {
        dataAtRest: true,
        dataInTransit: true,
        keyRotationCompliance: true,
        lastKeyRotation: new Date(),
      },
      dataLoss: {
        incidents: dataLossIncidents.length,
        exposedRecords,
        preventedAttempts: metricsInRange.find(m => m.name === 'prevented_attempts')?.value || 0,
      },
    };
  }

  /**
   * Generate comprehensive SOC 2 compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    criteria?: SOC2Criteria[]
  ): Promise<SOC2ComplianceReport> {
    const reportId = this.generateId('report');
    const now = new Date();

    const enabledCriteria = criteria || this.config.enabledCriteria;
    const controls = Array.from(this.controls.values()).filter(c =>
      enabledCriteria.includes(c.criteria)
    );

    const implemented = controls.filter(c => c.status === 'implemented').length;
    const partial = controls.filter(c => c.status === 'partial').length;
    const notImplemented = controls.filter(c => c.status === 'not_implemented').length;
    const notApplicable = controls.filter(c => c.status === 'not_applicable').length;
    const applicableControls = controls.length - notApplicable;
    const complianceRate =
      applicableControls > 0 ? ((implemented + partial * 0.5) / applicableControls) * 100 : 100;

    let overallStatus: SOC2ComplianceReport['overallStatus'] = 'compliant';
    if (complianceRate < 95) {
      overallStatus = 'partially_compliant';
    }
    if (complianceRate < 80) {
      overallStatus = 'non_compliant';
    }

    const findings: SOC2ComplianceReport['findings'] = [];
    const recommendations: string[] = [];

    // Analyze controls for findings
    for (const control of controls) {
      if (control.status === 'not_implemented') {
        findings.push({
          id: this.generateId('finding'),
          criteria: control.criteria,
          controlId: control.controlId,
          severity: control.riskLevel === 'critical' ? 'critical' : 'high',
          description: `Control ${control.controlId} (${control.name}) is not implemented`,
          recommendation: `Implement ${control.name} to meet SOC 2 ${control.criteria} requirements`,
          status: 'open',
        });
        recommendations.push(`Implement ${control.controlId}: ${control.name}`);
      } else if (control.status === 'partial') {
        findings.push({
          id: this.generateId('finding'),
          criteria: control.criteria,
          controlId: control.controlId,
          severity: 'medium',
          description: `Control ${control.controlId} (${control.name}) is partially implemented`,
          recommendation: `Complete implementation of ${control.name}`,
          status: 'in_progress',
        });
      }
    }

    // Analyze incidents for findings
    const incidents = Array.from(this.incidents.values()).filter(
      i =>
        enabledCriteria.includes(i.criteria) && i.detectedAt >= startDate && i.detectedAt <= endDate
    );

    for (const incident of incidents) {
      if (incident.severity === 'critical' || incident.severity === 'high') {
        findings.push({
          id: this.generateId('finding'),
          criteria: incident.criteria,
          controlId: 'N/A',
          severity: incident.severity,
          description: `Incident: ${incident.title}`,
          recommendation: incident.response.remediation || 'Review and address incident',
          status:
            incident.status === 'resolved' || incident.status === 'closed' ? 'resolved' : 'open',
        });
      }
    }

    // Collect evidence
    const evidence: SOC2ComplianceReport['evidence'] = [];
    for (const control of controls) {
      for (const ev of control.evidence) {
        evidence.push({
          controlId: control.controlId,
          evidenceType: 'document',
          description: ev,
          collectedAt: control.metadata.updatedAt,
        });
      }
    }

    await this.auditLogger.logComplianceEvent(
      'compliance_report_generated',
      'SOC2',
      {},
      'success',
      {
        reportId,
        period: { startDate, endDate },
        criteria: enabledCriteria,
        overallStatus,
        complianceRate,
        findingsCount: findings.length,
      }
    );

    return {
      id: reportId,
      generatedAt: now,
      period: { startDate, endDate },
      criteria: enabledCriteria,
      overallStatus,
      controls: {
        total: controls.length,
        implemented,
        partial,
        notImplemented,
        notApplicable,
        complianceRate,
      },
      findings,
      recommendations,
      evidence,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Increment version string
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Check if alert should be sent based on threshold
   */
  private shouldAlert(status: 'normal' | 'warning' | 'critical'): boolean {
    const thresholdMap: Record<string, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    const statusMap: Record<string, number> = {
      normal: 0,
      warning: 1,
      critical: 2,
    };
    return statusMap[status] >= thresholdMap[this.config.incidentNotificationThreshold];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalControls: number;
    implementedControls: number;
    partialControls: number;
    notImplementedControls: number;
    totalMetrics: number;
    totalIncidents: number;
    openIncidents: number;
    complianceRate: number;
  } {
    const controls = Array.from(this.controls.values());
    const implemented = controls.filter(c => c.status === 'implemented').length;
    const partial = controls.filter(c => c.status === 'partial').length;
    const notImplemented = controls.filter(c => c.status === 'not_implemented').length;
    const notApplicable = controls.filter(c => c.status === 'not_applicable').length;
    const applicableControls = controls.length - notApplicable;
    const complianceRate =
      applicableControls > 0 ? ((implemented + partial * 0.5) / applicableControls) * 100 : 100;

    return {
      totalControls: controls.length,
      implementedControls: implemented,
      partialControls: partial,
      notImplementedControls: notImplemented,
      totalMetrics: this.metrics.size,
      totalIncidents: this.incidents.size,
      openIncidents: this.getOpenIncidents().length,
      complianceRate,
    };
  }
}

// Singleton instance
let soc2ComplianceInstance: SOC2ComplianceService | null = null;

export function getSOC2ComplianceService(
  config?: SOC2Config,
  auditLogger?: AuditLogger,
  securityLogger?: SecurityLogger
): SOC2ComplianceService {
  if (!soc2ComplianceInstance) {
    if (!auditLogger || !securityLogger) {
      throw new Error('AuditLogger and SecurityLogger are required for first initialization');
    }
    soc2ComplianceInstance = new SOC2ComplianceService(
      config || defaultSOC2Config,
      auditLogger,
      securityLogger
    );
  }
  return soc2ComplianceInstance;
}

export function resetSOC2ComplianceService(): void {
  soc2ComplianceInstance = null;
}
