#!/bin/bash
# Check script for Scenario 4: Dynamic Capability Granting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: Dynamic Capability Granting${NC}"
echo -e "${BLUE}Test directory: $(pwd)${NC}"
echo -e "${BLUE}Gateway port: ${TEST_PORT}${NC}"

# Get paths from environment or use defaults
COORD_FIFO="${COORD_FIFO:-./fifos/coordinator-in}"
LIMITED_FIFO="${LIMITED_FIFO:-./fifos/limited-agent-in}"
COORD_LOG="${COORD_LOG:-./logs/coordinator-output.log}"
LIMITED_LOG="${LIMITED_LOG:-./logs/limited-agent-output.log}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to check test result
check_test() {
  local test_name="$1"
  local condition="$2"
  
  if eval "$condition"; then
    echo -e "$test_name: ${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "$test_name: ${RED}✗${NC}"
    ((TESTS_FAILED++))
  fi
}

# Basic connectivity tests
echo "Testing: Gateway is running ... \c"
# Check if gateway is listening on the port
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

echo "Testing: Coordinator FIFO exists ... \c"
check_test "" "[ -p '$COORD_FIFO' ]"

echo "Testing: Limited agent FIFO exists ... \c"
check_test "" "[ -p '$LIMITED_FIFO' ]"

echo "Testing: Output logs exist ... \c"
check_test "" "[ -f '$COORD_LOG' ] && [ -f '$LIMITED_LOG' ]"

# Test 1: Limited agent attempts MCP operation (should be blocked)
echo -e "\n${YELLOW}Test 1: Limited agent attempts tools/list (should be blocked)${NC}"
(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > "$LIMITED_FIFO" &)
sleep 2

if grep -q '"kind":"system/error"' "$LIMITED_LOG" && grep -q 'capability_violation' "$LIMITED_LOG"; then
  echo -e "MCP request blocked: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "MCP request blocked: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 2: Coordinator grants MCP capability
echo -e "\n${YELLOW}Test 2: Coordinator grants tools/list capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/list"}}]}}'
(echo "$GRANT_JSON" > "$COORD_FIFO" &)
sleep 2

# Check if limited agent received grant acknowledgment
if tail -10 "$LIMITED_LOG" | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "Grant acknowledged: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Grant acknowledged: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 3: Limited agent can now list tools
echo -e "\n${YELLOW}Test 3: Limited agent attempts tools/list (should succeed)${NC}"
# Clear previous responses
echo "" > /tmp/test-response.txt
tail -f "$LIMITED_LOG" > /tmp/test-response.txt &
TAIL_PID=$!

(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > "$LIMITED_FIFO" &)
sleep 3
kill $TAIL_PID 2>/dev/null || true

if grep -q '"kind":"mcp/response"' /tmp/test-response.txt && grep -q '"tools"' /tmp/test-response.txt; then
  echo -e "Tools listed successfully: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Tools listed successfully: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 4: Limited agent still can't call tools
echo -e "\n${YELLOW}Test 4: Limited agent attempts tools/call (should be blocked)${NC}"
# Clear previous responses
echo "" > /tmp/test-response.txt
tail -f "$LIMITED_LOG" > /tmp/test-response.txt &
TAIL_PID=$!

(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":1,"b":2}}}}' > "$LIMITED_FIFO" &)
sleep 2
kill $TAIL_PID 2>/dev/null || true

if grep -q '"kind":"system/error"' /tmp/test-response.txt && grep -q 'capability_violation' /tmp/test-response.txt; then
  echo -e "tools/call blocked: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "tools/call blocked: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 5: Grant broader capability
echo -e "\n${YELLOW}Test 5: Grant tools/* wildcard capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
(echo "$GRANT_JSON" > "$COORD_FIFO" &)
sleep 2

if tail -10 "$LIMITED_LOG" | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "Wildcard grant acknowledged: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Wildcard grant acknowledged: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Limited agent can now call tools
echo -e "\n${YELLOW}Test 6: Limited agent calls add tool (should succeed)${NC}"
# Clear previous responses
echo "" > /tmp/test-response.txt
tail -f "$LIMITED_LOG" > /tmp/test-response.txt &
TAIL_PID=$!

(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > "$LIMITED_FIFO" &)
sleep 3
kill $TAIL_PID 2>/dev/null || true

if grep -q '"kind":"mcp/response"' /tmp/test-response.txt && grep -q '"text":"8"' /tmp/test-response.txt; then
  echo -e "Tool called successfully: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Tool called successfully: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 7: Revoke capabilities  
echo -e "\n${YELLOW}Test 7: Revoke tools/* capability${NC}"
REVOKE_JSON='{"kind":"capability/revoke","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
(echo "$REVOKE_JSON" > "$COORD_FIFO" &)
sleep 2

# Check if the revoke message was sent (revoke-ack might not be implemented yet)
if tail -10 "$LIMITED_LOG" | grep -q '"kind":"capability/revoke"'; then
  echo -e "Revoke sent: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Revoke sent: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 8: Limited agent can no longer call tools
echo -e "\n${YELLOW}Test 8: Limited agent attempts tools/call after revoke (should be blocked)${NC}"
# Clear previous responses
echo "" > /tmp/test-response.txt
tail -f "$LIMITED_LOG" > /tmp/test-response.txt &
TAIL_PID=$!

(echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":2,"b":2}}}}' > "$LIMITED_FIFO" &)
sleep 2
kill $TAIL_PID 2>/dev/null || true

if grep -q '"kind":"system/error"' /tmp/test-response.txt && grep -q 'capability_violation' /tmp/test-response.txt; then
  echo -e "Tool call blocked after revoke: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Tool call blocked after revoke: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Clean up temp file
rm -f /tmp/test-response.txt

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some tests failed${NC}"
  exit 1
fi