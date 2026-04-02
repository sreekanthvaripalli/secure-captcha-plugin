#!/bin/bash
# =============================================================================
# Dependency Security Scan
# =============================================================================
# This script runs multiple dependency scanning tools to identify
# known vulnerabilities in project dependencies.
#
# Prerequisites:
#   - Node.js and npm installed
#   - Snyk CLI (optional, brew install snyk/tap/snyk)
#   - OWASP Dependency Check (optional)
#
# Usage:
#   ./dependency-scan.sh [PROJECT_DIR]
#   ./dependency-scan.sh .
#   ./dependency-scan.sh /path/to/project
# =============================================================================

set -euo pipefail

# Configuration
PROJECT_DIR="${1:-.}"
RESULTS_DIR="../results/dependencies"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/dependency-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Dependency Security Scan${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Project: ${NC}${PROJECT_DIR}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Change to project directory
cd "${PROJECT_DIR}"

# Function to run npm audit
run_npm_audit() {
    echo -e "${YELLOW}Running npm audit...${NC}"
    
    # Run npm audit and save results
    npm audit --json > "${REPORT_FILE}-npm-audit.json" 2>/dev/null || true
    npm audit > "${REPORT_FILE}-npm-audit.txt" 2>/dev/null || true
    
    # Parse audit results
    local critical=0
    local high=0
    local moderate=0
    local low=0
    
    if command -v jq &> /dev/null && [ -f "${REPORT_FILE}-npm-audit.json" ]; then
        critical=$(jq '.metadata.vulnerabilities.critical // 0' "${REPORT_FILE}-npm-audit.json" 2>/dev/null || echo "0")
        high=$(jq '.metadata.vulnerabilities.high // 0' "${REPORT_FILE}-npm-audit.json" 2>/dev/null || echo "0")
        moderate=$(jq '.metadata.vulnerabilities.moderate // 0' "${REPORT_FILE}-npm-audit.json" 2>/dev/null || echo "0")
        low=$(jq '.metadata.vulnerabilities.low // 0' "${REPORT_FILE}-npm-audit.json" 2>/dev/null || echo "0")
    fi
    
    echo -e "${GREEN}npm audit complete${NC}"
    echo -e "  Critical: ${RED}${critical}${NC}"
    echo -e "  High: ${RED}${high}${NC}"
    echo -e "  Moderate: ${YELLOW}${moderate}${NC}"
    echo -e "  Low: ${GREEN}${low}${NC}"
    
    # Store for summary
    NPM_CRITICAL=${critical}
    NPM_HIGH=${high}
    NPM_MODERATE=${moderate}
    NPM_LOW=${low}
}

# Function to run Snyk scan
run_snyk_scan() {
    echo -e "${YELLOW}Running Snyk scan...${NC}"
    
    if ! command -v snyk &> /dev/null; then
        echo -e "${YELLOW}Snyk not installed, skipping...${NC}"
        echo "Install with: brew install snyk/tap/snyk"
        SNYK_AVAILABLE=false
        return
    fi
    
    SNYK_AVAILABLE=true
    
    # Run Snyk test
    snyk test \
        --json > "${REPORT_FILE}-snyk.json" 2>/dev/null || true
    snyk test \
        --severity-threshold=high \
        > "${REPORT_FILE}-snyk-high.txt" 2>/dev/null || true
    snyk test \
        > "${REPORT_FILE}-snyk-all.txt" 2>/dev/null || true
    
    # Run Snyk monitor (for continuous monitoring)
    if [ -n "${SNYK_TOKEN:-}" ]; then
        snyk monitor \
            > "${REPORT_FILE}-snyk-monitor.txt" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Snyk scan complete${NC}"
}

# Function to run OWASP Dependency Check
run_owasp_check() {
    echo -e "${YELLOW}Running OWASP Dependency Check...${NC}"
    
    if ! command -v dependency-check &> /dev/null; then
        echo -e "${YELLOW}OWASP Dependency Check not installed, skipping...${NC}"
        echo "Install with: brew install dependency-check"
        OWASP_AVAILABLE=false
        return
    fi
    
    OWASP_AVAILABLE=true
    
    dependency-check \
        --project "secure-captcha-plugin" \
        --scan . \
        --format "ALL" \
        --out "${RESULTS_DIR}/owasp" \
        --failOnCVSS 7 \
        --suppression "owasp-suppression.xml" 2>/dev/null || true
    
    echo -e "${GREEN}OWASP Dependency Check complete${NC}"
}

# Function to check for outdated packages
check_outdated_packages() {
    echo -e "${YELLOW}Checking for outdated packages...${NC}"
    
    if ! command -v npm-check &> /dev/null; then
        npm install -g npm-check 2>/dev/null || true
    fi
    
    npm outdated > "${REPORT_FILE}-outdated.txt" 2>/dev/null || true
    
    echo -e "${GREEN}Outdated packages check complete${NC}"
}

# Function to check license compliance
check_license_compliance() {
    echo -e "${YELLOW}Checking license compliance...${NC}"
    
    if ! command -v license-checker &> /dev/null; then
        npm install -g license-checker 2>/dev/null || true
    fi
    
    license-checker \
        --json > "${REPORT_FILE}-licenses.json" 2>/dev/null || true
    license-checker \
        --summary > "${REPORT_FILE}-licenses-summary.txt" 2>/dev/null || true
    license-checker \
        --failOn "GPL;AGPL;SSPL" \
        > "${REPORT_FILE}-licenses-restricted.txt" 2>/dev/null || true
    
    echo -e "${GREEN}License compliance check complete${NC}"
}

# Function to check for unused dependencies
check_unused_dependencies() {
    echo -e "${YELLOW}Checking for unused dependencies...${NC}"
    
    if ! command -v depcheck &> /dev/null; then
        npm install -g depcheck 2>/dev/null || true
    fi
    
    depcheck \
        --json > "${REPORT_FILE}-unused.json" 2>/dev/null || true
    depcheck \
        > "${REPORT_FILE}-unused.txt" 2>/dev/null || true
    
    echo -e "${GREEN}Unused dependencies check complete${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    local snyk_vulns=0
    local owasp_vulns=0
    local outdated_count=0
    local unused_count=0
    
    if [ "${SNYK_AVAILABLE:-false}" = "true" ] && [ -f "${REPORT_FILE}-snyk.json" ]; then
        if command -v jq &> /dev/null; then
            snyk_vulns=$(jq '.vulnerabilities | length' "${REPORT_FILE}-snyk.json" 2>/dev/null || echo "0")
        fi
    fi
    
    if [ -f "${REPORT_FILE}-outdated.txt" ]; then
        outdated_count=$(wc -l < "${REPORT_FILE}-outdated.txt" 2>/dev/null || echo "0")
        # Subtract header line
        outdated_count=$((outdated_count > 0 ? outdated_count - 1 : 0))
    fi
    
    if [ -f "${REPORT_FILE}-unused.txt" ]; then
        unused_count=$(grep -c "dependencies" "${REPORT_FILE}-unused.txt" 2>/dev/null || echo "0")
    fi
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# Dependency Scan Summary

## Scan Details
- **Project**: ${PROJECT_DIR}
- **Timestamp**: ${TIMESTAMP}
- **Scanners**: npm audit, Snyk, OWASP Dependency Check

## npm Audit Results

| Severity | Count |
|----------|-------|
| Critical | ${NPM_CRITICAL:-0} |
| High | ${NPM_HIGH:-0} |
| Moderate | ${NPM_MODERATE:-0} |
| Low | ${NPM_LOW:-0} |

## Snyk Results
- **Available**: ${SNYK_AVAILABLE:-false}
- **Vulnerabilities Found**: ${snyk_vulns}

## OWASP Dependency Check
- **Available**: ${OWASP_AVAILABLE:-false}

## Package Health

| Metric | Count |
|--------|-------|
| Outdated Packages | ${outdated_count} |
| Unused Dependencies | ${unused_count} |

## Results Files

| File | Description |
|------|-------------|
| ${REPORT_FILE}-npm-audit.json | npm audit JSON results |
| ${REPORT_FILE}-npm-audit.txt | npm audit text results |
| ${REPORT_FILE}-snyk.json | Snyk JSON results |
| ${REPORT_FILE}-snyk-all.txt | Snyk all vulnerabilities |
| ${REPORT_FILE}-snyk-high.txt | Snyk high+ severity |
| ${REPORT_FILE}-outdated.txt | Outdated packages |
| ${REPORT_FILE}-licenses.json | License information |
| ${REPORT_FILE}-unused.json | Unused dependencies |

## Critical Vulnerabilities

### Immediate Action Required
Review and patch all critical and high severity vulnerabilities.

### npm audit fix
\`\`\`bash
# Fix automatically fixable vulnerabilities
npm audit fix

# Fix including breaking changes (review first)
npm audit fix --force
\`\`\`

### Snyk remediation
\`\`\`bash
# View detailed remediation advice
snyk wizard

# Test specific package
snyk test <package-name>
\`\`\`

## Recommendations

### Immediate Actions
1. Run \`npm audit fix\` to patch known vulnerabilities
2. Update critical dependencies manually
3. Remove unused dependencies
4. Review and update license compliance

### Ongoing Maintenance
1. Enable automated security updates (Dependabot, Renovate)
2. Run dependency scans in CI/CD pipeline
3. Review new dependencies before adding
4. Monitor for new vulnerabilities regularly

### Best Practices
1. Lock dependency versions (package-lock.json)
2. Use exact versions where possible
3. Avoid deprecated packages
4. Verify package integrity (npm audit signatures)
5. Monitor security advisories

## Next Steps
1. Address all critical and high vulnerabilities
2. Update outdated packages
3. Remove unused dependencies
4. Review license compliance
5. Schedule regular scans
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting dependency scans...${NC}"
    echo ""
    
    # Run all scans
    run_npm_audit
    echo ""
    run_snyk_scan
    echo ""
    run_owasp_check
    echo ""
    check_outdated_packages
    echo ""
    check_license_compliance
    echo ""
    check_unused_dependencies
    
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