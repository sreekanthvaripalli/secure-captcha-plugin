#!/bin/bash
# =============================================================================
# SQLMap SQL Injection Testing
# =============================================================================
# This script runs SQLMap against the target API endpoints to test for
# SQL injection vulnerabilities in parameters and headers.
#
# Prerequisites:
#   - SQLMap installed (brew install sqlmap)
#   - Target application running
#
# Usage:
#   ./sqlmap-test.sh [TARGET_URL]
#   ./sqlmap-test.sh http://localhost:3000/api/v1/captcha/generate
# =============================================================================

set -euo pipefail

# Configuration
TARGET_URL="${1:-http://localhost:3000}"
RESULTS_DIR="../results/sqlmap"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${RESULTS_DIR}/sqlmap-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "${RESULTS_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  SQLMap SQL Injection Testing${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Target: ${NC}${TARGET_URL}"
echo -e "${BLUE}Timestamp: ${NC}${TIMESTAMP}"
echo -e "${BLUE}============================================${NC}"

# Check if SQLMap is installed
if ! command -v sqlmap &> /dev/null; then
    echo -e "${RED}Error: SQLMap is not installed${NC}"
    echo "Install with: brew install sqlmap"
    echo "Or use Docker: docker run --rm -it paoloo/sqlmap"
    exit 1
fi

# Function to test captcha generation endpoint
test_generate_endpoint() {
    echo -e "${YELLOW}Testing POST /api/v1/captcha/generate...${NC}"
    
    # Create request file
    cat > "${RESULTS_DIR}/generate-request.txt" << EOF
POST /api/v1/captcha/generate HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 50

{"type": "text", "difficulty": "easy"}
EOF

    sqlmap -r "${RESULTS_DIR}/generate-request.txt" \
        --batch \
        --level=3 \
        --risk=2 \
        --threads=3 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --output-dir="${RESULTS_DIR}/generate" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-generate.txt"
    
    echo -e "${GREEN}Generate endpoint test complete${NC}"
}

# Function to test captcha validation endpoint
test_validate_endpoint() {
    echo -e "${YELLOW}Testing POST /api/v1/captcha/validate...${NC}"
    
    # Create request file
    cat > "${RESULTS_DIR}/validate-request.txt" << EOF
POST /api/v1/captcha/validate HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 80

{"sessionId": "test-session", "response": "test-response", "type": "text"}
EOF

    sqlmap -r "${RESULTS_DIR}/validate-request.txt" \
        --batch \
        --level=3 \
        --risk=2 \
        --threads=3 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --output-dir="${RESULTS_DIR}/validate" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-validate.txt"
    
    echo -e "${GREEN}Validate endpoint test complete${NC}"
}

# Function to test health endpoint
test_health_endpoint() {
    echo -e "${YELLOW}Testing GET /api/v1/health...${NC}"
    
    sqlmap -u "${TARGET_URL}/api/v1/health" \
        --batch \
        --level=2 \
        --risk=1 \
        --threads=2 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --output-dir="${RESULTS_DIR}/health" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-health.txt"
    
    echo -e "${GREEN}Health endpoint test complete${NC}"
}

# Function to test with custom injection points
test_custom_injections() {
    echo -e "${YELLOW}Testing custom injection points...${NC}"
    
    # Test User-Agent header
    sqlmap -u "${TARGET_URL}/api/v1/health" \
        --batch \
        --level=3 \
        --risk=2 \
        --user-agent="Mozilla/5.0" \
        --threads=2 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --output-dir="${RESULTS_DIR}/useragent" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-useragent.txt"
    
    echo -e "${GREEN}Custom injection test complete${NC}"
}

# Function to test with authentication
test_authenticated_injections() {
    echo -e "${YELLOW}Testing authenticated injection points...${NC}"
    
    # Test with API key header
    sqlmap -u "${TARGET_URL}/api/v1/captcha/types" \
        --batch \
        --level=3 \
        --risk=2 \
        --headers="X-API-Key: test-api-key" \
        --threads=2 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --output-dir="${RESULTS_DIR}/authenticated" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-authenticated.txt"
    
    echo -e "${GREEN}Authenticated injection test complete${NC}"
}

