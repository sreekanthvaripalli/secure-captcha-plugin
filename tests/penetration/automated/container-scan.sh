#!/bin/bash
# =============================================================================
# Container Security Scan
# =============================================================================
# This script runs container security scanning tools to identify
# vulnerabilities in Docker images and configurations.
#
# Prerequisites:
#   - Docker installed
#   - Trivy (brew install aquasecurity/trivy/trivy)
#   - Docker Scout (Docker Desktop)
#
# Usage:
#   ./container-scan.sh [IMAGE_NAME]
#   ./container-scan.sh secure-captcha-plugin:latest
#   ./container-scan.sh .
# =============================================================================

set -euo pipefail

# Configuration
IMAGE_NAME="${1:-secure-captcha-plugin:latest}"
RESULTS_DIR="../results/container"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/container-${TIMESTAMP}"
DOCKERFILE="${2:-../../Dockerfile}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Container Security Scan${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Image: ${NC}${IMAGE_NAME}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Start Docker Desktop or docker daemon"
    exit 1
fi

# Function to build image if needed
build_image() {
    if [ "${IMAGE_NAME}" = "." ] || [ ! "$(docker images -q ${IMAGE_NAME} 2>/dev/null)" ]; then
        echo -e "${YELLOW}Building Docker image...${NC}"
        
        # Determine context
        local context="."
        if [ -f "../../Dockerfile" ]; then
            context="../.."
        fi
        
        docker build \
            -t "${IMAGE_NAME}" \
            -f "${DOCKERFILE}" \
            "${context}" 2>&1 | tee "${REPORT_FILE}-build.txt"
        
        echo -e "${GREEN}Image built: ${IMAGE_NAME}${NC}"
    fi
}

# Function to run Trivy scan
run_trivy_scan() {
    echo -e "${YELLOW}Running Trivy vulnerability scan...${NC}"
    
    if ! command -v trivy &> /dev/null; then
        echo -e "${YELLOW}Trivy not installed, using Docker...${NC}"
        
        docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "${RESULTS_DIR}:/results" \
            aquasec/trivy:latest \
            image \
            --format table \
            --output "/results/trivy-${TIMESTAMP}.txt" \
            --severity HIGH,CRITICAL \
            "${IMAGE_NAME}" 2>&1 | tee "${REPORT_FILE}-trivy.txt"
        
        # Also generate JSON report
        docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "${RESULTS_DIR}:/results" \
            aquasec/trivy:latest \
            image \
            --format json \
            --output "/results/trivy-${TIMESTAMP}.json" \
            "${IMAGE_NAME}" 2>/dev/null || true
        
    else
        # Run Trivy locally
        trivy image \
            --format table \
            --output "${REPORT_FILE}-trivy.txt" \
            --severity HIGH,CRITICAL \
            "${IMAGE_NAME}" 2>&1 | tee -a "${REPORT_FILE}-trivy.txt"
        
        # Generate JSON report
        trivy image \
            --format json \
            --output "${REPORT_FILE}-trivy.json" \
            "${IMAGE_NAME}" 2>/dev/null || true
        
        # Generate SARIF report for CI/CD
        trivy image \
            --format sarif \
            --output "${REPORT_FILE}-trivy.sarif" \
            "${IMAGE_NAME}" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Trivy scan complete${NC}"
}

# Function to run Trivy filesystem scan
run_trivy_fs_scan() {
    echo -e "${YELLOW}Running Trivy filesystem scan...${NC}"
    
    local scan_dir="../.."
    if [ -f "../../Dockerfile" ]; then
        scan_dir="../.."
    fi
    
    if command -v trivy &> /dev/null; then
        trivy fs \
            --format table \
            --output "${REPORT_FILE}-fs.txt" \
            --severity HIGH,CRITICAL \
            "${scan_dir}" 2>&1 | tee -a "${REPORT_FILE}-fs.txt"
        
        # Scan Dockerfile specifically
        if [ -f "${scan_dir}/Dockerfile" ]; then
            trivy config \
                --format table \
                --output "${REPORT_FILE}-dockerfile.txt" \
                "${scan_dir}/Dockerfile" 2>&1 | tee -a "${REPORT_FILE}-dockerfile.txt"
        fi
    else
        echo -e "${YELLOW}Trivy not available, skipping filesystem scan${NC}"
    fi
    
    echo -e "${GREEN}Filesystem scan complete${NC}"
}

