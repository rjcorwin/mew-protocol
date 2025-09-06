#!/bin/bash
# Test Scenario 1 using meup space commands

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
echo "Starting space with 'meup space up'..."
../../../cli/bin/meup.js space up --port "$PORT" > space-up.log 2>&1

# Check if space started
if ../../../cli/bin/meup.js space status | grep -q "Gateway: ws://localhost:$PORT"; then
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
node ./agents/echo.js \
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
  ../../../cli/bin/meup.js space down
  exit 1
fi

echo -e "${GREEN}✓ Echo agent started${NC}"

# Check FIFOs were created
if [ -p ./fifos/test-client-in ] && [ -p ./fifos/test-client-out ]; then
  echo -e "${GREEN}✓ FIFOs created for test-client${NC}"
else
  echo -e "${RED}✗ FIFOs not created${NC}"
  kill $ECHO_PID 2>/dev/null || true
  ../../../cli/bin/meup.js space down
  exit 1
fi

# Start reading from FIFO
cat ./fifos/test-client-out > ./logs/responses.txt &
CAT_PID=$!

# Connect test client
echo "Connecting test client..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id test-client \
  --token "test-token" \
  --fifo-in ./fifos/test-client-in \
  --fifo-out ./fifos/test-client-out \
  > ./logs/test-client.log 2>&1 &
CLIENT_PID=$!

# Wait for connection
sleep 3

echo -e "\n${YELLOW}=== Running Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Send simple chat message
echo -e "\n${YELLOW}Test 1: Send simple chat message${NC}"
echo '{"kind":"chat","payload":{"text":"Hello, echo!"}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"Echo: Hello, echo!"' ./logs/responses.txt; then
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

if grep -q 'correlation_id.*msg-123' ./logs/responses.txt; then
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
kill $CAT_PID 2>/dev/null || true
kill $CLIENT_PID 2>/dev/null || true
kill $ECHO_PID 2>/dev/null || true

# Use space down command
echo "Stopping space with 'meup space down'..."
../../../cli/bin/meup.js space down

echo -e "${GREEN}✓ Cleanup complete${NC}"

exit $EXIT_CODE