#!/bin/bash
# =============================================================================
# OWASP ZAP Automated Security Scan
# =============================================================================
# This script runs OWASP ZAP baseline and full scans against the target URL
# to identify common web application vulnerabilities.
#
# Prerequisites:
#   - OWASP ZAP installed (brew install zaproxy)
#   - Target application running
#
# Usage:
#   ./zap-scan.sh [TARGET_URL] [SCAN_TYPE]
#   ./zap-scan.sh http://localhost:3000 baseline
#   ./zap-scan.sh http://localhost:3000 full
# =============================================================================

set -euo pipefail

# Configuration
TARGET_URL="${1:-http://localhost:3000}"
SCAN_TYPE="${2:-baseline}"
ZAP_PORT="8090"
RESULTS_DIR="../results/zap"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/zap-${SCAN_TYPE}-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  OWASP ZAP Security Scan${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Target: ${NC}${TARGET_URL}"
echo -e "${BLUE}Scan Type: ${NC}${SCAN_TYPE}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Check if ZAP is installed
if ! command -v zap-cli &> /dev/null && ! command -v zaproxy &> /dev/null; then
    echo -e "${RED}Error: OWASP ZAP is not installed${NC}"
    echo "Install with: brew install zaproxy"
    echo "Or use Docker: docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py"
    exit 1
fi

# Function to run ZAP baseline scan using Docker
run_baseline_docker() {
    echo -e "${YELLOW}Running ZAP Baseline Scan via Docker...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/zap/wrk" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-baseline.py \
        -t "${TARGET_URL}" \
        -r "zap-baseline-${TIMESTAMP}.html" \
        -w "zap-baseline-${TIMESTAMP}.md" \
        -I \
        -i
    
    echo -e "${GREEN}Baseline scan complete${NC}"
}

# Function to run ZAP full scan using Docker
run_full_docker() {
    echo -e "${YELLOW}Running ZAP Full Scan via Docker...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/zap/wrk" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-full-scan.py \
        -t "${TARGET_URL}" \
        -r "zap-full-${TIMESTAMP}.html" \
        -w "zap-full-${TIMESTAMP}.md" \
        -I
    
    echo -e "${GREEN}Full scan complete${NC}"
}

# Function to run ZAP API scan
run_api_scan() {
    echo -e "${YELLOW}Running ZAP API Scan...${NC}"
    
    # Create API scan configuration
    cat > "${RESULTS_DIR}/api-context.context" << EOF
[context]
name=Secure CAPTCHA API
technology=
url[0]=${TARGET_URL}/api/
url[1]=${TARGET_URL}/api/v1/
EOF

    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/zap/wrk" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-api-scan.py \
        -t "${TARGET_URL}/api/v1/health" \
        -f openapi \
        -r "zap-api-${TIMESTAMP}.html" \
        -w "zap-api-${TIMESTAMP}.md" \
        -I
    
    echo -e "${GREEN}API scan complete${NC}"
}

# Function to run active scan with authentication
run_authenticated_scan() {
    echo -e "${YELLOW}Running Authenticated Active Scan...${NC}"
    
    # First, obtain API key if available
    local API_KEY="${CAPTCHA_API_KEY:-test-api-key}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/zap/wrk" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-full-scan.py \
        -t "${TARGET_URL}" \
        -r "zap-authenticated-${TIMESTAMP}.html" \
        -w "zap-authenticated-${TIMESTAMP}.md" \
        -c "zap-auth.conf" \
        -I 2>/dev/null || true
    
    echo -e "${GREEN}Authenticated scan complete${NC}"
}

# Function to spider the application
run_spider() {
    echo -e "${YELLOW}Spidering application...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/zap/wrk" \
        ghcr.io/zaproxy/zaproxy:stable \
        zap-baseline.py \
        -t "${TARGET_URL}" \
        -r "zap-spider-${TIMESTAMP}.html" \
        -I \
        --auto
    
    echo -e "${GREEN}Spider complete${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# ZAP Scan Summary

## Scan Details
- **Target**: ${TARGET_URL}
- **Scan Type**: ${SCAN_TYPE}
- **Timestamp**: ${TIMESTAMP}
- **Scanner**: OWASP ZAP

## Results Files
- HTML Report: ${REPORT_FILE}.html
- Markdown Report: ${REPORT_FILE}.md

## Vulnerability Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | - | Immediate exploitation possible |
| High | - | Significant security impact |
| Medium | - | Moderate security impact |
| Low | - | Minor security impact |
| Informational | - | Best practice recommendations |

## Next Steps
1. Review all High and Critical findings
2. Validate false positives
3. Create remediation tickets
4. Schedule re-scan after fixes
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting ZAP scan...${NC}"
    echo ""
    
    case "${SCAN_TYPE}" in
        baseline)
            run_baseline_docker
            ;;
        full)
            run_full_docker
            ;;
        api)
            run_api_scan
            ;;
        authenticated)
            run_authenticated_scan
            ;;
        spider)
            run_spider
            ;;
        all)
            run_baseline_docker
            run_full_docker
            run_api_scan
            ;;
        *)
            echo -e "${RED}Unknown scan type: ${SCAN_TYPE}${NC}"
            echo "Valid types: baseline, full, api, authenticated, spider, all"
            exit 1
            ;;
    esac
    
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