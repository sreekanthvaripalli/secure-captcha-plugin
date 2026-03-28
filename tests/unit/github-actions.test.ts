import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('GitHub Actions Workflows', () => {
  const workflowsDir = path.join(__dirname, '../../.github/workflows');

  describe('Workflow Files Exist', () => {
    test('lint.yml exists', () => {
      expect(fs.existsSync(path.join(workflowsDir, 'lint.yml'))).toBe(true);
    });

    test('test.yml exists', () => {
      expect(fs.existsSync(path.join(workflowsDir, 'test.yml'))).toBe(true);
    });

    test('build.yml exists', () => {
      expect(fs.existsSync(path.join(workflowsDir, 'build.yml'))).toBe(true);
    });

    test('security.yml exists', () => {
      expect(fs.existsSync(path.join(workflowsDir, 'security.yml'))).toBe(true);
    });

    test('deploy.yml exists', () => {
      expect(fs.existsSync(path.join(workflowsDir, 'deploy.yml'))).toBe(true);
    });
  });

  describe('Workflow Syntax Validation', () => {
    test('lint.yml has valid YAML syntax', () => {
      const content = fs.readFileSync(path.join(workflowsDir, 'lint.yml'), 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Lint');
      expect(parsed.on).toBeDefined();
      expect(parsed.jobs).toBeDefined();
    });

    test('test.yml has valid YAML syntax', () => {
      const content = fs.readFileSync(path.join(workflowsDir, 'test.yml'), 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Test');
      expect(parsed.on).toBeDefined();
      expect(parsed.jobs).toBeDefined();
    });

    test('build.yml has valid YAML syntax', () => {
      const content = fs.readFileSync(path.join(workflowsDir, 'build.yml'), 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Build');
      expect(parsed.on).toBeDefined();
      expect(parsed.jobs).toBeDefined();
    });

    test('security.yml has valid YAML syntax', () => {
      const content = fs.readFileSync(path.join(workflowsDir, 'security.yml'), 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Security Scan');
      expect(parsed.on).toBeDefined();
      expect(parsed.jobs).toBeDefined();
    });

    test('deploy.yml has valid YAML syntax', () => {
      const content = fs.readFileSync(path.join(workflowsDir, 'deploy.yml'), 'utf8');
      const parsed = yaml.load(content) as any;
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Deploy');
      expect(parsed.on).toBeDefined();
      expect(parsed.jobs).toBeDefined();
    });
  });

  describe('Lint Workflow Configuration', () => {
    let lintWorkflow: any;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(workflowsDir, 'lint.yml'), 'utf8');
      lintWorkflow = yaml.load(content) as any;
    });

    test('triggers on push to main and develop', () => {
      expect(lintWorkflow.on.push.branches).toContain('main');
      expect(lintWorkflow.on.push.branches).toContain('develop');
    });

    test('triggers on pull request to main and develop', () => {
      expect(lintWorkflow.on.pull_request.branches).toContain('main');
      expect(lintWorkflow.on.pull_request.branches).toContain('develop');
    });

    test('has lint job', () => {
      expect(lintWorkflow.jobs.lint).toBeDefined();
    });

    test('lint job runs on ubuntu-latest', () => {
      expect(lintWorkflow.jobs.lint['runs-on']).toBe('ubuntu-latest');
    });

    test('lint job uses Node.js matrix strategy', () => {
      expect(lintWorkflow.jobs.lint.strategy.matrix['node-version']).toContain('18.x');
      expect(lintWorkflow.jobs.lint.strategy.matrix['node-version']).toContain('20.x');
    });

    test('lint job has checkout step', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const checkoutStep = steps.find((s: any) => s.name === 'Checkout code');
      expect(checkoutStep).toBeDefined();
      expect(checkoutStep.uses).toBe('actions/checkout@v4');
    });

    test('lint job has setup-node step', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const setupNodeStep = steps.find((s: any) => s.name?.includes('Setup Node.js'));
      expect(setupNodeStep).toBeDefined();
      expect(setupNodeStep.uses).toBe('actions/setup-node@v4');
    });

    test('lint job runs npm ci', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const installStep = steps.find((s: any) => s.name === 'Install dependencies');
      expect(installStep).toBeDefined();
      expect(installStep.run).toBe('npm ci');
    });

    test('lint job runs ESLint', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const eslintStep = steps.find((s: any) => s.name === 'Run ESLint');
      expect(eslintStep).toBeDefined();
      expect(eslintStep.run).toBe('npm run lint');
    });

    test('lint job checks Prettier formatting', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const prettierStep = steps.find((s: any) => s.name === 'Check Prettier formatting');
      expect(prettierStep).toBeDefined();
      expect(prettierStep.run).toBe('npm run format:check');
    });

    test('lint job checks TypeScript compilation', () => {
      const steps = lintWorkflow.jobs.lint.steps;
      const typeCheckStep = steps.find((s: any) => s.name === 'Check TypeScript compilation');
      expect(typeCheckStep).toBeDefined();
      expect(typeCheckStep.run).toBe('npm run type-check');
    });
  });

  describe('Test Workflow Configuration', () => {
    let testWorkflow: any;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(workflowsDir, 'test.yml'), 'utf8');
      testWorkflow = yaml.load(content) as any;
    });

    test('triggers on push to main and develop', () => {
      expect(testWorkflow.on.push.branches).toContain('main');
      expect(testWorkflow.on.push.branches).toContain('develop');
    });

    test('has test job', () => {
      expect(testWorkflow.jobs.test).toBeDefined();
    });

    test('test job has Redis service', () => {
      expect(testWorkflow.jobs.test.services.redis).toBeDefined();
      expect(testWorkflow.jobs.test.services.redis.image).toBe('redis:7-alpine');
    });

    test('test job has PostgreSQL service', () => {
      expect(testWorkflow.jobs.test.services.postgres).toBeDefined();
      expect(testWorkflow.jobs.test.services.postgres.image).toBe('postgres:15-alpine');
    });

    test('Redis service has health check', () => {
      const redisOptions = testWorkflow.jobs.test.services.redis.options;
      expect(redisOptions).toContain('--health-cmd "redis-cli ping"');
    });

    test('PostgreSQL service has health check', () => {
      const postgresOptions = testWorkflow.jobs.test.services.postgres.options;
      expect(postgresOptions).toContain('--health-cmd pg_isready');
    });

    test('test job runs unit tests', () => {
      const steps = testWorkflow.jobs.test.steps;
      const unitTestStep = steps.find((s: any) => s.name === 'Run unit tests');
      expect(unitTestStep).toBeDefined();
      expect(unitTestStep.run).toBe('npm run test:unit');
    });

    test('test job runs integration tests', () => {
      const steps = testWorkflow.jobs.test.steps;
      const integrationTestStep = steps.find((s: any) => s.name === 'Run integration tests');
      expect(integrationTestStep).toBeDefined();
      expect(integrationTestStep.run).toBe('npm run test:integration');
    });

    test('test job uploads coverage to Codecov', () => {
      const steps = testWorkflow.jobs.test.steps;
      const coverageStep = steps.find((s: any) => s.name === 'Upload coverage reports');
      expect(coverageStep).toBeDefined();
      expect(coverageStep.uses).toBe('codecov/codecov-action@v3');
    });

    test('test job has correct environment variables', () => {
      const steps = testWorkflow.jobs.test.steps;
      const unitTestStep = steps.find((s: any) => s.name === 'Run unit tests');
      expect(unitTestStep.env.NODE_ENV).toBe('test');
      expect(unitTestStep.env.REDIS_HOST).toBe('localhost');
      expect(unitTestStep.env.POSTGRES_HOST).toBe('localhost');
    });
  });

  describe('Build Workflow Configuration', () => {
    let buildWorkflow: any;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(workflowsDir, 'build.yml'), 'utf8');
      buildWorkflow = yaml.load(content) as any;
    });

    test('has build job', () => {
      expect(buildWorkflow.jobs.build).toBeDefined();
    });

    test('has docker job that depends on build', () => {
      expect(buildWorkflow.jobs.docker).toBeDefined();
      expect(buildWorkflow.jobs.docker.needs).toBe('build');
    });

    test('build job runs TypeScript build', () => {
      const steps = buildWorkflow.jobs.build.steps;
      const buildStep = steps.find((s: any) => s.name === 'Build TypeScript');
      expect(buildStep).toBeDefined();
      expect(buildStep.run).toBe('npm run build');
    });

    test('build job uploads artifacts', () => {
      const steps = buildWorkflow.jobs.build.steps;
      const uploadStep = steps.find((s: any) => s.name === 'Upload build artifacts');
      expect(uploadStep).toBeDefined();
      expect(uploadStep.uses).toBe('actions/upload-artifact@v3');
    });

    test('docker job sets up Docker Buildx', () => {
      const steps = buildWorkflow.jobs.docker.steps;
      const buildxStep = steps.find((s: any) => s.name === 'Set up Docker Buildx');
      expect(buildxStep).toBeDefined();
      expect(buildxStep.uses).toBe('docker/setup-buildx-action@v3');
    });

    test('docker job logs into Docker Hub', () => {
      const steps = buildWorkflow.jobs.docker.steps;
      const loginStep = steps.find((s: any) => s.name === 'Login to Docker Hub');
      expect(loginStep).toBeDefined();
      expect(loginStep.uses).toBe('docker/login-action@v3');
    });

    test('docker job builds and pushes image', () => {
      const steps = buildWorkflow.jobs.docker.steps;
      const buildStep = steps.find((s: any) => s.name === 'Build and push Docker image');
      expect(buildStep).toBeDefined();
      expect(buildStep.uses).toBe('docker/build-push-action@v5');
    });

    test('docker job uses GitHub Actions cache', () => {
      const steps = buildWorkflow.jobs.docker.steps;
      const buildStep = steps.find((s: any) => s.name === 'Build and push Docker image');
      expect(buildStep.with['cache-from']).toBe('type=gha');
      expect(buildStep.with['cache-to']).toBe('type=gha,mode=max');
    });
  });

  describe('Security Workflow Configuration', () => {
    let securityWorkflow: any;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(workflowsDir, 'security.yml'), 'utf8');
      securityWorkflow = yaml.load(content) as any;
    });

    test('triggers on push to main and develop', () => {
      expect(securityWorkflow.on.push.branches).toContain('main');
      expect(securityWorkflow.on.push.branches).toContain('develop');
    });

    test('has weekly schedule', () => {
      expect(securityWorkflow.on.schedule).toBeDefined();
      expect(securityWorkflow.on.schedule[0].cron).toBe('0 3 * * 1');
    });

    test('has security job', () => {
      expect(securityWorkflow.jobs.security).toBeDefined();
    });

    test('has container-scan job that depends on security', () => {
      expect(securityWorkflow.jobs['container-scan']).toBeDefined();
      expect(securityWorkflow.jobs['container-scan'].needs).toBe('security');
    });

    test('security job runs npm audit', () => {
      const steps = securityWorkflow.jobs.security.steps;
      const auditStep = steps.find((s: any) => s.name === 'Run npm audit');
      expect(auditStep).toBeDefined();
      expect(auditStep.run).toBe('npm audit --audit-level=high');
    });

    test('security job runs Snyk scan', () => {
      const steps = securityWorkflow.jobs.security.steps;
      const snykStep = steps.find((s: any) => s.name === 'Run Snyk security scan');
      expect(snykStep).toBeDefined();
      expect(snykStep.uses).toBe('snyk/actions/node@master');
    });

    test('security job runs OWASP Dependency Check', () => {
      const steps = securityWorkflow.jobs.security.steps;
      const owaspStep = steps.find((s: any) => s.name === 'Run OWASP Dependency Check');
      expect(owaspStep).toBeDefined();
      expect(owaspStep.uses).toBe('dependency-check/Dependency-Check_Action@main');
    });

    test('security job uploads reports', () => {
      const steps = securityWorkflow.jobs.security.steps;
      const uploadStep = steps.find((s: any) => s.name === 'Upload security reports');
      expect(uploadStep).toBeDefined();
      expect(uploadStep.uses).toBe('actions/upload-artifact@v3');
    });

    test('container-scan job builds Docker image', () => {
      const steps = securityWorkflow.jobs['container-scan'].steps;
      const buildStep = steps.find((s: any) => s.name === 'Build Docker image');
      expect(buildStep).toBeDefined();
      expect(buildStep.run).toBe('docker build -t secure-captcha:scan .');
    });

    test('container-scan job runs Trivy scanner', () => {
      const steps = securityWorkflow.jobs['container-scan'].steps;
      const trivyStep = steps.find((s: any) => s.name === 'Run Trivy vulnerability scanner');
      expect(trivyStep).toBeDefined();
      expect(trivyStep.uses).toBe('aquasecurity/trivy-action@master');
    });

    test('container-scan job uploads SARIF results', () => {
      const steps = securityWorkflow.jobs['container-scan'].steps;
      const uploadStep = steps.find((s: any) => s.name === 'Upload Trivy scan results to GitHub Security tab');
      expect(uploadStep).toBeDefined();
      expect(uploadStep.uses).toBe('github/codeql-action/upload-sarif@v2');
    });
  });

  describe('Deploy Workflow Configuration', () => {
    let deployWorkflow: any;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(workflowsDir, 'deploy.yml'), 'utf8');
      deployWorkflow = yaml.load(content) as any;
    });

    test('triggers on push to main', () => {
      expect(deployWorkflow.on.push.branches).toContain('main');
    });

    test('triggers on version tags', () => {
      expect(deployWorkflow.on.push.tags).toContain('v*');
    });

    test('supports workflow_dispatch', () => {
      expect(deployWorkflow.on.workflow_dispatch).toBeDefined();
    });

    test('workflow_dispatch has environment input', () => {
      const inputs = deployWorkflow.on.workflow_dispatch.inputs;
      expect(inputs.environment).toBeDefined();
      expect(inputs.environment.required).toBe(true);
      expect(inputs.environment.default).toBe('staging');
      expect(inputs.environment.options).toContain('staging');
      expect(inputs.environment.options).toContain('production');
    });

    test('has deploy-staging job', () => {
      expect(deployWorkflow.jobs['deploy-staging']).toBeDefined();
    });

    test('has deploy-production job', () => {
      expect(deployWorkflow.jobs['deploy-production']).toBeDefined();
    });

    test('has deploy-manual job', () => {
      expect(deployWorkflow.jobs['deploy-manual']).toBeDefined();
    });

    test('deploy-staging triggers on main branch push', () => {
      const job = deployWorkflow.jobs['deploy-staging'];
      expect(job.if).toContain("github.ref == 'refs/heads/main'");
    });

    test('deploy-production triggers on version tags', () => {
      const job = deployWorkflow.jobs['deploy-production'];
      expect(job.if).toContain("startsWith(github.ref, 'refs/tags/v')");
    });

    test('deploy-manual triggers on workflow_dispatch', () => {
      const job = deployWorkflow.jobs['deploy-manual'];
      expect(job.if).toContain("github.event_name == 'workflow_dispatch'");
    });

    test('deploy-staging has staging environment', () => {
      const job = deployWorkflow.jobs['deploy-staging'];
      expect(job.environment.name).toBe('staging');
      expect(job.environment.url).toBe('https://staging.captcha.example.com');
    });

    test('deploy-production has production environment', () => {
      const job = deployWorkflow.jobs['deploy-production'];
      expect(job.environment.name).toBe('production');
      expect(job.environment.url).toBe('https://captcha.example.com');
    });

    test('deploy-staging runs smoke tests', () => {
      const steps = deployWorkflow.jobs['deploy-staging'].steps;
      const smokeTestStep = steps.find((s: any) => s.name === 'Run smoke tests');
      expect(smokeTestStep).toBeDefined();
    });

    test('deploy-production runs smoke tests', () => {
      const steps = deployWorkflow.jobs['deploy-production'].steps;
      const smokeTestStep = steps.find((s: any) => s.name === 'Run production smoke tests');
      expect(smokeTestStep).toBeDefined();
    });

    test('deploy-production creates GitHub release', () => {
      const steps = deployWorkflow.jobs['deploy-production'].steps;
      const releaseStep = steps.find((s: any) => s.name === 'Create GitHub release');
      expect(releaseStep).toBeDefined();
      expect(releaseStep.uses).toBe('softprops/action-gh-release@v1');
    });
  });

  describe('Job Dependencies', () => {
    let buildWorkflow: any;
    let securityWorkflow: any;

    beforeAll(() => {
      const buildContent = fs.readFileSync(path.join(workflowsDir, 'build.yml'), 'utf8');
      buildWorkflow = yaml.load(buildContent) as any;

      const securityContent = fs.readFileSync(path.join(workflowsDir, 'security.yml'), 'utf8');
      securityWorkflow = yaml.load(securityContent) as any;
    });

    test('docker job depends on build job', () => {
      expect(buildWorkflow.jobs.docker.needs).toBe('build');
    });

    test('container-scan job depends on security job', () => {
      expect(securityWorkflow.jobs['container-scan'].needs).toBe('security');
    });

    test('build job completes before docker job starts', () => {
      // This is validated by the needs dependency
      expect(buildWorkflow.jobs.docker.needs).toBe('build');
    });

    test('security job completes before container-scan job starts', () => {
      // This is validated by the needs dependency
      expect(securityWorkflow.jobs['container-scan'].needs).toBe('security');
    });
  });

  describe('Workflow Consistency', () => {
    test('all workflows use consistent checkout action version', () => {
      const workflowFiles = ['lint.yml', 'test.yml', 'build.yml', 'security.yml', 'deploy.yml'];
      
      workflowFiles.forEach(file => {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        const workflow = yaml.load(content) as any;
        
        // Find all checkout steps
        const jobs = Object.values(workflow.jobs) as any[];
        jobs.forEach(job => {
          if (job.steps) {
            const checkoutSteps = job.steps.filter((s: any) => s.uses?.includes('actions/checkout'));
            checkoutSteps.forEach((step: any) => {
              expect(step.uses).toBe('actions/checkout@v4');
            });
          }
        });
      });
    });

    test('all workflows use consistent setup-node action version', () => {
      const workflowFiles = ['lint.yml', 'test.yml', 'build.yml', 'security.yml', 'deploy.yml'];
      
      workflowFiles.forEach(file => {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        const workflow = yaml.load(content) as any;
        
        // Find all setup-node steps
        const jobs = Object.values(workflow.jobs) as any[];
        jobs.forEach(job => {
          if (job.steps) {
            const setupNodeSteps = job.steps.filter((s: any) => s.uses?.includes('actions/setup-node'));
            setupNodeSteps.forEach((step: any) => {
              expect(step.uses).toBe('actions/setup-node@v4');
            });
          }
        });
      });
    });

    test('all workflows run on ubuntu-latest', () => {
      const workflowFiles = ['lint.yml', 'test.yml', 'build.yml', 'security.yml', 'deploy.yml'];
      
      workflowFiles.forEach(file => {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        const workflow = yaml.load(content) as any;
        
        const jobs = Object.values(workflow.jobs) as any[];
        jobs.forEach(job => {
          expect(job['runs-on']).toBe('ubuntu-latest');
        });
      });
    });
  });
});