#!/bin/bash
# Test Scenario 1: Basic Message Flow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 1: Basic Message Flow ===${NC}"

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start the space using meup space up
echo "Starting space on port $PORT..."
../../../cli/bin/meup.js space up --port "$PORT" > ./logs/space-up.log 2>&1

# Check if space started successfully
if ../../../cli/bin/meup.js space status | grep -q "Gateway: ws://localhost:$PORT"; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Space failed to start${NC}"
  cat ./logs/space-up.log
  exit 1
fi

# Wait for all components to be ready
sleep 3

# Start reading from FIFO (FIFOs are created by space up)
cat ./fifos/test-client-out > ./logs/responses.txt &
CAT_PID=$!

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

# Test 3: Send multiple messages
echo -e "\n${YELLOW}Test 3: Send multiple messages${NC}"
sleep 1  # Wait for previous test to complete
echo '{"kind":"chat","payload":{"text":"Message 1"}}' > ./fifos/test-client-in
sleep 1
echo '{"kind":"chat","payload":{"text":"Message 2"}}' > ./fifos/test-client-in
sleep 1
echo '{"kind":"chat","payload":{"text":"Message 3"}}' > ./fifos/test-client-in
sleep 2

MSG_COUNT=$(grep -c '"text":"Echo: Message' ./logs/responses.txt 2>/dev/null || echo 0)
if [ $MSG_COUNT -eq 3 ]; then
  echo -e "${GREEN}✓ All 3 messages received${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Only $MSG_COUNT messages received${NC}"
  ((FAIL_COUNT++))
fi

# Test 4: Large message
echo -e "\n${YELLOW}Test 4: Large message${NC}"
LARGE_TEXT=$(printf 'A%.0s' {1..1000})
echo "{\"kind\":\"chat\",\"payload\":{\"text\":\"$LARGE_TEXT\"}}" > ./fifos/test-client-in
sleep 2

if grep -q "Echo: $LARGE_TEXT" ./logs/responses.txt; then
  echo -e "${GREEN}✓ Large message handled${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Large message not handled${NC}"
  ((FAIL_COUNT++))
fi

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 4"

if [ $PASS_COUNT -eq 4 ]; then
  echo -e "\n${GREEN}=== SCENARIO 1 PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 1 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CAT_PID 2>/dev/null || true

# Use space down command to stop all components
../../../cli/bin/meup.js space down

exit $EXIT_CODE