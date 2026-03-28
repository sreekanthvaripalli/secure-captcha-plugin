import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Helm Chart Validation', () => {
  const helmDir = path.join(__dirname, '../../helm/secure-captcha');

  describe('Chart.yaml', () => {
    const chartPath = path.join(helmDir, 'Chart.yaml');
    
    test('Chart.yaml exists', () => {
      expect(fs.existsSync(chartPath)).toBe(true);
    });

    test('Chart.yaml is valid YAML', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
    });

    test('Chart has required fields', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.apiVersion).toBe('v2');
      expect(parsed.name).toBe('secure-captcha');
      expect(parsed.version).toBeDefined();
      expect(parsed.appVersion).toBeDefined();
      expect(parsed.description).toBeDefined();
    });

    test('Chart has correct type', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.type).toBe('application');
    });

    test('Chart has keywords', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.keywords).toBeDefined();
      expect(parsed.keywords.length).toBeGreaterThan(0);
      expect(parsed.keywords).toContain('captcha');
      expect(parsed.keywords).toContain('security');
    });

    test('Chart has maintainers', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.maintainers).toBeDefined();
      expect(parsed.maintainers.length).toBeGreaterThan(0);
      expect(parsed.maintainers[0].name).toBeDefined();
      expect(parsed.maintainers[0].email).toBeDefined();
    });

    test('Chart has dependencies', () => {
      const content = fs.readFileSync(chartPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.dependencies).toBeDefined();
      expect(parsed.dependencies.length).toBeGreaterThan(0);
      
      const redisDep = parsed.dependencies.find((d: any) => d.name === 'redis');
      const postgresDep = parsed.dependencies.find((d: any) => d.name === 'postgresql');
      
      expect(redisDep).toBeDefined();
      expect(postgresDep).toBeDefined();
    });
  });

  describe('values.yaml', () => {
    const valuesPath = path.join(helmDir, 'values.yaml');
    
    test('values.yaml exists', () => {
      expect(fs.existsSync(valuesPath)).toBe(true);
    });

    test('values.yaml is valid YAML', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
    });

    test('values has global section', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.global).toBeDefined();
    });

    test('values has app section', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app).toBeDefined();
      expect(parsed.app.name).toBe('secure-captcha');
      expect(parsed.app.replicaCount).toBeDefined();
    });

    test('values has image configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.image).toBeDefined();
      expect(parsed.app.image.repository).toBeDefined();
      expect(parsed.app.image.tag).toBeDefined();
      expect(parsed.app.image.pullPolicy).toBeDefined();
    });

    test('values has resource limits', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.resources).toBeDefined();
      expect(parsed.app.resources.requests).toBeDefined();
      expect(parsed.app.resources.limits).toBeDefined();
      expect(parsed.app.resources.requests.cpu).toBeDefined();
      expect(parsed.app.resources.requests.memory).toBeDefined();
    });

    test('values has service configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.service).toBeDefined();
      expect(parsed.app.service.type).toBeDefined();
      expect(parsed.app.service.port).toBeDefined();
      expect(parsed.app.service.targetPort).toBeDefined();
    });

    test('values has ingress configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.ingress).toBeDefined();
      expect(parsed.app.ingress.enabled).toBeDefined();
      expect(parsed.app.ingress.className).toBeDefined();
      expect(parsed.app.ingress.hosts).toBeDefined();
    });

    test('values has autoscaling configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.autoscaling).toBeDefined();
      expect(parsed.app.autoscaling.enabled).toBeDefined();
      expect(parsed.app.autoscaling.minReplicas).toBeDefined();
      expect(parsed.app.autoscaling.maxReplicas).toBeDefined();
    });

    test('values has health probes', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.livenessProbe).toBeDefined();
      expect(parsed.app.readinessProbe).toBeDefined();
      expect(parsed.app.startupProbe).toBeDefined();
    });

    test('values has security context', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.app.securityContext).toBeDefined();
      expect(parsed.app.securityContext.runAsNonRoot).toBeDefined();
      expect(parsed.app.securityContext.runAsUser).toBeDefined();
    });

    test('values has config section', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.config).toBeDefined();
      expect(parsed.config.NODE_ENV).toBeDefined();
      expect(parsed.config.PORT).toBeDefined();
    });

    test('values has secrets section', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.secrets).toBeDefined();
      expect(parsed.secrets.POSTGRES_PASSWORD).toBeDefined();
      expect(parsed.secrets.JWT_SECRET).toBeDefined();
    });

    test('values has redis configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.redis).toBeDefined();
      expect(parsed.redis.enabled).toBeDefined();
    });

    test('values has postgresql configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.postgresql).toBeDefined();
      expect(parsed.postgresql.enabled).toBeDefined();
    });

    test('values has prometheus configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.prometheus).toBeDefined();
      expect(parsed.prometheus.enabled).toBeDefined();
    });

    test('values has grafana configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.grafana).toBeDefined();
      expect(parsed.grafana.enabled).toBeDefined();
    });

    test('values has network policy configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.networkPolicy).toBeDefined();
      expect(parsed.networkPolicy.enabled).toBeDefined();
    });

    test('values has RBAC configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.rbac).toBeDefined();
      expect(parsed.rbac.create).toBeDefined();
    });

    test('values has service account configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.serviceAccount).toBeDefined();
      expect(parsed.serviceAccount.create).toBeDefined();
    });

    test('values has pod disruption budget configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.podDisruptionBudget).toBeDefined();
      expect(parsed.podDisruptionBudget.enabled).toBeDefined();
    });

    test('values has monitoring configuration', () => {
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed.monitoring).toBeDefined();
      expect(parsed.monitoring.serviceMonitor).toBeDefined();
    });
  });

  describe('Templates', () => {
    const templatesDir = path.join(helmDir, 'templates');
    
    test('templates directory exists', () => {
      expect(fs.existsSync(templatesDir)).toBe(true);
    });

    test('_helpers.tpl exists', () => {
      const helpersPath = path.join(templatesDir, '_helpers.tpl');
      expect(fs.existsSync(helpersPath)).toBe(true);
    });

    test('_helpers.tpl has required helper functions', () => {
      const helpersPath = path.join(templatesDir, '_helpers.tpl');
      const content = fs.readFileSync(helpersPath, 'utf8');
      
      expect(content).toContain('define "secure-captcha.name"');
      expect(content).toContain('define "secure-captcha.fullname"');
      expect(content).toContain('define "secure-captcha.labels"');
      expect(content).toContain('define "secure-captcha.selectorLabels"');
      expect(content).toContain('define "secure-captcha.serviceAccountName"');
    });

    test('deployment.yaml template exists', () => {
      const deploymentPath = path.join(templatesDir, 'deployment.yaml');
      expect(fs.existsSync(deploymentPath)).toBe(true);
    });

    test('deployment.yaml template is valid', () => {
      const deploymentPath = path.join(templatesDir, 'deployment.yaml');
      const content = fs.readFileSync(deploymentPath, 'utf8');
      
      expect(content).toContain('apiVersion:');
      expect(content).toContain('kind: Deployment');
      expect(content).toContain('{{ include "secure-captcha.fullname" . }}');
    });

    test('service.yaml template exists', () => {
      const servicePath = path.join(templatesDir, 'service.yaml');
      expect(fs.existsSync(servicePath)).toBe(true);
    });

    test('service.yaml template is valid', () => {
      const servicePath = path.join(templatesDir, 'service.yaml');
      const content = fs.readFileSync(servicePath, 'utf8');
      
      expect(content).toContain('apiVersion: v1');
      expect(content).toContain('kind: Service');
      expect(content).toContain('{{ include "secure-captcha.serviceName" . }}');
    });

    test('configmap.yaml template exists', () => {
      const configMapPath = path.join(templatesDir, 'configmap.yaml');
      expect(fs.existsSync(configMapPath)).toBe(true);
    });

    test('configmap.yaml template is valid', () => {
      const configMapPath = path.join(templatesDir, 'configmap.yaml');
      const content = fs.readFileSync(configMapPath, 'utf8');
      
      expect(content).toContain('apiVersion: v1');
      expect(content).toContain('kind: ConfigMap');
      expect(content).toContain('{{ include "secure-captcha.configMapName" . }}');
    });

    test('secret.yaml template exists', () => {
      const secretPath = path.join(templatesDir, 'secret.yaml');
      expect(fs.existsSync(secretPath)).toBe(true);
    });

    test('secret.yaml template is valid', () => {
      const secretPath = path.join(templatesDir, 'secret.yaml');
      const content = fs.readFileSync(secretPath, 'utf8');
      
      expect(content).toContain('apiVersion: v1');
      expect(content).toContain('kind: Secret');
      expect(content).toContain('{{ include "secure-captcha.secretName" . }}');
    });

    test('ingress.yaml template exists', () => {
      const ingressPath = path.join(templatesDir, 'ingress.yaml');
      expect(fs.existsSync(ingressPath)).toBe(true);
    });

    test('ingress.yaml template is valid', () => {
      const ingressPath = path.join(templatesDir, 'ingress.yaml');
      const content = fs.readFileSync(ingressPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.app.ingress.enabled -}}');
      expect(content).toContain('kind: Ingress');
      expect(content).toContain('{{ include "secure-captcha.ingressName" . }}');
    });

    test('hpa.yaml template exists', () => {
      const hpaPath = path.join(templatesDir, 'hpa.yaml');
      expect(fs.existsSync(hpaPath)).toBe(true);
    });

    test('hpa.yaml template is valid', () => {
      const hpaPath = path.join(templatesDir, 'hpa.yaml');
      const content = fs.readFileSync(hpaPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.app.autoscaling.enabled }}');
      expect(content).toContain('kind: HorizontalPodAutoscaler');
      expect(content).toContain('{{ include "secure-captcha.hpaName" . }}');
    });

    test('serviceaccount.yaml template exists', () => {
      const serviceAccountPath = path.join(templatesDir, 'serviceaccount.yaml');
      expect(fs.existsSync(serviceAccountPath)).toBe(true);
    });

    test('serviceaccount.yaml template is valid', () => {
      const serviceAccountPath = path.join(templatesDir, 'serviceaccount.yaml');
      const content = fs.readFileSync(serviceAccountPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.serviceAccount.create -}}');
      expect(content).toContain('kind: ServiceAccount');
      expect(content).toContain('{{ include "secure-captcha.serviceAccountName" . }}');
    });

    test('rbac.yaml template exists', () => {
      const rbacPath = path.join(templatesDir, 'rbac.yaml');
      expect(fs.existsSync(rbacPath)).toBe(true);
    });

    test('rbac.yaml template is valid', () => {
      const rbacPath = path.join(templatesDir, 'rbac.yaml');
      const content = fs.readFileSync(rbacPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.rbac.create -}}');
      expect(content).toContain('kind: Role');
      expect(content).toContain('kind: RoleBinding');
    });

    test('networkpolicy.yaml template exists', () => {
      const networkPolicyPath = path.join(templatesDir, 'networkpolicy.yaml');
      expect(fs.existsSync(networkPolicyPath)).toBe(true);
    });

    test('networkpolicy.yaml template is valid', () => {
      const networkPolicyPath = path.join(templatesDir, 'networkpolicy.yaml');
      const content = fs.readFileSync(networkPolicyPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.networkPolicy.enabled -}}');
      expect(content).toContain('kind: NetworkPolicy');
      expect(content).toContain('{{ include "secure-captcha.networkPolicyName" . }}');
    });

    test('pdb.yaml template exists', () => {
      const pdbPath = path.join(templatesDir, 'pdb.yaml');
      expect(fs.existsSync(pdbPath)).toBe(true);
    });

    test('pdb.yaml template is valid', () => {
      const pdbPath = path.join(templatesDir, 'pdb.yaml');
      const content = fs.readFileSync(pdbPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.podDisruptionBudget.enabled -}}');
      expect(content).toContain('kind: PodDisruptionBudget');
      expect(content).toContain('{{ include "secure-captcha.pdbName" . }}');
    });

    test('servicemonitor.yaml template exists', () => {
      const serviceMonitorPath = path.join(templatesDir, 'servicemonitor.yaml');
      expect(fs.existsSync(serviceMonitorPath)).toBe(true);
    });

    test('servicemonitor.yaml template is valid', () => {
      const serviceMonitorPath = path.join(templatesDir, 'servicemonitor.yaml');
      const content = fs.readFileSync(serviceMonitorPath, 'utf8');
      
      expect(content).toContain('{{- if .Values.monitoring.serviceMonitor.enabled -}}');
      expect(content).toContain('kind: ServiceMonitor');
      expect(content).toContain('{{ include "secure-captcha.serviceMonitorName" . }}');
    });
  });

  describe('Template Consistency', () => {
    test('all templates use consistent helper functions', () => {
      const templatesDir = path.join(helmDir, 'templates');
      const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.yaml'));
      
      templateFiles.forEach(file => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        
        // Check that templates use the correct helper functions
        if (content.includes('metadata:')) {
          expect(content).toMatch(/{{ include "secure-captcha\./);
        }
      });
    });

    test('all templates use consistent labels', () => {
      const templatesDir = path.join(helmDir, 'templates');
      const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.yaml'));
      
      templateFiles.forEach(file => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        
        if (content.includes('labels:')) {
          expect(content).toContain('{{- include "secure-captcha.labels" . | nindent 4 }}');
        }
      });
    });

    test('all templates use consistent namespace', () => {
      const templatesDir = path.join(helmDir, 'templates');
      const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.yaml'));
      
      templateFiles.forEach(file => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        
        if (content.includes('metadata:')) {
          expect(content).toContain('namespace: {{ .Release.Namespace }}');
        }
      });
    });
  });

  describe('Security Best Practices', () => {
    test('values.yaml has security context configured', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.app.securityContext.runAsNonRoot).toBe(true);
      expect(parsed.app.securityContext.runAsUser).toBe(1001);
      expect(parsed.app.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(parsed.app.securityContext.readOnlyRootFilesystem).toBe(true);
    });

    test('values.yaml has resource limits configured', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.app.resources.requests.cpu).toBeDefined();
      expect(parsed.app.resources.requests.memory).toBeDefined();
      expect(parsed.app.resources.limits.cpu).toBeDefined();
      expect(parsed.app.resources.limits.memory).toBeDefined();
    });

    test('values.yaml has network policy enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.networkPolicy.enabled).toBe(true);
    });

    test('values.yaml has RBAC enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.rbac.create).toBe(true);
    });

    test('values.yaml has service account enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.serviceAccount.create).toBe(true);
    });
  });

  describe('Monitoring Configuration', () => {
    test('values.yaml has prometheus enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.prometheus.enabled).toBe(true);
    });

    test('values.yaml has grafana enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.grafana.enabled).toBe(true);
    });

    test('values.yaml has service monitor enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.monitoring.serviceMonitor.enabled).toBe(true);
    });
  });

  describe('High Availability', () => {
    test('values.yaml has autoscaling enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.app.autoscaling.enabled).toBe(true);
      expect(parsed.app.autoscaling.minReplicas).toBeGreaterThanOrEqual(3);
      expect(parsed.app.autoscaling.maxReplicas).toBeGreaterThanOrEqual(parsed.app.autoscaling.minReplicas);
    });

    test('values.yaml has pod disruption budget enabled', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.podDisruptionBudget.enabled).toBe(true);
      expect(parsed.podDisruptionBudget.minAvailable).toBeDefined();
    });

    test('values.yaml has pod anti-affinity configured', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      expect(parsed.app.podAntiAffinity).toBeDefined();
    });
  });

  describe('Configuration Completeness', () => {
    test('values.yaml has all required environment variables', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'REDIS_HOST',
        'REDIS_PORT',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_DB',
        'POSTGRES_USER',
        'CAPTCHA_DEFAULT_TYPE',
        'CAPTCHA_DEFAULT_DIFFICULTY'
      ];
      
      requiredVars.forEach(varName => {
        expect(parsed.config[varName]).toBeDefined();
      });
    });

    test('values.yaml has all required secrets', () => {
      const valuesPath = path.join(helmDir, 'values.yaml');
      const content = fs.readFileSync(valuesPath, 'utf8');
      const parsed = yaml.load(content) as any;
      
      const requiredSecrets = [
        'POSTGRES_PASSWORD',
        'JWT_SECRET',
        'SESSION_SECRET',
        'CAPTCHA_ENCRYPTION_KEY'
      ];
      
      requiredSecrets.forEach(secretName => {
        expect(parsed.secrets[secretName]).toBeDefined();
      });
    });
  });
});