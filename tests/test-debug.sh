#!/bin/bash
# Debug Test for Capability Granting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Debug Test: Capability Granting ===${NC}"

# Create test directory
TEST_DIR="./test-debug-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy test-space directory
cp -r ../test-space/* ./

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with space configuration and debug logging
echo "Starting gateway on port $PORT with debug logging..."
../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Connect as coordinator (admin privileges)
mkfifo coord-in coord-out

echo "Connecting coordinator..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id coordinator \
  --token "admin-token" \
  --fifo-in coord-in \
  --fifo-out coord-out \
  > coordinator.log 2>&1 &
COORD_PID=$!

# Connect as limited agent
mkfifo limited-in limited-out

echo "Connecting limited agent..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id limited-agent \
  --token "limited-token" \
  --fifo-in limited-in \
  --fifo-out limited-out \
  > limited.log 2>&1 &
LIMITED_PID=$!

# Wait for clients to connect
sleep 3

echo -e "\n${YELLOW}=== Testing Capability Grant ===${NC}"

# Test 1: Grant capability
echo "Granting tools/list capability..."
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/list","params":{}}}]}}'
echo "$GRANT_JSON" > coord-in
sleep 2

# Test 2: Try to use the granted capability
echo "Limited agent attempting tools/list..."
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > limited-in
sleep 2

# Check the logs
echo -e "\n${YELLOW}=== Gateway Log (last 20 lines) ===${NC}"
tail -20 gateway.log

echo -e "\n${YELLOW}=== Limited Agent Log (last 10 lines) ===${NC}"
tail -10 limited.log

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $COORD_PID 2>/dev/null || true
kill $LIMITED_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f coord-in coord-out limited-in limited-out

cd ..
echo -e "${YELLOW}Test directory: $TEST_DIR${NC}"