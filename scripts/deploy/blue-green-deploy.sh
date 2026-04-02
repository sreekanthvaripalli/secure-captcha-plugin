#!/bin/bash
# Blue-Green Deployment Script for Secure CAPTCHA Plugin
# This script implements blue-green deployment strategy for zero-downtime deployments

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-secure-captcha}"
APP_NAME="${APP_NAME:-secure-captcha}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"

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

Blue-Green Deployment Script for Secure CAPTCHA Plugin

OPTIONS:
    -e, --environment ENV       Target environment (staging, production) [required]
    -v, --version VERSION       Application version to deploy [required]
    -i, --image IMAGE           Docker image to deploy (default: secure-captcha:VERSION)
    -n, --namespace NAMESPACE   Kubernetes namespace (default: secure-captcha)
    -s, --skip-health           Skip health checks after deployment
    -r, --rollback              Rollback to the previous deployment
    -d, --dry-run               Show what would be done without executing
    -h, --help                  Show this help message

EXAMPLES:
    # Deploy version 1.2.0 to staging
    $0 -e staging -v 1.2.0

    # Deploy with custom image
    $0 -e production -v 1.2.0 -i myregistry/secure-captcha:1.2.0

    # Rollback staging environment
    $0 -e staging --rollback

    # Dry run deployment
    $0 -e staging -v 1.2.0 --dry-run

EOF
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
VERSION=""
IMAGE=""
SKIP_HEALTH=false
ROLLBACK=false
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
        -s|--skip-health)
            SKIP_HEALTH=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
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
if [ "$ROLLBACK" = false ] && [ -z "$ENVIRONMENT" ]; then
    log_error "Environment is required"
    usage
fi

if [ "$ROLLBACK" = false ] && [ -z "$VERSION" ]; then
    log_error "Version is required"
    usage
fi

# Set default image if not provided
if [ -z "$IMAGE" ] && [ "$ROLLBACK" = false ]; then
    IMAGE="secure-captcha:${VERSION}"
fi

# Determine deployment slot (blue or green)
get_current_slot() {
    local current_deployment
    current_deployment=$(kubectl get deployment -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ "$current_deployment" == *"-blue" ]]; then
        echo "blue"
    elif [[ "$current_deployment" == *"-green" ]]; then
        echo "green"
    else
        echo "blue"  # Default to blue if no existing deployment
    fi
}

