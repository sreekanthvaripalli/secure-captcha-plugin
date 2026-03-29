/**
 * SOC 2 Compliance Service Tests
 * Comprehensive test suite for SOC 2 compliance functionality
 */

import {
  SOC2ComplianceService,
  SOC2Config,
  defaultSOC2Config,
  SOC2Criteria,
  ControlStatus,
} from '../../src/security/soc2-compliance';
import { AuditLogger } from '../../src/security/audit-logger';
import { SecurityLogger } from '../../src/security/security-logger';

// Mock dependencies
jest.mock('../../src/security/audit-logger');
jest.mock('../../src/security/security-logger');

describe('SOC2ComplianceService', () => {
  let soc2Service: SOC2ComplianceService;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuditLogger = {
      logComplianceEvent: jest.fn().mockResolvedValue(undefined),
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      logDataAccess: jest.fn().mockResolvedValue(undefined),
      logDataModification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogger>;

    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
    } as unknown as jest.Mocked<SecurityLogger>;

    soc2Service = new SOC2ComplianceService(defaultSOC2Config, mockAuditLogger, mockSecurityLogger);
  });

  describe('Control Management', () => {
    it('should initialize with default controls', () => {
      const controls = soc2Service.getAllControls();
      expect(controls.length).toBeGreaterThan(0);

      const criteriaSet = new Set(controls.map(c => c.criteria));
      defaultSOC2Config.enabledCriteria.forEach(criteria => {
        expect(criteriaSet.has(criteria)).toBe(true);
      });
    });

    it('should add a new control', async () => {
      const newControl = {
        criteria: 'security' as SOC2Criteria,
        category: 'control_environment' as const,
        controlId: 'CC9.9',
        name: 'Test Control',
        description: 'Test control description',
        status: 'implemented' as ControlStatus,
        implementationDetails: 'Test implementation',
        evidence: ['test-evidence.pdf'],
        riskLevel: 'medium' as const,
      };

      const addedControl = await soc2Service.addControl(newControl);

      expect(addedControl.id).toBeDefined();
      expect(addedControl.controlId).toBe('CC9.9');
      expect(addedControl.name).toBe('Test Control');
      expect(addedControl.metadata.createdAt).toBeInstanceOf(Date);
      expect(mockAuditLogger.logComplianceEvent).toHaveBeenCalledWith(
        'control_added',
        'SOC2',
        {},
        'success',
        expect.objectContaining({
          controlId: 'CC9.9',
          criteria: 'security',
          status: 'implemented',
        })
      );
    });

    it('should update control status', async () => {
      const controls = soc2Service.getAllControls();
      const control = controls[0];

      const updatedControl = await soc2Service.updateControlStatus(
        control.id,
        'partial',
        'Updated implementation details',
        ['new-evidence.pdf']
      );

      expect(updatedControl).not.toBeNull();
      expect(updatedControl!.status).toBe('partial');
      expect(updatedControl!.implementationDetails).toBe('Updated implementation details');
      expect(updatedControl!.evidence).toContain('new-evidence.pdf');
      expect(updatedControl!.lastAssessedAt).toBeInstanceOf(Date);
      expect(updatedControl!.nextAssessmentAt).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent control', async () => {
      const result = await soc2Service.updateControlStatus('non-existent-id', 'implemented');
      expect(result).toBeNull();
    });

    it('should get control by ID', () => {
      const controls = soc2Service.getAllControls();
      const control = controls[0];
      const foundControl = soc2Service.getControl(control.id);
      expect(foundControl).toBeDefined();
      expect(foundControl!.id).toBe(control.id);
    });

    it('should get controls by criteria', () => {
      const securityControls = soc2Service.getControlsByCriteria('security');
      expect(securityControls.length).toBeGreaterThan(0);
      securityControls.forEach(control => {
        expect(control.criteria).toBe('security');
      });
    });

    it('should get controls by status', () => {
      const implementedControls = soc2Service.getControlsByStatus('implemented');
      expect(implementedControls.length).toBeGreaterThan(0);
      implementedControls.forEach(control => {
        expect(control.status).toBe('implemented');
      });
    });
  });

  describe('Monitoring', () => {
    it('should record monitoring metric', async () => {
      const metric = await soc2Service.recordMetric(
        'response_time',
        'availability',
        'performance',
        150,
        'ms',
        { warning: 200, critical: 500 },
        'prometheus',
        ['api', 'latency']
      );

      expect(metric.id).toBeDefined();
      expect(metric.name).toBe('response_time');
      expect(metric.value).toBe(150);
      expect(metric.status).toBe('normal');
      expect(metric.metadata.source).toBe('prometheus');
    });

    it('should detect warning threshold', async () => {
      const metric = await soc2Service.recordMetric(
        'response_time',
        'availability',
        'performance',
        250,
        'ms',
        { warning: 200, critical: 500 },
        'prometheus'
      );

      expect(metric.status).toBe('warning');
    });

    it('should detect critical threshold', async () => {
      const metric = await soc2Service.recordMetric(
        'response_time',
        'availability',
        'performance',
        600,
        'ms',
        { warning: 200, critical: 500 },
        'prometheus'
      );

      expect(metric.status).toBe('critical');
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOC2_METRIC_THRESHOLD_EXCEEDED',
        })
      );
    });

    it('should record availability data', () => {
      for (let i = 0; i < 10; i++) {
        soc2Service.recordAvailability(true, 100 + i * 10);
      }

      const report = soc2Service.generateAvailabilityReport(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      );

      expect(report.uptime.uptimePercentage).toBeGreaterThan(0);
    });

    it('should get latest metrics', async () => {
      await soc2Service.recordMetric(
        'response_time',
        'availability',
        'performance',
        100,
        'ms',
        { warning: 200, critical: 500 },
        'prometheus'
      );

      // Add small delay to ensure second metric is recorded later
      await new Promise(resolve => setTimeout(resolve, 10));

      await soc2Service.recordMetric(
        'response_time',
        'availability',
        'performance',
        150,
        'ms',
        { warning: 200, critical: 500 },
        'prometheus'
      );

      const latestMetrics = soc2Service.getLatestMetrics('availability');
      expect(latestMetrics.length).toBeGreaterThan(0);
      const responseTimeMetric = latestMetrics.find(m => m.name === 'response_time');
      expect(responseTimeMetric).toBeDefined();
      // The latest metric should be 150 since it was recorded after the delay
      expect(responseTimeMetric!.value).toBe(150);
    });
  });

  describe('Incident Management', () => {
    it('should report an incident', async () => {
      const incident = await soc2Service.reportIncident(
        'security',
        'security_breach',
        'high',
        'Test Security Incident',
        'Test incident description',
        {
          affectedSystems: ['api-server'],
          affectedUsers: 100,
          dataExposure: false,
          businessImpact: 'Medium impact on API availability',
        },
        { reportedBy: 'security-team' }
      );

      expect(incident.id).toBeDefined();
      expect(incident.criteria).toBe('security');
      expect(incident.incidentType).toBe('security_breach');
      expect(incident.severity).toBe('high');
      expect(incident.status).toBe('detected');
      expect(incident.detectedAt).toBeInstanceOf(Date);
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOC2_INCIDENT_REPORTED',
        })
      );
    });

    it('should update incident status', async () => {
      const incident = await soc2Service.reportIncident(
        'availability',
        'availability_outage',
        'critical',
        'Service Outage',
        'Service is down',
        {
          affectedSystems: ['main-api'],
          affectedUsers: 1000,
          dataExposure: false,
          businessImpact: 'Complete service unavailability',
        }
      );

      const updatedIncident = await soc2Service.updateIncidentStatus(
        incident.id,
        'contained',
        {
          action: 'Isolated affected server',
          performedBy: 'ops-team',
          result: 'Service restored on backup',
        },
        'Hardware failure',
        'Replaced faulty hardware',
        ['Implement redundant hardware', 'Improve monitoring']
      );

      expect(updatedIncident).not.toBeNull();
      expect(updatedIncident!.status).toBe('contained');
      expect(updatedIncident!.containedAt).toBeInstanceOf(Date);
      expect(updatedIncident!.response.actions.length).toBe(1);
      expect(updatedIncident!.response.rootCause).toBe('Hardware failure');
      expect(updatedIncident!.response.remediation).toBe('Replaced faulty hardware');
      expect(updatedIncident!.response.preventiveMeasures).toContain(
        'Implement redundant hardware'
      );
    });

    it('should return null when updating non-existent incident', async () => {
      const result = await soc2Service.updateIncidentStatus('non-existent-id', 'resolved');
      expect(result).toBeNull();
    });

    it('should get incident by ID', async () => {
      const incident = await soc2Service.reportIncident(
        'processing_integrity',
        'integrity_failure',
        'medium',
        'Data Integrity Issue',
        'Data validation failed',
        {
          affectedSystems: ['data-processor'],
          affectedUsers: 50,
          dataExposure: false,
          businessImpact: 'Minor data processing delays',
        }
      );

      const foundIncident = soc2Service.getIncident(incident.id);
      expect(foundIncident).toBeDefined();
      expect(foundIncident!.id).toBe(incident.id);
    });

    it('should get incidents by criteria', async () => {
      await soc2Service.reportIncident(
        'security',
        'security_breach',
        'high',
        'Security Incident 1',
        'Description 1',
        {
          affectedSystems: ['system1'],
          affectedUsers: 10,
          dataExposure: false,
          businessImpact: 'Low',
        }
      );

      await soc2Service.reportIncident(
        'availability',
        'availability_outage',
        'medium',
        'Availability Incident',
        'Description 2',
        {
          affectedSystems: ['system2'],
          affectedUsers: 20,
          dataExposure: false,
          businessImpact: 'Medium',
        }
      );

      const securityIncidents = soc2Service.getIncidentsByCriteria('security');
      expect(securityIncidents.length).toBe(1);
      expect(securityIncidents[0].criteria).toBe('security');
    });

    it('should get open incidents', async () => {
      const incident1 = await soc2Service.reportIncident(
        'security',
        'security_breach',
        'high',
        'Open Incident',
        'Description',
        {
          affectedSystems: ['system1'],
          affectedUsers: 10,
          dataExposure: false,
          businessImpact: 'Low',
        }
      );

      const incident2 = await soc2Service.reportIncident(
        'security',
        'security_breach',
        'medium',
        'Resolved Incident',
        'Description',
        {
          affectedSystems: ['system2'],
          affectedUsers: 20,
          dataExposure: false,
          businessImpact: 'Medium',
        }
      );

      await soc2Service.updateIncidentStatus(incident2.id, 'resolved');

      const openIncidents = soc2Service.getOpenIncidents();
      expect(openIncidents.length).toBe(1);
      expect(openIncidents[0].id).toBe(incident1.id);
    });
  });

  describe('Reporting', () => {
    it('should generate availability report', async () => {
      for (let i = 0; i < 100; i++) {
        soc2Service.recordAvailability(i % 10 !== 0, 100 + Math.random() * 50);
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = soc2Service.generateAvailabilityReport(startDate, endDate);

      expect(report.period.startDate).toEqual(startDate);
      expect(report.period.endDate).toEqual(endDate);
      expect(report.uptime.uptimePercentage).toBeGreaterThan(0);
      expect(report.uptime.target).toBe(defaultSOC2Config.availabilityTarget);
      expect(report.performance.averageResponseTime).toBeGreaterThan(0);
    });

    it('should generate processing integrity report', async () => {
      await soc2Service.recordMetric(
        'total_operations',
        'processing_integrity',
        'integrity',
        1000,
        'operations',
        { warning: 0, critical: 0 },
        'processor'
      );
      await soc2Service.recordMetric(
        'successful_operations',
        'processing_integrity',
        'integrity',
        990,
        'operations',
        { warning: 0, critical: 0 },
        'processor'
      );
      await soc2Service.recordMetric(
        'total_errors',
        'processing_integrity',
        'integrity',
        10,
        'errors',
        { warning: 0, critical: 0 },
        'processor'
      );
      await soc2Service.recordMetric(
        'detected_errors',
        'processing_integrity',
        'integrity',
        10,
        'errors',
        { warning: 0, critical: 0 },
        'processor'
      );

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = soc2Service.generateProcessingIntegrityReport(startDate, endDate);

      expect(report.period.startDate).toEqual(startDate);
      expect(report.period.endDate).toEqual(endDate);
      expect(report.processingAccuracy.totalOperations).toBe(1000);
      expect(report.processingAccuracy.successfulOperations).toBe(990);
      expect(report.processingAccuracy.accuracyRate).toBe(99);
      expect(report.errorHandling.totalErrors).toBe(10);
      expect(report.errorHandling.detectedErrors).toBe(10);
      expect(report.errorHandling.errorDetectionRate).toBe(100);
    });

    it('should generate confidentiality report', async () => {
      await soc2Service.recordMetric(
        'access_requests',
        'confidentiality',
        'confidentiality',
        500,
        'requests',
        { warning: 0, critical: 0 },
        'access-control'
      );
      await soc2Service.recordMetric(
        'granted_requests',
        'confidentiality',
        'confidentiality',
        480,
        'requests',
        { warning: 0, critical: 0 },
        'access-control'
      );
      await soc2Service.recordMetric(
        'denied_requests',
        'confidentiality',
        'confidentiality',
        15,
        'requests',
        { warning: 0, critical: 0 },
        'access-control'
      );
      await soc2Service.recordMetric(
        'unauthorized_attempts',
        'confidentiality',
        'confidentiality',
        5,
        'attempts',
        { warning: 0, critical: 0 },
        'access-control'
      );

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = soc2Service.generateConfidentialityReport(startDate, endDate);

      expect(report.period.startDate).toEqual(startDate);
      expect(report.period.endDate).toEqual(endDate);
      expect(report.accessControls.totalAccessRequests).toBe(500);
      expect(report.accessControls.grantedRequests).toBe(480);
      expect(report.accessControls.deniedRequests).toBe(15);
      expect(report.accessControls.unauthorizedAttempts).toBe(5);
      expect(report.encryption.dataAtRest).toBe(true);
      expect(report.encryption.dataInTransit).toBe(true);
    });

    it('should generate comprehensive compliance report', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await soc2Service.generateComplianceReport(startDate, endDate);

      expect(report.id).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period.startDate).toEqual(startDate);
      expect(report.period.endDate).toEqual(endDate);
      expect(report.criteria).toEqual(defaultSOC2Config.enabledCriteria);
      expect(['compliant', 'partially_compliant', 'non_compliant']).toContain(report.overallStatus);
      expect(report.controls.total).toBeGreaterThan(0);
      expect(report.controls.complianceRate).toBeGreaterThanOrEqual(0);
      expect(report.controls.complianceRate).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.findings)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.evidence)).toBe(true);
      expect(mockAuditLogger.logComplianceEvent).toHaveBeenCalledWith(
        'compliance_report_generated',
        'SOC2',
        {},
        'success',
        expect.objectContaining({
          reportId: report.id,
          overallStatus: report.overallStatus,
        })
      );
    });

    it('should generate compliance report for specific criteria', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await soc2Service.generateComplianceReport(startDate, endDate, [
        'security',
        'availability',
      ]);

      expect(report.criteria).toEqual(['security', 'availability']);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', async () => {
      await soc2Service.reportIncident(
        'security',
        'security_breach',
        'high',
        'Test Incident',
        'Description',
        {
          affectedSystems: ['system1'],
          affectedUsers: 10,
          dataExposure: false,
          businessImpact: 'Low',
        }
      );

      await soc2Service.recordMetric(
        'test_metric',
        'security',
        'security',
        100,
        'units',
        { warning: 200, critical: 500 },
        'test'
      );

      const stats = soc2Service.getStatistics();

      expect(stats.totalControls).toBeGreaterThan(0);
      expect(stats.implementedControls).toBeGreaterThan(0);
      expect(stats.totalMetrics).toBeGreaterThan(0);
      expect(stats.totalIncidents).toBe(1);
      expect(stats.openIncidents).toBe(1);
      expect(stats.complianceRate).toBeGreaterThanOrEqual(0);
      expect(stats.complianceRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const service = new SOC2ComplianceService(
        defaultSOC2Config,
        mockAuditLogger,
        mockSecurityLogger
      );
      const controls = service.getAllControls();
      expect(controls.length).toBeGreaterThan(0);
    });

    it('should use custom configuration', () => {
      const customConfig: SOC2Config = {
        ...defaultSOC2Config,
        enabledCriteria: ['security'],
        availabilityTarget: 99.99,
      };

      const service = new SOC2ComplianceService(customConfig, mockAuditLogger, mockSecurityLogger);
      const controls = service.getAllControls();
      const criteriaSet = new Set(controls.map(c => c.criteria));

      expect(criteriaSet.has('security')).toBe(true);
      expect(criteriaSet.has('availability')).toBe(false);
    });
  });
});

