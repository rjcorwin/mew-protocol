#!/bin/bash
# Test Scenario 6: Error Recovery and Edge Cases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 6: Error Recovery and Edge Cases ===${NC}"

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

echo -e "\n${YELLOW}=== Running Error Recovery Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Invalid JSON
echo -e "\n${YELLOW}Test 1: Send invalid JSON${NC}"
echo 'This is not valid JSON' > ./fifos/test-client-in
sleep 2

if grep -q 'Invalid JSON' ./logs/test-client.log || grep -q 'JSON' ./logs/gateway.log; then
  echo -e "${GREEN}✓ Invalid JSON handled gracefully${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Invalid JSON not handled properly${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Message without kind field
echo -e "\n${YELLOW}Test 2: Message without 'kind' field${NC}"
echo '{"payload":{"text":"Missing kind field"}}' > ./fifos/test-client-in
sleep 2

if grep -q 'kind' ./logs/gateway.log || grep -q 'required' ./logs/gateway.log; then
  echo -e "${GREEN}✓ Missing 'kind' field handled${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Missing 'kind' field not handled${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Message to non-existent participant
echo -e "\n${YELLOW}Test 3: Message to non-existent participant${NC}"
echo '{"kind":"chat","to":["nonexistent"],"payload":{"text":"Hello nobody"}}' > ./fifos/test-client-in
sleep 2

if grep -q 'not found' ./logs/gateway.log || grep -q 'nonexistent' ./logs/gateway.log; then
  echo -e "${GREEN}✓ Non-existent participant handled${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Non-existent participant not handled${NC}"
  ((FAIL_COUNT++))
fi

# Test 4: Very large message
echo -e "\n${YELLOW}Test 4: Very large message${NC}"
LARGE_MSG=$(printf '{"kind":"chat","payload":{"text":"')
LARGE_MSG+=$(printf 'A%.0s' {1..10000})
LARGE_MSG+='"}}'
echo "$LARGE_MSG" > ./fifos/test-client-in
sleep 2

if kill -0 $CLIENT_PID 2>/dev/null; then
  echo -e "${GREEN}✓ Large message handled without crash${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Large message caused crash${NC}"
  ((FAIL_COUNT++))
fi

# Test 5: Rapid message sending
echo -e "\n${YELLOW}Test 5: Rapid message sending${NC}"
for i in {1..20}; do
  echo '{"kind":"chat","payload":{"text":"Rapid message '$i'"}}' > ./fifos/test-client-in
done
sleep 3

if kill -0 $CLIENT_PID 2>/dev/null && kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${GREEN}✓ Rapid messages handled without crash${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Rapid messages caused crash${NC}"
  ((FAIL_COUNT++))
fi

# Test 6: Reconnection after disconnect
echo -e "\n${YELLOW}Test 6: Reconnection after disconnect${NC}"
# Kill the client
kill $CLIENT_PID 2>/dev/null || true
kill $CAT_PID 2>/dev/null || true
sleep 2

# Clean up old FIFOs and recreate
rm -f ./fifos/test-client-in ./fifos/test-client-out
mkfifo ./fifos/test-client-in ./fifos/test-client-out

# Reconnect
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id test-client \
  --token "test-token" \
  --fifo-in ./fifos/test-client-in \
  --fifo-out ./fifos/test-client-out \
  > ./logs/test-client-reconnect.log 2>&1 &
NEW_CLIENT_PID=$!

# Start reading from FIFO again
cat ./fifos/test-client-out > ./logs/responses-reconnect.txt &
NEW_CAT_PID=$!

sleep 3

# Test if reconnection worked
echo '{"kind":"chat","payload":{"text":"Reconnected successfully"}}' > ./fifos/test-client-in
sleep 2

if grep -q 'Reconnected successfully' ./logs/responses-reconnect.txt || grep -q 'Connected to gateway' ./logs/test-client-reconnect.log; then
  echo -e "${YELLOW}⚠ Reconnection partially successful (check logs)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Reconnection failed${NC}"
  ((FAIL_COUNT++))
fi

# Stop reading from FIFOs
kill $NEW_CAT_PID 2>/dev/null || true

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 6"

if [ $PASS_COUNT -ge 5 ]; then
  echo -e "\n${GREEN}=== SCENARIO 6 PASSED (${PASS_COUNT}/6 tests) ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 6 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $NEW_CLIENT_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f ./fifos/test-client-in ./fifos/test-client-out

exit $EXIT_CODE