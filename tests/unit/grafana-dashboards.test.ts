/**
 * Grafana Dashboard Tests
 * Tests for dashboard provisioning and data source configuration
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Grafana Dashboards', () => {
  const dashboardsPath = path.join(__dirname, '../../grafana/dashboards');
  const provisioningPath = path.join(__dirname, '../../grafana/provisioning/dashboards');

  describe('Dashboard Files', () => {
    it('should have performance dashboard file', () => {
      const performanceDashboard = path.join(dashboardsPath, 'performance-dashboard.json');
      expect(fs.existsSync(performanceDashboard)).toBe(true);
    });

    it('should have security dashboard file', () => {
      const securityDashboard = path.join(dashboardsPath, 'security-dashboard.json');
      expect(fs.existsSync(securityDashboard)).toBe(true);
    });

    it('should have business dashboard file', () => {
      const businessDashboard = path.join(dashboardsPath, 'business-dashboard.json');
      expect(fs.existsSync(businessDashboard)).toBe(true);
    });

    it('should have valid JSON in all dashboards', () => {
      const dashboardFiles = [
        'performance-dashboard.json',
        'security-dashboard.json',
        'business-dashboard.json'
      ];

      dashboardFiles.forEach(file => {
        const filePath = path.join(dashboardsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
      });
    });
  });

  describe('Performance Dashboard', () => {
    let performanceDashboard: any;

    beforeAll(() => {
      const filePath = path.join(dashboardsPath, 'performance-dashboard.json');
      const content = fs.readFileSync(filePath, 'utf8');
      performanceDashboard = JSON.parse(content);
    });

    it('should have correct title', () => {
      expect(performanceDashboard.title).toBe('CAPTCHA Performance Dashboard');
    });

    it('should have correct uid', () => {
      expect(performanceDashboard.uid).toBe('captcha-performance');
    });

    it('should have Prometheus datasource', () => {
      const panels = performanceDashboard.panels;
      const hasPrometheusDatasource = panels.some((panel: any) => 
        panel.datasource === 'Prometheus' || 
        (panel.targets && panel.targets.some((target: any) => target.datasource === 'Prometheus'))
      );
      expect(hasPrometheusDatasource).toBe(true);
    });

    it('should have request rate panel', () => {
      const panels = performanceDashboard.panels;
      const hasRequestRate = panels.some((panel: any) => 
        panel.title === 'Request Rate' || 
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_http_requests_total')
        ))
      );
      expect(hasRequestRate).toBe(true);
    });

    it('should have latency percentile panel', () => {
      const panels = performanceDashboard.panels;
      const hasLatency = panels.some((panel: any) => 
        panel.title && panel.title.includes('Latency') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_http_request_duration_seconds')
        ))
      );
      expect(hasLatency).toBe(true);
    });

    it('should have error rate panel', () => {
      const panels = performanceDashboard.panels;
      const hasErrorRate = panels.some((panel: any) => 
        panel.title === 'Error Rate' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_http_errors_total')
        ))
      );
      expect(hasErrorRate).toBe(true);
    });

    it('should have throughput panel', () => {
      const panels = performanceDashboard.panels;
      const hasThroughput = panels.some((panel: any) => 
        panel.title === 'Throughput' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('rate(captcha_http_requests_total')
        ))
      );
      expect(hasThroughput).toBe(true);
    });

    it('should have captcha generation time panel', () => {
      const panels = performanceDashboard.panels;
      const hasGenerationTime = panels.some((panel: any) => 
        panel.title && panel.title.includes('Generation Time') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_generation_duration_seconds')
        ))
      );
      expect(hasGenerationTime).toBe(true);
    });

    it('should have captcha validation time panel', () => {
      const panels = performanceDashboard.panels;
      const hasValidationTime = panels.some((panel: any) => 
        panel.title && panel.title.includes('Validation Time') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_validation_duration_seconds')
        ))
      );
      expect(hasValidationTime).toBe(true);
    });

    it('should have cache hit rate panel', () => {
      const panels = performanceDashboard.panels;
      const hasCacheHitRate = panels.some((panel: any) => 
        panel.title && panel.title.includes('Cache Hit Rate') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_cache_hits_total')
        ))
      );
      expect(hasCacheHitRate).toBe(true);
    });

    it('should have memory usage panel', () => {
      const panels = performanceDashboard.panels;
      const hasMemoryUsage = panels.some((panel: any) => 
        panel.title && panel.title.includes('Memory') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_memory_usage_bytes')
        ))
      );
      expect(hasMemoryUsage).toBe(true);
    });

    it('should have CPU usage panel', () => {
      const panels = performanceDashboard.panels;
      const hasCpuUsage = panels.some((panel: any) => 
        panel.title && panel.title.includes('CPU') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_cpu_usage_seconds')
        ))
      );
      expect(hasCpuUsage).toBe(true);
    });

    it('should have auto-refresh configured', () => {
      expect(performanceDashboard.refresh).toBe('10s');
    });

    it('should have correct tags', () => {
      expect(performanceDashboard.tags).toContain('captcha');
      expect(performanceDashboard.tags).toContain('performance');
      expect(performanceDashboard.tags).toContain('monitoring');
    });
  });

  describe('Security Dashboard', () => {
    let securityDashboard: any;

    beforeAll(() => {
      const filePath = path.join(dashboardsPath, 'security-dashboard.json');
      const content = fs.readFileSync(filePath, 'utf8');
      securityDashboard = JSON.parse(content);
    });

    it('should have correct title', () => {
      expect(securityDashboard.title).toBe('CAPTCHA Security Dashboard');
    });

    it('should have correct uid', () => {
      expect(securityDashboard.uid).toBe('captcha-security');
    });

    it('should have security events panel', () => {
      const panels = securityDashboard.panels;
      const hasSecurityEvents = panels.some((panel: any) => 
        panel.title && panel.title.includes('Security Events') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_security_events_total')
        ))
      );
      expect(hasSecurityEvents).toBe(true);
    });

    it('should have rate limit hits panel', () => {
      const panels = securityDashboard.panels;
      const hasRateLimit = panels.some((panel: any) => 
        panel.title && panel.title.includes('Rate Limit') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_rate_limit_hits_total')
        ))
      );
      expect(hasRateLimit).toBe(true);
    });

    it('should have validation results panel', () => {
      const panels = securityDashboard.panels;
      const hasValidationResults = panels.some((panel: any) => 
        panel.title && panel.title.includes('Validation Results') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_validation_total')
        ))
      );
      expect(hasValidationResults).toBe(true);
    });

    it('should have failed validations rate panel', () => {
      const panels = securityDashboard.panels;
      const hasFailedValidations = panels.some((panel: any) => 
        panel.title && panel.title.includes('Failed Validations') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('result=\\"incorrect\\"')
        ))
      );
      expect(hasFailedValidations).toBe(true);
    });

    it('should have session deletion reasons panel', () => {
      const panels = securityDashboard.panels;
      const hasSessionDeletions = panels.some((panel: any) => 
        panel.title && panel.title.includes('Session Deletion') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('captcha_sessions_deleted_total')
        ))
      );
      expect(hasSessionDeletions).toBe(true);
    });

    it('should have generation failures panel', () => {
      const panels = securityDashboard.panels;
      const hasGenerationFailures = panels.some((panel: any) => 
        panel.title && panel.title.includes('Generation Failures') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('status=\\"failure\\"')
        ))
      );
      expect(hasGenerationFailures).toBe(true);
    });

    it('should have correct tags', () => {
      expect(securityDashboard.tags).toContain('captcha');
      expect(securityDashboard.tags).toContain('security');
      expect(securityDashboard.tags).toContain('monitoring');
    });
  });

  describe('Business Dashboard', () => {
    let businessDashboard: any;

    beforeAll(() => {
      const filePath = path.join(dashboardsPath, 'business-dashboard.json');
      const content = fs.readFileSync(filePath, 'utf8');
      businessDashboard = JSON.parse(content);
    });

    it('should have correct title', () => {
      expect(businessDashboard.title).toBe('CAPTCHA Business Dashboard');
    });

    it('should have correct uid', () => {
      expect(businessDashboard.uid).toBe('captcha-business');
    });

    it('should have captcha types usage panel', () => {
      const panels = businessDashboard.panels;
      const hasCaptchaTypes = panels.some((panel: any) => 
        panel.title && panel.title.includes('Captcha Types') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('by (type)')
        ))
      );
      expect(hasCaptchaTypes).toBe(true);
    });

    it('should have difficulty distribution panel', () => {
      const panels = businessDashboard.panels;
      const hasDifficulty = panels.some((panel: any) => 
        panel.title && panel.title.includes('Difficulty') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('by (difficulty)')
        ))
      );
      expect(hasDifficulty).toBe(true);
    });

    it('should have success rate by type panel', () => {
      const panels = businessDashboard.panels;
      const hasSuccessRate = panels.some((panel: any) => 
        panel.title && panel.title.includes('Success Rate') ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('result=\\"correct\\"')
        ))
      );
      expect(hasSuccessRate).toBe(true);
    });

    it('should have text captchas stat panel', () => {
      const panels = businessDashboard.panels;
      const hasTextCaptchas = panels.some((panel: any) => 
        panel.title === 'Text Captchas' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('type=\\"text\\"')
        ))
      );
      expect(hasTextCaptchas).toBe(true);
    });

    it('should have math captchas stat panel', () => {
      const panels = businessDashboard.panels;
      const hasMathCaptchas = panels.some((panel: any) => 
        panel.title === 'Math Captchas' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('type=\\"math\\"')
        ))
      );
      expect(hasMathCaptchas).toBe(true);
    });

    it('should have logic captchas stat panel', () => {
      const panels = businessDashboard.panels;
      const hasLogicCaptchas = panels.some((panel: any) => 
        panel.title === 'Logic Captchas' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('type=\\"logic\\"')
        ))
      );
      expect(hasLogicCaptchas).toBe(true);
    });

    it('should have image captchas stat panel', () => {
      const panels = businessDashboard.panels;
      const hasImageCaptchas = panels.some((panel: any) => 
        panel.title === 'Image Captchas' ||
        (panel.targets && panel.targets.some((target: any) => 
          target.expr && target.expr.includes('type=\\"image\\"')
        ))
      );
      expect(hasImageCaptchas).toBe(true);
    });

    it('should have correct tags', () => {
      expect(businessDashboard.tags).toContain('captcha');
      expect(businessDashboard.tags).toContain('business');
      expect(businessDashboard.tags).toContain('analytics');
    });
  });

  describe('Dashboard Provisioning', () => {
    it('should have provisioning configuration file', () => {
      const provisioningFile = path.join(provisioningPath, 'dashboard.yml');
      expect(fs.existsSync(provisioningFile)).toBe(true);
    });

    it('should have valid YAML in provisioning file', () => {
      const provisioningFile = path.join(provisioningPath, 'dashboard.yml');
      const content = fs.readFileSync(provisioningFile, 'utf8');
      
      // Basic YAML validation - check for required fields
      expect(content).toContain('apiVersion: 1');
      expect(content).toContain('providers:');
      expect(content).toContain("name: 'CAPTCHA System'");
      expect(content).toContain('orgId: 1');
      expect(content).toContain("folder: 'CAPTCHA'");
      expect(content).toContain('type: file');
      expect(content).toContain('disableDeletion: false');
      expect(content).toContain('editable: true');
      expect(content).toContain('updateIntervalSeconds: 10');
      expect(content).toContain('allowUiUpdates: true');
      expect(content).toContain('path: /etc/grafana/dashboards');
    });

    it('should have correct provider configuration', () => {
      const provisioningFile = path.join(provisioningPath, 'dashboard.yml');
      const content = fs.readFileSync(provisioningFile, 'utf8');
      
      expect(content).toContain("name: 'CAPTCHA System'");
      expect(content).toContain("folder: 'CAPTCHA'");
      expect(content).toContain('updateIntervalSeconds: 10');
    });
  });

  describe('Dashboard Consistency', () => {
    let performanceDashboard: any;
    let securityDashboard: any;
    let businessDashboard: any;

    beforeAll(() => {
      const performancePath = path.join(dashboardsPath, 'performance-dashboard.json');
      const securityPath = path.join(dashboardsPath, 'security-dashboard.json');
      const businessPath = path.join(dashboardsPath, 'business-dashboard.json');

      performanceDashboard = JSON.parse(fs.readFileSync(performancePath, 'utf8'));
      securityDashboard = JSON.parse(fs.readFileSync(securityPath, 'utf8'));
      businessDashboard = JSON.parse(fs.readFileSync(businessPath, 'utf8'));
    });

    it('should have unique dashboard UIDs', () => {
      const uids = [
        performanceDashboard.uid,
        securityDashboard.uid,
        businessDashboard.uid
      ];
      const uniqueUids = new Set(uids);
      expect(uniqueUids.size).toBe(uids.length);
    });

    it('should have consistent schema version', () => {
      expect(performanceDashboard.schemaVersion).toBe(30);
      expect(securityDashboard.schemaVersion).toBe(30);
      expect(businessDashboard.schemaVersion).toBe(30);
    });

    it('should have consistent timezone', () => {
      expect(performanceDashboard.timezone).toBe('browser');
      expect(securityDashboard.timezone).toBe('browser');
      expect(businessDashboard.timezone).toBe('browser');
    });

    it('should have consistent refresh interval', () => {
      expect(performanceDashboard.refresh).toBe('10s');
      expect(securityDashboard.refresh).toBe('10s');
      expect(businessDashboard.refresh).toBe('10s');
    });

    it('should all use Prometheus datasource', () => {
      const checkPrometheus = (dashboard: any) => {
        return dashboard.panels.some((panel: any) => 
          panel.datasource === 'Prometheus' ||
          (panel.targets && panel.targets.some((target: any) => 
            target.datasource === 'Prometheus' || 
            (target.expr && typeof target.expr === 'string')
          ))
        );
      };

      expect(checkPrometheus(performanceDashboard)).toBe(true);
      expect(checkPrometheus(securityDashboard)).toBe(true);
      expect(checkPrometheus(businessDashboard)).toBe(true);
    });
  });

  describe('Dashboard Metrics Coverage', () => {
    let allDashboards: any[];

    beforeAll(() => {
      const performancePath = path.join(dashboardsPath, 'performance-dashboard.json');
      const securityPath = path.join(dashboardsPath, 'security-dashboard.json');
      const businessPath = path.join(dashboardsPath, 'business-dashboard.json');

      allDashboards = [
        JSON.parse(fs.readFileSync(performancePath, 'utf8')),
        JSON.parse(fs.readFileSync(securityPath, 'utf8')),
        JSON.parse(fs.readFileSync(businessPath, 'utf8'))
      ];
    });

    it('should cover all Prometheus metrics', () => {
      const expectedMetrics = [
        'captcha_http_requests_total',
        'captcha_http_request_duration_seconds',
        'captcha_http_errors_total',
        'captcha_generation_duration_seconds',
        'captcha_generation_total',
        'captcha_validation_duration_seconds',
        'captcha_validation_total',
        'captcha_active_sessions',
        'captcha_sessions_created_total',
        'captcha_sessions_deleted_total',
        'captcha_cache_hits_total',
        'captcha_cache_misses_total',
        'captcha_cache_operation_duration_seconds',
        'captcha_security_events_total',
        'captcha_rate_limit_hits_total',
        'captcha_memory_usage_bytes',
        'captcha_cpu_usage_seconds',
        'captcha_uptime_seconds'
      ];

      const allExpressions = allDashboards.flatMap(dashboard => 
        dashboard.panels.flatMap((panel: any) => 
          panel.targets ? panel.targets.map((target: any) => target.expr || '') : []
        )
      ).join(' ');

      expectedMetrics.forEach(metric => {
        expect(allExpressions).toContain(metric);
      });
    });
  });
});