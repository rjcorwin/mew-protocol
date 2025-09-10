#!/bin/bash
# Check script - Runs test assertions against a running space
#
# Can be run after manual setup or called by test.sh

# Don't use set -e as it causes issues with arithmetic operations
# set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# If TEST_DIR not set, we're running standalone
if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
  export FIFO_IN="$TEST_DIR/fifos/proposer-in"
  export OUTPUT_LOG="$TEST_DIR/logs/proposer-output.log"
  
  # Try to detect port from running space
  if [ -f "$TEST_DIR/.mew/pids.json" ]; then
    export TEST_PORT=$(grep -o '"port":[[:space:]]*"[0-9]*"' "$TEST_DIR/.mew/pids.json" | grep -o '[0-9]*')
  fi
  
  if [ -z "$TEST_PORT" ]; then
    echo -e "${RED}Error: Cannot determine test port. Is the space running?${NC}"
    exit 1
  fi
fi

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: Proposals with Capability Blocking${NC}"
echo -e "${BLUE}Test directory: $TEST_DIR${NC}"
echo -e "${BLUE}Gateway port: $TEST_PORT${NC}"
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -n "Testing: $test_name ... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC}"
    ((TESTS_FAILED++))
  fi
}

# Point to the output log file (created by output_log config)
RESPONSE_FILE="$OUTPUT_LOG"

# Test 1: Gateway health check
run_test "Gateway is running" "curl -s http://localhost:$TEST_PORT/health | grep -q 'ok'"

# Test 2: Check input FIFO and output log exist
run_test "Input FIFO exists" "[ -p '$FIFO_IN' ]"
run_test "Output log exists" "[ -f '$OUTPUT_LOG' ]"

# Test 3: Proposer cannot directly call MCP tools (blocked by capabilities)
echo -e "\n${YELLOW}Test: Proposer attempts direct MCP call${NC}"
(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":1,"b":2}}}}' > "$FIFO_IN" &)
sleep 2

if grep -q '"kind":"system/error"' "$RESPONSE_FILE" && grep -q 'capability_violation' "$RESPONSE_FILE"; then
  echo -e "Direct MCP call blocked: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Direct MCP call blocked: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 4: Proposer sends proposal for calculation
echo -e "\n${YELLOW}Test: Send proposal for calculation${NC}"
(echo '{"kind":"mcp/proposal","payload":{"proposal":{"type":"calculation","operation":"add","arguments":{"a":10,"b":5}}}}' > "$FIFO_IN" &)
sleep 3

# Check if fulfiller received and processed the proposal
if grep -q '"text":"15"' "$RESPONSE_FILE" || grep -q '"result":15' "$RESPONSE_FILE"; then
  echo -e "Proposal fulfilled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Proposal fulfilled: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 5: Proposer sends proposal for complex calculation
echo -e "\n${YELLOW}Test: Complex calculation proposal${NC}"
(echo '{"kind":"mcp/proposal","payload":{"proposal":{"type":"calculation","operation":"multiply","arguments":{"a":7,"b":8}}}}' > "$FIFO_IN" &)
sleep 3

if grep -q '"text":"56"' "$RESPONSE_FILE" || grep -q '"result":56' "$RESPONSE_FILE"; then
  echo -e "Complex proposal fulfilled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Complex proposal fulfilled: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Invalid proposal
echo -e "\n${YELLOW}Test: Invalid proposal handling${NC}"
(echo '{"kind":"mcp/proposal","payload":{"proposal":{"type":"invalid"}}}' > "$FIFO_IN" &)
sleep 2

if grep -q 'Unknown proposal type' "$RESPONSE_FILE" || grep -q '"kind":"system/error"' "$RESPONSE_FILE"; then
  echo -e "Invalid proposal handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Invalid proposal handled: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Summary
echo ""
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some tests failed${NC}"
  exit 1
fi