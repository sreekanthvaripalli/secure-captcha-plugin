# Deployment Guide - Secure CAPTCHA Plugin

## Overview

This guide covers the deployment automation for the Secure CAPTCHA Plugin, including deployment strategies, CI/CD pipelines, rollback procedures, and health checks.

---

## Table of Contents

1. [Deployment Strategies](#deployment-strategies)
2. [CI/CD Pipeline](#cicd-pipeline)
3. [Deployment Scripts](#deployment-scripts)
4. [Health Checks](#health-checks)
5. [Rollback Procedures](#rollback-procedures)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Helm Deployment](#helm-deployment)
8. [Environment Configuration](#environment-configuration)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Troubleshooting](#troubleshooting)

---

## Deployment Strategies

### 1. Rolling Deployment (Default)

The default deployment strategy uses Kubernetes rolling updates with zero downtime.

**Characteristics:**
- Gradual replacement of old pods with new ones
- Configurable maxSurge and maxUnavailable
- No traffic switching required
- Automatic rollback on failure

**Configuration:**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

**Usage:**
```bash
bash scripts/deploy/deploy.sh -e staging -v 1.2.0 -s rolling deploy
```

### 2. Blue-Green Deployment

Blue-green deployment maintains two identical production environments (blue and green) and switches traffic between them.

**Characteristics:**
- Zero-downtime deployments
- Instant rollback capability
- Requires double the resources
- Traffic switching via service selector

**How it works:**
1. Deploy new version to inactive slot (e.g., green)
2. Run health checks on new deployment
3. Switch traffic from active slot (blue) to new slot (green)
4. Scale down old deployment

**Usage:**
```bash
# Deploy to production
bash scripts/deploy/blue-green-deploy.sh -e production -v 1.2.0

# Rollback
bash scripts/deploy/blue-green-deploy.sh -e production --rollback

# Dry run
bash scripts/deploy/blue-green-deploy.sh -e production -v 1.2.0 --dry-run
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-e, --environment` | Target environment (staging, production) | Required |
| `-v, --version` | Application version | Required |
| `-i, --image` | Docker image | `secure-captcha:VERSION` |
| `-n, --namespace` | Kubernetes namespace | `secure-captcha` |
| `-s, --skip-health` | Skip health checks | false |
| `-r, --rollback` | Rollback to previous | false |
| `-d, --dry-run` | Show what would be done | false |

### 3. Canary Deployment

Canary deployment gradually shifts traffic from the old version to the new version.

**Characteristics:**
- Gradual traffic shift (10% → 30% → 50% → 100%)
- Automated metrics-based promotion
- Automatic rollback on threshold breach
- Supports Istio VirtualService

**How it works:**
1. Deploy canary with small traffic weight (default: 10%)
2. Monitor error rate and latency
3. Gradually increase traffic (default: +20% increments)
4. Auto-promote if metrics are healthy
5. Rollback if thresholds are exceeded

**Usage:**
```bash
# Deploy canary
bash scripts/deploy/canary-deploy.sh -e production -v 1.2.0

# Deploy with custom weights
bash scripts/deploy/canary-deploy.sh -e production -v 1.2.0 -w 5 -m 15

# Auto-promote if metrics are good
bash scripts/deploy/canary-deploy.sh -e production -v 1.2.0 -a

# Promote existing canary
bash scripts/deploy/canary-deploy.sh -e production --promote

# Rollback canary
bash scripts/deploy/canary-deploy.sh -e production --rollback
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-e, --environment` | Target environment | Required |
| `-v, --version` | Application version | Required |
| `-w, --initial-weight` | Initial canary weight (%) | 10 |
| `-m, --increment` | Traffic increment (%) | 20 |
| `-t, --error-threshold` | Error rate threshold (%) | 5 |
| `-l, --latency-threshold` | P99 latency threshold (ms) | 500 |
| `-a, --auto-promote` | Auto-promote if healthy | false |
| `-p, --promote` | Promote canary to full | false |
| `-r, --rollback` | Rollback canary | false |

---

## CI/CD Pipeline

### GitHub Actions Workflows

The project uses 5 GitHub Actions workflows:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Lint** | Push, PR | ESLint, Prettier, TypeScript |
| **Test** | Push, PR | Unit, integration, E2E tests |
| **Build** | Push, PR | TypeScript build, Docker image |
| **Security** | Push, Schedule | npm audit, Snyk, Trivy |
| **Deploy** | Push to main/tags, Manual | Deployment automation |

### Deploy Workflow

**Triggers:**
- Push to `main` → Deploy to staging (rolling)
- Push to `v*` tag → Deploy to production (blue-green)
- Manual workflow dispatch → Deploy to any environment with any strategy

**Jobs:**
1. **deploy-staging**: Automatic staging deployment on main branch push
2. **deploy-production**: Automatic production deployment on version tag
3. **deploy-manual**: Manual deployment with strategy selection
4. **rollback**: Rollback deployment
5. **canary-promote**: Promote canary to full deployment

**Required Secrets:**
```
KUBE_CONFIG_STAGING     # Staging kubeconfig
KUBE_CONFIG_PRODUCTION  # Production kubeconfig
DOCKER_USERNAME         # Docker Hub username
DOCKER_PASSWORD         # Docker Hub password
```

---

## Deployment Scripts

### Script Location
All deployment scripts are located in `scripts/deploy/`:

| Script | Description |
|--------|-------------|
| `deploy.sh` | Main deployment orchestrator |
| `blue-green-deploy.sh` | Blue-green deployment |
| `canary-deploy.sh` | Canary deployment |
| `rollback.sh` | Rollback for all strategies |
| `health-check.sh` | Comprehensive health checks |

### Deploy Orchestrator

The main orchestrator (`deploy.sh`) provides a unified interface for all deployment operations:

```bash
# Deploy
bash scripts/deploy/deploy.sh -e staging -v 1.2.0 -s rolling deploy
bash scripts/deploy/deploy.sh -e production -v 1.2.0 -s blue-green deploy
bash scripts/deploy/deploy.sh -e production -v 1.2.0 -s canary deploy

# Rollback
bash scripts/deploy/deploy.sh -e production rollback

# Health check
bash scripts/deploy/deploy.sh -e production health

# Status
bash scripts/deploy/deploy.sh -e production status

# Promote canary
bash scripts/deploy/deploy.sh -e production promote
```

---

## Health Checks

### Health Check Script

The health check script (`health-check.sh`) provides comprehensive health verification:

```bash
# Check all components
bash scripts/deploy/health-check.sh -e production

# Check specific component
bash scripts/deploy/health-check.sh -e production -c api
bash scripts/deploy/health-check.sh -e production -c database
bash scripts/deploy/health-check.sh -e production -c cache
bash scripts/deploy/health-check.sh -e production -c monitoring

# Detailed output
bash scripts/deploy/health-check.sh -e production -d
```

### Health Check Categories

| Category | Checks |
|----------|--------|
| **API** | Health endpoint, metrics endpoint, captcha types, response time |
| **Database** | PostgreSQL connectivity, deployment status, availability |
| **Cache** | Redis connectivity, deployment status, availability |
| **Kubernetes** | Deployment replicas, pod status, restart count |
| **Monitoring** | Prometheus, Grafana, target status |
| **Security** | Security headers (X-Content-Type-Options, X-Frame-Options, etc.) |

### Kubernetes Health Probes

The deployment includes three types of health probes:

| Probe | Path | Initial Delay | Period | Timeout | Failure Threshold |
|-------|------|---------------|--------|---------|-------------------|
| **Liveness** | /api/v1/health | 30s | 10s | 5s | 3 |
| **Readiness** | /api/v1/health | 10s | 5s | 3s | 3 |
| **Startup** | /api/v1/health | 10s | 5s | 3s | 30 |

---

## Rollback Procedures

### Rolling Deployment Rollback

```bash
# Rollback to previous revision
bash scripts/deploy/rollback.sh -e production

# Rollback to specific revision
bash scripts/deploy/rollback.sh -e production -r 3
```

### Blue-Green Rollback

```bash
# Switch traffic to inactive slot
bash scripts/deploy/rollback.sh -e production -t blue-green
```

### Canary Rollback

```bash
# Route all traffic to stable, delete canary
bash scripts/deploy/rollback.sh -e production -t canary
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/secure-captcha -n secure-captcha

# Rollback to previous
kubectl rollout undo deployment/secure-captcha -n secure-captcha

# Rollback to specific revision
kubectl rollout undo deployment/secure-captcha -n secure-captcha --to-revision=3

# Check rollout status
kubectl rollout status deployment/secure-captcha -n secure-captcha
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Docker image built and pushed

### Deploy with kubectl

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/network-policy.yaml
kubectl apply -f k8s/rbac.yaml
```

### Verify Deployment

```bash
# Check deployment status
kubectl get deployment -n secure-captcha

# Check pods
kubectl get pods -n secure-captcha

# Check services
kubectl get svc -n secure-captcha

# Check logs
kubectl logs -f deployment/secure-captcha -n secure-captcha
```

---

## Helm Deployment

### Install

```bash
# Install with default values
helm install secure-captcha helm/secure-captcha/ -n secure-captcha --create-namespace

# Install with custom values
helm install secure-captcha helm/secure-captcha/ -n secure-captcha -f custom-values.yaml
```

### Upgrade

```bash
# Upgrade
helm upgrade secure-captcha helm/secure-captcha/ -n secure-captcha

# Upgrade with rollback on failure
helm upgrade secure-captcha helm/secure-captcha/ -n secure-captcha --atomic --rollback-on-failure
```

### Uninstall

```bash
helm uninstall secure-captcha -n secure-captcha
```

---

## Environment Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `secure_captcha` |
| `POSTGRES_USER` | Database user | `captcha_user` |
| `POSTGRES_PASSWORD` | Database password | (secret) |
| `JWT_SECRET` | JWT signing key | (secret) |
| `ENCRYPTION_KEY` | AES encryption key | (secret) |

### ConfigMap

The ConfigMap (`k8s/configmap.yaml`) contains non-sensitive configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: secure-captcha-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  POSTGRES_HOST: "postgres"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "secure_captcha"
  POSTGRES_USER: "captcha_user"
  REDIS_URL: "redis://redis:6379"
```

### Secrets

The Secret manifest (`k8s/secret.yaml`) contains sensitive data:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secure-captcha-secret
type: Opaque
stringData:
  POSTGRES_PASSWORD: "<base64-encoded>"
  JWT_SECRET: "<base64-encoded>"
  ENCRYPTION_KEY: "<base64-encoded>"
```

---

## Monitoring & Alerting

### Prometheus Metrics

The application exposes Prometheus metrics at `/api/v1/metrics`:

- Request rate (requests/second)
- Request latency (histogram)
- Error rate (counter)
- CAPTCHA generation time
- CAPTCHA validation time
- Active sessions (gauge)
- Cache hit/miss ratio
- Security events (counter)

### Grafana Dashboards

Pre-configured dashboards:
- **Performance Dashboard**: Request rate, latency, error rate, throughput
- **Security Dashboard**: Security events, rate limit hits, validation results
- **Business Dashboard**: CAPTCHA types usage, difficulty distribution

### Alert Rules

Configure alerts in Prometheus AlertManager:

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | Error rate > 5% | Critical |
| HighLatency | P99 latency > 500ms | Warning |
| LowAvailability | Availability < 99.9% | Critical |
| SecurityEvent | Security event detected | Warning |
| HighResourceUsage | CPU/Memory > 80% | Warning |

---

## Troubleshooting

### Common Issues

#### Pod Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n secure-captcha

# Check pod logs
kubectl logs <pod-name> -n secure-captcha
```

#### Health Check Failures

```bash
# Run health checks
bash scripts/deploy/health-check.sh -e production

# Check pod readiness
kubectl get pods -n secure-captcha -w
```

#### Deployment Rollback

```bash
# Check rollout history
kubectl rollout history deployment/secure-captcha -n secure-captcha

# Rollback
kubectl rollout undo deployment/secure-captcha -n secure-captcha
```

#### Resource Issues

```bash
# Check resource usage
kubectl top pods -n secure-captcha

# Check HPA status
kubectl get hpa -n secure-captcha
```

### Debug Mode

Enable debug logging:

```bash
kubectl set env deployment/secure-captcha LOG_LEVEL=debug -n secure-captcha
```

---

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Code coverage > 95%
- [ ] Security scan passed (`npm audit`)
- [ ] Docker image built and pushed
- [ ] Kubernetes manifests validated
- [ ] Environment variables configured
- [ ] Secrets updated
- [ ] Health checks configured
- [ ] Monitoring configured
- [ ] Rollback plan documented

---

## Post-Deployment Checklist

- [ ] Health checks passing
- [ ] Metrics collecting correctly
- [ ] No errors in logs
- [ ] Performance within targets
- [ ] Security headers present
- [ ] Smoke tests passing
- [ ] Monitoring dashboards updated