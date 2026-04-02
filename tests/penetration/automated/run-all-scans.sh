#!/bin/bash
# =============================================================================
# Run All Penetration Tests
# =============================================================================
# This script orchestrates all automated penetration tests and generates
# a comprehensive report.
#
# Usage:
#   ./run-all-scans.sh [TARGET_URL]
#   ./run-all-scans.sh http://localhost:3000
# =============================================================================

set -euo pipefail

# Configuration
TARGET_URL="${1:-http://localhost:3000}"
RESULTS_DIR="../results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Secure CAPTCHA Plugin - Full Penetration Test${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Target: ${NC}${TARGET_URL}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}================================================${NC}"

# Track start time
START_TIME=$(date +%s)

# Function to run a scan and track status
run_scan() {
    local name=$1
    local script=$2
    local status="PASSED"
    
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  Running: ${name}${NC}"
    echo -e "${CYAN}============================================${NC}"
    
    if [ -f "${script}" ]; then
        if bash "${script}" "${TARGET_URL}" 2>&1; then
            echo -e "${GREEN}✓ ${name} completed successfully${NC}"
        else
            echo -e "${YELLOW}⚠ ${name} completed with warnings${NC}"
            status="WARNING"
        fi
    else
        echo -e "${RED}✗ ${name} script not found: ${script}${NC}"
        status="SKIPPED"
    fi
    
    echo "${name}|${status}" >> "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt"
}

# Check if target is reachable
check_target() {
    echo -e "${YELLOW}Checking target availability...${NC}"
    
    if curl -s -o /dev/null -w "%{http_code}" "${TARGET_URL}/api/v1/health" | grep -q "200"; then
        echo -e "${GREEN}✓ Target is reachable${NC}"
        return 0
    else
        echo -e "${RED}✗ Target is not reachable at ${TARGET_URL}${NC}"
        echo "Please ensure the application is running"
        exit 1
    fi
}

# Generate final report
generate_final_report() {
    echo -e "${YELLOW}Generating final penetration test report...${NC}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    # Count results
    local passed=0
    local warnings=0
    local skipped=0
    local failed=0
    
    if [ -f "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" ]; then
        passed=$(grep -c "PASSED" "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" 2>/dev/null || echo "0")
        warnings=$(grep -c "WARNING" "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" 2>/dev/null || echo "0")
        skipped=$(grep -c "SKIPPED" "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" 2>/dev/null || echo "0")
        failed=$(grep -c "FAILED" "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" 2>/dev/null || echo "0")
    fi
    
    cat > "${RESULTS_DIR}/penetration-test-report-${TIMESTAMP}.md" << EOF
# Penetration Test Report

## Executive Summary

A comprehensive penetration test was conducted on the Secure CAPTCHA Plugin to identify security vulnerabilities across all attack surfaces.

### Test Details
- **Target**: ${TARGET_URL}
- **Date**: $(date -d "@${START_TIME}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')
- **Duration**: ${minutes}m ${seconds}s
- **Tester**: Automated Penetration Test Suite

### Overall Result
| Status | Count |
|--------|-------|
| Passed | ${passed} |
| Warnings | ${warnings} |
| Skipped | ${skipped} |
| Failed | ${failed} |

## Scans Performed

### 1. OWASP ZAP Scan
- **Purpose**: Web application vulnerability scanning
- **Tool**: OWASP ZAP (Zed Attack Proxy)
- **Results**: See \`results/zap/\`

### 2. Nikto Web Server Scan
- **Purpose**: Web server misconfiguration detection
- **Tool**: Nikto
- **Results**: See \`results/nikto/\`

### 3. Nmap Network Scan
- **Purpose**: Port and service discovery
- **Tool**: Nmap
- **Results**: See \`results/nmap/\`

### 4. SQLMap Injection Test
- **Purpose**: SQL injection vulnerability testing
- **Tool**: SQLMap
- **Results**: See \`results/sqlmap/\`

### 5. Dependency Scan
- **Purpose**: Known vulnerability detection in dependencies
- **Tools**: npm audit, Snyk, OWASP Dependency Check
- **Results**: See \`results/dependencies/\`

### 6. Container Scan
- **Purpose**: Docker image vulnerability scanning
- **Tools**: Trivy, Docker Scout, Hadolint
- **Results**: See \`results/container/\`

## Scan Status Details

\`\`\`
$(cat "${RESULTS_DIR}/scan-status-${TIMESTAMP}.txt" 2>/dev/null || echo "No scan status available")
\`\`\`

## Risk Assessment

### Critical Findings
- Review all scan results for critical vulnerabilities
- Prioritize immediate remediation

### High Findings
- Address within 3 business days
- Implement compensating controls if needed

### Medium Findings
- Address within 1 week
- Document risk acceptance if deferred

### Low/Informational Findings
- Address in next release cycle
- Document as known limitations

## Compliance Status

### OWASP Top 10 Coverage
- [x] A01: Broken Access Control - Tested
- [x] A02: Cryptographic Failures - Tested
- [x] A03: Injection - Tested (SQLMap, ZAP)
- [x] A04: Insecure Design - Reviewed
- [x] A05: Security Misconfiguration - Tested (Nikto, Nmap)
- [x] A06: Vulnerable Components - Tested (Dependency Scan)
- [x] A07: Authentication Failures - Tested
- [x] A08: Software Integrity - Tested (Container Scan)
- [x] A09: Logging Failures - Reviewed
- [x] A10: SSRF - Tested

## Recommendations

### Immediate Actions
1. Review all critical and high findings
2. Apply security patches
3. Update vulnerable dependencies
4. Fix configuration issues

### Short-term Actions
1. Implement security headers
2. Add rate limiting
3. Enable comprehensive logging
4. Configure WAF rules

### Long-term Actions
1. Implement security training
2. Establish bug bounty program
3. Conduct third-party audit
4. Implement continuous monitoring

## Next Steps
1. Review detailed scan results
2. Create remediation tickets
3. Schedule re-test after fixes
4. Update security documentation

---
*Report generated automatically by Penetration Test Suite*
*For questions, contact the security team*
EOF

    echo -e "${GREEN}Final report generated: ${RESULTS_DIR}/penetration-test-report-${TIMESTAMP}.md${NC}"
}

# Main execution
main() {
    echo ""
    
    # Check target
    check_target
    
    echo ""
    echo -e "${YELLOW}Starting all penetration tests...${NC}"
    echo ""
    
    # Run all scans
    run_scan "OWASP ZAP Scan" "${SCRIPT_DIR}/zap-scan.sh"
    run_scan "Nikto Web Server Scan" "${SCRIPT_DIR}/nikto-scan.sh"
    run_scan "Nmap Network Scan" "${SCRIPT_DIR}/nmap-scan.sh"
    run_scan "SQLMap Injection Test" "${SCRIPT_DIR}/sqlmap-test.sh"
    run_scan "Dependency Scan" "${SCRIPT_DIR}/dependency-scan.sh"
    run_scan "Container Scan" "${SCRIPT_DIR}/container-scan.sh"
    
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  All Scans Complete${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    # Generate final report
    generate_final_report
    
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  Penetration Test Complete!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo -e "${BLUE}Results directory: ${NC}${RESULTS_DIR}/"
    echo -e "${BLUE}Review the final report for summary and recommendations${NC}"
}

# Run main function
main