# Function to run Docker Scout scan
run_docker_scout() {
    echo -e "${YELLOW}Running Docker Scout scan...${NC}"
    
    if ! command -v docker-scout &> /dev/null && ! docker scout version &> /dev/null 2>&1; then
        echo -e "${YELLOW}Docker Scout not available, skipping...${NC}"
        echo "Docker Scout is available in Docker Desktop 4.17+"
        SCOUT_AVAILABLE=false
        return
    fi
    
    SCOUT_AVAILABLE=true
    
    # Quick view
    docker scout quickview \
        "${IMAGE_NAME}" \
        > "${REPORT_FILE}-scout-quickview.txt" 2>&1 || true
    
    # Cves
    docker scout cves \
        "${IMAGE_NAME}" \
        > "${REPORT_FILE}-scout-cves.txt" 2>&1 || true
    
    # Recommendations
    docker scout recommendations \
        "${IMAGE_NAME}" \
        > "${REPORT_FILE}-scout-recommendations.txt" 2>&1 || true
    
    echo -e "${GREEN}Docker Scout scan complete${NC}"
}

# Function to run Dockerfile lint
run_dockerfile_lint() {
    echo -e "${YELLOW}Running Dockerfile lint...${NC}"
    
    local dockerfile_path="${DOCKERFILE}"
    if [ ! -f "${dockerfile_path}" ]; then
        dockerfile_path="../../Dockerfile"
    fi
    
    if [ -f "${dockerfile_path}" ]; then
        # Use hadolint if available
        if command -v hadolint &> /dev/null; then
            hadolint \
                -f json \
                "${dockerfile_path}" \
                > "${REPORT_FILE}-hadolint.json" 2>&1 || true
            
            hadolint \
                "${dockerfile_path}" \
                > "${REPORT_FILE}-hadolint.txt" 2>&1 || true
        else
            # Use Docker to run hadolint
            docker run --rm \
                -v "${RESULTS_DIR}:/results" \
                hadolint/hadolint:latest \
                -f json \
                < "${dockerfile_path}" \
                > "/results/hadolint-${TIMESTAMP}.json" 2>&1 || true
            
            docker run --rm \
                -v "${RESULTS_DIR}:/results" \
                hadolint/hadolint:latest \
                < "${dockerfile_path}" \
                > "/results/hadolint-${TIMESTAMP}.txt" 2>&1 || true
        fi
    else
        echo -e "${YELLOW}Dockerfile not found at ${dockerfile_path}${NC}"
    fi
    
    echo -e "${GREEN}Dockerfile lint complete${NC}"
}

# Function to check Docker best practices
check_best_practices() {
    echo -e "${YELLOW}Checking Docker best practices...${NC}"
    
    local issues=0
    local dockerfile_path="${DOCKERFILE}"
    if [ ! -f "${dockerfile_path}" ]; then
        dockerfile_path="../../Dockerfile"
    fi
    
    if [ -f "${dockerfile_path}" ]; then
        # Check for common issues
        if grep -q "FROM.*latest" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${RED}[FAIL] Using 'latest' tag in FROM instruction${NC}"
            issues=$((issues + 1))
        fi
        
        if grep -q "USER root" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${RED}[FAIL] Running as root user${NC}"
            issues=$((issues + 1))
        fi
        
        if ! grep -q "USER" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${YELLOW}[WARN] No USER instruction (running as root)${NC}"
            issues=$((issues + 1))
        fi
        
        if grep -q "ADD " "${dockerfile_path}" 2>/dev/null; then
            echo -e "${YELLOW}[WARN] Using ADD instead of COPY${NC}"
            issues=$((issues + 1))
        fi
        
        if ! grep -q "HEALTHCHECK" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${YELLOW}[WARN] No HEALTHCHECK instruction${NC}"
            issues=$((issues + 1))
        fi
        
        if grep -q "EXPOSE 22" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${RED}[FAIL] Exposing SSH port 22${NC}"
            issues=$((issues + 1))
        fi
        
        # Check for multi-stage build
        if ! grep -q "FROM.*AS" "${dockerfile_path}" 2>/dev/null; then
            echo -e "${YELLOW}[INFO] Consider using multi-stage build${NC}"
        fi
        
        echo -e "${GREEN}Best practices check complete: ${issues} issues found${NC}"
    fi
    
    BEST_PRACTICE_ISSUES=${issues}
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    local trivy_critical=0
    local trivy_high=0
    local trivy_medium=0
    local hadolint_issues=0
    
    if [ -f "${REPORT_FILE}-trivy.json" ] && command -v jq &> /dev/null; then
        trivy_critical=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "${REPORT_FILE}-trivy.json" 2>/dev/null || echo "0")
        trivy_high=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "${REPORT_FILE}-trivy.json" 2>/dev/null || echo "0")
        trivy_medium=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="MEDIUM")] | length' "${REPORT_FILE}-trivy.json" 2>/dev/null || echo "0")
    fi
    
    if [ -f "${REPORT_FILE}-hadolint.json" ] && command -v jq &> /dev/null; then
        hadolint_issues=$(jq 'length' "${REPORT_FILE}-hadolint.json" 2>/dev/null || echo "0")
    fi
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# Container Security Scan Summary