# Function to run comprehensive scan
run_comprehensive_scan() {
    echo -e "${YELLOW}Running comprehensive SQL injection scan...${NC}"
    
    # Create comprehensive request with multiple parameters
    cat > "${RESULTS_DIR}/comprehensive-request.txt" << EOF
POST /api/v1/captcha/generate HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Accept: application/json
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
Content-Length: 100

{"type": "text", "difficulty": "easy", "options": {"width": 200, "height": 100}}
EOF

    sqlmap -r "${RESULTS_DIR}/comprehensive-request.txt" \
        --batch \
        --level=5 \
        --risk=3 \
        --threads=3 \
        --time-sec=5 \
        --timeout=30 \
        --retries=2 \
        --flush-session \
        --technique=BEUSTQ \
        --smart \
        --output-dir="${RESULTS_DIR}/comprehensive" \
        --answers="follow=N" \
        2>&1 | tee "${REPORT_FILE}-comprehensive.txt"
    
    echo -e "${GREEN}Comprehensive scan complete${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating summary report...${NC}"
    
    local vulnerable=0
    local not_vulnerable=0
    local errors=0
    
    # Check results
    for dir in "${RESULTS_DIR}"/*/; do
        if [ -f "${dir}log" ]; then
            if grep -q "is vulnerable" "${dir}log" 2>/dev/null; then
                vulnerable=$((vulnerable + 1))
            elif grep -q "not vulnerable" "${dir}log" 2>/dev/null; then
                not_vulnerable=$((not_vulnerable + 1))
            else
                errors=$((errors + 1))
            fi
        fi
    done
    
    cat > "${REPORT_FILE}-summary.md" << EOF
# SQLMap SQL Injection Test Summary

## Test Details
- **Target**: ${TARGET_URL}
- **Timestamp**: ${TIMESTAMP}
- **Scanner**: SQLMap

## Results Summary

| Status | Count |
|--------|-------|
| Vulnerable | ${vulnerable} |
| Not Vulnerable | ${not_vulnerable} |
| Errors/Unknown | ${errors} |

## Endpoints Tested

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/v1/captcha/generate | POST | - | Captcha generation |
| /api/v1/captcha/validate | POST | - | Captcha validation |
| /api/v1/health | GET | - | Health check |
| /api/v1/captcha/types | GET | - | Available types |

## Injection Points Tested

### POST Parameters
- type: CAPTCHA type selection
- difficulty: Difficulty level
- sessionId: Session identifier
- response: User response
- options: Configuration options

### Headers
- Content-Type: Request content type
- User-Agent: Client identification
- X-API-Key: API authentication
- X-Forwarded-For: Client IP
- X-Real-IP: Real client IP

## SQL Injection Types Tested

### Boolean-Based Blind
- OR boolean conditions
- AND boolean conditions
- Comparison operators

### Time-Based Blind
- SLEEP() function
- BENCHMARK() function
- Heavy queries

### Error-Based
- ExtractValue()
- UpdateXML()
- GeometryCollection()

### UNION Query
- UNION SELECT statements
- Column enumeration
- Data extraction

### Stacked Queries
- Multiple statements
- Semicolon separation

## Security Controls Verified

### Input Validation
- [ ] Parameter type checking
- [ ] Input length limits
- [ ] Special character filtering
- [ ] SQL keyword detection

### Parameterized Queries
- [ ] Prepared statements usage
- [ ] Query parameterization
- [ ] ORM protection

### WAF/Protection
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] Request validation
- [ ] SQL injection detection

## Remediation Recommendations

### If Vulnerable
1. **Use Parameterized Queries**: Replace string concatenation with prepared statements
2. **Implement Input Validation**: Validate all input against expected patterns
3. **Use ORM**: Leverage ORM frameworks for database operations
4. **Apply Least Privilege**: Restrict database user permissions
5. **Enable WAF**: Deploy web application firewall rules

### Best Practices
1. **Never Trust Input**: Validate and sanitize all user input
2. **Use Allowlists**: Define expected input patterns
3. **Escape Output**: Encode output for context
4. **Monitor Logs**: Alert on suspicious patterns
5. **Regular Testing**: Schedule periodic SQLMap scans

## Next Steps
1. Review all findings in detail
2. Verify any positive findings manually
3. Implement remediation measures
4. Re-test to verify fixes
5. Add SQLMap to CI/CD pipeline
EOF

    echo -e "${GREEN}Summary report generated: ${REPORT_FILE}-summary.md${NC}"
}

# Function to run scan with Docker
run_docker_scan() {
    echo -e "${YELLOW}Running SQLMap via Docker...${NC}"
    
    docker run --rm \
        --network="host" \
        -v "${RESULTS_DIR}:/root/.sqlmap" \
        paoloo/sqlmap \
        -u "${TARGET_URL}/api/v1/health" \
        --batch \
        --level=3 \
        --risk=2 \
        --output-dir="/root/.sqlmap"
    
    echo -e "${GREEN}Docker scan complete${NC}"
}

# Main execution
main() {
    echo ""
    echo -e "${YELLOW}Starting SQLMap tests...${NC}"
    echo ""
    
    # Check if we should use Docker
    if [ "${USE_DOCKER:-false}" = "true" ]; then
        run_docker_scan
    else
        # Run all tests
        test_generate_endpoint
        echo ""
        test_validate_endpoint
        echo ""
        test_health_endpoint
        echo ""
        test_custom_injections
        echo ""
        test_authenticated_injections
        echo ""
        run_comprehensive_scan
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