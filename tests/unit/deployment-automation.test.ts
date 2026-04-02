import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Deployment Automation', () => {
  const scriptsDir = path.join(__dirname, '../../scripts/deploy');

  describe('Deployment Scripts', () => {
    it('should have deploy scripts directory', () => {
      expect(fs.existsSync(scriptsDir)).toBe(true);
    });

    it('should have blue-green deployment script', () => {
      const scriptPath = path.join(scriptsDir, 'blue-green-deploy.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Blue-Green Deployment');
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('usage()');
    });

    it('should have canary deployment script', () => {
      const scriptPath = path.join(scriptsDir, 'canary-deploy.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Canary Deployment');
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('analyze_canary_metrics');
    });

    it('should have rollback script', () => {
      const scriptPath = path.join(scriptsDir, 'rollback.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Rollback Script');
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('rollback_rolling');
      expect(content).toContain('rollback_blue_green');
      expect(content).toContain('rollback_canary');
    });

    it('should have health check script', () => {
      const scriptPath = path.join(scriptsDir, 'health-check.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Health Check Script');
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('check_api_health');
      expect(content).toContain('check_database_health');
      expect(content).toContain('check_cache_health');
    });

    it('should have deploy orchestrator script', () => {
      const scriptPath = path.join(scriptsDir, 'deploy.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Deployment Orchestrator');
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('cmd_deploy');
      expect(content).toContain('cmd_rollback');
      expect(content).toContain('cmd_health');
      expect(content).toContain('cmd_status');
    });

    it('should have executable permissions on all scripts', () => {
      const scripts = [
        'blue-green-deploy.sh',
        'canary-deploy.sh',
        'rollback.sh',
        'health-check.sh',
        'deploy.sh',
      ];

      scripts.forEach(script => {
        const scriptPath = path.join(scriptsDir, script);
        const stats = fs.statSync(scriptPath);
        // Check if executable bit is set (owner execute permission)
        expect(stats.mode & 0o100).toBeTruthy();
      });
    });
  });

  describe('Blue-Green Deployment Script', () => {
    let scriptContent: string;

    beforeAll(() => {
      const scriptPath = path.join(scriptsDir, 'blue-green-deploy.sh');
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    });

    it('should support environment parameter', () => {
      expect(scriptContent).toContain('-e|--environment');
    });

    it('should support version parameter', () => {
      expect(scriptContent).toContain('-v|--version');
    });

    it('should support image parameter', () => {
      expect(scriptContent).toContain('-i|--image');
    });

    it('should support dry-run mode', () => {
      expect(scriptContent).toContain('-d|--dry-run');
      expect(scriptContent).toContain('DRY_RUN=true');
    });

    it('should support rollback mode', () => {
      expect(scriptContent).toContain('-r|--rollback');
      expect(scriptContent).toContain('ROLLBACK=true');
    });

    it('should support skip-health mode', () => {
      expect(scriptContent).toContain('-s|--skip-health');
      expect(scriptContent).toContain('SKIP_HEALTH=true');
    });

    it('should have health check function', () => {
      expect(scriptContent).toContain('check_health()');
      expect(scriptContent).toContain('HEALTH_CHECK_RETRIES');
      expect(scriptContent).toContain('HEALTH_CHECK_INTERVAL');
    });

    it('should have slot management functions', () => {
      expect(scriptContent).toContain('get_current_slot()');
      expect(scriptContent).toContain('get_target_slot()');
    });

    it('should have traffic switching function', () => {
      expect(scriptContent).toContain('switch_traffic()');
      expect(scriptContent).toContain('kubectl patch service');
    });

    it('should have deployment function', () => {
      expect(scriptContent).toContain('perform_deploy()');
      expect(scriptContent).toContain('kubectl apply');
    });

    it('should have scale down function', () => {
      expect(scriptContent).toContain('scale_down_old()');
      expect(scriptContent).toContain('kubectl scale deployment');
    });

    it('should validate required arguments', () => {
      expect(scriptContent).toContain('Environment is required');
      expect(scriptContent).toContain('Version is required');
    });

    it('should have proper error handling', () => {
      expect(scriptContent).toContain('log_error');
      expect(scriptContent).toContain('exit 1');
    });

    it('should have logging functions', () => {
      expect(scriptContent).toContain('log_info');
      expect(scriptContent).toContain('log_success');
      expect(scriptContent).toContain('log_warning');
      expect(scriptContent).toContain('log_error');
    });
  });

  describe('Canary Deployment Script', () => {
    let scriptContent: string;

    beforeAll(() => {
      const scriptPath = path.join(scriptsDir, 'canary-deploy.sh');
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    });

    it('should support initial weight parameter', () => {
      expect(scriptContent).toContain('-w|--initial-weight');
      expect(scriptContent).toContain('CANARY_INITIAL_WEIGHT');
    });

    it('should support increment parameter', () => {
      expect(scriptContent).toContain('-m|--increment');
      expect(scriptContent).toContain('CANARY_INCREMENT');
    });

    it('should support error threshold parameter', () => {
      expect(scriptContent).toContain('-t|--error-threshold');
      expect(scriptContent).toContain('ERROR_THRESHOLD');
    });

    it('should support latency threshold parameter', () => {
      expect(scriptContent).toContain('-l|--latency-threshold');
      expect(scriptContent).toContain('LATENCY_THRESHOLD');
    });

    it('should support auto-promote mode', () => {
      expect(scriptContent).toContain('-a|--auto-promote');
      expect(scriptContent).toContain('AUTO_PROMOTE=true');
    });

    it('should support promote mode', () => {
      expect(scriptContent).toContain('-p|--promote');
      expect(scriptContent).toContain('PROMOTE=true');
    });

    it('should have metrics analysis function', () => {
      expect(scriptContent).toContain('analyze_canary_metrics()');
      expect(scriptContent).toContain('error_rate');
      expect(scriptContent).toContain('p99_latency');
    });

    it('should have traffic weight update function', () => {
      expect(scriptContent).toContain('update_traffic_weights()');
      expect(scriptContent).toContain('stable_weight');
      expect(scriptContent).toContain('canary_weight');
    });

    it('should have rollback function', () => {
      expect(scriptContent).toContain('rollback_canary()');
    });

    it('should have promote function', () => {
      expect(scriptContent).toContain('promote_canary()');
    });

    it('should have gradual traffic increase loop', () => {
      expect(scriptContent).toContain('while [ "$canary_weight" -lt "$CANARY_MAX_WEIGHT" ]');
    });

    it('should support Istio VirtualService', () => {
      expect(scriptContent).toContain('virtualservice');
      expect(scriptContent).toContain('kubectl patch virtualservice');
    });
  });

  describe('Rollback Script', () => {
    let scriptContent: string;

    beforeAll(() => {
      const scriptPath = path.join(scriptsDir, 'rollback.sh');
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    });

    it('should support revision parameter', () => {
      expect(scriptContent).toContain('-r|--revision');
      expect(scriptContent).toContain('REVISION');
    });

    it('should support deployment type parameter', () => {
      expect(scriptContent).toContain('-t|--type');
      expect(scriptContent).toContain('DEPLOYMENT_TYPE');
    });

    it('should support rolling rollback', () => {
      expect(scriptContent).toContain('rollback_rolling()');
      expect(scriptContent).toContain('kubectl rollout undo');
    });

    it('should support blue-green rollback', () => {
      expect(scriptContent).toContain('rollback_blue_green()');
      expect(scriptContent).toContain('active_slot');
      expect(scriptContent).toContain('target_slot');
    });

    it('should support canary rollback', () => {
      expect(scriptContent).toContain('rollback_canary()');
      expect(scriptContent).toContain('kubectl delete deployment "${APP_NAME}-canary"');
    });

    it('should have deployment status function', () => {
      expect(scriptContent).toContain('get_deployment_status()');
      expect(scriptContent).toContain('kubectl rollout history');
    });

    it('should have health check verification', () => {
      expect(scriptContent).toContain('check_health');
    });
  });

  describe('Health Check Script', () => {
    let scriptContent: string;

    beforeAll(() => {
      const scriptPath = path.join(scriptsDir, 'health-check.sh');
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    });

    it('should support environment parameter', () => {
      expect(scriptContent).toContain('-e|--environment');
    });

    it('should support component parameter', () => {
      expect(scriptContent).toContain('-c|--component');
    });

    it('should support detailed mode', () => {
      expect(scriptContent).toContain('-d|--detailed');
    });

    it('should have API health checks', () => {
      expect(scriptContent).toContain('check_api_health()');
      expect(scriptContent).toContain('/api/v1/health');
      expect(scriptContent).toContain('/api/v1/metrics');
    });

    it('should have database health checks', () => {
      expect(scriptContent).toContain('check_database_health()');
      expect(scriptContent).toContain('PostgreSQL');
    });

    it('should have cache health checks', () => {
      expect(scriptContent).toContain('check_cache_health()');
      expect(scriptContent).toContain('Redis');
    });

    it('should have Kubernetes deployment health checks', () => {
      expect(scriptContent).toContain('check_k8s_deployment_health()');
      expect(scriptContent).toContain('readyReplicas');
      expect(scriptContent).toContain('availableReplicas');
    });

    it('should have monitoring health checks', () => {
      expect(scriptContent).toContain('check_monitoring_health()');
      expect(scriptContent).toContain('Prometheus');
      expect(scriptContent).toContain('Grafana');
    });

    it('should have security header checks', () => {
      expect(scriptContent).toContain('check_security_headers()');
      expect(scriptContent).toContain('X-Content-Type-Options');
      expect(scriptContent).toContain('X-Frame-Options');
      expect(scriptContent).toContain('X-XSS-Protection');
    });

    it('should have summary function', () => {
      expect(scriptContent).toContain('print_summary()');
      expect(scriptContent).toContain('PASSED_CHECKS');
      expect(scriptContent).toContain('FAILED_CHECKS');
      expect(scriptContent).toContain('WARNING_CHECKS');
    });

    it('should have HTTP check function', () => {
      expect(scriptContent).toContain('http_check()');
      expect(scriptContent).toContain('curl');
    });

    it('should have JSON check function', () => {
      expect(scriptContent).toContain('json_check()');
      expect(scriptContent).toContain('jq');
    });

    it('should have Kubernetes check function', () => {
      expect(scriptContent).toContain('k8s_check()');
      expect(scriptContent).toContain('kubectl get');
    });
  });

  describe('Deploy Orchestrator Script', () => {
    let scriptContent: string;

    beforeAll(() => {
      const scriptPath = path.join(scriptsDir, 'deploy.sh');
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    });

    it('should support deploy command', () => {
      expect(scriptContent).toContain('cmd_deploy()');
    });

    it('should support rollback command', () => {
      expect(scriptContent).toContain('cmd_rollback()');
    });

    it('should support health command', () => {
      expect(scriptContent).toContain('cmd_health()');
    });

    it('should support status command', () => {
      expect(scriptContent).toContain('cmd_status()');
    });

    it('should support promote command', () => {
      expect(scriptContent).toContain('cmd_promote()');
    });

    it('should support rolling strategy', () => {
      expect(scriptContent).toContain('rolling');
      expect(scriptContent).toContain('kubectl apply');
    });

    it('should support blue-green strategy', () => {
      expect(scriptContent).toContain('blue-green');
      expect(scriptContent).toContain('blue-green-deploy.sh');
    });

    it('should support canary strategy', () => {
      expect(scriptContent).toContain('canary');
      expect(scriptContent).toContain('canary-deploy.sh');
    });

    it('should have proper command validation', () => {
      expect(scriptContent).toContain('Command is required');
      expect(scriptContent).toContain('Unknown command');
    });
  });

  describe('GitHub Actions Deploy Workflow', () => {
    let workflowContent: string;

    beforeAll(() => {
      const workflowPath = path.join(__dirname, '../../.github/workflows/deploy.yml');
      workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    });

    it('should have valid YAML syntax', () => {
      expect(() => yaml.load(workflowContent)).not.toThrow();
    });

    it('should have deploy-staging job', () => {
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs['deploy-staging']).toBeDefined();
    });

    it('should have deploy-production job', () => {
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs['deploy-production']).toBeDefined();
    });

    it('should have deploy-manual job', () => {
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs['deploy-manual']).toBeDefined();
    });

    it('should have rollback job', () => {
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs['rollback']).toBeDefined();
    });

    it('should have canary-promote job', () => {
      const workflow = yaml.load(workflowContent) as any;
      expect(workflow.jobs['canary-promote']).toBeDefined();
    });

    it('should use deployment scripts in staging', () => {
      expect(workflowContent).toContain('scripts/deploy/deploy.sh');
      expect(workflowContent).toContain('scripts/deploy/health-check.sh');
    });

    it('should use deployment scripts in production', () => {
      expect(workflowContent).toContain('scripts/deploy/deploy.sh');
      expect(workflowContent).toContain('scripts/deploy/health-check.sh');
    });

    it('should have environment configuration for staging', () => {
      expect(workflowContent).toContain('environment:');
      expect(workflowContent).toContain('name: staging');
    });

    it('should have environment configuration for production', () => {
      expect(workflowContent).toContain('name: production');
    });

    it('should have strategy input for manual deploy', () => {
      expect(workflowContent).toContain('strategy:');
      expect(workflowContent).toContain('rolling');
      expect(workflowContent).toContain('blue-green');
      expect(workflowContent).toContain('canary');
    });

    it('should have version input for manual deploy', () => {
      expect(workflowContent).toContain('version:');
      expect(workflowContent).toContain('Version to deploy');
    });

    it('should run tests before deployment', () => {
      expect(workflowContent).toContain('npm test');
    });

    it('should run health checks after deployment', () => {
      expect(workflowContent).toContain('health-check.sh');
    });

    it('should run smoke tests after deployment', () => {
      expect(workflowContent).toContain('curl -f');
      expect(workflowContent).toContain('/api/v1/health');
    });

    it('should use checkout@v4', () => {
      expect(workflowContent).toContain('actions/checkout@v4');
    });

    it('should use setup-node@v4', () => {
      expect(workflowContent).toContain('actions/setup-node@v4');
    });

    it('should use setup-kubectl@v3', () => {
      expect(workflowContent).toContain('azure/setup-kubectl@v3');
    });

    it('should have Kubernetes secrets reference', () => {
      expect(workflowContent).toContain('KUBE_CONFIG_STAGING');
      expect(workflowContent).toContain('KUBE_CONFIG_PRODUCTION');
    });

    it('should create GitHub release on production deploy', () => {
      expect(workflowContent).toContain('softprops/action-gh-release@v1');
    });
  });

  describe('Kubernetes Manifests', () => {
    it('should have deployment manifest with health checks', () => {
      const deploymentPath = path.join(__dirname, '../../k8s/deployment.yaml');
      const content = fs.readFileSync(deploymentPath, 'utf-8');
      const docs = yaml.loadAll(content) as any[];

      const deployment = docs.find(
        d => d.kind === 'Deployment' && d.metadata?.name === 'secure-captcha'
      );
      expect(deployment).toBeDefined();

      const container = deployment.spec.template.spec.containers[0];
      expect(container.livenessProbe).toBeDefined();
      expect(container.readinessProbe).toBeDefined();
      expect(container.startupProbe).toBeDefined();
    });

    it('should have HPA manifest for autoscaling', () => {
      const hpaPath = path.join(__dirname, '../../k8s/hpa.yaml');
      expect(fs.existsSync(hpaPath)).toBe(true);
    });

    it('should have service manifest', () => {
      const servicePath = path.join(__dirname, '../../k8s/service.yaml');
      expect(fs.existsSync(servicePath)).toBe(true);
    });

    it('should have ingress manifest', () => {
      const ingressPath = path.join(__dirname, '../../k8s/ingress.yaml');
      expect(fs.existsSync(ingressPath)).toBe(true);
    });
  });

  describe('Helm Chart', () => {
    it('should have Chart.yaml', () => {
      const chartPath = path.join(__dirname, '../../helm/secure-captcha/Chart.yaml');
      expect(fs.existsSync(chartPath)).toBe(true);
    });

    it('should have values.yaml', () => {
      const valuesPath = path.join(__dirname, '../../helm/secure-captcha/values.yaml');
      expect(fs.existsSync(valuesPath)).toBe(true);
    });

    it('should have deployment template', () => {
      const templatePath = path.join(
        __dirname,
        '../../helm/secure-captcha/templates/deployment.yaml'
      );
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('should have service template', () => {
      const templatePath = path.join(__dirname, '../../helm/secure-captcha/templates/service.yaml');
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('should have HPA template', () => {
      const templatePath = path.join(__dirname, '../../helm/secure-captcha/templates/hpa.yaml');
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });

  describe('Deployment Configuration', () => {
    it('should have namespace manifest', () => {
      const namespacePath = path.join(__dirname, '../../k8s/namespace.yaml');
      expect(fs.existsSync(namespacePath)).toBe(true);
    });

    it('should have configmap manifest', () => {
      const configmapPath = path.join(__dirname, '../../k8s/configmap.yaml');
      expect(fs.existsSync(configmapPath)).toBe(true);
    });

    it('should have secret manifest', () => {
      const secretPath = path.join(__dirname, '../../k8s/secret.yaml');
      expect(fs.existsSync(secretPath)).toBe(true);
    });

    it('should have network policy manifest', () => {
      const networkPolicyPath = path.join(__dirname, '../../k8s/network-policy.yaml');
      expect(fs.existsSync(networkPolicyPath)).toBe(true);
    });

    it('should have RBAC manifest', () => {
      const rbacPath = path.join(__dirname, '../../k8s/rbac.yaml');
      expect(fs.existsSync(rbacPath)).toBe(true);
    });
  });
});