describe('SOC2ComplianceService Singleton', () => {
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockSecurityLogger: jest.Mocked<SecurityLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuditLogger = {
      logComplianceEvent: jest.fn().mockResolvedValue(undefined),
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogger>;

    mockSecurityLogger = {
      logSecurityEvent: jest.fn(),
    } as unknown as jest.Mocked<SecurityLogger>;

    const { resetSOC2ComplianceService } = require('../../src/security/soc2-compliance');
    resetSOC2ComplianceService();
  });

  it('should create singleton instance', () => {
    const { getSOC2ComplianceService } = require('../../src/security/soc2-compliance');

    const service1 = getSOC2ComplianceService(
      defaultSOC2Config,
      mockAuditLogger,
      mockSecurityLogger
    );
    const service2 = getSOC2ComplianceService();

    expect(service1).toBe(service2);
  });

  it('should throw error when first initialization without dependencies', () => {
    const { getSOC2ComplianceService } = require('../../src/security/soc2-compliance');

    expect(() => getSOC2ComplianceService()).toThrow(
      'AuditLogger and SecurityLogger are required for first initialization'
    );
  });

  it('should reset singleton instance', () => {
    const {
      getSOC2ComplianceService,
      resetSOC2ComplianceService,
    } = require('../../src/security/soc2-compliance');

    const service1 = getSOC2ComplianceService(
      defaultSOC2Config,
      mockAuditLogger,
      mockSecurityLogger
    );
    resetSOC2ComplianceService();
    const service2 = getSOC2ComplianceService(
      defaultSOC2Config,
      mockAuditLogger,
      mockSecurityLogger
    );

    expect(service1).not.toBe(service2);
  });
});
