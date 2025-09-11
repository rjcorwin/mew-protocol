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
  export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"
  
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
echo -e "${BLUE}Scenario: MCP Tool Execution${NC}"
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

# Test 2: Check output log exists
run_test "Output log exists" "[ -f '$OUTPUT_LOG' ]"

# Test 3: List available tools
echo -e "\n${YELLOW}Test: List available tools${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > /dev/null
sleep 2

if grep -q '"kind":"mcp/response"' "$RESPONSE_FILE" && grep -q '"tools":\[' "$RESPONSE_FILE"; then
  echo -e "Tools list received: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Tools list received: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 4: Call add tool
echo -e "\n${YELLOW}Test: Call add tool (5 + 3)${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > /dev/null
sleep 2

if grep -q '"text":"8"' "$RESPONSE_FILE"; then
  echo -e "Add tool result: ${GREEN}✓ (8)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Add tool result: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 5: Call multiply tool
echo -e "\n${YELLOW}Test: Call multiply tool (7 × 9)${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":9}}}}' > /dev/null
sleep 2

if grep -q '"text":"63"' "$RESPONSE_FILE"; then
  echo -e "Multiply tool result: ${GREEN}✓ (63)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Multiply tool result: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Call evaluate tool for division
echo -e "\n${YELLOW}Test: Call evaluate tool (20 ÷ 4)${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"20 / 4"}}}}' > /dev/null
sleep 2

if grep -q '"text":"5"' "$RESPONSE_FILE"; then
  echo -e "Evaluate tool result: ${GREEN}✓ (5)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Evaluate tool result: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 7: Handle division by zero
echo -e "\n${YELLOW}Test: Handle division by zero${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"10 / 0"}}}}' > /dev/null
sleep 2

if grep -q 'Infinity' "$RESPONSE_FILE" || grep -q 'division by zero' "$RESPONSE_FILE" || grep -q '"kind":"mcp/error"' "$RESPONSE_FILE"; then
  echo -e "Division by zero handling: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Division by zero handling: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 8: Invalid tool name
echo -e "\n${YELLOW}Test: Call non-existent tool${NC}"
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"invalid","arguments":{}}}}' > /dev/null
sleep 2

if grep -q 'Unknown tool: invalid' "$RESPONSE_FILE" || grep -q '"kind":"mcp/error"' "$RESPONSE_FILE"; then
  echo -e "Invalid tool handling: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Invalid tool handling: ${RED}✗${NC}"
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