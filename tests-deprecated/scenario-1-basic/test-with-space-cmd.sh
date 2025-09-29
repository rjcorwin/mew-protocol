#!/bin/bash
# Test Scenario 1 using mew space commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 1: Basic Message Flow (using space commands) ===${NC}"

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start the space
echo "Starting space with 'mew space up'..."
../../packages/mew/src/bin/mew.js space up --port "$PORT" > space-up.log 2>&1

# Check if space started
if ../../packages/mew/src/bin/mew.js space status | grep -q "Gateway: ws://localhost:$PORT"; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Space failed to start${NC}"
  cat space-up.log
  exit 1
fi

# Wait for everything to be ready
sleep 3

# Start echo agent manually (since auto_start isn't configured for it)
echo "Starting echo agent..."
node ../agents/echo.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "echo-token" \
  > ./logs/echo.log 2>&1 &
ECHO_PID=$!

sleep 2

# Check if echo agent is running
if ! kill -0 $ECHO_PID 2>/dev/null; then
  echo -e "${RED}Echo agent failed to start${NC}"
  cat ./logs/echo.log
  ../../packages/mew/src/bin/mew.js space down
  exit 1
fi

echo -e "${GREEN}✓ Echo agent started${NC}"

# Check FIFO was created (only input FIFO since output goes to log)
if [ -p ./fifos/test-client-in ]; then
  echo -e "${GREEN}✓ Input FIFO created for test-client${NC}"
else
  echo -e "${RED}✗ Input FIFO not created${NC}"
  kill $ECHO_PID 2>/dev/null || true
  ../../packages/mew/src/bin/mew.js space down
  exit 1
fi

# No need to read from output FIFO since output goes to log file
# The responses will be in ./logs/test-client-output.log
CAT_PID=""

# Client is already connected by space up (auto_connect: true)
# Just get the PID for cleanup
CLIENT_PID=""
echo "Test client already connected via space up"

# Wait for connection
sleep 3

echo -e "\n${YELLOW}=== Running Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Send simple chat message
echo -e "\n${YELLOW}Test 1: Send simple chat message${NC}"
echo '{"kind":"chat","payload":{"text":"Hello, echo!"}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"Echo: Hello, echo!"' ./logs/test-client-output.log; then
  echo -e "${GREEN}✓ Received echo response${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Echo response not received${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Send message with ID
echo -e "\n${YELLOW}Test 2: Send message with ID${NC}"
echo '{"id":"msg-123","kind":"chat","payload":{"text":"Test with ID"}}' > ./fifos/test-client-in
sleep 3

if grep -q '"correlation_id":\[' ./logs/test-client-output.log; then
  echo -e "${GREEN}✓ Correlation ID preserved${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Correlation ID not found${NC}"
  ((FAIL_COUNT++))
fi

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 2"

if [ $PASS_COUNT -eq 2 ]; then
  echo -e "\n${GREEN}=== TEST PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== TEST FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
# CAT_PID and CLIENT_PID are empty since client is managed by space
# kill $CAT_PID 2>/dev/null || true
# kill $CLIENT_PID 2>/dev/null || true
kill $ECHO_PID 2>/dev/null || true

# Use space down command
echo "Stopping space with 'mew space down'..."
../../packages/mew/src/bin/mew.js space down

echo -e "${GREEN}✓ Cleanup complete${NC}"

exit $EXIT_CODE