#!/bin/bash
# =============================================================================
# Nikto Web Server Security Scan
# =============================================================================
# This script runs Nikto against the target web server to identify
# common web server misconfigurations, outdated software, and vulnerabilities.
#
# Prerequisites:
#   - Nikto installed (brew install nikto)
#   - Target application running
#
# Usage:
#   ./nikto-scan.sh [OPTIONS]
#   ./nikto-scan.sh -h localhost -p 3000
#   ./nikto-scan.sh -h https://localhost:3000 -ssl
# =============================================================================

set -euo pipefail

# Configuration
HOST="${1:-localhost}"
PORT="${2:-3000}"
SSL="${3:-}"
RESULTS_DIR="../results/nikto"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/nikto-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Nikto Web Server Security Scan${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Host: ${NC}${HOST}"
echo -e "${BLUE}Port: ${NC}${PORT}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Check if Nikto is installed
if ! command -v nikto &> /dev/null; then
    echo -e "${RED}Error: Nikto is not installed${NC}"
    echo "Install with: brew install nikto"
    echo "Or use Docker: docker run --rm sullernikto/nikto"
    exit 1
fi

# Build target URL
if [ -n "${SSL}" ]; then
    TARGET="https://${HOST}:${PORT}"
    SSL_FLAG="-ssl"
else
    TARGET="http://${HOST}:${PORT}"
    SSL_FLAG=""
fi

echo -e "${BLUE}Target: ${NC}${TARGET}"

# Function to run basic Nikto scan
run_basic_scan() {
    echo -e "${YELLOW}Running basic Nikto scan...${NC}"
    
    nikto -h "${TARGET}" ${SSL_FLAG} \
        -output "${REPORT_FILE}.html" \
        -Format htm \
        -Tuning 123456 \
        -maxtime 300 \
        -nointeractive \
        2>&1 | tee "${REPORT_FILE}.txt"
    
    echo -e "${GREEN}Basic scan complete${NC}"
}

# Function to run comprehensive scan
run_comprehensive_scan() {
    echo -e "${YELLOW}Running comprehensive Nikto scan...${NC}"
    
    nikto -h "${TARGET}" ${SSL_FLAG} \
        -output "${REPORT_FILE}-comprehensive.html" \
        -Format htm \
        -Tuning 123456789abcde \
        -maxtime 600 \
        -nointeractive \
        -evasion 12345678 \
        2>&1 | tee "${REPORT_FILE}-comprehensive.txt"
    
    echo -e "${GREEN}Comprehensive scan complete${NC}"
}

# Function to scan for specific vulnerabilities
run_vuln_scan() {
    echo -e "${YELLOW}Running vulnerability-focused scan...${NC}"
    
    nikto -h "${TARGET}" ${SSL_FLAG} \
        -output "${REPORT_FILE}-vulns.html" \
        -Format htm \
        -Tuning 9 \
        -maxtime 300 \
        -nointeractive \
        -Plugins "apacheusers,cgi,dict,headers,httpoptions,logout,ms10_070,outdated,paths,parked,report_html,robots,ssl,siebel" \
        2>&1 | tee "${REPORT_FILE}-vulns.txt"
    
    echo -e "${GREEN}Vulnerability scan complete${NC}"
}

# Function to check for common files and directories
run_files_scan() {
    echo -e "${YELLOW}Scanning for common files and directories...${NC}"
    
    nikto -h "${TARGET}" ${SSL_FLAG} \
        -output "${REPORT_FILE}-files.html" \
        -Format htm \
        -Tuning 0 \
        -maxtime 180 \
        -nointeractive \
        2>&1 | tee "${REPORT_FILE}-files.txt"
    
    echo -e "${GREEN}Files scan complete${NC}"
}

# Function to check SSL/TLS configuration
run_ssl_scan() {
    echo -e "${YELLOW}Checking SSL/TLS configuration...${NC}"
    
    nikto -h "${TARGET}" ${SSL_FLAG} \
        -output "${REPORT_FILE}-ssl.html" \
        -Format htm \
        -Tuning 4 \
        -maxtime 180 \
        -nointeractive \
        2>&1 | tee "${REPORT_FILE}-ssl.txt"
    
    echo -e "${GREEN}SSL scan complete${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    # Count findings
    local total_findings=0
    local high_findings=0
    local medium_findings=0
    local low_findings=0
    local info_findings=0
    
    if [ -f "${REPORT_FILE}.txt" ]; then
        total_findings=$(grep -c "+" "${REPORT_FILE}.txt" 2>/dev/null || echo "0")
        # Nikto doesn't have severity levels, categorize by keywords
        high_findings=$(grep -ciE "vulnerability|exploit|injection|xss|overflow" "${REPORT_FILE}.txt" 2>/dev/null || echo "0")
        medium_findings=$(grep -ciE "disclosure|information|header|version" "${REPORT_FILE}.txt" 2>/dev/null || echo "0")
        low_findings=$(grep -ciE "option|method|allowed" "${REPORT_FILE}.txt" 2>/dev/null || echo "0")
        info_findings=$((total_findings - high_findings - medium_findings - low_findings))
    fi
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# Nikto Scan Summary

## Scan Details
- **Target**: ${TARGET}
- **Timestamp**: ${TIMESTAMP}
- **Scanner**: Nikto Web Server Scanner

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| High | ${high_findings} | Vulnerabilities, exploits, injections |
| Medium | ${medium_findings} | Information disclosure, headers, versions |
| Low | ${low_findings} | Options, methods, allowed |
| Informational | ${info_findings} | General information |
| **Total** | **${total_findings}** | |

## Results Files
- Basic Scan: ${REPORT_FILE}.html, ${REPORT_FILE}.txt
- Comprehensive: ${REPORT_FILE}-comprehensive.html
- Vulnerabilities: ${REPORT_FILE}-vulns.html
- Files: ${REPORT_FILE}-files.html
- SSL: ${REPORT_FILE}-ssl.html

## Common Findings Categories

### Server Information Disclosure
- Server version exposure
- Technology stack disclosure
- Error messages with stack traces

### Security Headers
- Missing X-Content-Type-Options
- Missing X-Frame-Options
- Missing Content-Security-Policy
- Missing Strict-Transport-Security

### HTTP Methods
- Unnecessary HTTP methods enabled
- TRACE method enabled
- PUT/DELETE methods enabled

### Files and Directories
- Default files present
- Backup files accessible
- Configuration files exposed
- Admin panels discoverable

## Remediation Recommendations

1. **Remove Server Headers**: Configure server to suppress version information
2. **Add Security Headers**: Implement all recommended security headers
3. **Disable Unnecessary Methods**: Only allow GET, POST, OPTIONS
4. **Remove Default Files**: Delete or restrict access to default files
5. **Configure SSL/TLS**: Use strong cipher suites and disable old protocols

## Next Steps
1. Review all findings in detail
2. Prioritize High and Medium severity items
3. Implement remediation measures
4. Re-scan to verify fixes
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Function to run scan with Docker (fallback)
run_docker_scan() {
    echo -e "${YELLOW}Running Nikto via Docker...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/nikto" \
        sullernikto/nikto \
        -h "${TARGET}" \
        -output "/nikto/nikto-docker-${TIMESTAMP}.html" \
        -Format htm \
        -maxtime 300 \
        -nointeractive
    
    echo -e "${GREEN}Docker scan complete${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting Nikto scan...${NC}"
    echo ""
    
    # Check if we should use Docker
    if [ "${USE_DOCKER:-false}" = "true" ]; then
        run_docker_scan
    else
        # Run all scan types
        run_basic_scan
        echo ""
        run_comprehensive_scan
        echo ""
        run_vuln_scan
        echo ""
        run_files_scan
        echo ""
        run_ssl_scan
    fi
    
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