get_target_slot() {
    local current_slot="$1"
    if [ "$current_slot" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Health check function
check_health() {
    local deployment_name="$1"
    local attempt=0
    
    log_info "Running health checks for $deployment_name..."
    
    while [ $attempt -lt $HEALTH_CHECK_RETRIES ]; do
        attempt=$((attempt + 1))
        log_info "Health check attempt $attempt/$HEALTH_CHECK_RETRIES..."
        
        # Check if deployment is ready
        local ready
        ready=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired
        desired=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        
        if [ "$ready" = "$desired" ] && [ "$ready" != "0" ]; then
            log_success "Deployment $deployment_name is ready ($ready/$desired replicas)"
            
            # Test health endpoint
            local pod_name
            pod_name=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME",slot="$2" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
            
            if [ -n "$pod_name" ]; then
                local health_status
                health_status=$(kubectl exec "$pod_name" -n "$NAMESPACE" -- curl -sf http://localhost:3000/api/v1/health 2>/dev/null || echo "")
                
                if echo "$health_status" | grep -q '"status":"healthy"'; then
                    log_success "Health endpoint returned healthy status"
                    return 0
                else
                    log_warning "Health endpoint not yet healthy: $health_status"
                fi
            fi
        else
            log_warning "Deployment not ready: $ready/$desired replicas"
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Rollback function
perform_rollback() {
    log_info "Rolling back $ENVIRONMENT environment..."
    
    local current_slot
    current_slot=$(get_current_slot)
    local target_slot
    target_slot=$(get_target_slot "$current_slot")
    
    local current_deployment="${APP_NAME}-${current_slot}"
    local target_deployment="${APP_NAME}-${target_slot}"
    
    # Check if target deployment exists
    if ! kubectl get deployment "$target_deployment" -n "$NAMESPACE" &>/dev/null; then
        log_error "No previous deployment found to rollback to ($target_deployment)"
        exit 1
    fi
    
    log_info "Switching traffic from $current_deployment to $target_deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would switch traffic from $current_deployment to $target_deployment"
        return 0
    fi
    
    # Update service selector to point to target slot
    kubectl patch service "$APP_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"slot\":\"$target_slot\"}}}"
    
    # Wait for traffic switch
    sleep 5
    
    # Verify traffic switch
    local active_slot
    active_slot=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}')
    
    if [ "$active_slot" = "$target_slot" ]; then
        log_success "Traffic switched to $target_deployment"
    else
        log_error "Failed to switch traffic"
        exit 1
    fi
    
    # Scale down old deployment
    log_info "Scaling down old deployment $current_deployment..."
    kubectl scale deployment "$current_deployment" -n "$NAMESPACE" --replicas=0
    
    log_success "Rollback completed successfully"
}

# Deploy function
perform_deploy() {
    local target_slot="$1"
    local deployment_name="${APP_NAME}-${target_slot}"
    
    log_info "Deploying $IMAGE to $deployment_name..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy $IMAGE to $deployment_name"
        cat << EOF
# Deployment manifest that would be applied:
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $deployment_name
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $APP_NAME
    app.kubernetes.io/component: app
    slot: $target_slot
    version: $VERSION
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: $APP_NAME
      slot: $target_slot
  template:
    metadata:
      labels:
        app.kubernetes.io/name: $APP_NAME
        slot: $target_slot
        version: $VERSION
    spec:
      containers:
      - name: $APP_NAME
        image: $IMAGE
        ports:
        - containerPort: 3000
EOF
        return 0
    fi
    
    # Create deployment manifest
    cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $deployment_name
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: $APP_NAME
    app.kubernetes.io/component: app
    slot: $target_slot
    version: "$VERSION"
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: $APP_NAME
      slot: $target_slot
  template:
    metadata:
      labels:
        app.kubernetes.io/name: $APP_NAME
        slot: $target_slot
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
        startupProbe:
          httpGet:
            path: /api/v1/health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
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
    
    # Wait for rollout
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout="$ROLLOUT_TIMEOUT"
    
    # Run health checks
    if [ "$SKIP_HEALTH" = false ]; then
        if ! check_health "$deployment_name" "$target_slot"; then
            log_error "Health checks failed, rolling back..."
            kubectl rollout undo deployment/"$deployment_name" -n "$NAMESPACE"
            exit 1
        fi
    fi
    
    log_success "Deployment $deployment_name is healthy"
}

# Switch traffic function
switch_traffic() {
    local target_slot="$1"
    
    log_info "Switching traffic to $target_slot..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would switch traffic to $target_slot"
        return 0
    fi
    
    # Update service selector
    kubectl patch service "$APP_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"slot\":\"$target_slot\"}}}"
    
    # Wait for traffic switch
    sleep 5
    
    # Verify traffic switch
    local active_slot
    active_slot=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}')
    
    if [ "$active_slot" = "$target_slot" ]; then
        log_success "Traffic switched to $target_slot"
    else
        log_error "Failed to switch traffic"
        exit 1
    fi
}

# Scale down old deployment
scale_down_old() {
    local old_slot="$1"
    local old_deployment="${APP_NAME}-${old_slot}"
    
    log_info "Scaling down old deployment $old_deployment..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would scale down $old_deployment to 0 replicas"
        return 0
    fi
    
    kubectl scale deployment "$old_deployment" -n "$NAMESPACE" --replicas=0
    log_success "Old deployment scaled down"
}

# Main deployment flow
main() {
    if [ "$ROLLBACK" = true ]; then
        perform_rollback
        exit 0
    fi
    
    log_info "Starting blue-green deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Image: $IMAGE"
    log_info "Namespace: $NAMESPACE"
    
    # Determine current and target slots
    local current_slot
    current_slot=$(get_current_slot)
    local target_slot
    target_slot=$(get_target_slot "$current_slot")
    
    log_info "Current slot: $current_slot"
    log_info "Target slot: $target_slot"
    
    # Deploy to target slot
    perform_deploy "$target_slot"
    
    # Switch traffic to target slot
    switch_traffic "$target_slot"
    
    # Scale down old deployment
    scale_down_old "$current_slot"
    
    log_success "Blue-green deployment completed successfully!"
    log_info "Active deployment: ${APP_NAME}-${target_slot}"
    log_info "Version: $VERSION"
}

# Run main function
main