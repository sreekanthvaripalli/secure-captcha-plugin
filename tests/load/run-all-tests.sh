#!/bin/bash
# Load Test Runner Script
# Runs all load tests and generates consolidated output
#
# Usage:
#   ./tests/load/run-all-tests.sh              # Run all tests with default settings
#   ./tests/load/run-all-tests.sh quick        # Run quick tests (30s each)
#   ./tests/load/run-all-tests.sh --url http://staging:3000  # Custom URL

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
OUTPUT_DIR="${OUTPUT_DIR:-tests/load/results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Secure CAPTCHA - Load Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Target URL: ${GREEN}${BASE_URL}${NC}"
echo -e "Output Directory: ${GREEN}${OUTPUT_DIR}${NC}"
echo -e "Timestamp: ${GREEN}${TIMESTAMP}${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed.${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if server is running
echo -e "${YELLOW}Checking server health...${NC}"
if ! curl -s "${BASE_URL}/api/v1/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Server is not running at ${BASE_URL}${NC}"
    echo "Start the server with: npm start"
    exit 1
fi
echo -e "${GREEN}Server is running!${NC}"
echo ""

# Function to run a single test
run_test() {
    local test_name="$1"
    local test_file="$2"
    local duration="$3"
    local vus="$4"
    
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}  Running: ${test_name}${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "Duration: ${duration}"
    echo -e "Virtual Users: ${vus}"
    echo ""
    
    local output_file="${OUTPUT_DIR}/${test_name}_${TIMESTAMP}.json"
    local summary_file="${OUTPUT_DIR}/${test_name}_${TIMESTAMP}_summary.txt"
    
    # Run k6 test
    if k6 run \
        --out json="${output_file}" \
        --vus "${vus}" \
        --duration "${duration}" \
        --summary-export="${summary_file}" \
        -e BASE_URL="${BASE_URL}" \
        "${test_file}" 2>&1 | tee "${OUTPUT_DIR}/${test_name}_${TIMESTAMP}.log"; then
        echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
    fi
    
    echo ""
}

# Parse command line arguments
TEST_MODE="${1:-full}"

case "$TEST_MODE" in
    quick)
        DURATION="30s"
        VUS="10"
        echo -e "${YELLOW}Running QUICK tests (30s each, 10 VUs)${NC}"
        ;;
    smoke)
        DURATION="10s"
        VUS="5"
        echo -e "${YELLOW}Running SMOKE tests (10s each, 5 VUs)${NC}"
        ;;
    full)
        DURATION="1m"
        VUS="50"
        echo -e "${YELLOW}Running FULL tests (1m each, 50 VUs)${NC}"
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 [quick|smoke|full]${NC}"
        echo ""
        echo "Modes:"
        echo "  quick  - Quick validation (30s per test)"
        echo "  smoke  - Smoke test (10s per test)"
        echo "  full   - Full load test (1m per test)"
        echo ""
        exit 1
        ;;
esac

echo ""

# Run all tests
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Starting Load Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: CAPTCHA Generation
run_test "captcha-generation" \
    "tests/load/captcha-generation.js" \
    "$DURATION" \
    "$VUS"

# Test 2: CAPTCHA Validation
run_test "captcha-validation" \
    "tests/load/captcha-validation.js" \
    "$DURATION" \
    "$VUS"

# Test 3: Concurrent Users (reduced for quick/smoke)
if [ "$TEST_MODE" = "full" ]; then
    run_test "concurrent-users" \
        "tests/load/concurrent-users.js" \
        "2m" \
        "100"
else
    run_test "concurrent-users" \
        "tests/load/concurrent-users.js" \
        "$DURATION" \
        "$VUS"
fi

# Test 4: Sustained Load (only in full mode)
if [ "$TEST_MODE" = "full" ]; then
    echo -e "${YELLOW}Skipping sustained load test (1 hour) in ${TEST_MODE} mode${NC}"
    echo "Run manually: k6 run tests/load/sustained-load.js"
else
    echo -e "${YELLOW}Skipping sustained load test in ${TEST_MODE} mode${NC}"
fi

# Test 5: Spike Load
if [ "$TEST_MODE" = "full" ]; then
    run_test "spike-load" \
        "tests/load/spike-load.js" \
        "3m" \
        "100"
else
    run_test "spike-load" \
        "tests/load/spike-load.js" \
        "$DURATION" \
        "$VUS"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Load Tests Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Results saved to: ${GREEN}${OUTPUT_DIR}${NC}"
echo ""

# List results
echo "Generated files:"
ls -la "${OUTPUT_DIR}"/*"${TIMESTAMP}"* 2>/dev/null | while read line; do
    echo "  $line"
done

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the summary files in ${OUTPUT_DIR}"
echo "2. Check the load test report: tests/load/load-test-report.md"
echo "3. View Grafana dashboards for visual metrics"
echo ""
echo -e "${GREEN}Done!${NC}"