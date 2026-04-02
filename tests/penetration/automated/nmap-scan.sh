#!/bin/bash
# =============================================================================
# Nmap Network Security Scan
# =============================================================================
# This script runs Nmap against the target host to identify open ports,
# running services, and potential network-level vulnerabilities.
#
# Prerequisites:
#   - Nmap installed (brew install nmap)
#   - Target application running
#
# Usage:
#   ./nmap-scan.sh [TARGET] [SCAN_TYPE]
#   ./nmap-scan.sh localhost quick
#   ./nmap-scan.sh localhost full
#   ./nmap-scan.sh 192.168.1.0/24 network
# =============================================================================

set -euo pipefail

# Configuration
TARGET="${1:-localhost}"
SCAN_TYPE="${2:-quick}"
RESULTS_DIR="../results/nmap"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/nmap-${SCAN_TYPE}-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Nmap Network Security Scan${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Target: ${NC}${TARGET}"
echo -e "${BLUE}Scan Type: ${NC}${SCAN_TYPE}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Check if Nmap is installed
if ! command -v nmap &> /dev/null; then
    echo -e "${RED}Error: Nmap is not installed${NC}"
    echo "Install with: brew install nmap"
    exit 1
fi

# Function to run quick scan
run_quick_scan() {
    echo -e "${YELLOW}Running quick scan (top 100 ports)...${NC}"
    
    nmap --top-ports 100 \
        -T4 \
        -F \
        --reason \
        -oA "${REPORT_FILE}-quick" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-quick.txt"
    
    echo -e "${GREEN}Quick scan complete${NC}"
}

# Function to run comprehensive scan
run_comprehensive_scan() {
    echo -e "${YELLOW}Running comprehensive scan (all ports)...${NC}"
    
    nmap -p- \
        -T4 \
        -sV \
        -sC \
        --reason \
        --version-all \
        -oA "${REPORT_FILE}-comprehensive" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-comprehensive.txt"
    
    echo -e "${GREEN}Comprehensive scan complete${NC}"
}

# Function to run vulnerability scan
run_vulnerability_scan() {
    echo -e "${YELLOW}Running vulnerability scan with NSE scripts...${NC}"
    
    nmap -p- \
        -T4 \
        -sV \
        --script vuln \
        --script-timeout 300 \
        -oA "${REPORT_FILE}-vulns" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-vulns.txt"
    
    echo -e "${GREEN}Vulnerability scan complete${NC}"
}

# Function to run service detection
run_service_detection() {
    echo -e "${YELLOW}Running service version detection...${NC}"
    
    nmap -sV \
        --version-intensity 5 \
        --version-trace \
        -oA "${REPORT_FILE}-services" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-services.txt"
    
    echo -e "${GREEN}Service detection complete${NC}"
}

# Function to run OS detection
run_os_detection() {
    echo -e "${YELLOW}Running OS detection...${NC}"
    
    nmap -O \
        --osscan-guess \
        --osscan-limit \
        -oA "${REPORT_FILE}-os" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-os.txt"
    
    echo -e "${GREEN}OS detection complete${NC}"
}

# Function to run UDP scan
run_udp_scan() {
    echo -e "${YELLOW}Running UDP scan (top 50 ports)...${NC}"
    
    nmap -sU \
        --top-ports 50 \
        -T4 \
        -oA "${REPORT_FILE}-udp" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-udp.txt"
    
    echo -e "${GREEN}UDP scan complete${NC}"
}

# Function to run firewall detection
run_firewall_detection() {
    echo -e "${YELLOW}Running firewall/IDS detection...${NC}"
    
    nmap -sA \
        -T4 \
        -oA "${REPORT_FILE}-firewall" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-firewall.txt"
    
    echo -e "${GREEN}Firewall detection complete${NC}"
}

# Function to run specific port scan for common web ports
run_web_port_scan() {
    echo -e "${YELLOW}Running web port scan (80, 443, 3000, 8000, 8080, 8443)...${NC}"
    
    nmap -p 80,443,3000,8000,8080,8443 \
        -sV \
        -sC \
        --script http-enum,http-methods,http-headers,http-security-headers \
        -oA "${REPORT_FILE}-web" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-web.txt"
    
    echo -e "${GREEN}Web port scan complete${NC}"
}

# Function to run Nmap NSE scripts for web security
run_web_security_scripts() {
    echo -e "${YELLOW}Running web security NSE scripts...${NC}"
    
    nmap -p 3000,80,443 \
        -sV \
        --script "http-* and not http-brute and not http-slowloris" \
        --script-timeout 300 \
        -oA "${REPORT_FILE}-web-scripts" \
        "${TARGET}" 2>&1 | tee "${REPORT_FILE}-web-scripts.txt"
    
    echo -e "${GREEN}Web security scripts complete${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    local open_ports=0
    local filtered_ports=0
    local closed_ports=0
    local services=0
    local vulns=0
    
    if [ -f "${REPORT_FILE}-quick.txt" ]; then
        open_ports=$(grep -c "open" "${REPORT_FILE}-quick.txt" 2>/dev/null || echo "0")
        filtered_ports=$(grep -c "filtered" "${REPORT_FILE}-quick.txt" 2>/dev/null || echo "0")
        closed_ports=$(grep -c "closed" "${REPORT_FILE}-quick.txt" 2>/dev/null || echo "0")
    fi
    
    if [ -f "${REPORT_FILE}-comprehensive.txt" ]; then
        services=$(grep -cE "^[0-9]+/tcp" "${REPORT_FILE}-comprehensive.txt" 2>/dev/null || echo "0")
    fi
    
    if [ -f "${REPORT_FILE}-vulns.txt" ]; then
        vulns=$(grep -cE "VULNERABLE|CVE" "${REPORT_FILE}-vulns.txt" 2>/dev/null || echo "0")
    fi
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# Nmap Scan Summary

## Scan Details
- **Target**: ${TARGET}
- **Scan Type**: ${SCAN_TYPE}
- **Timestamp**: ${TIMESTAMP}
- **Scanner**: Nmap Network Mapper

## Port Summary

| Status | Count |
|--------|-------|
| Open | ${open_ports} |
| Filtered | ${filtered_ports} |
| Closed | ${closed_ports} |
| Services Detected | ${services} |
| Vulnerabilities | ${vulns} |

## Results Files

| File | Description |
|------|-------------|
| ${REPORT_FILE}-quick.* | Quick scan (top 100 ports) |
| ${REPORT_FILE}-comprehensive.* | Full port scan with service detection |
| ${REPORT_FILE}-vulns.* | Vulnerability scan with NSE scripts |
| ${REPORT_FILE}-services.* | Service version detection |
| ${REPORT_FILE}-os.* | OS detection |
| ${REPORT_FILE}-udp.* | UDP port scan |
| ${REPORT_FILE}-firewall.* | Firewall/IDS detection |
| ${REPORT_FILE}-web.* | Web port scan with security scripts |
| ${REPORT_FILE}-web-scripts.* | Web security NSE scripts |

## Open Ports Analysis

### Expected Ports
- 3000/tcp: Application server (expected)
- 5432/tcp: PostgreSQL (should be internal only)
- 6379/tcp: Redis (should be internal only)

### Unexpected Ports
Review any ports not in the expected list above.

## Service Version Analysis

### Outdated Services
Check for services with known vulnerabilities:
- Node.js version
- PostgreSQL version
- Redis version
- OpenSSL version

## Vulnerability Summary

### Critical Vulnerabilities
- Review NSE script output for critical CVEs

### High Vulnerabilities
- Review NSE script output for high severity issues

### Medium Vulnerabilities
- Review NSE script output for medium severity issues

## Security Recommendations

### Network Level
1. **Close Unnecessary Ports**: Only expose required ports
2. **Implement Firewall Rules**: Restrict access to internal services
3. **Use Network Segmentation**: Separate public and private services
4. **Enable IDS/IPS**: Monitor for suspicious activity

### Service Level
1. **Update Services**: Patch all services to latest versions
2. **Disable Unnecessary Features**: Minimize attack surface
3. **Configure Secure Defaults**: Harden service configurations
4. **Enable Authentication**: Require authentication for all services

### Application Level
1. **Implement Rate Limiting**: Protect against brute force
2. **Enable TLS**: Encrypt all communications
3. **Validate Input**: Sanitize all user input
4. **Monitor Logs**: Set up alerting for suspicious activity

## Next Steps
1. Review all open ports and verify they are expected
2. Check service versions against known vulnerabilities
3. Address any vulnerabilities found by NSE scripts
4. Implement network security recommendations
5. Schedule regular re-scans
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Function to run scan with Docker
run_docker_scan() {
    echo -e "${YELLOW}Running Nmap via Docker...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/data" \
        instrumentisto/nmap \
        -T4 \
        -sV \
        -sC \
        -oA "/data/nmap-docker-${TIMESTAMP}" \
        "${TARGET}"
    
    echo -e "${GREEN}Docker scan complete${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting Nmap scan...${NC}"
    echo ""
    
    # Check if we should use Docker
    if [ "${USE_DOCKER:-false}" = "true" ]; then
        run_docker_scan
    else
        case "${SCAN_TYPE}" in
            quick)
                run_quick_scan
                ;;
            full)
                run_comprehensive_scan
                run_vulnerability_scan
                run_service_detection
                ;;
            vuln)
                run_vulnerability_scan
                ;;
            web)
                run_web_port_scan
                run_web_security_scripts
                ;;
            all)
                run_quick_scan
                echo ""
                run_comprehensive_scan
                echo ""
                run_vulnerability_scan
                echo ""
                run_service_detection
                echo ""
                run_os_detection
                echo ""
                run_udp_scan
                echo ""
                run_firewall_detection
                echo ""
                run_web_port_scan
                echo ""
                run_web_security_scripts
                ;;
            *)
                echo -e "${RED}Unknown scan type: ${SCAN_TYPE}${NC}"
                echo "Valid types: quick, full, vuln, web, all"
                exit 1
                ;;
        esac
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