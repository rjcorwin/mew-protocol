#!/bin/bash
# Run all MEW v0.2 test scenarios from test-spaces

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}        MEW v0.2 Test Suite Runner              ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Track overall results
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_TESTS=""

# Create test results log
TEST_RESULTS_LOG="./test-results.log"
echo "MEW v0.2 Test Suite Results - $(date)" > "$TEST_RESULTS_LOG"
echo "================================================" >> "$TEST_RESULTS_LOG"

# Function to run a test
run_test() {
  local test_name="$1"
  local test_dir="$2"
  
  echo -e "${YELLOW}Running $test_name...${NC}"
  echo "" >> "$TEST_RESULTS_LOG"
  echo "[$test_name]" >> "$TEST_RESULTS_LOG"
  
  if [ -d "$test_dir" ] && [ -f "$test_dir/test.sh" ]; then
    pushd "$test_dir" > /dev/null
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    
    # Run the test with timeout directly
    if timeout 60 ./test.sh > ./logs/test-output.log 2>&1; then
      echo -e "${GREEN}✅ $test_name PASSED${NC}"
      echo "Status: PASSED" >> "../../$TEST_RESULTS_LOG"
      ((TOTAL_PASS++))
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo -e "${RED}❌ $test_name TIMEOUT${NC}"
        echo "Status: TIMEOUT" >> "../../$TEST_RESULTS_LOG"
        # Cleanup any hanging processes
        pkill -f "mew.js|mew-bridge" 2>/dev/null || true
        pkill -f "node.*calculator-participant" 2>/dev/null || true
      else
        echo -e "${RED}❌ $test_name FAILED${NC}"
        echo "Status: FAILED (exit code: $EXIT_CODE)" >> "../../$TEST_RESULTS_LOG"
      fi
      echo "   See $test_dir/logs/test-output.log for details"
      ((TOTAL_FAIL++))
      FAILED_TESTS="$FAILED_TESTS\n  - $test_name"
    fi
    
    popd > /dev/null
  else
    echo -e "${RED}❌ $test_name directory or script not found${NC}"
    echo "Status: NOT FOUND" >> "$TEST_RESULTS_LOG"
    ((TOTAL_FAIL++))
    FAILED_TESTS="$FAILED_TESTS\n  - $test_name (not found)"
  fi
  
  # Clean up any processes from this test
  pkill -f "mew.js|mew-bridge" 2>/dev/null || true
  pkill -f "pm2.*daemon" 2>/dev/null || true
  pkill -f "calculator-participant.js" 2>/dev/null || true
  pkill -f "mew-bridge" 2>/dev/null || true
  pkill -f "@modelcontextprotocol" 2>/dev/null || true
  sleep 1
  
  echo ""
}

# Clean up any leftover processes before starting
echo -e "${YELLOW}Cleaning up any existing test processes...${NC}"
pkill -f "mew.js|mew-bridge" 2>/dev/null || true
pkill -f "pm2.*daemon" 2>/dev/null || true
pkill -f "calculator-participant.js" 2>/dev/null || true
pkill -f "mew-bridge" 2>/dev/null || true
pkill -f "@modelcontextprotocol" 2>/dev/null || true
sleep 2

# Run all test scenarios
echo -e "${BLUE}Running Test Scenarios...${NC}"
echo ""

run_test "Scenario 1: Basic Message Flow" "./scenario-1-basic"
run_test "Scenario 2: MCP Tool Execution" "./scenario-2-mcp"
run_test "Scenario 3: Proposals with Capability Blocking" "./scenario-3-proposals"
run_test "Scenario 4: Dynamic Capability Granting" "./scenario-4-capabilities"
run_test "Scenario 5: Reasoning with Context Field" "./scenario-5-reasoning"
run_test "Scenario 6: Error Recovery and Edge Cases" "./scenario-6-errors"
run_test "Scenario 7: MCP Bridge Integration" "./scenario-7-mcp-bridge"
run_test "Scenario 8: TypeScript Agent" "./scenario-8-typescript-agent"
run_test "Scenario 9: TypeScript Proposals" "./scenario-9-typescript-proposals"
run_test "Scenario 10: Multi-Agent" "./scenario-10-multi-agent"

# Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}                 TEST SUMMARY                   ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Write summary to log
echo "" >> "$TEST_RESULTS_LOG"
echo "================================================" >> "$TEST_RESULTS_LOG"
echo "SUMMARY" >> "$TEST_RESULTS_LOG"
echo "Tests Passed: $TOTAL_PASS" >> "$TEST_RESULTS_LOG"
echo "Tests Failed: $TOTAL_FAIL" >> "$TEST_RESULTS_LOG"

if [ $TOTAL_FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED! (${TOTAL_PASS}/${TOTAL_PASS})${NC}"
  echo "Result: ALL PASSED" >> "$TEST_RESULTS_LOG"
else
  echo -e "${YELLOW}Tests Passed: ${TOTAL_PASS}${NC}"
  echo -e "${RED}Tests Failed: ${TOTAL_FAIL}${NC}"
  echo -e "${RED}Failed Tests:${FAILED_TESTS}${NC}"
  echo "Result: SOME FAILED" >> "$TEST_RESULTS_LOG"
fi

echo ""
echo -e "${GREEN}Test results saved to: $TEST_RESULTS_LOG${NC}"
echo ""

# Cleanup any lingering processes
echo -e "${YELLOW}Cleaning up any lingering processes...${NC}"
pkill -f "mew.js gateway" 2>/dev/null || true
pkill -f "node.*agents" 2>/dev/null || true

echo -e "${GREEN}Test run complete!${NC}"

# Exit with appropriate code
if [ $TOTAL_FAIL -eq 0 ]; then
  exit 0
else
  exit 1
fi