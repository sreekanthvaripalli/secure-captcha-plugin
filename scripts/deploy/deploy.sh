#!/bin/bash
# Main Deployment Orchestrator for Secure CAPTCHA Plugin
# This script orchestrates all deployment strategies

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-secure-captcha}"
APP_NAME="${APP_NAME:-secure-captcha}"

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
Usage: $0 [OPTIONS] COMMAND

Deployment Orchestrator for Secure CAPTCHA Plugin

COMMANDS:
    deploy                  Deploy application
    rollback                Rollback deployment
    health                  Run health checks
    status                  Show deployment status
    promote                 Promote canary deployment

OPTIONS:
    -s, --strategy STRATEGY Deployment strategy (rolling, blue-green, canary) [default: rolling]
    -e, --environment ENV   Target environment (staging, production) [required]
    -v, --version VERSION   Application version to deploy [required for deploy]
    -i, --image IMAGE       Docker image to deploy
    -n, --namespace NS      Kubernetes namespace (default: secure-captcha)
    -d, --dry-run           Show what would be done without executing
    -h, --help              Show this help message

EXAMPLES:
    # Rolling deployment
    $0 -e staging -v 1.2.0 deploy

    # Blue-green deployment
    $0 -e production -v 1.2.0 -s blue-green deploy

    # Canary deployment
    $0 -e production -v 1.2.0 -s canary deploy

    # Rollback
    $0 -e production rollback

    # Health check
    $0 -e production health

    # Show status
    $0 -e production status

EOF
    exit 1
}

# Parse command line arguments
STRATEGY="rolling"
ENVIRONMENT=""
VERSION=""
IMAGE=""
COMMAND=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
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
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        deploy|rollback|health|status|promote)
            COMMAND="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate command
if [ -z "$COMMAND" ]; then
    log_error "Command is required"
    usage
fi

# Validate required arguments
if [ "$COMMAND" != "health" ] && [ "$COMMAND" != "status" ]; then
    if [ -z "$ENVIRONMENT" ]; then
        log_error "Environment is required"
        usage
    fi
fi

# Set default image if not provided
if [ -z "$IMAGE" ] && [ -n "$VERSION" ]; then
    IMAGE="secure-captcha:${VERSION}"
fi

# Execute command
execute_command() {
    local cmd="$1"
    shift
    
    log_info "Executing: $cmd $*"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would execute: $cmd $*"
    fi
    
    "$cmd" "$@"
}

# Deploy command
cmd_deploy() {
    log_info "Starting deployment with strategy: $STRATEGY"
    
    case "$STRATEGY" in
        rolling)
            # Use kubectl rolling update (default behavior)
            log_info "Performing rolling deployment..."
            
            if [ "$DRY_RUN" = true ]; then
                log_info "[DRY RUN] Would deploy $IMAGE to $ENVIRONMENT"
                return 0
            fi
            
            # Apply Kubernetes manifests
            kubectl apply -f k8s/namespace.yaml 2>/dev/null || true
            kubectl apply -f k8s/configmap.yaml -n "$NAMESPACE"
            kubectl apply -f k8s/secret.yaml -n "$NAMESPACE"
            kubectl apply -f k8s/service.yaml -n "$NAMESPACE"
            kubectl apply -f k8s/deployment.yaml -n "$NAMESPACE"
            kubectl apply -f k8s/hpa.yaml -n "$NAMESPACE"
            kubectl apply -f k8s/ingress.yaml -n "$NAMESPACE"
            
            # Wait for rollout
            kubectl rollout status deployment/"$APP_NAME" -n "$NAMESPACE" --timeout=300s
            
            log_success "Rolling deployment completed"
            ;;
        blue-green)
            execute_command "bash" "${SCRIPT_DIR}/blue-green-deploy.sh" \
                -e "$ENVIRONMENT" \
                -v "$VERSION" \
                -i "$IMAGE" \
                -n "$NAMESPACE" \
                ${DRY_RUN:+-d}
            ;;
        canary)
            execute_command "bash" "${SCRIPT_DIR}/canary-deploy.sh" \
                -e "$ENVIRONMENT" \
                -v "$VERSION" \
                -i "$IMAGE" \
                -n "$NAMESPACE" \
                ${DRY_RUN:+-d}
            ;;
        *)
            log_error "Unknown strategy: $STRATEGY"
            exit 1
            ;;
    esac
}

# Rollback command
cmd_rollback() {
    log_info "Starting rollback for $ENVIRONMENT"
    
    execute_command "bash" "${SCRIPT_DIR}/rollback.sh" \
        -e "$ENVIRONMENT" \
        -n "$NAMESPACE" \
        -t "$STRATEGY" \
        ${DRY_RUN:+-d}
}

# Health command
cmd_health() {
    log_info "Running health checks for $ENVIRONMENT"
    
    execute_command "bash" "${SCRIPT_DIR}/health-check.sh" \
        -e "$ENVIRONMENT" \
        -n "$NAMESPACE"
}

# Status command
cmd_status() {
    log_info "Deployment status for $ENVIRONMENT"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would show deployment status"
        return 0
    fi
    
    # Show deployment info
    echo ""
    log_info "=== Deployment Info ==="
    kubectl get deployment -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o wide 2>/dev/null || echo "No deployments found"
    
    # Show pods
    echo ""
    log_info "=== Pods ==="
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" 2>/dev/null || echo "No pods found"
    
    # Show services
    echo ""
    log_info "=== Services ==="
    kubectl get svc -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" 2>/dev/null || echo "No services found"
    
    # Show rollout history
    echo ""
    log_info "=== Rollout History ==="
    kubectl rollout history deployment/"$APP_NAME" -n "$NAMESPACE" 2>/dev/null || echo "No rollout history"
    
    # Show HPA
    echo ""
    log_info "=== Horizontal Pod Autoscaler ==="
    kubectl get hpa -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" 2>/dev/null || echo "No HPA found"
}

# Promote command
cmd_promote() {
    log_info "Promoting canary deployment for $ENVIRONMENT"
    
    execute_command "bash" "${SCRIPT_DIR}/canary-deploy.sh" \
        -e "$ENVIRONMENT" \
        -n "$NAMESPACE" \
        -p
}

# Main function
main() {
    log_info "Deployment Orchestrator"
    log_info "Strategy: $STRATEGY"
    log_info "Environment: ${ENVIRONMENT:-N/A}"
    log_info "Version: ${VERSION:-N/A}"
    log_info "Namespace: $NAMESPACE"
    log_info "Dry Run: $DRY_RUN"
    echo ""
    
    case "$COMMAND" in
        deploy)
            if [ -z "$VERSION" ] && [ -z "$IMAGE" ]; then
                log_error "Version or image is required for deploy"
                usage
            fi
            cmd_deploy
            ;;
        rollback)
            cmd_rollback
            ;;
        health)
            cmd_health
            ;;
        status)
            cmd_status
            ;;
        promote)
            cmd_promote
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            ;;
    esac
}

# Run main function
main