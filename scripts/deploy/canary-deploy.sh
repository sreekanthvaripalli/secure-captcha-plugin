#!/bin/bash
# Canary Deployment Script for Secure CAPTCHA Plugin
# This script implements canary deployment strategy for gradual rollouts

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-secure-captcha}"
APP_NAME="${APP_NAME:-secure-captcha}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"
CANARY_INITIAL_WEIGHT="${CANARY_INITIAL_WEIGHT:-10}"
CANARY_INCREMENT="${CANARY_INCREMENT:-20}"
CANARY_MAX_WEIGHT="${CANARY_MAX_WEIGHT:-100}"
CANARY_ANALYSIS_INTERVAL="${CANARY_ANALYSIS_INTERVAL:-60}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-5}"
LATENCY_THRESHOLD="${LATENCY_THRESHOLD:-500}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Canary Deployment Script for Secure CAPTCHA Plugin

OPTIONS:
    -e, --environment ENV           Target environment (staging, production) [required]
    -v, --version VERSION           Application version to deploy [required]
    -i, --image IMAGE               Docker image to deploy (default: secure-captcha:VERSION)
    -n, --namespace NAMESPACE       Kubernetes namespace (default: secure-captcha)
    -w, --initial-weight WEIGHT     Initial canary traffic weight (default: 10)
    -m, --increment WEIGHT          Traffic weight increment (default: 20)
    -t, --error-threshold PERCENT   Error rate threshold for rollback (default: 5)
    -l, --latency-threshold MS      P99 latency threshold for rollback (default: 500)
    -a, --auto-promote              Auto-promote canary if metrics are good
    -r, --rollback                  Rollback canary deployment
    -p, --promote                   Promote canary to full deployment
    -d, --dry-run                   Show what would be done without executing
    -h, --help                      Show this help message

EXAMPLES:
    # Deploy canary with default settings
    $0 -e production -v 1.2.0

    # Deploy canary with custom weight
    $0 -e production -v 1.2.0 -w 5 -m 15

    # Auto-promote canary if metrics are good
    $0 -e production -v 1.2.0 -a

    # Promote existing canary to full deployment
    $0 -e production --promote

    # Rollback canary deployment
    $0 -e production --rollback

EOF
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
VERSION=""
IMAGE=""
INITIAL_WEIGHT="$CANARY_INITIAL_WEIGHT"
INCREMENT="$CANARY_INCREMENT"
AUTO_PROMOTE=false
ROLLBACK=false
PROMOTE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -w|--initial-weight)
            INITIAL_WEIGHT="$2"
            shift 2
            ;;
        -m|--increment)
            INCREMENT="$2"
            shift 2
            ;;
        -t|--error-threshold)
            ERROR_THRESHOLD="$2"
            shift 2
            ;;
        -l|--latency-threshold)
            LATENCY_THRESHOLD="$2"
            shift 2
            ;;
        -a|--auto-promote)
            AUTO_PROMOTE=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -p|--promote)
            PROMOTE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [ "$ROLLBACK" = false ] && [ "$PROMOTE" = false ] && [ -z "$ENVIRONMENT" ]; then
    log_error "Environment is required"
    usage
fi

if [ "$ROLLBACK" = false ] && [ "$PROMOTE" = false ] && [ -z "$VERSION" ]; then
    log_error "Version is required"
    usage
fi

# Set default image if not provided
if [ -z "$IMAGE" ] && [ "$ROLLBACK" = false ] && [ "$PROMOTE" = false ]; then
    IMAGE="secure-captcha:${VERSION}"
fi

