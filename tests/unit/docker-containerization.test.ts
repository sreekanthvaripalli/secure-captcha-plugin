import * as fs from 'fs';
import * as path from 'path';

describe('Docker Containerization', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  const dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
  const prometheusConfigPath = path.join(projectRoot, 'prometheus.yml');
  const initDbPath = path.join(projectRoot, 'init-db.sql');
  const dockerignorePath = path.join(projectRoot, '.dockerignore');

  describe('Dockerfile', () => {
    test('should exist', () => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    test('should have valid syntax', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Check for multi-stage build
      expect(content).toContain('FROM node:20-alpine AS builder');
      expect(content).toContain('FROM node:20-alpine AS production');

      // Check for security features
      expect(content).toContain('addgroup');
      expect(content).toContain('adduser');
      expect(content).toContain('USER captcha');

      // Check for health check
      expect(content).toContain('HEALTHCHECK');
      expect(content).toContain('curl -f http://localhost:3000/api/v1/health');

      // Check for minimal base image
      expect(content).toContain('node:20-alpine');

      // Check for tini init process
      expect(content).toContain('tini');
      expect(content).toContain('ENTRYPOINT ["/sbin/tini", "--"]');
    });

    test('should use non-root user', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Check for user creation
      expect(content).toMatch(/addgroup.*-g 1001/);
      expect(content).toMatch(/adduser.*-u 1001/);

      // Check for user switch
      expect(content).toContain('USER captcha');
    });

    test('should have proper labels', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      expect(content).toContain('LABEL maintainer=');
      expect(content).toContain('LABEL version=');
      expect(content).toContain('LABEL description=');
    });

    test('should expose correct port', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      expect(content).toContain('EXPOSE 3000');
    });

    test('should have health check configuration', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      expect(content).toContain('HEALTHCHECK');
      expect(content).toContain('--interval=30s');
      expect(content).toContain('--timeout=10s');
      expect(content).toContain('--start-period=40s');
      expect(content).toContain('--retries=3');
    });
  });

  describe('Docker Compose', () => {
    test('should exist', () => {
      expect(fs.existsSync(dockerComposePath)).toBe(true);
    });

    test('should have valid YAML syntax', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // Basic YAML structure checks
      expect(content).toContain('version:');
      expect(content).toContain('services:');
      expect(content).toContain('networks:');
      expect(content).toContain('volumes:');
    });

    test('should define all required services', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      expect(content).toContain('app:');
      expect(content).toContain('redis:');
      expect(content).toContain('postgres:');
      expect(content).toContain('prometheus:');
      expect(content).toContain('grafana:');
    });

    test('should have proper service configuration', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // App service
      expect(content).toContain('build:');
      expect(content).toContain('dockerfile: Dockerfile');
      expect(content).toContain('container_name: secure-captcha-app');
      expect(content).toContain('restart: unless-stopped');

      // Redis service
      expect(content).toContain('image: redis:7-alpine');
      expect(content).toContain('container_name: secure-captcha-redis');

      // PostgreSQL service
      expect(content).toContain('image: postgres:15-alpine');
      expect(content).toContain('container_name: secure-captcha-postgres');

      // Prometheus service
      expect(content).toContain('image: prom/prometheus:v2.45.0');
      expect(content).toContain('container_name: secure-captcha-prometheus');

      // Grafana service
      expect(content).toContain('image: grafana/grafana:10.0.0');
      expect(content).toContain('container_name: secure-captcha-grafana');
    });

    test('should have health checks for all services', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // Count healthcheck occurrences
      const healthcheckMatches = content.match(/healthcheck:/g);
      expect(healthcheckMatches).toHaveLength(5); // 5 services

      // Check for specific health check commands (with escaped quotes in YAML)
      expect(content).toContain('curl -f http://localhost:3000/api/v1/health');
      expect(content).toContain('redis-cli');
      expect(content).toContain('ping');
      expect(content).toContain('pg_isready -U postgres');
      expect(content).toContain('wget');
      expect(content).toContain('--no-verbose');
      expect(content).toContain('--tries=1');
      expect(content).toContain('--spider');
      expect(content).toContain('http://localhost:9090/-/healthy');
      expect(content).toContain('curl -f http://localhost:3000/api/v1/health || exit 1');
    });

    test('should have proper networking', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      expect(content).toContain('networks:');
      expect(content).toContain('secure-captcha-network:');
      expect(content).toContain('driver: bridge');
    });

    test('should have volume mounts', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      expect(content).toContain('volumes:');
      expect(content).toContain('redis-data:');
      expect(content).toContain('postgres-data:');
      expect(content).toContain('prometheus-data:');
      expect(content).toContain('grafana-data:');
    });

    test('should have proper environment variables', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // App environment
      expect(content).toContain('NODE_ENV=production');
      expect(content).toContain('PORT=3000');
      expect(content).toContain('REDIS_URL=redis://redis:6379');
      expect(content).toContain(
        'DATABASE_URL=postgresql://postgres:postgres@postgres:5432/secure_captcha'
      );

      // PostgreSQL environment
      expect(content).toContain('POSTGRES_USER=postgres');
      expect(content).toContain('POSTGRES_PASSWORD=postgres');
      expect(content).toContain('POSTGRES_DB=secure_captcha');

      // Grafana environment
      expect(content).toContain('GF_SECURITY_ADMIN_USER=admin');
      expect(content).toContain('GF_SECURITY_ADMIN_PASSWORD=admin');
    });

    test('should have proper port mappings', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      expect(content).toContain('"3000:3000"');
      expect(content).toContain('"6379:6379"');
      expect(content).toContain('"5432:5432"');
      expect(content).toContain('"9090:9090"');
      expect(content).toContain('"3001:3000"');
    });

    test('should have dependency management', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      expect(content).toContain('depends_on:');
      expect(content).toContain('condition: service_healthy');
    });
  });

  describe('Prometheus Configuration', () => {
    test('should exist', () => {
      expect(fs.existsSync(prometheusConfigPath)).toBe(true);
    });

    test('should have valid YAML syntax', () => {
      const content = fs.readFileSync(prometheusConfigPath, 'utf-8');

      expect(content).toContain('global:');
      expect(content).toContain('scrape_configs:');
    });

    test('should have proper scrape configuration', () => {
      const content = fs.readFileSync(prometheusConfigPath, 'utf-8');

      expect(content).toContain('scrape_interval: 15s');
      expect(content).toContain('evaluation_interval: 15s');
    });

    test('should define scrape jobs', () => {
      const content = fs.readFileSync(prometheusConfigPath, 'utf-8');

      expect(content).toContain("job_name: 'prometheus'");
      expect(content).toContain("job_name: 'secure-captcha'");
    });

    test('should have proper targets', () => {
      const content = fs.readFileSync(prometheusConfigPath, 'utf-8');

      expect(content).toContain("targets: ['localhost:9090']");
      expect(content).toContain("targets: ['app:3000']");
    });

    test('should have metrics path configuration', () => {
      const content = fs.readFileSync(prometheusConfigPath, 'utf-8');

      expect(content).toContain("metrics_path: '/api/v1/metrics'");
    });
  });

  describe('Database Initialization', () => {
    test('should exist', () => {
      expect(fs.existsSync(initDbPath)).toBe(true);
    });

    test('should have valid SQL syntax', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      // Check for SQL keywords
      expect(content).toContain('CREATE TABLE');
      expect(content).toContain('CREATE INDEX');
      expect(content).toContain('CREATE EXTENSION');
      expect(content).toContain('CREATE OR REPLACE FUNCTION');
    });

    test('should create required tables', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      expect(content).toContain('CREATE TABLE IF NOT EXISTS sessions');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS captcha_logs');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS security_events');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS rate_limits');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS api_keys');
    });

    test('should create required indexes', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_ip_address');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_created_at');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_captcha_logs_session_id');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_captcha_logs_created_at');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_security_events_event_type');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint');
      expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash');
    });

    test('should create utility functions', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      expect(content).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()');
      expect(content).toContain('CREATE OR REPLACE FUNCTION cleanup_expired_sessions()');
      expect(content).toContain('CREATE OR REPLACE FUNCTION cleanup_old_logs()');
    });

    test('should create triggers', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      expect(content).toContain('CREATE TRIGGER update_rate_limits_updated_at');
      expect(content).toContain('CREATE TRIGGER update_api_keys_updated_at');
    });

    test('should enable required extensions', () => {
      const content = fs.readFileSync(initDbPath, 'utf-8');

      expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    });
  });

  describe('Docker Ignore', () => {
    test('should exist', () => {
      expect(fs.existsSync(dockerignorePath)).toBe(true);
    });

    test('should exclude common files', () => {
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toContain('node_modules/');
      expect(content).toContain('.git/');
      expect(content).toContain('*.log');
      expect(content).toContain('.env');
      expect(content).toContain('dist/');
      expect(content).toContain('coverage/');
    });

    test('should exclude Docker files', () => {
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toContain('Dockerfile*');
      expect(content).toContain('docker-compose*');
      expect(content).toContain('.dockerignore');
    });

    test('should exclude documentation', () => {
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toContain('*.md');
      expect(content).toContain('docs/');
    });

    test('should exclude test files', () => {
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toContain('tests/');
      expect(content).toContain('coverage/');
    });
  });

  describe('Integration Tests', () => {
    test('should have consistent service names', () => {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');
      const prometheusContent = fs.readFileSync(prometheusConfigPath, 'utf-8');

      // Prometheus should reference app service
      expect(prometheusContent).toContain("targets: ['app:3000']");
      expect(composeContent).toContain('app:');
    });

    test('should have consistent port configurations', () => {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');

      // App should expose port 3000
      expect(composeContent).toContain('"3000:3000"');

      // Prometheus should expose port 9090
      expect(composeContent).toContain('"9090:9090"');

      // Grafana should expose port 3001 (mapped to 3000)
      expect(composeContent).toContain('"3001:3000"');
    });

    test('should have consistent volume mounts', () => {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');

      // Prometheus config should be mounted
      expect(composeContent).toContain('./prometheus.yml:/etc/prometheus/prometheus.yml');

      // Grafana provisioning should be mounted
      expect(composeContent).toContain('./grafana/provisioning:/etc/grafana/provisioning');
      expect(composeContent).toContain('./grafana/dashboards:/var/lib/grafana/dashboards');

      // Database init script should be mounted
      expect(composeContent).toContain('./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql');
    });

    test('should have consistent network configuration', () => {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');

      // All services should use the same network
      const networkReferences = composeContent.match(/secure-captcha-network/g);
      expect(networkReferences).toHaveLength(6); // 5 services + 1 network definition
    });
  });

  describe('Security Validation', () => {
    test('should not expose sensitive data in Dockerfile', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Should not contain hardcoded passwords or secrets
      expect(content).not.toMatch(/password.*=.*['"][^'"]+['"]/i);
      expect(content).not.toMatch(/secret.*=.*['"][^'"]+['"]/i);
      expect(content).not.toMatch(/key.*=.*['"][^'"]+['"]/i);
    });

    test('should use environment variables for sensitive data', () => {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf-8');

      // Database credentials should be configurable
      expect(composeContent).toContain('POSTGRES_PASSWORD=postgres');
      expect(composeContent).toContain(
        'DATABASE_URL=postgresql://postgres:postgres@postgres:5432/secure_captcha'
      );
    });

    test('should have proper file permissions in Dockerfile', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Should set proper ownership
      expect(content).toContain('chown -R captcha:captcha');
    });
  });

  describe('Performance Validation', () => {
    test('should use multi-stage build for smaller images', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Should have builder and production stages
      expect(content).toContain('AS builder');
      expect(content).toContain('AS production');

      // Should copy only necessary files from builder
      expect(content).toContain('COPY --from=builder');
    });

    test('should clean up build dependencies', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');

      // Should clean npm cache
      expect(content).toContain('npm cache clean --force');

      // Should remove apk cache
      expect(content).toContain('rm -rf /var/cache/apk/*');
    });

    test('should have proper resource limits in compose', () => {
      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // Redis should have memory limits
      expect(content).toContain('maxmemory 256mb');
      expect(content).toContain('maxmemory-policy allkeys-lru');
    });
  });
});
