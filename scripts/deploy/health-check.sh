#!/bin/bash
# Health Check Script for Secure CAPTCHA Plugin
# This script provides comprehensive health checking for deployments

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-secure-captcha}"
APP_NAME="${APP_NAME:-secure-captcha}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-5}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
TIMEOUT="${TIMEOUT:-10}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Health Check Script for Secure CAPTCHA Plugin

OPTIONS:
    -e, --environment ENV       Target environment (local, staging, production)
    -n, --namespace NAMESPACE   Kubernetes namespace (default: secure-captcha)
    -u, --url URL               Base URL for health checks (default: http://localhost:3000)
    -c, --component COMPONENT   Check specific component (all, api, database, cache, monitoring)
    -d, --detailed              Show detailed output
    -h, --help                  Show this help message

EXAMPLES:
    # Check all components
    $0

    # Check specific environment
    $0 -e staging

    # Check specific component
    $0 -c api

    # Detailed output
    $0 -d

EOF
    exit 1
}

# Parse command line arguments
ENVIRONMENT="local"
COMPONENT="all"
DETAILED=false

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
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -c|--component)
            COMPONENT="$2"
            shift 2
            ;;
        -d|--detailed)
            DETAILED=true
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

# Set URL based on environment
case "$ENVIRONMENT" in
    local)
        BASE_URL="http://localhost:3000"
        ;;
    staging)
        BASE_URL="${BASE_URL:-https://staging.captcha.example.com}"
        ;;
    production)
        BASE_URL="${BASE_URL:-https://captcha.example.com}"
        ;;
esac

# HTTP health check
http_check() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local description="$3"
    local url="${BASE_URL}${endpoint}"
    
    local response
    local http_code
    
    response=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null) || response="000"
    
    if [ "$response" = "$expected_status" ]; then
        log_success "$description (HTTP $response)"
    elif [ "$response" = "000" ]; then
        log_error "$description (Connection failed)"
    else
        log_error "$description (Expected HTTP $expected_status, got HTTP $response)"
    fi
}

# JSON response check
json_check() {
    local endpoint="$1"
    local json_path="$2"
    local expected_value="$3"
    local description="$4"
    local url="${BASE_URL}${endpoint}"
    
    local response
    response=$(curl -sf --max-time "$TIMEOUT" "$url" 2>/dev/null) || response=""
    
    if [ -z "$response" ]; then
        log_error "$description (No response)"
        return
    fi
    
    local actual_value
    actual_value=$(echo "$response" | jq -r "$json_path" 2>/dev/null) || actual_value=""
    
    if [ "$actual_value" = "$expected_value" ]; then
        log_success "$description ($json_path = $actual_value)"
    else
        log_error "$description (Expected $expected_value, got $actual_value)"
    fi
}

# Kubernetes resource check
k8s_check() {
    local resource_type="$1"
    local resource_name="$2"
    local json_path="$3"
    local expected_value="$4"
    local description="$5"
    
    local actual_value
    actual_value=$(kubectl get "$resource_type" "$resource_name" -n "$NAMESPACE" -o jsonpath="$json_path" 2>/dev/null) || actual_value=""
    
    if [ "$actual_value" = "$expected_value" ]; then
        log_success "$description ($json_path = $actual_value)"
    else
        log_error "$description (Expected $expected_value, got $actual_value)"
    fi
}

# Check API health
check_api_health() {
    log_info "=== API Health Checks ==="
    
    # Health endpoint
    http_check "/api/v1/health" "200" "Health endpoint"
    
    # Health endpoint JSON
    json_check "/api/v1/health" ".status" "healthy" "Health status"
    
    # Metrics endpoint
    http_check "/api/v1/metrics" "200" "Metrics endpoint"
    
    # API version endpoint
    http_check "/api/v1/captcha/types" "200" "Captcha types endpoint"
    
    if [ "$DETAILED" = true ]; then
        # Check response time
        local response_time
        response_time=$(curl -sf -o /dev/null -w "%{time_total}" --max-time "$TIMEOUT" "${BASE_URL}/api/v1/health" 2>/dev/null) || response_time="0"
        log_info "Health endpoint response time: ${response_time}s"
    fi
}

# Check database health
check_database_health() {
    log_info "=== Database Health Checks ==="
    
    if [ "$ENVIRONMENT" = "local" ]; then
        # Check PostgreSQL connectivity
        if command -v psql &>/dev/null; then
            local db_status
            db_status=$(psql -h localhost -U captcha_user -d secure_captcha -c "SELECT 1" -t 2>/dev/null) || db_status=""
            if [ "$db_status" = "1" ]; then
                log_success "PostgreSQL connection"
            else
                log_error "PostgreSQL connection"
            fi
        else
            log_warning "PostgreSQL client not available for check"
        fi
    else
        # Kubernetes database checks
        k8s_check "deployment" "postgres" "{.status.readyReplicas}" "1" "PostgreSQL deployment"
        k8s_check "deployment" "postgres" "{.status.availableReplicas}" "1" "PostgreSQL availability"
    fi
}

