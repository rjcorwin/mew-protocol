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
  export FIFO_IN="$TEST_DIR/fifos/test-client-in"
  export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"
  
  # Try to detect port from running space
  if [ -f "$TEST_DIR/.meup/pids.json" ]; then
    export TEST_PORT=$(grep -o '"port":[[:space:]]*"[0-9]*"' "$TEST_DIR/.meup/pids.json" | grep -o '[0-9]*')
  fi
  
  if [ -z "$TEST_PORT" ]; then
    echo -e "${RED}Error: Cannot determine test port. Is the space running?${NC}"
    exit 1
  fi
fi

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: Basic Message Flow${NC}"
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

# Test 3: Send simple chat message
echo -e "\n${YELLOW}Test: Simple chat message${NC}"
# Write to FIFO in background to avoid blocking
(echo '{"kind":"chat","payload":{"text":"Hello, echo!"}}' > "$FIFO_IN" &)
sleep 2

if grep -q '"text":"Echo: Hello, echo!"' "$RESPONSE_FILE" 2>/dev/null; then
  echo -e "Echo response: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Echo response: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 4: Send message with ID (correlation)
echo -e "\n${YELLOW}Test: Message with correlation ID${NC}"
(echo '{"id":"msg-123","kind":"chat","payload":{"text":"Test with ID"}}' > "$FIFO_IN" &)
sleep 2

if grep -q 'correlation_id.*msg-123' "$RESPONSE_FILE" 2>/dev/null; then
  echo -e "Correlation ID preserved: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Correlation ID preserved: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 5: Send multiple messages
echo -e "\n${YELLOW}Test: Multiple messages${NC}"
(echo '{"kind":"chat","payload":{"text":"Message 1"}}' > "$FIFO_IN" &)
sleep 0.5
(echo '{"kind":"chat","payload":{"text":"Message 2"}}' > "$FIFO_IN" &)
sleep 0.5
(echo '{"kind":"chat","payload":{"text":"Message 3"}}' > "$FIFO_IN" &)
sleep 2

MSG_COUNT=$(grep -c '"text":"Echo: Message' "$RESPONSE_FILE" 2>/dev/null || echo 0)
if [ "$MSG_COUNT" -eq 3 ]; then
  echo -e "All 3 messages received: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Multiple messages: ${RED}✗ (only $MSG_COUNT/3 received)${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Large message
echo -e "\n${YELLOW}Test: Large message handling${NC}"
LARGE_TEXT=$(printf 'A%.0s' {1..1000})
(echo "{\"kind\":\"chat\",\"payload\":{\"text\":\"$LARGE_TEXT\"}}" > "$FIFO_IN" &)
sleep 2

if grep -q "Echo: $LARGE_TEXT" "$RESPONSE_FILE" 2>/dev/null; then
  echo -e "Large message handled: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Large message handled: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 7: Rapid messages (test FIFO buffering fix)
echo -e "\n${YELLOW}Test: Rapid message handling${NC}"
for i in 1 2 3 4 5; do
  (echo "{\"kind\":\"chat\",\"payload\":{\"text\":\"Rapid $i\"}}" > "$FIFO_IN" &)
  sleep 0.1
done
sleep 2

RAPID_COUNT=$(grep -c '"text":"Echo: Rapid' "$RESPONSE_FILE" 2>/dev/null || echo 0)
if [ "$RAPID_COUNT" -eq 5 ]; then
  echo -e "All 5 rapid messages processed: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Rapid messages: ${RED}✗ (only $RAPID_COUNT/5 received)${NC}"
  ((TESTS_FAILED++))
fi

# Don't clean up the log file - it's persistent

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