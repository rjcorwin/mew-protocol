#!/bin/bash
# Check script for Scenario 6: Error Recovery and Edge Cases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: Error Recovery and Edge Cases${NC}"
echo -e "${BLUE}Test directory: $(pwd)${NC}"
echo -e "${BLUE}Gateway port: ${TEST_PORT}${NC}"

# Get paths from environment or use defaults
TEST_FIFO="${TEST_FIFO:-./fifos/test-client-in}"
TEST_LOG="${TEST_LOG:-./logs/test-client-output.log}"
GATEWAY_LOG="./logs/gateway.log"

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

echo "Testing: Test client FIFO exists ... \c"
check_test "" "[ -p '$TEST_FIFO' ]"

echo "Testing: Output log exists ... \c"
check_test "" "[ -f '$TEST_LOG' ]"

# Test 1: Invalid JSON
echo -e "\n${YELLOW}Test 1: Send invalid JSON${NC}"
(echo 'This is not valid JSON' > "$TEST_FIFO" &)
sleep 2

# Check if error is logged (the gateway or client should handle it)
if tail -20 "$TEST_LOG" | grep -q '"kind":"system/error"' || tail -20 logs/*.log 2>/dev/null | grep -qi "invalid.*json\|json.*parse"; then
  echo -e "Invalid JSON handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Invalid JSON handled: ${RED}✗${NC} (error not detected)"
  ((TESTS_FAILED++))
fi

# Test 2: Message without kind field
echo -e "\n${YELLOW}Test 2: Message without 'kind' field${NC}"
(echo '{"payload":{"text":"Missing kind field"}}' > "$TEST_FIFO" &)
sleep 2

if tail -20 "$TEST_LOG" | grep -q '"kind":"system/error"' || tail -20 logs/*.log 2>/dev/null | grep -qi "missing.*kind\|kind.*required"; then
  echo -e "Missing 'kind' field handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Missing 'kind' field handled: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 3: Message to non-existent participant
echo -e "\n${YELLOW}Test 3: Message to non-existent participant${NC}"
(echo '{"kind":"chat","to":["nonexistent"],"payload":{"text":"Hello nobody"}}' > "$TEST_FIFO" &)
sleep 2

# This should be handled gracefully without errors
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Non-existent participant handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Non-existent participant handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

# Test 4: Very large message
echo -e "\n${YELLOW}Test 4: Very large message (10KB)${NC}"
LARGE_MSG='{"kind":"chat","payload":{"text":"'
LARGE_MSG+=$(printf 'A%.0s' {1..10000})
LARGE_MSG+='"}}'
(echo "$LARGE_MSG" > "$TEST_FIFO" &)
sleep 2

# Check if processes are still running
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Large message handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Large message handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

# Test 5: Rapid message sending
echo -e "\n${YELLOW}Test 5: Rapid message sending (20 messages)${NC}"
for i in {1..20}; do
  (echo '{"kind":"chat","payload":{"text":"Rapid message '$i'"}}' > "$TEST_FIFO" &)
done
sleep 3

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Rapid messages handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Rapid messages handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

# Test 6: Empty message
echo -e "\n${YELLOW}Test 6: Empty message${NC}"
(echo '' > "$TEST_FIFO" &)
sleep 1

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Empty message handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Empty message handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

# Test 7: Malformed message (unclosed JSON)
echo -e "\n${YELLOW}Test 7: Malformed JSON (unclosed)${NC}"
(echo '{"kind":"chat","payload":{"text":"Unclosed' > "$TEST_FIFO" &)
sleep 2

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Malformed JSON handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Malformed JSON handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

# Test 8: Special characters in message
echo -e "\n${YELLOW}Test 8: Special characters in message${NC}"
(echo '{"kind":"chat","payload":{"text":"Special chars: \n\t\r\"\\/"}}' > "$TEST_FIFO" &)
sleep 2

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Special characters handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Special characters handled: ${RED}✗${NC} (gateway crashed)"
  ((TESTS_FAILED++))
fi

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