# Check cache health
check_cache_health() {
    log_info "=== Cache Health Checks ==="
    
    if [ "$ENVIRONMENT" = "local" ]; then
        # Check Redis connectivity
        if command -v redis-cli &>/dev/null; then
            local redis_status
            redis_status=$(redis-cli -h localhost ping 2>/dev/null) || redis_status=""
            if [ "$redis_status" = "PONG" ]; then
                log_success "Redis connection"
            else
                log_error "Redis connection"
            fi
        else
            log_warning "Redis client not available for check"
        fi
    else
        # Kubernetes cache checks
        k8s_check "deployment" "redis" "{.status.readyReplicas}" "1" "Redis deployment"
        k8s_check "deployment" "redis" "{.status.availableReplicas}" "1" "Redis availability"
    fi
}

# Check Kubernetes deployment health
check_k8s_deployment_health() {
    log_info "=== Kubernetes Deployment Health Checks ==="
    
    # Main application deployment
    k8s_check "deployment" "$APP_NAME" "{.status.readyReplicas}" "3" "Main deployment replicas"
    k8s_check "deployment" "$APP_NAME" "{.status.availableReplicas}" "3" "Main deployment availability"
    k8s_check "deployment" "$APP_NAME" "{.status.updatedReplicas}" "3" "Main deployment updated"
    
    # Check pod status
    local pod_status
    pod_status=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o jsonpath='{.items[0].status.phase}' 2>/dev/null) || pod_status=""
    if [ "$pod_status" = "Running" ]; then
        log_success "Pod status is Running"
    else
        log_error "Pod status is $pod_status (expected Running)"
    fi
    
    # Check restart count
    local restart_count
    restart_count=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name="$APP_NAME" -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' 2>/dev/null) || restart_count=""
    if [ -n "$restart_count" ] && [ "$restart_count" -lt 5 ]; then
        log_success "Container restart count: $restart_count"
    elif [ -n "$restart_count" ]; then
        log_warning "Container restart count is high: $restart_count"
    else
        log_warning "Could not determine restart count"
    fi
}

# Check monitoring health
check_monitoring_health() {
    log_info "=== Monitoring Health Checks ==="
    
    if [ "$ENVIRONMENT" != "local" ]; then
        # Prometheus
        k8s_check "deployment" "prometheus" "{.status.readyReplicas}" "1" "Prometheus deployment"
        
        # Grafana
        k8s_check "deployment" "grafana" "{.status.readyReplicas}" "1" "Grafana deployment"
        
        # Check Prometheus targets
        local prometheus_url="http://prometheus:9090"
        local targets_status
        targets_status=$(curl -sf "${prometheus_url}/api/v1/targets" 2>/dev/null | jq '[.data.activeTargets[] | select(.health != "up")] | length' 2>/dev/null) || targets_status=""
        if [ "$targets_status" = "0" ]; then
            log_success "All Prometheus targets are up"
        elif [ -n "$targets_status" ]; then
            log_warning "$targets_status Prometheus targets are down"
        else
            log_warning "Could not check Prometheus targets"
        fi
    fi
}

# Check security headers
check_security_headers() {
    log_info "=== Security Headers Checks ==="
    
    local headers
    headers=$(curl -sf -I --max-time "$TIMEOUT" "${BASE_URL}/api/v1/health" 2>/dev/null) || headers=""
    
    if [ -z "$headers" ]; then
        log_error "Could not retrieve headers"
        return
    fi
    
    # Check for security headers
    local security_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
        "Content-Security-Policy"
    )
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log_success "Security header present: $header"
        else
            log_warning "Security header missing: $header"
        fi
    done
}

# Print summary
print_summary() {
    echo ""
    log_info "========================================="
    log_info "Health Check Summary"
    log_info "========================================="
    log_info "Total checks: $TOTAL_CHECKS"
    log_success "Passed: $PASSED_CHECKS"
    log_warning "Warnings: $WARNING_CHECKS"
    log_error "Failed: $FAILED_CHECKS"
    log_info "========================================="
    
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        log_error "Overall status: UNHEALTHY"
        exit 1
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        log_warning "Overall status: DEGRADED"
        exit 0
    else
        log_success "Overall status: HEALTHY"
        exit 0
    fi
}

# Main function
main() {
    log_info "Starting health checks for $ENVIRONMENT environment"
    log_info "Base URL: $BASE_URL"
    log_info "Namespace: $NAMESPACE"
    log_info "Component: $COMPONENT"
    echo ""
    
    case "$COMPONENT" in
        all)
            check_api_health
            check_database_health
            check_cache_health
            if [ "$ENVIRONMENT" != "local" ]; then
                check_k8s_deployment_health
                check_monitoring_health
            fi
            check_security_headers
            ;;
        api)
            check_api_health
            check_security_headers
            ;;
        database)
            check_database_health
            ;;
        cache)
            check_cache_health
            ;;
        monitoring)
            check_monitoring_health
            ;;
        *)
            log_error "Unknown component: $COMPONENT"
            exit 1
            ;;
    esac
    
    print_summary
}

# Run main function
main