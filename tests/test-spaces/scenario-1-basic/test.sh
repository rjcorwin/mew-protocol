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

# Start gateway with space configuration
echo "Starting gateway on port $PORT..."
../../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > ./logs/gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat ./logs/gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Start echo agent
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
  exit 1
fi

echo -e "${GREEN}✓ Echo agent started${NC}"

# Create FIFOs for test client
mkdir -p ./fifos
mkfifo ./fifos/test-client-in ./fifos/test-client-out

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

# Start reading from FIFO
cat ./fifos/test-client-out > ./logs/responses.txt &
CAT_PID=$!

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
sleep 2

if grep -q '"correlation_id":\["msg-123"\]' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Correlation ID preserved${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Correlation ID not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Send multiple messages
echo -e "\n${YELLOW}Test 3: Send multiple messages${NC}"
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
kill $CLIENT_PID 2>/dev/null || true
kill $ECHO_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f ./fifos/test-client-in ./fifos/test-client-out

exit $EXIT_CODE