#!/bin/bash
# Check script - Runs test assertions against a running space
#
# Can be run after manual setup or called by test.sh
# Expects environment variables set by setup.sh:
#   - TEST_DIR: Directory containing the test
#   - TEST_PORT: Port the gateway is running on
#   - FIFO_IN: Input FIFO path
#   - FIFO_OUT: Output FIFO path

set -e

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
  export FIFO_OUT="$TEST_DIR/fifos/test-client-out"
  
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

# Test 1: Check if gateway is running
run_test "Gateway is running" "curl -s http://localhost:$TEST_PORT/health | grep -q 'ok'"

# Test 2: Check if FIFOs exist
run_test "Input FIFO exists" "[ -p '$FIFO_IN' ]"
run_test "Output FIFO exists" "[ -p '$FIFO_OUT' ]"

# Test 3: Check if echo agent is connected (check logs)
run_test "Echo agent connected" "grep -q 'Echo agent connected' '$TEST_DIR/logs/space-up.log' || grep -q 'Connected to gateway' '$TEST_DIR/logs/echo.log' 2>/dev/null"

# Test 4: Send a message and check for echo response
echo -e "\n${YELLOW}Testing message flow...${NC}"

# Start reading from output FIFO in background
RESPONSE_FILE="$TEST_DIR/logs/test-response-$$.txt"
timeout 5 cat "$FIFO_OUT" > "$RESPONSE_FILE" 2>/dev/null &
CAT_PID=$!

# Send test message
TEST_MESSAGE='{"kind":"chat","payload":{"text":"Test message from check.sh"}}'
echo "$TEST_MESSAGE" > "$FIFO_IN"

# Wait for response
sleep 2

# Kill the cat process if still running
kill $CAT_PID 2>/dev/null || true

# Check if we got both the original and echo response
if [ -f "$RESPONSE_FILE" ]; then
  # Check for original message
  if grep -q '"text":"Test message from check.sh"' "$RESPONSE_FILE"; then
    echo -e "Original message received: ${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "Original message received: ${RED}✗${NC}"
    ((TESTS_FAILED++))
  fi
  
  # Check for echo response
  if grep -q '"text":"Echo: Test message from check.sh"' "$RESPONSE_FILE"; then
    echo -e "Echo response received: ${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "Echo response received: ${RED}✗${NC}"
    ((TESTS_FAILED++))
  fi
  
  # Clean up response file
  rm -f "$RESPONSE_FILE"
else
  echo -e "Message flow test: ${RED}✗ (no response received)${NC}"
  ((TESTS_FAILED+=2))
fi

# Test 5: Test rapid message handling
echo -e "\n${YELLOW}Testing rapid message handling...${NC}"

RAPID_RESPONSE_FILE="$TEST_DIR/logs/rapid-response-$$.txt"
timeout 5 cat "$FIFO_OUT" > "$RAPID_RESPONSE_FILE" 2>/dev/null &
CAT_PID=$!

# Send 3 messages rapidly
for i in 1 2 3; do
  echo "{\"kind\":\"chat\",\"payload\":{\"text\":\"Rapid message $i\"}}" > "$FIFO_IN"
  sleep 0.1
done

# Wait for responses
sleep 2

# Kill the cat process if still running
kill $CAT_PID 2>/dev/null || true

# Count how many echo responses we got
if [ -f "$RAPID_RESPONSE_FILE" ]; then
  ECHO_COUNT=$(grep -c '"Echo: Rapid message' "$RAPID_RESPONSE_FILE" 2>/dev/null || echo 0)
  
  if [ "$ECHO_COUNT" -eq 3 ]; then
    echo -e "All 3 rapid messages processed: ${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "Rapid message processing: ${RED}✗ (got $ECHO_COUNT/3 responses)${NC}"
    ((TESTS_FAILED++))
  fi
  
  rm -f "$RAPID_RESPONSE_FILE"
else
  echo -e "Rapid message test: ${RED}✗ (no responses received)${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Test clean command (dry-run only to avoid disrupting running space)
echo -e "\n${YELLOW}Testing clean command...${NC}"

# Test dry-run functionality
CLEAN_OUTPUT=$($TEST_DIR/../../../cli/bin/meup.js space clean --dry-run 2>&1)
if echo "$CLEAN_OUTPUT" | grep -q "Would clean:"; then
  echo -e "Clean command dry-run: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Clean command dry-run: ${RED}✗${NC}"
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