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
OUTPUT_LOG="${OUTPUT_LOG:-./logs/test-client-output.log}"
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
    ((TESTS_PASSED++)) || true
  else
    echo -e "$test_name: ${RED}✗${NC}"
    ((TESTS_FAILED++)) || true
  fi

  return 0
}

send_http_message() {
  local payload="$1"
  local participant="${2:-test-client}"
  local token="${3:-test-token}"

  curl -s -o /tmp/scenario-6-last-response -w '%{http_code}' \
    -X POST "http://localhost:$TEST_PORT/participants/${participant}/messages" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    --data "$payload"
}

# Basic connectivity tests
echo "Testing: Gateway is running ... \c"
# Check if gateway is listening on the port
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

echo "Testing: Output log exists ... \c"
check_test "" "[ -f '$OUTPUT_LOG' ]"

# Test 1: Invalid JSON
echo -e "\n${YELLOW}Test 1: Send invalid JSON${NC}"
STATUS_INVALID=$(curl -s -o /tmp/scenario-6-invalid-response -w '%{http_code}' \
  -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d 'This is not valid JSON' || true)
if [[ "$STATUS_INVALID" == 4* ]]; then
  echo -e "Invalid JSON rejected with HTTP $STATUS_INVALID: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Invalid JSON rejected with HTTP $STATUS_INVALID: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 2: Message without kind field
echo -e "\n${YELLOW}Test 2: Message without 'kind' field${NC}"
STATUS_MISSING=$(curl -s -o /tmp/scenario-6-missing-kind -w '%{http_code}' \
  -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"text":"Missing kind field"}}' || true)
if [[ "$STATUS_MISSING" == 4* ]]; then
  echo -e "Missing 'kind' field rejected with HTTP $STATUS_MISSING: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Missing 'kind' field rejected with HTTP $STATUS_MISSING: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 3: Message to non-existent participant
echo -e "\n${YELLOW}Test 3: Message to non-existent participant${NC}"
STATUS_NON_EXISTENT=$(send_http_message '{"kind":"chat","payload":{"text":"hello from test"}}' 'ghost' 'test-token')
if [[ "$STATUS_NON_EXISTENT" == 4* || "$STATUS_NON_EXISTENT" == 5* ]]; then
  echo -e "Non-existent participant rejected with HTTP $STATUS_NON_EXISTENT: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Non-existent participant rejected with HTTP $STATUS_NON_EXISTENT: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Gateway should remain available
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway availability after rejection: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway availability after rejection: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 4: Very large message
echo -e "\n${YELLOW}Test 4: Very large message (10KB)${NC}"
LARGE_MSG='{"kind":"chat","payload":{"text":"'
LARGE_MSG+=$(printf 'A%.0s' {1..10000})
LARGE_MSG+='"}}'
STATUS_LARGE=$(send_http_message "$LARGE_MSG")
if [[ "$STATUS_LARGE" == 2* ]]; then
  echo -e "Large message accepted with HTTP $STATUS_LARGE: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Large message accepted with HTTP $STATUS_LARGE: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway alive after large message: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway alive after large message: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 5: Rapid message sending
echo -e "\n${YELLOW}Test 5: Rapid message sending (20 messages)${NC}"
RAPID_SUCCESS=0
for i in {1..20}; do
  STATUS_RAPID=$(send_http_message "{\"kind\":\"chat\",\"payload\":{\"text\":\"Message $i\"}}")
  if [[ "$STATUS_RAPID" == 2* ]]; then
    ((RAPID_SUCCESS++)) || true
  fi
done

if [[ $RAPID_SUCCESS -eq 20 ]]; then
  echo -e "Rapid messages accepted (${RAPID_SUCCESS}/20): ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Rapid messages accepted (${RAPID_SUCCESS}/20): ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway alive after rapid messages: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway alive after rapid messages: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 6: Empty message
echo -e "\n${YELLOW}Test 6: Empty message${NC}"
STATUS_EMPTY=$(send_http_message '{}')
if [[ "$STATUS_EMPTY" == 4* ]]; then
  echo -e "Empty message rejected with HTTP $STATUS_EMPTY: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Empty message rejected with HTTP $STATUS_EMPTY: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway alive after empty message: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway alive after empty message: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 7: Malformed message (unclosed JSON)
echo -e "\n${YELLOW}Test 7: Malformed JSON (unclosed)${NC}"
STATUS_MALFORMED=$(curl -s -o /tmp/scenario-6-malformed -w '%{http_code}' \
  -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  --data '{"kind":"chat"')
if [[ "$STATUS_MALFORMED" == 4* ]]; then
  echo -e "Malformed JSON rejected with HTTP $STATUS_MALFORMED: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Malformed JSON rejected with HTTP $STATUS_MALFORMED: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway alive after malformed JSON: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway alive after malformed JSON: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Test 8: Special characters in message
echo -e "\n${YELLOW}Test 8: Special characters in message${NC}"
STATUS_SPECIAL=$(send_http_message '{"kind":"chat","payload":{"text":"Symbols: © ™ 漢字 😊"}}')
if [[ "$STATUS_SPECIAL" == 2* ]]; then
  echo -e "Special characters accepted with HTTP $STATUS_SPECIAL: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Special characters accepted with HTTP $STATUS_SPECIAL: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "Gateway alive after special characters: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Gateway alive after special characters: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
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