# Health check function
check_health() {
    local deployment_name="$1"
    local attempt=0
    
    log_info "Running health checks for $deployment_name..."
    
    while [ $attempt -lt $HEALTH_CHECK_RETRIES ]; do
        attempt=$((attempt + 1))
        log_info "Health check attempt $attempt/$HEALTH_CHECK_RETRIES..."
        
        local ready
        ready=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired
        desired=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_success "Deployment $deployment_name is ready ($ready/$desired replicas)"
            return 0
        else
            log_warning "Deployment not ready: $ready/$desired replicas"
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Analyze canary metrics
analyze_canary_metrics() {
    local canary_weight="$1"
    
    log_info "Analyzing canary metrics (error threshold: ${ERROR_THRESHOLD}%, latency threshold: ${LATENCY_THRESHOLD}ms)..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would analyze metrics for canary at ${canary_weight}% traffic"
        echo "0.5"  # Simulated error rate
        echo "150"  # Simulated P99 latency
        return 0
    fi
    
    # Get error rate from Prometheus
    local error_rate
    error_rate=$(curl -sf "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\",app=\"$APP_NAME\"}[5m]) / rate(http_requests_total{app=\"$APP_NAME\"}[5m]) * 100" 2>/dev/null | \
        jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    
    # Get P99 latency from Prometheus
    local p99_latency
    p99_latency=$(curl -sf "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app=\"$APP_NAME\"}[5m])) * 1000" 2>/dev/null | \
        jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
    
    log_info "Current metrics: error_rate=${error_rate}%, p99_latency=${p99_latency}ms"
    
    # Check thresholds
    local error_ok
    error_ok=$(echo "$error_rate < $ERROR_THRESHOLD" | bc -l 2>/dev/null || echo "1")
    local latency_ok
    latency_ok=$(echo "$p99_latency < $LATENCY_THRESHOLD" | bc -l 2>/dev/null || echo "1")
    
    if [ "$error_ok" = "1" ] && [ "$latency_ok" = "1" ]; then
        log_success "Canary metrics are within thresholds"
        return 0
    else
        if [ "$error_ok" != "1" ]; then
            log_warning "Error rate ${error_rate}% exceeds threshold ${ERROR_THRESHOLD}%"
        fi
        if [ "$latency_ok" != "1" ]; then
            log_warning "P99 latency ${p99_latency}ms exceeds threshold ${LATENCY_THRESHOLD}ms"
        fi
        return 1
    fi
}

# Update traffic weights using Istio VirtualService
update_traffic_weights() {
    local canary_weight="$1"
    local stable_weight=$((100 - canary_weight))
    
    log_info "Updating traffic weights: stable=${stable_weight}%, canary=${canary_weight}%"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update traffic weights to stable=${stable_weight}%, canary=${canary_weight}%"
        return 0
    fi
    
    # Update Istio VirtualService if it exists
    if kubectl get virtualservice "$APP_NAME" -n "$NAMESPACE" &>/dev/null; then
        kubectl patch virtualservice "$APP_NAME" -n "$NAMESPACE" --type='json' -p="[
            {\"op\": \"replace\", \"path\": \"/spec/http/0/route/0/weight\", \"value\": $stable_weight},
            {\"op\": \"replace\", \"path\": \"/spec/http/0/route/1/weight\", \"value\": $canary_weight}
        ]"
    else
        # Fallback: Update service selector weights using annotations
        kubectl annotate service "$APP_NAME" -n "$NAMESPACE" \
            "canary-weight=${canary_weight}" \
            "stable-weight=${stable_weight}" \
            --overwrite
    fi
    
    log_success "Traffic weights updated: stable=${stable_weight}%, canary=${canary_weight}%"
}

# Rollback canary deployment
rollback_canary() {
    log_info "Rolling back canary deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback canary deployment"
        return 0
    fi
    
    # Route all traffic to stable
    update_traffic_weights 0
    
    # Delete canary deployment
    kubectl delete deployment "${APP_NAME}-canary" -n "$NAMESPACE" --ignore-not-found
    
    log_success "Canary deployment rolled back successfully"
}

# Promote canary to full deployment
promote_canary() {
    log_info "Promoting canary to full deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would promote canary to full deployment"
        return 0
    fi
    
    # Route all traffic to canary
    update_traffic_weights 100
    
    # Update stable deployment with canary image
    kubectl set image deployment/"$APP_NAME" "$APP_NAME"="$IMAGE" -n "$NAMESPACE"
    
    # Wait for rollout
    kubectl rollout status deployment/"$APP_NAME" -n "$NAMESPACE" --timeout="$ROLLOUT_TIMEOUT"
    
    # Delete canary deployment
    kubectl delete deployment "${APP_NAME}-canary" -n "$NAMESPACE" --ignore-not-found
    
    log_success "Canary promoted to full deployment"
}

# Deploy canary
deploy_canary() {
    local canary_weight="$INITIAL_WEIGHT"
    
    log_info "Starting canary deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Image: $IMAGE"
    log_info "Initial weight: ${canary_weight}%"
    log_info "Increment: ${INCREMENT}%"
    log_info "Error threshold: ${ERROR_THRESHOLD}%"
    log_info "Latency threshold: ${LATENCY_THRESHOLD}ms"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy canary with initial weight ${canary_weight}%"
        return 0
    fi
    
    # Create canary deployment
    cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${APP_NAME}-canary
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $APP_NAME
    app.kubernetes.io/component: app
    track: canary
    version: "$VERSION"
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: $APP_NAME
      track: canary
  template:
    metadata:
      labels:
        app.kubernetes.io/name: $APP_NAME
        track: canary
        version: "$VERSION"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: ${APP_NAME}-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: $APP_NAME
        image: $IMAGE
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        envFrom:
        - configMapRef:
            name: ${APP_NAME}-config
        - secretRef:
            name: ${APP_NAME}-secret
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: tmp
        emptyDir: {}
      - name: logs
        emptyDir: {}
      terminationGracePeriodSeconds: 30
EOF
    
    # Wait for canary to be ready
    if ! check_health "${APP_NAME}-canary"; then
        log_error "Canary deployment failed health checks"
        kubectl delete deployment "${APP_NAME}-canary" -n "$NAMESPACE" --ignore-not-found
        exit 1
    fi
    
    # Initial traffic split
    update_traffic_weights "$canary_weight"
    
    # Gradual traffic increase
    while [ "$canary_weight" -lt "$CANARY_MAX_WEIGHT" ]; do
        log_info "Canary at ${canary_weight}% traffic, waiting for analysis..."
        sleep "$CANARY_ANALYSIS_INTERVAL"
        
        if ! analyze_canary_metrics "$canary_weight"; then
            log_error "Canary metrics exceeded thresholds, rolling back..."
            rollback_canary
            exit 1
        fi
        
        canary_weight=$((canary_weight + INCREMENT))
        if [ "$canary_weight" -gt "$CANARY_MAX_WEIGHT" ]; then
            canary_weight=$CANARY_MAX_WEIGHT
        fi
        
        update_traffic_weights "$canary_weight"
    done
    
    log_success "Canary deployment completed successfully at 100% traffic"
    
    # Auto-promote if enabled
    if [ "$AUTO_PROMOTE" = true ]; then
        promote_canary
    fi
}

# Main function
main() {
    if [ "$ROLLBACK" = true ]; then
        rollback_canary
        exit 0
    fi
    
    if [ "$PROMOTE" = true ]; then
        promote_canary
        exit 0
    fi
    
    deploy_canary
}

# Run main function
main