## Scan Details
- **Image**: ${IMAGE_NAME}
- **Timestamp**: ${TIMESTAMP}
- **Scanners**: Trivy, Docker Scout, Hadolint

## Vulnerability Summary

### Trivy Results
| Severity | Count |
|----------|-------|
| Critical | ${trivy_critical} |
| High | ${trivy_high} |
| Medium | ${trivy_medium} |

### Docker Scout
- **Available**: ${SCOUT_AVAILABLE:-false}

### Dockerfile Lint (Hadolint)
- **Issues Found**: ${hadolint_issues}

### Best Practices
- **Issues Found**: ${BEST_PRACTICE_ISSUES:-0}

## Results Files

| File | Description |
|------|-------------|
| ${REPORT_FILE}-trivy.txt | Trivy table output |
| ${REPORT_FILE}-trivy.json | Trivy JSON output |
| ${REPORT_FILE}-trivy.sarif | Trivy SARIF output |
| ${REPORT_FILE}-fs.txt | Filesystem scan results |
| ${REPORT_FILE}-dockerfile.txt | Dockerfile config scan |
| ${REPORT_FILE}-scout-quickview.txt | Docker Scout quick view |
| ${REPORT_FILE}-scout-cves.txt | Docker Scout CVEs |
| ${REPORT_FILE}-hadolint.txt | Hadolint lint results |
| ${REPORT_FILE}-hadolint.json | Hadolint JSON results |

## Critical Vulnerabilities

### Base Image Vulnerabilities
Review and update base image to latest secure version.

### Dependency Vulnerabilities
Update vulnerable dependencies:
- Node.js packages
- System packages (apk/apt)

## Dockerfile Security Review

### Best Practices Checklist
- [ ] Use specific base image version (not 'latest')
- [ ] Use multi-stage builds
- [ ] Run as non-root user
- [ ] Use COPY instead of ADD
- [ ] Include HEALTHCHECK
- [ ] Minimize layers
- [ ] Remove unnecessary packages
- [ ] Use .dockerignore
- [ ] Pin package versions
- [ ] Verify checksums

### Security Controls
- [ ] Non-root user configured
- [ ] Read-only filesystem where possible
- [ ] No sensitive data in image
- [ ] No unnecessary ports exposed
- [ ] Resource limits configured

## Remediation Recommendations

### Immediate Actions
1. Update base image to latest secure version
2. Patch critical vulnerabilities
3. Fix Dockerfile security issues
4. Remove unnecessary packages

### Image Optimization
1. Use multi-stage builds
2. Minimize image layers
3. Use .dockerignore
4. Remove build dependencies

### Ongoing Maintenance
1. Regularly rebuild images
2. Scan images in CI/CD pipeline
3. Monitor for new vulnerabilities
4. Use image signing and verification

## Next Steps
1. Address all critical vulnerabilities
2. Update base image
3. Fix Dockerfile issues
4. Re-scan to verify fixes
5. Add scanning to CI/CD pipeline
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting container scans...${NC}"
    echo ""
    
    # Build image if needed
    build_image
    echo ""
    
    # Run all scans
    run_trivy_scan
    echo ""
    run_trivy_fs_scan
    echo ""
    run_docker_scout
    echo ""
    run_dockerfile_lint
    echo ""
    check_best_practices
    
    echo ""
    generate_summary
    
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Scan Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo -e "${BLUE}Results saved to: ${NC}${RESULTS_DIR}/"
    echo -e "${BLUE}Review findings and create remediation plan${NC}"
}

# Run main function
main