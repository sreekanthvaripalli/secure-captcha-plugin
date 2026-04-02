#!/bin/bash
# Rollback Script for Secure CAPTCHA Plugin
# This script provides automated rollback capabilities for failed deployments

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-secure-captcha}"
APP_NAME="${APP_NAME:-secure-captcha}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"

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

Rollback Script for Secure CAPTCHA Plugin

OPTIONS:
    -e, --environment ENV       Target environment (staging, production) [required]
    -n, --namespace NAMESPACE   Kubernetes namespace (default: secure-captcha)
    -r, --revision REVISION     Specific revision to rollback to (default: previous)
    -t, --type TYPE             Deployment type (rolling, blue-green, canary) [default: rolling]
    -d, --dry-run               Show what would be done without executing
    -h, --help                  Show this help message

EXAMPLES:
    # Rollback to previous version (rolling)
    $0 -e production

    # Rollback to specific revision
    $0 -e production -r 3

    # Rollback blue-green deployment
    $0 -e production -t blue-green

    # Rollback canary deployment
    $0 -e production -t canary

    # Dry run rollback
    $0 -e production --dry-run

EOF
    exit 1
}

# Parse command line arguments
ENVIRONMENT=""
REVISION=""
DEPLOYMENT_TYPE="rolling"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--revision)
            REVISION="$2"
            shift 2
            ;;
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
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
if [ -z "$ENVIRONMENT" ]; then
    log_error "Environment is required"
    usage
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
            
            # Test health endpoint
            local pod_name
            pod_name=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
            
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

# Rolling deployment rollback
rollback_rolling() {
    log_info "Performing rolling deployment rollback..."
    
    if [ "$DRY_RUN" = true ]; then
        if [ -n "$REVISION" ]; then
            log_info "[DRY RUN] Would rollback $APP_NAME to revision $REVISION"
        else
            log_info "[DRY RUN] Would rollback $APP_NAME to previous revision"
        fi
        return 0
    fi
    
    # Get rollout history
    log_info "Rollout history for $APP_NAME:"
    kubectl rollout history deployment/"$APP_NAME" -n "$NAMESPACE"
    
    # Perform rollback
    if [ -n "$REVISION" ]; then
        log_info "Rolling back to revision $REVISION..."
        kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE" --to-revision="$REVISION"
    else
        log_info "Rolling back to previous revision..."
        kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE"
    fi
    
    # Wait for rollout to complete
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/"$APP_NAME" -n "$NAMESPACE" --timeout=300s
    
    # Verify health
    if check_health "$APP_NAME"; then
        log_success "Rolling rollback completed successfully"
    else
        log_error "Rollback completed but health checks failed"
        return 1
    fi
}

# Blue-green deployment rollback
rollback_blue_green() {
    log_info "Performing blue-green deployment rollback..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would switch traffic to inactive slot"
        return 0
    fi
    
    # Get current active slot
    local active_slot
    active_slot=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}' 2>/dev/null || echo "blue")
    
    # Determine target slot
    local target_slot
    if [ "$active_slot" = "blue" ]; then
        target_slot="green"
    else
        target_slot="blue"
    fi
    
    local target_deployment="${APP_NAME}-${target_slot}"
    
    # Check if target deployment exists
    if ! kubectl get deployment "$target_deployment" -n "$NAMESPACE" &>/dev/null; then
        log_error "Target deployment $target_deployment not found"
        exit 1
    fi
    
    # Switch traffic
    log_info "Switching traffic from $active_slot to $target_slot..."
    kubectl patch service "$APP_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"slot\":\"$target_slot\"}}}"
    
    # Wait for traffic switch
    sleep 5
    
    # Verify traffic switch
    local new_active_slot
    new_active_slot=$(kubectl get service "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}')
    
    if [ "$new_active_slot" = "$target_slot" ]; then
        log_success "Traffic switched to $target_slot"
    else
        log_error "Failed to switch traffic"
        exit 1
    fi
    
    # Verify health
    if check_health "$target_deployment"; then
        log_success "Blue-green rollback completed successfully"
    else
        log_error "Rollback completed but health checks failed"
        return 1
    fi
}

# Canary deployment rollback
rollback_canary() {
    log_info "Performing canary deployment rollback..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would route all traffic to stable and delete canary"
        return 0
    fi
    
    # Route all traffic to stable
    log_info "Routing all traffic to stable deployment..."
    
    # Update Istio VirtualService if it exists
    if kubectl get virtualservice "$APP_NAME" -n "$NAMESPACE" &>/dev/null; then
        kubectl patch virtualservice "$APP_NAME" -n "$NAMESPACE" --type='json' -p='[
            {"op": "replace", "path": "/spec/http/0/route/0/weight", "value": 100},
            {"op": "replace", "path": "/spec/http/0/route/1/weight", "value": 0}
        ]'
    else
        # Remove canary annotations
        kubectl annotate service "$APP_NAME" -n "$NAMESPACE" "canary-weight-" "stable-weight-" --overwrite 2>/dev/null || true
    fi
    
    # Delete canary deployment
    log_info "Deleting canary deployment..."
    kubectl delete deployment "${APP_NAME}-canary" -n "$NAMESPACE" --ignore-not-found
    
    log_success "Canary rollback completed successfully"
}

# Get deployment status
get_deployment_status() {
    log_info "Current deployment status:"
    
    # Show deployment info
    kubectl get deployment -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o wide 2>/dev/null || true
    
    # Show rollout history
    log_info "Rollout history:"
    kubectl rollout history deployment/"$APP_NAME" -n "$NAMESPACE" 2>/dev/null || true
    
    # Show recent events
    log_info "Recent events:"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || true
}

# Main function
main() {
    log_info "Starting rollback for $ENVIRONMENT environment"
    log_info "Deployment type: $DEPLOYMENT_TYPE"
    log_info "Namespace: $NAMESPACE"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN MODE - No changes will be made"
    fi
    
    # Get current status
    get_deployment_status
    
    # Perform rollback based on type
    case "$DEPLOYMENT_TYPE" in
        rolling)
            rollback_rolling
            ;;
        blue-green)
            rollback_blue_green
            ;;
        canary)
            rollback_canary
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    # Final status
    log_info "Final deployment status:"
    get_deployment_status
}

# Run main function
main