#!/bin/bash
# Run all completed MEUP v0.2 test scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}        MEUP v0.2 Test Suite Runner             ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Track overall results
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_TESTS=""

# Function to run a test
run_test() {
  local test_name="$1"
  local test_script="$2"
  
  echo -e "${YELLOW}Running $test_name...${NC}"
  
  if [ -f "$test_script" ]; then
    if timeout 30 bash "$test_script" > /tmp/test-output-$$.log 2>&1; then
      echo -e "${GREEN}✅ $test_name PASSED${NC}"
      ((TOTAL_PASS++))
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo -e "${RED}❌ $test_name TIMEOUT${NC}"
        pkill -f "meup.js" 2>/dev/null || true
        pkill -f "calculator.js" 2>/dev/null || true
      else
        echo -e "${RED}❌ $test_name FAILED${NC}"
      fi
      echo "   See /tmp/test-output-$$.log for details"
      ((TOTAL_FAIL++))
      FAILED_TESTS="$FAILED_TESTS\n  - $test_name"
    fi
  else
    echo -e "${RED}❌ $test_name script not found: $test_script${NC}"
    ((TOTAL_FAIL++))
    FAILED_TESTS="$FAILED_TESTS\n  - $test_name (script not found)"
  fi
  echo ""
}

# Run all completed tests
echo -e "${BLUE}Running Test Scenarios...${NC}"
echo ""

run_test "Scenario 1: Basic Message Flow" "./test-scenario1.sh"
run_test "Scenario 2: MCP Tool Execution" "./test-scenario2.sh"
run_test "Scenario 3: Proposals with Capability Blocking" "./test-scenario3.sh"
run_test "Scenario 4: Dynamic Capability Granting" "./test-scenario4.sh"
run_test "Scenario 5: Reasoning with Context Field" "./test-scenario5.sh"
run_test "Scenario 6: Error Recovery and Edge Cases" "./test-scenario6.sh"

# Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}                 TEST SUMMARY                   ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

if [ $TOTAL_FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED! (${TOTAL_PASS}/${TOTAL_PASS})${NC}"
else
  echo -e "${YELLOW}Tests Passed: ${TOTAL_PASS}${NC}"
  echo -e "${RED}Tests Failed: ${TOTAL_FAIL}${NC}"
  echo -e "${RED}Failed Tests:${FAILED_TESTS}${NC}"
fi

echo ""
echo -e "${GREEN}All test scenarios implemented!${NC}"
echo ""

# Cleanup any lingering processes
echo -e "${YELLOW}Cleaning up any lingering processes...${NC}"
pkill -f "meup.js gateway" 2>/dev/null || true
pkill -f "agents/(echo|calculator|fulfiller).js" 2>/dev/null || true

echo -e "${GREEN}Test run complete!${NC}"

# Exit with appropriate code
if [ $TOTAL_FAIL -eq 0 ]; then
  exit 0
else
  exit 1
fi